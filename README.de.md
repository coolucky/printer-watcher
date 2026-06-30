# Druckservice-Überwachungssystem

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README.zh-CN.md) [![繁體中文](https://img.shields.io/badge/lang-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-red)](README.zh-TW.md) [![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-orange)](README.ja.md) [![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-yellow)](README.ko.md) [![Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-purple)](README.fr.md) [![Deutsch](https://img.shields.io/badge/lang-Deutsch-green)](README.de.md) [![Español](https://img.shields.io/badge/lang-Espa%C3%B1ol-orange)](README.es.md)

Eine voll ausgestattete, selbst gehostete Webanwendung für die Verwaltung von Unternehmensdruckerflotten, Druckserver-Überwachung, automatisierte Berichtserstellung, Asset-Inventar-Verfolgung und Jira-Ticket-Integration.

Entwickelt mit **React 18 + Material UI** Frontend und **Node.js + Express** Backend, mit Unterstützung für zweisprachige Benutzeroberfläche (English / 简体中文), Dunkelmodus und Windows Server Offline-Bereitstellung.

🌐 **Portal**: [http://papercut001.example-corp.com.cn:9191/](http://papercut001.example-corp.com.cn:9191/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

---

## Funktionen

### 🖨️ Druckerüberwachung
- **Echtzeit-Statusüberwachung** über SNMP-Protokoll (Tonerfüllstände, Papierstatus, Fehlererkennung)
- **30-Sekunden-Abfrageintervall** mit konfigurierbarem Backoff
- **Multi-Drucker-Unterstützung** mit individueller IP/SNMP-Konfiguration
- **Status-Verlaufsverfolgung** mit täglichen Snapshots
- **Wartungsmodus** zum Pausieren der Überwachung bestimmter Drucker

### 🖥️ Druckserver-Überwachung
- **CPU-, Speicher-, Festplattenauslastung** Überwachung für Windows-Druckserver
- **Betriebszeitverfolgung** und Statusverlauf
- **Visuelles Dashboard** mit farbcodierten Gesundheitsindikatoren
- **Serverkonfigurationsverwaltung** mit Hinzufügen/Bearbeiten/Löschen

### 📊 Status-Dashboard
- **Live-Übersicht** aller Drucker und Server in einer Ansicht
- **Lizenzverwaltung** mit Ablaufverfolgung
- **Druckanalysen** mit täglichen Nutzungsdiagrammen (durch Feature-Flag gesteuert)

### 📧 Automatisierte Berichtserstellung
- **Geplante Wochenberichte** mit E-Mail-Zustellung
- **5 Berichtsstilvorlagen** zur Auswahl
- **HTML-E-Mail-Berichte** mit Druckerstatus-Tabellen
- **Konfigurierbare Empfänger** und Zeitplanung
- **Manuelle Berichtserstellung** mit sofortiger Vorschau

### 🔔 Alarmsystem
- **Toner-Niedrigstand-Alarme** mit konfigurierbarem Schwellenwert (5% / 10%)
- **Drucker-Offline-Alarme** mit E-Mail-Benachrichtigungen
- **Druckserver-Fehleralarme**
- **SMTP-E-Mail-Integration** mit Wiederholungsmechanismus
- **Atemanimation** bei aktiven Alarmindikatoren

### 📦 Asset-Inventar
- **Hardware-Asset-Verfolgung** und Verwaltung
- **Inventarsitzungsverwaltung** für periodische Prüfungen
- **Excel-Export** Unterstützung (gebündeltes ExcelJS für Offline-Nutzung)

### 🎫 Jira-Ticket-Integration
- **Vorlagenbasierte Ticketerstellung** mit über 20 konfigurierbaren Vorlagen
- **Batch-Ticketerstellung** für mehrere Melder
- **Automatisch ausgefüllte Variablen**: `{ntid}`, `{fullname}`, `{DATE_COMPACT}` usw.
- **Ticketsuche** mit progressiver Präfixsuche (ISDS → TPX → CHG → ECSR)
- **Überwachung ausstehender Genehmigungen** mit Echtzeit-Polling
- **Service-Desk-Genehmigung** Unterstützung (Genehmigen/Ablehnen für ISDS-Tickets)
- **Schnellaktionen**: Kommentieren, Lösen, Schließen mit automatisch ausgefüllter interner Komponente
- **Kommentarvorlagen** (benutzerübergreifend geteilt, serverseitig persistiert)
- **Vorlagenverwaltung** mit häufigkeitsbasierter Sortierung und Verfolgung der letzten Nutzung

### 👥 Benutzerverwaltung
- **Rollenbasierte Zugriffskontrolle**: Administrator, Redakteur, Betrachter
- **JWT-Authentifizierung** mit Refresh-Token
- **Benutzerprofilverwaltung**

### 🌐 Internationalisierung
- **Zweisprachige Benutzeroberfläche**: Englisch und vereinfachtes Chinesisch
- **Echtzeit-Sprachwechsel** ohne Seitenneuladen
- **Alle UI-Texte** über i18n-Schlüssel verwaltet

### 🌙 Dunkelmodus
- **Vollständige Unterstützung des dunklen Themes** über alle Komponenten
- **CSS-variablenbasiertes Theming** für einheitliches Styling
- **Ein-Klick-Umschaltung** mit Einstellungspersistenz

---

## Technologie-Stack

### Frontend
| Technologie | Verwendung |
|---|---|
| React 18 | UI-Framework |
| Material UI 7 | Komponentenbibliothek |
| Vite 7 | Build-Tool & Entwicklungsserver |
| Chart.js | Datenvisualisierung |
| i18next | Internationalisierung |
| Axios | HTTP-Client |
| react-hook-form | Formularverwaltung |

### Backend
| Technologie | Verwendung |
|---|---|
| Node.js 18+ | Laufzeitumgebung |
| Express 5 | Web-Framework |
| net-snmp | SNMP-Druckerabfragen |
| nodemailer | E-Mail-Versand |
| jsonwebtoken | JWT-Authentifizierung |
| bcryptjs | Passwort-Hashing |
| Puppeteer | Screenshot-Erfassung |
| Tesseract.js | OCR-Verarbeitung |
| cheerio | HTML-Parsing |

---

## Projektstruktur

```
├── src/                          # Frontend-Quellcode
│   ├── components/               # React-Komponenten
│   │   ├── StatusDashboard.jsx   # Haupt-Überwachungsdashboard
│   │   ├── PrintServerDashboard.jsx
│   │   ├── ReportForm.jsx        # Berichtserstellung
│   │   ├── AlertSettings.jsx     # Alarmkonfiguration
│   │   ├── JiraTickets.jsx       # Jira-Integration
│   │   ├── AssetInventory.jsx    # Asset-Verfolgung
│   │   ├── SettingsPanel.jsx     # Systemeinstellungen
│   │   └── ...
│   ├── i18n/locales/             # Übersetzungsdateien
│   │   ├── en.json               # Englisch
│   │   └── zh-CN.json            # Vereinfachtes Chinesisch
│   ├── context/                  # React Context (globaler Zustand)
│   ├── hooks/                    # Benutzerdefinierte Hooks
│   ├── services/                 # Frontend-Dienste
│   └── theme/                    # Theme-Konfiguration
├── backend/                      # Backend-Quellcode
│   ├── server.js                 # Express-Server-Einstiegspunkt
│   ├── config/                   # Konfigurationsdateien (JSON)
│   │   ├── printers.json         # Druckerdefinitionen
│   │   ├── printServers.json     # Druckserver-Konfigurationen
│   │   ├── alertConfig.json      # Alarmregeln
│   │   ├── jiraTemplates.json    # Jira-Ticket-Vorlagen
│   │   └── ...
│   ├── routes/                   # API-Routenhandler
│   ├── services/                 # Geschäftslogik (16 Dienste)
│   │   ├── printerMonitoringService.js
│   │   ├── printServerMonitoringService.js
│   │   ├── scheduledReportService.js
│   │   ├── snmpService.js
│   │   ├── jiraService.js
│   │   ├── emailService.js
│   │   └── ...
│   ├── middleware/               # Authentifizierung, Validierung, Formatierung
│   └── utils/                    # JWT, Hilfsfunktionen
├── deploy/                       # Bereitstellungsskripte
│   ├── pack-offline.sh           # Offline-Paketersteller
│   ├── install-service.bat       # Windows-Dienstinstaller
│   ├── frontend-server.js        # Produktions-Staticserver
│   └── offline-package/          # Vorgefertigtes Bereitstellungspaket
└── public/                       # Statische Ressourcen
```

---

## Erste Schritte

### Voraussetzungen
- **Node.js 18+** ([Download](https://nodejs.org/))
- **npm** (in Node.js enthalten)

### Entwicklungsumgebung einrichten

```bash
# Repository klonen
git clone https://github.com/your-org/printer-status-report.git
cd printer-status-report

# Frontend-Abhängigkeiten installieren
npm install

# Backend-Abhängigkeiten installieren
cd backend
cp .env.example .env    # Umgebung konfigurieren
npm install
cd ..

# Beide Dienste starten (in separaten Terminals)
npm run dev             # Frontend auf http://localhost:5175
cd backend && node server.js  # Backend auf http://localhost:3001
```

### Umgebungsvariablen

Erstellen Sie `backend/.env` aus `.env.example`:

```env
PORT=3001
NODE_ENV=development

# SMTP-Konfiguration
SMTP_HOST=your-smtp-server
SMTP_PORT=25
SMTP_FROM=printer-monitor@yourcompany.com
ALERT_RECIPIENTS=admin@yourcompany.com

# JWT-Geheimnisse (automatisch generiert, wenn nicht gesetzt)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### Standard-Anmeldung
- **Benutzername**: `admin`
- **Passwort**: `admin123` (nach der ersten Anmeldung ändern)

---

## Produktionsbereitstellung (Windows Server)

### Offline-Bereitstellung

Das System ist für **isolierte Windows Server**-Umgebungen konzipiert:

```bash
# Auf dem Entwicklungsrechner (macOS/Linux): Offline-Paket erstellen
bash deploy/pack-offline.sh
```

Dies erzeugt eine `.zip`-Datei mit allem Benötigten:

1. Kopieren Sie die `.zip` auf den Windows Server
2. Extrahieren Sie in ein Verzeichnis (z.B. `C:\PrinterStatus`)
3. Stellen Sie sicher, dass Node.js 18+ installiert ist
4. Rechtsklick auf `install-service.bat` → **Als Administrator ausführen**
5. Zugriff über `http://server-ip:9191`

Der Installer verwendet **NSSM** zur Registrierung von Windows-Diensten, die Abmeldung und Neustart überdauern:
- `PrinterStatusBackend` (Port 3001)
- `PrinterStatusFrontend` (Port 9191)

---

## API-Übersicht

| Methode | Endpunkt | Beschreibung |
|---|---|---|
| `GET` | `/api/health` | Gesundheitsprüfung |
| `POST` | `/api/auth` | Benutzerauthentifizierung |
| `GET/POST` | `/api/printers` | Druckerverwaltung |
| `GET/POST` | `/api/settings` | Systemeinstellungen |
| `POST/GET` | `/api/reports` | Berichtserstellung |
| `GET/POST` | `/api/alerts` | Alarmkonfiguration |
| `GET` | `/api/jira/templates` | Jira-Ticket-Vorlagen |
| `POST` | `/api/jira/tickets` | Jira-Tickets erstellen |
| `GET` | `/api/jira/issues` | Jira-Vorgänge suchen |
| `GET` | `/api/jira/pending-approvals` | Ausstehende Genehmigungstickets |
| `POST` | `/api/jira/issues/:key/transition` | Ticket-Transition ausführen |
| `GET/POST/DELETE` | `/api/jira/comment-templates` | Kommentarvorlagen |

---

## Screenshots

> Fügen Sie Screenshots des Hauptdashboards, der Jira-Ticketerstellung, des Dunkelmodus usw. hinzu.

---

## Mitwirken

1. Forken Sie das Repository
2. Erstellen Sie einen Feature-Branch (`git checkout -b feature/amazing-feature`)
3. Committen Sie Ihre Änderungen (`git commit -m 'Add amazing feature'`)
4. Pushen Sie zum Branch (`git push origin feature/amazing-feature`)
5. Öffnen Sie einen Pull Request

### Entwicklungsrichtlinien
- Alle benutzerbezogenen Texte müssen `t('key')` von react-i18next verwenden
- Fügen Sie entsprechende Schlüssel sowohl in `src/i18n/locales/zh-CN.json` als auch in `en.json` hinzu
- Befolgen Sie die bestehenden Code-Muster und die Komponentenstruktur

---

## Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert — Details finden Sie in der [LICENSE](LICENSE)-Datei.

---

## Danksagungen

- [Material UI](https://mui.com/) — React-Komponentenbibliothek
- [Vite](https://vitejs.dev/) — Frontend-Tooling der nächsten Generation
- [NSSM](https://nssm.cc/) — Windows-Dienstmanager
- [net-snmp](https://github.com/markabrahams/node-net-snmp) — SNMP-Protokoll für Node.js
