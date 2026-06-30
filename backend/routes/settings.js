/**
 * 设置路由模块
 * 负责系统设置的获取和保存
 */
const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');
const EmailServiceClass = require('../services/emailService');
const printerMonitoringService = require('../services/printerMonitoringService');
const printServerMonitoringService = require('../services/printServerMonitoringService');

let emailService = null;

/**
 * 初始化设置模块
 * @param {Object} initialSettings - 初始设置
 */
function initSettings(initialSettings) {
  // 创建邮件服务
  if (initialSettings && initialSettings.email) {
    const emailConfig = {
      host: initialSettings.email.smtpServer,
      port: initialSettings.email.smtpPort,
      secure: initialSettings.email.useTls,
      user: initialSettings.email.smtpUser,
      pass: initialSettings.email.smtpPass
    };
    emailService = new EmailServiceClass(emailConfig);
  } else {
    emailService = new EmailServiceClass();
  }
}

/**
 * GET / - 获取系统设置
 */
router.get('/', (req, res) => {
  try {
    const settings = settingsService.getSettings();
    res.apiSuccess(settings, 'Settings fetched successfully');
  } catch (error) {
    console.error('Error getting settings:', error.message);
    res.apiError('Failed to get settings', 500, error.message);
  }
});

/**
 * POST / - 保存系统设置 (仅 Administrator 权限)
 */
const { authorizeRole } = require('../middleware/authMiddleware');
router.post('/', authorizeRole('Administrator'), (req, res) => {
  try {
    const updatedBy = req.user?.username || req.user?.ntid || 'system';
    const settings = settingsService.saveSettings(req.body, { updatedBy });
    
    // 重新初始化邮件服务
    initSettings(settings);

    // Hot-apply monitoring settings so changes take effect immediately.
    printerMonitoringService.applySettings(settings.monitoring?.printers);
    printServerMonitoringService.applySettings(settings.monitoring?.printServers);
    
    res.apiSuccess(settings, 'Settings saved successfully');
  } catch (error) {
    console.error('Error saving settings:', error.message);
    res.apiError('Failed to save settings', 500, error.message);
  }
});

/**
 * GET /version - 获取配置版本信息
 */
router.get('/version', (req, res) => {
  try {
    res.apiSuccess({
      configMeta: settingsService.getConfigMeta(),
      checksum: settingsService.getSettingsChecksum()
    }, 'Settings version fetched successfully');
  } catch (error) {
    console.error('Error getting settings version:', error.message);
    res.apiError('Failed to get settings version', 500, error.message);
  }
});

/**
 * GET /export - 导出脱敏配置
 */
router.get('/export', (req, res) => {
  try {
    const exportPayload = settingsService.getSanitizedSettingsExport();
    res.apiSuccess(exportPayload, 'Sanitized settings export generated');
  } catch (error) {
    console.error('Error exporting settings:', error.message);
    res.apiError('Failed to export settings', 500, error.message);
  }
});

/**
 * POST /import - 导入配置（保留敏感字段原值）
 */
router.post('/import', authorizeRole('Administrator'), (req, res) => {
  try {
    const incoming = req.body?.settings || req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.apiError('Invalid settings payload', 400);
    }

    const current = settingsService.getSettings();
    const merged = {
      ...incoming,
      email: {
        ...incoming.email,
        smtpPass: incoming.email?.smtpPass === '***' ? current.email?.smtpPass : incoming.email?.smtpPass
      },
      papercut: {
        ...incoming.papercut,
        password: incoming.papercut?.password === '***' ? current.papercut?.password : incoming.papercut?.password,
        apiToken: incoming.papercut?.apiToken === '***' ? current.papercut?.apiToken : incoming.papercut?.apiToken
      }
    };

    const updatedBy = req.user?.username || req.user?.ntid || 'system';
    const saved = settingsService.saveSettings(merged, { updatedBy });
    initSettings(saved);

    res.apiSuccess({
      configMeta: settingsService.getConfigMeta(),
      checksum: settingsService.getSettingsChecksum()
    }, 'Settings imported successfully');
  } catch (error) {
    console.error('Error importing settings:', error.message);
    res.apiError('Failed to import settings', 500, error.message);
  }
});

/**
 * GET /email-test - 测试邮件配置
 */
router.get('/email-test', async (req, res) => {
  try {
    const { to, from } = req.query;
    
    if (!to) {
      return res.apiError('Recipient email is required', 400);
    }
    
    if (!emailService) {
      return res.apiError('Email service not initialized', 500);
    }
    
    const fromEmail = from || process.env.DEFAULT_FROM_EMAIL || 'printer-report@example.com';
    
    console.log(`Testing email configuration to: ${to}, from: ${fromEmail}`);
    
    // 发送测试邮件
    const result = await emailService.sendTestEmail(to, fromEmail);
    
    res.apiSuccess(result, 'Test email sent successfully');
  } catch (error) {
    console.error('Error testing email:', error);
    res.apiError('Failed to send test email', 500, error.message);
  }
});

/**
 * GET /validate - 验证设置
 */
router.get('/validate', (req, res) => {
  try {
    const settings = settingsService.getSettings();
    const validation = {
      email: {
        configured: !!(settings.email && settings.email.smtpServer),
        hasServer: !!settings.email?.smtpServer,
        hasPort: !!settings.email?.smtpPort
      },
      papercut: {
        configured: !!(settings.papercut && settings.papercut.host),
        hasHost: !!settings.papercut?.host,
        hasPort: !!settings.papercut?.port
      },
      application: {
        configured: !!settings.application
      }
    };
    
    res.apiSuccess(validation, 'Settings validation result');
  } catch (error) {
    console.error('Error validating settings:', error.message);
    res.apiError('Failed to validate settings', 500, error.message);
  }
});

module.exports = {
  router,
  initSettings,
  getEmailService: () => emailService
};
