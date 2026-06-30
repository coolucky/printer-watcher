@echo off
setlocal EnableDelayedExpansion

title Printer Status Report Service

echo ======================================================
echo   Printer Status Report - Debug Startup Script
echo ======================================================
echo.
echo [WARNING] This script is for temporary debug sessions only.
echo [WARNING] Services started by this script WILL stop after sign out or reboot.
echo [RECOMMEND] For production deployment, run install-service.bat as Administrator.
echo.
set "CONFIRM_DEBUG=%~1"
if /I "%CONFIRM_DEBUG%"=="--debug" goto :debug_confirmed
if /I "%CONFIRM_DEBUG%"=="/debug" goto :debug_confirmed

echo Continue with debug startup? (Y/N)
set /p "DEBUG_ANSWER=> "
if /I not "%DEBUG_ANSWER%"=="Y" (
    echo Cancelled. Use install-service.bat for persistent deployment.
    exit /b 0
)

:debug_confirmed
if /I "%~1"=="--debug" shift
if /I "%~1"=="/debug" shift
echo.

REM ==================== CONFIG ====================
set BACKEND_PORT=3001
set FRONTEND_PORT=9191
set NODEJS_PORTABLE_DIR=%~dp0nodejs

REM ==================== PARSE ARGS ====================
if not "%~1"=="" (
    set FRONTEND_PORT=%~1
)
echo [CONFIG] Backend port : %BACKEND_PORT%
echo [CONFIG] Frontend port: %FRONTEND_PORT%
echo.

REM ==================== CHECK NODE.JS ====================
echo [CHECK] Looking for Node.js...

if exist "%NODEJS_PORTABLE_DIR%\node.exe" (
    echo [CHECK] Found portable Node.js: %NODEJS_PORTABLE_DIR%
    set "PATH=%NODEJS_PORTABLE_DIR%;%PATH%"
    goto :node_ok
)

where node >nul 2>&1
if %ERRORLEVEL% equ 0 goto :node_ok

if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
    goto :node_ok
)

if exist "C:\nodejs\node.exe" (
    set "PATH=C:\nodejs;%PATH%"
    goto :node_ok
)

REM Try to extract Node.js zip if present
for %%f in ("%~dp0node-*.zip") do (
    echo [SETUP] Found Node.js zip: %%~nxf
    echo [SETUP] Extracting...
    powershell -Command "Expand-Archive -Path '%%f' -DestinationPath '%~dp0_nodejs_temp' -Force"
    if !ERRORLEVEL! equ 0 (
        for /d %%d in ("%~dp0_nodejs_temp\*") do (
            if exist "%%d\node.exe" (
                robocopy "%%d" "%NODEJS_PORTABLE_DIR%" /E /NFL /NDL /NJH /NJS >nul
                rd /s /q "%~dp0_nodejs_temp" 2>nul
                set "PATH=%NODEJS_PORTABLE_DIR%;%PATH%"
                echo [SETUP] Node.js extracted OK
                goto :node_ok
            )
        )
        if exist "%~dp0_nodejs_temp\node.exe" (
            robocopy "%~dp0_nodejs_temp" "%NODEJS_PORTABLE_DIR%" /E /NFL /NDL /NJH /NJS >nul
            rd /s /q "%~dp0_nodejs_temp" 2>nul
            set "PATH=%NODEJS_PORTABLE_DIR%;%PATH%"
            echo [SETUP] Node.js extracted OK
            goto :node_ok
        )
        rd /s /q "%~dp0_nodejs_temp" 2>nul
    )
)

echo [ERROR] Node.js not found!
echo         Please place node-v20.x-win-x64.zip in this directory
echo         or extract Node.js to: %NODEJS_PORTABLE_DIR%\
pause
exit /b 1

:node_ok
for /f "tokens=*" %%v in ('node --version') do echo [CHECK] Node.js %%v - OK
echo.

REM ==================== CHECK DEPENDENCIES ====================
echo [CHECK] Backend dependencies...
if exist "%~dp0backend\node_modules\express\package.json" (
    echo [CHECK] node_modules OK
) else (
    echo [ERROR] backend\node_modules is missing!
    echo         Please make sure the deployment package is complete.
    pause
    exit /b 1
)

echo [CHECK] Frontend build files...
if exist "%~dp0dist\index.html" (
    echo [CHECK] dist OK
) else (
    echo [ERROR] dist\index.html not found!
    pause
    exit /b 1
)

echo [CHECK] Frontend server script...
if exist "%~dp0frontend-server.js" (
    echo [CHECK] frontend-server.js OK
) else (
    echo [ERROR] frontend-server.js not found!
    pause
    exit /b 1
)
echo.

REM ==================== CHECK PORTS ====================
echo [PORTS] Checking port availability...
netstat -ano 2>nul | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [PORTS] Port %BACKEND_PORT% is in use, killing process...
    for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":%BACKEND_PORT% " ^| findstr "LISTENING"') do (
        taskkill /PID %%p /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

netstat -ano 2>nul | findstr ":%FRONTEND_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [ERROR] Port %FRONTEND_PORT% is already in use!
    echo         Use: start-service.bat [other-port]
    pause
    exit /b 1
)
echo [PORTS] All ports available - OK
echo.

REM ==================== CREATE ENV FILE ====================
echo [ENV] Writing .env file...
echo NODE_ENV=production> "%~dp0backend\.env"
echo BACKEND_PORT=%BACKEND_PORT%>> "%~dp0backend\.env"
echo CORS_ORIGIN=http://localhost:%FRONTEND_PORT%,http://127.0.0.1:%FRONTEND_PORT%>> "%~dp0backend\.env"
echo [ENV] Done
echo.

REM ==================== CREATE LOG DIR ====================
if not exist "%~dp0logs" mkdir "%~dp0logs"

REM ==================== START SERVICES ====================
echo ======================================================
echo   Starting services...
echo ======================================================
echo.

echo [START] Backend (port %BACKEND_PORT%)...
cd /d "%~dp0backend"
start "PrinterStatus-Backend" /min cmd /c "node server.js > ..\logs\backend.log 2>&1"

echo [START] Waiting for backend...
timeout /t 3 /nobreak >nul

echo [START] Frontend (port %FRONTEND_PORT%)...
cd /d "%~dp0"
set FRONTEND_PORT=%FRONTEND_PORT%
set BACKEND_PORT=%BACKEND_PORT%
start "PrinterStatus-Frontend" /min cmd /c "set FRONTEND_PORT=%FRONTEND_PORT%&& set BACKEND_PORT=%BACKEND_PORT%&& node frontend-server.js > logs\frontend.log 2>&1"

timeout /t 2 /nobreak >nul

REM ==================== VERIFY ====================
echo.
echo [VERIFY] Checking backend health...
node -e "const h=require('http');h.get('http://127.0.0.1:%BACKEND_PORT%/api/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{console.log('[VERIFY] Backend: '+r.statusCode+' OK');process.exit(0)})}).on('error',()=>{console.log('[VERIFY] Backend: not responding yet');process.exit(1)})" 2>nul
echo.

REM ==================== FIREWALL ====================
echo [FIREWALL] Adding rules (requires admin)...
netsh advfirewall firewall show rule name="PrinterStatus-Backend" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    netsh advfirewall firewall add rule name="PrinterStatus-Backend" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo [FIREWALL] Backend rule added
    ) else (
        echo [FIREWALL] Need admin rights - add manually if needed
    )
)
netsh advfirewall firewall show rule name="PrinterStatus-Frontend" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    netsh advfirewall firewall add rule name="PrinterStatus-Frontend" dir=in action=allow protocol=TCP localport=%FRONTEND_PORT% >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo [FIREWALL] Frontend rule added
    ) else (
        echo [FIREWALL] Need admin rights - add manually if needed
    )
)
echo.

REM ==================== DONE ====================
echo ======================================================
echo   Service started successfully!
echo ======================================================
echo.
echo   Frontend : http://localhost:%FRONTEND_PORT%
echo   Backend  : http://localhost:%BACKEND_PORT%
echo   Health   : http://localhost:%BACKEND_PORT%/api/health
echo.
echo   LAN access: http://[SERVER_IP]:%FRONTEND_PORT%
echo.
echo   Logs:
echo     Backend  : logs\backend.log
echo     Frontend : logs\frontend.log
echo.
echo   To stop: run stop-service.bat
echo ======================================================
echo.

REM ==================== OPEN BROWSER ====================
echo [BROWSER] Opening http://localhost:%FRONTEND_PORT% ...
start "" "http://localhost:%FRONTEND_PORT%"

pause
