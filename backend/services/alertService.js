const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const settingsService = require('./settingsService');
const { sendMailWithRetry } = require('./emailRetryHelper');

const ALERT_CONFIG_FILE = path.join(__dirname, '../config/alertConfig.json');

const DEFAULT_ALERT_CONFIG = {
  enabled: false,
  offlineAlertEnabled: false,
  tonerAlertEnabled: false,
  fromEmail: '',
  toEmails: '',
  // Thresholds
  tonerThreshold: 5,
  dedupeWindowMinutes: 10,
  maxAlertsPerHour: 20,
  // Tracking state (internal)
};

class AlertService {
  constructor() {
    this.config = this.loadConfig();
    // Track printer states: { [ip]: { online: bool, offlineSince: timestamp, alertsSent: { immediate, oneMin, fiveMin } } }
    this.printerStates = {};
    // Track toner alerts: { [ip_color]: { lastAlertTime: timestamp } }
    this.tonerAlertStates = {};
    // Monitoring interval
    this.monitorInterval = null;
    this.recentAlertFingerprints = {};
    this.alertSendHistory = [];
  }

  loadConfig() {
    try {
      if (fs.existsSync(ALERT_CONFIG_FILE)) {
        const data = fs.readFileSync(ALERT_CONFIG_FILE, 'utf8');
        return { ...DEFAULT_ALERT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('[Alert] Error loading alert config:', error.message);
    }
    return { ...DEFAULT_ALERT_CONFIG };
  }

  saveConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      const dir = path.dirname(ALERT_CONFIG_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Don't persist internal tracking state
      const { ...configToSave } = this.config;
      fs.writeFileSync(ALERT_CONFIG_FILE, JSON.stringify(configToSave, null, 2), 'utf8');
      console.log('[Alert] Config saved');
    } catch (error) {
      console.error('[Alert] Error saving config:', error.message);
    }
    return this.config;
  }

  getConfig() {
    return this.config;
  }

  createTransporter() {
    const emailSettings = settingsService.getSettings().email || {};
    const smtpConfig = {
      host: emailSettings.smtpServer || emailSettings.host || 'localhost',
      port: parseInt(emailSettings.smtpPort || emailSettings.port || '25', 10),
      secure: emailSettings.useTls || false,
      requireTLS: false,
      ignoreTLS: true,
      tls: { rejectUnauthorized: false }
    };

    const smtpUser = emailSettings.smtpUser || '';
    const smtpPass = emailSettings.smtpPass || '';
    if (smtpUser && smtpPass) {
      smtpConfig.auth = { user: smtpUser, pass: smtpPass };
    }

    return nodemailer.createTransport(smtpConfig);
  }

  /**
   * Process printer status updates and trigger alerts as needed
   */
  processStatusUpdate(printerStatuses) {
    // Skip if both offline and toner alerts are disabled
    if (!this.config.offlineAlertEnabled && !this.config.tonerAlertEnabled) return;

    const now = Date.now();

    for (const printer of printerStatuses) {
      const ip = printer.ip;
      if (!ip) continue;

      const prevState = this.printerStates[ip];
      const isOnline = printer.online === true;

      // Initialize state if new printer
      if (!prevState) {
        this.printerStates[ip] = {
          online: isOnline,
          name: printer.name || ip,
          offlineSince: isOnline ? null : now,
          alertsSent: { immediate: false, oneMin: false, fiveMin: false }
        };
        // Don't send alert on first check
        continue;
      }

      // Update printer name
      prevState.name = printer.name || ip;

      // --- Offline/Online transition alerts ---
      if (this.config.offlineAlertEnabled) {
      if (prevState.online && !isOnline) {
        // Online -> Offline transition
        prevState.online = false;
        prevState.offlineSince = now;
        prevState.alertsSent = { immediate: false, oneMin: false, fiveMin: false };
        // Send immediate offline alert
        this.sendOfflineAlert(printer, 'immediate');
        prevState.alertsSent.immediate = true;
      } else if (!prevState.online && isOnline) {
        // Offline -> Online transition (recovery)
        prevState.online = true;
        const downtime = prevState.offlineSince ? now - prevState.offlineSince : 0;
        prevState.offlineSince = null;
        prevState.alertsSent = { immediate: false, oneMin: false, fiveMin: false };
        this.sendRecoveryAlert(printer, downtime);
      } else if (!prevState.online && !isOnline && prevState.offlineSince) {
        // Still offline - check duration-based alerts
        const offlineDuration = now - prevState.offlineSince;

        if (!prevState.alertsSent.oneMin && offlineDuration >= 60 * 1000) {
          this.sendOfflineAlert(printer, '1min');
          prevState.alertsSent.oneMin = true;
        }
        if (!prevState.alertsSent.fiveMin && offlineDuration >= 5 * 60 * 1000) {
          this.sendOfflineAlert(printer, '5min');
          prevState.alertsSent.fiveMin = true;
        }
      }
      } else {
        // Still track online state even when alerts disabled
        prevState.online = isOnline;
        if (!isOnline && !prevState.offlineSince) prevState.offlineSince = now;
        if (isOnline) { prevState.offlineSince = null; prevState.alertsSent = { immediate: false, oneMin: false, fiveMin: false }; }
      }

      // --- Toner level alerts ---
      if (this.config.tonerAlertEnabled && isOnline && printer.tonerLevels && typeof printer.tonerLevels === 'object') {
        const threshold = this.config.tonerThreshold || 5;
        for (const [color, level] of Object.entries(printer.tonerLevels)) {
          if (typeof level !== 'number') continue;
          const key = `${ip}_${color}`;

          if (level < threshold) {
            const prevToner = this.tonerAlertStates[key];
            if (!prevToner) {
              // First time below threshold - send immediately
              this.sendTonerAlert(printer, color, level, threshold);
              this.tonerAlertStates[key] = { lastAlertTime: now };
            } else if (now - prevToner.lastAlertTime >= 24 * 60 * 60 * 1000) {
              // 24 hours since last alert
              this.sendTonerAlert(printer, color, level, threshold);
              this.tonerAlertStates[key].lastAlertTime = now;
            }
          } else {
            // Level is above threshold - clear tracking
            if (this.tonerAlertStates[key]) {
              delete this.tonerAlertStates[key];
            }
          }
        }
      }

      // --- Printer error state alerts (paper jam, no paper, door open) ---
      if (this.config.printerErrorAlertEnabled && isOnline && printer.printerErrors && printer.printerErrors.hasErrors) {
        const errorKey = `${ip}_errors`;
        const activeErrors = printer.printerErrors.activeErrors || [];
        const criticalErrors = activeErrors.filter(e => ['jammed', 'noPaper', 'doorOpen'].includes(e));
        
        if (criticalErrors.length > 0) {
          const prevErrorAlert = this.tonerAlertStates[errorKey];
          const errString = criticalErrors.sort().join(',');
          if (!prevErrorAlert || prevErrorAlert.lastErrors !== errString) {
            // New error combination - send alert
            this.sendPrinterErrorAlert(printer, criticalErrors);
            this.tonerAlertStates[errorKey] = { lastAlertTime: now, lastErrors: errString };
          } else if (now - prevErrorAlert.lastAlertTime >= 30 * 60 * 1000) {
            // 30 min since last error alert for same errors - resend
            this.sendPrinterErrorAlert(printer, criticalErrors);
            this.tonerAlertStates[errorKey].lastAlertTime = now;
          }
        } else {
          // No critical errors - clear tracking
          if (this.tonerAlertStates[errorKey]) {
            delete this.tonerAlertStates[errorKey];
          }
        }
      }
    }
  }

  /**
   * Send offline alert email
   */
  async sendOfflineAlert(printer, stage) {
    const stageLabels = {
      immediate: 'just went OFFLINE',
      '1min': 'has been OFFLINE for 1 minute',
      '5min': 'has been OFFLINE for 5 minutes'
    };
    const stageLabel = stageLabels[stage] || 'is OFFLINE';
    const subject = `⚠️ Printer Offline Alert - ${printer.name || printer.ip}`;

    const html = this.generateOfflineEmailHTML(printer, stageLabel, stage);
    await this.sendAlertEmail(subject, html);
  }

  /**
   * Send recovery alert email
   */
  async sendRecoveryAlert(printer, downtimeMs) {
    const downtime = this.formatDuration(downtimeMs);
    const subject = `✅ Printer Recovery - ${printer.name || printer.ip} is back ONLINE`;
    const html = this.generateRecoveryEmailHTML(printer, downtime);
    await this.sendAlertEmail(subject, html);
  }

  /**
   * Send toner low alert email
   */
  async sendTonerAlert(printer, color, level, threshold) {
    const subject = `🔶 Low Toner Alert - ${printer.name || printer.ip} (${color.toUpperCase()}: ${level}%)`;
    const html = this.generateTonerAlertEmailHTML(printer, color, level, threshold);
    await this.sendAlertEmail(subject, html);
  }

  async sendPrinterErrorAlert(printer, criticalErrors) {
    const errorLabels = {
      jammed: '卡纸 (Paper Jam)',
      noPaper: '缺纸 (No Paper)',
      doorOpen: '门已打开 (Door Open)'
    };
    const errorDesc = criticalErrors.map(e => errorLabels[e] || e).join(', ');
    const subject = `🚨 Printer Error - ${printer.name || printer.ip}: ${errorDesc}`;
    const html = this.generatePrinterErrorEmailHTML(printer, criticalErrors, errorLabels);
    await this.sendAlertEmail(subject, html);
  }

  /**
   * Core email sending method
   */
  async sendAlertEmail(subject, html) {
    try {
      const from = this.config.fromEmail || settingsService.getSettings().email?.defaultFrom || 'printer-alert@system.local';
      const to = this.config.toEmails || settingsService.getSettings().email?.defaultTo || '';

      if (!to) {
        console.warn('[Alert] No recipient email configured, skipping alert');
        return { success: false, error: 'No recipient email configured' };
      }

      const now = Date.now();
      const dedupeWindowMs = Math.max(1, this.config.dedupeWindowMinutes || 10) * 60 * 1000;
      const fingerprint = `${subject}|${to}`;
      const lastSent = this.recentAlertFingerprints[fingerprint] || 0;
      if ((now - lastSent) < dedupeWindowMs) {
        console.log(`[Alert] Dedupe suppress: ${subject}`);
        return { success: true, deduped: true };
      }

      const oneHourAgo = now - (60 * 60 * 1000);
      this.alertSendHistory = this.alertSendHistory.filter(ts => ts >= oneHourAgo);
      const maxAlertsPerHour = Math.max(1, this.config.maxAlertsPerHour || 20);
      if (this.alertSendHistory.length >= maxAlertsPerHour) {
        console.warn(`[Alert] Hourly cap reached (${maxAlertsPerHour}), skipping: ${subject}`);
        return { success: false, error: 'Hourly alert cap reached' };
      }

      const info = await sendMailWithRetry({
        createTransporter: () => this.createTransporter(),
        mailOptions: {
        from,
        to,
        subject,
        html
        },
        contextLabel: `Alert email: ${subject}`,
        logger: console
      });

      this.recentAlertFingerprints[fingerprint] = now;
      this.alertSendHistory.push(now);

      console.log(`[Alert] Email sent: ${subject} -> ${to} (${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`[Alert] Failed to send email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send test alert emails
   */
  async sendTestOfflineAlert() {
    const testPrinter = {
      name: 'Test_Printer_01',
      ip: '192.168.1.100',
      model: 'FujiFilm Apeos C5570',
      location: 'Office 12F'
    };
    const subject = `⚠️ [TEST] Printer Offline Alert - ${testPrinter.name}`;
    const html = this.generateOfflineEmailHTML(testPrinter, 'just went OFFLINE', 'immediate', true);
    return await this.sendAlertEmail(subject, html);
  }

  async sendTestRecoveryAlert() {
    const testPrinter = {
      name: 'Test_Printer_01',
      ip: '192.168.1.100',
      model: 'FujiFilm Apeos C5570',
      location: 'Office 12F'
    };
    const subject = `✅ [TEST] Printer Recovery - ${testPrinter.name} is back ONLINE`;
    const html = this.generateRecoveryEmailHTML(testPrinter, '3 minutes 25 seconds', true);
    return await this.sendAlertEmail(subject, html);
  }

  async sendTestTonerAlert() {
    const testPrinter = {
      name: 'Test_Printer_01',
      ip: '192.168.1.100',
      model: 'FujiFilm Apeos C5570',
      location: 'Office 12F',
      tonerLevels: { black: 3, cyan: 45, magenta: 62, yellow: 78 }
    };
    const subject = `🔶 [TEST] Low Toner Alert - ${testPrinter.name} (BLACK: 3%)`;
    const html = this.generateTonerAlertEmailHTML(testPrinter, 'black', 3, 5, true);
    return await this.sendAlertEmail(subject, html);
  }

  async sendTestPrinterErrorAlert() {
    const testPrinter = {
      name: 'Test_Printer_01',
      ip: '192.168.1.100',
      model: 'FujiFilm Apeos C5570',
      location: 'Office 12F'
    };
    const testErrors = ['jammed'];
    const errorLabels = {
      jammed: '卡纸 (Paper Jam)',
      noPaper: '缺纸 (No Paper)',
      doorOpen: '门已打开 (Door Open)'
    };
    const errorDesc = testErrors.map(e => errorLabels[e] || e).join(', ');
    const subject = `🚨 [TEST] Printer Error - ${testPrinter.name}: ${errorDesc}`;
    const html = this.generatePrinterErrorEmailHTML(testPrinter, testErrors, errorLabels, true);
    return await this.sendAlertEmail(subject, html);
  }

  // --- Email HTML Generators ---

  generateOfflineEmailHTML(printer, stageLabel, stage, isTest = false) {
    const urgencyColors = {
      immediate: '#ff9800',
      '1min': '#f44336',
      '5min': '#d32f2f'
    };
    const urgencyColor = urgencyColors[stage] || '#ff9800';
    const urgencyLabels = {
      immediate: 'Warning',
      '1min': 'Urgent',
      '5min': 'Critical'
    };
    const urgencyLabel = urgencyLabels[stage] || 'Warning';
    const testBanner = isTest ? '<div style="background:#2196f3;color:#fff;text-align:center;padding:8px;font-size:13px;border-radius:4px 4px 0 0;">🧪 This is a TEST alert — no real issue detected</div>' : '';

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      ${testBanner}
      <div style="background:${urgencyColor};color:#fff;padding:20px 24px;">
        <h1 style="margin:0;font-size:20px;">⚠️ Printer Offline Alert</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Severity: ${urgencyLabel}</p>
      </div>
      <div style="padding:24px;">
        <div style="background:#fff3e0;border-left:4px solid ${urgencyColor};padding:16px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;font-size:15px;color:#333;"><strong>${printer.name || printer.ip}</strong> ${stageLabel}.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;width:140px;">Printer Name</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;">${printer.name || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">IP Address</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${printer.ip || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">Model</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${printer.model || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">Location</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${printer.location || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;color:#666;">Detection Time</td><td style="padding:10px 12px;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}</td></tr>
        </table>
      </div>
      <div style="background:#f5f5f5;padding:16px 24px;font-size:12px;color:#999;text-align:center;">
        Printer Status Monitoring System — Automated Alert
      </div>
    </div>`;
  }

  generateRecoveryEmailHTML(printer, downtime, isTest = false) {
    const testBanner = isTest ? '<div style="background:#2196f3;color:#fff;text-align:center;padding:8px;font-size:13px;border-radius:4px 4px 0 0;">🧪 This is a TEST alert — no real issue detected</div>' : '';

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      ${testBanner}
      <div style="background:#4caf50;color:#fff;padding:20px 24px;">
        <h1 style="margin:0;font-size:20px;">✅ Printer Recovery Notice</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Status: Resolved</p>
      </div>
      <div style="padding:24px;">
        <div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:16px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;font-size:15px;color:#333;"><strong>${printer.name || printer.ip}</strong> is back <strong>ONLINE</strong>.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;width:140px;">Printer Name</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;">${printer.name || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">IP Address</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${printer.ip || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">Model</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${printer.model || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">Total Downtime</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#f44336;font-weight:600;">${downtime}</td></tr>
          <tr><td style="padding:10px 12px;color:#666;">Recovery Time</td><td style="padding:10px 12px;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}</td></tr>
        </table>
      </div>
      <div style="background:#f5f5f5;padding:16px 24px;font-size:12px;color:#999;text-align:center;">
        Printer Status Monitoring System — Automated Alert
      </div>
    </div>`;
  }

  generateTonerAlertEmailHTML(printer, color, level, threshold, isTest = false) {
    const colorMap = { black: '#333', cyan: '#00a8e8', magenta: '#d9006e', yellow: '#ffd100' };
    const barColor = colorMap[color.toLowerCase()] || '#666';
    const testBanner = isTest ? '<div style="background:#2196f3;color:#fff;text-align:center;padding:8px;font-size:13px;border-radius:4px 4px 0 0;">🧪 This is a TEST alert — no real issue detected</div>' : '';

    // Build toner bars for all colors if available
    let tonerBarsHTML = '';
    const tonerData = printer.tonerLevels || { [color]: level };
    for (const [c, l] of Object.entries(tonerData)) {
      const bc = colorMap[c.toLowerCase()] || '#666';
      const lv = typeof l === 'number' ? l : 0;
      const isAlertColor = c.toLowerCase() === color.toLowerCase();
      tonerBarsHTML += `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
            <span style="font-weight:${isAlertColor ? '700' : '400'};color:${isAlertColor ? '#d32f2f' : '#333'};">${c.toUpperCase()} ${isAlertColor ? '⚠️' : ''}</span>
            <span style="font-weight:600;color:${lv < threshold ? '#d32f2f' : '#333'};">${lv}%</span>
          </div>
          <div style="background:#eee;border-radius:4px;height:10px;overflow:hidden;">
            <div style="background:${bc};height:100%;width:${lv}%;border-radius:4px;"></div>
          </div>
        </div>`;
    }

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      ${testBanner}
      <div style="background:#ff9800;color:#fff;padding:20px 24px;">
        <h1 style="margin:0;font-size:20px;">🔶 Low Toner Alert</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Toner level below ${threshold}%</p>
      </div>
      <div style="padding:24px;">
        <div style="background:#fff3e0;border-left:4px solid #ff9800;padding:16px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;font-size:15px;color:#333;">
            <strong>${printer.name || printer.ip}</strong> — <strong style="color:${barColor};">${color.toUpperCase()}</strong> toner is at <strong style="color:#d32f2f;">${level}%</strong> (threshold: ${threshold}%).
          </p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;width:140px;">Printer Name</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;">${printer.name || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">IP Address</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${printer.ip || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">Model</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${printer.model || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;color:#666;">Detection Time</td><td style="padding:10px 12px;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}</td></tr>
        </table>
        <h3 style="margin:0 0 12px;font-size:15px;color:#333;">Current Toner Levels</h3>
        <div style="background:#fafafa;border-radius:6px;padding:16px;">
          ${tonerBarsHTML}
        </div>
      </div>
      <div style="background:#f5f5f5;padding:16px 24px;font-size:12px;color:#999;text-align:center;">
        Printer Status Monitoring System — Automated Alert
      </div>
    </div>`;
  }

  formatDuration(ms) {
    if (!ms || ms < 0) return '0 seconds';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} minute${(minutes % 60) !== 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds % 60} second${(seconds % 60) !== 1 ? 's' : ''}`;
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  generatePrinterErrorEmailHTML(printer, criticalErrors, errorLabels, isTest = false) {
    const testBanner = isTest ? '<div style="background:#2196f3;color:#fff;text-align:center;padding:8px;font-size:13px;border-radius:4px 4px 0 0;">🧪 This is a TEST alert — no real issue detected</div>' : '';
    const errListHTML = criticalErrors.map(e => {
      const label = errorLabels[e] || e;
      const icon = e === 'jammed' ? '📄' : e === 'noPaper' ? '📋' : '🚪';
      return `<li style="padding:6px 0;font-size:14px;">${icon} <strong>${label}</strong></li>`;
    }).join('');

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      ${testBanner}
      <div style="background:#f44336;color:#fff;padding:20px 24px;">
        <h1 style="margin:0;font-size:20px;">🚨 Printer Error Alert</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Printer requires attention</p>
      </div>
      <div style="padding:24px;">
        <div style="background:#ffebee;border-left:4px solid #f44336;padding:16px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;font-size:15px;color:#333;">
            <strong>${printer.name || printer.ip}</strong> has reported the following error(s):
          </p>
        </div>
        <ul style="list-style:none;padding:0;margin:0 0 20px;">${errListHTML}</ul>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;width:140px;">Printer Name</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;">${printer.name || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">IP Address</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${printer.ip || 'N/A'}</td></tr>
          <tr><td style="padding:10px 12px;color:#666;">Detection Time</td><td style="padding:10px 12px;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}</td></tr>
        </table>
      </div>
      <div style="background:#f5f5f5;padding:16px 24px;font-size:12px;color:#999;text-align:center;">
        Printer Status Monitoring System — Automated Alert
      </div>
    </div>`;
  }

  /**
   * Get current alert tracking state (for diagnostics/UI)
   */
  getAlertState() {
    return {
      printerStates: this.printerStates,
      tonerAlertStates: this.tonerAlertStates
    };
  }

  /**
   * Reset all tracking state
   */
  resetState() {
    this.printerStates = {};
    this.tonerAlertStates = {};
  }

  // ==================== Print Server Test Alerts ====================

  async sendTestPrintServerOfflineAlert() {
    const testServer = {
      name: 'Test_Print_Server',
      ip: '192.168.1.200'
    };
    const subject = `🖥️ ⚠️ [TEST] Print Server Offline - ${testServer.name} (${testServer.ip})`;
    const html = this.generateServerOfflineEmailHTML(testServer, true);
    return await this.sendAlertEmail(subject, html);
  }

  async sendTestPrintServerRecoveryAlert() {
    const testServer = {
      name: 'Test_Print_Server',
      ip: '192.168.1.200'
    };
    const subject = `🖥️ ✅ [TEST] Print Server Recovery - ${testServer.name} is back ONLINE`;
    const html = this.generateServerRecoveryEmailHTML(testServer, '5 minutes 12 seconds', true);
    return await this.sendAlertEmail(subject, html);
  }

  // ==================== Print Server Alerts ====================

  /**
   * Send print server offline alert
   */
  async sendPrintServerOfflineAlert(server) {
    const subject = `🖥️ ⚠️ Print Server Offline - ${server.name} (${server.ip})`;
    const html = this.generateServerOfflineEmailHTML(server);
    return await this.sendAlertEmail(subject, html);
  }

  /**
   * Send print server recovery alert
   */
  async sendPrintServerRecoveryAlert(server, downtimeMs) {
    const downtime = this.formatDuration(downtimeMs);
    const subject = `🖥️ ✅ Print Server Recovery - ${server.name} is back ONLINE`;
    const html = this.generateServerRecoveryEmailHTML(server, downtime);
    return await this.sendAlertEmail(subject, html);
  }

  generateServerOfflineEmailHTML(server, isTest = false) {
    const testBanner = isTest ? '<div style="background:#2196f3;color:#fff;text-align:center;padding:8px;font-size:13px;border-radius:4px 4px 0 0;">🧪 This is a TEST alert — no real issue detected</div>' : '';
    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      ${testBanner}
      <div style="background:#d32f2f;color:#fff;padding:20px 24px;">
        <h1 style="margin:0;font-size:20px;">🖥️ Print Server Offline Alert</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Severity: Critical</p>
      </div>
      <div style="padding:24px;">
        <div style="background:#ffebee;border-left:4px solid #d32f2f;padding:16px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;font-size:15px;color:#333;">Print server <strong>${server.name}</strong> is <strong style="color:#d32f2f;">OFFLINE</strong>.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;width:140px;">Server Name</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;">${server.name}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">IP Address</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${server.ip}</td></tr>
          <tr><td style="padding:10px 12px;color:#666;">Detection Time</td><td style="padding:10px 12px;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}</td></tr>
        </table>
      </div>
      <div style="background:#f5f5f5;padding:16px 24px;font-size:12px;color:#999;text-align:center;">
        Printer Status Monitoring System — Automated Alert
      </div>
    </div>`;
  }

  generateServerRecoveryEmailHTML(server, downtime, isTest = false) {
    const testBanner = isTest ? '<div style="background:#2196f3;color:#fff;text-align:center;padding:8px;font-size:13px;border-radius:4px 4px 0 0;">🧪 This is a TEST alert — no real issue detected</div>' : '';
    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      ${testBanner}
      <div style="background:#4caf50;color:#fff;padding:20px 24px;">
        <h1 style="margin:0;font-size:20px;">🖥️ Print Server Recovery</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Status: Resolved</p>
      </div>
      <div style="padding:24px;">
        <div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:16px;border-radius:4px;margin-bottom:20px;">
          <p style="margin:0;font-size:15px;color:#333;">Print server <strong>${server.name}</strong> is back <strong style="color:#4caf50;">ONLINE</strong>.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;width:140px;">Server Name</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;">${server.name}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">IP Address</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${server.ip}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;">Total Downtime</td><td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#f44336;font-weight:600;">${downtime}</td></tr>
          <tr><td style="padding:10px 12px;color:#666;">Recovery Time</td><td style="padding:10px 12px;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}</td></tr>
        </table>
      </div>
      <div style="background:#f5f5f5;padding:16px 24px;font-size:12px;color:#999;text-align:center;">
        Printer Status Monitoring System — Automated Alert
      </div>
    </div>`;
  }
}

module.exports = new AlertService();
