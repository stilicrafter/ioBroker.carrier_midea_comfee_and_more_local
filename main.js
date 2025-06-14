"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const { AirConditioner } = require('./lib/devices/air-conditioner');

// Load your modules here, e.g.:
// const fs = require("fs");
debugger;
class CarrierMideaComfeeAndMoreLocal extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "carrier_midea_comfee_and_more_local",
		});
		// ACHTUNG: this.log ist im Konstruktor noch nicht verfügbar!
		// Logging erst ab onReady oder später verwenden!
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
		this.log.silly("[onReady] called", { config: this.config });

		this.log.silly("[onReady] config option1", { option1: this.config.option1 });
		this.log.silly("[onReady] config option2", { option2: this.config.option2 });

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
		this.log.silly("[onReady] testVariable object created");

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates("testVariable");
		this.log.silly("[onReady] Subscribed to testVariable");
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
		this.log.silly("[onReady] testVariable set to true (ack=false)");

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		await this.setStateAsync("testVariable", { val: true, ack: true });
		this.log.silly("[onReady] testVariable set to true (ack=true)");

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });
		this.log.silly("[onReady] testVariable set to true (ack=true, expire=30)");

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync("admin", "iobroker");
		this.log.silly("[onReady] checkPasswordAsync", { result });

		result = await this.checkGroupAsync("admin", "admin");
		this.log.silly("[onReady] checkGroupAsync", { result });

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
		this.log.silly("[onReady] acStates defined", { acStates });

		for (const s of acStates) {
			this.log.silly("[onReady] Creating state object", { state: s });
			await this.setObjectNotExistsAsync(s.id, {
			type: "state",
			common: {
			  name: s.name,
			  type: /** @type {"boolean"|"number"|"string"|"array"|"object"|"mixed"} */ (s.type),
			  role: s.role,
			  read: true,
			  write: true
			},
			native: {},
		  });
		}  // ggf. das type durch type: s.type, ersetzten?

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
		this.log.silly("[onReady] deviceConfig", { deviceConfig });

		const ac = new AirConditioner(deviceConfig);
		this.log.silly("[onReady] AirConditioner instance created", { ac });

		// Status-Update Callback: Schreibe alle Werte in ioBroker
		ac.registerUpdate(async (status) => {
		  this.log.silly("[ac.registerUpdate] called", { status });
		  for (const s of acStates) {
		    if (status[s.id] !== undefined) {
		      this.log.silly("[ac.registerUpdate] setStateAsync", { id: s.id, value: status[s.id] });
		      await this.setStateAsync(s.id, { val: status[s.id], ack: true });
		    }
		  }
		});

		this.log.silly("[onReady] Opening AC connection");
		// Verbindung aufbauen
		ac.open();

		this.log.silly("[onReady] Setting interval for refreshStatus");
		// Optional: zyklisch Status abfragen (z.B. alle 30s)
		setInterval(() => {
		  this.log.silly("[setInterval] Refreshing AC status");
		  if (ac.refreshStatus) {
				this.log.silly("[setInterval] Calling ac.refreshStatus()");
				ac.refreshStatus();
			} else {
				this.log.silly("[setInterval] ac.refreshStatus not available");
			}
		}, 30000);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		this.log.silly("[onUnload] called");
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			this.log.silly("[onUnload] cleanup done");
			callback();
		} catch (e) {
			this.log.silly("[onUnload] error", { error: e });
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
		this.log.silly("[onStateChange] called", { id, state });
		if (state) {
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
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
	module.exports = (options) => {
		// Silly log for compact mode
		console.log("[EXPORT] Adapter exported in compact mode", options);
		return new CarrierMideaComfeeAndMoreLocal(options);
	};
} else {
	// otherwise start the instance directly
	console.log("[MAIN] Starting adapter instance directly");
	new CarrierMideaComfeeAndMoreLocal();
}