/**
 * CRC8 implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

class CRC8 {
  /**
   * Calculate CRC8 checksum
   * @param {Buffer|Array} data - Data to calculate checksum for
   * @returns {number} - Calculated checksum
   */
  static calculate(data) {
    return (~data.reduce((sum, byte) => sum + byte, 0) + 1) & 0xff;
  }
}

module.exports = CRC8;
