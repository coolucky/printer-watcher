# Print Service Monitoring System

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README.zh-CN.md) [![繁體中文](https://img.shields.io/badge/lang-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-red)](README.zh-TW.md) [![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-orange)](README.ja.md) [![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-yellow)](README.ko.md) [![Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-purple)](README.fr.md) [![Deutsch](https://img.shields.io/badge/lang-Deutsch-green)](README.de.md) [![Español](https://img.shields.io/badge/lang-Espa%C3%B1ol-orange)](README.es.md)

A full-featured, self-hosted web application for enterprise printer fleet management, print server monitoring, automated report generation, asset inventory tracking, and Jira ticket integration.

Built with **React 18 + Material UI** frontend and **Node.js + Express** backend, supporting bilingual UI (English / 简体中文), dark mode, and Windows Server offline deployment.

🌐 **Portal**: [http://papercut001.example-corp.com.cn:9191/](http://papercut001.example-corp.com.cn:9191/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

---

## Features

### 🖨️ Printer Monitoring
- **Real-time status monitoring** via SNMP protocol (toner levels, paper status, error detection)
- **30-second polling interval** with configurable backoff
- **Multi-printer support** with individual IP/SNMP configuration
- **Status history tracking** with daily snapshots
- **Maintenance mode** to pause monitoring for specific printers

### 🖥️ Print Server Monitoring
- **CPU, memory, disk usage** monitoring for Windows print servers
- **Uptime tracking** and status history
- **Visual dashboard** with color-coded health indicators
- **Server configuration management** with add/edit/delete

### 📊 Status Dashboard
- **Live overview** of all printers and servers in one view
- **License management** with expiration tracking
- **Print analytics** with daily usage charts (feature-flagged)

### 📧 Automated Report Generation
- **Scheduled weekly reports** with email delivery
- **5 report style templates** to choose from
- **HTML email reports** with printer status tables
- **Configurable recipients** and schedule timing
- **Manual report generation** with instant preview

### 🔔 Alert System
- **Low toner alerts** with configurable threshold (5% / 10%)
- **Printer offline alerts** with email notifications
- **Print server error alerts**
- **SMTP email integration** with retry mechanism
- **Visual breathing animation** on active alert indicators

### 📦 Asset Inventory
- **Hardware asset tracking** and management
- **Inventory session management** for periodic audits
- **Excel export** support (bundled ExcelJS for offline use)

### 🎫 Jira Ticket Integration
- **Template-based ticket creation** with 20+ configurable templates
- **Batch ticket creation** for multiple reporters
- **Auto-fill variables**: `{ntid}`, `{fullname}`, `{DATE_COMPACT}`, etc.
- **Ticket search** with progressive prefix search (ISDS → TPX → CHG → ECSR)
- **Pending approval monitoring** with real-time polling
- **Service Desk approval** support (Approve/Decline for ISDS tickets)
- **Quick actions**: Comment, Resolve, Close with auto-filled Internal Component
- **Comment templates** (shared across users, backend-persisted)
- **Template management** with frequency-based sorting and recent-used tracking

### 👥 User Management
- **Role-based access control**: Administrator, Editor, Viewer
- **JWT authentication** with refresh tokens
- **User profile management**

### 🌐 Internationalization
- **Bilingual UI**: English and Simplified Chinese
- **Real-time language switching** without page reload
- **All UI text managed via i18n keys**

### 🌙 Dark Mode
- **Full dark theme support** across all components
- **CSS variable-based theming** for consistent styling
- **One-click toggle** with preference persistence

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Material UI 7 | Component library |
| Vite 7 | Build tool & dev server |
| Chart.js | Data visualization |
| i18next | Internationalization |
| Axios | HTTP client |
| react-hook-form | Form management |

### Backend
| Technology | Purpose |
|---|---|
| Node.js 18+ | Runtime |
| Express 5 | Web framework |
| net-snmp | SNMP printer queries |
| nodemailer | Email delivery |
| jsonwebtoken | JWT auth |
| bcryptjs | Password hashing |
| Puppeteer | Screenshot capture |
| Tesseract.js | OCR processing |
| cheerio | HTML parsing |

---

## Project Structure

```
├── src/                          # Frontend source
│   ├── components/               # React components
│   │   ├── StatusDashboard.jsx   # Main monitoring dashboard
│   │   ├── PrintServerDashboard.jsx
│   │   ├── ReportForm.jsx        # Report generation
│   │   ├── AlertSettings.jsx     # Alert configuration
│   │   ├── JiraTickets.jsx       # Jira integration
│   │   ├── AssetInventory.jsx    # Asset tracking
│   │   ├── SettingsPanel.jsx     # System settings
│   │   └── ...
│   ├── i18n/locales/             # Translation files
│   │   ├── en.json               # English
│   │   └── zh-CN.json            # Simplified Chinese
│   ├── context/                  # React context (global state)
│   ├── hooks/                    # Custom hooks
│   ├── services/                 # Frontend services
│   └── theme/                    # Theme configuration
├── backend/                      # Backend source
│   ├── server.js                 # Express server entry
│   ├── config/                   # Configuration files (JSON)
│   │   ├── printers.json         # Printer definitions
│   │   ├── printServers.json     # Print server configs
│   │   ├── alertConfig.json      # Alert rules
│   │   ├── jiraTemplates.json    # Jira ticket templates
│   │   └── ...
│   ├── routes/                   # API route handlers
│   ├── services/                 # Business logic (16 services)
│   │   ├── printerMonitoringService.js
│   │   ├── printServerMonitoringService.js
│   │   ├── scheduledReportService.js
│   │   ├── snmpService.js
│   │   ├── jiraService.js
│   │   ├── emailService.js
│   │   └── ...
│   ├── middleware/               # Auth, validation, formatting
│   └── utils/                    # JWT, helpers
├── deploy/                       # Deployment scripts
│   ├── pack-offline.sh           # Offline package builder
│   ├── install-service.bat       # Windows service installer
│   ├── frontend-server.js        # Production static server
│   └── offline-package/          # Pre-built deployment package
└── public/                       # Static assets
```

---

## Getting Started

### Prerequisites
- **Node.js 18+** ([download](https://nodejs.org/))
- **npm** (included with Node.js)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/printer-status-report.git
cd printer-status-report

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
cp .env.example .env    # Configure your environment
npm install
cd ..

# Start both services (in separate terminals)
npm run dev             # Frontend on http://localhost:5175
cd backend && node server.js  # Backend on http://localhost:3001
```

### Environment Variables

Create `backend/.env` from `.env.example`:

```env
PORT=3001
NODE_ENV=development

# SMTP Configuration
SMTP_HOST=your-smtp-server
SMTP_PORT=25
SMTP_FROM=printer-monitor@yourcompany.com
ALERT_RECIPIENTS=admin@yourcompany.com

# JWT Secrets (auto-generated if not set)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### Default Login
- **Username**: `admin`
- **Password**: `admin123` (change after first login)

---

## Production Deployment (Windows Server)

### Offline Deployment

The system is designed for **air-gapped Windows Server** environments:

```bash
# On dev machine (macOS/Linux): build offline package
bash deploy/pack-offline.sh
```

This generates a `.zip` file containing everything needed:

1. Copy the `.zip` to the Windows Server
2. Extract to a directory (e.g., `C:\PrinterStatus`)
3. Ensure Node.js 18+ is installed
4. Right-click `install-service.bat` → **Run as Administrator**
5. Access at `http://server-ip:9191`

The installer uses **NSSM** to register Windows services that survive sign-out and reboot:
- `PrinterStatusBackend` (port 3001)
- `PrinterStatusFrontend` (port 9191)

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth` | User authentication |
| `GET/POST` | `/api/printers` | Printer management |
| `GET/POST` | `/api/settings` | System settings |
| `POST/GET` | `/api/reports` | Report generation |
| `GET/POST` | `/api/alerts` | Alert configuration |
| `GET` | `/api/jira/templates` | Jira ticket templates |
| `POST` | `/api/jira/tickets` | Create Jira tickets |
| `GET` | `/api/jira/issues` | Search Jira issues |
| `GET` | `/api/jira/pending-approvals` | Pending approval tickets |
| `POST` | `/api/jira/issues/:key/transition` | Execute ticket transition |
| `GET/POST/DELETE` | `/api/jira/comment-templates` | Comment templates |

---

## Screenshots

> Add screenshots of the main dashboard, Jira ticket creation, dark mode, etc.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- All user-facing text must use `t('key')` from react-i18next
- Add corresponding keys to both `src/i18n/locales/zh-CN.json` and `en.json`
- Follow existing code patterns and component structure

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Material UI](https://mui.com/) — React component library
- [Vite](https://vitejs.dev/) — Next-generation frontend tooling
- [NSSM](https://nssm.cc/) — Windows service manager
- [net-snmp](https://github.com/markabrahams/node-net-snmp) — SNMP protocol for Node.js
