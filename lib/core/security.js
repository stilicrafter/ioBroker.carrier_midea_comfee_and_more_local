/**
 * Security implementation for Midea AC LAN protocol
 * Ported from Python implementation in midea_ac_lan
 */

const crypto = require('crypto');
const { Buffer } = require('buffer');
const {
  MSGTYPE_HANDSHAKE_REQUEST,
  MSGTYPE_HANDSHAKE_RESPONSE,
  MSGTYPE_ENCRYPTED_RESPONSE,
  MSGTYPE_ENCRYPTED_REQUEST
} = require('./constants');

// Helper function for XORing buffers
function bufferXOR(a, b) {
  const length = Math.max(a.length, b.length);
  const buffer = Buffer.alloc(length);
  for (let i = 0; i < length; ++i) {
    buffer[i] = a[i] ^ b[i];
  }
  return buffer;
}

// Helper function for PKCS7 padding
function pkcs7Pad(buffer, blockSize) {
  const padding = blockSize - (buffer.length % blockSize);
  const padBuffer = Buffer.alloc(padding, padding);
  return Buffer.concat([buffer, padBuffer]);
}

// Helper function for PKCS7 unpadding
function pkcs7Unpad(buffer) {
  const padding = buffer[buffer.length - 1];
  if (padding < 1 || padding > buffer.length) {
      // Invalid padding
      console.warn("Invalid PKCS7 padding detected");
      return buffer; // Return as is or throw error?
  }
  for (let i = buffer.length - padding; i < buffer.length; i++) {
      if (buffer[i] !== padding) {
          // Invalid padding byte
          console.warn("Invalid PKCS7 padding byte detected");
          return buffer; // Return as is or throw error?
      }
  }
  return buffer.slice(0, buffer.length - padding);
}

class LocalSecurity {
  constructor() {
    this.blockSize = 16;
    this.iv = Buffer.alloc(16, 0);
    // Convert the large integer hex string to a Buffer
    this.aesKey = Buffer.from('c575115f1d7c435198876a6434117a86', 'hex'); // 141661095494369103254425781617665632877 in hex
    this.salt = Buffer.from('a324ac3e198a105276bcec8a4ec9a758909741e114067d708b4916560c559e51', 'hex'); // 233912452794221312800602098970898185176935770387238278451789080441632479840061417076563 in hex
    this._tcpKey = null;
    this._requestCount = 0;
    this._responseCount = 0;
  }

  aesDecrypt(raw) {
    try {
      const decipher = crypto.createDecipheriv('aes-128-ecb', this.aesKey, null);
      decipher.setAutoPadding(false); // We handle padding manually
      let decrypted = Buffer.concat([decipher.update(raw), decipher.final()]);
      return pkcs7Unpad(decrypted);
    } catch (e) {
      console.error('AES ECB Decryption error:', e);
      return Buffer.alloc(0);
    }
  }

  aesEncrypt(raw) {
    const cipher = crypto.createCipheriv('aes-128-ecb', this.aesKey, null);
    cipher.setAutoPadding(false); // We handle padding manually
    const padded = pkcs7Pad(raw, this.blockSize);
    return Buffer.concat([cipher.update(padded), cipher.final()]);
  }

  aesCbcDecrypt(raw, key) {
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, this.iv);
    decipher.setAutoPadding(false); // Python version doesn't seem to use standard padding here
    return Buffer.concat([decipher.update(raw), decipher.final()]);
  }

  aesCbcEncrypt(raw, key) {
    const cipher = crypto.createCipheriv('aes-128-cbc', key, this.iv);
    cipher.setAutoPadding(false); // Python version doesn't seem to use standard padding here
    return Buffer.concat([cipher.update(raw), cipher.final()]);
  }

  encode32Data(raw) {
    const md5 = crypto.createHash('md5');
    md5.update(Buffer.concat([raw, this.salt]));
    return md5.digest();
  }

  tcpKey(response, key) {
    if (response.equals(Buffer.from('ERROR'))) {
      throw new Error('Authentication failed: Received ERROR');
    }
    if (response.length !== 64) {
      throw new Error(`Unexpected data length for tcpKey: ${response.length}`);
    }
    const payload = response.slice(0, 32);
    const sign = response.slice(32);

    const plain = this.aesCbcDecrypt(payload, key);

    const sha256 = crypto.createHash('sha256');
    sha256.update(plain);
    const calculatedSign = sha256.digest();

    if (!calculatedSign.equals(sign)) {
      throw new Error('Sign does not match in tcpKey');
    }

    this._tcpKey = bufferXOR(plain, key);
    this._requestCount = 0;
    this._responseCount = 0;
    return this._tcpKey;
  }

  encode8370(data, msgType) {
    const header = Buffer.alloc(6);
    header[0] = 0x83;
    header[1] = 0x70;

    let size = data.length;
    let padding = 0;

    if (msgType === MSGTYPE_ENCRYPTED_RESPONSE || msgType === MSGTYPE_ENCRYPTED_REQUEST) {
      if ((size + 2) % 16 !== 0) {
        padding = 16 - ((size + 2) % 16);
      }
      const randomPadding = crypto.randomBytes(padding);
      data = Buffer.concat([data, randomPadding]);
      size = data.length + 32; // Add 32 for the SHA256 signature
    }

    header.writeUInt16BE(size, 2);
    header[4] = 0x20;
    header[5] = (padding << 4) | msgType;

    const requestCountBytes = Buffer.alloc(2);
    requestCountBytes.writeUInt16BE(this._requestCount, 0);
    let dataToEncrypt = Buffer.concat([requestCountBytes, data]);

    this._requestCount += 1;
    if (this._requestCount >= 0xFFFF) {
      this._requestCount = 0;
    }

    if (msgType === MSGTYPE_ENCRYPTED_RESPONSE || msgType === MSGTYPE_ENCRYPTED_REQUEST) {
      if (!this._tcpKey) {
        throw new Error('TCP key not set for encrypted message');
      }
      const sha256 = crypto.createHash('sha256');
      sha256.update(Buffer.concat([header, dataToEncrypt]));
      const sign = sha256.digest();
      const encryptedData = this.aesCbcEncrypt(dataToEncrypt, this._tcpKey);
      return Buffer.concat([header, encryptedData, sign]);
    } else {
      return Buffer.concat([header, dataToEncrypt]);
    }
  }

  decode8370(data) {
    const packets = [];
    let remainingData = data;

    while (remainingData.length >= 6) {
      const header = remainingData.slice(0, 6);
      if (header[0] !== 0x83 || header[1] !== 0x70) {
        throw new Error('Not an 8370 message');
      }

      const size = header.readUInt16BE(2) + 8; // Total packet size including header

      if (remainingData.length < size) {
        // Incomplete packet, wait for more data
        break;
      }

      const currentPacket = remainingData.slice(0, size);
      remainingData = remainingData.slice(size);

      if (header[4] !== 0x20) {
        throw new Error('Missing byte 4 in 8370 header');
      }

      const padding = header[5] >> 4;
      const msgType = header[5] & 0x0f;
      let payload = currentPacket.slice(6);

      if (msgType === MSGTYPE_ENCRYPTED_RESPONSE || msgType === MSGTYPE_ENCRYPTED_REQUEST) {
        if (!this._tcpKey) {
          throw new Error('TCP key not set for encrypted message');
        }
        if (payload.length < 32) {
            throw new Error('Encrypted message too short to contain signature');
        }
        const sign = payload.slice(-32);
        const encryptedPayload = payload.slice(0, -32);

        const decryptedPayload = this.aesCbcDecrypt(encryptedPayload, this._tcpKey);

        const sha256 = crypto.createHash('sha256');
        sha256.update(Buffer.concat([header, decryptedPayload]));
        const calculatedSign = sha256.digest();

        if (!calculatedSign.equals(sign)) {
          // Special case: Sometimes the device sends ERROR encrypted
          if (decryptedPayload.length === 5 && decryptedPayload.toString('ascii') === 'ERROR') {
             packets.push(Buffer.from('ERROR'));
             continue; // Move to next packet if any
          }
          throw new Error('Sign does not match in decode8370');
        }

        payload = decryptedPayload;
        if (padding > 0) {
          payload = payload.slice(0, -padding);
        }
      }

      if (payload.length < 2) {
          throw new Error('Payload too short to contain response count');
      }
      this._responseCount = payload.readUInt16BE(0);
      const messageData = payload.slice(2);
      packets.push(messageData);
    }

    return [packets, remainingData];
  }
}

// CloudSecurity and its subclasses are less critical for basic LAN control
// but might be needed for initial setup/token retrieval.
// Skipping implementation for now to focus on LAN core.
class CloudSecurity {}
class MeijuCloudSecurity extends CloudSecurity {}
class MSmartCloudSecurity extends CloudSecurity {}
class MideaAirSecurity extends CloudSecurity {}

module.exports = {
  LocalSecurity,
  CloudSecurity,
  MeijuCloudSecurity,
  MSmartCloudSecurity,
  MideaAirSecurity
};
