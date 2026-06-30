@echo off
REM ============================================================
REM 重启服务脚本 - 由系统更新功能自动调用
REM ============================================================

setlocal EnableDelayedExpansion

set BACKEND_PORT=3001
set FRONTEND_PORT=9191
set NODEJS_PORTABLE_DIR=%~dp0nodejs

REM 设置 Node.js 路径
if exist "%NODEJS_PORTABLE_DIR%\node.exe" (
    set "PATH=%NODEJS_PORTABLE_DIR%;%PATH%"
) else if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "C:\nodejs\node.exe" (
    set "PATH=C:\nodejs;%PATH%"
)

echo [RESTART] Stopping services...

REM 停止后端
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":%BACKEND_PORT% " ^| findstr "LISTENING"') do (
    echo [RESTART] Killing backend PID: %%p
    taskkill /PID %%p /F >nul 2>&1
)

REM 停止前端
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":%FRONTEND_PORT% " ^| findstr "LISTENING"') do (
    echo [RESTART] Killing frontend PID: %%p
    taskkill /PID %%p /F >nul 2>&1
)

REM 等待端口释放
timeout /t 3 /nobreak >nul

echo [RESTART] Starting backend (port %BACKEND_PORT%)...
cd /d "%~dp0backend"
start "PrinterStatus-Backend" /min cmd /c "node server.js > ..\logs\backend.log 2>&1"

timeout /t 3 /nobreak >nul

echo [RESTART] Starting frontend (port %FRONTEND_PORT%)...
cd /d "%~dp0"
start "PrinterStatus-Frontend" /min cmd /c "set FRONTEND_PORT=%FRONTEND_PORT%&& set BACKEND_PORT=%BACKEND_PORT%&& node frontend-server.js > logs\frontend.log 2>&1"

timeout /t 2 /nobreak >nul

echo [RESTART] Services restarted successfully!
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo   Backend:  http://localhost:%BACKEND_PORT%
