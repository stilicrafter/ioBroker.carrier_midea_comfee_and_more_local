/**
 * Packet builder implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

const { LocalSecurity } = require('./security');
const moment = require('moment');

class PacketBuilder {
  /**
   * Create a new packet builder
   * @param {number} deviceId - Device ID
   * @param {Buffer} command - Command buffer
   */
  constructor(deviceId, command) {
    this.command = null;
    this.security = new LocalSecurity();
    
    // Init the packet with the header data
    this.packet = Buffer.alloc(38);
    
    // 2 bytes - StaticHeader
    this.packet[0] = 0x5a;
    this.packet[1] = 0x5a;
    
    // 2 bytes - MessageType
    this.packet[2] = 0x01;
    this.packet[3] = 0x11;
    
    // 2 bytes - PacketLength
    this.packet[4] = 0x00;
    this.packet[5] = 0x00;
    
    // 2 bytes
    this.packet[6] = 0x20;
    this.packet[7] = 0x00;
    
    // 4 bytes - MessageId
    this.packet[8] = 0x00;
    this.packet[9] = 0x00;
    this.packet[10] = 0x00;
    this.packet[11] = 0x00;
    
    // 8 bytes - Date&Time
    const timeBytes = PacketBuilder.packetTime();
    timeBytes.copy(this.packet, 12);
    
    // 8 bytes - DeviceID
    const deviceIdBuffer = Buffer.alloc(8);
    deviceIdBuffer.writeBigInt64LE(BigInt(deviceId), 0);
    deviceIdBuffer.copy(this.packet, 20);
    
    // 12 bytes - Padding
    for (let i = 28; i < 40; i++) {
      this.packet[i] = 0x00;
    }
    
    this.command = command;
  }

  /**
   * Finalize the packet
   * @param {number} msgType - Message type
   * @returns {Buffer} - Finalized packet
   */
  finalize(msgType = 1) {
    if (msgType !== 1) {
      this.packet[3] = 0x10;
      this.packet[6] = 0x7b;
    } else {
      const encryptedCommand = this.security.aesEncrypt(this.command);
      this.packet = Buffer.concat([this.packet, encryptedCommand]);
    }
    
    // PacketLength
    const length = this.packet.length + 16; // +16 for checksum
    this.packet.writeUInt16LE(length, 4);
    
    // Append checksum data (16 bytes) to the packet
    const checksum = this.encode32(this.packet);
    this.packet = Buffer.concat([this.packet, checksum]);
    
    return this.packet;
  }

  /**
   * Encode data with 32-bit checksum
   * @param {Buffer} data - Data to encode
   * @returns {Buffer} - Encoded data
   */
  encode32(data) {
    return this.security.encode32Data(data);
  }

  /**
   * Calculate checksum
   * @param {Buffer} data - Data to calculate checksum for
   * @returns {number} - Calculated checksum
   */
  static checksum(data) {
    const sum = data.reduce((acc, byte) => acc + byte, 0);
    return (~sum + 1) & 0xff;
  }

  /**
   * Generate packet time bytes
   * @returns {Buffer} - Time bytes
   */
  static packetTime() {
    const timeStr = moment().format('YYYYMMDDHHmmssSSS').substring(0, 16);
    const buffer = Buffer.alloc(8);
    
    for (let i = 0; i < timeStr.length; i += 2) {
      if (i + 1 < timeStr.length) {
        const byteValue = parseInt(timeStr.substring(i, i + 2), 10);
        // Reverse order as in Python implementation
        buffer[7 - (i / 2)] = byteValue;
      }
    }
    
    return buffer;
  }
}

module.exports = PacketBuilder;
