#!/bin/bash
# ============================================================
# 离线部署打包脚本 (Windows Server 离线部署)
# ============================================================
# 用途：在有网络的开发机(macOS/Linux)上构建并打包所有文件，
#       生成可直接在 Windows Server 上解压部署的离线包。
#
# 运行环境：macOS 或 Linux（开发机）
# 目标环境：Windows Server 2016+ (x64)，需预装 Node.js 18+
#
# 部署包结构 (解压后)：
#   offline-package/
#   ├── dist/                    # 构建后的前端静态文件
#   │   ├── index.html
#   │   ├── assets/              # Vite 构建的 JS/CSS
#   │   └── asset-inventory/     # 资产盘点模块（含本地 ExcelJS）
#   ├── backend/                 # 后端 Node.js 应用
#   │   ├── server.js
#   │   ├── package.json
#   │   ├── node_modules/        # 后端依赖（预安装，离线可用）
#   │   ├── config/              # 配置文件
#   │   ├── middleware/
#   │   ├── routes/
#   │   ├── services/
#   │   └── utils/
#   ├── frontend-server.js       # 前端静态文件服务（端口 9191）
#   ├── install-service.bat      # ★ 主安装脚本（管理员运行，一键部署）
#   ├── nssm.exe                 # Windows 服务管理器（64-bit）
#   ├── start-service.bat        # 手动启动（非服务模式，调试用）
#   ├── stop-service.bat         # 停止服务
#   ├── restart-service.bat      # 重启服务
#   ├── uninstall-service.bat    # 卸载服务
#   ├── setup-autostart.bat      # 配置开机自启（备选方案）
#   ├── settings.json            # 应用配置
#   ├── users.json               # 用户数据
#   ├── printers-data.json       # 打印机数据
#   ├── printer-history.json     # 打印机历史
#   ├── DEPLOY-README.md         # 部署说明
#   └── README-NODEJS.txt        # Node.js 安装说明
#
# Windows Server 部署步骤：
#   1. 将 zip 复制到 Windows Server
#   2. 解压到目标目录（如 C:\PrinterStatus）
#   3. 确保已安装 Node.js 18+ (node.exe 在 PATH 中)
#   4. 以管理员身份运行 install-service.bat
#   5. 完成！可 sign out，服务持续运行
#
# 端口说明：
#   - 前端: 9191 (生产环境，非开发环境的 5175)
#   - 后端: 3001
#
# 服务持久化方案：NSSM (Non-Sucking Service Manager)
#   - 注册为 Windows 系统服务 (LocalSystem 账户)
#   - 开机自启 (SERVICE_AUTO_START)
#   - sign out 不影响服务运行
#   - 服务名: PrinterStatusBackend, PrinterStatusFrontend
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/deploy/offline-package"
ARCHIVE_NAME="printer-status-report-offline-$(date +%Y%m%d).zip"
VALIDATION_REPORT="$OUTPUT_DIR/OFFLINE-PACKAGE-VALIDATION.txt"

assert_file() {
    local target="$1"
    if [ ! -f "$target" ]; then
        echo "ERROR: 缺少关键文件: $target"
        exit 1
    fi
}

assert_dir() {
    local target="$1"
    if [ ! -d "$target" ]; then
        echo "ERROR: 缺少关键目录: $target"
        exit 1
    fi
}

echo "======================================"
echo " 打印机状态报告 - 离线部署打包"
echo "======================================"
echo ""
echo "项目目录: $PROJECT_DIR"
echo "输出目录: $OUTPUT_DIR"
echo "目标文件: $ARCHIVE_NAME"
echo ""

# ============================================================
# 步骤 0: 清理旧的打包目录
# ============================================================
echo "[0/5] 清理旧的打包目录..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# ============================================================
# 步骤 1: 安装前端依赖
# ============================================================
echo "[1/5] 安装前端依赖..."
cd "$PROJECT_DIR"
if [ -f "$PROJECT_DIR/package-lock.json" ]; then
    echo "  使用 package-lock.json 执行 npm ci"
    npm ci
else
    echo "  未找到 package-lock.json，回退到 npm install"
    npm install
fi

# ============================================================
# 步骤 2: 构建前端生产版本
# ============================================================
echo "[2/5] 构建前端生产版本..."
npm run build

# 验证构建结果
if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
    echo "ERROR: 前端构建失败 - dist/index.html 不存在"
    exit 1
fi
if [ ! -d "$PROJECT_DIR/dist/asset-inventory" ]; then
    echo "ERROR: 前端构建失败 - dist/asset-inventory/ 不存在"
    exit 1
fi
if [ ! -f "$PROJECT_DIR/dist/asset-inventory/scripts/lib/exceljs.min.js" ]; then
    echo "ERROR: ExcelJS 本地文件不存在 - 离线环境资产盘点导出功能不可用"
    exit 1
fi
echo "  ✓ dist/index.html"
echo "  ✓ dist/asset-inventory/"
echo "  ✓ dist/asset-inventory/scripts/lib/exceljs.min.js"

# ============================================================
# 步骤 3: 安装后端依赖
# ============================================================
echo "[3/5] 安装后端依赖..."
cd "$PROJECT_DIR/backend"
if [ -f "$PROJECT_DIR/backend/package-lock.json" ]; then
    echo "  使用 backend/package-lock.json 执行 npm ci --omit=dev"
    npm ci --omit=dev
else
    echo "  未找到 backend/package-lock.json，回退到 npm install --production"
    npm install --production
fi

# ============================================================
# 步骤 4: 复制文件到打包目录
# ============================================================
echo "[4/5] 复制文件到打包目录..."

# --- 前端构建文件 ---
echo "  复制 dist/ (构建后的前端)..."
cp -r "$PROJECT_DIR/dist" "$OUTPUT_DIR/dist"

# --- 后端应用文件 ---
echo "  复制 backend/ (后端应用)..."
mkdir -p "$OUTPUT_DIR/backend"
cp "$PROJECT_DIR/backend/package.json" "$OUTPUT_DIR/backend/"
cp "$PROJECT_DIR/backend/server.js" "$OUTPUT_DIR/backend/"
cp "$PROJECT_DIR/backend/index.js" "$OUTPUT_DIR/backend/" 2>/dev/null || true
cp "$PROJECT_DIR/backend/printerScraper.js" "$OUTPUT_DIR/backend/" 2>/dev/null || true
cp "$PROJECT_DIR/backend/chi_sim.traineddata" "$OUTPUT_DIR/backend/" 2>/dev/null || true
cp "$PROJECT_DIR/backend/eng.traineddata" "$OUTPUT_DIR/backend/" 2>/dev/null || true
cp -r "$PROJECT_DIR/backend/config" "$OUTPUT_DIR/backend/" 2>/dev/null || true
cp -r "$PROJECT_DIR/backend/middleware" "$OUTPUT_DIR/backend/" 2>/dev/null || true
cp -r "$PROJECT_DIR/backend/routes" "$OUTPUT_DIR/backend/" 2>/dev/null || true
cp -r "$PROJECT_DIR/backend/services" "$OUTPUT_DIR/backend/" 2>/dev/null || true
cp -r "$PROJECT_DIR/backend/utils" "$OUTPUT_DIR/backend/" 2>/dev/null || true

# --- 清理运行时日志（避免把本机离线/抖动日志带入离线包）---
echo "  清理离线包中的运行时日志与日统计快照..."
mkdir -p "$OUTPUT_DIR/backend/config/printAnalytics/daily"
printf '[]\n' > "$OUTPUT_DIR/backend/config/printerStatusLogs.json"
printf '[]\n' > "$OUTPUT_DIR/backend/config/printServerLogs.json"
printf '{}\n' > "$OUTPUT_DIR/backend/config/printServerHistory.json"
printf '{}\n' > "$OUTPUT_DIR/backend/config/jiraUserConfigs.json"
find "$OUTPUT_DIR/backend/config/printAnalytics/daily" -type f -name '*.json' -delete

# 后端 node_modules (离线部署必须包含)
echo "  复制 backend/node_modules/ (离线依赖，这一步较慢)..."
cp -r "$PROJECT_DIR/backend/node_modules" "$OUTPUT_DIR/backend/"

# --- 根目录配置文件 (应用数据) ---
echo "  复制配置文件..."
cp "$PROJECT_DIR/settings.json" "$OUTPUT_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/users.json" "$OUTPUT_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/printers-data.json" "$OUTPUT_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/printer-history.json" "$OUTPUT_DIR/" 2>/dev/null || true

# --- 部署脚本和工具 ---
echo "  复制部署脚本和工具..."

# 核心: 前端静态文件服务器 (生产环境端口 9191，代理 /api 到后端 3001)
cp "$SCRIPT_DIR/frontend-server.js" "$OUTPUT_DIR/"

# 核心: NSSM 服务管理器 (64-bit Windows，用于注册系统服务)
cp "$SCRIPT_DIR/nssm.exe" "$OUTPUT_DIR/"

# 核心: 安装脚本 (一键部署，注册 Windows 系统服务，sign out 后服务不停)
cp "$SCRIPT_DIR/install-service.bat" "$OUTPUT_DIR/"

# 辅助: 服务管理脚本
cp "$SCRIPT_DIR/start-service.bat" "$OUTPUT_DIR/"
cp "$SCRIPT_DIR/stop-service.bat" "$OUTPUT_DIR/"
cp "$SCRIPT_DIR/restart-service.bat" "$OUTPUT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/uninstall-service.bat" "$OUTPUT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/setup-autostart.bat" "$OUTPUT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/validate-offline-package.sh" "$OUTPUT_DIR/" 2>/dev/null || true

# 文档
cp "$SCRIPT_DIR/DEPLOY-README.md" "$OUTPUT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/DESKTOP-SUPPORT-RUNBOOK.md" "$OUTPUT_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/BACKUP-DRILL-RUNBOOK.md" "$OUTPUT_DIR/" 2>/dev/null || true

# Node.js 安装说明
cat > "$OUTPUT_DIR/README-NODEJS.txt" << 'EOF'
如果目标 Windows Server 上没有安装 Node.js，请将 Node.js 安装包放在此目录下：

推荐版本: Node.js 18.x 或 20.x LTS (Windows x64)
下载地址: https://nodejs.org/dist/
文件名示例: node-v20.18.0-win-x64.zip (免安装版，推荐)

使用免安装版(zip)时，解压到 C:\nodejs 目录即可。
启动脚本会自动检测并配置环境变量。

也可以将 Node.js zip 放在本目录下，start-service.bat 会自动解压使用。
EOF

# 目录级验收（脚本化）
bash "$SCRIPT_DIR/validate-offline-package.sh" "$OUTPUT_DIR"

# ============================================================
# 步骤 5: 打包为 zip
# ============================================================
echo "[5/5] 打包为 zip 文件..."
cd "$PROJECT_DIR/deploy"

# 删除同名旧包
rm -f "$ARCHIVE_NAME"

zip -r "$ARCHIVE_NAME" "offline-package/" -x "*/\.*"

# zip + 目录联合验收
bash "$SCRIPT_DIR/validate-offline-package.sh" "$OUTPUT_DIR" "$PROJECT_DIR/deploy/$ARCHIVE_NAME"

# ============================================================
# 完成
# ============================================================
echo ""
echo "======================================"
echo " 打包完成！"
echo "======================================"
echo ""
echo "输出文件: $PROJECT_DIR/deploy/$ARCHIVE_NAME"
echo "文件大小: $(du -h "$PROJECT_DIR/deploy/$ARCHIVE_NAME" | cut -f1)"
echo ""
echo "包内文件数:"
echo "  dist/:           $(find "$OUTPUT_DIR/dist" -type f | wc -l | tr -d ' ') 个文件"
echo "  backend/:        $(find "$OUTPUT_DIR/backend" -type f -not -path '*/node_modules/*' | wc -l | tr -d ' ') 个文件 (不含 node_modules)"
echo "  node_modules/:   $(find "$OUTPUT_DIR/backend/node_modules" -type f | wc -l | tr -d ' ') 个文件"
echo "  部署脚本:        $(find "$OUTPUT_DIR" -maxdepth 1 \( -name "*.bat" -o -name "*.js" -o -name "*.exe" \) | wc -l | tr -d ' ') 个文件"
echo "  验收报告:        OFFLINE-PACKAGE-VALIDATION.txt"
echo ""
echo "============================================================"
echo " Windows Server 部署步骤"
echo "============================================================"
echo ""
echo "  1. 将 $ARCHIVE_NAME 复制到 Windows Server"
echo "  2. 解压到目标目录 (如 C:\\PrinterStatus)"
echo "  3. 确保已安装 Node.js 18+ (node --version 能运行)"
echo "  4. 右键 install-service.bat → 以管理员身份运行"
echo "  5. 看到 [SUCCESS] 即完成，可以 sign out"
echo ""
echo "  访问地址: http://服务器IP:9191"
echo ""
echo "  注意: 只需运行 install-service.bat，不要运行 start-service.bat"
echo "        install-service.bat 使用 NSSM 注册系统服务，sign out 不会停止"
echo "        start-service.bat 是调试用的，sign out 后服务会停止"
echo ""
