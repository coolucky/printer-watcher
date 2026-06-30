# Sistema de Monitoreo de Servicio de Impresión

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README.zh-CN.md) [![繁體中文](https://img.shields.io/badge/lang-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-red)](README.zh-TW.md) [![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-orange)](README.ja.md) [![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-yellow)](README.ko.md) [![Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-purple)](README.fr.md) [![Deutsch](https://img.shields.io/badge/lang-Deutsch-green)](README.de.md) [![Español](https://img.shields.io/badge/lang-Espa%C3%B1ol-orange)](README.es.md)

Una aplicación web completa y auto-alojada para la gestión de flotas de impresoras empresariales, monitoreo de servidores de impresión, generación automatizada de informes, seguimiento de inventario de activos e integración con tickets de Jira.

Desarrollada con frontend **React 18 + Material UI** y backend **Node.js + Express**, con soporte para interfaz bilingüe (English / 简体中文), modo oscuro y despliegue sin conexión en Windows Server.

🌐 **Portal**: [http://papercut001.example-corp.com.cn:9191/](http://papercut001.example-corp.com.cn:9191/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

---

## Características

### 🖨️ Monitoreo de impresoras
- **Monitoreo de estado en tiempo real** mediante protocolo SNMP (niveles de tóner, estado del papel, detección de errores)
- **Intervalo de sondeo de 30 segundos** con retroceso configurable
- **Soporte multi-impresora** con configuración IP/SNMP individual
- **Seguimiento del historial de estados** con instantáneas diarias
- **Modo de mantenimiento** para pausar el monitoreo de impresoras específicas

### 🖥️ Monitoreo de servidores de impresión
- **Uso de CPU, memoria, disco** monitoreo de servidores de impresión Windows
- **Seguimiento del tiempo de actividad** e historial de estados
- **Panel visual** con indicadores de salud codificados por colores
- **Gestión de configuración de servidores** con agregar/editar/eliminar

### 📊 Panel de estado
- **Vista general en vivo** de todas las impresoras y servidores en una sola vista
- **Gestión de licencias** con seguimiento de vencimiento
- **Análisis de impresión** con gráficos de uso diario (controlado por indicador de función)

### 📧 Generación automatizada de informes
- **Informes semanales programados** con envío por correo electrónico
- **5 plantillas de estilo de informe** para elegir
- **Informes por correo HTML** con tablas de estado de impresoras
- **Destinatarios configurables** y programación horaria
- **Generación manual de informes** con vista previa instantánea

### 🔔 Sistema de alertas
- **Alertas de tóner bajo** con umbral configurable (5% / 10%)
- **Alertas de impresora fuera de línea** con notificaciones por correo electrónico
- **Alertas de error del servidor de impresión**
- **Integración de correo SMTP** con mecanismo de reintento
- **Animación de respiración** en indicadores de alerta activos

### 📦 Inventario de activos
- **Seguimiento de activos de hardware** y gestión
- **Gestión de sesiones de inventario** para auditorías periódicas
- **Exportación a Excel** compatible (ExcelJS incluido para uso sin conexión)

### 🎫 Integración con tickets de Jira
- **Creación de tickets basada en plantillas** con más de 20 plantillas configurables
- **Creación de tickets por lotes** para múltiples informantes
- **Variables de auto-llenado**: `{ntid}`, `{fullname}`, `{DATE_COMPACT}`, etc.
- **Búsqueda de tickets** con búsqueda progresiva por prefijo (ISDS → TPX → CHG → ECSR)
- **Monitoreo de aprobaciones pendientes** con sondeo en tiempo real
- **Aprobación del Service Desk** compatible (Aprobar/Rechazar para tickets ISDS)
- **Acciones rápidas**: Comentar, Resolver, Cerrar con componente interno auto-completado
- **Plantillas de comentarios** (compartidas entre usuarios, persistidas en el servidor)
- **Gestión de plantillas** con ordenamiento por frecuencia de uso y seguimiento de uso reciente

### 👥 Gestión de usuarios
- **Control de acceso basado en roles**: Administrador, Editor, Visor
- **Autenticación JWT** con tokens de actualización
- **Gestión de perfil de usuario**

### 🌐 Internacionalización
- **Interfaz bilingüe**: inglés y chino simplificado
- **Cambio de idioma en tiempo real** sin recargar la página
- **Todo el texto de la interfaz** gestionado mediante claves i18n

### 🌙 Modo oscuro
- **Soporte completo de tema oscuro** en todos los componentes
- **Tematización basada en variables CSS** para un estilo consistente
- **Cambio con un clic** con persistencia de preferencias

---

## Stack tecnológico

### Frontend
| Tecnología | Propósito |
|---|---|
| React 18 | Framework de UI |
| Material UI 7 | Biblioteca de componentes |
| Vite 7 | Herramienta de compilación y servidor de desarrollo |
| Chart.js | Visualización de datos |
| i18next | Internacionalización |
| Axios | Cliente HTTP |
| react-hook-form | Gestión de formularios |

### Backend
| Tecnología | Propósito |
|---|---|
| Node.js 18+ | Entorno de ejecución |
| Express 5 | Framework web |
| net-snmp | Consultas SNMP a impresoras |
| nodemailer | Envío de correo electrónico |
| jsonwebtoken | Autenticación JWT |
| bcryptjs | Hash de contraseñas |
| Puppeteer | Captura de pantalla |
| Tesseract.js | Procesamiento OCR |
| cheerio | Análisis de HTML |

---

## Estructura del proyecto

```
├── src/                          # Código fuente del frontend
│   ├── components/               # Componentes React
│   │   ├── StatusDashboard.jsx   # Panel de monitoreo principal
│   │   ├── PrintServerDashboard.jsx
│   │   ├── ReportForm.jsx        # Generación de informes
│   │   ├── AlertSettings.jsx     # Configuración de alertas
│   │   ├── JiraTickets.jsx       # Integración con Jira
│   │   ├── AssetInventory.jsx    # Seguimiento de activos
│   │   ├── SettingsPanel.jsx     # Configuración del sistema
│   │   └── ...
│   ├── i18n/locales/             # Archivos de traducción
│   │   ├── en.json               # Inglés
│   │   └── zh-CN.json            # Chino simplificado
│   ├── context/                  # React Context (estado global)
│   ├── hooks/                    # Hooks personalizados
│   ├── services/                 # Servicios del frontend
│   └── theme/                    # Configuración del tema
├── backend/                      # Código fuente del backend
│   ├── server.js                 # Punto de entrada del servidor Express
│   ├── config/                   # Archivos de configuración (JSON)
│   │   ├── printers.json         # Definiciones de impresoras
│   │   ├── printServers.json     # Configuraciones de servidores de impresión
│   │   ├── alertConfig.json      # Reglas de alerta
│   │   ├── jiraTemplates.json    # Plantillas de tickets de Jira
│   │   └── ...
│   ├── routes/                   # Manejadores de rutas API
│   ├── services/                 # Lógica de negocio (16 servicios)
│   │   ├── printerMonitoringService.js
│   │   ├── printServerMonitoringService.js
│   │   ├── scheduledReportService.js
│   │   ├── snmpService.js
│   │   ├── jiraService.js
│   │   ├── emailService.js
│   │   └── ...
│   ├── middleware/               # Autenticación, validación, formateo
│   └── utils/                    # JWT, utilidades
├── deploy/                       # Scripts de despliegue
│   ├── pack-offline.sh           # Constructor de paquete sin conexión
│   ├── install-service.bat       # Instalador de servicio de Windows
│   ├── frontend-server.js        # Servidor estático de producción
│   └── offline-package/          # Paquete de despliegue pre-construido
└── public/                       # Recursos estáticos
```

---

## Primeros pasos

### Requisitos previos
- **Node.js 18+** ([descargar](https://nodejs.org/))
- **npm** (incluido con Node.js)

### Configuración del entorno de desarrollo

```bash
# Clonar el repositorio
git clone https://github.com/your-org/printer-status-report.git
cd printer-status-report

# Instalar dependencias del frontend
npm install

# Instalar dependencias del backend
cd backend
cp .env.example .env    # Configure su entorno
npm install
cd ..

# Iniciar ambos servicios (en terminales separados)
npm run dev             # Frontend en http://localhost:5175
cd backend && node server.js  # Backend en http://localhost:3001
```

### Variables de entorno

Cree `backend/.env` a partir de `.env.example`:

```env
PORT=3001
NODE_ENV=development

# Configuración SMTP
SMTP_HOST=your-smtp-server
SMTP_PORT=25
SMTP_FROM=printer-monitor@yourcompany.com
ALERT_RECIPIENTS=admin@yourcompany.com

# Secretos JWT (auto-generados si no se establecen)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### Inicio de sesión predeterminado
- **Nombre de usuario**: `admin`
- **Contraseña**: `admin123` (cambiar después del primer inicio de sesión)

---

## Despliegue en producción (Windows Server)

### Despliegue sin conexión

El sistema está diseñado para entornos **Windows Server aislados**:

```bash
# En la máquina de desarrollo (macOS/Linux): construir el paquete sin conexión
bash deploy/pack-offline.sh
```

Esto genera un archivo `.zip` que contiene todo lo necesario:

1. Copie el `.zip` al Windows Server
2. Extraiga en un directorio (p. ej. `C:\PrinterStatus`)
3. Asegúrese de que Node.js 18+ esté instalado
4. Haga clic derecho en `install-service.bat` → **Ejecutar como administrador**
5. Acceda en `http://server-ip:9191`

El instalador utiliza **NSSM** para registrar servicios de Windows que sobreviven al cierre de sesión y reinicio:
- `PrinterStatusBackend` (puerto 3001)
- `PrinterStatusFrontend` (puerto 9191)

---

## Resumen de la API

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Verificación de salud |
| `POST` | `/api/auth` | Autenticación de usuario |
| `GET/POST` | `/api/printers` | Gestión de impresoras |
| `GET/POST` | `/api/settings` | Configuración del sistema |
| `POST/GET` | `/api/reports` | Generación de informes |
| `GET/POST` | `/api/alerts` | Configuración de alertas |
| `GET` | `/api/jira/templates` | Plantillas de tickets de Jira |
| `POST` | `/api/jira/tickets` | Crear tickets de Jira |
| `GET` | `/api/jira/issues` | Buscar incidencias de Jira |
| `GET` | `/api/jira/pending-approvals` | Tickets pendientes de aprobación |
| `POST` | `/api/jira/issues/:key/transition` | Ejecutar transición de ticket |
| `GET/POST/DELETE` | `/api/jira/comment-templates` | Plantillas de comentarios |

---

## Capturas de pantalla

> Agregue capturas de pantalla del panel principal, creación de tickets de Jira, modo oscuro, etc.

---

## Contribuir

1. Haga un fork del repositorio
2. Cree una rama de funcionalidad (`git checkout -b feature/amazing-feature`)
3. Confirme sus cambios (`git commit -m 'Add amazing feature'`)
4. Suba la rama (`git push origin feature/amazing-feature`)
5. Abra un Pull Request

### Directrices de desarrollo
- Todo texto orientado al usuario debe usar `t('key')` de react-i18next
- Agregue las claves correspondientes tanto en `src/i18n/locales/zh-CN.json` como en `en.json`
- Siga los patrones de código y la estructura de componentes existentes

---

## Licencia

Este proyecto está licenciado bajo la Licencia MIT — consulte el archivo [LICENSE](LICENSE) para más detalles.

---

## Agradecimientos

- [Material UI](https://mui.com/) — Biblioteca de componentes React
- [Vite](https://vitejs.dev/) — Herramientas de frontend de próxima generación
- [NSSM](https://nssm.cc/) — Gestor de servicios de Windows
- [net-snmp](https://github.com/markabrahams/node-net-snmp) — Protocolo SNMP para Node.js
