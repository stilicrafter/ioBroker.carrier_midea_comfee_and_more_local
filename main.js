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
        await this.device.refreshStatus();
        this.setState("info.status", JSON.stringify(this.device.attributes), true);
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