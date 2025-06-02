//TODO: Loggen von Auth - Warum zu kurz?

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
        this.log.debug("onReady gestartet");
        this.log.debug("Konfiguration: " + JSON.stringify(this.config));
        this.log.info(`Admin-Konfiguration: deviceIp=${this.config.deviceIp}, deviceToken=${this.config.deviceToken}, deviceKey=${this.config.deviceKey}`);
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
            key: this.config.deviceKey,
            log: this.log
        });
        this.log.debug("Geräte-Objekt erzeugt: " + JSON.stringify({ip: this.config.deviceIp, token: this.config.deviceToken, key: this.config.deviceKey}));
        try {
            this.log.debug("Methoden von device: " + Object.getOwnPropertyNames(Object.getPrototypeOf(this.device)));
            // Entferne das folgende Logging, da this.device zirkuläre Referenzen enthält:
            // this.log.debug("Attribute von device: " + JSON.stringify(this.device));
            // Stattdessen gezielt relevante Felder loggen:
            this.log.debug(`Device-Infos: ip=${this.device.ip}, token=${this.device.token?.toString('hex')}, key=${this.device.key?.toString('hex')}, protocol=${this.device.protocol}`);
            if (typeof this.device.connect === 'function') {
                this.log.debug("Starte await this.device.connect() ...");
                try {
                    await this.device.connect();
                    this.log.info("Midea Gerät verbunden (connect abgeschlossen)");
                } catch (e) {
                    this.log.error("Fehler bei device.connect: " + e);
                    this.log.error(e.stack);
                    return;
                }
            } else {
                this.log.error("device.connect ist keine Funktion!");
                return;
            }
            this.log.debug("Nach device.connect, vor Polling-Setup");
            // Polling-Intervall (10 Sekunden)
            const poll = async () => {
                this.log.debug("[POLL] Intervall ausgelöst");
                try {
                    this.log.debug("Starte Statusabfrage (refreshStatus)");
                    await this.device.refreshStatus(true);
                    this.log.debug("refreshStatus abgeschlossen, aktualisiere States");
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
                    this.log.debug("States aktualisiert");
                } catch (e) {
                    this.log.error("Fehler beim Polling/Statusabfrage: " + e);
                }
            };
            this.log.debug("Starte initiales Polling");
            await poll();
            this.log.debug("Setze Polling-Intervall");
            this._pollInterval = setInterval(() => { poll().catch(e => this.log.error("Fehler im Polling-Intervall: " + e)); }, 10000);
        } catch (e) {
            this.log.error("Fehler im onReady-try-Block: " + e);
            this.log.error(e.stack);
        }
        this.log.debug("onReady fertig");
    }

    async createOrUpdateState(id, options) {
        this.log.debug(`createOrUpdateState aufgerufen für ${id} mit Wert ${options.value}`);
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
            this.log.debug(`setStateAsync für ${id} auf ${options.value}`);
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
            if (this._pollInterval) clearInterval(this._pollInterval);
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