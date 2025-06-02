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
   * @param {string} model - Model
   * @param {number} subtype - Subtype
   * @param {Object} attributes - Device attributes
   */
  constructor(name, deviceId, deviceType, ipAddress, port, token, key, protocol, model, subtype, attributes) {
    super();
    this._attributes = attributes || {};
    this._socket = null;
    this._ipAddress = ipAddress;
    this._port = port;
    this._security = new LocalSecurity();
    this._token = token ? Buffer.from(token, 'hex') : null;
    this._key = key ? Buffer.from(key, 'hex') : null;
    this._buffer = Buffer.alloc(0);
    this._deviceName = name;
    this._deviceId = deviceId;
    this._deviceType = deviceType;
    this._protocol = protocol;
    this._model = model;
    this._subtype = subtype;
    this._protocolVersion = 0;
    this._updates = [];
    this._unsupportedProtocol = [];
    this._isRunning = false;
    this._available = true;
    this._applianceQuery = true;
    this._refreshInterval = 30;
    this._heartbeatInterval = 10;
    this._defaultRefreshInterval = 30;
  }

  /**
   * Get device name
   * @returns {string} - Device name
   */
  get name() {
    return this._deviceName;
  }

  /**
   * Get device availability
   * @returns {boolean} - Device availability
   */
  get available() {
    return this._available;
  }

  /**
   * Get device ID
   * @returns {number} - Device ID
   */
  get deviceId() {
    return this._deviceId;
  }

  /**
   * Get device type
   * @returns {number} - Device type
   */
  get deviceType() {
    return this._deviceType;
  }

  /**
   * Get device model
   * @returns {string} - Device model
   */
  get model() {
    return this._model;
  }

  /**
   * Get device subtype
   * @returns {number} - Device subtype
   */
  get subtype() {
    return this._subtype;
  }

  /**
   * Extract v2 messages from buffer
   * @param {Buffer} msg - Message buffer
   * @returns {Array} - Array of [messages, remaining buffer]
   */
  static fetchV2Message(msg) {
    const result = [];
    let remainingMsg = Buffer.from(msg);
    
    while (remainingMsg.length > 0) {
      const factualMsgLen = remainingMsg.length;
      if (factualMsgLen < 6) {
        break;
      }
      
      const allegedMsgLen = remainingMsg[4] + (remainingMsg[5] << 8);
      
      if (factualMsgLen >= allegedMsgLen) {
        result.push(remainingMsg.slice(0, allegedMsgLen));
        remainingMsg = remainingMsg.slice(allegedMsgLen);
      } else {
        break;
      }
    }
    
    return [result, remainingMsg];
  }

  /**
   * Connect to the device
   * @param {boolean} refreshStatus - Whether to refresh status after connection
   * @returns {boolean} - Connection success
   */
  connect(refreshStatus = true) {
    try {
      this._socket = new net.Socket();
      this._socket.setTimeout(10000); // 10 seconds timeout
      
      console.debug(`[${this._deviceId}] Connecting to ${this._ipAddress}:${this._port}`);
      
      return new Promise((resolve, reject) => {
        // Handle connection
        this._socket.connect(this._port, this._ipAddress, async () => {
          console.debug(`[${this._deviceId}] Connected`);
          
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
            this.enableDevice(false);
            reject(error);
          }
        });
        
        // Handle errors
        this._socket.on('error', (error) => {
          console.debug(`[${this._deviceId}] Connection error: ${error.message}`);
          this.enableDevice(false);
          reject(error);
        });
        
        // Handle timeout
        this._socket.on('timeout', () => {
          console.debug(`[${this._deviceId}] Connection timed out`);
          this._socket.destroy();
          this.enableDevice(false);
          reject(new Error('Connection timed out'));
        });
      });
    } catch (error) {
      if (error instanceof AuthException) {
        console.debug(`[${this._deviceId}] Authentication failed`);
      } else if (error instanceof ResponseException) {
        console.debug(`[${this._deviceId}] Unexpected response received`);
      } else if (error instanceof RefreshFailed) {
        console.debug(`[${this._deviceId}] Refresh status is timed out`);
      } else {
        console.error(`[${this._deviceId}] Unknown error: ${error.stack || error.message}`);
      }
      
      this.enableDevice(false);
      return false;
    }
  }

  /**
   * Authenticate with the device
   * @returns {Promise<void>}
   */
  async authenticate() {
    const request = this._security.encode8370(this._token, MSGTYPE_HANDSHAKE_REQUEST);
    console.debug(`[${this._deviceId}] Handshaking`);
    
    return new Promise((resolve, reject) => {
      this._socket.write(request, (err) => {
        if (err) {
          reject(new AuthException(`Failed to send handshake: ${err.message}`));
          return;
        }
        
        this._socket.once('data', (response) => {
          try {
            if (response.length < 20) {
              reject(new AuthException('Response too short'));
              return;
            }
            
            const handshakeResponse = response.slice(8, 72);
            this._security.tcpKey(handshakeResponse, this._key);
            resolve();
          } catch (error) {
            reject(new AuthException(`Authentication failed: ${error.message}`));
          }
        });
      });
    });
  }

  /**
   * Send message to the device
   * @param {Buffer} data - Message data
   */
  sendMessage(data) {
    if (this._protocol === 3) {
      this.sendMessageV3(data, MSGTYPE_ENCRYPTED_REQUEST);
    } else {
      this.sendMessageV2(data);
    }
  }

  /**
   * Send v2 message to the device
   * @param {Buffer} data - Message data
   */
  sendMessageV2(data) {
    if (this._socket && !this._socket.destroyed) {
      this._socket.write(data);
    } else {
      console.debug(`[${this._deviceId}] Send failure, device disconnected, data: ${data.toString('hex')}`);
    }
  }

  /**
   * Send v3 message to the device
   * @param {Buffer} data - Message data
   * @param {number} msgType - Message type
   */
  sendMessageV3(data, msgType = MSGTYPE_ENCRYPTED_REQUEST) {
    const encodedData = this._security.encode8370(data, msgType);
    this.sendMessageV2(encodedData);
  }

  /**
   * Build and send command
   * @param {Object} cmd - Command object
   */
  buildSend(cmd) {
    const data = cmd.serialize();
    console.debug(`[${this._deviceId}] Sending: ${cmd}`);
    const msg = new PacketBuilder(this._deviceId, data).finalize();
    this.sendMessage(msg);
  }

  /**
   * Refresh device status
   * @param {boolean} waitResponse - Whether to wait for response
   * @returns {Promise<void>}
   */
  async refreshStatus(waitResponse = false) {
    let cmds = this.buildQuery();
    
    if (this._applianceQuery) {
      cmds = [new MessageQueryAppliance(this.deviceType), ...cmds];
    }
    
    let errorCount = 0;
    
    for (const cmd of cmds) {
      if (!this._unsupportedProtocol.includes(cmd.constructor.name)) {
        this.buildSend(cmd);
        
        if (waitResponse) {
          try {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                this._unsupportedProtocol.push(cmd.constructor.name);
                console.debug(`[${this._deviceId}] Does not support the protocol ${cmd.constructor.name}, ignored`);
                errorCount++;
                reject(new Error('Timeout waiting for response'));
              }, 5000); // 5 second timeout
              
              const dataHandler = (data) => {
                try {
                  const result = this.parseMessage(data);
                  
                  if (result === ParseMessageResult.SUCCESS) {
                    clearTimeout(timeout);
                    this._socket.removeListener('data', dataHandler);
                    resolve();
                  } else if (result === ParseMessageResult.ERROR) {
                    clearTimeout(timeout);
                    this._socket.removeListener('data', dataHandler);
                    reject(new ResponseException());
                  }
                  // If PADDING, continue waiting
                } catch (error) {
                  clearTimeout(timeout);
                  this._socket.removeListener('data', dataHandler);
                  reject(error);
                }
              };
              
              this._socket.on('data', dataHandler);
            });
          } catch (error) {
            errorCount++;
          }
        }
      } else {
        errorCount++;
      }
    }
    
    if (errorCount === cmds.length) {
      throw new RefreshFailed();
    }
  }

  /**
   * Pre-process message
   * @param {Buffer} msg - Message data
   * @returns {boolean} - Whether to continue processing
   */
  preProcessMessage(msg) {
    if (msg[9] === MessageType.QUERY_APPLIANCE) {
      const message = new MessageApplianceResponse(msg);
      this._applianceQuery = false;
      console.debug(`[${this.deviceId}] Received: ${message}`);
      this._protocolVersion = message.protocolVersion;
      console.debug(`[${this._deviceId}] Device protocol version: ${this._protocolVersion}`);
      return false;
    }
    return true;
  }

  /**
   * Parse message
   * @param {Buffer} msg - Message data
   * @returns {number} - Parse result
   */
  parseMessage(msg) {
    let messages, remainingBuffer;
    
    if (this._protocol === 3) {
      [messages, this._buffer] = this._security.decode8370(Buffer.concat([this._buffer, msg]));
    } else {
      [messages, this._buffer] = MideaDevice.fetchV2Message(Buffer.concat([this._buffer, msg]));
    }
    
    if (messages.length === 0) {
      return ParseMessageResult.PADDING;
    }
    
    for (const message of messages) {
      if (message.equals(Buffer.from('ERROR'))) {
        return ParseMessageResult.ERROR;
      }
      
      const payloadLen = message[4] + (message[5] << 8) - 56;
      const payloadType = message[2] + (message[3] << 8);
      
      if (payloadType === 0x1001 || payloadType === 0x0001) {
        // Heartbeat detected
        continue;
      } else if (message.length > 56) {
        const cryptographic = message.slice(40, -16);
        
        if (payloadLen % 16 === 0) {
          try {
            const decrypted = this._security.aesDecrypt(cryptographic);
            let cont = true;
            
            if (this._applianceQuery) {
              cont = this.preProcessMessage(decrypted);
            }
            
            if (cont) {
              const status = this.processMessage(decrypted);
              
              if (status && Object.keys(status).length > 0) {
                this.updateAll(status);
              } else {
                console.debug(`[${this._deviceId}] Unidentified protocol`);
              }
            }
          } catch (error) {
            console.error(`[${this._deviceId}] Error in process message, msg = ${decrypted.toString('hex')}`);
          }
        } else {
          console.warn(
            `[${this._deviceId}] Illegal payload, ` +
            `original message = ${msg.toString('hex')}, buffer = ${this._buffer.toString('hex')}, ` +
            `8370 decoded = ${message.toString('hex')}, payload type = ${payloadType}, ` +
            `alleged payload length = ${payloadLen}, factual payload length = ${cryptographic.length}`
          );
        }
      } else {
        console.warn(
          `[${this._deviceId}] Illegal message, ` +
          `original message = ${msg.toString('hex')}, buffer = ${this._buffer.toString('hex')}, ` +
          `8370 decoded = ${message.toString('hex')}, payload type = ${payloadType}, ` +
          `alleged payload length = ${payloadLen}, message length = ${message.length}`
        );
      }
    }
    
    return ParseMessageResult.SUCCESS;
  }

  /**
   * Build query commands
   * @returns {Array} - Array of query commands
   */
  buildQuery() {
    throw new Error('Not implemented');
  }

  /**
   * Process message
   * @param {Buffer} msg - Message data
   * @returns {Object} - Processed status
   */
  processMessage(msg) {
    throw new Error('Not implemented');
  }

  /**
   * Send command to the device
   * @param {number} cmdType - Command type
   * @param {Buffer} cmdBody - Command body
   */
  sendCommand(cmdType, cmdBody) {
    try {
      const cmd = new MessageQuestCustom(this._deviceType, this._protocolVersion, cmdType, cmdBody);
      this.buildSend(cmd);
    } catch (error) {
      console.debug(
        `[${this._deviceId}] Interface send_command failure, ${error.message}, ` +
        `cmd_type: ${cmdType}, cmd_body: ${cmdBody.toString('hex')}`
      );
    }
  }

  /**
   * Send heartbeat to the device
   */
  sendHeartbeat() {
    const msg = new PacketBuilder(this._deviceId, Buffer.from([0x00])).finalize(0);
    this.sendMessage(msg);
  }

  /**
   * Register update callback
   * @param {Function} update - Update callback
   */
  registerUpdate(update) {
    this._updates.push(update);
  }

  /**
   * Update all registered callbacks
   * @param {Object} status - Status object
   */
  updateAll(status) {
    console.debug(`[${this._deviceId}] Status update: ${JSON.stringify(status)}`);
    
    for (const update of this._updates) {
      update(status);
    }
  }

  /**
   * Enable or disable the device
   * @param {boolean} available - Whether the device is available
   */
  enableDevice(available = true) {
    this._available = available;
    const status = { available };
    this.updateAll(status);
  }

  /**
   * Open connection to the device
   */
  open() {
    if (!this._isRunning) {
      this._isRunning = true;
      this._run();
    }
  }

  /**
   * Close connection to the device
   */
  close() {
    if (this._isRunning) {
      this._isRunning = false;
      this.closeSocket();
    }
  }

  /**
   * Close socket connection
   */
  closeSocket() {
    this._unsupportedProtocol = [];
    this._buffer = Buffer.alloc(0);
    
    if (this._socket) {
      this._socket.destroy();
      this._socket = null;
    }
  }

  /**
   * Set device IP address
   * @param {string} ipAddress - IP address
   */
  setIpAddress(ipAddress) {
    if (this._ipAddress !== ipAddress) {
      console.debug(`[${this._deviceId}] Update IP address to ${ipAddress}`);
      this._ipAddress = ipAddress;
      this.closeSocket();
    }
  }

  /**
   * Set refresh interval
   * @param {number} refreshInterval - Refresh interval in seconds
   */
  setRefreshInterval(refreshInterval) {
    this._refreshInterval = refreshInterval;
  }

  /**
   * Run device communication loop
   */
  async _run() {
    while (this._isRunning) {
      while (!this._socket) {
        try {
          await this.connect(true);
        } catch (error) {
          if (!this._isRunning) {
            return;
          }
          
          this.closeSocket();
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
        }
      }
      
      let timeoutCounter = 0;
      const start = Date.now();
      let previousRefresh = start;
      let previousHeartbeat = start;
      
      // Set socket timeout to 1 second for more responsive handling
      this._socket.setTimeout(1000);
      
      try {
        // Set up data handler
        this._socket.on('data', (data) => {
          try {
            const msgLen = data.length;
            
            if (msgLen === 0) {
              throw new Error('Connection closed by peer');
            }
            
            const result = this.parseMessage(data);
            
            if (result === ParseMessageResult.ERROR) {
              console.debug(`[${this._deviceId}] Message 'ERROR' received`);
              this.closeSocket();
            } else if (result === ParseMessageResult.SUCCESS) {
              timeoutCounter = 0;
            }
          } catch (error) {
            console.error(`[${this._deviceId}] Error handling data: ${error.message}`);
            this.closeSocket();
          }
        });
        
        // Main communication loop
        while (this._socket && !this._socket.destroyed && this._isRunning) {
          const now = Date.now();
          
          // Refresh status if needed
          if (this._refreshInterval > 0 && now - previousRefresh >= this._refreshInterval * 1000) {
            try {
              await this.refreshStatus();
              previousRefresh = now;
            } catch (error) {
              console.debug(`[${this._deviceId}] Refresh failed: ${error.message}`);
            }
          }
          
          // Send heartbeat if needed
          if (now - previousHeartbeat >= this._heartbeatInterval * 1000) {
            try {
              this.sendHeartbeat();
              previousHeartbeat = now;
            } catch (error) {
              console.debug(`[${this._deviceId}] Heartbeat failed: ${error.message}`);
            }
          }
          
          // Check for timeout
          if (timeoutCounter >= 120) {
            console.debug(`[${this._deviceId}] Heartbeat timed out`);
            this.closeSocket();
            break;
          }
          
          // Wait a bit before next iteration
          await new Promise(resolve => setTimeout(resolve, 1000));
          timeoutCounter++;
        }
      } catch (error) {
        console.error(`[${this._deviceId}] Unknown error: ${error.stack || error.message}`);
        this.closeSocket();
      }
    }
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

module.exports = {
  AuthException,
  ResponseException,
  RefreshFailed,
  MideaDevice
};
