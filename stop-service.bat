@echo off
setlocal

title Stop Printer Status Report

echo ======================================================
echo   Stopping Printer Status Report services...
echo ======================================================
echo.

echo [STOP] Closing backend...
taskkill /FI "WINDOWTITLE eq PrinterStatus-Backend*" /F >nul 2>&1

echo [STOP] Closing frontend...
taskkill /FI "WINDOWTITLE eq PrinterStatus-Frontend*" /F >nul 2>&1

REM Also kill by port in case window titles don't match
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":9191 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)

echo.
echo [DONE] All services stopped.
echo.
pause
