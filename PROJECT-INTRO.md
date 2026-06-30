# Print Service Monitoring System
# 打印服务监控系统 - 项目介绍

---

## 1. 项目概述

Print Service Monitoring System 是一套企业级打印设备监控平台，用于实时监控多站点打印机和打印服务器的运行状态，提供故障告警、周报生成、资产盘点等功能。系统采用 B/S 架构，支持 Windows Server 离线部署，面向 IT 运维团队日常使用。

**适用场景：**
- 多办公地点（Beijing / Shanghai / Shenzhen）的打印机集中管理
- 打印机墨粉余量、纸张状态、故障告警的自动化监控
- 打印服务器健康状态追踪
- IT 资产盘点（库房 + 现役设备）

---

## 2. 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Chrome)                   │
│              React 18 + MUI 7 + Vite 7               │
├─────────────────────────────────────────────────────┤
│                    Vite Dev / Nginx                   │
│              Port 9191 (prod) / 5175 (dev)           │
├─────────────────────────────────────────────────────┤
│                  Node.js + Express 5                  │
│                    Port 3001                          │
│  ┌───────────┐  ┌────────────┐  ┌────────────────┐ │
│  │ SNMP 轮询 │  │ Email 告警 │  │ JWT 认证       │ │
│  │ (30s间隔) │  │ (SMTP)     │  │ (bcrypt+token) │ │
│  └───────────┘  └────────────┘  └────────────────┘ │
├─────────────────────────────────────────────────────┤
│              JSON File Storage (无数据库)             │
│    printers.json / settings.json / alertConfig.json  │
└─────────────────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
    │ Beijing │   │Shanghai │   │Shenzhen │
    │ Printers│   │ Printers│   │ Printers│
    └─────────┘   └─────────┘   └─────────┘
```

**技术栈：**

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + Vite 7 + MUI 7 | SPA，Material Design 风格 |
| 国际化 | i18next | 支持中英文切换 |
| 图表 | Chart.js 4.5 | 墨粉趋势、服务器时间线 |
| 后端 | Node.js + Express 5 | REST API + 后台监控服务 |
| 监控 | net-snmp | SNMP v2c 协议读取打印机状态 |
| 认证 | JWT + bcryptjs | Token 自动刷新 |
| 邮件 | Nodemailer | SMTP 告警通知 |
| 部署 | NSSM + Windows Service | 注销不停止、开机自启 |
| 存储 | JSON 文件 | 轻量级，无需数据库 |

---

## 3. 功能模块

### 3.1 设备管理 (Devices Management)
- 打印机 CRUD（IP、序列号、资产标签、机型、位置）
- 打印服务器管理（多站点）
- 维护模式（暂停监控某设备）

### 3.2 状态监控 (Status Monitoring)
- **实时仪表盘**：在线/离线/警告/错误设备统计
- **SNMP 轮询**：每 30 秒自动采集墨粉余量、纸张状态、页面计数
- **打印服务器时间线**：24h 可用性可视化
- **状态快照**：定时保存历史状态用于趋势分析

### 3.3 告警设置 (Alert Settings)
- 打印机离线告警（邮件通知）
- 低墨粉告警（5% / 10% 阈值可选）
- 打印机故障告警（卡纸、缺纸、门开启等）
- 打印服务器离线告警
- 去重机制（相同告警 10 分钟内不重复发送）
- 恢复通知（设备恢复在线时通知）

### 3.4 报告生成 (Report Generation)
- 每周自动生成打印机状态报告
- 手动生成并发送邮件
- 包含墨粉趋势、故障统计、设备健康评分

### 3.5 资产盘点 (Asset Inventory)
- **库房盘点模式**：上传基准表 → 选择货架 → 扫码比对
- **现役盘点模式**：扫码 → 确认位置 → 生成差异报告
- USB 扫码枪兼容（焦点守卫 + 自动触发）
- 多人协作（多盘点人员切换）
- 差异报告导出 Excel/PDF

### 3.6 系统设置 & 用户管理
- 邮件服务器配置（SMTP）
- 用户角色管理（管理员/普通用户）
- License 有效期管理
- 暗色/亮色主题切换

---

## 4. 部署架构

### 开发环境
```bash
# 前端 (端口 5175)
npm run dev

# 后端 (端口 3001)
cd backend && node server.js
```

### 生产环境 (Windows Server)
```
C:\PrinterStatus\
├── dist/                 # 前端构建文件
├── backend/              # 后端应用 + node_modules
├── frontend-server.js    # 前端静态服务 (端口 9191)
├── install-service.bat   # ★ 一键安装为 Windows 系统服务
├── uninstall-service.bat # 卸载服务
├── nssm.exe              # 服务管理器
└── logs/                 # 运行日志
```

**服务持久化方案：**
- 使用 NSSM 注册为 Windows 系统服务（LocalSystem 账户）
- 用户注销后服务持续运行
- 系统重启后自动启动
- 崩溃后自动重启（sc failure 策略）

**访问方式：** `http://服务器IP:9191`

---

## 5. 监控协议

| 数据项 | 协议 | OID/方法 | 频率 |
|--------|------|----------|------|
| 在线状态 | ICMP Ping | - | 30s |
| 墨粉余量 | SNMP v2c | prtMarkerSuppliesLevel | 30s |
| 纸张状态 | SNMP v2c | prtInputStatus | 30s |
| 页面计数 | SNMP v2c | prtMarkerLifeCount | 30s |
| 打印机错误 | SNMP v2c | hrPrinterDetectedErrorState | 30s |
| 打印服务器 | HTTP/Ping | 自定义 API | 30s |

---

## 6. 安全设计

- **认证**：JWT Token（1h 过期，自动刷新）
- **密码**：bcrypt 哈希存储（salt rounds: 10）
- **传输**：SMTP 支持 TLSv1.2+
- **输入**：DOMPurify HTML 清洗 + 参数校验中间件
- **限流**：API rate limiting
- **部署**：仅内网访问，不暴露公网

---

## 7. 项目亮点

1. **零数据库依赖**：JSON 文件存储，部署简单，无需安装 MySQL/PostgreSQL
2. **离线部署**：一个 zip 包 + 一键 bat 脚本，适合内网 Windows Server
3. **多协议监控**：SNMP + Ping + HTTP + OCR，覆盖不同厂商设备
4. **企业级告警**：分级告警 + 去重 + 恢复通知 + 邮件重试机制
5. **资产盘点集成**：USB 扫码枪 + Excel 导入导出，IT 运维一站式平台
6. **国际化**：中英文完整支持，适合跨国团队
7. **暗色主题**：支持 Dark Mode，适合 NOC 监控场景

---

## 8. 目录结构

```
printer-status-report/
├── src/                    # 前端源码 (React)
│   ├── components/         # UI 组件
│   ├── context/            # 全局状态
│   ├── hooks/              # 自定义 Hooks
│   └── services/           # API 调用封装
├── public/
│   └── asset-inventory/    # 资产盘点模块 (独立 JS)
├── backend/                # 后端源码
│   ├── routes/             # API 路由
│   ├── services/           # 业务逻辑
│   ├── middleware/         # 认证、校验、响应格式
│   ├── config/             # 数据文件 (JSON)
│   └── utils/              # 工具函数
├── deploy/                 # 部署相关
│   ├── pack-offline.sh     # 离线包打包脚本
│   ├── install-service.bat # Windows 服务安装
│   └── offline-package/    # 打包输出目录
└── package.json
```

---

## 9. 当前监控设备

| 设备名 | IP | 型号 | 位置 |
|--------|-----|------|------|
| Beijing_12A | 10.128.20.6 | Fujifilm Apeos C5570 | 12A |
| Beijing_12B | 10.128.21.6 | Fujifilm Apeos C5570 | 12B |
| Shanghai_26A | 10.132.20.6 | Fujifilm Apeos C5570 | 26A |
| Shenzhen_18F | 10.136.9.6 | Fujifilm Apeos C5570 | 18F |

---

## 10. 后续规划

- 接入更多站点打印机
- 打印量统计与成本分析
- 移动端适配（手机查看状态）
- 告警升级机制（超时未处理自动升级通知对象）
