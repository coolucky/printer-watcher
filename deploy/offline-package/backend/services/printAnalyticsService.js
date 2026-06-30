const fs = require('fs');
const path = require('path');

const ANALYTICS_DIR = path.join(__dirname, '..', 'config', 'printAnalytics');
const DAILY_DIR = path.join(ANALYTICS_DIR, 'daily');
const CONFIG_FILE = path.join(ANALYTICS_DIR, 'config.json');

// Ensure directories exist
if (!fs.existsSync(ANALYTICS_DIR)) fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
if (!fs.existsSync(DAILY_DIR)) fs.mkdirSync(DAILY_DIR, { recursive: true });

// Default cost config
const DEFAULT_CONFIG = {
  bwCostPerPage: 0.08,
  colorCostPerPage: 0.8,
  monthlyBudget: 0, // 0 = no budget alert
  currency: 'CNY'
};

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getDailyFilePath(date) {
  return path.join(DAILY_DIR, `${date}.json`);
}

function getDailySnapshot(date) {
  const filePath = getDailyFilePath(date);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return null;
}

function saveDailySnapshot(date, data) {
  const filePath = getDailyFilePath(date);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Record current page counts for all printers (called by monitoring service)
 * @param {Array} printerStatuses - Array of { name, ip, pageCount: { total }, colorPageCount }
 */
function recordPageCounts(printerStatuses) {
  const today = getTodayDate();
  const now = new Date().toISOString();
  
  let snapshot = getDailySnapshot(today);
  if (!snapshot) {
    snapshot = {
      date: today,
      printers: {},
      lastUpdated: now
    };
  }

  for (const printer of printerStatuses) {
    if (!printer.name || !printer.pageCount) continue;
    
    const entry = snapshot.printers[printer.name] || {};
    const total = Number.isFinite(Number(printer.pageCount.total)) ? Number(printer.pageCount.total) : (entry.total || 0);
    const colorRaw = Number.isFinite(Number(printer.pageCount.color)) ? Number(printer.pageCount.color) : (entry.color || 0);
    const color = Math.max(0, Math.min(total, colorRaw));

    entry.total = total;
    entry.color = color;
    entry.bw = Math.max(0, total - color);
    entry.ip = printer.ip;
    entry.location = printer.location || '';
    snapshot.printers[printer.name] = entry;
  }

  snapshot.lastUpdated = now;
  saveDailySnapshot(today, snapshot);
}

/**
 * Get analytics data for a date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Array} Daily snapshots within range
 */
function getRange(startDate, endDate) {
  const results = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const snapshot = getDailySnapshot(dateStr);
    if (snapshot) {
      results.push(snapshot);
    }
  }
  return results;
}

/**
 * Calculate incremental usage from daily snapshots
 * @param {Array} snapshots - Array of daily snapshots (sorted by date)
 * @returns {Array} Daily usage (delta between consecutive days)
 */
function calculateDailyUsage(snapshots) {
  if (snapshots.length < 2) return [];
  
  const usage = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const dayUsage = { date: curr.date, printers: {} };
    
    for (const [name, currData] of Object.entries(curr.printers)) {
      const prevData = prev.printers[name];
      if (!prevData) continue;
      
      const totalDelta = Math.max(0, (currData.total || 0) - (prevData.total || 0));
      const colorDelta = Math.max(0, (currData.color || 0) - (prevData.color || 0));
      const bwDelta = Math.max(0, totalDelta - colorDelta);
      
      dayUsage.printers[name] = {
        total: totalDelta,
        color: colorDelta,
        bw: bwDelta,
        location: currData.location || ''
      };
    }
    usage.push(dayUsage);
  }
  return usage;
}

/**
 * Aggregate usage by period (week, month, quarter, year)
 * @param {Array} dailyUsage - From calculateDailyUsage
 * @param {string} period - 'day' | 'week' | 'month' | 'quarter' | 'year'
 */
function aggregateByPeriod(dailyUsage, period) {
  if (period === 'day') return dailyUsage;
  
  const groups = {};
  
  for (const day of dailyUsage) {
    const d = new Date(day.date);
    let key;
    
    switch (period) {
      case 'week': {
        // ISO week
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay() + 1);
        key = startOfWeek.toISOString().split('T')[0];
        break;
      }
      case 'month':
        key = day.date.substring(0, 7); // YYYY-MM
        break;
      case 'quarter': {
        const q = Math.ceil((d.getMonth() + 1) / 3);
        key = `${d.getFullYear()}-Q${q}`;
        break;
      }
      case 'year':
        key = `${d.getFullYear()}`;
        break;
      default:
        key = day.date;
    }
    
    if (!groups[key]) {
      groups[key] = { date: key, printers: {} };
    }
    
    for (const [name, data] of Object.entries(day.printers)) {
      if (!groups[key].printers[name]) {
        groups[key].printers[name] = { total: 0, color: 0, bw: 0, location: data.location };
      }
      groups[key].printers[name].total += data.total;
      groups[key].printers[name].color += data.color;
      groups[key].printers[name].bw += data.bw;
    }
  }
  
  return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get summary statistics
 */
function getSummary(dailyUsage, costConfig) {
  const config = costConfig || getConfig();
  let totalPages = 0, totalBW = 0, totalColor = 0;
  const byPrinter = {};
  const byLocation = {};
  
  for (const day of dailyUsage) {
    for (const [name, data] of Object.entries(day.printers)) {
      totalPages += data.total;
      totalBW += data.bw;
      totalColor += data.color;
      
      if (!byPrinter[name]) byPrinter[name] = { total: 0, bw: 0, color: 0, cost: 0, location: data.location };
      byPrinter[name].total += data.total;
      byPrinter[name].bw += data.bw;
      byPrinter[name].color += data.color;
      
      const loc = data.location || 'Unknown';
      if (!byLocation[loc]) byLocation[loc] = { total: 0, bw: 0, color: 0, cost: 0 };
      byLocation[loc].total += data.total;
      byLocation[loc].bw += data.bw;
      byLocation[loc].color += data.color;
    }
  }
  
  // Calculate costs
  const totalCost = totalBW * config.bwCostPerPage + totalColor * config.colorCostPerPage;
  for (const p of Object.values(byPrinter)) {
    p.cost = p.bw * config.bwCostPerPage + p.color * config.colorCostPerPage;
  }
  for (const l of Object.values(byLocation)) {
    l.cost = l.bw * config.bwCostPerPage + l.color * config.colorCostPerPage;
  }
  
  return {
    totalPages, totalBW, totalColor, totalCost,
    byPrinter, byLocation,
    budgetExceeded: config.monthlyBudget > 0 && totalCost > config.monthlyBudget,
    budget: config.monthlyBudget
  };
}

function getSnapshotTotals(snapshot, costConfig) {
  const config = costConfig || getConfig();
  if (!snapshot || !snapshot.printers) {
    return {
      totalPages: 0,
      totalBW: 0,
      totalColor: 0,
      totalCost: 0,
      byPrinter: {},
      byLocation: {}
    };
  }

  let totalPages = 0;
  let totalBW = 0;
  let totalColor = 0;
  const byPrinter = {};
  const byLocation = {};

  for (const [name, data] of Object.entries(snapshot.printers)) {
    const total = Number(data.total || 0);
    const color = Number(data.color || 0);
    const bw = Math.max(0, Number(data.bw || total - color));
    const location = data.location || 'Unknown';

    totalPages += total;
    totalBW += bw;
    totalColor += color;

    byPrinter[name] = {
      total,
      bw,
      color,
      location,
      cost: bw * config.bwCostPerPage + color * config.colorCostPerPage
    };

    if (!byLocation[location]) {
      byLocation[location] = { total: 0, bw: 0, color: 0, cost: 0 };
    }
    byLocation[location].total += total;
    byLocation[location].bw += bw;
    byLocation[location].color += color;
    byLocation[location].cost += byPrinter[name].cost;
  }

  return {
    totalPages,
    totalBW,
    totalColor,
    totalCost: totalBW * config.bwCostPerPage + totalColor * config.colorCostPerPage,
    byPrinter,
    byLocation
  };
}

/**
 * List available date range (oldest and newest snapshot)
 */
function getAvailableDateRange() {
  try {
    const files = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.json')).sort();
    if (files.length === 0) return null;
    return {
      oldest: files[0].replace('.json', ''),
      newest: files[files.length - 1].replace('.json', ''),
      totalDays: files.length
    };
  } catch (e) {
    return null;
  }
}

module.exports = {
  getConfig,
  saveConfig,
  recordPageCounts,
  getRange,
  calculateDailyUsage,
  aggregateByPeriod,
  getSummary,
  getSnapshotTotals,
  getAvailableDateRange,
  getDailySnapshot,
  getTodayDate
};
