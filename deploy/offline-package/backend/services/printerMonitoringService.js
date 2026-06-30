const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const printerService = require('./printerService');

const PRINTERS_FILE = path.join(__dirname, '../config/printers.json');

function parseIntWithDefault(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const BASE_MONITOR_INTERVAL_MS = parseIntWithDefault(process.env.PRINTER_MONITOR_INTERVAL_MS, 30000);
const MAX_MONITOR_INTERVAL_MS = parseIntWithDefault(process.env.PRINTER_MONITOR_MAX_INTERVAL_MS, BASE_MONITOR_INTERVAL_MS * 4);
const MONITOR_BACKOFF_ENABLED = process.env.PRINTER_MONITOR_BACKOFF === 'true';
const MONITOR_BACKOFF_MULTIPLIER = Number.parseFloat(process.env.PRINTER_MONITOR_BACKOFF_MULTIPLIER || '1.5') > 1
  ? Number.parseFloat(process.env.PRINTER_MONITOR_BACKOFF_MULTIPLIER || '1.5')
  : 1.5;

function normalizeMonitorConfig(raw = {}, defaults = {}) {
  const baseIntervalMs = parseIntWithDefault(raw.intervalMs, defaults.baseIntervalMs);
  const maxIntervalMs = parseIntWithDefault(raw.maxIntervalMs, Math.max(defaults.maxIntervalMs || baseIntervalMs, baseIntervalMs));
  const parsedMultiplier = Number.parseFloat(raw.backoffMultiplier);
  const backoffMultiplier = Number.isFinite(parsedMultiplier) && parsedMultiplier > 1
    ? parsedMultiplier
    : defaults.backoffMultiplier;
  const backoffEnabled = typeof raw.backoffEnabled === 'boolean' ? raw.backoffEnabled : defaults.backoffEnabled;

  return {
    baseIntervalMs,
    maxIntervalMs: Math.max(maxIntervalMs, baseIntervalMs),
    backoffEnabled,
    backoffMultiplier
  };
}

class PrinterMonitoringService {
  constructor() {
    this.monitorInterval = null;
    this.dailySnapshotTimer = null;
    this.dailySnapshotNextRunAt = null;
    this.alertService = null;
    this.isChecking = false;
    this.cachedPrinters = null;
    this.cacheTime = 0;
    this.CACHE_TTL = 10000; // 10s cache for printer config
    this.lastRunAt = null;
    this.lastRunDurationMs = null;
    this.lastError = null;
    this.runCount = 0;
    this.skippedRunCount = 0;
    this.startedAt = null;
    this.monitorConfig = {
      baseIntervalMs: BASE_MONITOR_INTERVAL_MS,
      maxIntervalMs: MAX_MONITOR_INTERVAL_MS,
      backoffEnabled: MONITOR_BACKOFF_ENABLED,
      backoffMultiplier: MONITOR_BACKOFF_MULTIPLIER
    };
    this.currentIntervalMs = this.monitorConfig.baseIntervalMs;
    this.nextCheckAt = null;
    this.lastRunHadOffline = false;
  }

  init(alertService) {
    this.alertService = alertService;
  }

  async loadPrinters() {
    const now = Date.now();
    if (this.cachedPrinters && (now - this.cacheTime) < this.CACHE_TTL) {
      return this.cachedPrinters;
    }

    try {
      const data = await fs.readFile(PRINTERS_FILE, 'utf8');
      const printers = JSON.parse(data);
      this.cachedPrinters = Array.isArray(printers) ? printers : [];
      this.cacheTime = now;
      return this.cachedPrinters;
    } catch (error) {
      if (error.code === 'ENOENT') return this.cachedPrinters || [];
      console.error('[PrinterMonitoring] Failed to load printers:', error.message);
      return this.cachedPrinters || [];
    }
  }

  // Invalidate cache when printers are updated externally
  invalidateCache() {
    this.cachedPrinters = null;
    this.cacheTime = 0;
  }

  startMonitoring() {
    if (this.monitorInterval) {
      clearTimeout(this.monitorInterval);
    }

    this.currentIntervalMs = this.monitorConfig.baseIntervalMs;
    console.log(`[PrinterMonitoring] Starting monitoring (${this.monitorConfig.baseIntervalMs}ms interval, backoff ${this.monitorConfig.backoffEnabled ? 'enabled' : 'disabled'})`);
    this.startedAt = Date.now();
    this.scheduleNextCheck(0);

    this.scheduleDailySnapshotTask();
  }

  scheduleNextCheck(delayMs = this.currentIntervalMs) {
    if (this.monitorInterval) {
      clearTimeout(this.monitorInterval);
    }

    this.nextCheckAt = new Date(Date.now() + delayMs).toISOString();

    this.monitorInterval = setTimeout(async () => {
      let hadError = false;
      try {
        await this.checkAllPrinters();
      } catch (error) {
        hadError = true;
        console.error('[PrinterMonitoring] Scheduled check failed:', error.message);
      } finally {
        this.updateNextInterval(hadError || this.lastRunHadOffline);
        this.scheduleNextCheck(this.currentIntervalMs);
      }
    }, delayMs);
  }

  updateNextInterval(hasDegradedTargets) {
    if (!this.monitorConfig.backoffEnabled) {
      this.currentIntervalMs = this.monitorConfig.baseIntervalMs;
      return;
    }

    if (hasDegradedTargets) {
      this.currentIntervalMs = Math.min(
        this.monitorConfig.maxIntervalMs,
        Math.round(this.currentIntervalMs * this.monitorConfig.backoffMultiplier)
      );
      return;
    }

    this.currentIntervalMs = this.monitorConfig.baseIntervalMs;
  }

  applySettings(settings = {}) {
    this.monitorConfig = normalizeMonitorConfig(settings, this.monitorConfig);

    if (!this.monitorInterval) {
      this.currentIntervalMs = this.monitorConfig.baseIntervalMs;
      return;
    }

    this.currentIntervalMs = this.monitorConfig.baseIntervalMs;
    this.scheduleNextCheck(0);
    console.log(`[PrinterMonitoring] Runtime config updated: interval=${this.monitorConfig.baseIntervalMs}ms backoff=${this.monitorConfig.backoffEnabled}`);
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearTimeout(this.monitorInterval);
      this.monitorInterval = null;
      this.nextCheckAt = null;
    }

    if (this.dailySnapshotTimer) {
      clearTimeout(this.dailySnapshotTimer);
      this.dailySnapshotTimer = null;
      this.dailySnapshotNextRunAt = null;
    }
  }

  scheduleDailySnapshotTask() {
    if (this.dailySnapshotTimer) {
      clearTimeout(this.dailySnapshotTimer);
      this.dailySnapshotTimer = null;
    }

    const now = new Date();
    const next = new Date(now);
    // Run once per day at 00:05 to ensure a daily analytics snapshot exists.
    next.setHours(0, 5, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    const delayMs = next.getTime() - now.getTime();
    this.dailySnapshotNextRunAt = next.toISOString();

    this.dailySnapshotTimer = setTimeout(async () => {
      try {
        await this.runDailySnapshotTask();
      } catch (error) {
        console.error('[PrinterMonitoring] Daily snapshot task failed:', error.message);
      } finally {
        this.scheduleDailySnapshotTask();
      }
    }, delayMs);

    console.log(`[PrinterMonitoring] Daily snapshot scheduled at ${this.dailySnapshotNextRunAt}`);
  }

  async runDailySnapshotTask() {
    const analyticsService = require('./printAnalyticsService');
    let statuses = printerService.getLastKnownStatuses().statuses || [];

    if (!Array.isArray(statuses) || statuses.length === 0) {
      const allPrinters = await this.loadPrinters();
      const printers = allPrinters.filter((p) => !p.isTest);
      if (printers.length === 0) return;
      statuses = await printerService.getPrintersStatus(printers, {});
    }

    const printerData = statuses
      .filter((p) => p.online && p.pageCount)
      .map((p) => ({ name: p.name, ip: p.ip, location: p.location, pageCount: p.pageCount }));

    if (printerData.length === 0) {
      console.log('[PrinterMonitoring] Daily snapshot skipped: no online printers with page counts');
      return;
    }

    analyticsService.recordPageCounts(printerData);
    console.log(`[PrinterMonitoring] Daily analytics snapshot written for ${printerData.length} printers`);
  }

  async checkAllPrinters() {
    if (this.isChecking) {
      this.skippedRunCount += 1;
      return;
    }

    this.isChecking = true;
    const startedAt = Date.now();

    try {
      const allPrinters = await this.loadPrinters();
      // Skip printers in maintenance mode (isTest)
      const printers = allPrinters.filter(p => !p.isTest);
      if (printers.length === 0) {
        return;
      }

      // Clear previousOnlineMap for printers that entered maintenance mode
      const activeIps = new Set(printers.map(p => p.ip));
      for (const ip of Object.keys(printerService.previousOnlineMap)) {
        if (!activeIps.has(ip)) {
          delete printerService.previousOnlineMap[ip];
        }
      }

      const statuses = await printerService.getPrintersStatus(printers, {});
      this.lastRunHadOffline = statuses.some((printer) => !printer.online || printer.status === 'offline');

      if (this.alertService) {
        this.alertService.processStatusUpdate(statuses);
      }
      this.lastError = null;
      this.runCount += 1;
      this.lastRunAt = Date.now();
      this.lastRunDurationMs = this.lastRunAt - startedAt;
    } catch (error) {
      this.lastRunHadOffline = true;
      this.lastError = error.message;
      this.lastRunAt = Date.now();
      this.lastRunDurationMs = this.lastRunAt - startedAt;
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  getRuntimeStats() {
    return {
      intervalMs: this.currentIntervalMs,
      baseIntervalMs: this.monitorConfig.baseIntervalMs,
      maxIntervalMs: this.monitorConfig.maxIntervalMs,
      backoffEnabled: this.monitorConfig.backoffEnabled,
      backoffMultiplier: this.monitorConfig.backoffMultiplier,
      nextCheckAt: this.nextCheckAt,
      isChecking: this.isChecking,
      startedAt: this.startedAt,
      runCount: this.runCount,
      skippedRunCount: this.skippedRunCount,
      lastRunAt: this.lastRunAt,
      lastRunDurationMs: this.lastRunDurationMs,
      lastError: this.lastError,
      dailySnapshotNextRunAt: this.dailySnapshotNextRunAt
    };
  }
}

module.exports = new PrinterMonitoringService();