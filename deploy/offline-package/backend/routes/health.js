/**
 * 健康检查和许可证路由模块
 * 负责API健康检查、许可证管理和服务器监控
 */
const express = require('express');
const router = express.Router();
const os = require('os');
const settingsService = require('../services/settingsService');
const serverMonitoringService = require('../services/serverMonitoringService');
const printerMonitoringService = require('../services/printerMonitoringService');
const printServerMonitoringService = require('../services/printServerMonitoringService');

/**
 * GET / - 健康检查
 */
router.get('/', (req, res) => {
  res.apiSuccess({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }, 'API is running');
});

/**
 * GET /runtime - 运行时监控概览（桌面支持与运维排障用）
 */
router.get('/runtime', (req, res) => {
  const mem = process.memoryUsage();
  res.apiSuccess({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      uptimeSec: Math.floor(process.uptime()),
      memory: {
        rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100
      }
    },
    host: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      freeMemoryMB: Math.round((os.freemem() / 1024 / 1024) * 100) / 100,
      totalMemoryMB: Math.round((os.totalmem() / 1024 / 1024) * 100) / 100
    },
    monitoring: {
      printers: printerMonitoringService.getRuntimeStats(),
      printServers: printServerMonitoringService.getRuntimeStats()
    }
  }, 'Runtime status fetched successfully');
});

/**
 * GET /license-days - 获取剩余许可证天数
 */
router.get('/license-days', (req, res) => {
  try {
    const expirationDateStr = settingsService.getLicenseExpirationDate();
    const expirationDate = new Date(expirationDateStr);
    const today = new Date();

    // 重置时间部分以正确计算日期差
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

/**
 * GET /server-metrics - 获取本地服务器指标
 */
router.get('/server-metrics', async (req, res) => {
  try {
    console.log('Fetching local server metrics');
    const useCache = req.query.useCache !== 'false';
    const metrics = await serverMonitoringService.getAllMetrics(useCache);

    res.apiSuccess({
      metrics,
      source: 'local',
      timestamp: new Date().toISOString()
    }, 'Server metrics fetched successfully');
  } catch (error) {
    console.error('Error getting server metrics:', error);
    res.apiError('Failed to get server metrics', 500, error.message);
  }
});

/**
 * GET /remote-server-metrics/:ip - 获取远程服务器指标
 */
router.get('/remote-server-metrics/:ip', async (req, res) => {
  try {
    const { ip } = req.params;

    // 验证IP地址格式
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.apiError('Invalid IP address format', 400);
    }

    console.log(`Fetching remote server metrics for IP: ${ip}`);
    const metrics = await serverMonitoringService.monitorRemoteServer(ip);

    res.apiSuccess({
      metrics,
      source: 'remote',
      ip,
      timestamp: new Date().toISOString()
    }, 'Remote server metrics fetched successfully');
  } catch (error) {
    console.error(`Error getting remote server metrics for ${req.params.ip}:`, error);
    res.apiError('Failed to get remote server metrics', 500, error.message);
  }
});

/**
 * GET /system-info - 获取系统信息
 */
router.get('/system-info', (req, res) => {
  try {
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      appUptime: process.uptime()
    };

    res.apiSuccess(systemInfo, 'System information fetched successfully');
  } catch (error) {
    console.error('Error getting system info:', error);
    res.apiError('Failed to get system info', 500, error.message);
  }
});

/**
 * GET /api-status - 获取API状态汇总
 */
router.get('/api-status', async (req, res) => {
  try {
    const expirationDate = settingsService.getLicenseExpirationDate();
    const today = new Date();
    const remainingDays = Math.max(
      Math.ceil((new Date(expirationDate) - today) / (1000 * 60 * 60 * 24)),
      0
    );

    res.apiSuccess({
      api: {
        status: 'healthy',
        uptime: process.uptime()
      },
      license: {
        remainingDays,
        expirationDate,
        expired: remainingDays === 0,
        expiringsoon: remainingDays <= 7
      },
      timestamp: new Date().toISOString()
    }, 'API status fetched successfully');
  } catch (error) {
    console.error('Error getting API status:', error);
    res.apiError('Failed to get API status', 500, error.message);
  }
});

module.exports = {
  router
};
