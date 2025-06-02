// Node.js-Projektstruktur für Midea AC LAN

/**
 * Projektstruktur:
 * 
 * /src
 *   /core
 *     - security.js (Kryptografie und Sicherheitsfunktionen)
 *     - message.js (Nachrichtenformate und -typen)
 *     - packet-builder.js (Paketaufbau für die Kommunikation)
 *     - device.js (Basisklasse für Geräte)
 *     - discover.js (Geräteentdeckung im Netzwerk)
 *     - crc8.js (CRC8-Prüfsummenberechnung)
 *   /devices
 *     - device-factory.js (Fabrik zur Erstellung spezifischer Gerätetypen)
 *     - air-conditioner.js (Klimaanlagen-Implementierung)
 *     - dehumidifier.js (Luftentfeuchter-Implementierung)
 *     - fan.js (Ventilator-Implementierung)
 *     - water-heater.js (Wassererhitzer-Implementierung)
 *     - ... (weitere Gerätetypen)
 *   - index.js (Haupteinstiegspunkt)
 *   - constants.js (Konstanten und Enumerationen)
 *   - logger.js (Logging-Konfiguration)
 * 
 * /test
 *   /core
 *     - security.test.js
 *     - message.test.js
 *     - ...
 *   /devices
 *     - air-conditioner.test.js
 *     - ...
 * 
 * /examples
 *   - discover-devices.js
 *   - control-ac.js
 *   - ...
 */
