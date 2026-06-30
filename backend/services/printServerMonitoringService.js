/**
 * Print Server Monitoring Service
 * Monitors print servers via ping every 30 seconds
 * Records status history for timeline display
 * Triggers alerts on offline/recovery events
 */
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

const SERVERS_FILE = path.join(__dirname, '../config/printServers.json');
const HISTORY_FILE = path.join(__dirname, '../config/printServerHistory.json');
const LOGS_FILE = path.join(__dirname, '../config/printServerLogs.json');

function parseIntWithDefault(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Configuration
const BASE_PING_INTERVAL = parseIntWithDefault(process.env.PRINT_SERVER_MONITOR_INTERVAL_MS, 30000); // 30 seconds
const MAX_PING_INTERVAL = parseIntWithDefault(process.env.PRINT_SERVER_MONITOR_MAX_INTERVAL_MS, BASE_PING_INTERVAL * 4);
const PING_BACKOFF_ENABLED = process.env.PRINT_SERVER_MONITOR_BACKOFF === 'true';
const PING_BACKOFF_MULTIPLIER = Number.parseFloat(process.env.PRINT_SERVER_MONITOR_BACKOFF_MULTIPLIER || '1.5') > 1
  ? Number.parseFloat(process.env.PRINT_SERVER_MONITOR_BACKOFF_MULTIPLIER || '1.5')
  : 1.5;
const PING_TIMEOUT = 5000; // 5 seconds timeout
const CONSECUTIVE_FAILURES_THRESHOLD = 2; // 2 consecutive failures = offline
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const HISTORY_RETENTION_DAYS = 30;

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

class PrintServerMonitoringService {
  constructor() {
    this.servers = this.loadServers();
    this.history = this.loadHistory();
    this.logs = this.loadLogs();
    this.monitorInterval = null;
    this.alertService = null;
    // Track consecutive failures per server: { [serverId]: count }
    this.consecutiveFailures = {};
    // Track current status per server: { [serverId]: { online: bool, since: timestamp } }
    this.currentStatus = {};
    // Track last alert time per server: { [serverId]: timestamp }
    this.lastAlertTime = {};
    this.startedAt = null;
    this.lastRunAt = null;
    this.lastRunDurationMs = null;
    this.lastError = null;
    this.runCount = 0;
    this.monitorConfig = {
      baseIntervalMs: BASE_PING_INTERVAL,
      maxIntervalMs: MAX_PING_INTERVAL,
      backoffEnabled: PING_BACKOFF_ENABLED,
      backoffMultiplier: PING_BACKOFF_MULTIPLIER
    };
    this.currentIntervalMs = this.monitorConfig.baseIntervalMs;
    this.nextCheckAt = null;
  }

  /**
   * Initialize with alert service reference
   */
  init(alertService) {
    this.alertService = alertService;
    // Initialize current status from history
    for (const server of this.servers) {
      const serverHistory = this.history[server.id];
      if (serverHistory && serverHistory.length > 0) {
        const lastEntry = serverHistory[serverHistory.length - 1];
        this.currentStatus[server.id] = {
          online: lastEntry.status === 'online',
          since: lastEntry.timestamp
        };
      } else {
        this.currentStatus[server.id] = { online: true, since: Date.now() };
      }
      this.consecutiveFailures[server.id] = 0;
    }
  }

  // ==================== Data Persistence ====================

  loadServers() {
    try {
      if (fs.existsSync(SERVERS_FILE)) {
        const data = fs.readFileSync(SERVERS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[PrintServer] Error loading servers:', error.message);
    }
    return [];
  }

  saveServers() {
    fsPromises.writeFile(SERVERS_FILE, JSON.stringify(this.servers, null, 2), 'utf8')
      .catch(error => console.error('[PrintServer] Error saving servers:', error.message));
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[PrintServer] Error loading history:', error.message);
    }
    return {};
  }

  saveHistory() {
    fsPromises.writeFile(HISTORY_FILE, JSON.stringify(this.history, null, 2), 'utf8')
      .catch(error => console.error('[PrintServer] Error saving history:', error.message));
  }

  loadLogs() {
    try {
      if (fs.existsSync(LOGS_FILE)) {
        const data = fs.readFileSync(LOGS_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[PrintServer] Error loading logs:', error.message);
    }
    return [];
  }

  saveLogs() {
    fsPromises.writeFile(LOGS_FILE, JSON.stringify(this.logs, null, 2), 'utf8')
      .catch(error => console.error('[PrintServer] Error saving logs:', error.message));
  }

  // ==================== CRUD Operations ====================

  getServers() {
    return this.servers;
  }

  getServer(id) {
    return this.servers.find(s => s.id === id);
  }

  addServer(serverData) {
    const id = `ps_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const server = {
      id,
      name: serverData.name,
      ip: serverData.ip,
      enabled: serverData.enabled !== false,
      createdAt: new Date().toISOString()
    };
    this.servers.push(server);
    this.saveServers();
    // Initialize monitoring state
    this.consecutiveFailures[id] = 0;
    this.currentStatus[id] = { online: true, since: Date.now() };
    this.history[id] = [];
    this.saveHistory();
    return server;
  }

  updateServer(id, updates) {
    const index = this.servers.findIndex(s => s.id === id);
    if (index === -1) return null;
    const prev = this.servers[index];
    this.servers[index] = { ...prev, ...updates, id };
    this.saveServers();
    // When monitoring is disabled, reset failure tracking to avoid stale alerts on re-enable
    if (prev.enabled && updates.enabled === false) {
      this.consecutiveFailures[id] = 0;
      this.currentStatus[id] = { online: true, since: Date.now() };
      delete this.lastAlertTime[id];
      console.log(`[PrintServer] Monitoring disabled for ${prev.name}, reset alert state`);
    }
    return this.servers[index];
  }

  deleteServer(id) {
    const index = this.servers.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.servers.splice(index, 1);
    this.saveServers();
    // Clean up monitoring state
    delete this.consecutiveFailures[id];
    delete this.currentStatus[id];
    delete this.lastAlertTime[id];
    delete this.history[id];
    this.saveHistory();
    // Remove logs for this server
    this.logs = this.logs.filter(log => log.serverId !== id);
    this.saveLogs();
    return true;
  }

  // ==================== Monitoring ====================

  startMonitoring() {
    if (this.monitorInterval) {
      clearTimeout(this.monitorInterval);
    }
    this.currentIntervalMs = this.monitorConfig.baseIntervalMs;
    console.log(`[PrintServer] Starting monitoring (${this.monitorConfig.baseIntervalMs}ms interval, backoff ${this.monitorConfig.backoffEnabled ? 'enabled' : 'disabled'})`);
    this.startedAt = Date.now();
    this.scheduleNextCheck(0);
  }

  scheduleNextCheck(delayMs = this.currentIntervalMs) {
    if (this.monitorInterval) {
      clearTimeout(this.monitorInterval);
    }

    this.nextCheckAt = new Date(Date.now() + delayMs).toISOString();

    this.monitorInterval = setTimeout(async () => {
      const hasDegradedTargets = await this.checkAllServers();
      this.updateNextInterval(hasDegradedTargets);
      this.scheduleNextCheck(this.currentIntervalMs);
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
    console.log(`[PrintServer] Runtime config updated: interval=${this.monitorConfig.baseIntervalMs}ms backoff=${this.monitorConfig.backoffEnabled}`);
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearTimeout(this.monitorInterval);
      this.monitorInterval = null;
      this.nextCheckAt = null;
    }
    console.log('[PrintServer] Monitoring stopped');
  }

  async checkAllServers() {
    const startedAt = Date.now();
    const enabledServers = this.servers.filter(s => s.enabled);
    if (enabledServers.length === 0) {
      this.lastRunAt = Date.now();
      this.lastRunDurationMs = this.lastRunAt - startedAt;
      this.lastError = null;
      this.runCount += 1;
      return false;
    }

    try {
      const results = await Promise.all(
        enabledServers.map(server => this.pingServer(server))
      );

      const now = Date.now();
      for (let i = 0; i < enabledServers.length; i++) {
        const server = enabledServers[i];
        const isReachable = results[i];
        this.processResult(server, isReachable, now);
      }

      const hasUnreachable = results.some((isReachable) => !isReachable);

      this.lastRunAt = Date.now();
      this.lastRunDurationMs = this.lastRunAt - startedAt;
      this.lastError = null;
      this.runCount += 1;
      return hasUnreachable;
    } catch (error) {
      this.lastRunAt = Date.now();
      this.lastRunDurationMs = this.lastRunAt - startedAt;
      this.lastError = error.message;
      console.error('[PrintServer] Scheduled check failed:', error.message);
      return true;
    }
  }

  /**
   * Ping a server to check if it's online
   */
  pingServer(server) {
    return new Promise((resolve) => {
      const platform = process.platform;
      let pingCmd;
      if (platform === 'win32') {
        // Windows: -w is in milliseconds
        pingCmd = `ping -n 1 -w ${PING_TIMEOUT} ${server.ip}`;
      } else if (platform === 'darwin') {
        // macOS: -W is in milliseconds
        pingCmd = `ping -c 1 -W ${PING_TIMEOUT} ${server.ip}`;
      } else {
        // Linux: -W is in seconds
        pingCmd = `ping -c 1 -W ${Math.ceil(PING_TIMEOUT / 1000)} ${server.ip}`;
      }

      exec(pingCmd, { timeout: PING_TIMEOUT + 2000 }, (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          // Check for TTL or success indicators
          const output = stdout.toLowerCase();
          resolve(output.includes('ttl=') || output.includes('time=') || output.includes('bytes from'));
        }
      });
    });
  }

  /**
   * Process ping result for a server
   */
  processResult(server, isReachable, now) {
    const prevStatus = this.currentStatus[server.id];

    if (isReachable) {
      // Reset consecutive failures
      this.consecutiveFailures[server.id] = 0;

      if (!prevStatus || !prevStatus.online) {
        // Recovery: was offline, now online
        this.currentStatus[server.id] = { online: true, since: now };
        this.addHistoryEntry(server.id, 'online', now);
        this.addLogEntry(server, 'recovery', now, prevStatus?.since);
        this.sendServerAlert(server, 'recovery', prevStatus?.since, now);
      }
    } else {
      // Increment consecutive failures
      this.consecutiveFailures[server.id] = (this.consecutiveFailures[server.id] || 0) + 1;

      if (this.consecutiveFailures[server.id] >= CONSECUTIVE_FAILURES_THRESHOLD) {
        if (!prevStatus || prevStatus.online) {
          // Transition to offline
          this.currentStatus[server.id] = { online: false, since: now };
          this.addHistoryEntry(server.id, 'offline', now);
          this.addLogEntry(server, 'offline', now);
          this.sendServerAlert(server, 'offline', now);
        }
      }
    }

    // Always add a data point for the timeline
    this.addTimelinePoint(server.id, isReachable ? 'online' : 'unreachable', now);
  }

  /**
   * Add a status change entry to history
   */
  addHistoryEntry(serverId, status, timestamp) {
    if (!this.history[serverId]) {
      this.history[serverId] = [];
    }
    this.history[serverId].push({ status, timestamp });
    this.cleanupHistory(serverId);
    this.saveHistory();
  }

  /**
   * Add timeline data point (for Grafana-style display)
   */
  addTimelinePoint(serverId, status, timestamp) {
    if (!this.history[serverId]) {
      this.history[serverId] = [];
    }
    const lastEntry = this.history[serverId][this.history[serverId].length - 1];
    // Only add if status changed or it's been more than 30 seconds
    if (!lastEntry || lastEntry.status !== status || (timestamp - lastEntry.timestamp) >= 30000) {
      this.history[serverId].push({ status, timestamp });
      this.cleanupHistory(serverId);
      this.saveHistory();
    }
  }

  /**
   * Add a log entry
   */
  addLogEntry(server, event, timestamp, previousTimestamp) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      serverId: server.id,
      serverName: server.name,
      serverIp: server.ip,
      event, // 'offline' | 'recovery'
      timestamp,
      date: new Date(timestamp).toISOString()
    };

    if (event === 'recovery' && previousTimestamp) {
      entry.downtimeMs = timestamp - previousTimestamp;
      entry.downtime = this.formatDuration(timestamp - previousTimestamp);
    }

    this.logs.push(entry);
    this.cleanupLogs();
    this.saveLogs();
  }

  /**
   * Send alert for server status change
   */
  sendServerAlert(server, event, ...args) {
    if (!this.alertService) return;
    // Only send alerts for servers with monitoring enabled
    if (!server.enabled) {
      console.log(`[PrintServer] Monitoring disabled for ${server.name}, skipping alert`);
      return;
    }
    const config = this.alertService.getConfig();
    if (!config.serverAlertEnabled) return;

    const now = Date.now();
    const lastAlert = this.lastAlertTime[server.id] || 0;

    // Cooldown check (skip for recovery)
    if (event === 'offline' && (now - lastAlert) < ALERT_COOLDOWN) {
      console.log(`[PrintServer] Alert cooldown active for ${server.name}, skipping`);
      return;
    }

    this.lastAlertTime[server.id] = now;

    if (event === 'offline') {
      this.alertService.sendPrintServerOfflineAlert(server);
    } else if (event === 'recovery') {
      const [offlineSince, recoveryTime] = args;
      const downtimeMs = offlineSince ? recoveryTime - offlineSince : 0;
      this.alertService.sendPrintServerRecoveryAlert(server, downtimeMs);
    }
  }

  // ==================== Data Retrieval ====================

  /**
   * Get current status of all servers
   * @param {boolean} enabledOnly - If true, only return enabled servers
   */
  getAllStatus(enabledOnly = false) {
    const list = enabledOnly ? this.servers.filter(s => s.enabled) : this.servers;
    return list.map(server => ({
      ...server,
      online: this.currentStatus[server.id]?.online ?? true,
      statusSince: this.currentStatus[server.id]?.since || null
    }));
  }

  /**
   * Get timeline history for a server within a time range
   */
  getTimeline(serverId, startTime, endTime) {
    const serverHistory = this.history[serverId] || [];
    return serverHistory.filter(entry =>
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Get all timeline data for all servers within a time range
   * @param {boolean} enabledOnly - If true, only return enabled servers
   */
  getAllTimelines(startTime, endTime, enabledOnly = false) {
    const result = {};
    const list = enabledOnly ? this.servers.filter(s => s.enabled) : this.servers;
    for (const server of list) {
      result[server.id] = this.getTimeline(server.id, startTime, endTime);
    }
    return result;
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filters = {}) {
    let logs = [...this.logs];

    if (filters.serverId) {
      logs = logs.filter(l => l.serverId === filters.serverId);
    }
    if (filters.event) {
      logs = logs.filter(l => l.event === filters.event);
    }
    if (filters.startTime) {
      logs = logs.filter(l => l.timestamp >= filters.startTime);
    }
    if (filters.endTime) {
      logs = logs.filter(l => l.timestamp <= filters.endTime);
    }

    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Pagination
    if (filters.limit) {
      const offset = filters.offset || 0;
      logs = logs.slice(offset, offset + filters.limit);
    }

    return logs;
  }

  /**
   * Get uptime statistics for a server
   */
  getUptimeStats(serverId, startTime, endTime) {
    const timeline = this.getTimeline(serverId, startTime, endTime);
    if (timeline.length === 0) {
      return { uptimePercent: 100, totalUptime: endTime - startTime, totalDowntime: 0, incidents: 0 };
    }

    let totalDowntime = 0;
    let incidents = 0;
    let lastOfflineTime = null;

    for (const entry of timeline) {
      if (entry.status === 'offline') {
        if (!lastOfflineTime) {
          lastOfflineTime = entry.timestamp;
          incidents++;
        }
      } else if (entry.status === 'online' && lastOfflineTime) {
        totalDowntime += entry.timestamp - lastOfflineTime;
        lastOfflineTime = null;
      }
    }

    // If still offline at end of range
    if (lastOfflineTime) {
      totalDowntime += endTime - lastOfflineTime;
    }

    const totalTime = endTime - startTime;
    const totalUptime = totalTime - totalDowntime;
    const uptimePercent = totalTime > 0 ? Math.round((totalUptime / totalTime) * 10000) / 100 : 100;

    return { uptimePercent, totalUptime, totalDowntime, incidents };
  }

  // ==================== Cleanup ====================

  cleanupHistory(serverId) {
    const cutoff = Date.now() - (HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    if (this.history[serverId]) {
      this.history[serverId] = this.history[serverId].filter(entry => entry.timestamp >= cutoff);
    }
  }

  cleanupLogs() {
    const cutoff = Date.now() - (HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);
  }

  // ==================== Utilities ====================

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  getRuntimeStats() {
    return {
      intervalMs: this.currentIntervalMs,
      baseIntervalMs: this.monitorConfig.baseIntervalMs,
      maxIntervalMs: this.monitorConfig.maxIntervalMs,
      backoffEnabled: this.monitorConfig.backoffEnabled,
      backoffMultiplier: this.monitorConfig.backoffMultiplier,
      nextCheckAt: this.nextCheckAt,
      startedAt: this.startedAt,
      runCount: this.runCount,
      lastRunAt: this.lastRunAt,
      lastRunDurationMs: this.lastRunDurationMs,
      lastError: this.lastError,
      monitoredServers: this.servers.filter(s => s.enabled).length,
      totalServers: this.servers.length
    };
  }
}

// Singleton instance
const printServerMonitoringService = new PrintServerMonitoringService();

module.exports = printServerMonitoringService;
