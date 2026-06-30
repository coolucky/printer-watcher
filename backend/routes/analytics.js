const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const analyticsService = require('../services/printAnalyticsService');
const settingsService = require('../services/settingsService');

const ALLOWED_PERIODS = new Set(['day', 'week', 'month', 'quarter', 'year']);

function resolveDateRange(start, end) {
  const endDate = end || new Date().toISOString().split('T')[0];
  const startDate = start || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })();
  return { startDate, endDate };
}

/**
 * GET /config - Get cost configuration
 */
router.get('/config', (req, res) => {
  try {
    const config = analyticsService.getConfig();
    res.apiSuccess(config, 'Analytics config fetched');
  } catch (error) {
    res.apiError('Failed to get analytics config', 500, error.message);
  }
});

/**
 * POST /config - Save cost configuration
 */
router.post('/config', (req, res) => {
  try {
    const { bwCostPerPage, colorCostPerPage, monthlyBudget, currency } = req.body;
    const config = analyticsService.saveConfig({
      bwCostPerPage: parseFloat(bwCostPerPage) || 0.08,
      colorCostPerPage: parseFloat(colorCostPerPage) || 0.8,
      monthlyBudget: parseFloat(monthlyBudget) || 0,
      currency: currency || 'CNY'
    });
    res.apiSuccess(config, 'Analytics config saved');
  } catch (error) {
    res.apiError('Failed to save analytics config', 500, error.message);
  }
});

/**
 * GET /data - Get analytics data
 * Query params:
 *   start - start date (YYYY-MM-DD), default: 30 days ago
 *   end - end date (YYYY-MM-DD), default: today
 *   period - aggregation: day|week|month|quarter|year, default: day
 *   printer - filter by printer name (optional)
 */
router.get('/data', (req, res) => {
  try {
    const { start, end, period = 'day', printer } = req.query;

    if (!ALLOWED_PERIODS.has(period)) {
      return res.apiError('Invalid period', 400, `period must be one of: ${Array.from(ALLOWED_PERIODS).join(', ')}`);
    }

    const { startDate, endDate } = resolveDateRange(start, end);
    
    const snapshots = analyticsService.getRange(startDate, endDate);
    const dailyUsage = analyticsService.calculateDailyUsage(snapshots);
    
    // Filter by printer if specified
    let filteredUsage = dailyUsage;
    if (printer) {
      filteredUsage = dailyUsage.map(day => ({
        ...day,
        printers: day.printers[printer] ? { [printer]: day.printers[printer] } : {}
      }));
    }
    
    const aggregated = analyticsService.aggregateByPeriod(filteredUsage, period);
    const config = analyticsService.getConfig();
    const summary = analyticsService.getSummary(filteredUsage, config);

    const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const currentTotals = analyticsService.getSnapshotTotals(latestSnapshot, config);
    
    res.apiSuccess({
      period,
      startDate,
      endDate,
      data: aggregated,
      summary,
      config,
      currentTotals,
      hasDailyDelta: summary.totalPages > 0
    }, 'Analytics data fetched');
  } catch (error) {
    res.apiError('Failed to get analytics data', 500, error.message);
  }
});

function resolvePaperCutConfig() {
  const runtimeSettings = settingsService.getSettings?.() || {};
  const runtimePaperCut = runtimeSettings.papercut || {};

  let backendPaperCut = {};
  try {
    const backendSettingsPath = path.join(__dirname, '..', 'config', 'settings.json');
    if (fs.existsSync(backendSettingsPath)) {
      backendPaperCut = JSON.parse(fs.readFileSync(backendSettingsPath, 'utf8')).papercut || {};
    }
  } catch (_e) {
    backendPaperCut = {};
  }

  const merged = {
    ...backendPaperCut,
    ...runtimePaperCut
  };

  const raw = (merged.apiToken || '').toString().trim();
  if (!raw) {
    return { baseUrl: '', token: '', source: 'none' };
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const parsed = new URL(raw);
      return {
        baseUrl: `${parsed.protocol}//${parsed.host}`,
        token: parsed.searchParams.get('Authorization') || parsed.searchParams.get('authorization') || '',
        source: 'apiTokenUrl'
      };
    } catch (_e) {
      return { baseUrl: '', token: raw, source: 'apiTokenRaw' };
    }
  }

  const host = (merged.host || '').toString().trim();
  const port = (merged.port || '9191').toString().trim();
  return {
    baseUrl: host ? `http://${host}:${port}` : '',
    token: raw,
    source: 'hostPortToken'
  };
}

/**
 * GET /papercut/discover - Probe common PaperCut MF API endpoints
 */
router.get('/papercut/discover', async (req, res) => {
  try {
    const conf = resolvePaperCutConfig();
    if (!conf.baseUrl || !conf.token) {
      return res.apiError('PaperCut not configured', 400, 'Missing PaperCut host/token configuration');
    }

    const candidates = [
      '/api/health/application-server/status',
      '/api/health/printers',
      '/api/health/printers/urls',
      '/api/health/print-providers/status',
      '/api/printers',
      '/api/reports',
      '/rpc/api/jsonrpc'
    ];

    const probe = async (pathName) => {
      const url = `${conf.baseUrl}${pathName}`;
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.set('Authorization', conf.token);
        const response = await fetch(urlObj.toString(), {
          headers: { Accept: 'application/json,text/csv,*/*' }
        });
        const body = await response.text();
        let jsonKeys = [];
        try {
          const parsed = JSON.parse(body);
          jsonKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 20) : [];
        } catch (_ignore) {
          jsonKeys = [];
        }
        return {
          endpoint: pathName,
          status: response.status,
          ok: response.ok,
          jsonKeys,
          sample: body.slice(0, 240)
        };
      } catch (error) {
        return {
          endpoint: pathName,
          status: 0,
          ok: false,
          jsonKeys: [],
          sample: error.message
        };
      }
    };

    const results = await Promise.all(candidates.map((item) => probe(item)));
    return res.apiSuccess({
      baseUrl: conf.baseUrl,
      source: conf.source,
      results
    }, 'PaperCut endpoint discovery completed');
  } catch (error) {
    return res.apiError('Failed to discover PaperCut endpoints', 500, error.message);
  }
});

/**
 * GET /export - Export analytics data as CSV (Excel compatible)
 */
router.get('/export', (req, res) => {
  try {
    const { start, end, period = 'day', printer } = req.query;

    if (!ALLOWED_PERIODS.has(period)) {
      return res.apiError('Invalid period', 400, `period must be one of: ${Array.from(ALLOWED_PERIODS).join(', ')}`);
    }

    const { startDate, endDate } = resolveDateRange(start, end);
    const snapshots = analyticsService.getRange(startDate, endDate);
    const dailyUsage = analyticsService.calculateDailyUsage(snapshots);
    const filteredUsage = printer
      ? dailyUsage.map((day) => ({
          ...day,
          printers: day.printers[printer] ? { [printer]: day.printers[printer] } : {}
        }))
      : dailyUsage;

    const aggregated = analyticsService.aggregateByPeriod(filteredUsage, period);

    const rows = [
      ['Period', 'Printer', 'Location', 'Total Pages', 'B/W Pages', 'Color Pages']
    ];

    aggregated.forEach((bucket) => {
      const printerEntries = Object.entries(bucket.printers || {});
      if (printerEntries.length === 0) {
        rows.push([bucket.date, '', '', 0, 0, 0]);
        return;
      }

      printerEntries.forEach(([name, stats]) => {
        rows.push([
          bucket.date,
          name,
          stats.location || '',
          stats.total || 0,
          stats.bw || 0,
          stats.color || 0
        ]);
      });
    });

    const escapeCsv = (value) => {
      const text = `${value ?? ''}`;
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csvBody = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const csvWithBom = `\uFEFF${csvBody}`;
    const filename = `print-analytics-${startDate}-to-${endDate}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvWithBom);
  } catch (error) {
    return res.apiError('Failed to export analytics', 500, error.message);
  }
});

/**
 * GET /summary - Get quick summary for current month
 */
router.get('/summary', (req, res) => {
  try {
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];
    
    const snapshots = analyticsService.getRange(startDate, endDate);
    const dailyUsage = analyticsService.calculateDailyUsage(snapshots);
    const config = analyticsService.getConfig();
    const summary = analyticsService.getSummary(dailyUsage, config);
    
    res.apiSuccess({
      month: startDate.substring(0, 7),
      ...summary,
      config
    }, 'Monthly summary fetched');
  } catch (error) {
    res.apiError('Failed to get summary', 500, error.message);
  }
});

/**
 * GET /range - Get available data date range
 */
router.get('/range', (req, res) => {
  try {
    const range = analyticsService.getAvailableDateRange();
    res.apiSuccess(range || { oldest: null, newest: null, totalDays: 0 }, 'Date range fetched');
  } catch (error) {
    res.apiError('Failed to get date range', 500, error.message);
  }
});

module.exports = router;
