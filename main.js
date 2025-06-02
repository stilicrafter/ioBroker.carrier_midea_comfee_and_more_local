"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const { AirConditioner } = require(__dirname + '/src/devices/air-conditioner');

// Load your modules here, e.g.:
// const fs = require("fs");

class CarrierMideaComfeeAndMoreLocal extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "carrier_midea_comfee_and_more_local",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info("config option1: " + this.config.option1);
		this.log.info("config option2: " + this.config.option2);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		await this.setObjectNotExistsAsync("testVariable", {
			type: "state",
			common: {
				name: "testVariable",
				type: "boolean", // "boolean" is a valid CommonType
				role: "indicator",
				read: true,
				write: true,
			},
			native: {},
		});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates("testVariable");
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync("admin", "iobroker");
		this.log.info("check user admin pw iobroker: " + result);

		result = await this.checkGroupAsync("admin", "admin");
		this.log.info("check group user admin group admin: " + result);

		// === AC State Definitions ===
		const acStates = [
		  { id: "power", name: "Power", type: "boolean", role: "switch.power" },
		  { id: "mode", name: "Mode", type: "number", role: "level.mode" },
		  { id: "target_temperature", name: "Target Temperature", type: "number", role: "level.temperature" },
		  { id: "indoor_temperature", name: "Indoor Temperature", type: "number", role: "value.temperature" },
		  { id: "outdoor_temperature", name: "Outdoor Temperature", type: "number", role: "value.temperature" },
		  { id: "fan_speed", name: "Fan Speed", type: "number", role: "level.speed" },
		  { id: "swing_mode", name: "Swing Mode", type: "number", role: "level.mode.swing" },
		  { id: "eco_mode", name: "Eco Mode", type: "boolean", role: "switch.eco" },
		  { id: "turbo_mode", name: "Turbo Mode", type: "boolean", role: "switch.turbo" },
		  { id: "available", name: "Available", type: "boolean", role: "indicator.reachable" }
		];

		for (const s of acStates) {
		  await this.setObjectNotExistsAsync(s.id, {
		    type: "state",
		    common: {
		      name: s.name,
		      type: s.type,
		      role: s.role,
		      read: true,
		      write: true
		    },
		    native: {},
		  });
		}

		// Device-Konfiguration (später aus Adapter-Konfiguration holen!)
		const deviceConfig = {
		  name: 'Living Room AC',
		  deviceId: 146235046529115, // TODO: Aus Config holen
		  ipAddress: '10.10.10.148',
		  port: 6444,
		  token: '512d9bf9017dd26aebef222227c9570e7ad0f589e55aa76c4b9d35d44c64505a754660365620ecf9431c4a31a6394b1c959898c31efff5eedd8ff02bdca50c7a',
		  key: '93b236c3c0734f7db135df585966edcc9ad71753f089445caccec8db6d783181',
		  protocol: 2
		};

		const ac = new AirConditioner(deviceConfig);

		// Status-Update Callback: Schreibe alle Werte in ioBroker
		ac.registerUpdate(async (status) => {
		  for (const s of acStates) {
		    if (status[s.id] !== undefined) {
		      await this.setStateAsync(s.id, { val: status[s.id], ack: true });
		    }
		  }
		});

		// Verbindung aufbauen
		ac.open();

		// Optional: zyklisch Status abfragen (z.B. alle 30s)
		setInterval(() => {
		  if (ac.refreshStatus) ac.refreshStatus();
		}, 30000);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new CarrierMideaComfeeAndMoreLocal(options);
} else {
	// otherwise start the instance directly
	new CarrierMideaComfeeAndMoreLocal();
}