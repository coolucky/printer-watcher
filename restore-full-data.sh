#!/bin/bash

set -euo pipefail

echo "========================================"
echo "完整数据恢复脚本"
echo "========================================"

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "可用备份目录："
ls -1 backup-data || true
echo ""

INPUT_BACKUP_DIR="${1:-}"
if [ -z "$INPUT_BACKUP_DIR" ]; then
    echo "请输入要恢复的备份目录名称（如 printer-status-backup-20260606_120000）:"
    read -r INPUT_BACKUP_DIR
fi

if [ -d "$INPUT_BACKUP_DIR" ]; then
    RESTORE_DIR="$INPUT_BACKUP_DIR"
elif [ -d "backup-data/$INPUT_BACKUP_DIR" ]; then
    RESTORE_DIR="backup-data/$INPUT_BACKUP_DIR"
else
    echo "错误: 备份目录不存在: $INPUT_BACKUP_DIR"
    exit 1
fi

echo ""
echo "准备从以下目录恢复："
echo "$RESTORE_DIR"
echo ""
echo "此操作将覆盖当前数据，是否继续？(y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "恢复操作已取消"
    exit 0
fi

restore_if_exists() {
    local src="$1"
    local dst="$2"
    if [ -e "$src" ]; then
        mkdir -p "$(dirname "$dst")"
        cp -R "$src" "$dst"
        echo "[OK] restored: $src"
    else
        echo "[SKIP] missing in backup: $src"
    fi
}

echo "恢复核心数据文件..."
restore_if_exists "$RESTORE_DIR/printers-data.json" "./printers-data.json"
restore_if_exists "$RESTORE_DIR/printer-history.json" "./printer-history.json"
restore_if_exists "$RESTORE_DIR/settings.json" "./settings.json"
restore_if_exists "$RESTORE_DIR/users.json" "./users.json"

echo "恢复后端配置..."
restore_if_exists "$RESTORE_DIR/backend/config/printers.json" "./backend/config/printers.json"
restore_if_exists "$RESTORE_DIR/backend/config/settings.json" "./backend/config/settings.json"
restore_if_exists "$RESTORE_DIR/backend/config/alertConfig.json" "./backend/config/alertConfig.json"
restore_if_exists "$RESTORE_DIR/backend/config/printServers.json" "./backend/config/printServers.json"
restore_if_exists "$RESTORE_DIR/backend/config/assetInventory.json" "./backend/config/assetInventory.json"
restore_if_exists "$RESTORE_DIR/backend/config/assetInventorySessions" "./backend/config/assetInventorySessions"

echo "恢复环境文件..."
restore_if_exists "$RESTORE_DIR/backend/.env" "./backend/.env"

if [ -f "$RESTORE_DIR/backup-checksums.sha256" ] && command -v shasum >/dev/null 2>&1; then
    echo "校验备份完整性..."
    (cd "$RESTORE_DIR" && shasum -a 256 -c backup-checksums.sha256) || true
fi

echo "========================================"
echo "数据恢复完成"
echo "恢复来源: $RESTORE_DIR"
echo "========================================"
echo "请重启服务以应用恢复后的数据。"