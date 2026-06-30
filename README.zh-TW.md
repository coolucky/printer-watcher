# 列印服務監控系統

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README.zh-CN.md) [![繁體中文](https://img.shields.io/badge/lang-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-red)](README.zh-TW.md) [![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-orange)](README.ja.md) [![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-yellow)](README.ko.md) [![Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-purple)](README.fr.md) [![Deutsch](https://img.shields.io/badge/lang-Deutsch-green)](README.de.md) [![Español](https://img.shields.io/badge/lang-Espa%C3%B1ol-orange)](README.es.md)

一個功能完整、可自行託管的網頁應用程式，用於企業印表機設備管理、列印伺服器監控、自動化報告生成、資產盤點追蹤及 Jira 工單整合。

採用 **React 18 + Material UI** 前端和 **Node.js + Express** 後端架構，支援雙語介面（English / 简体中文）、深色模式以及 Windows Server 離線部署。

🌐 **Portal**: [http://papercut001.example-corp.com.cn:9191/](http://papercut001.example-corp.com.cn:9191/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

---

## 功能特色

### 🖨️ 印表機監控
- **即時狀態監控**，透過 SNMP 協定（碳粉量、紙張狀態、錯誤偵測）
- **30 秒輪詢間隔**，可設定退避策略
- **多台印表機支援**，可個別配置 IP/SNMP
- **狀態歷史追蹤**，每日快照記錄
- **維護模式**，可暫停特定印表機的監控

### 🖥️ 列印伺服器監控
- **CPU、記憶體、磁碟使用率**監控 Windows 列印伺服器
- **運行時間追蹤**及狀態歷史
- **視覺化儀表板**，以色彩標示健康狀態
- **伺服器設定管理**，支援新增/編輯/刪除

### 📊 狀態儀表板
- **即時總覽**，所有印表機和伺服器一目瞭然
- **授權管理**，到期追蹤
- **列印分析**，每日使用量圖表（功能開關控制）

### 📧 自動報告生成
- **排程週報**，透過電子郵件寄送
- **5 種報告樣式範本**可供選擇
- **HTML 電子郵件報告**，包含印表機狀態表格
- **可設定收件人**及排程時間
- **手動生成報告**，即時預覽

### 🔔 告警系統
- **碳粉不足告警**，可設定閾值（5% / 10%）
- **印表機離線告警**，透過電子郵件通知
- **列印伺服器錯誤告警**
- **SMTP 電子郵件整合**，具重試機制
- **呼吸動畫效果**，用於活動告警指示器

### 📦 資產盤點
- **硬體資產追蹤**與管理
- **盤點會話管理**，用於定期稽核
- **Excel 匯出**支援（內建 ExcelJS，適用離線環境）

### 🎫 Jira 工單整合
- **範本化工單建立**，20+ 可設定範本
- **批次建立工單**，支援多位申報人
- **自動填入變數**：`{ntid}`、`{fullname}`、`{DATE_COMPACT}` 等
- **工單搜尋**，支援漸進式前綴搜尋（ISDS → TPX → CHG → ECSR）
- **待審批監控**，即時輪詢
- **服務台審批**支援（ISDS 工單的核准/駁回）
- **快速操作**：評論、解決、關閉，自動填入 Internal Component
- **評論範本**（跨使用者共用，後端持久化）
- **範本管理**，依使用頻率排序並追蹤最近使用

### 👥 使用者管理
- **基於角色的存取控制**：管理員、編輯者、檢視者
- **JWT 驗證**，支援 Refresh Token
- **使用者個人資料管理**

### 🌐 國際化
- **雙語介面**：英文和簡體中文
- **即時切換語言**，無需重新載入頁面
- **所有介面文字**透過 i18n 鍵值管理

### 🌙 深色模式
- **完整深色主題支援**，涵蓋所有元件
- **基於 CSS 變數的主題設計**，確保風格一致
- **一鍵切換**，偏好設定自動保存

---

## 技術架構

### 前端
| 技術 | 用途 |
|---|---|
| React 18 | UI 框架 |
| Material UI 7 | 元件庫 |
| Vite 7 | 建置工具與開發伺服器 |
| Chart.js | 資料視覺化 |
| i18next | 國際化 |
| Axios | HTTP 用戶端 |
| react-hook-form | 表單管理 |

### 後端
| 技術 | 用途 |
|---|---|
| Node.js 18+ | 執行環境 |
| Express 5 | 網頁框架 |
| net-snmp | SNMP 印表機查詢 |
| nodemailer | 電子郵件寄送 |
| jsonwebtoken | JWT 驗證 |
| bcryptjs | 密碼雜湊 |
| Puppeteer | 螢幕截圖擷取 |
| Tesseract.js | OCR 辨識處理 |
| cheerio | HTML 解析 |

---

## 專案結構

```
├── src/                          # 前端原始碼
│   ├── components/               # React 元件
│   │   ├── StatusDashboard.jsx   # 主監控儀表板
│   │   ├── PrintServerDashboard.jsx
│   │   ├── ReportForm.jsx        # 報告生成
│   │   ├── AlertSettings.jsx     # 告警設定
│   │   ├── JiraTickets.jsx       # Jira 整合
│   │   ├── AssetInventory.jsx    # 資產追蹤
│   │   ├── SettingsPanel.jsx     # 系統設定
│   │   └── ...
│   ├── i18n/locales/             # 翻譯檔案
│   │   ├── en.json               # 英文
│   │   └── zh-CN.json            # 簡體中文
│   ├── context/                  # React Context（全域狀態）
│   ├── hooks/                    # 自訂 Hooks
│   ├── services/                 # 前端服務
│   └── theme/                    # 主題設定
├── backend/                      # 後端原始碼
│   ├── server.js                 # Express 伺服器入口
│   ├── config/                   # 設定檔（JSON）
│   │   ├── printers.json         # 印表機定義
│   │   ├── printServers.json     # 列印伺服器設定
│   │   ├── alertConfig.json      # 告警規則
│   │   ├── jiraTemplates.json    # Jira 工單範本
│   │   └── ...
│   ├── routes/                   # API 路由處理器
│   ├── services/                 # 業務邏輯（16 個服務）
│   │   ├── printerMonitoringService.js
│   │   ├── printServerMonitoringService.js
│   │   ├── scheduledReportService.js
│   │   ├── snmpService.js
│   │   ├── jiraService.js
│   │   ├── emailService.js
│   │   └── ...
│   ├── middleware/               # 驗證、校驗、格式化
│   └── utils/                    # JWT、工具函式
├── deploy/                       # 部署腳本
│   ├── pack-offline.sh           # 離線套件建置器
│   ├── install-service.bat       # Windows 服務安裝器
│   ├── frontend-server.js        # 生產環境靜態伺服器
│   └── offline-package/          # 預建置部署套件
└── public/                       # 靜態資源
```

---

## 快速開始

### 先決條件
- **Node.js 18+**（[下載](https://nodejs.org/)）
- **npm**（隨 Node.js 安裝）

### 開發環境設定

```bash
# 複製儲存庫
git clone https://github.com/your-org/printer-status-report.git
cd printer-status-report

# 安裝前端依賴
npm install

# 安裝後端依賴
cd backend
cp .env.example .env    # 設定您的環境變數
npm install
cd ..

# 啟動兩個服務（分別在不同終端機）
npm run dev             # 前端：http://localhost:5175
cd backend && node server.js  # 後端：http://localhost:3001
```

### 環境變數

從 `.env.example` 建立 `backend/.env`：

```env
PORT=3001
NODE_ENV=development

# SMTP 設定
SMTP_HOST=your-smtp-server
SMTP_PORT=25
SMTP_FROM=printer-monitor@yourcompany.com
ALERT_RECIPIENTS=admin@yourcompany.com

# JWT 金鑰（未設定時自動生成）
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### 預設登入
- **使用者名稱**：`admin`
- **密碼**：`admin123`（首次登入後請變更）

---

## 生產環境部署（Windows Server）

### 離線部署

本系統專為**離線 Windows Server** 環境設計：

```bash
# 在開發機器上（macOS/Linux）：建置離線套件
bash deploy/pack-offline.sh
```

此操作會生成一個包含所有必要檔案的 `.zip` 檔案：

1. 將 `.zip` 複製到 Windows Server
2. 解壓縮至目錄（例如 `C:\PrinterStatus`）
3. 確認已安裝 Node.js 18+
4. 右鍵點擊 `install-service.bat` → **以系統管理員身分執行**
5. 透過 `http://server-ip:9191` 存取

安裝程式使用 **NSSM** 註冊 Windows 服務，可在登出及重新開機後保持運作：
- `PrinterStatusBackend`（連接埠 3001）
- `PrinterStatusFrontend`（連接埠 9191）

---

## API 概覽

| 方法 | 端點 | 說明 |
|---|---|---|
| `GET` | `/api/health` | 健康檢查 |
| `POST` | `/api/auth` | 使用者驗證 |
| `GET/POST` | `/api/printers` | 印表機管理 |
| `GET/POST` | `/api/settings` | 系統設定 |
| `POST/GET` | `/api/reports` | 報告生成 |
| `GET/POST` | `/api/alerts` | 告警設定 |
| `GET` | `/api/jira/templates` | Jira 工單範本 |
| `POST` | `/api/jira/tickets` | 建立 Jira 工單 |
| `GET` | `/api/jira/issues` | 搜尋 Jira 問題 |
| `GET` | `/api/jira/pending-approvals` | 待審批工單 |
| `POST` | `/api/jira/issues/:key/transition` | 執行工單轉換 |
| `GET/POST/DELETE` | `/api/jira/comment-templates` | 評論範本 |

---

## 截圖

> 新增主儀表板、Jira 工單建立、深色模式等截圖。

---

## 參與貢獻

1. Fork 此儲存庫
2. 建立功能分支（`git checkout -b feature/amazing-feature`）
3. 提交您的變更（`git commit -m 'Add amazing feature'`）
4. 推送至分支（`git push origin feature/amazing-feature`）
5. 開啟 Pull Request

### 開發準則
- 所有面向使用者的文字必須使用 react-i18next 的 `t('key')`
- 在 `src/i18n/locales/zh-CN.json` 和 `en.json` 中新增對應的鍵值
- 遵循現有的程式碼風格和元件結構

---

## 授權條款

本專案採用 MIT 授權條款 — 詳見 [LICENSE](LICENSE) 檔案。

---

## 致謝

- [Material UI](https://mui.com/) — React 元件庫
- [Vite](https://vitejs.dev/) — 新世代前端工具
- [NSSM](https://nssm.cc/) — Windows 服務管理工具
- [net-snmp](https://github.com/markabrahams/node-net-snmp) — Node.js SNMP 協定
