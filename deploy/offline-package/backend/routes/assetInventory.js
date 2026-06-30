/**
 * Asset Inventory route module - supports multi-session inventory
 */
const express = require('express');
const router = express.Router();
const assetInventoryService = require('../services/assetInventoryService');
const settingsService = require('../services/settingsService');
const EmailService = require('../services/emailService');
const { authenticateToken } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes (all authenticated users can access)
router.use(authenticateToken);

// ========== Multi-Session API ==========

/**
 * GET /sessions - List all inventory sessions
 */
router.get('/sessions', (req, res) => {
  try {
    const sessions = assetInventoryService.listSessions();
    res.apiSuccess(sessions, 'Sessions listed successfully');
  } catch (error) {
    console.error('Error listing sessions:', error.message);
    res.apiError('Failed to list sessions', 500, error.message);
  }
});

/**
 * POST /sessions - Create a new inventory session
 * Body: { name?, createdBy? }
 */
router.post('/sessions', (req, res) => {
  try {
    const { name, createdBy } = req.body;
    const session = assetInventoryService.createSession({ name, createdBy });
    res.apiSuccess(session, 'Session created successfully');
  } catch (error) {
    console.error('Error creating session:', error.message);
    res.apiError('Failed to create session', 500, error.message);
  }
});

/**
 * GET /sessions/:id - Get session data
 */
router.get('/sessions/:id', (req, res) => {
  try {
    const data = assetInventoryService.getSessionData(req.params.id);
    if (!data) {
      return res.apiError('Session not found', 404);
    }
    const meta = assetInventoryService.getSession(req.params.id);
    res.apiSuccess({ ...meta, data }, 'Session data fetched successfully');
  } catch (error) {
    console.error('Error getting session:', error.message);
    res.apiError('Failed to get session', 500, error.message);
  }
});

/**
 * PUT /sessions/:id - Save session data
 */
router.put('/sessions/:id', (req, res) => {
  try {
    const meta = assetInventoryService.getSession(req.params.id);
    if (!meta) {
      return res.apiError('Session not found', 404);
    }

    // State machine validation
    const incoming = req.body || {};
    const step = incoming.currentStep;
    if (step !== undefined && step !== null) {
      if (step >= 1 && !incoming.inventoryMode) {
        return res.apiError('Cannot proceed without selecting inventory mode', 400);
      }
      if (step >= 2 && (!Array.isArray(incoming.baselineData) || incoming.baselineData.length === 0)) {
        return res.apiError('Cannot proceed to scan without baseline data', 400);
      }
      if (step >= 3 && (!Array.isArray(incoming.scannedAssets) || incoming.scannedAssets.length === 0)) {
        return res.apiError('Cannot generate report without scanned assets', 400);
      }
    }

    const data = assetInventoryService.saveSessionData(req.params.id, req.body);
    res.apiSuccess(data, 'Session data saved successfully');
  } catch (error) {
    console.error('Error saving session:', error.message);
    res.apiError('Failed to save session', 500, error.message);
  }
});

/**
 * DELETE /sessions/:id - Delete a session
 */
router.delete('/sessions/:id', (req, res) => {
  try {
    assetInventoryService.deleteSession(req.params.id);
    res.apiSuccess(null, 'Session deleted successfully');
  } catch (error) {
    console.error('Error deleting session:', error.message);
    res.apiError('Failed to delete session', 500, error.message);
  }
});

// ========== Legacy Single-Session API (backward compatible) ==========

/**
 * GET / - Get asset inventory data (legacy)
 */
router.get('/', (req, res) => {
  try {
    const data = assetInventoryService.getData();
    res.apiSuccess(data, 'Asset inventory data fetched successfully');
  } catch (error) {
    console.error('Error getting asset inventory data:', error.message);
    res.apiError('Failed to get asset inventory data', 500, error.message);
  }
});

/**
 * POST / - Save asset inventory data (legacy)
 */
router.post('/', (req, res) => {
  try {
    const data = assetInventoryService.saveData(req.body);
    res.apiSuccess(data, 'Asset inventory data saved successfully');
  } catch (error) {
    console.error('Error saving asset inventory data:', error.message);
    res.apiError('Failed to save asset inventory data', 500, error.message);
  }
});

/**
 * DELETE / - Reset asset inventory data to defaults (legacy)
 */
router.delete('/', (req, res) => {
  try {
    const data = assetInventoryService.resetData();
    res.apiSuccess(data, 'Asset inventory data reset successfully');
  } catch (error) {
    console.error('Error resetting asset inventory data:', error.message);
    res.apiError('Failed to reset asset inventory data', 500, error.message);
  }
});

/**
 * POST /send-report - Send inventory report via email
 * Body: { reportHtml, subject, recipients }
 */
router.post('/send-report', async (req, res) => {
  try {
    const { reportHtml, subject, recipients, fromEmail, ccEmail } = req.body;
    
    if (!reportHtml || !recipients) {
      return res.apiError('Missing required fields: reportHtml, recipients', 400);
    }

    const settings = settingsService.getSettings();
    const emailConfig = settings.email || {};
    
    const smtpHost = emailConfig.smtpHost || emailConfig.smtpServer;
    if (!smtpHost) {
      return res.apiError('SMTP server not configured. Please configure in System Settings.', 400);
    }

    const emailService = new EmailService({
      smtpServer: smtpHost,
      smtpPort: emailConfig.smtpPort || 25,
      smtpUser: emailConfig.smtpUser || '',
      smtpPass: emailConfig.smtpPass || '',
      useTls: emailConfig.useTls || false
    });
    
    const mailOptions = {
      from: fromEmail || emailConfig.defaultFrom || emailConfig.fromEmail || emailConfig.smtpUser || 'printer-monitor@system.local',
      to: recipients,
      subject: subject || 'Asset Inventory Report',
      html: reportHtml
    };
    
    if (ccEmail) {
      mailOptions.cc = ccEmail;
    }

    console.log('[AssetInventory] Sending email, html length:', reportHtml?.length, 'to:', recipients);
    
    const { sendMailWithRetry } = require('../services/emailRetryHelper');
    await sendMailWithRetry({
      createTransporter: () => emailService.createTransporter(),
      mailOptions,
      contextLabel: 'Asset Inventory Report',
      logger: console
    });
    
    res.apiSuccess(null, 'Report email sent successfully');
  } catch (error) {
    console.error('Error sending asset inventory report email:', error.message);
    res.apiError('Failed to send report email', 500, error.message);
  }
});

module.exports = router;
