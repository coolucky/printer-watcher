const fs = require('fs');
const path = require('path');
const settingsService = require('./settingsService');
const printerService = require('./printerService');
const printServerMonitoringService = require('./printServerMonitoringService');

const PRINTERS_FILE = path.join(__dirname, '../config/printers.json');

class ScheduledReportService {
  constructor() {
    this.interval = null;
    this.isChecking = false;
  }

  start() {
    if (this.interval) {
      return;
    }

    this.checkAndRun().catch((error) => {
      console.error('[ScheduledReportService] Initial check failed:', error.message);
    });

    this.interval = setInterval(() => {
      this.checkAndRun().catch((error) => {
        console.error('[ScheduledReportService] Scheduled check failed:', error.message);
      });
    }, 60000);

    console.log('[ScheduledReportService] Weekly report scheduler started');
  }

  getWeekKey(date) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    normalizedDate.setDate(normalizedDate.getDate() + 3 - (normalizedDate.getDay() + 6) % 7);
    const week1 = new Date(normalizedDate.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((normalizedDate - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${normalizedDate.getFullYear()}-W${weekNum}`;
  }

  loadPrinters() {
    try {
      if (!fs.existsSync(PRINTERS_FILE)) {
        return [];
      }

      const printers = JSON.parse(fs.readFileSync(PRINTERS_FILE, 'utf8'));
      return Array.isArray(printers) ? printers.filter((printer) => !printer?.isTest) : [];
    } catch (error) {
      console.error('[ScheduledReportService] Failed to load printers:', error.message);
      return [];
    }
  }

  shouldSendThisMinute(schedule, now) {
    if (!schedule?.enabled) {
      return false;
    }

    const currentDay = now.getDay();
    if (currentDay !== schedule.dayOfWeek) {
      return false;
    }

    return now.getHours() > schedule.hour || (now.getHours() === schedule.hour && now.getMinutes() >= schedule.minute);
  }

  buildServerUptimeData() {
    try {
      const enabledServers = printServerMonitoringService.getServers().filter((server) => server.enabled);
      if (enabledServers.length === 0) {
        return null;
      }

      const uptimeEnd = Date.now();
      const uptimeStart = uptimeEnd - 7 * 24 * 60 * 60 * 1000;
      const stats = {};

      for (const server of enabledServers) {
        stats[server.id] = {
          ...server,
          ...printServerMonitoringService.getUptimeStats(server.id, uptimeStart, uptimeEnd)
        };
      }

      return stats;
    } catch (error) {
      console.warn('[ScheduledReportService] Failed to load server uptime data:', error.message);
      return null;
    }
  }

  async checkAndRun() {
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;

    try {
      const settings = settingsService.reloadSettings();
      const reportSettings = settings.reportSettings || {};
      const schedule = reportSettings.weeklySchedule;
      const now = new Date();

      if (!this.shouldSendThisMinute(schedule, now)) {
        return;
      }

      const weekKey = this.getWeekKey(now);
      if (reportSettings.lastSentWeek === weekKey) {
        return;
      }

      if (!settingsService.tryStartScheduledReportSend(weekKey)) {
        console.log(`[ScheduledReportService] Weekly report already handled for ${weekKey}`);
        return;
      }

      try {
        const settingsModule = require('../routes/settings');
        const emailService = settingsModule.getEmailService();
        if (!emailService) {
          throw new Error('Email service not configured');
        }

        const printers = this.loadPrinters();
        if (printers.length === 0) {
          throw new Error('No non-test printers configured for weekly report');
        }

        const printersStatus = await printerService.getPrintersStatus(printers, {});
        const licenseDays = printerService.getLicenseRemainingDays();
        const serverUptimeData = this.buildServerUptimeData();
        const selectedStyle = schedule.selectedStyle || 1;
        const emailHtml = emailService.generateInlineStyleReportHtml(printersStatus, licenseDays, serverUptimeData, selectedStyle);

        const result = await emailService.sendWeeklyReportWithCustomHtml(
          emailHtml,
          {
            toEmail: schedule.toEmail,
            fromEmail: schedule.fromEmail,
            ccEmail: schedule.ccEmail || ''
          },
          printersStatus,
          licenseDays,
          serverUptimeData,
          selectedStyle
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to send weekly report email');
        }

        settingsService.completeScheduledReportSend(weekKey);
        console.log(`[ScheduledReportService] Weekly report sent successfully for ${weekKey}`);
      } catch (error) {
        settingsService.clearScheduledReportSendLock(weekKey);
        throw error;
      }
    } finally {
      this.isChecking = false;
    }
  }
}

module.exports = new ScheduledReportService();