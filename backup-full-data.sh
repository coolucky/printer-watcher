#!/bin/bash

set -euo pipefail

echo "========================================"
echo "完整数据备份脚本"
echo "========================================"

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

STAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_DIR="backup-data/printer-status-backup-${STAMP}"
MANIFEST_FILE="$BACKUP_DIR/backup-manifest.txt"

copy_if_exists() {
    local src="$1"
    local dst="$2"
    if [ -e "$src" ]; then
        mkdir -p "$(dirname "$dst")"
        cp -R "$src" "$dst"
        echo "[OK] $src"
    else
        echo "[SKIP] missing: $src"
    fi
}

echo "创建备份目录: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

echo "备份核心数据文件..."
copy_if_exists "printers-data.json" "$BACKUP_DIR/printers-data.json"
copy_if_exists "printer-history.json" "$BACKUP_DIR/printer-history.json"
copy_if_exists "settings.json" "$BACKUP_DIR/settings.json"
copy_if_exists "users.json" "$BACKUP_DIR/users.json"

echo "备份后端配置与状态..."
copy_if_exists "backend/config/printers.json" "$BACKUP_DIR/backend/config/printers.json"
copy_if_exists "backend/config/settings.json" "$BACKUP_DIR/backend/config/settings.json"
copy_if_exists "backend/config/alertConfig.json" "$BACKUP_DIR/backend/config/alertConfig.json"
copy_if_exists "backend/config/printServers.json" "$BACKUP_DIR/backend/config/printServers.json"
copy_if_exists "backend/config/assetInventory.json" "$BACKUP_DIR/backend/config/assetInventory.json"
copy_if_exists "backend/config/assetInventorySessions" "$BACKUP_DIR/backend/config/assetInventorySessions"

echo "备份环境文件..."
copy_if_exists "backend/.env" "$BACKUP_DIR/backend/.env"

echo "生成清单与校验..."
{
    echo "Backup Created At: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Backup Path: $BACKUP_DIR"
    echo ""
    echo "Files:"
    find "$BACKUP_DIR" -type f | sed "s|$BACKUP_DIR/||" | sort
} > "$MANIFEST_FILE"

if command -v shasum >/dev/null 2>&1; then
    find "$BACKUP_DIR" -type f ! -name "backup-manifest.txt" -print0 | sort -z | xargs -0 shasum -a 256 > "$BACKUP_DIR/backup-checksums.sha256"
fi

echo "========================================"
echo "数据备份完成"
echo "备份目录: $BACKUP_DIR"
echo "清单文件: $MANIFEST_FILE"
echo "========================================"
echo "可使用 restore-full-data.sh 进行恢复。"