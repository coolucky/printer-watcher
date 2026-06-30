# Printer Status Report - Desktop Support Runbook

## Scope

This runbook is for first-line desktop support and operations staff handling offline Windows deployments.

## Service Topology

- Frontend service: PrinterStatusFrontend (port 9191)
- Backend service: PrinterStatusBackend (port 3001)
- Service manager: NSSM

## 10-Minute Triage Flow

1. Confirm both services are running.
2. Confirm local HTTP endpoints respond.
3. Check recent error logs.
4. Restart services if needed.
5. Re-check endpoints.
6. Escalate with attached logs if still failing.

## Step 1: Check Service Status

Run as Administrator in deployment root:

```cmd
nssm status PrinterStatusBackend
nssm status PrinterStatusFrontend
```

Expected output: SERVICE_RUNNING

## Step 2: Check HTTP Endpoints

```cmd
curl http://localhost:9191
curl http://localhost:3001/api/health
curl http://localhost:3001/api/health/runtime
```

Expected:

- Frontend endpoint returns HTML.
- Health endpoint returns success JSON.
- Runtime endpoint returns process and monitoring stats.

## Step 3: Check Logs

Primary logs:

- logs\backend-service.log
- logs\backend-error.log
- logs\frontend-service.log
- logs\frontend-error.log
- install-service.log

Quick view:

```cmd
powershell -Command "Get-Content .\logs\backend-error.log -Tail 80"
powershell -Command "Get-Content .\logs\frontend-error.log -Tail 80"
```

## Step 4: Controlled Restart

```cmd
nssm restart PrinterStatusBackend
timeout /t 3 /nobreak
nssm restart PrinterStatusFrontend
```

Re-run the HTTP checks after restart.

## Common Symptoms and Actions

1. Symptom: Frontend not reachable on 9191.
Action: Check PrinterStatusFrontend status and frontend logs. Confirm firewall rule for 9191.

2. Symptom: Frontend loads but API errors.
Action: Check PrinterStatusBackend status and backend logs. Verify localhost:3001 health endpoint.

3. Symptom: Services stop after sign out.
Action: Confirm services were installed with install-service.bat, not started with start-service.bat.

4. Symptom: Asset inventory page blank.
Action: Confirm dist\asset-inventory\scripts\lib\exceljs.min.js exists in deployment directory.

## Escalation Package

Provide these files when escalating:

- install-service.log
- logs\backend-error.log
- logs\frontend-error.log
- Output of `nssm status PrinterStatusBackend`
- Output of `nssm status PrinterStatusFrontend`
- Output of `curl http://localhost:3001/api/health/runtime`

## Recovery Baseline

If deployment files are damaged:

1. Stop and uninstall services.
2. Re-extract latest offline zip package.
3. Run install-service.bat as Administrator.
4. Validate with health endpoints.
