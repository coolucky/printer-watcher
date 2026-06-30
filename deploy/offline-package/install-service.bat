@echo off
setlocal EnableDelayedExpansion

title Install Printer Status Report as Windows Service

REM ==================== LOG SETUP ====================
set "SCRIPT_DIR=%~dp0"
set "LOG_FILE=%SCRIPT_DIR%install-service.log"

echo [%date% %time%] Install script started > "%LOG_FILE%"

echo ======================================================
echo   Printer Status Report - Install Windows Service
echo ======================================================
echo.
echo   Log file: %LOG_FILE%
echo.

REM ==================== CHECK ADMIN ====================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo [%date% %time%] ERROR: Not admin >> "%LOG_FILE%"
    goto :end_fail
)
echo [OK] Administrator privileges confirmed
echo [%date% %time%] Admin check passed >> "%LOG_FILE%"
echo.

REM ==================== CONFIG ====================
set "NSSM_EXE=%SCRIPT_DIR%nssm.exe"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "FRONTEND_DIR=%SCRIPT_DIR%"
set "BACKEND_SERVICE=PrinterStatusBackend"
set "FRONTEND_SERVICE=PrinterStatusFrontend"
set "BACKEND_PORT=3001"
set "FRONTEND_PORT=9191"

echo [CONFIG] Script dir   : %SCRIPT_DIR%
echo [CONFIG] Backend dir  : %BACKEND_DIR%
echo [CONFIG] Backend port : %BACKEND_PORT%
echo [CONFIG] Frontend port: %FRONTEND_PORT%
echo.

REM ==================== FIND NODE.JS ====================
echo [CHECK] Looking for Node.js...
echo [%date% %time%] Looking for Node.js >> "%LOG_FILE%"
set "NODE_EXE="

if exist "%SCRIPT_DIR%nodejs\node.exe" (
    set "NODE_EXE=%SCRIPT_DIR%nodejs\node.exe"
    goto :node_found
)

if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    goto :node_found
)

if exist "C:\nodejs\node.exe" (
    set "NODE_EXE=C:\nodejs\node.exe"
    goto :node_found
)

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('where node') do (
        if not defined NODE_EXE set "NODE_EXE=%%i"
    )
)

if defined NODE_EXE (
    echo [INFO] Node candidate from PATH: %NODE_EXE%
    echo %NODE_EXE% | findstr /I "\Users\ \AppData\" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [WARN] Skipping user-profile Node.js path for Windows services: %NODE_EXE%
        echo [%date% %time%] WARN: Skip user-profile Node.js path %NODE_EXE% >> "%LOG_FILE%"
        set "NODE_EXE="
    )
)

if not defined NODE_EXE (
    echo [CHECK] Trying portable Node.js zip in deployment folder...
    for %%f in ("%SCRIPT_DIR%node-*.zip") do (
        echo [SETUP] Found Node.js zip: %%~nxf
        powershell -Command "Expand-Archive -Path '%%f' -DestinationPath '%SCRIPT_DIR%_nodejs_temp' -Force" >nul 2>&1
        if !ERRORLEVEL! equ 0 (
            for /d %%d in ("%SCRIPT_DIR%_nodejs_temp\*") do (
                if exist "%%d\node.exe" (
                    robocopy "%%d" "%SCRIPT_DIR%nodejs" /E /NFL /NDL /NJH /NJS >nul
                    set "NODE_EXE=%SCRIPT_DIR%nodejs\node.exe"
                )
            )
            if not defined NODE_EXE if exist "%SCRIPT_DIR%_nodejs_temp\node.exe" (
                robocopy "%SCRIPT_DIR%_nodejs_temp" "%SCRIPT_DIR%nodejs" /E /NFL /NDL /NJH /NJS >nul
                set "NODE_EXE=%SCRIPT_DIR%nodejs\node.exe"
            )
            rd /s /q "%SCRIPT_DIR%_nodejs_temp" >nul 2>&1
        )
        if defined NODE_EXE goto :node_found
    )
)

if not defined NODE_EXE (
    echo [ERROR] Node.js not found!
    echo [ERROR] Install Node.js to C:\Program Files\nodejs OR provide node-*.zip in this folder.
    echo [%date% %time%] ERROR: Node.js not found >> "%LOG_FILE%"
    goto :end_fail
)

:node_found
echo [OK] Node.js: %NODE_EXE%
echo [%date% %time%] Node.js: %NODE_EXE% >> "%LOG_FILE%"
echo.

REM ==================== CHECK NSSM ====================
echo [CHECK] Looking for NSSM...
echo [%date% %time%] Looking for NSSM >> "%LOG_FILE%"
if not exist "%NSSM_EXE%" (
    echo [ERROR] nssm.exe not found at: %NSSM_EXE%
    echo [%date% %time%] ERROR: nssm.exe not found >> "%LOG_FILE%"
    goto :end_fail
)
echo [OK] NSSM found: %NSSM_EXE%
echo [%date% %time%] NSSM found >> "%LOG_FILE%"
echo.

REM ==================== CHECK FILES ====================
echo [CHECK] Verifying deployment files...
echo [%date% %time%] Checking files >> "%LOG_FILE%"
if not exist "%BACKEND_DIR%\server.js" (
    echo [ERROR] backend\server.js not found!
    echo [%date% %time%] ERROR: server.js missing >> "%LOG_FILE%"
    goto :end_fail
)
if not exist "%SCRIPT_DIR%frontend-server.js" (
    echo [ERROR] frontend-server.js not found!
    echo [%date% %time%] ERROR: frontend-server.js missing >> "%LOG_FILE%"
    goto :end_fail
)
if not exist "%SCRIPT_DIR%dist\index.html" (
    echo [ERROR] dist\index.html not found!
    echo [%date% %time%] ERROR: dist missing >> "%LOG_FILE%"
    goto :end_fail
)
echo [OK] All deployment files present
echo [%date% %time%] Files check passed >> "%LOG_FILE%"
echo.

REM ==================== CREATE LOG DIR ====================
if not exist "%SCRIPT_DIR%logs" mkdir "%SCRIPT_DIR%logs"

REM ==================== STOP OLD SERVICES ====================
echo [CLEANUP] Stopping existing services...
echo [%date% %time%] Cleanup old services >> "%LOG_FILE%"
"%NSSM_EXE%" stop %FRONTEND_SERVICE% >nul 2>&1
"%NSSM_EXE%" stop %BACKEND_SERVICE% >nul 2>&1
timeout /t 2 /nobreak >nul
"%NSSM_EXE%" remove %FRONTEND_SERVICE% confirm >nul 2>&1
"%NSSM_EXE%" remove %BACKEND_SERVICE% confirm >nul 2>&1
timeout /t 2 /nobreak >nul
echo [OK] Old services cleaned up
echo.

REM ==================== INSTALL BACKEND ====================
echo [INSTALL] Installing backend service...
echo [%date% %time%] Installing backend >> "%LOG_FILE%"

"%NSSM_EXE%" install %BACKEND_SERVICE% "%NODE_EXE%"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install backend service!
    echo [%date% %time%] ERROR: backend install failed >> "%LOG_FILE%"
    goto :end_fail
)
echo   [OK] nssm install PrinterStatusBackend - SUCCESS

"%NSSM_EXE%" set %BACKEND_SERVICE% AppParameters "server.js"
"%NSSM_EXE%" set %BACKEND_SERVICE% AppDirectory "%BACKEND_DIR%"
"%NSSM_EXE%" set %BACKEND_SERVICE% DisplayName "Printer Status Report - Backend"
"%NSSM_EXE%" set %BACKEND_SERVICE% Description "Printer monitoring backend (port %BACKEND_PORT%)"
"%NSSM_EXE%" set %BACKEND_SERVICE% Start SERVICE_AUTO_START
"%NSSM_EXE%" set %BACKEND_SERVICE% ObjectName LocalSystem
"%NSSM_EXE%" set %BACKEND_SERVICE% Type SERVICE_WIN32_OWN_PROCESS
"%NSSM_EXE%" set %BACKEND_SERVICE% AppStdout "%SCRIPT_DIR%logs\backend-service.log"
"%NSSM_EXE%" set %BACKEND_SERVICE% AppStderr "%SCRIPT_DIR%logs\backend-error.log"
"%NSSM_EXE%" set %BACKEND_SERVICE% AppStdoutCreationDisposition 4
"%NSSM_EXE%" set %BACKEND_SERVICE% AppStderrCreationDisposition 4
"%NSSM_EXE%" set %BACKEND_SERVICE% AppRotateFiles 1
"%NSSM_EXE%" set %BACKEND_SERVICE% AppRotateBytes 10485760
"%NSSM_EXE%" set %BACKEND_SERVICE% AppEnvironmentExtra "NODE_ENV=production" "BACKEND_PORT=%BACKEND_PORT%"
REM NSSM crash recovery: restart on exit
"%NSSM_EXE%" set %BACKEND_SERVICE% AppExit Default Restart
"%NSSM_EXE%" set %BACKEND_SERVICE% AppRestartDelay 5000

REM Use native sc.exe as fallback to GUARANTEE auto-start and LocalSystem
sc config %BACKEND_SERVICE% start= delayed-auto obj= "LocalSystem"
REM Configure Windows Service recovery: restart after 10s, 30s, 60s
sc failure %BACKEND_SERVICE% reset= 86400 actions= restart/10000/restart/30000/restart/60000

echo   [OK] Backend service configured (DelayedAutoStart, LocalSystem, Recovery)
echo [%date% %time%] Backend installed OK >> "%LOG_FILE%"

REM Verify backend settings
echo   [VERIFY] Checking backend service registration...
for /f "tokens=3" %%a in ('sc qc %BACKEND_SERVICE% ^| findstr "START_TYPE"') do (
    echo %%a | findstr "AUTO_START" >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo   [PASS] Backend start type: AUTO/DELAYED_START
    ) else (
        echo   [WARN] Backend start type unexpected: %%a
    )
)
for /f "tokens=2*" %%a in ('sc qc %BACKEND_SERVICE% ^| findstr "SERVICE_START_NAME"') do (
    echo   [INFO] Backend runs as: %%a %%b
)
echo [%date% %time%] Backend verification done >> "%LOG_FILE%"
echo.

REM ==================== INSTALL FRONTEND ====================
echo [INSTALL] Installing frontend service...
echo [%date% %time%] Installing frontend >> "%LOG_FILE%"

"%NSSM_EXE%" install %FRONTEND_SERVICE% "%NODE_EXE%"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install frontend service!
    echo [%date% %time%] ERROR: frontend install failed >> "%LOG_FILE%"
    goto :end_fail
)
echo   [OK] nssm install PrinterStatusFrontend - SUCCESS

"%NSSM_EXE%" set %FRONTEND_SERVICE% AppParameters "frontend-server.js"
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppDirectory "%FRONTEND_DIR%"
"%NSSM_EXE%" set %FRONTEND_SERVICE% DisplayName "Printer Status Report - Frontend"
"%NSSM_EXE%" set %FRONTEND_SERVICE% Description "Printer monitoring frontend (port %FRONTEND_PORT%)"
"%NSSM_EXE%" set %FRONTEND_SERVICE% Start SERVICE_AUTO_START
"%NSSM_EXE%" set %FRONTEND_SERVICE% ObjectName LocalSystem
"%NSSM_EXE%" set %FRONTEND_SERVICE% Type SERVICE_WIN32_OWN_PROCESS
"%NSSM_EXE%" set %FRONTEND_SERVICE% DependOnService %BACKEND_SERVICE%
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppStdout "%SCRIPT_DIR%logs\frontend-service.log"
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppStderr "%SCRIPT_DIR%logs\frontend-error.log"
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppStdoutCreationDisposition 4
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppStderrCreationDisposition 4
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppRotateFiles 1
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppRotateBytes 10485760
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppEnvironmentExtra "FRONTEND_PORT=%FRONTEND_PORT%" "BACKEND_PORT=%BACKEND_PORT%"
REM NSSM crash recovery: restart on exit
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppExit Default Restart
"%NSSM_EXE%" set %FRONTEND_SERVICE% AppRestartDelay 5000

REM Use native sc.exe as fallback to GUARANTEE auto-start and LocalSystem
sc config %FRONTEND_SERVICE% start= delayed-auto obj= "LocalSystem"
REM Configure Windows Service recovery: restart after 10s, 30s, 60s
sc failure %FRONTEND_SERVICE% reset= 86400 actions= restart/10000/restart/30000/restart/60000

echo   [OK] Frontend service configured (DelayedAutoStart, LocalSystem, DependsOn Backend, Recovery)
echo [%date% %time%] Frontend installed OK >> "%LOG_FILE%"

REM Verify frontend settings
echo   [VERIFY] Checking frontend service registration...
for /f "tokens=3" %%a in ('sc qc %FRONTEND_SERVICE% ^| findstr "START_TYPE"') do (
    echo %%a | findstr "AUTO_START" >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo   [PASS] Frontend start type: AUTO/DELAYED_START
    ) else (
        echo   [WARN] Frontend start type unexpected: %%a
    )
)
for /f "tokens=2*" %%a in ('sc qc %FRONTEND_SERVICE% ^| findstr "SERVICE_START_NAME"') do (
    echo   [INFO] Frontend runs as: %%a %%b
)
echo [%date% %time%] Frontend verification done >> "%LOG_FILE%"
echo.

REM ==================== START SERVICES ====================
echo [START] Starting backend service...
"%NSSM_EXE%" start %BACKEND_SERVICE%
echo [%date% %time%] Backend start sent >> "%LOG_FILE%"

echo [START] Waiting 3 seconds...
timeout /t 3 /nobreak >nul

echo [START] Starting frontend service...
"%NSSM_EXE%" start %FRONTEND_SERVICE%
echo [%date% %time%] Frontend start sent >> "%LOG_FILE%"

timeout /t 2 /nobreak >nul
echo.

REM ==================== VERIFY ====================
echo.
echo ======================================================
echo   SERVICE STATUS VERIFICATION
echo ======================================================
echo.

REM Check backend
set "BACKEND_OK=0"
for /f "tokens=*" %%s in ('"%NSSM_EXE%" status %BACKEND_SERVICE% 2^>nul') do (
    echo   PrinterStatusBackend : %%s
    echo %%s | findstr "SERVICE_RUNNING" >nul 2>&1 && set "BACKEND_OK=1"
)
if "%BACKEND_OK%"=="1" (
    echo   [PASS] Backend is RUNNING on port %BACKEND_PORT%
) else (
    echo   [FAIL] Backend is NOT running!
    echo          Check: logs\backend-error.log
)
echo.

REM Check frontend
set "FRONTEND_OK=0"
for /f "tokens=*" %%s in ('"%NSSM_EXE%" status %FRONTEND_SERVICE% 2^>nul') do (
    echo   PrinterStatusFrontend: %%s
    echo %%s | findstr "SERVICE_RUNNING" >nul 2>&1 && set "FRONTEND_OK=1"
)
if "%FRONTEND_OK%"=="1" (
    echo   [PASS] Frontend is RUNNING on port %FRONTEND_PORT%
) else (
    echo   [FAIL] Frontend is NOT running!
    echo          Check: logs\frontend-error.log
)
echo.

REM Quick connectivity test
echo [TEST] Testing port connectivity...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%FRONTEND_PORT%' -TimeoutSec 5 -UseBasicParsing; Write-Host '  [PASS] http://localhost:%FRONTEND_PORT% - HTTP' $r.StatusCode } catch { Write-Host '  [FAIL] http://localhost:%FRONTEND_PORT% - Not responding' }" 2>nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%BACKEND_PORT%/api/health' -TimeoutSec 5 -UseBasicParsing; Write-Host '  [PASS] http://localhost:%BACKEND_PORT%/api/health - HTTP' $r.StatusCode } catch { Write-Host '  [FAIL] http://localhost:%BACKEND_PORT%/api/health - Not responding' }" 2>nul
echo.

REM Show Windows Services list
echo [INFO] Registered Windows Services:
sc query %BACKEND_SERVICE% | findstr "STATE"
sc query %FRONTEND_SERVICE% | findstr "STATE"
echo.

REM ==================== PERSISTENCE VERIFICATION ====================
echo.
echo ======================================================
echo   PERSISTENCE VERIFICATION (Reboot + Logoff Safety)
echo ======================================================
echo.
echo [CHECK] Verifying services will survive reboot and logoff...
echo.

REM Verify auto-start
sc qc %BACKEND_SERVICE% | findstr "AUTO_START" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo   [PASS] Backend: AUTO_START/DELAYED_START (will start on reboot)
) else (
    echo   [FAIL] Backend: NOT set to AUTO_START!
    echo          Fix: sc config %BACKEND_SERVICE% start= delayed-auto
    echo [%date% %time%] FAIL: Backend not AUTO_START >> "%LOG_FILE%"
)

sc qc %FRONTEND_SERVICE% | findstr "AUTO_START" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo   [PASS] Frontend: AUTO_START/DELAYED_START (will start on reboot)
) else (
    echo   [FAIL] Frontend: NOT set to AUTO_START!
    echo          Fix: sc config %FRONTEND_SERVICE% start= delayed-auto
    echo [%date% %time%] FAIL: Frontend not AUTO_START >> "%LOG_FILE%"
)

REM Verify LocalSystem (service runs independently of user session)
sc qc %BACKEND_SERVICE% | findstr /C:"LocalSystem" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo   [PASS] Backend: runs as LocalSystem (survives logoff)
) else (
    echo   [FAIL] Backend: NOT running as LocalSystem!
    echo          Fix: sc config %BACKEND_SERVICE% obj= "LocalSystem"
    echo [%date% %time%] FAIL: Backend not LocalSystem >> "%LOG_FILE%"
)

sc qc %FRONTEND_SERVICE% | findstr /C:"LocalSystem" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo   [PASS] Frontend: runs as LocalSystem (survives logoff)
) else (
    echo   [FAIL] Frontend: NOT running as LocalSystem!
    echo          Fix: sc config %FRONTEND_SERVICE% obj= "LocalSystem"
    echo [%date% %time%] FAIL: Frontend not LocalSystem >> "%LOG_FILE%"
)

REM Verify recovery policy
sc qfailure %BACKEND_SERVICE% | findstr "RESTART" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo   [PASS] Backend: crash recovery (auto-restart on failure)
) else (
    echo   [WARN] Backend: no crash recovery policy
)

sc qfailure %FRONTEND_SERVICE% | findstr "RESTART" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo   [PASS] Frontend: crash recovery (auto-restart on failure)
) else (
    echo   [WARN] Frontend: no crash recovery policy
)
echo.
echo [%date% %time%] Persistence verification done >> "%LOG_FILE%"

REM ==================== FIREWALL ====================
echo [FIREWALL] Adding firewall rules...
netsh advfirewall firewall delete rule name="PrinterStatus-Backend" >nul 2>&1
netsh advfirewall firewall add rule name="PrinterStatus-Backend" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1
netsh advfirewall firewall delete rule name="PrinterStatus-Frontend" >nul 2>&1
netsh advfirewall firewall add rule name="PrinterStatus-Frontend" dir=in action=allow protocol=TCP localport=%FRONTEND_PORT% >nul 2>&1
echo [OK] Firewall rules added
echo.

REM ==================== SUCCESS ====================
echo [%date% %time%] Installation completed >> "%LOG_FILE%"
echo ======================================================
echo   Installation Complete!
echo ======================================================
echo.
if "%BACKEND_OK%"=="1" if "%FRONTEND_OK%"=="1" (
    echo   [SUCCESS] Both services are running!
    echo.
    echo   Access URL : http://localhost:%FRONTEND_PORT%
    echo   LAN access : http://[THIS_SERVER_IP]:%FRONTEND_PORT%
    echo.
    echo   You can now sign out - services will keep running.
    echo   Services will auto-start on server reboot.
) else (
    echo   [WARNING] One or more services failed to start.
    echo   Check the logs\ folder for error details.
)
echo.
echo   Management commands (run as Admin):
echo     nssm status PrinterStatusBackend
echo     nssm status PrinterStatusFrontend
echo     nssm restart PrinterStatusBackend
echo     nssm restart PrinterStatusFrontend
echo     nssm remove PrinterStatusBackend confirm
echo     nssm remove PrinterStatusFrontend confirm
echo.
echo   Log files:
echo     logs\backend-service.log
echo     logs\backend-error.log
echo     logs\frontend-service.log
echo     logs\frontend-error.log
echo.
goto :end_ok

:end_fail
echo.
echo ======================================================
echo   Installation FAILED - see errors above
echo ======================================================
echo.
echo   Log file: %LOG_FILE%
echo.
pause

:end_ok
pause
echo.
echo Press any key to close...
pause >nul
