# 打印服务监控系统

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README.zh-CN.md) [![繁體中文](https://img.shields.io/badge/lang-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-red)](README.zh-TW.md) [![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-orange)](README.ja.md) [![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-yellow)](README.ko.md) [![Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-purple)](README.fr.md) [![Deutsch](https://img.shields.io/badge/lang-Deutsch-green)](README.de.md) [![Español](https://img.shields.io/badge/lang-Espa%C3%B1ol-orange)](README.es.md)

一个功能完整的自托管 Web 应用，用于企业打印机队列管理、打印服务器监控、自动化报告生成、资产盘点追踪以及 Jira 工单集成。

基于 **React 18 + Material UI** 前端和 **Node.js + Express** 后端构建，支持中英文双语界面、暗色模式，以及 Windows Server 离线部署。

🌐 **门户地址**: [http://papercut001.example-corp.com.cn:9191/](http://papercut001.example-corp.com.cn:9191/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

---

## 功能特性

### 🖨️ 打印机监控
- 通过 **SNMP 协议** 实时监控打印机状态（墨粉余量、纸张状态、错误检测）
- **30 秒轮询间隔**，支持可配置的退避策略
- **多打印机支持**，每台打印机独立配置 IP/SNMP
- **状态历史追踪**，每日自动快照
- **维护模式**，可暂停特定打印机的监控

### 🖥️ 打印服务器监控
- 监控 Windows 打印服务器的 **CPU、内存、磁盘使用率**
- **运行时间追踪** 和状态历史记录
- **可视化仪表盘**，带颜色编码的健康状态指示
- **服务器配置管理**，支持增删改

### 📊 状态仪表盘
- 所有打印机和服务器的 **实时总览**
- **许可证管理** 及到期追踪
- **打印分析** 及每日使用图表（功能开关控制）

### 📧 自动化报告生成
- **定时周报** 自动通过邮件发送
- **5 种报告样式模板** 可选
- **HTML 邮件报告**，包含打印机状态表格
- **可配置收件人** 和发送时间
- **手动生成报告** 并即时预览

### 🔔 告警系统
- **墨粉不足告警**，阈值可配置（5% / 10%）
- **打印机离线告警**，邮件通知
- **打印服务器异常告警**
- **SMTP 邮件集成**，带重试机制
- 激活状态的告警指示器带 **呼吸闪烁动画**

### 📦 资产盘点
- **硬件资产追踪** 与管理
- **盘点会话管理**，支持定期审计
- **Excel 导出**（内置 ExcelJS，离线可用）

### 🎫 Jira 工单集成
- **模板化工单创建**，20+ 可配置模板
- **批量创建工单**，支持多个 Reporter
- **自动填充变量**：`{ntid}`、`{fullname}`、`{DATE_COMPACT}` 等
- **工单搜索**，渐进式前缀搜索（ISDS → TPX → CHG → ECSR）
- **待审批工单监控**，实时轮询
- **Service Desk 审批** 支持（ISDS 工单的 Approve/Decline）
- **快捷操作**：评论、Resolve、Close（自动填充 Internal Component）
- **评论模板**（所有用户共享，后端持久化存储）
- **模板管理**，使用频率排序 + 最近使用追踪

### 👥 用户管理
- **基于角色的访问控制**：管理员（Administrator）、编辑者（Editor）、查看者（Viewer）
- **JWT 认证** 及刷新令牌
- **用户资料管理**

### 🌐 国际化
- **双语界面**：英文和简体中文
- **实时语言切换**，无需刷新页面
- **所有界面文本** 通过 i18n 键值管理

### 🌙 暗色模式
- **完整暗色主题支持**，覆盖所有组件
- 基于 **CSS 变量** 的主题系统
- **一键切换**，偏好设置持久化

---

## 技术栈

### 前端
| 技术 | 用途 |
|---|---|
| React 18 | UI 框架 |
| Material UI 7 | 组件库 |
| Vite 7 | 构建工具 & 开发服务器 |
| Chart.js | 数据可视化 |
| i18next | 国际化 |
| Axios | HTTP 客户端 |
| react-hook-form | 表单管理 |

### 后端
| 技术 | 用途 |
|---|---|
| Node.js 18+ | 运行时 |
| Express 5 | Web 框架 |
| net-snmp | SNMP 打印机查询 |
| nodemailer | 邮件发送 |
| jsonwebtoken | JWT 认证 |
| bcryptjs | 密码哈希 |
| Puppeteer | 截图采集 |
| Tesseract.js | OCR 识别 |
| cheerio | HTML 解析 |

---

## 项目结构

```
├── src/                          # 前端源码
│   ├── components/               # React 组件
│   │   ├── StatusDashboard.jsx   # 状态监控仪表盘
│   │   ├── PrintServerDashboard.jsx  # 打印服务器仪表盘
│   │   ├── ReportForm.jsx        # 报告生成
│   │   ├── AlertSettings.jsx     # 告警设置
│   │   ├── JiraTickets.jsx       # Jira 工单集成
│   │   ├── AssetInventory.jsx    # 资产盘点
│   │   ├── SettingsPanel.jsx     # 系统设置
│   │   └── ...
│   ├── i18n/locales/             # 翻译文件
│   │   ├── en.json               # 英文
│   │   └── zh-CN.json            # 简体中文
│   ├── context/                  # React Context（全局状态）
│   ├── hooks/                    # 自定义 Hooks
│   ├── services/                 # 前端服务
│   └── theme/                    # 主题配置
├── backend/                      # 后端源码
│   ├── server.js                 # Express 服务器入口
│   ├── config/                   # 配置文件（JSON）
│   │   ├── printers.json         # 打印机定义
│   │   ├── printServers.json     # 打印服务器配置
│   │   ├── alertConfig.json      # 告警规则
│   │   ├── jiraTemplates.json    # Jira 工单模板
│   │   └── ...
│   ├── routes/                   # API 路由处理
│   ├── services/                 # 业务逻辑（16 个服务）
│   │   ├── printerMonitoringService.js   # 打印机监控
│   │   ├── printServerMonitoringService.js  # 服务器监控
│   │   ├── scheduledReportService.js     # 定时报告
│   │   ├── snmpService.js                # SNMP 查询
│   │   ├── jiraService.js                # Jira 集成
│   │   ├── emailService.js               # 邮件服务
│   │   └── ...
│   ├── middleware/               # 中间件（认证、校验、格式化）
│   └── utils/                    # 工具类（JWT 等）
├── deploy/                       # 部署脚本
│   ├── pack-offline.sh           # 离线包构建脚本
│   ├── install-service.bat       # Windows 服务安装脚本
│   ├── frontend-server.js        # 生产环境静态文件服务器
│   └── offline-package/          # 预构建部署包
└── public/                       # 静态资源
```

---

## 快速开始

### 环境要求
- **Node.js 18+**（[下载](https://nodejs.org/)）
- **npm**（随 Node.js 一起安装）

### 开发环境搭建

```bash
# 克隆仓库
git clone https://github.com/your-org/printer-status-report.git
cd printer-status-report

# 安装前端依赖
npm install

# 安装后端依赖
cd backend
cp .env.example .env    # 配置环境变量
npm install
cd ..

# 启动服务（在两个终端分别执行）
npm run dev             # 前端 http://localhost:5175
cd backend && node server.js  # 后端 http://localhost:3001
```

### 环境变量配置

从 `.env.example` 复制并修改 `backend/.env`：

```env
PORT=3001
NODE_ENV=development

# SMTP 邮件配置
SMTP_HOST=your-smtp-server
SMTP_PORT=25
SMTP_FROM=printer-monitor@yourcompany.com
ALERT_RECIPIENTS=admin@yourcompany.com

# JWT 密钥（不设置则自动生成）
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### 默认登录
- **用户名**：`admin`
- **密码**：`admin123`（请在首次登录后修改）

---

## 生产部署（Windows Server）

### 离线部署

系统专为 **无外网的 Windows Server** 环境设计：

```bash
# 在开发机（macOS/Linux）上构建离线包
bash deploy/pack-offline.sh
```

生成的 `.zip` 文件包含运行所需的一切：

1. 将 `.zip` 复制到 Windows Server
2. 解压到目标目录（如 `C:\PrinterStatus`）
3. 确保已安装 Node.js 18+
4. 右键 `install-service.bat` → **以管理员身份运行**
5. 访问 `http://服务器IP:9191`

安装脚本使用 **NSSM** 注册 Windows 服务，登出或重启后仍持续运行：
- `PrinterStatusBackend`（端口 3001）
- `PrinterStatusFrontend`（端口 9191）

---

## API 概览

| 方法 | 端点 | 说明 |
|---|---|---|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/auth` | 用户认证 |
| `GET/POST` | `/api/printers` | 打印机管理 |
| `GET/POST` | `/api/settings` | 系统设置 |
| `POST/GET` | `/api/reports` | 报告生成 |
| `GET/POST` | `/api/alerts` | 告警配置 |
| `GET` | `/api/jira/templates` | Jira 工单模板 |
| `POST` | `/api/jira/tickets` | 创建 Jira 工单 |
| `GET` | `/api/jira/issues` | 搜索 Jira 工单 |
| `GET` | `/api/jira/pending-approvals` | 待审批工单 |
| `POST` | `/api/jira/issues/:key/transition` | 执行工单操作 |
| `GET/POST/DELETE` | `/api/jira/comment-templates` | 评论模板管理 |

---

## 截图预览

> 待添加：主仪表盘、Jira 工单创建、暗色模式等截图

---

## 参与贡献

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送分支（`git push origin feature/amazing-feature`）
5. 提交 Pull Request

### 开发规范
- 所有用户可见文本必须使用 `t('key')` 调用 react-i18next
- 同时在 `src/i18n/locales/zh-CN.json` 和 `en.json` 中添加对应键值
- 遵循现有代码风格和组件结构

---

## 许可证

本项目基于 MIT 许可证开源 — 详见 [LICENSE](LICENSE) 文件。

---

## 致谢

- [Material UI](https://mui.com/) — React 组件库
- [Vite](https://vitejs.dev/) — 新一代前端构建工具
- [NSSM](https://nssm.cc/) — Windows 服务管理器
- [net-snmp](https://github.com/markabrahams/node-net-snmp) — Node.js SNMP 协议库
