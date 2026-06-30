/**
 * 主路由文件 - 聚合所有路由模块
 * 采用模块化设计，便于维护和扩展
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const settingsService = require('../services/settingsService');
const routeConfig = require('../config/routeConfig');

// 导入路由模块
const { router: printersRouter, initPrinterConfigs, getPrinterConfigs } = require('./printers');
const { router: settingsRouter, initSettings } = require('./settings');
const { router: reportsRouter } = require('./reports');
const { router: healthRouter } = require('./health');
const authRouter = require('./auth');
const { router: alertsRouter } = require('./alerts');
const { router: printServersRouter } = require('./printServers');
const { router: usersRouter } = require('./users');
const { router: snapshotsRouter } = require('./snapshots');
const { router: updateRouter } = require('./update');
const assetInventoryRouter = require('./assetInventory');
const { router: jiraRouter } = require('./jira');
const alertService = require('../services/alertService');
const printServerMonitoringService = require('../services/printServerMonitoringService');
const printerMonitoringService = require('../services/printerMonitoringService');

// 导入其他服务
const printerScraper = require('../printerScraper');

// 导入认证中间件
const { authenticateToken, authorizeRole, checkTokenExpiry } = require('../middleware/authMiddleware');

// 初始化
const PRINTERS_FILE = path.join(__dirname, '../config/printers.json');
const JIRA_ALLOWED_ROLES = ['Administrator', 'Editor', 'Viewer', 'admin', 'editor', 'viewer'];
let printerConfigs = [];
let systemSettings = settingsService.getSettings();

/**
 * 加载打印机配置
 */
function loadPrinterConfigs() {
  try {
    if (fs.existsSync(PRINTERS_FILE)) {
      printerConfigs = JSON.parse(fs.readFileSync(PRINTERS_FILE, 'utf8'));
    } else {
      // 使用默认配置
      printerConfigs = [
        { name: 'Beijing_12A', ip: '192.168.1.101' },
        { name: 'Beijing_12B', ip: '192.168.1.102' },
        { name: 'Shanghai_26A', ip: '192.168.1.103' },
        { name: 'Shenzhen_18F', ip: '192.168.1.104' }
      ];
      fs.writeFileSync(PRINTERS_FILE, JSON.stringify(printerConfigs, null, 2), 'utf8');
    }

    // 初始化各个路由模块
    initPrinterConfigs(printerConfigs);
    initSettings(systemSettings);

    console.log(`✓ Loaded ${printerConfigs.length} printer configurations`);
  } catch (error) {
    console.error('Error loading printer configs:', error.message);
    printerConfigs = [];
  }
}

// 加载初始配置
loadPrinterConfigs();

/**
 * 使用路由模块 - 按照分类清晰地绑定路由
 */

// 公开路由 (无需认证)

// 认证路由 - /api/auth
router.use('/auth', authRouter);

// 健康检查路由 (公开) - /api/health
router.use('/health', healthRouter);

// 许可证检查 (向后兼容，直接在根级别) - /api/license-days
router.get('/license-days', (req, res) => {
  try {
    const settingsService = require('../services/settingsService');
    const expirationDateStr = settingsService.getLicenseExpirationDate();
    const expirationDate = new Date(expirationDateStr);
    const today = new Date();

    expirationDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = expirationDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(diffDays, 0);

    console.log(`License check - Expiration: ${expirationDateStr}, Remaining days: ${remainingDays}`);

    res.apiSuccess({
      remainingDays,
      expirationDate: expirationDateStr,
      expired: remainingDays === 0
    }, 'License information fetched successfully');
  } catch (error) {
    console.error('Error calculating license days:', error);
    res.apiError('Failed to calculate license days', 500, error.message);
  }
});

// 公开状态监控路由 (无需认证，只读)
const printerService = require('../services/printerService');

router.get('/status/printers', async (req, res) => {
  try {
    // 优先使用监控服务已缓存的最新状态
    const { statuses: cachedStatuses } = printerService.getLastKnownStatuses();
    if (cachedStatuses && cachedStatuses.length > 0) {
      return res.apiSuccess(cachedStatuses, 'Printer statuses fetched (cached)');
    }

    console.log('Fetching all printer statuses (public, no cache)');
    const configs = getPrinterConfigs();
    const statuses = await printerService.getPrintersStatus(configs, {});
    res.apiSuccess(statuses, 'Printer statuses fetched');
  } catch (error) {
    res.apiError('Failed to fetch printer statuses', 500, error.message);
  }
});

router.get('/status/print-servers', (req, res) => {
  try {
    const statuses = printServerMonitoringService.getAllStatus(true);
    res.apiSuccess(statuses, 'Print server statuses fetched');
  } catch (error) {
    res.apiError('Failed to get print server status', 500, error.message);
  }
});

router.get('/status/print-servers/timeline', (req, res) => {
  try {
    const range = req.query.range || '24h';
    let startTime;
    const now = Date.now();
    switch (range) {
      case '1h': startTime = now - 3600000; break;
      case '6h': startTime = now - 21600000; break;
      case '24h':
      default:
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startTime = today.getTime();
        break;
    }
    const timelines = printServerMonitoringService.getAllTimelines(startTime, now, true);
    res.apiSuccess(timelines, 'Print server timelines fetched');
  } catch (error) {
    res.apiError('Failed to get print server timeline', 500, error.message);
  }
});

router.get('/status/print-servers/logs', (req, res) => {
  try {
    const { serverId, event, limit = 50, offset = 0 } = req.query;
    const filters = {};
    if (serverId) filters.serverId = serverId;
    if (event) filters.event = event;
    filters.limit = parseInt(limit);
    filters.offset = parseInt(offset);
    const logs = printServerMonitoringService.getLogs(filters);
    res.apiSuccess(logs, 'Print server logs fetched');
  } catch (error) {
    res.apiError('Failed to get print server logs', 500, error.message);
  }
});

router.get('/status/printers/logs', (req, res) => {
  try {
    const { printerIp, event, limit, offset } = req.query;
    const filters = {};
    if (printerIp) filters.printerIp = printerIp;
    if (event) filters.event = event;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);
    
    const logs = printerService.getStatusLogs(filters);
    res.apiSuccess(logs, 'Printer logs fetched');
  } catch (error) {
    res.apiError('Failed to get printer logs', 500, error.message);
  }
});

// Public endpoint for report settings (no auth required for display)
router.get('/status/report-settings', (req, res) => {
  try {
    const settings = settingsService.getSettings();
    const result = {
      reportSettings: settings.reportSettings || null,
      emailContacts: settings.emailContacts || null
    };
    res.apiSuccess(result, 'Report settings fetched');
  } catch (error) {
    res.apiError('Failed to get report settings', 500, error.message);
  }
});

// 受保护路由 (需要认证) - 应用认证中间件
router.use('/printers', authenticateToken, checkTokenExpiry, printersRouter);
router.use('/settings', authenticateToken, checkTokenExpiry, settingsRouter);
router.use('/reports', authenticateToken, checkTokenExpiry, reportsRouter);
router.use('/alerts', authenticateToken, checkTokenExpiry, alertsRouter);
router.use('/print-servers', authenticateToken, checkTokenExpiry, printServersRouter);
router.use('/users', authenticateToken, checkTokenExpiry, usersRouter);
router.use('/snapshots', authenticateToken, checkTokenExpiry, snapshotsRouter);
router.use('/update', authenticateToken, checkTokenExpiry, updateRouter);

// 印量分析路由
const analyticsRouter = require('./analytics');
router.use('/analytics', authenticateToken, checkTokenExpiry, analyticsRouter);

// 资产盘点路由 (暂不需要认证, 取消注释 assetInventory.js 内的 authMiddleware 即可启用)
router.use('/asset-inventory', assetInventoryRouter);

// Jira 工单路由
router.use('/jira', authenticateToken, checkTokenExpiry, authorizeRole(JIRA_ALLOWED_ROLES), jiraRouter);

// 初始化打印服务器监控
printServerMonitoringService.init(alertService);
printServerMonitoringService.startMonitoring();

// 初始化打印机监控与告警
printerMonitoringService.init(alertService);
printerMonitoringService.startMonitoring();

// 打印机爬虫路由 (legacy support)
router.use('/', printerScraper.router);

/**
 * 错误处理中间件
 */
router.use((err, req, res, next) => {
  console.error('Route error:', err);
  res.apiError('Internal server error', 500, err.message);
});

/**
 * 未找到的路由处理
 */
router.use((req, res) => {
  res.apiError('Endpoint not found', 404);
});

/**
 * 导出路由和工具函数
 */
module.exports = router;
module.exports.reloadConfigs = loadPrinterConfigs;
module.exports.getPrinterConfigs = getPrinterConfigs;
