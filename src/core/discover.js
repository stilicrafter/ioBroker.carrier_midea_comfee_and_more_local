/**
 * Device discovery implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

const dgram = require('dgram');
const { EventEmitter } = require('events');
const crypto = require('crypto');

class DeviceDiscover extends EventEmitter {
  /**
   * Create a new device discovery instance
   * @param {string} address - Network address to discover devices on
   * @param {number} timeout - Discovery timeout in seconds
   */
  constructor(address = '255.255.255.255', timeout = 5) {
    super();
    this.address = address;
    this.timeout = timeout;
    this.devices = {};
    this.socket = null;
  }

  /**
   * Start device discovery
   * @returns {Promise<Object>} - Discovered devices
   */
  async discover() {
    return new Promise((resolve, reject) => {
      this.devices = {};
      this.socket = dgram.createSocket('udp4');

      // Handle incoming messages
      this.socket.on('message', (msg, rinfo) => {
        try {
          this._handleResponse(msg, rinfo);
        } catch (error) {
          console.error('Error handling discovery response:', error);
        }
      });

      // Handle errors
      this.socket.on('error', (err) => {
        console.error('Discovery socket error:', err);
        this.socket.close();
        reject(err);
      });

      // Bind socket and send discovery message
      this.socket.bind(() => {
        this.socket.setBroadcast(true);
        
        // Send discovery message
        const message = Buffer.from([
          0x5a, 0x5a, 0x01, 0x11, 0x48, 0x00, 0x92, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x7f, 0x75, 0xbd, 0x6b, 0x3e, 0x4f, 0x8b, 0x76,
          0x2e, 0x84, 0x9c, 0x6e, 0x57, 0x8d, 0x65, 0x90,
          0x03, 0x6e, 0x9d, 0x43, 0x42, 0xa5, 0x0f, 0x1f
        ]);

        this.socket.send(message, 0, message.length, 6445, this.address);

        // Set timeout to close socket
        setTimeout(() => {
          this.socket.close();
          resolve(this.devices);
        }, this.timeout * 1000);
      });
    });
  }

  /**
   * Handle discovery response
   * @param {Buffer} msg - Response message
   * @param {Object} rinfo - Remote info
   */
  _handleResponse(msg, rinfo) {
    if (msg.length >= 104 && msg[0] === 0x5a && msg[1] === 0x5a) {
      const deviceId = msg.readBigUInt64LE(20).toString();
      const deviceType = msg[38];
      
      // Extract serial number from message
      let sn = '';
      for (let i = 0; i < 32; i++) {
        if (msg[40 + i] === 0) break;
        sn += String.fromCharCode(msg[40 + i]);
      }
      
      // Extract SSID from message
      let ssid = '';
      for (let i = 0; i < 32; i++) {
        if (msg[72 + i] === 0) break;
        ssid += String.fromCharCode(msg[72 + i]);
      }

      const device = {
        id: deviceId,
        name: ssid,
        model: sn,
        address: rinfo.address,
        port: 6444,
        type: deviceType,
        version: 3,
        sn: sn
      };

      this.devices[deviceId] = device;
      this.emit('device', device);
    }
  }

  /**
   * Generate device ID from username
   * @param {string} username - Username
   * @returns {string} - Device ID
   */
  static getDeviceId(username) {
    const hash = crypto.createHash('sha256');
    hash.update(`Hello, ${username}!`);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Generate UDP ID from appliance ID
   * @param {number} applianceId - Appliance ID
   * @param {number} method - Method (0, 1, or 2)
   * @returns {string|null} - UDP ID
   */
  static getUdpId(applianceId, method = 0) {
    let bytesId;
    
    if (method === 0) {
      bytesId = Buffer.alloc(8);
      bytesId.writeBigUInt64BE(BigInt(applianceId));
      // Reverse the bytes
      bytesId = Buffer.from([...bytesId].reverse());
    } else if (method === 1) {
      bytesId = Buffer.alloc(6);
      // Write the 6 bytes big-endian
      const bigIntValue = BigInt(applianceId);
      for (let i = 5; i >= 0; i--) {
        bytesId[i] = Number(bigIntValue >> BigInt((5 - i) * 8) & BigInt(0xff));
      }
    } else if (method === 2) {
      bytesId = Buffer.alloc(6);
      // Write the 6 bytes little-endian
      const bigIntValue = BigInt(applianceId);
      for (let i = 0; i < 6; i++) {
        bytesId[i] = Number(bigIntValue >> BigInt(i * 8) & BigInt(0xff));
      }
    } else {
      return null;
    }
    
    const hash = crypto.createHash('sha256');
    hash.update(bytesId);
    const data = hash.digest();
    
    // XOR first 16 bytes with next 16 bytes
    const result = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      result[i] = data[i] ^ data[i + 16];
    }
    
    return result.toString('hex');
  }
}

module.exports = DeviceDiscover;
