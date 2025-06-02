# Midea AC LAN Node.js

Eine Node.js-Portierung der [midea_ac_lan](https://github.com/georgezhao2010/midea_ac_lan) Python-Bibliothek zur Steuerung von Midea M-Smart-Geräten über das lokale Netzwerk.

## Funktionen

* Automatische Geräteerkennung im lokalen Netzwerk
* Unterstützung für verschiedene Gerätetypen (Klimaanlagen, Luftentfeuchter, Ventilatoren, Wassererhitzer)
* Sichere Kommunikation mit Verschlüsselung
* Einfache API zur Gerätesteuerung

## Installation

```bash
npm install midea-ac-lan
```

## Verwendung

### Geräte im Netzwerk entdecken

```javascript
const { DeviceDiscover } = require('midea-ac-lan');

// Erstellen einer Device-Discovery-Instanz
const discover = new DeviceDiscover();

// Starten der Geräteerkennung
discover.discover()
  .then(devices => {
    console.log('Gefundene Geräte:', devices);
  })
  .catch(error => {
    console.error('Fehler bei der Geräteerkennung:', error);
  });

// Auf Geräte-Events während der Erkennung hören
discover.on('device', device => {
  console.log(`Gerät gefunden: ${device.name} (${device.address})`);
});
```

### Klimaanlage steuern

```javascript
const { AirConditioner, OperationalMode, FanSpeed, SwingMode } = require('midea-ac-lan/devices/air-conditioner');

// Gerätekonfiguration
const deviceConfig = {
  name: 'Wohnzimmer Klimaanlage',
  deviceId: 123456789, // Ersetzen Sie dies mit Ihrer Geräte-ID
  ipAddress: '192.168.1.100', // Ersetzen Sie dies mit der IP-Adresse Ihres Geräts
  port: 6444,
  token: 'abcdef1234567890', // Ersetzen Sie dies mit Ihrem Geräte-Token
  key: '1234567890abcdef', // Ersetzen Sie dies mit Ihrem Geräte-Schlüssel
  protocol: 3
};

// Klimaanlagen-Instanz erstellen
const ac = new AirConditioner(deviceConfig);

// Update-Callback registrieren, um Statusänderungen zu protokollieren
ac.registerUpdate((status) => {
  console.log('Statusupdate:', status);
});

// Verbindung zum Gerät herstellen
ac.open();

// Gerät einschalten
ac.setPower(true);

// Modus auf Kühlen setzen
ac.setMode(OperationalMode.COOL);

// Temperatur auf 24°C setzen
ac.setTargetTemperature(24);

// Lüftergeschwindigkeit auf Hoch setzen
ac.setFanSpeed(FanSpeed.HIGH);

// Schwenkmodus auf Vertikal setzen
ac.setSwingMode(SwingMode.VERTICAL);

// Verbindung schließen, wenn nicht mehr benötigt
// ac.close();
```

### Luftentfeuchter steuern

```javascript
const { Dehumidifier, OperationalMode, FanSpeed } = require('midea-ac-lan/devices/dehumidifier');

// Gerätekonfiguration (ähnlich wie bei der Klimaanlage)
const deviceConfig = {
  // ... Konfigurationsdetails
};

// Luftentfeuchter-Instanz erstellen
const dehumidifier = new Dehumidifier(deviceConfig);

// Verbindung zum Gerät herstellen
dehumidifier.open();

// Gerät einschalten
dehumidifier.setPower(true);

// Modus auf Smart setzen
dehumidifier.setMode(OperationalMode.SMART);

// Zielluftfeuchtigkeit auf 50% setzen
dehumidifier.setTargetHumidity(50);

// Lüftergeschwindigkeit auf Mittel setzen
dehumidifier.setFanSpeed(FanSpeed.MEDIUM);
```

## Unterstützte Gerätetypen

- **Klimaanlagen** (AC): Steuerung von Temperatur, Modus, Lüftergeschwindigkeit und Schwenkmodus
- **Luftentfeuchter** (A1): Steuerung von Luftfeuchtigkeit, Modus und Lüftergeschwindigkeit
- **Ventilatoren** (FA): Steuerung von Geschwindigkeit, Modus und Oszillation
- **Wassererhitzer** (E2): Steuerung von Temperatur und Betriebsmodus

## Hinweise

- Stellen Sie sicher, dass Ihre Geräte und Ihr Home Assistant im selben Subnetzwerk sind
- Es wird empfohlen, statische IP-Adressen für Ihre Geräte im Router einzurichten
- Für die erste Einrichtung benötigen Sie möglicherweise Ihre Midea-Kontodaten, um Token und Schlüssel abzurufen

## Lizenz

MIT
