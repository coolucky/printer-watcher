const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');
const { authorizeRole } = require('../middleware/authMiddleware');

/**
 * GET / - Get alert configuration
 */
router.get('/', (req, res) => {
  try {
    const config = { ...alertService.getConfig() };
    // Migrate legacy 'enabled' field to individual flags
    if ('enabled' in config && !('offlineAlertEnabled' in config)) {
      config.offlineAlertEnabled = config.enabled;
      config.tonerAlertEnabled = config.enabled;
    }
    res.apiSuccess(config, 'Alert configuration fetched');
  } catch (error) {
    res.apiError('Failed to get alert config', 500, error.message);
  }
});

/**
 * POST / - Save alert configuration (需要 Editor+ 权限)
 */
router.post('/', authorizeRole(['Administrator', 'Editor']), (req, res) => {
  try {
    const { enabled, offlineAlertEnabled, tonerAlertEnabled, printerErrorAlertEnabled, fromEmail, toEmails, tonerThreshold, serverAlertEnabled } = req.body;
    const configToSave = {
      fromEmail: fromEmail || '',
      toEmails: toEmails || '',
      tonerThreshold: typeof tonerThreshold === 'number' ? tonerThreshold : 5,
    };
    // Support new individual flags (offlineAlertEnabled, tonerAlertEnabled) and legacy 'enabled' field
    if (offlineAlertEnabled !== undefined) {
      configToSave.offlineAlertEnabled = !!offlineAlertEnabled;
    } else if (enabled !== undefined) {
      configToSave.offlineAlertEnabled = !!enabled;
    }
    if (tonerAlertEnabled !== undefined) {
      configToSave.tonerAlertEnabled = !!tonerAlertEnabled;
    } else if (enabled !== undefined) {
      configToSave.tonerAlertEnabled = !!enabled;
    }
    if (printerErrorAlertEnabled !== undefined) {
      configToSave.printerErrorAlertEnabled = !!printerErrorAlertEnabled;
    }
    if (serverAlertEnabled !== undefined) {
      configToSave.serverAlertEnabled = !!serverAlertEnabled;
    }
    const config = alertService.saveConfig(configToSave);
    // Reset tracking state when config changes
    alertService.resetState();
    res.apiSuccess(config, 'Alert configuration saved');
  } catch (error) {
    res.apiError('Failed to save alert config', 500, error.message);
  }
});

/**
 * POST /test/offline - Send test offline alert
 */
router.post('/test/offline', async (req, res) => {
  try {
    const result = await alertService.sendTestOfflineAlert();
    if (result.success) {
      res.apiSuccess(result, 'Test offline alert sent successfully');
    } else {
      res.apiError('Failed to send test offline alert', 500, result.error);
    }
  } catch (error) {
    res.apiError('Failed to send test offline alert', 500, error.message);
  }
});

/**
 * POST /test/recovery - Send test recovery alert
 */
router.post('/test/recovery', async (req, res) => {
  try {
    const result = await alertService.sendTestRecoveryAlert();
    if (result.success) {
      res.apiSuccess(result, 'Test recovery alert sent successfully');
    } else {
      res.apiError('Failed to send test recovery alert', 500, result.error);
    }
  } catch (error) {
    res.apiError('Failed to send test recovery alert', 500, error.message);
  }
});

/**
 * POST /test/toner - Send test toner alert
 */
router.post('/test/toner', async (req, res) => {
  try {
    const result = await alertService.sendTestTonerAlert();
    if (result.success) {
      res.apiSuccess(result, 'Test toner alert sent successfully');
    } else {
      res.apiError('Failed to send test toner alert', 500, result.error);
    }
  } catch (error) {
    res.apiError('Failed to send test toner alert', 500, error.message);
  }
});

/**
 * POST /test/server-offline - Send test print server offline alert
 */
router.post('/test/server-offline', async (req, res) => {
  try {
    const result = await alertService.sendTestPrintServerOfflineAlert();
    if (result.success) {
      res.apiSuccess(result, 'Test server offline alert sent successfully');
    } else {
      res.apiError('Failed to send test server offline alert', 500, result.error);
    }
  } catch (error) {
    res.apiError('Failed to send test server offline alert', 500, error.message);
  }
});

/**
 * POST /test/printer-error - Send test printer fault alert
 */
router.post('/test/printer-error', async (req, res) => {
  try {
    const result = await alertService.sendTestPrinterErrorAlert();
    if (result.success) {
      res.apiSuccess(result, 'Test printer fault alert sent successfully');
    } else {
      res.apiError('Failed to send test printer fault alert', 500, result.error);
    }
  } catch (error) {
    res.apiError('Failed to send test printer fault alert', 500, error.message);
  }
});

/**
 * POST /test/server-recovery - Send test print server recovery alert
 */
router.post('/test/server-recovery', async (req, res) => {
  try {
    const result = await alertService.sendTestPrintServerRecoveryAlert();
    if (result.success) {
      res.apiSuccess(result, 'Test server recovery alert sent successfully');
    } else {
      res.apiError('Failed to send test server recovery alert', 500, result.error);
    }
  } catch (error) {
    res.apiError('Failed to send test server recovery alert', 500, error.message);
  }
});

/**
 * GET /state - Get current alert tracking state
 */
router.get('/state', (req, res) => {
  try {
    const state = alertService.getAlertState();
    res.apiSuccess(state, 'Alert state fetched');
  } catch (error) {
    res.apiError('Failed to get alert state', 500, error.message);
  }
});

module.exports = { router };
