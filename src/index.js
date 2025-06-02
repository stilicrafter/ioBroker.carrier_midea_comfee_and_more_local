/**
 * Main entry point for Midea AC LAN library
 */

const { MideaDevice } = require('./core/device');
const DeviceDiscover = require('./core/discover');
const { LocalSecurity } = require('./core/security');

// Export core modules
module.exports = {
  MideaDevice,
  DeviceDiscover,
  LocalSecurity
};
