// Entferne die Klasse Midea und verwende nur CarrierMideaComfeeAndMoreLocal
const utils = require("@iobroker/adapter-core");

class CarrierMideaComfeeAndMoreLocal extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options = {}) {
        super({
            ...options,
            name: "carrier_midea_comfee_and_more_local",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    async onReady() {
        this.log.info("CarrierMideaComfeeAndMoreLocal Adapter gestartet");
        // Test: Lege einen State im Instanz-Namespace an
        await this.setObjectNotExistsAsync(this.namespace + ".test", {
            type: "state",
            common: {
                name: "Test State",
                type: "number",
                role: "value",
                read: true,
                write: true
            },
            native: {}
        });
        await this.setStateAsync(this.namespace + ".test", 42, true);
        // Beispiel: Gerät initialisieren
        // Nutze MideaACDevice für Status und Temperatur
        const { MideaACDevice } = require("./lib/midea-device");
        this.device = new MideaACDevice({
            ip: this.config.deviceIp,
            token: this.config.deviceToken,
            key: this.config.deviceKey
        });
        await this.device.connect();
        this.log.info("Midea Gerät verbunden");
        // Status abfragen
        //await this.device.refreshStatus();
        //Hier wird aktuell nur mit Dummy Werten gearbeitet, da keine echte Verbindung besteht. Das muss noch implementiert werden.
        await this.setObjectNotExistsAsync(this.namespace + ".indoor_temperature", {
            type: "state",
            common: {
                name: "Indoor Temperature",
                type: "number",
                role: "value.temperature",
                unit: "°C",
                read: true,
                write: false
            },
            native: {}
        });
        await this.setObjectNotExistsAsync(this.namespace + ".indoor_humidity", {
            type: "state",
            common: {
                name: "Indoor Humidity",
                type: "number",
                role: "value.humidity",
                unit: "%",
                read: true,
                write: false
            },
            native: {}
        });
        await this.setObjectNotExistsAsync(this.namespace + ".power", {
            type: "state",
            common: {
                name: "Power",
                type: "boolean",
                role: "switch",
                read: true,
                write: true
            },
            native: {}
        });
        await this.setObjectNotExistsAsync(this.namespace + ".mode", {
            type: "state",
            common: {
                name: "Mode",
                type: "string",
                role: "text",
                read: true,
                write: true
            },
            native: {}
        });
        await this.setObjectNotExistsAsync(this.namespace + ".target_temperature", {
            type: "state",
            common: {
                name: "Target Temperature",
                type: "number",
                role: "level.temperature",
                unit: "°C",
                read: true,
                write: true
            },
            native: {}
        });
        await this.setObjectNotExistsAsync(this.namespace + ".total_energy_consumption", {
            type: "state",
            common: {
                name: "Total Energy Consumption",
                type: "number",
                role: "value.energy",
                unit: "kWh",
                read: true,
                write: false
            },
            native: {}
        });
        // Dummywerte setzen (hier später echte Werte aus device.attributes)
        await this.setStateAsync(this.namespace + ".indoor_temperature", 22.5, true);
        await this.setStateAsync(this.namespace + ".indoor_humidity", 45, true);
        await this.setStateAsync(this.namespace + ".power", true, true);
        await this.setStateAsync(this.namespace + ".mode", "cool", true);
        await this.setStateAsync(this.namespace + ".target_temperature", 24, true);
        await this.setStateAsync(this.namespace + ".total_energy_consumption", 12.3, true);
    }

    async onStateChange(id, state) {
        if (!state || state.ack) return;
        // Temperatur setzen
        if (id.endsWith("setTemperature")) {
            await this.device.setTemperature(state.val);
            this.setState(id, state.val, true);
        }
    }

    onUnload(callback) {
        try {
            if (this.device) this.device.disconnect();
            callback();
        } catch (e) {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new CarrierMideaComfeeAndMoreLocal(options);
} else {
    // otherwise start the instance directly
    new CarrierMideaComfeeAndMoreLocal();
}