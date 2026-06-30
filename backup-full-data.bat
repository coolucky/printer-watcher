@echo off

REM 完整数据备份脚本
echo ========================================
echo 完整数据备份脚本
echo ========================================

REM 创建备份目录
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set year=%%c
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set month=%%a
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set day=%%b
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set hour=%%a
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set minute=%%b
set BACKUP_DIR=backup-data\%year%%month%%day%_%hour%%minute%
echo 创建备份目录: %BACKUP_DIR%
mkdir "%BACKUP_DIR%"

REM 备份前端数据文件
echo 备份前端数据文件...
copy printers-data.json "%BACKUP_DIR%" /y
copy printer-history.json "%BACKUP_DIR%" /y
copy settings.json "%BACKUP_DIR%" /y
copy localStorage-backup.json "%BACKUP_DIR%" /y

REM 备份后端数据文件
echo 备份后端数据文件...
mkdir "%BACKUP_DIR%\backend\config"
copy backend\config\printers.json "%BACKUP_DIR%\backend\config" /y
copy backend\config\settings.json "%BACKUP_DIR%\backend\config" /y

REM 备份环境配置文件
echo 备份环境配置文件...
if exist backend\.env (
    copy backend\.env "%BACKUP_DIR%" /y
)

REM 备份依赖
echo 备份依赖...
mkdir "%BACKUP_DIR%\node_modules_backup"
xcopy node_modules_backup "%BACKUP_DIR%\node_modules_backup" /s /e /y

REM 备份Node.js安装程序
echo 备份Node.js安装程序...
if exist node-v25.8.2-x64.msi (
    copy node-v25.8.2-x64.msi "%BACKUP_DIR%" /y
)

REM 显示备份完成信息
echo ========================================
echo 数据备份完成！
echo 备份文件保存在: %BACKUP_DIR%
echo ========================================
echo 备份内容包括：
echo - 前端数据文件 (printers-data.json, printer-history.json, settings.json, localStorage-backup.json)
echo - 后端配置文件 (backend/config/printers.json, backend/config/settings.json)
echo - 环境配置文件 (backend/.env)
echo - 依赖备份 (node_modules_backup/)
echo - Node.js安装程序 (node-v25.8.2-x64.msi)
echo ========================================
echo 使用 restore-full-data.bat 脚本可以从备份中恢复数据

pause