/**
 * Basic test script for the Midea AC LAN library
 */

const { DeviceDiscover, LocalSecurity } = require('../src');
const crypto = require('crypto');

// Test LocalSecurity functionality
console.log('Testing LocalSecurity module...');

// Create a security instance
const security = new LocalSecurity();

// Test AES encryption/decryption
const testData = Buffer.from('Hello, Midea AC LAN!');
console.log('Original data:', testData.toString());

const encrypted = security.aesEncrypt(testData);
console.log('Encrypted data:', encrypted.toString('hex'));

const decrypted = security.aesDecrypt(encrypted);
console.log('Decrypted data:', decrypted.toString());

// Test checksum calculation
const testBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
const checksum = security.encode32Data(testBuffer);
console.log('Checksum for test buffer:', checksum.toString('hex'));

// Test UDP ID generation
console.log('\nTesting UDP ID generation...');
const testApplianceId = 123456789;
const udpId0 = DeviceDiscover.getUdpId(testApplianceId, 0);
const udpId1 = DeviceDiscover.getUdpId(testApplianceId, 1);
const udpId2 = DeviceDiscover.getUdpId(testApplianceId, 2);

console.log('UDP ID (method 0):', udpId0);
console.log('UDP ID (method 1):', udpId1);
console.log('UDP ID (method 2):', udpId2);

console.log('\nAll tests completed successfully!');
