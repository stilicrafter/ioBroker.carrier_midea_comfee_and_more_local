/**
 * Fan device implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

const { MideaDevice } = require('../core/device');
const { MessageType } = require('../core/constants');

// Fan operational modes
const OperationalMode = {
  NORMAL: 1,
  NATURAL: 2,
  SLEEP: 3
};

// Fan speeds
const FanSpeed = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  AUTO: 4
};

// Oscillation modes
const OscillationMode = {
  OFF: 0,
  VERTICAL: 1,
  HORIZONTAL: 2,
  BOTH: 3
};

/**
 * Midea Fan device class
 */
class Fan extends MideaDevice {
  /**
   * Create a new fan device
   * @param {Object} params - Device parameters
   */
  constructor(params) {
    super(
      params.name,
      params.deviceId,
      0xFA, // Device type for fan
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
        mode: OperationalMode.NORMAL,
        fan_speed: FanSpeed.MEDIUM,
        oscillation: OscillationMode.OFF,
        timer_hours: 0,
        child_lock: false
      };
    }
  }

  /**
   * Build query commands
   * @returns {Array} - Array of query commands
   */
  buildQuery() {
    // In a real implementation, this would build specific query commands for fan
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
    // In a real implementation, this would parse the specific fan protocol
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
        const mode = msg[0x02 + 10] & 0x3;
        if (mode >= 1 && mode <= 3) {
          status.mode = mode;
        }
      }
      
      // Fan speed (byte 0x03)
      if (msg.length > 0x03 + 10) {
        const fanSpeed = msg[0x03 + 10] & 0x7;
        if (fanSpeed >= 1 && fanSpeed <= 4) {
          status.fan_speed = fanSpeed;
        }
      }
      
      // Oscillation (byte 0x04)
      if (msg.length > 0x04 + 10) {
        const oscillation = msg[0x04 + 10] & 0x3;
        status.oscillation = oscillation;
      }
      
      // Timer hours (byte 0x05)
      if (msg.length > 0x05 + 10) {
        status.timer_hours = msg[0x05 + 10];
      }
      
      // Child lock (byte 0x06)
      if (msg.length > 0x06 + 10) {
        status.child_lock = (msg[0x06 + 10] & 0x1) !== 0;
      }
      
      return status;
    } catch (error) {
      console.error(`[${this._deviceId}] Error processing fan message: ${error.message}`);
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
    // In a real implementation, this would build the specific fan command packet
    
    const cmdBody = Buffer.alloc(10, 0);
    
    // Set power state
    cmdBody[0x01] = this._attributes.power ? 0x01 : 0x00;
    
    // Set mode
    cmdBody[0x02] = this._attributes.mode & 0x3;
    
    // Set fan speed
    cmdBody[0x03] = this._attributes.fan_speed & 0x7;
    
    // Set oscillation
    cmdBody[0x04] = this._attributes.oscillation & 0x3;
    
    // Set timer hours
    cmdBody[0x05] = this._attributes.timer_hours & 0xFF;
    
    // Set child lock
    cmdBody[0x06] = this._attributes.child_lock ? 0x01 : 0x00;
    
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
   * Set operational mode
   * @param {number} mode - Operational mode
   */
  setMode(mode) {
    if (mode >= 1 && mode <= 3) {
      this.setAttribute('mode', mode);
    }
  }

  /**
   * Set fan speed
   * @param {number} speed - Fan speed
   */
  setFanSpeed(speed) {
    if (speed >= 1 && speed <= 4) {
      this.setAttribute('fan_speed', speed);
    }
  }

  /**
   * Set oscillation mode
   * @param {number} mode - Oscillation mode
   */
  setOscillation(mode) {
    if (mode >= 0 && mode <= 3) {
      this.setAttribute('oscillation', mode);
    }
  }

  /**
   * Set timer hours
   * @param {number} hours - Timer hours (0-24)
   */
  setTimer(hours) {
    const validHours = Math.max(0, Math.min(24, hours));
    this.setAttribute('timer_hours', validHours);
  }

  /**
   * Set child lock
   * @param {boolean} enabled - Whether child lock is enabled
   */
  setChildLock(enabled) {
    this.setAttribute('child_lock', enabled);
  }
}

module.exports = {
  Fan,
  OperationalMode,
  FanSpeed,
  OscillationMode
};
