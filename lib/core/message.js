/**
 * Message implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

const { MessageType } = require('./constants');
const CRC8 = require('./crc8');

class MessageLenError extends Error {
  constructor(message) {
    super(message || 'Message length error');
    this.name = 'MessageLenError';
  }
}

class MessageBodyError extends Error {
  constructor(message) {
    super(message || 'Message body error');
    this.name = 'MessageBodyError';
  }
}

class MessageCheckSumError extends Error {
  constructor(message) {
    super(message || 'Message checksum error');
    this.name = 'MessageCheckSumError';
  }
}

/**
 * Base class for all message types
 */
class MessageBase {
  static HEADER_LENGTH = 10;

  constructor() {
    this._deviceType = 0x00;
    this._messageType = 0x00;
    this._bodyType = 0x00;
    this._protocolVersion = 0x00;
  }

  /**
   * Calculate checksum for data
   * @param {Buffer} data - Data to calculate checksum for
   * @returns {number} - Calculated checksum
   */
  static checksum(data) {
    return CRC8.calculate(data);
  }

  /**
   * Get message header
   * @returns {Buffer} - Message header
   */
  get header() {
    throw new Error('Not implemented');
  }

  /**
   * Get message body
   * @returns {Buffer} - Message body
   */
  get body() {
    throw new Error('Not implemented');
  }

  /**
   * Get message type
   * @returns {number} - Message type
   */
  get messageType() {
    return this._messageType;
  }

  /**
   * Set message type
   * @param {number} value - Message type
   */
  set messageType(value) {
    this._messageType = value;
  }

  /**
   * Get device type
   * @returns {number} - Device type
   */
  get deviceType() {
    return this._deviceType;
  }

  /**
   * Set device type
   * @param {number} value - Device type
   */
  set deviceType(value) {
    this._deviceType = value;
  }

  /**
   * Get body type
   * @returns {number} - Body type
   */
  get bodyType() {
    return this._bodyType;
  }

  /**
   * Set body type
   * @param {number} value - Body type
   */
  set bodyType(value) {
    this._bodyType = value;
  }

  /**
   * Get protocol version
   * @returns {number} - Protocol version
   */
  get protocolVersion() {
    return this._protocolVersion;
  }

  /**
   * Set protocol version
   * @param {number} value - Protocol version
   */
  set protocolVersion(value) {
    this._protocolVersion = value;
  }

  /**
   * String representation of the message
   * @returns {string} - String representation
   */
  toString() {
    const output = {
      header: this.header.toString('hex'),
      body: this.body.toString('hex'),
      messageType: `0x${this._messageType.toString(16).padStart(2, '0')}`,
      bodyType: this._bodyType !== null ? `0x${this._bodyType.toString(16).padStart(2, '0')}` : 'null'
    };
    return JSON.stringify(output);
  }
}

/**
 * Base class for request messages
 */
class MessageRequest extends MessageBase {
  /**
   * Create a new request message
   * @param {number} deviceType - Device type
   * @param {number} protocolVersion - Protocol version
   * @param {number} messageType - Message type
   * @param {number} bodyType - Body type
   */
  constructor(deviceType, protocolVersion, messageType, bodyType) {
    super();
    this.deviceType = deviceType;
    this.protocolVersion = protocolVersion;
    this.messageType = messageType;
    this.bodyType = bodyType;
  }

  /**
   * Get message header
   * @returns {Buffer} - Message header
   */
  get header() {
    const length = MessageBase.HEADER_LENGTH + this.body.length;
    const header = Buffer.alloc(MessageBase.HEADER_LENGTH);
    
    // flag
    header[0] = 0xAA;
    // length
    header[1] = length;
    // device type
    header[2] = this.deviceType;
    // frame checksum
    header[3] = 0x00; // this.deviceType ^ length in Python, but seems unused
    // unused
    header[4] = 0x00;
    header[5] = 0x00;
    // frame ID
    header[6] = 0x00;
    // frame protocol version
    header[7] = 0x00;
    // device protocol version
    header[8] = this.protocolVersion;
    // frame type
    header[9] = this.messageType;
    
    return header;
  }

  /**
   * Get internal body content
   * @returns {Buffer} - Body content
   */
  get _body() {
    throw new Error('Not implemented');
  }

  /**
   * Get message body
   * @returns {Buffer} - Message body
   */
  get body() {
    let body = Buffer.alloc(0);
    
    if (this.bodyType !== null) {
      const bodyTypeBuffer = Buffer.alloc(1);
      bodyTypeBuffer[0] = this.bodyType;
      body = Buffer.concat([body, bodyTypeBuffer]);
    }
    
    if (this._body !== null) {
      body = Buffer.concat([body, this._body]);
    }
    
    return body;
  }

  /**
   * Serialize the message
   * @returns {Buffer} - Serialized message
   */
  serialize() {
    const stream = Buffer.concat([this.header, this.body]);
    const checksum = MessageBase.checksum(stream.slice(1));
    
    const result = Buffer.concat([stream, Buffer.from([checksum])]);
    return result;
  }
}

/**
 * Custom request message
 */
class MessageQuestCustom extends MessageRequest {
  /**
   * Create a new custom request message
   * @param {number} deviceType - Device type
   * @param {number} protocolVersion - Protocol version
   * @param {number} cmdType - Command type
   * @param {Buffer} cmdBody - Command body
   */
  constructor(deviceType, protocolVersion, cmdType, cmdBody) {
    super(deviceType, protocolVersion, cmdType, null);
    this._cmdBody = cmdBody;
  }

  /**
   * Get internal body content
   * @returns {Buffer} - Body content
   */
  get _body() {
    return Buffer.alloc(0);
  }

  /**
   * Get message body
   * @returns {Buffer} - Message body
   */
  get body() {
    return this._cmdBody;
  }
}

/**
 * Query appliance message
 */
class MessageQueryAppliance extends MessageRequest {
  /**
   * Create a new query appliance message
   * @param {number} deviceType - Device type
   */
  constructor(deviceType) {
    super(deviceType, 0, MessageType.QUERY_APPLIANCE, null);
  }

  /**
   * Get internal body content
   * @returns {Buffer} - Body content
   */
  get _body() {
    return Buffer.alloc(0);
  }

  /**
   * Get message body
   * @returns {Buffer} - Message body
   */
  get body() {
    return Buffer.alloc(19, 0);
  }
}

/**
 * Message body wrapper
 */
class MessageBody {
  /**
   * Create a new message body
   * @param {Buffer} body - Message body
   */
  constructor(body) {
    this._data = body;
  }

  /**
   * Get body data
   * @returns {Buffer} - Body data
   */
  get data() {
    return this._data;
  }

  /**
   * Get body type
   * @returns {number} - Body type
   */
  get bodyType() {
    return this._data[0];
  }

  /**
   * Read a byte from the body
   * @param {Buffer} body - Body to read from
   * @param {number} byte - Byte index
   * @param {number} defaultValue - Default value if byte doesn't exist
   * @returns {number} - Byte value
   */
  static readByte(body, byte, defaultValue = 0) {
    return body.length > byte ? body[byte] : defaultValue;
  }
}

/**
 * New protocol message body
 */
class NewProtocolMessageBody extends MessageBody {
  /**
   * Create a new protocol message body
   * @param {Buffer} body - Message body
   * @param {number} bt - Body type
   */
  constructor(body, bt) {
    super(body);
    this._packLen = bt === 0xb5 ? 4 : 5;
  }

  /**
   * Pack parameters into a buffer
   * @param {number} param - Parameter
   * @param {Buffer} value - Value
   * @param {number} packLen - Pack length
   * @returns {Buffer} - Packed buffer
   */
  static pack(param, value, packLen = 4) {
    const length = value.length;
    let stream;
    
    if (packLen === 4) {
      stream = Buffer.alloc(3 + length);
      stream[0] = param & 0xFF;
      stream[1] = param >> 8;
      stream[2] = length;
      value.copy(stream, 3);
    } else {
      stream = Buffer.alloc(4 + length);
      stream[0] = param & 0xFF;
      stream[1] = param >> 8;
      stream[2] = 0x00;
      stream[3] = length;
      value.copy(stream, 4);
    }
    
    return stream;
  }

  /**
   * Parse the message body
   * @returns {Object} - Parsed parameters
   */
  parse() {
    const result = {};
    
    try {
      let pos = 2;
      for (let pack = 0; pack < this.data[1]; pack++) {
        const param = this.data[pos] + (this.data[pos + 1] << 8);
        
        if (this._packLen === 5) {
          pos += 1;
        }
        
        const length = this.data[pos + 2];
        
        if (length > 0) {
          const value = this.data.slice(pos + 3, pos + 3 + length);
          result[param] = value;
        }
        
        pos += (3 + length);
      }
    } catch (error) {
      // Some device used non-standard new-protocol
      console.debug(`Non-standard new-protocol ${this.data.toString('hex')}`);
    }
    
    return result;
  }
}

/**
 * Response message
 */
class MessageResponse extends MessageBase {
  /**
   * Create a new response message
   * @param {Buffer} message - Message buffer
   */
  constructor(message) {
    super();
    
    if (!message || message.length < this.constructor.HEADER_LENGTH + 1) {
      throw new MessageLenError();
    }
    
    this._header = message.slice(0, this.constructor.HEADER_LENGTH);
    this.protocolVersion = this._header[8];
    this.messageType = this._header[9];
    this.deviceType = this._header[2];
    
    const body = message.slice(this.constructor.HEADER_LENGTH, -1);
    this._body = new MessageBody(body);
    this.bodyType = this._body.bodyType;
  }

  /**
   * Get message header
   * @returns {Buffer} - Message header
   */
  get header() {
    return this._header;
  }

  /**
   * Get message body
   * @returns {Buffer} - Message body
   */
  get body() {
    return this._body.data;
  }

  /**
   * Set message body
   * @param {MessageBody} body - Message body
   */
  setBody(body) {
    this._body = body;
  }

  /**
   * Set attributes from body
   */
  setAttr() {
    for (const key in this._body) {
      if (key !== 'data' && this._body.hasOwnProperty(key)) {
        const value = this._body[key];
        if (value !== undefined) {
          this[key] = value;
        }
      }
    }
  }
}

/**
 * Appliance response message
 */
class MessageApplianceResponse extends MessageResponse {
  /**
   * Create a new appliance response message
   * @param {Buffer} message - Message buffer
   */
  constructor(message) {
    super(message);
  }
}

module.exports = {
  MessageLenError,
  MessageBodyError,
  MessageCheckSumError,
  MessageBase,
  MessageRequest,
  MessageQuestCustom,
  MessageQueryAppliance,
  MessageBody,
  NewProtocolMessageBody,
  MessageResponse,
  MessageApplianceResponse
};
