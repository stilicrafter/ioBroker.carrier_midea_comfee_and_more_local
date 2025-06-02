/**
 * Example script to control a Midea air conditioner
 */

const { AirConditioner, OperationalMode, FanSpeed, SwingMode } = require('../src/devices/air-conditioner');

// Replace these values with your actual device information
const deviceConfig = {
  name: 'Living Room AC',
  deviceId: 123456789, // Replace with your device ID
  ipAddress: '192.168.1.100', // Replace with your device IP
  port: 6444,
  token: 'abcdef1234567890', // Replace with your device token
  key: '1234567890abcdef', // Replace with your device key
  protocol: 3
};

// Create air conditioner instance
const ac = new AirConditioner(deviceConfig);

// Register update callback to log status changes
ac.registerUpdate((status) => {
  console.log('Status update:', status);
  
  if (status.available !== undefined) {
    console.log(`Device ${status.available ? 'connected' : 'disconnected'}`);
  }
  
  if (status.indoor_temperature !== undefined) {
    console.log(`Indoor temperature: ${status.indoor_temperature}°C`);
  }
});

// Connect to the device
console.log(`Connecting to ${deviceConfig.name} at ${deviceConfig.ipAddress}...`);

// Open connection
ac.open();

// Example control sequence with delays
setTimeout(() => {
  console.log('Setting power ON');
  ac.setPower(true);
}, 3000);

setTimeout(() => {
  console.log('Setting mode to COOL');
  ac.setMode(OperationalMode.COOL);
}, 5000);

setTimeout(() => {
  console.log('Setting temperature to 24°C');
  ac.setTargetTemperature(24);
}, 7000);

setTimeout(() => {
  console.log('Setting fan speed to HIGH');
  ac.setFanSpeed(FanSpeed.HIGH);
}, 9000);

setTimeout(() => {
  console.log('Setting swing mode to VERTICAL');
  ac.setSwingMode(SwingMode.VERTICAL);
}, 11000);

// Close connection after 15 seconds
setTimeout(() => {
  console.log('Closing connection');
  ac.close();
  
  // Exit process after 1 second
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}, 15000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Terminating...');
  ac.close();
  process.exit(0);
});
