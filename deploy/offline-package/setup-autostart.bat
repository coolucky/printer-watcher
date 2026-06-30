@echo off
setlocal EnableDelayedExpansion

title Setup Printer Status Report Auto-Start

echo ======================================================
echo   Printer Status Report - Setup Auto-Start
echo ======================================================
echo.

REM ==================== CHECK ADMIN ====================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo.
    echo Please:
    echo 1. Right-click on this file
    echo 2. Select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [OK] Administrator privileges confirmed
echo.

REM ==================== PATHS ====================
set "SCRIPT_DIR=%~dp0"
set "BACKEND_SERVICE=PrinterStatusBackend"
set "FRONTEND_SERVICE=PrinterStatusFrontend"
set "TASK_NAME=PrinterStatusServiceStart"

if not exist "%SCRIPT_DIR%nssm.exe" (
    echo [ERROR] nssm.exe not found in %SCRIPT_DIR%
    echo [ERROR] Please run install-service.bat first.
    pause
    exit /b 1
)

echo [CONFIG] Script directory : %SCRIPT_DIR%
echo [CONFIG] Backend service  : %BACKEND_SERVICE%
echo [CONFIG] Frontend service : %FRONTEND_SERVICE%
echo.

REM ==================== VERIFY SERVICES ====================
sc query %BACKEND_SERVICE% >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Service %BACKEND_SERVICE% is not installed.
    echo [ERROR] Please run install-service.bat first.
    pause
    exit /b 1
)

sc query %FRONTEND_SERVICE% >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Service %FRONTEND_SERVICE% is not installed.
    echo [ERROR] Please run install-service.bat first.
    pause
    exit /b 1
)

echo [OK] Required Windows services are installed

echo [SETUP] Ensuring delayed auto-start for services...
sc config %BACKEND_SERVICE% start= delayed-auto >nul 2>&1
sc config %FRONTEND_SERVICE% start= delayed-auto >nul 2>&1

echo [SETUP] Configuring Task Scheduler fallback to start services...

REM Delete existing task if it exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Run sc start commands at boot with a short delay for network stack
schtasks /create /tn "%TASK_NAME%" ^
  /tr "cmd /c timeout /t 20 /nobreak ^>nul ^& sc start %BACKEND_SERVICE% ^& timeout /t 5 /nobreak ^>nul ^& sc start %FRONTEND_SERVICE%" ^
  /sc onstart ^
  /ru SYSTEM ^
  /rl HIGHEST ^
  /f >nul 2>&1

if %errorlevel% equ 0 (
    echo [OK] Startup fallback task created
    schtasks /query /tn "%TASK_NAME%" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Task verification passed
        echo.
        echo Task Details:
        echo   - Name: %TASK_NAME%
        echo   - Trigger: At system startup
        echo   - Run as: SYSTEM (elevated)
        echo   - Action: start Windows services via sc start
        echo.
        echo [SUCCESS] Auto-start configuration complete!
        echo.
    ) else (
        echo [WARNING] Task creation may have failed, please verify manually
    )
) else (
    echo [ERROR] Failed to create scheduled task
    echo.
    echo Please ensure:
    echo - You are running this script as Administrator
    echo - Task Scheduler service is running
    pause
    exit /b 1
)

echo.
echo ======================================================
echo   Setup Complete
echo ======================================================
echo.
echo Next steps:
echo 1. Restart server to verify auto-start behavior
echo 2. Check services.msc for service state after reboot
echo 3. Check logs\backend-service.log and logs\frontend-service.log if needed
echo.
pause
exit /b 0
