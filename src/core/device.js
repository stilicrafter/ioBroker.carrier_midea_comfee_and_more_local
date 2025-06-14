/**
 * Base device implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

const net = require('net');
const { EventEmitter } = require('events');
const { LocalSecurity, MSGTYPE_HANDSHAKE_REQUEST, MSGTYPE_ENCRYPTED_REQUEST } = require('./security');
const PacketBuilder = require('./packet-builder');
const { MessageType, MessageQuestCustom, MessageQueryAppliance, MessageApplianceResponse, ParseMessageResult } = require('./message');

// Custom error classes
class AuthException extends Error {
  constructor(message) {
    super(message || 'Authentication failed');
    this.name = 'AuthException';
  }
}

class ResponseException extends Error {
  constructor(message) {
    super(message || 'Unexpected response received');
    this.name = 'ResponseException';
  }
}

class RefreshFailed extends Error {
  constructor(message) {
    super(message || 'Refresh status failed');
    this.name = 'RefreshFailed';
  }
}

/**
 * Base device class for all Midea devices
 */
class MideaDevice extends EventEmitter {
  /**
   * Create a new Midea device
   * @param {string} name - Device name
   * @param {number} deviceId - Device ID
   * @param {number} deviceType - Device type
   * @param {string} ipAddress - IP address
   * @param {number} port - Port
   * @param {string} token - Token (hex string)
   * @param {string} key - Key (hex string)
   * @param {number} protocol - Protocol version
   * @param {string} model - Device model
   * @param {number} subtype - Device subtype
   * @param {Object} attributes - Initial attributes
   */
  constructor(name, deviceId, deviceType, ipAddress, port, token, key, protocol, model, subtype, attributes) {
    super();
    this._name = name;
    this._deviceId = deviceId;
    this._deviceType = deviceType;
    this._ipAddress = ipAddress;
    this._port = port;
    this._protocol = protocol;
    this._model = model;
    this._subtype = subtype;
    this._attributes = attributes || {};

    this._security = new LocalSecurity(token, key);
    this._socket = null;
    this._buffer = Buffer.alloc(0); // Buffer to store incoming data
    this._waitingForResponse = null; // Promise resolver for sendCommand
    this._responseTimeout = null; // Timeout for sendCommand
    this._retries = 0;
    this._isConnecting = false; // Flag to prevent multiple connection attempts
    this._isRunning = false; // Flag to indicate if the _run loop is active

    // Bind methods to this instance
    this.handleSocketClose = this.handleSocketClose.bind(this);
    this.handleSocketError = this.handleSocketError.bind(this);
  }

  /**
   * Connect to the device
   * @param {boolean} refreshStatus - Whether to refresh status after connection
   * @returns {Promise<boolean>} - True if connected and authenticated
   */
  connect(refreshStatus = false) {
    return new Promise((resolve, reject) => {
      if (this._socket && !this._socket.destroyed) {
        // Already connected
        console.debug(`[${this._deviceId}] Already connected.`);
        return resolve(true);
      }

      if (this._isConnecting) {
        console.debug(`[${this._deviceId}] Already connecting...`);
        return resolve(false); // Or reject, depending on desired behavior
      }

      this._isConnecting = true;
      this._socket = new net.Socket();
      this._socket.setTimeout(60000); // 60 seconds timeout for inactivity

      this._socket.on('close', this.handleSocketClose);
      this._socket.on('error', this.handleSocketError);

      // *******************************************************************
      // WICHTIG: Den 'data'-Handler HIER registrieren, NUR EINMAL pro Socket!
      // *******************************************************************
      this._socket.on('data', (data) => {
        try {
          const msgLen = data.length;
          if (msgLen === 0) {
            console.warn(`[${this._deviceId}] Received empty data packet.`);
            this.closeSocket();
            return;
          }
          console.debug(`[${this._deviceId}] Received ${msgLen} bytes of data.`);

          const result = this.parseMessage(data);

          if (result === ParseMessageResult.ERROR) {
            console.debug(`[${this._deviceId}] Message 'ERROR' received or parsing error.`);
            this.closeSocket();
          } else if (result === ParseMessageResult.SUCCESS) {
            // Message successfully parsed and processed.
            // If there was a pending response for sendCommand, resolve it here.
            if (this._waitingForResponse) {
                clearTimeout(this._responseTimeout); // Clear the timeout
                this._waitingForResponse(); // Resolve the promise
                this._waitingForResponse = null; // Reset for next command
                this._responseTimeout = null;
            }
          }
          // If result is PADDING, it means we need more data, so just wait.

        } catch (error) {
          console.error(`[${this._deviceId}] Error handling incoming data: ${error.message}`);
          this.closeSocket(); // Close socket on data handling error
        }
      });

      this._socket.connect(this._port, this._ipAddress, async () => {
        console.debug(`[${this._deviceId}] Connected`);
        this._isConnecting = false; // Reset connecting flag

        try {
          if (this._protocol === 3) {
            await this.authenticate();
          }

          console.debug(`[${this._deviceId}] Authentication success`);

          if (refreshStatus) {
            await this.refreshStatus(true);
          }

          this.enableDevice(true);
          resolve(true);
        } catch (error) {
          console.error(`[${this._deviceId}] Authentication or refresh failed: ${error.message}`);
          this.enableDevice(false);
          this.closeSocket(); // Close socket on auth/refresh error
          reject(error);
        }
      });
    });
  }

  /**
   * Handle socket close event
   */
  handleSocketClose() {
    console.debug(`[${this._deviceId}] Socket closed.`);
    this.closeSocket();
  }

  /**
   * Handle socket error event
   * @param {Error} err - Error object
   */
  handleSocketError(err) {
    console.error(`[${this._deviceId}] Socket error: ${err.message}`);
    this.closeSocket(); // Close socket on error
  }


  /**
   * Close the socket connection
   */
  closeSocket() {
    if (this._socket) {
      console.debug(`[${this._deviceId}] Closing socket.`);
      this._socket.removeAllListeners(); // IMPORTANT: Remove all listeners to prevent memory leaks
      this._socket.destroy(); // Destroy the socket
      this._socket = null;
      this._buffer = Buffer.alloc(0); // Clear buffer on close
      this._isConnecting = false; // Reset connecting flag
      this._retries = 0; // Reset retries
      this._isRunning = false; // Stop the _run loop
    }
    if (this._waitingForResponse) {
        clearTimeout(this._responseTimeout);
        this._waitingForResponse = null;
        this._responseTimeout = null;
    }
    this.enableDevice(false); // Mark device as disabled
  }

  /**
   * Authenticate with the device
   * @returns {Promise<void>}
   */
  async authenticate() {
    console.debug(`[${this._deviceId}] Authenticating with device...`);
    const request = PacketBuilder.encode(this._deviceType, MSGTYPE_HANDSHAKE_REQUEST, Buffer.from([]), this._protocol);
    const response = await this.sendCommand(MSGTYPE_HANDSHAKE_REQUEST, request);
    if (!response || response.messageType !== MSGTYPE_HANDSHAKE_RESPONSE) {
      throw new AuthException('Unexpected handshake response');
    }
    this._security.setSessionKey(response.payload);
    console.debug(`[${this._deviceId}] Authentication successful.`);
  }

  /**
   * Send a command to the device
   * @param {number} messageType - Expected message type for response
   * @param {Buffer} data - Command data
   * @returns {Promise<Object>} - Decrypted response payload
   */
  sendCommand(messageType, data) {
    return new Promise((resolve, reject) => {
      if (!this._socket || this._socket.destroyed) {
        return reject(new Error('Socket not connected.'));
      }

      console.debug(`[${this._deviceId}] Sending command (Type: ${messageType}) with ${data.length} bytes.`);
      this._socket.write(this._security.encrypt(data));

      // Set up a timeout for the response
      this._responseTimeout = setTimeout(() => {
        console.warn(`[${this._deviceId}] Command response timed out for message type ${messageType}.`);
        this._waitingForResponse = null;
        this._responseTimeout = null;
        this.closeSocket(); // Close socket on timeout
        reject(new ResponseException(`Command response timed out for message type ${messageType}`));
      }, 5000); // 5 seconds timeout

      // Store the resolve function to be called by the data handler
      this._waitingForResponse = (responsePayload) => {
          // This resolve is now triggered by parseMessage when a SUCCESS is received.
          // The actual payload is passed through the attribute updates.
          resolve(responsePayload); // We might need to adjust what's resolved here based on parseMessage.
                                   // For now, it will resolve when *any* successful message is processed.
                                   // A more robust solution would match the response to the request.
      };
    });
  }


  /**
   * Parse incoming messages
   * @param {Buffer} data - Incoming data buffer
   * @returns {ParseMessageResult} - Result of parsing
   */
  parseMessage(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    let result = ParseMessageResult.PADDING;
    const [packets, remainingData] = this._security.decode8370(this._buffer);

    if (packets.length === 0 && remainingData.length === this._buffer.length) {
      // No complete packets yet, need more data
      return ParseMessageResult.PADDING;
    }

    this._buffer = remainingData;

    for (const packet of packets) {
      if (packet.toString('ascii') === 'ERROR') {
        console.error(`[${this._deviceId}] Device returned ERROR message.`);
        return ParseMessageResult.ERROR;
      }
      try {
        const message = new MessageApplianceResponse(packet);
        if (message.isValid) {
          this.processMessage(message);
          result = ParseMessageResult.SUCCESS;
        } else {
          console.warn(`[${this._deviceId}] Invalid message received: ${packet.toString('hex')}`);
          result = ParseMessageResult.ERROR; // Treat invalid message as error for now
        }
      } catch (error) {
        console.error(`[${this._deviceId}] Error parsing message: ${error.message}. Packet: ${packet.toString('hex')}`);
        result = ParseMessageResult.ERROR;
      }
    }
    return result;
  }

  /**
   * Process a parsed message
   * @param {Object} message - Parsed message object
   */
  processMessage(message) {
    // Default implementation does nothing, overridden by subclasses
    // console.debug(`[${this._deviceId}] Processing message: ${JSON.stringify(message)}`);
  }

  /**
   * Refresh device status
   * @param {boolean} force - Force refresh
   * @returns {Promise<void>}
   */
  async refreshStatus(force = false) {
    if (this._protocol === 3) {
      console.debug(`[${this._deviceId}] Refreshing status...`);
      const message = new MessageQueryAppliance(this._deviceType);
      try {
        await this.sendCommand(MessageType.QUERY, message.serialize());
        console.debug(`[${this._deviceId}] Status refreshed successfully.`);
      } catch (error) {
        console.error(`[${this._deviceId}] Failed to refresh status: ${error.message}`);
        throw new RefreshFailed(`Failed to refresh status: ${error.message}`);
      }
    } else {
      console.warn(`[${this._deviceId}] Refresh status not supported for protocol ${this._protocol}.`);
    }
  }

  /**
   * Enable/disable the device
   * @param {boolean} enable - True to enable, false to disable
   */
  enableDevice(enable) {
    if (this._isRunning !== enable) {
      this._isRunning = enable;
      if (enable) {
        this._run(); // Start the background loop
      }
    }
  }

  /**
   * Background loop for device communication
   */
  async _run() {
    let timeoutCounter = 0;
    while (this._isRunning) {
      try {
        // If socket is not connected or destroyed, try to reconnect
        if (!this._socket || this._socket.destroyed) {
          console.debug(`[${this._deviceId}] Socket not connected, trying to reconnect.`);
          try {
            const connected = await this.connect();
            if (!connected) {
                // If connect returns false, it means another connect attempt is ongoing,
                // or some other transient issue. Wait before retrying.
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue; // Skip to next iteration of _run loop
            }
          } catch (error) {
            console.error(`[${this._deviceId}] Reconnection failed: ${error.message}. Retrying in 5s...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue; // Skip to next iteration of _run loop
          }
        }

        // If connected, send heartbeat or other periodic commands
        // This part needs to be carefully designed to avoid busy-waiting.
        // For now, sending a custom query as a heartbeat.
        if (this._protocol === 3) {
            try {
                const message = new MessageQuestCustom(this._deviceType);
                await this.sendCommand(MessageType.QUERY, message.serialize());
                timeoutCounter = 0; // Reset timeout counter on successful communication
            } catch (error) {
                console.warn(`[${this._deviceId}] Heartbeat or custom query failed: ${error.message}`);
            }
        }

        // Check for timeout
        if (timeoutCounter >= 120) { // 120 seconds (2 minutes) without successful communication
          console.debug(`[${this._deviceId}] Heartbeat timed out.`);
          this.closeSocket();
          break; // Exit the _run loop
        }

        // Wait a bit before next iteration
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        timeoutCounter++;
      } catch (error) {
        console.error(`[${this._deviceId}] Unknown error in _run loop: ${error.stack || error.message}`);
        this.closeSocket(); // Ensure socket is closed on any unhandled error in _run
      }
    }
    console.debug(`[${this._deviceId}] _run loop stopped.`);
  }

  /**
   * Set device attribute
   * @param {string} attr - Attribute name
   * @param {any} value - Attribute value
   */
  setAttribute(attr, value) {
    throw new Error('Not implemented');
  }

  /**
   * Get device attribute
   * @param {string} attr - Attribute name
   * @returns {any} - Attribute value
   */
  getAttribute(attr) {
    return this._attributes[attr];
  }

  /**
   * Set device customization
   * @param {Object} customize - Customization object
   */
  setCustomize(customize) {
    // Default implementation does nothing
  }

  /**
   * Get all device attributes
   * @returns {Object} - All attributes
   */
  get attributes() {
    const ret = {};
    
    for (const status in this._attributes) {
      ret[status.toString()] = this._attributes[status];
    }
    
    return ret;
  }
}

// Export constants for message parsing results
const ParseMessageResult = {
  SUCCESS: 0,
  PADDING: 1,
  ERROR: 2,
};

module.exports = {
  MideaDevice,
  AuthException,
  ResponseException,
  RefreshFailed,
  ParseMessageResult
};