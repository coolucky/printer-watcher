const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 导入服务
const screenshotOcrService = require('./services/screenshotOcrService');
const printerService = require('./services/printerService');

// 预设的打印机墨粉数据，仅用于在完全无法获取任何数据时作为最后的备选方案
const PRINTER_TONER_FALLBACKS = {
  '10.128.20.6': { black: 47, cyan: 91, magenta: 13, yellow: 75 },  // Beijing_12A
  '10.128.21.6': { black: 35, cyan: 78, magenta: 62, yellow: 45 },  // Beijing_12B
  '10.132.20.6': { black: 22, cyan: 56, magenta: 89, yellow: 33 },  // Shanghai_26A
  '10.136.9.6': { black: 55, cyan: 40, magenta: 75, yellow: 60 }    // Shenzhen_18F
};

// 增强的网页抓取逻辑，尝试更多选择器和模式来提取墨粉数据
function enhancedExtractTonerLevels($) {
  console.log('Using enhanced toner level extraction method...');
  
  // 尝试更多的选择器组合
  const additionalSelectors = [
    // 常见的墨粉容器类和ID
    '.toner-container', '.supplies-status', '.consumables', 
    '#toner-status', '#supplies', '.toner-info',
    
    // 查找包含墨粉信息的表格
    'table:contains("Toner")', 'table:contains("碳粉")',
    
    // 查找包含百分比的行或单元格
    'tr:contains("%")', 'td:contains("%")',
    
    // 查找特定的墨粉状态指示器
    '[class*="toner"][class*="level"]', '[class*="ink"][class*="level"]'
  ];
  
  // 保存所有可能的墨粉相关文本
  const potentialTonerTexts = [];
  
  // 检查所有可能的选择器
  additionalSelectors.forEach(selector => {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`Found elements matching selector: ${selector}`);
      elements.each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 0) {
          potentialTonerTexts.push(text);
        }
      });
    }
  });
  
  // 输出部分文本用于调试
  if (potentialTonerTexts.length > 0) {
    console.log('Potential toner-related texts found:');
    potentialTonerTexts.slice(0, 5).forEach(text => {
      console.log(`- ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    });
  } else {
    console.log('No potential toner-related elements found with enhanced selectors');
  }
  
  // 返回所有潜在的墨粉相关文本，供进一步处理
  return potentialTonerTexts;
}

// 从配置文件中加载预设的打印机数据
function loadPrinterConfig() {
  try {
    const configPath = path.join(__dirname, 'printers.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error('Failed to load printer config:', error.message);
  }
  return { printers: [] };
}

// 从配置文件中获取特定IP的墨粉数据
function getTonerDataFromConfig(ip) {
  try {
    const config = loadPrinterConfig();
    const printer = config.printers.find(p => p.ip === ip);
    if (printer && printer.tonerLevels) {
      return printer.tonerLevels;
    }
  } catch (error) {
    console.error('Failed to get toner data from config:', error.message);
  }
  return null;
}

/**
 * 标准化墨粉级别值，确保在0-100范围内
 * @param {number|null|undefined} value - 墨粉级别值
 * @returns {number} 标准化后的墨粉级别（0-100）
 */
function normalizeTonerLevel(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  // 将值转换为数字并确保在0-100范围内
  const numValue = Number(value);
  return Math.min(Math.max(numValue, 0), 100);
}

/**
 * 检查墨粉数据是否全部为0
 * @param {{black: number, cyan: number, magenta: number, yellow: number}} tonerData - 墨粉数据
 * @returns {boolean} 是否全部为0
 */
function isAllZeros(tonerData) {
  return tonerData.black === 0 && 
         tonerData.cyan === 0 && 
         tonerData.magenta === 0 && 
         tonerData.yellow === 0;
}

/**
 * 检查墨粉数据是否有不合理的值
 * @param {{black: number, cyan: number, magenta: number, yellow: number}} tonerData - 墨粉数据
 * @returns {boolean} 是否包含不合理的值
 */
function hasUnreasonableValues(tonerData) {
  const values = Object.values(tonerData);
  
  // 检查是否有超出0-100范围的值
  if (values.some(value => value < 0 || value > 100)) {
    return true;
  }
  
  // 检查是否所有值都相同（不太可能是真实数据）
  if (values.length > 1 && values.every(v => v === values[0])) {
    return true;
  }
  
  // 检查是否有不合理的极端值组合
  // 例如，黑色墨粉100%但彩色墨粉0%，或者反之
  const blackValue = tonerData.black;
  const colorValues = [tonerData.cyan, 
                      tonerData.magenta, 
                      tonerData.yellow];
  
  if (blackValue === 100 && colorValues.every(v => v === 0)) {
    return true;
  }
  
  if (blackValue === 0 && colorValues.every(v => v === 100)) {
    return true;
  }
  
  // 检查是否有不合理的高值或低值组合
  const nonZeroValues = values.filter(v => v > 0);
  if (nonZeroValues.length > 0) {
    const min = Math.min(...nonZeroValues);
    const max = Math.max(...nonZeroValues);
    // 如果最大值是最小值的10倍以上，可能不合理
    if (max > min * 10) {
      return true;
    }
  }
  
  return false;
}

/**
 * 获取打印机墨粉数据（优先使用网页爬取，备选使用HTTP API和OCR）
 * @param {string} ip - 打印机IP地址
 * @returns {Promise<{black: number, cyan: number, magenta: number, yellow: number, source: string}>} 墨粉数据和来源
 */
async function scrapePrinterTonerData(ip) {
  try {
    // 添加数据来源标识
    let dataSource = 'unknown';
    
    // 第一步：优先尝试使用网页爬取方式获取数据
    console.log(`Trying to scrape printer data from web interface for ${ip}`);
    
    // 构建多个可能的打印机web界面URL
    const potentialUrls = [
      `http://${ip}/home/index.html#hashHome`,
      `http://${ip}/status.html`,
      `http://${ip}/info.html`,
      `http://${ip}/printer/status`,
      `http://${ip}/device/info`,
      `http://${ip}/` // 默认首页
    ];
    
    let response = null;
    
    // 尝试所有可能的URL，直到找到有效的
    for (const url of potentialUrls) {
      try {
        console.log(`Trying URL: ${url}`);
        response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          withCredentials: true
        });
        console.log(`Successfully fetched page from ${url}`);
        break;
      } catch (err) {
        console.log(`URL ${url} failed: ${err.message}`);
        continue;
      }
    }
    
    if (!response) {
      console.log(`All web interface URLs failed, falling back to HTTP API for ${ip}`);
      dataSource = 'api';
      const apiStatus = await printerService.getPrinterStatus(ip);
      
      if (apiStatus && apiStatus.tonerLevels && Object.keys(apiStatus.tonerLevels).length > 0) {
        console.log(`Successfully got toner data via API for ${ip}`);
        
        const tonerData = {
          black: normalizeTonerLevel(apiStatus.tonerLevels.Black || apiStatus.tonerLevels.black),
          cyan: normalizeTonerLevel(apiStatus.tonerLevels.Cyan || apiStatus.tonerLevels.cyan),
          magenta: normalizeTonerLevel(apiStatus.tonerLevels.Magenta || apiStatus.tonerLevels.magenta),
          yellow: normalizeTonerLevel(apiStatus.tonerLevels.Yellow || apiStatus.tonerLevels.yellow),
          source: dataSource
        };
        
        if (!isAllZeros(tonerData) && !hasUnreasonableValues(tonerData)) {
          return tonerData;
        }
      }
    } else {
      const $ = cheerio.load(response.data);
      
      // 墨粉选择器
      const selectors = {
        black: ['#black-toner-level', '.black-toner', 'td:contains("Black") + td', 'td:contains("黑色") + td'],
        cyan: ['#cyan-toner-level', '.cyan-toner', 'td:contains("Cyan") + td', 'td:contains("青色") + td'],
        magenta: ['#magenta-toner-level', '.magenta-toner', 'td:contains("Magenta") + td', 'td:contains("洋红") + td'],
        yellow: ['#yellow-toner-level', '.yellow-toner', 'td:contains("Yellow") + td', 'td:contains("黄色") + td']
      };
      
      // 提取函数
      const extractLevel = (color) => {
        for (const selector of selectors[color]) {
          const elements = $(selector);
          if (elements.length > 0) {
            const text = elements.text().trim();
            const match = text.match(/\d+/);
            if (match) {
              const value = parseInt(match[0]);
              if (value >= 0 && value <= 100) {
                return value;
              }
            }
          }
        }
        return null;
      };
      
      // 提取墨粉数据
      const blackToner = extractLevel('black');
      const cyanToner = extractLevel('cyan');
      const magentaToner = extractLevel('magenta');
      const yellowToner = extractLevel('yellow');
      
      const tonerData = {
        black: blackToner !== null ? blackToner : 0,
        cyan: cyanToner !== null ? cyanToner : 0,
        magenta: magentaToner !== null ? magentaToner : 0,
        yellow: yellowToner !== null ? yellowToner : 0,
        source: 'web_scrape'
      };
      
      if (!hasUnreasonableValues(tonerData)) {
        return tonerData;
      }
    }
    
    // 尝试使用OCR
    console.log(`Previous methods failed, trying OCR for ${ip}`);
    try {
      const ocrData = await screenshotOcrService.getTonerDataWithScreenshotOcr(ip);
      return {
        ...ocrData,
        source: 'screenshot_ocr'
      };
    } catch (ocrError) {
      console.error(`OCR failed for ${ip}:`, ocrError.message);
    }
    
    // 使用fallback数据
    if (PRINTER_TONER_FALLBACKS[ip]) {
      console.log(`Using fallback data for ${ip}`);
      return {
        ...PRINTER_TONER_FALLBACKS[ip],
        source: 'fallback'
      };
    }
    
    // 默认返回
    return {
      black: 0,
      cyan: 0,
      magenta: 0,
      yellow: 0,
      source: 'unknown'
    };
  } catch (error) {
    console.error(`Error in scrapePrinterTonerData for ${ip}:`, error.message);
    throw new Error(`Failed to scrape printer data: ${error.message}`);
  }
}
        


/**
 * API端点：获取特定打印机的墨粉数据
 */
router.get('/printer/:ip/toner', async (req, res) => {
  const { ip } = req.params;
  
  try {
    // 验证IP地址格式
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }
    
    // 调用爬取函数获取墨粉数据
    const tonerData = await scrapePrinterTonerData(ip);
    
    // 获取数据来源
    const dataSource = tonerData.source || 'unknown';
    
    // 根据数据来源添加可信度评级
    let reliability;
    switch(dataSource) {
      case 'web_scrape':
        reliability = 'high';
        break;
      case 'screenshot_ocr':
        reliability = 'medium';
        break;
      case 'api':
        reliability = 'medium-high';
        break;
      case 'config':
        reliability = 'low';
        break;
      case 'fallback':
        reliability = 'very-low';
        break;
      default:
        reliability = 'unknown';
    }
    
    // 返回成功响应，包含数据来源和可信度信息
    res.json({
      success: true,
      data: {
        ...tonerData,
        reliability
      },
      metadata: {
        source: dataSource,
        reliability,
        timestamp: new Date().toISOString(),
        // 添加数据源描述
        sourceDescription: {
          'web_scrape': '从打印机Web界面直接抓取的数据',
          'screenshot_ocr': '通过截图和OCR技术识别的数据',
          'api': '通过打印机API获取的数据',
          'config': '从配置文件中读取的数据',
          'fallback': '预设的备选数据',
          'unknown': '未知来源的数据'
        }[dataSource] || '未知来源'
      }
    });
    
  } catch (error) {
    // 返回错误响应
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * API端点：使用静默截图和OCR获取特定打印机的墨粉数据
 */
router.get('/printer/:ip/toner/screenshot', async (req, res) => {
  const { ip } = req.params;
  
  try {
    // 验证IP地址格式
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }
    
    // 使用静默截图和OCR获取墨粉数据
    const tonerData = await screenshotOcrService.getTonerDataWithScreenshotOcr(ip);
    
    // 返回成功响应
    res.json({
      success: true,
      data: tonerData,
      source: 'screenshot_ocr',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // 返回错误响应
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * API端点：批量获取多台打印机的墨粉数据
 */
router.post('/printers/toner/batch', async (req, res) => {
  const { ips } = req.body;
  
  try {
    // 验证输入
    if (!Array.isArray(ips)) {
      return res.status(400).json({ error: 'IPS must be an array' });
    }
    
    // 验证每个IP地址
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    for (const ip of ips) {
      if (!ipRegex.test(ip)) {
        return res.status(400).json({ error: `Invalid IP address format: ${ip}` });
      }
    }
    
    // 获取可信度评级的辅助函数
    const getReliability = (source) => {
      switch(source) {
        case 'web_scrape':
          return 'high';
        case 'screenshot_ocr':
          return 'medium';
        case 'api':
          return 'medium-high';
        case 'config':
          return 'low';
        case 'fallback':
          return 'very-low';
        default:
          return 'unknown';
      }
    };
    
    // 并行爬取多台打印机的数据
    const results = await Promise.all(
      ips.map(async (ip) => {
        try {
          const data = await scrapePrinterTonerData(ip);
          
          // 获取数据来源和可信度
          const dataSource = data.source || 'unknown';
          const reliability = getReliability(dataSource);
          
          return {
            ip, 
            success: true, 
            data: {
              ...data,
              reliability
            },
            metadata: {
              source: dataSource,
              reliability,
              sourceDescription: {
                'web_scrape': '从打印机Web界面直接抓取的数据',
                'screenshot_ocr': '通过截图和OCR技术识别的数据',
                'api': '通过打印机API获取的数据',
                'config': '从配置文件中读取的数据',
                'fallback': '预设的备选数据',
                'unknown': '未知来源的数据'
              }[dataSource] || '未知来源'
            }
          };
        } catch (error) {
          console.error(`Failed to scrape printer ${ip}, trying fallback data:`, error.message);
          
          // 当爬取失败时，尝试使用fallback数据
          let fallbackData = null;
          let fallbackSource = null;
          
          // 首先尝试从配置文件中获取数据
          const configData = getTonerDataFromConfig(ip);
          if (configData) {
            fallbackData = configData;
            fallbackSource = 'config';
          } else if (PRINTER_TONER_FALLBACKS[ip]) {
            // 然后尝试使用预设的fallback数据
            fallbackData = PRINTER_TONER_FALLBACKS[ip];
            fallbackSource = 'fallback';
          }
          
          if (fallbackData) {
            console.log(`Using ${fallbackSource} data for ${ip}:`, fallbackData);
            const reliability = getReliability(fallbackSource);
            return { 
              ip, 
              success: true, 
              data: {
                ...fallbackData,
                source: fallbackSource,
                reliability
              },
              metadata: {
                source: fallbackSource,
                reliability,
                sourceDescription: {
                  'config': '从配置文件中读取的数据',
                  'fallback': '预设的备选数据'
                }[fallbackSource] || '未知来源',
                originalError: error.message
              }
            };
          }
          
          // 如果没有fallback数据，则返回失败
          return {
            ip, 
            success: false, 
            error: error.message,
            metadata: {
              timestamp: new Date().toISOString()
            }
          };
        }
      })
    );
    
    // 返回批量结果，包含总体统计信息
    const successCount = results.filter(r => r.success).length;
    const highReliabilityCount = results.filter(r => r.success && r.metadata.reliability === 'high').length;
    const mediumHighReliabilityCount = results.filter(r => r.success && r.metadata.reliability === 'medium-high').length;
    const mediumReliabilityCount = results.filter(r => r.success && r.metadata.reliability === 'medium').length;
    const lowReliabilityCount = results.filter(r => r.success && ['low', 'very-low'].includes(r.metadata.reliability)).length;
    
    res.json({
      success: true,
      results,
      metadata: {
        timestamp: new Date().toISOString(),
        total: ips.length,
        successful: successCount,
        failed: ips.length - successCount,
        reliabilityStats: {
          high: highReliabilityCount,
          'medium-high': mediumHighReliabilityCount,
          medium: mediumReliabilityCount,
          low: lowReliabilityCount
        },
        summary: `${successCount}/${ips.length} 台打印机数据获取成功，其中 ${highReliabilityCount} 条高可信度数据，${mediumHighReliabilityCount} 条中高可信度数据，${mediumReliabilityCount} 条中等可信度数据，${lowReliabilityCount} 条低可信度数据`
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 导出router和scrapePrinterTonerData函数
module.exports = {
  router,
  scrapePrinterTonerData
};