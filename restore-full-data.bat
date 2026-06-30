@echo off

REM 完整数据恢复脚本
echo ========================================
echo 完整数据恢复脚本
echo ========================================

REM 显示可用的备份目录
echo 可用的备份目录：
dir backup-data

echo.
echo 请输入要恢复的备份目录名称（例如：20240101_120000）:
set /p BACKUP_DIR=

REM 检查备份目录是否存在
if not exist "backup-data\%BACKUP_DIR%" (
    echo 错误: 备份目录不存在
    pause
    exit
)

REM 确认恢复操作
echo.
echo 确认要从以下备份目录恢复数据:
echo backup-data\%BACKUP_DIR%
echo.
echo 此操作将覆盖当前数据，是否继续？(y/n)
set /p CONFIRM=

if not "%CONFIRM%" == "y" (
    echo 恢复操作已取消
    pause
    exit
)

REM 恢复前端数据文件
echo 恢复前端数据文件...
copy "backup-data\%BACKUP_DIR%\printers-data.json" . /y
copy "backup-data\%BACKUP_DIR%\printer-history.json" . /y
copy "backup-data\%BACKUP_DIR%\settings.json" . /y
copy "backup-data\%BACKUP_DIR%\localStorage-backup.json" . /y

REM 恢复后端数据文件
echo 恢复后端数据文件...
copy "backup-data\%BACKUP_DIR%\backend\config\printers.json" backend\config /y
copy "backup-data\%BACKUP_DIR%\backend\config\settings.json" backend\config /y

REM 恢复环境配置文件
echo 恢复环境配置文件...
if exist "backup-data\%BACKUP_DIR%\.env" (
    copy "backup-data\%BACKUP_DIR%\.env" backend /y
)

REM 恢复依赖
echo 恢复依赖...
rd /s /q node_modules_backup
xcopy "backup-data\%BACKUP_DIR%\node_modules_backup" node_modules_backup /s /e /y

REM 恢复Node.js安装程序
echo 恢复Node.js安装程序...
if exist "backup-data\%BACKUP_DIR%\node-v25.8.2-x64.msi" (
    copy "backup-data\%BACKUP_DIR%\node-v25.8.2-x64.msi" . /y
)

REM 显示恢复完成信息
echo ========================================
echo 数据恢复完成！
echo 已从以下备份目录恢复数据:
echo backup-data\%BACKUP_DIR%
echo ========================================
echo 恢复内容包括：
echo - 前端数据文件 (printers-data.json, printer-history.json, settings.json, localStorage-backup.json)
echo - 后端配置文件 (backend/config/printers.json, backend/config/settings.json)
echo - 环境配置文件 (backend/.env)
echo - 依赖备份 (node_modules_backup/)
echo - Node.js安装程序 (node-v25.8.2-x64.msi)
echo ========================================
echo 请重启服务以应用恢复的数据

pause