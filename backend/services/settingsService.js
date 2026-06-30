const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Define default system settings
const DEFAULT_SETTINGS = {
  configMeta: {
    schemaVersion: 1,
    revision: 1,
    updatedAt: null,
    updatedBy: 'system'
  },
  email: {
    smtpServer: '',
    smtpPort: '25',
    smtpUser: '',
    smtpPass: '',
    useTls: false,
    defaultFrom: 'printer-report@example.com',
    defaultTo: 'admin@example.com'
  },
  papercut: {
    host: '',
    port: '9191',
    username: '',
    password: '',
    apiToken: ''
  },
  license: {
    expirationDate: '2024-12-31'
  },
  monitoring: {
    printers: {
      intervalMs: 30000,
      backoffEnabled: false,
      backoffMultiplier: 1.5,
      maxIntervalMs: 120000
    },
    printServers: {
      intervalMs: 30000,
      backoffEnabled: false,
      backoffMultiplier: 1.5,
      maxIntervalMs: 120000
    }
  }
};

// Settings file path
const SETTINGS_FILE = path.join(__dirname, '../../settings.json');

class SettingsService {
  constructor() {
    this.settings = this.loadSettings();
  }

  writeSettings(nextSettings) {
    this.settings = nextSettings;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf8');
    return this.settings;
  }

  normalizeSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    const currentMeta = merged.configMeta || {};
    merged.configMeta = {
      schemaVersion: Number.isInteger(currentMeta.schemaVersion) ? currentMeta.schemaVersion : DEFAULT_SETTINGS.configMeta.schemaVersion,
      revision: Number.isInteger(currentMeta.revision) ? currentMeta.revision : DEFAULT_SETTINGS.configMeta.revision,
      updatedAt: currentMeta.updatedAt || null,
      updatedBy: currentMeta.updatedBy || 'system'
    };

    const monitoring = settings?.monitoring || {};
    const printerMonitoring = monitoring.printers || {};
    const printServerMonitoring = monitoring.printServers || {};

    merged.monitoring = {
      printers: {
        ...DEFAULT_SETTINGS.monitoring.printers,
        ...printerMonitoring
      },
      printServers: {
        ...DEFAULT_SETTINGS.monitoring.printServers,
        ...printServerMonitoring
      }
    };

    return merged;
  }

  /**
   * Load settings from file
   * @returns {Object} Loaded settings
   */
  loadSettings() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        return this.normalizeSettings(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading settings:', error.message);
    }
    return this.normalizeSettings(DEFAULT_SETTINGS);
  }

  reloadSettings() {
    this.settings = this.loadSettings();
    return this.settings;
  }

  /**
   * Save settings to file
   * @param {Object} newSettings - New settings to save
   * @returns {Object} Updated settings
   */
  saveSettings(newSettings, context = {}) {
    try {
      // Deep merge for reportSettings to avoid losing sub-keys
      if (newSettings.reportSettings && this.settings.reportSettings) {
        newSettings.reportSettings = { ...this.settings.reportSettings, ...newSettings.reportSettings };
      }

      const currentRevision = this.settings.configMeta?.revision || 1;
      const nextMeta = {
        schemaVersion: this.settings.configMeta?.schemaVersion || 1,
        revision: currentRevision + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: context.updatedBy || 'system'
      };

      this.writeSettings(this.normalizeSettings({ ...this.settings, ...newSettings, configMeta: nextMeta }));
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error.message);
    }
    return this.settings;
  }

  /**
   * Get current settings
   * @returns {Object} Current settings
   */
  getSettings() {
    return this.settings;
  }

  getReportSettings() {
    return this.getSettings().reportSettings || {};
  }

  getConfigMeta() {
    return this.getSettings().configMeta;
  }

  getSettingsChecksum() {
    const serialized = JSON.stringify(this.getSettings());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  getSanitizedSettingsExport() {
    const settings = JSON.parse(JSON.stringify(this.getSettings()));
    if (settings.email) {
      settings.email.smtpPass = settings.email.smtpPass ? '***' : '';
    }
    if (settings.papercut) {
      settings.papercut.password = settings.papercut.password ? '***' : '';
      settings.papercut.apiToken = settings.papercut.apiToken ? '***' : '';
    }
    return {
      exportedAt: new Date().toISOString(),
      checksum: this.getSettingsChecksum(),
      settings
    };
  }

  tryStartScheduledReportSend(weekKey) {
    const settings = this.reloadSettings();
    const reportSettings = settings.reportSettings || {};

    if (reportSettings.lastSentWeek === weekKey || reportSettings.sendingWeek === weekKey) {
      return false;
    }

    this.writeSettings({
      ...settings,
      reportSettings: {
        ...reportSettings,
        sendingWeek: weekKey,
        sendingStartedAt: new Date().toISOString()
      }
    });

    return true;
  }

  completeScheduledReportSend(weekKey) {
    const settings = this.reloadSettings();
    const reportSettings = settings.reportSettings || {};

    this.writeSettings({
      ...settings,
      reportSettings: {
        ...reportSettings,
        lastSentWeek: weekKey,
        lastSentAt: new Date().toISOString(),
        sendingWeek: '',
        sendingStartedAt: ''
      }
    });
  }

  clearScheduledReportSendLock(weekKey) {
    const settings = this.reloadSettings();
    const reportSettings = settings.reportSettings || {};

    if (reportSettings.sendingWeek !== weekKey) {
      return;
    }

    this.writeSettings({
      ...settings,
      reportSettings: {
        ...reportSettings,
        sendingWeek: '',
        sendingStartedAt: ''
      }
    });
  }

  /**
   * Get license expiration date from settings
   * @returns {string} Expiration date string
   */
  getLicenseExpirationDate() {
    // Make settings.json value have higher priority than environment variable
    return this.settings.license?.expirationDate || '2024-12-31';
  }
}

module.exports = new SettingsService();