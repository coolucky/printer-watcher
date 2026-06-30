const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const ping = require('ping');
const snmpService = require('./snmpService');

const PRINTER_LOGS_FILE = path.join(__dirname, '../config/printerStatusLogs.json');
const monitorVerboseLogs = process.env.MONITOR_VERBOSE_LOGS === 'true';

function logVerbose(...args) {
  if (monitorVerboseLogs) {
    console.log(...args);
  }
}

function parseStatusLogsContent(rawContent = '') {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return { logs: [], repairedContent: null };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return { logs: Array.isArray(parsed) ? parsed : [], repairedContent: null };
  } catch (error) {
    const repairedContent = trimmed
      .replace(/\]\s*\[/g, ',')
      .replace(/\]\s*\{/g, ',{');

    const repaired = JSON.parse(repairedContent);
    return {
      logs: Array.isArray(repaired) ? repaired : [],
      repairedContent: JSON.stringify(Array.isArray(repaired) ? repaired : [], null, 2),
    };
  }
}

class PrinterService {
  constructor() {
    this.timeout = 5000;
    this.paperCutDiscoveryCache = new Map();
    // 缓存最近一次成功获取的打印机状态数据（含toner）
    this.lastKnownStatuses = [];
    this.lastStatusUpdateTime = null;
    // 打印机状态变更日志 - 从文件加载
    this.statusLogs = this.loadStatusLogs();
    this.maxLogs = 500;
    this.previousOnlineMap = {}; // track previous online/offline state per IP
    this.statusLogsWritePromise = Promise.resolve();
  }

  loadStatusLogs() {
    try {
      if (fsSync.existsSync(PRINTER_LOGS_FILE)) {
        const data = fsSync.readFileSync(PRINTER_LOGS_FILE, 'utf8');
        const { logs, repairedContent } = parseStatusLogsContent(data);
        if (repairedContent) {
          fsSync.writeFileSync(PRINTER_LOGS_FILE, `${repairedContent}\n`, 'utf8');
          logVerbose('[PrinterService] Repaired malformed status log file during load');
        }
        logVerbose(`[PrinterService] Loaded ${logs.length} status logs from file`);
        return logs;
      }
    } catch (error) {
      console.error('[PrinterService] Error loading status logs:', error.message);
    }
    return [];
  }

  saveStatusLogs() {
    const payload = JSON.stringify(this.statusLogs, null, 2);
    const tempFile = `${PRINTER_LOGS_FILE}.tmp`;

    this.statusLogsWritePromise = this.statusLogsWritePromise
      .catch(() => {})
      .then(async () => {
        await fs.writeFile(tempFile, payload, 'utf8');
        await fs.rename(tempFile, PRINTER_LOGS_FILE);
      })
      .catch(error => console.error('[PrinterService] Error saving status logs:', error.message));
  }
  /**
   * 获取缓存的最新打印机状态数据（供报告生成使用）
   */
  getLastKnownStatuses() {
    return {
      statuses: this.lastKnownStatuses,
      updatedAt: this.lastStatusUpdateTime
    };
  }

  /**
   * Record a printer status change log entry
   */
  addStatusLog(printer, event, timestamp) {
    const entry = {
      id: `plog_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      printerName: printer.name || 'Unknown',
      printerIp: printer.ip || '',
      event, // 'offline' | 'recovery'
      timestamp,
      date: new Date(timestamp).toISOString()
    };
    if (event === 'recovery' && this.previousOnlineMap[printer.ip]?.offlineSince) {
      entry.downtimeMs = timestamp - this.previousOnlineMap[printer.ip].offlineSince;
    }
    this.statusLogs.push(entry);
    if (this.statusLogs.length > this.maxLogs) {
      this.statusLogs = this.statusLogs.slice(-this.maxLogs);
    }
    this.saveStatusLogs();
  }

  /**
   * Check for status changes and log them
   */
  checkAndLogStatusChanges(results) {
    const now = Date.now();
    for (const printer of results) {
      const ip = printer.ip;
      if (!ip) continue;
      const wasOnline = this.previousOnlineMap[ip]?.online;
      const isOnline = printer.online;
      
      if (wasOnline === undefined) {
        // First time seeing this printer - log if offline
        this.previousOnlineMap[ip] = { online: isOnline, since: now };
        if (!isOnline) {
          this.addStatusLog(printer, 'offline', now);
          this.previousOnlineMap[ip].offlineSince = now;
        }
      } else if (wasOnline && !isOnline) {
        // Was online, now offline
        this.addStatusLog(printer, 'offline', now);
        this.previousOnlineMap[ip] = { online: false, offlineSince: now, since: now };
      } else if (!wasOnline && isOnline) {
        // Was offline, now online (recovery)
        this.addStatusLog(printer, 'recovery', now);
        this.previousOnlineMap[ip] = { online: true, since: now };
      }
    }
  }

  /**
   * Get printer status logs with optional filters
   */
  getStatusLogs(filters = {}) {
    let logs = [...this.statusLogs];
    if (filters.printerIp) {
      logs = logs.filter(l => l.printerIp === filters.printerIp);
    }
    if (filters.event) {
      logs = logs.filter(l => l.event === filters.event);
    }
    logs.sort((a, b) => b.timestamp - a.timestamp);
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    return logs.slice(offset, offset + limit);
  }

  /**
   * Check if a printer is online via ICMP ping
   * @param {string} ip - IP address to ping
   * @returns {Promise<boolean>}
   */
  async pingPrinter(ip) {
    try {
      const result = await ping.promise.probe(ip, {
        timeout: 3,
        extra: ['-c', '1']
      });
      return result.alive;
    } catch (error) {
      console.error(`Ping failed for ${ip}:`, error.message);
      return false;
    }
  }

  /**
   * Get printer status via SNMP
   * @param {object|string} printer - Printer object or IP address
   * @param {string} community - SNMP community string (default: public)
   * @returns {Promise<object>}
   */
  async getPrinterStatusViaSnmp(printer, community = 'public') {
    // 处理参数 - 支持传入printer对象或直接传入IP
    let ip = '';
    let name = 'Unknown Printer';
    
    if (typeof printer === 'object' && printer !== null) {
      ip = printer.ip || printer.id || '';
      name = printer.name || 'Unknown Printer';
    } else {
      // 直接传入IP的情况
      ip = printer;
      name = `Printer ${ip}`;
    }
    
    console.log(`Attempting to get printer status via SNMP for ${name} (${ip})`);
    
    try {
      // 测试SNMP连接性
      const isSnmpAccessible = await snmpService.testSnmpConnectivity(ip, community);
      if (!isSnmpAccessible) {
        return this.getFailedStatus(ip, name);
      }
      
      // 获取墨粉级别
      const tonerLevels = await snmpService.getTonerLevels(ip, community);
      
      // 如果无法获取墨粉级别，返回失败状态
      if (!tonerLevels || Object.keys(tonerLevels).length === 0) {
        return this.getFailedStatus(ip, name);
      }
      
      // 构建状态对象
      const status = {
        ip,
        name,
        status: 'Ready',
        tonerLevels,
        paperStatus: 'Unknown',
        online: true,
        error: null,
        source: 'snmp'
      };
      
      console.log(`Successfully fetched SNMP data for ${ip}:`, status);
      return status;
    } catch (error) {
      console.error(`Error getting printer status via SNMP:`, error.message);
      return this.getFailedStatus(ip, name);
    }
  }

  /**
   * Get printer status via HTTP API
   * @param {object|string} printer - Printer object or IP address
   * @param {string|object} portOrPapercut - Port number or papercut settings object
   * @returns {Promise<object>}
   */
  async getPrinterStatus(printer, portOrPapercut = {}) {
    // 在try-catch外部声明变量，确保它们在任何情况下都可用
    let ip = '';
    let port = '80';
    let name = 'Unknown Printer';
    let papercutSettings = {};
    
    try {
      // 处理参数 - 支持传入printer对象或直接传入IP
      
      // 判断第一个参数是对象还是字符串
      if (typeof printer === 'object' && printer !== null) {
        ip = printer.ip || printer.id || '';
        port = printer.port || '80';
        name = printer.name || 'Unknown Printer';
      } else {
        // 直接传入IP的情况
        ip = printer;
        port = typeof portOrPapercut === 'string' ? portOrPapercut : '80';
        name = `Printer ${ip}`;
      }
      
      // 检查是否传入了papercut设置
      if (typeof portOrPapercut === 'object' && portOrPapercut !== null) {
        papercutSettings = portOrPapercut;
      }
      
      console.log(`Attempting to get printer status for ${name} (${ip}:${port})`);
      
      // 首先尝试使用PaperCut MF API获取墨粉数据（如果配置了API token）
      if (papercutSettings.apiToken) {
        try {
          console.log(`Attempting to get printer status via PaperCut MF API for ${name}`);
          const papercutStatus = await this.getPrinterStatusViaPaperCutApi(printer, papercutSettings);
          if (papercutStatus && papercutStatus.tonerLevels && Object.keys(papercutStatus.tonerLevels).length > 0) {
            console.log(`Successfully fetched toner data from PaperCut MF API for ${name}`);
            return papercutStatus;
          }
        } catch (papercutError) {
          console.warn(`PaperCut MF API failed for ${name}:`, papercutError.message);
          // 继续尝试其他方法
        }
      }
      
      // 尝试多种可能的API端点
      const apiEndpoints = [
        `http://${ip}:${port}/api/status`,
        `http://${ip}:${port}/printers/api/status`,
        `http://${ip}:${port}/status/api`,
        `http://${ip}:${port}/status.json`,
        `http://${ip}:${port}/status.htm` // 保留旧的HTML页面作为后备
      ];
      
      let response = null;
      let finalUrl = null;
      
      // 尝试所有API端点，直到找到有效的
      for (const url of apiEndpoints) {
        try {
          response = await axios.get(url, {
            timeout: this.timeout,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            withCredentials: true
          });
          finalUrl = url;
          break; // 找到有效端点，跳出循环
        } catch (err) {
          console.log(`API endpoint ${url} failed: ${err.message}`);
          // 继续尝试下一个端点
          continue;
        }
      }
      
      if (!response) {
        throw new Error(`All API endpoints failed for printer ${name} (${ip}:${port})`);
      }
      
      console.log(`Successfully fetched data from ${finalUrl}`);
      
      // 根据响应内容类型决定如何处理
      if (typeof response.data === 'object' && response.data !== null) {
        // 如果响应是JSON对象，直接使用
        return this.parseApiJsonResponse(response.data, ip, name);
      } else {
        // 否则，尝试作为HTML解析
        return this.parsePrinterStatus(response.data, ip, name);
      }
    } catch (error) {
      console.error(`Error getting printer status via API:`, error.message);
      return this.getDefaultStatus(ip, name);
    }
  }
  
  /**
   * Get printer status via PaperCut MF API
   * @param {object} printer - Printer object
   * @param {object} papercutSettings - PaperCut MF settings including API token
   * @returns {Promise<object>}
   */
  async getPrinterStatusViaPaperCutApi(printer, papercutSettings) {
    const normalized = this.normalizePaperCutSettings(papercutSettings);
    const { host, port, token, baseUrl, headers } = normalized;
    const printerName = printer.name || printer.ip;
    
    if (!host || !token) {
      throw new Error('PaperCut MF host and authorization token are required');
    }
    
    try {
      const encodedName = encodeURIComponent(printerName);
      const encodedIp = encodeURIComponent(printer.ip || '');
      const normalizedBaseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : `http://${host}:${port || 9191}`;
      const candidates = [
        printer.paperCutStatusUrl,
        printer.papercutStatusUrl,
        await this.getPaperCutStatusUrlFromDiscovery(printer, normalized),
        normalized.printerStatusUrlTemplate
          ? this.interpolatePrinterUrlTemplate(normalized.printerStatusUrlTemplate, printer)
          : null,
        `${normalizedBaseUrl}/api/health/printers/${encodedName}/status`,
        `${normalizedBaseUrl}/api/health/printer/${encodedName}/status`,
        `${normalizedBaseUrl}/api/printer/${encodedName}/status`,
        `${normalizedBaseUrl}/api/health/printer/ip/${encodedIp}/status`
      ].filter(Boolean);

      let response = null;
      let selectedUrl = null;

      for (const apiUrl of candidates) {
        try {
          console.log(`Calling PaperCut MF API: ${apiUrl}`);
          response = await axios.get(apiUrl, {
            timeout: this.timeout,
            headers: {
              ...headers,
              'Accept': 'application/json'
            },
            params: {
              authorization: token,
              Authorization: token
            }
          });
          selectedUrl = apiUrl;
          break;
        } catch (error) {
          console.log(`PaperCut endpoint failed ${apiUrl}: ${error.message}`);
        }
      }

      if (!response) {
        throw new Error(`No available PaperCut printer status endpoint for ${printerName}`);
      }

      console.log(`PaperCut MF API response for ${printerName} from ${selectedUrl}:`, response.data);
      
      // 解析API响应 - PaperCut health API only provides status, not consumables
      const status = {
        ip: printer.ip,
        name: printerName,
        status: response.data.status || 'Unknown',
        tonerLevels: {},
        paperStatus: 'Unknown',
        online: response.data.status === 'OK',
        error: response.data.status === 'OK' ? null : `PaperCut reports: ${response.data.status}`,
        source: 'papercut-health'
      };
      
      // PaperCut health API doesn't provide toner data - return what we have
      // Toner data will be obtained through secondary methods (web scraping, SNMP)
      console.log(`PaperCut health status for ${printerName}: ${status.status}`);
      return status;
    } catch (error) {
      console.error(`Error getting printer status via PaperCut MF API:`, error.message);
      throw error;
    }
  }

  async getPaperCutStatusUrlFromDiscovery(printer, normalized) {
    if (!normalized.baseUrl || !normalized.token) {
      return null;
    }

    const cacheKey = `${normalized.baseUrl}|${normalized.token}`;
    const now = Date.now();
    const cached = this.paperCutDiscoveryCache.get(cacheKey);
    if (cached && now - cached.updatedAt < 5 * 60 * 1000) {
      return this.matchPaperCutStatusUrl(cached, printer);
    }

    try {
      const [printersResp, urlsResp] = await Promise.all([
        axios.get(`${normalized.baseUrl}/api/health/printers`, {
          timeout: this.timeout,
          headers: {
            ...normalized.headers,
            Accept: 'application/json'
          },
          params: { Authorization: normalized.token }
        }),
        axios.get(`${normalized.baseUrl}/api/health/printers/urls`, {
          timeout: this.timeout,
          headers: {
            ...normalized.headers,
            Accept: 'text/csv'
          },
          params: { Authorization: normalized.token }
        })
      ]);

      const printers = Array.isArray(printersResp.data?.printers) ? printersResp.data.printers : [];
      const csvText = typeof urlsResp.data === 'string' ? urlsResp.data : '';
      const statusUrlByName = this.parsePaperCutUrlsCsv(csvText);

      const discoveryData = {
        updatedAt: now,
        printers,
        statusUrlByName
      };
      this.paperCutDiscoveryCache.set(cacheKey, discoveryData);
      return this.matchPaperCutStatusUrl(discoveryData, printer);
    } catch (error) {
      console.warn(`PaperCut discovery endpoints failed: ${error.message}`);
      return null;
    }
  }

  parsePaperCutUrlsCsv(csvText) {
    const map = new Map();
    if (!csvText) {
      return map;
    }

    const lines = csvText.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      return map;
    }

    // CSV format: Server Name,Printer Name,Location,Status Monitoring Url,...
    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(',');
      const printerName = (cols[1] || '').trim().replace(/^"|"$/g, '');
      const statusUrl = (cols[3] || '').trim().replace(/^"|"$/g, '');
      if (printerName && statusUrl) {
        map.set(printerName, statusUrl);
      }
    }

    return map;
  }

  matchPaperCutStatusUrl(discoveryData, printer) {
    const { printers, statusUrlByName } = discoveryData;
    if (!statusUrlByName || statusUrlByName.size === 0) {
      return null;
    }

    const exactByInputName = statusUrlByName.get(printer.name);
    if (exactByInputName) {
      return exactByInputName;
    }

    const ip = (printer.ip || '').trim();
    if (ip) {
      const matchedNames = printers
        .filter((p) => `${p.physicalPrinterId || ''}`.includes(ip))
        .map((p) => p.name)
        .filter(Boolean);

      for (const paperCutName of matchedNames) {
        const direct = statusUrlByName.get(paperCutName);
        if (direct) {
          return direct;
        }

        const baseName = paperCutName.includes('\\') ? paperCutName.split('\\').pop() : paperCutName;
        const byBaseName = statusUrlByName.get(baseName);
        if (byBaseName) {
          return byBaseName;
        }

        const normalizedBaseName = baseName.toLowerCase();
        for (const [csvName, url] of statusUrlByName.entries()) {
          if (csvName.toLowerCase() === normalizedBaseName) {
            return url;
          }
        }
      }
    }

    // Fuzzy fallback for inconsistent naming conventions
    const normalizedTarget = (printer.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetTokens = (printer.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (normalizedTarget) {
      for (const [paperCutName, url] of statusUrlByName.entries()) {
        const normalizedCandidate = paperCutName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) {
          return url;
        }

        const hasAllTokens = targetTokens.length > 0 && targetTokens.every((token) => paperCutName.toLowerCase().includes(token));
        if (hasAllTokens) {
          return url;
        }
      }
    }

    return null;
  }

  normalizePaperCutSettings(papercutSettings = {}) {
    const authValue = (papercutSettings.authorization || papercutSettings.apiKey || papercutSettings.apiToken || '').toString().trim();
    let baseUrl = (papercutSettings.serverUrl || '').toString().trim();
    let token = authValue;

    // 兼容把完整URL误填到token字段的场景
    if (authValue.startsWith('http://') || authValue.startsWith('https://')) {
      try {
        const parsed = new URL(authValue);
        baseUrl = `${parsed.protocol}//${parsed.host}`;
        token = parsed.searchParams.get('authorization') || parsed.searchParams.get('Authorization') || '';
      } catch (_error) {
        token = authValue;
      }
    }

    if (!baseUrl && papercutSettings.host) {
      baseUrl = `http://${papercutSettings.host}:${papercutSettings.port || 9191}`;
    }

    return {
      host: papercutSettings.host,
      port: papercutSettings.port || 9191,
      token,
      baseUrl,
      printerStatusUrlTemplate: (papercutSettings.printerStatusUrlTemplate || '').toString().trim(),
      headers: {
        Authorization: token,
        'X-Papercut-Authorization': token,
        // 兼容部分实现要求Bearer前缀
        ...(token ? { 'X-Authorization-Bearer': `Bearer ${token}` } : {})
      }
    };
  }

  interpolatePrinterUrlTemplate(template, printer) {
    const safeName = encodeURIComponent(printer.name || '');
    const safeIp = encodeURIComponent(printer.ip || '');
    return template
      .replace('{name}', safeName)
      .replace('{printerName}', safeName)
      .replace('{ip}', safeIp);
  }

  extractTonerLevels(payload) {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    if (payload.tonerLevels && typeof payload.tonerLevels === 'object') {
      return payload.tonerLevels;
    }

    const tonerLevels = {};
    const sources = [];

    if (Array.isArray(payload.consumables)) sources.push(...payload.consumables);
    if (Array.isArray(payload.supplies)) sources.push(...payload.supplies);
    if (Array.isArray(payload.toners)) sources.push(...payload.toners);
    if (Array.isArray(payload.markers)) sources.push(...payload.markers);

    sources.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const rawType = `${item.type || item.category || item.name || ''}`.toLowerCase();
      const isTonerLike = rawType.includes('toner') || rawType.includes('cartridge') || rawType.includes('consumable');
      if (!isTonerLike) return;

      const color = (item.color || item.colour || item.name || item.type || 'Black').toString();
      const rawLevel = item.level ?? item.remaining ?? item.percentage ?? item.percent ?? item.value;
      const parsedLevel = Number.parseInt(rawLevel, 10);

      if (Number.isFinite(parsedLevel)) {
        tonerLevels[color] = Math.max(0, Math.min(100, parsedLevel));
      }
    });

    ['black', 'cyan', 'magenta', 'yellow'].forEach((color) => {
      if (payload[color] !== undefined) {
        const parsed = Number.parseInt(payload[color], 10);
        if (Number.isFinite(parsed)) {
          tonerLevels[color] = Math.max(0, Math.min(100, parsed));
        }
      }
    });

    return tonerLevels;
  }
  
  /**
   * Parse printer status from JSON API response
   * @param {object} apiResponse
   * @param {string} ip
   * @param {string} name
   * @returns {object}
   */
  parseApiJsonResponse(apiResponse, ip, name) {
    // 基础状态对象
    const status = {
      ip,
      name,
      status: 'Unknown',
      tonerLevels: {},
      paperStatus: 'Unknown',
      online: true,
      error: null,
      source: 'api'
    };
    
    console.log(`Parsing API response for ${ip}:`, apiResponse);
    
    // 尝试多种可能的JSON结构
    if (apiResponse.status) {
      status.status = apiResponse.status;
    } else if (apiResponse.printerStatus) {
      status.status = apiResponse.printerStatus;
    } else if (apiResponse.state) {
      status.status = apiResponse.state;
    }
    
    // 解析墨粉数据 - 尝试多种可能的结构
    if (apiResponse.tonerLevels) {
      status.tonerLevels = apiResponse.tonerLevels;
    } else if (apiResponse.consumables && Array.isArray(apiResponse.consumables)) {
      // 处理数组形式的耗材数据
      apiResponse.consumables.forEach(consumable => {
        if (consumable.type && consumable.type.toLowerCase().includes('toner') && consumable.color && consumable.level !== undefined) {
          status.tonerLevels[consumable.color] = parseInt(consumable.level);
        }
      });
    } else if (apiResponse.black !== undefined || apiResponse.cyan !== undefined || 
               apiResponse.magenta !== undefined || apiResponse.yellow !== undefined) {
      // 直接的墨粉颜色字段
      if (apiResponse.black !== undefined) status.tonerLevels['Black'] = parseInt(apiResponse.black);
      if (apiResponse.cyan !== undefined) status.tonerLevels['Cyan'] = parseInt(apiResponse.cyan);
      if (apiResponse.magenta !== undefined) status.tonerLevels['Magenta'] = parseInt(apiResponse.magenta);
      if (apiResponse.yellow !== undefined) status.tonerLevels['Yellow'] = parseInt(apiResponse.yellow);
    }
    
    // 解析纸张状态
    if (apiResponse.paperStatus) {
      status.paperStatus = apiResponse.paperStatus;
    } else if (apiResponse.mediaStatus) {
      status.paperStatus = apiResponse.mediaStatus;
    }
    
    // 检查是否在线
    if (apiResponse.online !== undefined) {
      status.online = apiResponse.online;
    }
    
    // 添加错误信息（如果有）
    if (apiResponse.error) {
      status.error = apiResponse.error;
      status.online = false;
    }
    
    return status;
  }

  /**
   * Parse printer status from HTML response
   * @param {string} html
   * @param {string} ip
   * @param {string} name
   * @returns {object}
   */
  parsePrinterStatus(html, ip, name) {
    // Simple example parsing logic
    const status = {
      ip,
      name,
      status: 'Unknown',
      tonerLevels: {},
      paperStatus: 'Unknown',
      online: true,
      error: null
    };

    // Try to extract status information
    if (html.includes('Ready') || html.includes('就绪')) {
      status.status = 'Ready';
    } else if (html.includes('Error') || html.includes('错误')) {
      status.status = 'Error';
    } else if (html.includes('Offline') || html.includes('离线')) {
      status.status = 'Offline';
      status.online = false;
    }

    // Extract toner levels (simplified example)
    const tonerMatches = html.match(/Toner[^:]*:\s*(\d+)%/gi) || html.match(/碳粉[^:]*:\s*(\d+)%/gi);
    if (tonerMatches) {
      tonerMatches.forEach(match => {
        const parts = match.split(':');
        const color = parts[0].replace('Toner', '').replace('碳粉', '').trim();
        const level = parseInt(parts[1].replace('%', '').trim());
        status.tonerLevels[color || 'Black'] = level;
      });
    }

    // Extract paper status
    if (html.includes('Paper Jam') || html.includes('卡纸')) {
      status.paperStatus = 'Paper Jam';
    } else if (html.includes('Out of Paper') || html.includes('缺纸')) {
      status.paperStatus = 'Out of Paper';
    } else if (html.includes('Ready to Print') || html.includes('准备就绪')) {
      status.paperStatus = 'Ready';
    }

    return status;
  }

  /**
   * Get default status when real status cannot be retrieved
   * @param {string} ip
   * @param {string} name
   * @returns {object}
   */
  getDefaultStatus(ip, name) {
    return {
      ip,
      name: name || `Printer ${ip}`,
      status: 'Unknown',
      tonerLevels: null,
      paperStatus: 'Unknown',
      online: false,
      error: 'Cannot connect to printer'
    };
  }

  // 获取失败状态
  getFailedStatus(ip, name = `Printer ${ip}`) {
    return {
      ip,
      name,
      status: 'Failed',
      tonerLevels: { black: 0, cyan: 0, magenta: 0, yellow: 0 },
      paperStatus: 'Unknown',
      online: false,
      error: 'Failed to get SNMP data',
      source: 'snmp'
    };
  }

  /**
   * Get status for multiple printers
   * @param {Array} printers
   * @returns {Promise<Array>}
   */
  async getPrintersStatus(printers, papercutSettings = {}) {
    // Use ICMP ping to determine online/offline status, then fetch toner via SNMP for online printers
    const statusPromises = printers.map(async (printer) => {
      const ip = printer.ip || '';
      const name = printer.name || `Printer ${ip}`;
      
      if (!ip) {
        return { ...printer, online: false, status: 'Unknown', error: 'No IP configured', tonerLevels: null };
      }

      const isAlive = await this.pingPrinter(ip);
      logVerbose(`Ping result for ${name} (${ip}): ${isAlive ? 'online' : 'offline'}`);

      // For online printers, try to fetch toner levels, error states, and page count via SNMP
      let tonerLevels = null;
      let printerErrors = null;
      let pageCount = null;
      if (isAlive) {
        try {
          const [toner, errors, pages, colorPages] = await Promise.all([
            snmpService.getTonerLevels(ip, 'public'),
            snmpService.getPrinterErrors(ip, 'public'),
            snmpService.getPageCount(ip, 'public'),
            snmpService.getColorPageCount(ip, 'public')
          ]);
          
          if (toner && Object.keys(toner).length > 0) {
            tonerLevels = toner;
            logVerbose(`SNMP toner data for ${name} (${ip}):`, tonerLevels);
          } else {
            logVerbose(`No SNMP toner data for ${name} (${ip}), will use config fallback`);
          }
          
          printerErrors = errors;
          pageCount = pages;
          
          // Add color page count to pageCount object
          if (pageCount && colorPages !== null) {
            pageCount.color = colorPages;
          }

          // If lowPaper is reported, verify via paper tray levels
          // Only show lowPaper if 2+ trays are actually low
          if (printerErrors && printerErrors.errors && printerErrors.errors.lowPaper) {
            try {
              const trayInfo = await snmpService.getPaperTrayLevels(ip, 'public');
              if (trayInfo && trayInfo.lowCount < 2) {
                // Suppress lowPaper - only 0 or 1 tray is low
                logVerbose(`[PrinterService] Suppressing lowPaper for ${name} (${ip}): only ${trayInfo.lowCount}/${trayInfo.totalTrays} trays low`);
                printerErrors.errors.lowPaper = false;
                printerErrors.activeErrors = printerErrors.activeErrors.filter(e => e !== 'lowPaper');
                printerErrors.hasErrors = printerErrors.activeErrors.length > 0;
              } else if (trayInfo) {
                logVerbose(`[PrinterService] Keeping lowPaper for ${name} (${ip}): ${trayInfo.lowCount}/${trayInfo.totalTrays} trays low`);
              }
              // If trayInfo is null (query failed), keep the original lowPaper flag
            } catch (trayError) {
              console.warn(`[PrinterService] Paper tray check failed for ${name} (${ip}):`, trayError.message);
              // Keep original lowPaper flag on error
            }
          }
        } catch (snmpError) {
          console.warn(`SNMP fetch failed for ${name} (${ip}):`, snmpError.message);
        }
      }

      // Determine status based on error states
      // lowPaper alone is informational, not a warning
      const criticalErrorKeys = ['noPaper', 'doorOpen', 'jammed', 'offline', 'noToner', 'serviceRequested'];
      let printerStatus = isAlive ? 'Ready' : 'Offline';
      if (isAlive && printerErrors && printerErrors.hasErrors) {
        const hasCritical = criticalErrorKeys.some(k => printerErrors.errors[k]);
        if (printerErrors.errors.jammed) printerStatus = 'Paper Jam';
        else if (printerErrors.errors.noPaper) printerStatus = 'No Paper';
        else if (printerErrors.errors.doorOpen) printerStatus = 'Door Open';
        else if (printerErrors.errors.offline) printerStatus = 'Offline';
        else if (hasCritical) printerStatus = 'Warning';
        // lowPaper alone keeps status as 'Ready'
      }

      return {
        ...printer,
        online: isAlive,
        status: printerStatus,
        error: isAlive ? null : 'Printer not reachable',
        tonerLevels: tonerLevels,
        printerErrors: printerErrors,
        pageCount: pageCount
      };
    });

    try {
      const results = await Promise.all(statusPromises);
      // 缓存状态数据，保留上一次有效的toner数据（与前端localStorage策略一致）
      if (results && results.length > 0) {
        // Log status changes before updating cache
        this.checkAndLogStatusChanges(results);
        
        this.lastKnownStatuses = results.map(newResult => {
          // 如果本次SNMP没有获取到toner数据，保留上一次的有效toner数据
          if (!newResult.tonerLevels || Object.keys(newResult.tonerLevels).length === 0) {
            const prev = this.lastKnownStatuses.find(p => p.ip === newResult.ip);
            if (prev && prev.tonerLevels && Object.keys(prev.tonerLevels).length > 0) {
              return { ...newResult, tonerLevels: prev.tonerLevels };
            }
          }
          return newResult;
        });
        this.lastStatusUpdateTime = Date.now();

        // Record page counts for print analytics
        try {
          const analyticsService = require('./printAnalyticsService');
          const printerData = this.lastKnownStatuses
            .filter(p => p.online && p.pageCount)
            .map(p => ({ name: p.name, ip: p.ip, location: p.location, pageCount: p.pageCount }));
          if (printerData.length > 0) {
            analyticsService.recordPageCounts(printerData);
          }
        } catch (e) { /* analytics recording is non-critical */ }
      }
      return this.lastKnownStatuses;
    } catch (error) {
      console.error('Error getting printers status:', error);
      return printers.map(printer => ({
        ...printer,
        ...this.getDefaultStatus(printer.ip, printer.name)
      }));
    }
  }

  /**
   * Get license remaining days
   * @returns {number}
   */
  getLicenseRemainingDays() {
    // Use settings service to get license expiration date
    const settingsService = require('./settingsService');
    const expirationDateStr = settingsService.getLicenseExpirationDate();
    const expirationDate = new Date(expirationDateStr);
    
    console.log('Calculating license remaining days:');
    console.log('- Using expiration date:', expirationDateStr);
    
    const today = new Date();
    // Calculate difference in days and ensure it's not negative
    const diffTime = expirationDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 0);
  }
}

module.exports = new PrinterService();