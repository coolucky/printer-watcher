# Windows Server 离线部署指南

## 概述

本指南用于将打印机状态报告服务部署到无法连接互联网的 Windows Server 上。

## 前提条件

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows Server 2016+ / Windows 10+ |
| Node.js | v18.x 或 v20.x LTS (x64) |
| 内存 | 最少 512MB 可用 |
| 磁盘 | 至少 500MB 可用空间 |
| 网络 | 能访问内网打印机和打印服务器 |

## 部署步骤

### 第一步：在开发机上打包（需要网络）

```bash
cd printer-status-report/deploy
chmod +x pack-offline.sh
./pack-offline.sh
```

这会生成 `deploy/printer-status-report-offline-YYYYMMDD.zip`。

### 第二步：准备 Node.js

如果目标服务器没有 Node.js：

1. 在有网络的机器上下载 Node.js 免安装版 (zip)：
   - <https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip>
2. 将 zip 文件放入部署包根目录，启动脚本会自动解压安装。
3. 或者手动解压到部署目录下的 `nodejs/` 子目录。

### 第三步：传输到目标服务器

通过 U 盘、内网共享等方式将以下文件传输到 Windows Server：

- `printer-status-report-offline-YYYYMMDD.zip`
- `node-v20.x-win-x64.zip`（如服务器无 Node.js）

### 第四步：部署

1. 在 Windows Server 上解压 `printer-status-report-offline-YYYYMMDD.zip` 到目标目录，例如：

```text
C:\PrinterStatus\
```

2. 如需安装 Node.js，将 `node-v20.x-win-x64.zip` 放到 `C:\PrinterStatus\` 目录下。
3. 以管理员身份运行 `install-service.bat`（推荐，生产模式）：

```cmd
cd C:\PrinterStatus
install-service.bat
```

4. 如仅需临时调试（会话模式，注销后停止），运行：

```cmd
cd C:\PrinterStatus
start-service.bat --debug
```

## 目录结构

```text
C:\PrinterStatus\
├── install-service.bat    # 安装为 Windows 服务（推荐）
├── uninstall-service.bat  # 卸载 Windows 服务
├── start-service.bat      # 调试会话启动（非持久化）
├── stop-service.bat       # 停止服务/调试进程
├── restart-service.bat    # 重启服务
├── setup-autostart.bat    # 任务计划程序备选
├── frontend-server.js     # 前端服务
├── nssm.exe               # 服务管理工具
├── dist/                  # 前端构建文件
├── backend/               # 后端服务
│   ├── server.js
│   ├── node_modules/      # 后端依赖（已预装）
│   ├── routes/
│   ├── services/
│   └── config/
├── nodejs/                # Node.js 免安装版（可选）
├── logs/                  # 日志目录（自动创建）
├── settings.json          # 应用设置
└── OFFLINE-PACKAGE-VALIDATION.txt  # 打包验收报告
```

## 端口说明

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| 前端 | 9191 | 生产固定端口 |
| 后端 | 3001 | API 服务端口 |

## 使用方法

### 生产模式（推荐）

```cmd
install-service.bat
```

### 调试模式（非持久化）

```cmd
start-service.bat --debug
start-service.bat --debug 8080
```

## 离线包验收（推荐）

在部署目录执行以下命令，可对离线包关键内容做自动验收：

```bash
./validate-offline-package.sh ./offline-package ./printer-status-report-offline-YYYYMMDD.zip
```

验收结果会写入：

- `offline-package/OFFLINE-PACKAGE-VALIDATION.txt`

## 注销不停服与开机自启

### 方法一：安装为 Windows 服务（推荐）

使用 NSSM 将前后端注册为 Windows 服务，注销登录后服务继续运行，且开机自动启动。

```cmd
cd C:\PrinterStatus
install-service.bat
```

特点：

- 注销用户登录后服务不会停止。
- 系统重启后自动启动。
- 可在 services.msc 中管理服务状态。
- 前端服务依赖后端服务，确保启动顺序。

### 方法二：任务计划程序兜底（备选）

适用于已经通过 `install-service.bat` 安装了 NSSM 服务，但希望增加“开机后再次执行一次服务启动命令”作为兜底。

```cmd
cd C:\PrinterStatus
setup-autostart.bat
```

说明：

- 该脚本不会再调用 `start-service.bat`（会话模式）。
- 该脚本会创建一个 SYSTEM 开机任务，延迟后执行 `sc start PrinterStatusBackend` 和 `sc start PrinterStatusFrontend`。
- 主要用于增强重启后的可靠性，尤其是系统启动初期服务依赖尚未完全就绪时。

## 故障排查

### 服务无法启动

1. 检查日志文件 `logs\backend-service.log` 和 `logs\frontend-service.log`。
2. 确认 Node.js 已正确安装：`node --version`。
3. 确认端口未被占用：`netstat -ano | findstr ":3001"`。

### 内网无法访问

1. 确认 Windows 防火墙已添加规则（安装脚本会自动添加，需管理员权限）。
2. 手动添加防火墙规则：

```cmd
netsh advfirewall firewall add rule name="PrinterStatus" dir=in action=allow protocol=TCP localport=9191
```

3. 确认服务器和客户端在同一网段。

### 打印机无法连接

1. 确认服务器能 ping 通打印机 IP。
2. 确认打印机 SNMP 服务已启用。
3. 检查 SNMP Community String 配置。

## 数据备份

重要数据文件：

- `settings.json` - 系统设置
- `users.json` - 用户账号
- `printers-data.json` - 打印机配置
- `printer-history.json` - 历史记录
- `backend/snapshots/` - 系统快照

建议定期备份以上文件到内网共享目录。
