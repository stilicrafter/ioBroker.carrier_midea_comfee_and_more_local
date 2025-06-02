# Python-Abhängigkeiten und Node.js-Alternativen

## Identifizierte Python-Abhängigkeiten

### Externe Bibliotheken
- **Crypto.Cipher.AES** (pycryptodome): Für AES-Verschlüsselung
- **Crypto.Util.Padding** (pycryptodome): Für Padding-Funktionen
- **Crypto.Util.strxor** (pycryptodome): Für XOR-Operationen
- **Crypto.Random** (pycryptodome): Für Zufallszahlengenerierung
- **hashlib**: Für MD5 und SHA256 Hashing
- **hmac**: Für HMAC-Authentifizierung
- **socket**: Für Netzwerkkommunikation
- **threading**: Für parallele Ausführung
- **logging**: Für Logging-Funktionalität
- **time**: Für Zeitfunktionen
- **datetime**: Für Datum- und Zeitoperationen
- **urllib.parse**: Für URL-Parsing und -Manipulation
- **enum**: Für Enum-Typen
- **abc**: Für abstrakte Basisklassen

### Interne Module
- **security.py**: Implementierung der Sicherheitsfunktionen
- **packet_builder.py**: Paketaufbau für die Kommunikation
- **message.py**: Nachrichtenformate und -typen
- **device.py**: Basisklasse für Geräte
- **discover.py**: Geräteentdeckung im Netzwerk
- **crc8.py**: CRC8-Prüfsummenberechnung

## Node.js-Alternativen

### Externe Bibliotheken
- **crypto**: Integrierte Node.js-Bibliothek für kryptografische Funktionen (AES, Hashing)
- **net**: Integrierte Node.js-Bibliothek für Netzwerkkommunikation (TCP/IP)
- **events**: Integrierte Node.js-Bibliothek für Event-basierte Kommunikation
- **worker_threads**: Für parallele Ausführung (Alternative zu threading)
- **console**: Für Logging-Funktionalität
- **url**: Für URL-Parsing und -Manipulation
- **buffer**: Für Byte-Array-Manipulation
- **node-forge**: Erweiterte kryptografische Funktionen

### Zusätzliche Bibliotheken
- **winston**: Erweiterte Logging-Funktionalität
- **moment**: Für erweiterte Datum- und Zeitoperationen
- **debug**: Für Debug-Logging
