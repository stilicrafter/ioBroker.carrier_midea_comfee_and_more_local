/**
 * Example script to discover Midea devices on the local network
 */

const { DeviceDiscover } = require('../src');

// Create a device discovery instance
// You can specify a specific network address or use the default broadcast address
const discover = new DeviceDiscover();

// Start discovery
console.log('Starting device discovery...');
console.log('This will scan your local network for Midea devices.');
console.log('Discovery will run for 5 seconds.');

discover.discover()
  .then(devices => {
    console.log('\nDiscovery complete!');
    
    if (Object.keys(devices).length === 0) {
      console.log('No devices found.');
      return;
    }
    
    console.log(`Found ${Object.keys(devices).length} device(s):`);
    
    // Print device information
    Object.values(devices).forEach(device => {
      console.log('\n-----------------------------------');
      console.log(`Device ID: ${device.id}`);
      console.log(`Name: ${device.name}`);
      console.log(`Model: ${device.model}`);
      console.log(`Type: 0x${device.type.toString(16).padStart(2, '0')}`);
      console.log(`IP Address: ${device.address}`);
      console.log(`Port: ${device.port}`);
      console.log(`Protocol Version: ${device.version}`);
      console.log(`Serial Number: ${device.sn}`);
    });
  })
  .catch(error => {
    console.error('Discovery error:', error);
  });

// Listen for device events during discovery
discover.on('device', device => {
  console.log(`Found device: ${device.name} (${device.address})`);
});
