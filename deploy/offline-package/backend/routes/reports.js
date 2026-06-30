/**
 * 报告路由模块
 * 负责生成和发送打印机状态报告
 */
const express = require('express');
const router = express.Router();
const { format, addDays } = require('date-fns');
const printerService = require('../services/printerService');
const printerScraper = require('../printerScraper');
const screenshotOcrService = require('../services/screenshotOcrService');
const settingsService = require('../services/settingsService');

/**
 * POST /generate - 生成并发送报告 (需要 Editor+ 权限)
 */
const { authorizeRole } = require('../middleware/authMiddleware');
router.post('/generate', authorizeRole(['Administrator', 'Editor']), async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      toEmail,
      fromEmail,
      ccEmail,
      manualData,
      reportHtml,
      printers,
      selectedStyle
    } = req.body;

    // 验证必需的参数
    if (!toEmail) {
      return res.apiError('Recipient email is required', 400);
    }

    // 计算默认的报告日期范围（上周）
    const defaultEndDate = addDays(new Date(), -1);
    const defaultStartDate = addDays(defaultEndDate, -6);

    const reportStartDate = startDate || format(defaultStartDate, 'yyyy-MM-dd');
    const reportEndDate = endDate || format(defaultEndDate, 'yyyy-MM-dd');

    console.log(`Generating report from ${reportStartDate} to ${reportEndDate}`);

    // 获取打印机状态
    let printersStatus = [];
    
    if (manualData && manualData.length > 0) {
      // 使用手动输入的数据
      printersStatus = manualData;
      console.log('Using manually provided printer data');
    } else if (printers && printers.length > 0) {
      // 优先使用后端缓存的最新监控数据（每30秒自动更新）
      const cached = printerService.getLastKnownStatuses();
      if (cached.statuses && cached.statuses.length > 0 && cached.updatedAt) {
        const cacheAgeMs = Date.now() - cached.updatedAt;
        const cacheAgeSec = Math.round(cacheAgeMs / 1000);
        console.log(`Using cached printer status data (age: ${cacheAgeSec}s)`);
        // 将缓存数据与请求中的打印机列表匹配
        printersStatus = printers.map(reqPrinter => {
          const cachedPrinter = cached.statuses.find(c => c.ip === reqPrinter.ip);
          if (cachedPrinter && cachedPrinter.tonerLevels && Object.keys(cachedPrinter.tonerLevels).length > 0) {
            return {
              ...reqPrinter,
              status: cachedPrinter.online ? 'online' : 'offline',
              online: cachedPrinter.online,
              tonerLevels: cachedPrinter.tonerLevels,
              source: 'cached_monitoring'
            };
          }
          return {
            ...reqPrinter,
            status: cachedPrinter ? (cachedPrinter.online ? 'online' : 'offline') : 'unknown',
            online: cachedPrinter ? cachedPrinter.online : false,
            tonerLevels: cachedPrinter?.tonerLevels || {},
            source: 'cached_monitoring'
          };
        });
      } else {
        // 缓存为空时，不再尝试实时获取
        console.log('No cached data available, will use frontend reportHtml directly');
        printersStatus = [];
      }
    } else {
      return res.apiError('No printer data provided', 400);
    }

    // 获取剩余许可证天数
    const expirationDate = settingsService.getLicenseExpirationDate();
    const today = new Date();
    const licenseDays = Math.max(
      Math.ceil((new Date(expirationDate) - today) / (1000 * 60 * 60 * 24)),
      0
    );

    // 准备邮件数据
    const emailData = {
      startDate: reportStartDate,
      endDate: reportEndDate,
      toEmail,
      fromEmail: fromEmail || process.env.DEFAULT_FROM_EMAIL,
      ccEmail,
      reportHtml
    };

    // 获取邮件服务
    const settingsModule = require('./settings');
    const emailService = settingsModule.getEmailService();

    if (!emailService) {
      return res.apiError('Email service not configured', 500);
    }

    // 获取Print Server Uptime数据 (7 days)
    let serverUptimeData = null;
    try {
      const printServerService = require('../services/printServerMonitoringService');
      const enabledServers = printServerService.getServers().filter(s => s.enabled);
      if (enabledServers.length > 0) {
        const uptimeEnd = Date.now();
        const uptimeStart = uptimeEnd - 7 * 24 * 60 * 60 * 1000;
        const stats = {};
        for (const server of enabledServers) {
          stats[server.id] = {
            ...server,
            ...printServerService.getUptimeStats(server.id, uptimeStart, uptimeEnd)
          };
        }
        serverUptimeData = stats;
      }
    } catch (e) {
      console.warn('Failed to fetch server uptime for report email:', e.message);
    }

    // 发送报告
    // 始终使用后端 generateInlineStyleReportHtml 生成邮件HTML（纯inline样式，兼容所有邮件客户端）
    // 不使用前端传入的reportHtml（可能包含<style>标签和CSS类，邮件客户端会乱码）
    const emailHtml = printersStatus.length > 0 
      ? emailService.generateInlineStyleReportHtml(printersStatus, licenseDays, serverUptimeData, selectedStyle || 1)
      : null;
    
    const result = await emailService.sendWeeklyReportWithCustomHtml(emailHtml, emailData, printersStatus, licenseDays, serverUptimeData, selectedStyle || 1);

    res.apiSuccess(
      {
        reportData: {
          startDate: reportStartDate,
          endDate: reportEndDate,
          printerCount: printersStatus.length,
          licenseDays
        },
        emailResult: result
      },
      'Report generated and sent successfully'
    );
  } catch (error) {
    console.error('Error generating report:', error);
    res.apiError('Failed to generate report', 500, error.message);
  }
});

/**
 * 获取打印机状态的辅助函数，带有重试逻辑
 */
async function getPrinterStatusesWithRetry(printers) {
  const results = [];

  for (const printer of printers) {
    try {
      let status = await printerService.getPrinterStatus(printer, {});

      // 尝试使用网页抓取获取墨粉数据
      try {
        const tonerData = await printerScraper.scrapePrinterTonerData(printer.ip);
        if (tonerData && Object.keys(tonerData).some(k => tonerData[k] > 0)) {
          status.tonerLevels = tonerData;
          status.source = 'webpage_scraping';
        }
      } catch (scraperError) {
        console.warn(`Web scraping failed for ${printer.name}:`, scraperError.message);

        // 回退到OCR方法
        try {
          const ocrData = await screenshotOcrService.getTonerDataWithScreenshotOcr(printer.ip);
          status.tonerLevels = ocrData;
          status.source = 'screenshot_ocr';
        } catch (ocrError) {
          console.warn(`OCR method failed for ${printer.name}:`, ocrError.message);
        }
      }

      results.push(status);
    } catch (error) {
      console.error(`Error getting status for ${printer.name}:`, error);
      results.push({
        ...printer,
        status: 'Error',
        error: error.message
      });
    }
  }

  return results;
}

/**
 * POST /preview - 预览报告
 * 返回后端生成的inline-style HTML（与邮件发送使用完全相同的HTML）
 */
router.post('/preview', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      printers,
      manualData,
      selectedStyle
    } = req.body;

    // 计算默认的报告日期范围
    const defaultEndDate = addDays(new Date(), -1);
    const defaultStartDate = addDays(defaultEndDate, -6);

    const reportStartDate = startDate || format(defaultStartDate, 'yyyy-MM-dd');
    const reportEndDate = endDate || format(defaultEndDate, 'yyyy-MM-dd');

    // 获取打印机状态 - 优先使用后端缓存的监控数据
    let printersStatus = [];
    if (manualData && manualData.length > 0) {
      printersStatus = manualData;
    } else if (printers && printers.length > 0) {
      const cached = printerService.getLastKnownStatuses();
      if (cached.statuses && cached.statuses.length > 0 && cached.updatedAt) {
        const cacheAgeSec = Math.round((Date.now() - cached.updatedAt) / 1000);
        console.log(`[Preview] Using cached printer status data (age: ${cacheAgeSec}s)`);
        printersStatus = printers.map(reqPrinter => {
          const cachedPrinter = cached.statuses.find(c => c.ip === reqPrinter.ip);
          if (cachedPrinter && cachedPrinter.tonerLevels && Object.keys(cachedPrinter.tonerLevels).length > 0) {
            return {
              ...reqPrinter,
              status: cachedPrinter.online ? 'online' : 'offline',
              online: cachedPrinter.online,
              tonerLevels: cachedPrinter.tonerLevels,
              source: 'cached_monitoring'
            };
          }
          return {
            ...reqPrinter,
            status: cachedPrinter ? (cachedPrinter.online ? 'online' : 'offline') : 'unknown',
            online: cachedPrinter ? cachedPrinter.online : false,
            tonerLevels: cachedPrinter?.tonerLevels || {},
            source: 'cached_monitoring'
          };
        });
      } else {
        console.log('[Preview] No cached data available');
        printersStatus = [];
      }
    }

    // 获取许可证信息
    const expirationDate = settingsService.getLicenseExpirationDate();
    const today = new Date();
    const licenseDays = Math.max(
      Math.ceil((new Date(expirationDate) - today) / (1000 * 60 * 60 * 24)),
      0
    );

    // 获取Print Server Uptime数据 (7 days)
    let serverUptimeData = null;
    try {
      const printServerService = require('../services/printServerMonitoringService');
      const enabledServers = printServerService.getServers().filter(s => s.enabled);
      if (enabledServers.length > 0) {
        const uptimeEnd = Date.now();
        const uptimeStart = uptimeEnd - 7 * 24 * 60 * 60 * 1000;
        const stats = {};
        for (const server of enabledServers) {
          stats[server.id] = {
            ...server,
            ...printServerService.getUptimeStats(server.id, uptimeStart, uptimeEnd)
          };
        }
        serverUptimeData = stats;
      }
    } catch (e) {
      console.warn('[Preview] Failed to fetch server uptime:', e.message);
    }

    // 使用emailService生成inline-style HTML（与邮件发送使用完全相同的逻辑）
    const settingsModule = require('./settings');
    const emailService = settingsModule.getEmailService();
    let previewHtml = '';
    if (emailService && printersStatus.length > 0) {
      previewHtml = emailService.generateInlineStyleReportHtml(printersStatus, licenseDays, serverUptimeData, selectedStyle || 1);
    }

    res.apiSuccess({
      startDate: reportStartDate,
      endDate: reportEndDate,
      printers: printersStatus,
      licenseDays,
      previewHtml,
      generatedAt: new Date().toISOString()
    }, 'Report preview generated successfully');
  } catch (error) {
    console.error('Error previewing report:', error);
    res.apiError('Failed to preview report', 500, error.message);
  }
});

module.exports = {
  router
};
