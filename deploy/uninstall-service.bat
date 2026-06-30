@echo off
setlocal EnableDelayedExpansion

title Uninstall Printer Status Report Services

echo ======================================================
echo   Printer Status Report - Uninstall Windows Services
echo ======================================================
echo.

REM ==================== CHECK ADMIN ====================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo.
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
set "NSSM_EXE=%SCRIPT_DIR%nssm.exe"
set "BACKEND_SERVICE=PrinterStatusBackend"
set "FRONTEND_SERVICE=PrinterStatusFrontend"

if not exist "%NSSM_EXE%" (
    echo [ERROR] nssm.exe not found in %SCRIPT_DIR%
    echo         Cannot uninstall services without NSSM.
    pause
    exit /b 1
)

echo [STOP] Stopping services...
"%NSSM_EXE%" stop %FRONTEND_SERVICE% >nul 2>&1
"%NSSM_EXE%" stop %BACKEND_SERVICE% >nul 2>&1
timeout /t 3 /nobreak >nul

echo [REMOVE] Removing frontend service...
"%NSSM_EXE%" remove %FRONTEND_SERVICE% confirm >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Frontend service removed
) else (
    echo [INFO] Frontend service was not installed
)

echo [REMOVE] Removing backend service...
"%NSSM_EXE%" remove %BACKEND_SERVICE% confirm >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Backend service removed
) else (
    echo [INFO] Backend service was not installed
)

REM Remove scheduled task if exists
schtasks /delete /tn "PrinterStatusReportAutoStart" /f >nul 2>&1

REM Kill any remaining nssm.exe processes to release the file lock
echo [CLEAN] Terminating residual NSSM processes...
taskkill /F /IM nssm.exe >nul 2>&1
timeout /t 3 /nobreak >nul

REM Second attempt - sometimes NSSM respawns briefly during service teardown
taskkill /F /IM nssm.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Also kill any node.exe processes started by NSSM (they hold handles too)
taskkill /F /FI "SERVICES eq PrinterStatusBackend" >nul 2>&1
taskkill /F /FI "SERVICES eq PrinterStatusFrontend" >nul 2>&1
timeout /t 1 /nobreak >nul

REM Final check - force kill by PID if still running
for /f "tokens=2" %%p in ('tasklist /FI "IMAGENAME eq nssm.exe" /NH 2^>nul ^| findstr /I "nssm"') do (
    echo [CLEAN] Force killing nssm.exe PID %%p
    taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo [OK] NSSM processes terminated - nssm.exe can now be deleted

echo.
echo ======================================================
echo   Services Uninstalled
echo ======================================================
echo.
echo   The services have been stopped and removed.
echo   They will no longer auto-start on boot.
echo.
echo   Log files in logs\ have been preserved.
echo.
pause
