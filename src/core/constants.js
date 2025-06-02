/**
 * Constants for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

// Message types for security protocol
const MSGTYPE_HANDSHAKE_REQUEST = 0x0;
const MSGTYPE_HANDSHAKE_RESPONSE = 0x1;
const MSGTYPE_ENCRYPTED_RESPONSE = 0x3;
const MSGTYPE_ENCRYPTED_REQUEST = 0x6;

// Message types for device communication
const MessageType = {
  SET: 0x02,
  QUERY: 0x03,
  NOTIFY1: 0x04,
  NOTIFY2: 0x05,
  EXCEPTION: 0x06,
  EXCEPTION2: 0x0A,
  QUERY_APPLIANCE: 0xA0
};

// Parse message result codes
const ParseMessageResult = {
  SUCCESS: 0,
  PADDING: 1,
  ERROR: 99
};

module.exports = {
  MSGTYPE_HANDSHAKE_REQUEST,
  MSGTYPE_HANDSHAKE_RESPONSE,
  MSGTYPE_ENCRYPTED_RESPONSE,
  MSGTYPE_ENCRYPTED_REQUEST,
  MessageType,
  ParseMessageResult
};
