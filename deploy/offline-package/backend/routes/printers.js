/**
 * 打印机路由模块
 * 负责所有打印机相关的CRUD操作和状态查询
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const printerService = require('../services/printerService');
const alertService = require('../services/alertService');
const printerScraper = require('../printerScraper');
const screenshotOcrService = require('../services/screenshotOcrService');
const { validatePrinter } = require('../middleware/validation');
const { authorizeRole } = require('../middleware/authMiddleware');

const PRINTERS_FILE = path.join(__dirname, '../config/printers.json');

// 内存中的打印机配置
let printerConfigs = [];

/**
 * 初始化打印机配置
 * @param {Array} configs - 初始打印机配置
 */
function initPrinterConfigs(configs) {
  printerConfigs = configs;
}

/**
 * 保存打印机配置到文件
 */
function savePrinterConfigs() {
  try {
    fs.writeFileSync(PRINTERS_FILE, JSON.stringify(printerConfigs, null, 2), 'utf8');
    
    // 同时更新前端数据文件
    const frontendFile = path.join(__dirname, '../../printers-data.json');
    fs.writeFileSync(frontendFile, JSON.stringify(printerConfigs, null, 2), 'utf8');
    
    return true;
  } catch (error) {
    console.error('Error saving printer configs:', error.message);
    return false;
  }
}

/**
 * GET / - 获取所有打印机配置
 */
router.get('/', (req, res) => {
  res.apiSuccess(printerConfigs, 'Printers fetched successfully');
});

/**
 * POST /save - 批量保存打印机 (需要 Editor+ 权限)
 */
router.post('/save', authorizeRole(['Administrator', 'Editor']), (req, res) => {
  try {
    const { printers } = req.body;
    
    if (!Array.isArray(printers)) {
      return res.apiError('Printers must be an array', 400);
    }
    
    console.log(`Saving ${printers.length} printers`);
    
    // 验证每个打印机
    for (let printer of printers) {
      const validation = validatePrinter(printer);
      if (!validation.valid) {
        return res.apiError('Printer validation failed', 400, validation.errors);
      }
    }
    
    printerConfigs = printers.map(printer => ({
      id: printer.id || Date.now().toString(),
      name: printer.name,
      ip: printer.ip,
      serialNumber: printer.serialNumber || '',
      port: printer.port || '',
      macAddress: printer.macAddress || '',
      location: printer.location || '',
      assetTag: printer.assetTag || '',
      model: printer.model || '',
      status: printer.status || 'unknown',
      isTest: printer.isTest || false,
      manualTonerLevels: printer.manualTonerLevels || {},
      lastUpdated: new Date().toISOString()
    }));
    
    savePrinterConfigs();
    res.apiSuccess({ count: printerConfigs.length }, 'Printers saved successfully');
  } catch (error) {
    console.error('Error saving printers:', error.message);
    res.apiError('Failed to save printers', 500, error.message);
  }
});

/**
 * POST /printers - 添加新打印机 (需要 Editor+ 权限)
 */
router.post('/printers', authorizeRole(['Administrator', 'Editor']), (req, res) => {
  try {
    const { name, ip } = req.body;
    
    if (!name || !ip) {
      return res.apiError('Name and IP are required', 400);
    }
    
    // 检查IP是否已存在
    if (printerConfigs.some(p => p.ip === ip)) {
      return res.apiError('Printer with this IP already exists', 409);
    }
    
    const newPrinter = {
      id: Date.now().toString(),
      name,
      ip,
      status: 'unknown',
      lastUpdated: new Date().toISOString()
    };
    
    printerConfigs.push(newPrinter);
    savePrinterConfigs();
    
    res.apiSuccess(newPrinter, 'Printer added successfully', 201);
  } catch (error) {
    console.error('Error adding printer:', error.message);
    res.apiError('Failed to add printer', 500, error.message);
  }
});

/**
 * GET /printers/:ip/snmp - 通过SNMP获取打印机状态
 */
router.get('/printers/:ip/snmp', async (req, res) => {
  try {
    const { ip } = req.params;
    const { community = 'public' } = req.query;
    
    if (!ip) {
      return res.apiError('Printer IP is required', 400);
    }
    
    const status = await printerService.getPrinterStatusViaSnmp(ip, community);
    res.apiSuccess(status, 'Printer status fetched successfully');
  } catch (error) {
    console.error('Error getting SNMP status:', error.message);
    res.apiError('Failed to get printer status', 500, error.message);
  }
});

/**
 * PUT /printers/:id - 更新打印机配置 (需要 Editor+ 权限)
 */
router.put('/printers/:id', authorizeRole(['Administrator', 'Editor']), (req, res) => {
  try {
    const { id } = req.params;
    const { name, ip, serialNumber, port, location, macAddress, assetTag, model, manualTonerLevels } = req.body;
    
    if (!name || !ip) {
      return res.apiError('Name and IP are required', 400);
    }
    
    const printerIndex = printerConfigs.findIndex(p => p.id === id);
    if (printerIndex === -1) {
      return res.apiError('Printer not found', 404);
    }
    
    // 检查IP是否被其他打印机使用
    if (printerConfigs.some((p, i) => i !== printerIndex && p.ip === ip)) {
      return res.apiError('Printer with this IP already exists', 409);
    }
    
    printerConfigs[printerIndex] = {
      ...printerConfigs[printerIndex],
      name,
      ip,
      serialNumber,
      port,
      location,
      macAddress,
      assetTag,
      model,
      manualTonerLevels,
      lastUpdated: new Date().toISOString()
    };
    
    savePrinterConfigs();
    res.apiSuccess(printerConfigs[printerIndex], 'Printer updated successfully');
  } catch (error) {
    console.error('Error updating printer:', error.message);
    res.apiError('Failed to update printer', 500, error.message);
  }
});

/**
 * DELETE /printers/:id - 删除打印机 (需要 Editor+ 权限)
 */
router.delete('/printers/:id', authorizeRole(['Administrator', 'Editor']), (req, res) => {
  try {
    const { id } = req.params;
    const initialLength = printerConfigs.length;
    
    printerConfigs = printerConfigs.filter(p => p.id !== id);
    
    if (printerConfigs.length === initialLength) {
      return res.apiError('Printer not found', 404);
    }
    
    savePrinterConfigs();
    res.apiSuccess(null, 'Printer deleted successfully');
  } catch (error) {
    console.error('Error deleting printer:', error.message);
    res.apiError('Failed to delete printer', 500, error.message);
  }
});

/**
 * GET /printer-status/:ip - 获取单个打印机的状态
 */
router.get('/printer-status/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const printer = printerConfigs.find(p => p.ip === ip);
    
    if (!printer) {
      return res.apiError('Printer not found', 404);
    }
    
    // 这里会调用 systemSettings，需要从上层获取
    const status = await printerService.getPrinterStatus(printer, {});
    res.apiSuccess(status, 'Printer status fetched successfully');
  } catch (error) {
    console.error('Error getting printer status:', error);
    res.apiError('Failed to get printer status', 500, error.message);
  }
});

/**
 * GET /all-printer-status - 获取所有打印机的状态
 * 优先返回监控服务缓存的数据（即时响应），仅在缓存为空时实时查询
 */
router.get('/all-printer-status', async (req, res) => {
  try {
    // 优先使用监控服务已缓存的最新状态（30s轮询产生的缓存）
    const { statuses: cachedStatuses, updatedAt } = printerService.getLastKnownStatuses();
    if (cachedStatuses && cachedStatuses.length > 0) {
      return res.apiSuccess(cachedStatuses, 'All printer statuses fetched successfully (cached)');
    }

    // 缓存为空（服务刚启动），执行实时查询
    console.log('Fetching all printer statuses (no cache, live query)');
    const statuses = await printerService.getPrintersStatus(printerConfigs, {});

    res.apiSuccess(statuses, 'All printer statuses fetched successfully');
  } catch (error) {
    console.error('Error fetching printer statuses:', error);
    
    // 错误时返回默认状态
    const errorStatuses = printerConfigs.map(printer => ({
      id: printer.id,
      name: printer.name,
      ip: printer.ip,
      status: 'Error',
      tonerLevels: {},
      paperStatus: 'Unknown',
      online: false,
      error: error.message
    }));
    
    res.apiSuccess(errorStatuses, 'Failed to fetch some printer statuses');
  }
});

/**
 * GET /printers/scrape/printer/:ip/toner/screenshot - 使用OCR获取墨粉数据
 */
router.get('/printers/scrape/printer/:ip/toner/screenshot', async (req, res) => {
  try {
    const { ip } = req.params;
    console.log(`Fetching printer toner data via OCR for IP: ${ip}`);
    
    const tonerData = await screenshotOcrService.getTonerDataWithScreenshotOcr(ip);
    
    res.apiSuccess({
      data: tonerData,
      source: 'screenshot_ocr'
    }, 'Toner data fetched successfully');
  } catch (error) {
    console.error(`Error fetching toner data via OCR:`, error);
    res.apiError('Failed to fetch toner data', 500, error.message);
  }
});

/**
 * GET /logs - 获取打印机状态变更日志
 */
router.get('/logs', (req, res) => {
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

module.exports = {
  router,
  initPrinterConfigs,
  getPrinterConfigs: () => printerConfigs
};
