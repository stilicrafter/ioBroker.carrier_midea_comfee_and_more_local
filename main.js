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
        this.log.debug("Konfiguration: " + JSON.stringify(this.config));
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

        const { MideaACDevice } = require("./lib/midea-device");
        this.device = new MideaACDevice({
            ip: this.config.deviceIp,
            token: this.config.deviceToken,
            key: this.config.deviceKey
        });
        this.log.debug("Geräte-Objekt erzeugt: " + JSON.stringify({ip: this.config.deviceIp, token: this.config.deviceToken, key: this.config.deviceKey}));
        try {
            // Test: Logge Methoden und Attribute direkt
            this.log.debug("Methoden von device: " + Object.getOwnPropertyNames(Object.getPrototypeOf(this.device)));
            this.log.debug("Attribute von device: " + JSON.stringify(this.device));
            if (typeof this.device.connect === 'function') {
                await this.device.connect();
                this.log.info("Midea Gerät verbunden");
            } else {
                this.log.error("device.connect ist keine Funktion!");
            }
            if (typeof this.device.refreshStatus === 'function') {
                this.log.debug("Starte Statusabfrage (refreshStatus)");
                await this.device.refreshStatus();
            } else {
                this.log.error("device.refreshStatus ist keine Funktion!");
            }
            const attrs = this.device.attributes || {};
            this.log.debug("Geräteattribute empfangen: " + JSON.stringify(attrs));
            await this.createOrUpdateState("indoor_temperature", {
                name: "Indoor Temperature",
                type: "number",
                role: "value.temperature",
                unit: "°C",
                value: attrs.indoor_temperature
            });
            await this.createOrUpdateState("indoor_humidity", {
                name: "Indoor Humidity",
                type: "number",
                role: "value.humidity",
                unit: "%",
                value: attrs.indoor_humidity
            });
            await this.createOrUpdateState("power", {
                name: "Power",
                type: "boolean",
                role: "switch",
                value: attrs.power
            });
            await this.createOrUpdateState("mode", {
                name: "Mode",
                type: "string",
                role: "text",
                value: attrs.mode
            });
            await this.createOrUpdateState("target_temperature", {
                name: "Target Temperature",
                type: "number",
                role: "level.temperature",
                unit: "°C",
                value: attrs.target_temperature
            });
            await this.createOrUpdateState("total_energy_consumption", {
                name: "Total Energy Consumption",
                type: "number",
                role: "value.energy",
                unit: "kWh",
                value: attrs.total_energy_consumption
            });
        } catch (e) {
            this.log.error("Fehler beim Verbinden oder Auslesen des Geräts: " + e);
            this.log.error(e.stack);
        }
    }

    async createOrUpdateState(id, options) {
        await this.setObjectNotExistsAsync(this.namespace + "." + id, {
            type: "state",
            common: {
                name: options.name,
                type: options.type,
                role: options.role,
                unit: options.unit || undefined,
                read: true,
                write: ["power", "mode", "target_temperature"].includes(id)
            },
            native: {}
        });
        if (options.value !== undefined) {
            await this.setStateAsync(this.namespace + "." + id, options.value, true);
        }
    }

    async onStateChange(id, state) {
        if (!state || state.ack) return;
        // Beispiel: Temperatur setzen
        if (id.endsWith("target_temperature")) {
            await this.device.setTemperature(state.val);
            this.setState(id, state.val, true);
        }
        if (id.endsWith("power")) {
            await this.device.setPower(state.val);
            this.setState(id, state.val, true);
        }
        if (id.endsWith("mode")) {
            await this.device.setMode(state.val);
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