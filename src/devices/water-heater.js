/**
 * Water heater device implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

const { MideaDevice } = require('../core/device');
const { MessageType } = require('../core/constants');

// Water heater operational modes
const OperationalMode = {
  STANDARD: 1,
  ECO: 2,
  POWERFUL: 3,
  VACATION: 4
};

/**
 * Midea Water Heater device class
 */
class WaterHeater extends MideaDevice {
  /**
   * Create a new water heater device
   * @param {Object} params - Device parameters
   */
  constructor(params) {
    super(
      params.name,
      params.deviceId,
      0xE2, // Device type for electric water heater
      params.ipAddress,
      params.port || 6444,
      params.token,
      params.key,
      params.protocol || 3,
      params.model || '',
      params.subtype || 0,
      params.attributes || {}
    );
    
    // Initialize default attributes if not provided
    if (!this._attributes.power) {
      this._attributes = {
        ...this._attributes,
        power: false,
        mode: OperationalMode.STANDARD,
        target_temperature: 40,
        current_temperature: 0,
        heating_status: false,
        vacation_days: 0
      };
    }
  }

  /**
   * Build query commands
   * @returns {Array} - Array of query commands
   */
  buildQuery() {
    // In a real implementation, this would build specific query commands for water heater
    // For now, we'll return an empty array as a placeholder
    return [];
  }

  /**
   * Process message from device
   * @param {Buffer} msg - Message data
   * @returns {Object} - Processed status
   */
  processMessage(msg) {
    // This is a simplified implementation
    // In a real implementation, this would parse the specific water heater protocol
    if (msg.length < 10 || msg[9] !== MessageType.NOTIFY1) {
      return {};
    }

    try {
      // Extract basic status information (simplified)
      const status = {};
      
      // Power status (byte 0x01)
      if (msg.length > 0x01 + 10) {
        status.power = (msg[0x01 + 10] & 0x1) !== 0;
      }
      
      // Mode (byte 0x02)
      if (msg.length > 0x02 + 10) {
        const mode = msg[0x02 + 10] & 0x7;
        if (mode >= 1 && mode <= 4) {
          status.mode = mode;
        }
      }
      
      // Target temperature (byte 0x04)
      if (msg.length > 0x04 + 10) {
        const targetTemp = msg[0x04 + 10];
        if (targetTemp >= 30 && targetTemp <= 75) {
          status.target_temperature = targetTemp;
        }
      }
      
      // Current temperature (byte 0x05)
      if (msg.length > 0x05 + 10) {
        const currentTemp = msg[0x05 + 10];
        if (currentTemp <= 100) {
          status.current_temperature = currentTemp;
        }
      }
      
      // Heating status (byte 0x06)
      if (msg.length > 0x06 + 10) {
        status.heating_status = (msg[0x06 + 10] & 0x1) !== 0;
      }
      
      // Vacation days (byte 0x07)
      if (msg.length > 0x07 + 10) {
        status.vacation_days = msg[0x07 + 10];
      }
      
      return status;
    } catch (error) {
      console.error(`[${this._deviceId}] Error processing water heater message: ${error.message}`);
      return {};
    }
  }

  /**
   * Set device attribute
   * @param {string} attr - Attribute name
   * @param {any} value - Attribute value
   */
  setAttribute(attr, value) {
    if (this._attributes[attr] !== value) {
      this._attributes[attr] = value;
      this._sendCommand();
    }
  }

  /**
   * Send command to update device state
   */
  _sendCommand() {
    // This is a simplified implementation
    // In a real implementation, this would build the specific water heater command packet
    
    const cmdBody = Buffer.alloc(10, 0);
    
    // Set power state
    cmdBody[0x01] = this._attributes.power ? 0x01 : 0x00;
    
    // Set mode
    cmdBody[0x02] = this._attributes.mode & 0x7;
    
    // Set target temperature
    cmdBody[0x04] = this._attributes.target_temperature;
    
    // Set vacation days (if in vacation mode)
    if (this._attributes.mode === OperationalMode.VACATION) {
      cmdBody[0x07] = this._attributes.vacation_days;
    }
    
    // Send the command
    this.sendCommand(MessageType.SET, cmdBody);
  }

  /**
   * Set power state
   * @param {boolean} power - Power state
   */
  setPower(power) {
    this.setAttribute('power', power);
  }

  /**
   * Set target temperature
   * @param {number} temperature - Target temperature
   */
  setTargetTemperature(temperature) {
    // Ensure temperature is within valid range (30-75°C)
    const validTemp = Math.max(30, Math.min(75, temperature));
    this.setAttribute('target_temperature', validTemp);
  }

  /**
   * Set operational mode
   * @param {number} mode - Operational mode
   */
  setMode(mode) {
    if (mode >= 1 && mode <= 4) {
      this.setAttribute('mode', mode);
    }
  }

  /**
   * Set vacation mode with days
   * @param {number} days - Vacation days
   */
  setVacationMode(days) {
    const validDays = Math.max(1, Math.min(99, days));
    this._attributes.vacation_days = validDays;
    this.setMode(OperationalMode.VACATION);
  }
}

module.exports = {
  WaterHeater,
  OperationalMode
};
