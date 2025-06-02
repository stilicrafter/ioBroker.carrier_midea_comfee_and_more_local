/**
 * Air conditioner device implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

const { MideaDevice } = require('../core/device');
const { MessageType } = require('../core/constants');

// Air conditioner operational modes
const OperationalMode = {
  AUTO: 1,
  COOL: 2,
  DRY: 3,
  HEAT: 4,
  FAN_ONLY: 5
};

// Fan speeds
const FanSpeed = {
  AUTO: 102,
  SILENT: 20,
  LOW: 40,
  MEDIUM: 60,
  HIGH: 80,
  FULL: 100
};

// Swing modes
const SwingMode = {
  OFF: 0x0,
  VERTICAL: 0xC,
  HORIZONTAL: 0x3,
  BOTH: 0xF
};

/**
 * Midea Air Conditioner device class
 */
class AirConditioner extends MideaDevice {
  /**
   * Create a new air conditioner device
   * @param {Object} params - Device parameters
   */
  constructor(params) {
    super(
      params.name,
      params.deviceId,
      0xAC, // Device type for air conditioner
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
        mode: OperationalMode.AUTO,
        target_temperature: 24,
        fan_speed: FanSpeed.AUTO,
        swing_mode: SwingMode.OFF,
        eco_mode: false,
        turbo_mode: false,
        indoor_temperature: 0,
        outdoor_temperature: 0
      };
    }
  }

  /**
   * Build query commands
   * @returns {Array} - Array of query commands
   */
  buildQuery() {
    // In a real implementation, this would build specific query commands for AC
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
    // In a real implementation, this would parse the specific AC protocol
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
        if (mode >= 1 && mode <= 5) {
          status.mode = mode;
        }
      }
      
      // Target temperature (byte 0x05)
      if (msg.length > 0x05 + 10) {
        const targetTemp = msg[0x05 + 10] & 0xF;
        status.target_temperature = targetTemp + 16;
      }
      
      // Indoor temperature (byte 0x15)
      if (msg.length > 0x15 + 10) {
        const indoorTemp = msg[0x15 + 10] - 50;
        if (indoorTemp >= -20 && indoorTemp <= 50) {
          status.indoor_temperature = indoorTemp;
        }
      }
      
      // Fan speed (byte 0x03)
      if (msg.length > 0x03 + 10) {
        const fanSpeed = msg[0x03 + 10];
        status.fan_speed = fanSpeed;
      }
      
      // Swing mode (byte 0x04)
      if (msg.length > 0x04 + 10) {
        const swingMode = msg[0x04 + 10];
        status.swing_mode = swingMode;
      }
      
      // Eco mode (byte 0x07)
      if (msg.length > 0x07 + 10) {
        status.eco_mode = (msg[0x07 + 10] & 0x10) !== 0;
      }
      
      // Turbo mode (byte 0x07)
      if (msg.length > 0x07 + 10) {
        status.turbo_mode = (msg[0x07 + 10] & 0x20) !== 0;
      }
      
      return status;
    } catch (error) {
      console.error(`[${this._deviceId}] Error processing AC message: ${error.message}`);
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
    // In a real implementation, this would build the specific AC command packet
    
    const cmdBody = Buffer.alloc(23, 0);
    
    // Set power state
    cmdBody[0x01] = this._attributes.power ? 0x01 : 0x00;
    
    // Set mode
    cmdBody[0x02] = this._attributes.mode & 0x7;
    
    // Set fan speed
    cmdBody[0x03] = this._attributes.fan_speed;
    
    // Set swing mode
    cmdBody[0x04] = this._attributes.swing_mode;
    
    // Set target temperature
    cmdBody[0x05] = (this._attributes.target_temperature - 16) & 0xF;
    
    // Set eco and turbo modes
    cmdBody[0x07] = (this._attributes.eco_mode ? 0x10 : 0x00) | 
                    (this._attributes.turbo_mode ? 0x20 : 0x00);
    
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
    // Ensure temperature is within valid range (16-30°C)
    const validTemp = Math.max(16, Math.min(30, temperature));
    this.setAttribute('target_temperature', validTemp);
  }

  /**
   * Set operational mode
   * @param {number} mode - Operational mode
   */
  setMode(mode) {
    if (mode >= 1 && mode <= 5) {
      this.setAttribute('mode', mode);
    }
  }

  /**
   * Set fan speed
   * @param {number} speed - Fan speed
   */
  setFanSpeed(speed) {
    this.setAttribute('fan_speed', speed);
  }

  /**
   * Set swing mode
   * @param {number} mode - Swing mode
   */
  setSwingMode(mode) {
    this.setAttribute('swing_mode', mode);
  }

  /**
   * Set eco mode
   * @param {boolean} enabled - Whether eco mode is enabled
   */
  setEcoMode(enabled) {
    this.setAttribute('eco_mode', enabled);
  }

  /**
   * Set turbo mode
   * @param {boolean} enabled - Whether turbo mode is enabled
   */
  setTurboMode(enabled) {
    this.setAttribute('turbo_mode', enabled);
  }
}

module.exports = {
  AirConditioner,
  OperationalMode,
  FanSpeed,
  SwingMode
};
