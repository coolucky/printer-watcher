# Backup and Restore Drill Runbook

## Goal

Validate that backup and restore procedures are operational and measurable.

## Suggested Frequency

- Monthly for production-like environment.
- After major deployment changes.

## Drill Targets

- RTO target: recover service within 30 minutes.
- RPO target: data loss not more than 5 minutes for operational data.

## Drill Procedure

1. Record drill start time.
2. Run backup script.
3. Simulate data drift by editing a non-critical test entry.
4. Run restore script from latest backup.
5. Restart services.
6. Verify health endpoints and key data integrity.
7. Record drill end time and total recovery duration.

## Commands

```bash
./backup-full-data.sh
./restore-full-data.sh
```

```cmd
nssm restart PrinterStatusBackend
nssm restart PrinterStatusFrontend
curl http://localhost:3001/api/health
curl http://localhost:3001/api/health/runtime
```

## Verification Checklist

- Latest backup folder exists under backup-data.
- Backup manifest and checksum files exist.
- Restored settings and user data are readable.
- Frontend available on port 9191.
- Backend health endpoint responds with status ok.
- Runtime monitoring endpoint returns monitoring stats.

## Drill Record Template

- Drill date:
- Operator:
- Backup folder used:
- RTO actual:
- RPO observed:
- Issues found:
- Corrective actions:
