const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const browserPuppeteer = require('puppeteer');
// 不在这里导入createWorker，而是在使用时直接导入tesseract.js

// 创建临时目录存储截图
const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

/**
 * 使用无头浏览器静默截图打印机管理页面
 * @param {string} printerIp - 打印机IP地址
 * @returns {Promise<string>} 截图文件路径
 */
async function takeScreenshot(printerIp) {
  let browser = null;
  try {
    // 启动无头浏览器
    browser = await browserPuppeteer.launch({
      headless: true, // 静默模式
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ],
      timeout: 30000 // 30秒超时
    });

    const page = await browser.newPage();
    
    // 设置页面超时
    page.setDefaultTimeout(20000);
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // 导航到打印机管理页面
    const url = `http://${printerIp}/home/index.html#hashHome`;
    console.log(`Navigating to printer page: ${url}`);
    
    // 等待页面加载
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // 等待一段时间让页面完全渲染
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 截取整个页面
    const timestamp = new Date().getTime();
    const screenshotPath = path.join(TEMP_DIR, `printer_${printerIp.replace(/\./g, '_')}_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    console.log(`Screenshot saved to: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error(`Error taking screenshot for printer ${printerIp}:`, error.message);
    throw new Error(`Failed to take screenshot: ${error.message}`);
  } finally {
    // 关闭浏览器
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 使用OCR识别截图中的墨粉数据
 * @param {string} imagePath - 截图文件路径
 * @returns {Promise<{black: number, cyan: number, magenta: number, yellow: number}>} 识别的墨粉数据
 */
async function recognizeTonerData(imagePath) {
  try {
    console.log(`Starting OCR on image: ${imagePath}`);
    
    // 创建OCR worker - 使用正确的API参数
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('eng+chi_sim', 1, {
      logger: (m) => console.log(`Tesseract.js: ${m.status}: ${m.progress}`)
    });
    
    // 执行OCR
    const { data: { text } } = await worker.recognize(imagePath);
    
    // 关闭worker
    await worker.terminate();
    
    console.log(`OCR result: ${text.substring(0, 200)}...`);
    
    // 解析墨粉数据
    return parseTonerDataFromText(text);
  } catch (error) {
    console.error(`Error during OCR processing:`, error);
    throw new Error(`OCR processing failed: ${error.message || String(error)}`);
  } finally {
    // 清理临时文件
    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        console.log(`Temporary image file deleted: ${imagePath}`);
      } catch (err) {
        console.warn(`Failed to delete temporary image file:`, err.message);
      }
    }
  }
}

/**
 * 从OCR识别的文本中解析墨粉数据
 * @param {string} text - OCR识别的文本
 * @returns {{black: number, cyan: number, magenta: number, yellow: number}} 解析后的墨粉数据
 */
function parseTonerDataFromText(text) {
  // 小写处理文本便于匹配
  const lowerText = text.toLowerCase();
  
  // 默认返回0，在没有识别到有效数据时使用
  const tonerData = {
    black: 0,
    cyan: 0,
    magenta: 0,
    yellow: 0
  };
  
  // 尝试多种模式匹配墨粉数据
  
  // 模式1: "black: 50%" 或 "黑色: 50%"
  const percentagePatterns = [
    { color: 'black', patterns: [/black:\s*(\d+)%/, /黑色:\s*(\d+)%/, /blk:\s*(\d+)%/, /k:\s*(\d+)%/] },
    { color: 'cyan', patterns: [/cyan:\s*(\d+)%/, /青色:\s*(\d+)%/, /cya:\s*(\d+)%/, /c:\s*(\d+)%/] },
    { color: 'magenta', patterns: [/magenta:\s*(\d+)%/, /洋红:\s*(\d+)%/, /红色:\s*(\d+)%/, /mag:\s*(\d+)%/, /m:\s*(\d+)%/] },
    { color: 'yellow', patterns: [/yellow:\s*(\d+)%/, /黄色:\s*(\d+)%/, /yel:\s*(\d+)%/, /y:\s*(\d+)%/] }
  ];
  
  for (const { color, patterns } of percentagePatterns) {
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        if (!isNaN(value) && value >= 0 && value <= 100) {
          tonerData[color] = value;
          console.log(`Found ${color} toner level: ${value}%`);
          break;
        }
      }
    }
  }
  
  // 模式2: 查找包含百分比的数字，尝试匹配颜色关键词
  const allNumbersWithPercent = lowerText.match(/\b(\d{1,3})%\b/g);
  if (allNumbersWithPercent) {
    allNumbersWithPercent.forEach(match => {
      const value = parseInt(match);
      const index = lowerText.indexOf(match);
      // 扩大上下文范围以捕获更多相关信息
      const context = lowerText.substring(Math.max(0, index - 50), index + 30);
      
      if (context.includes('black') || context.includes('blk') || context.includes('黑色') || context.includes('k:') || context.includes('碳粉')) {
        if (value >= 0 && value <= 100) {
          // 增强逻辑：如果是黑色数据，直接更新，不再只在当前值为0时更新
          if (tonerData.black === 0 || 
              // 优先使用更接近中间值的数据（避免极端值）
              (Math.abs(value - 50) < Math.abs(tonerData.black - 50))) {
            tonerData.black = value;
            console.log(`Updated black toner level from percent context: ${value}%`);
          }
        }
      } else if (context.includes('cyan') || context.includes('青色') || context.includes('cya') || context.includes('c:')) {
        if (value >= 0 && value <= 100) {
          // 增强逻辑：直接更新青色数据
          if (tonerData.cyan === 0 || 
              (Math.abs(value - 50) < Math.abs(tonerData.cyan - 50))) {
            tonerData.cyan = value;
            console.log(`Updated cyan toner level from percent context: ${value}%`);
          }
        }
      } else if (context.includes('magenta') || context.includes('洋红') || context.includes('红色') || context.includes('mag') || context.includes('m:')) {
        if (value >= 0 && value <= 100) {
          // 增强逻辑：直接更新洋红色数据
          if (tonerData.magenta === 0 || 
              (Math.abs(value - 50) < Math.abs(tonerData.magenta - 50))) {
            tonerData.magenta = value;
            console.log(`Updated magenta toner level from percent context: ${value}%`);
          }
        }
      } else if (context.includes('yellow') || context.includes('黄色') || context.includes('yel') || context.includes('y:')) {
        if (value >= 0 && value <= 100) {
          // 增强逻辑：直接更新黄色数据
          if (tonerData.yellow === 0 || 
              (Math.abs(value - 50) < Math.abs(tonerData.yellow - 50))) {
            tonerData.yellow = value;
            console.log(`Updated yellow toner level from percent context: ${value}%`);
          }
        }
      }
    });
  }
  
  // 模式3: 从OCR结果中观察到的特定格式"Cyan (C) Magenta (M..."，尝试提取连续的百分比数字
  // 查找可能的墨粉数据块
  const tonerBlockMatch = lowerText.match(/(cyan|magenta|yellow|black|青色|洋红|黄色|黑色).*?(\d+)%.*?(\d+)%.*?(\d+)%.*?(\d+)%/s);
  if (tonerBlockMatch) {
    console.log(`Found potential toner block: ${tonerBlockMatch[0].substring(0, 50)}...`);
    
    // 提取所有数字
    const numbers = tonerBlockMatch[0].match(/(\d+)%/g).map(m => parseInt(m));
    
    // 按照颜色顺序分配数值（常见的顺序是CMYK或KCMY）
    // 基于OCR结果观察到的顺序是Cyan (C) Magenta (M)，假设后续是Yellow (Y)和Black (K)
    if (numbers.length >= 4) {
      // 尝试不同的顺序组合，选择最合理的一组
      const possibleOrders = [
        [0, 1, 2, 3],  // CMYK
        [3, 0, 1, 2],  // KCMY
        [1, 2, 3, 0],  // MYKC
        [2, 3, 0, 1]   // YKCM
      ];
      
      for (const order of possibleOrders) {
        if (numbers[order[0]] >= 0 && numbers[order[0]] <= 100 &&
            numbers[order[1]] >= 0 && numbers[order[1]] <= 100 &&
            numbers[order[2]] >= 0 && numbers[order[2]] <= 100 &&
            numbers[order[3]] >= 0 && numbers[order[3]] <= 100) {
          
          // 如果已经有值，保留较大的值（更可能是正确的）
          tonerData.cyan = Math.max(tonerData.cyan, numbers[order[0]]);
          tonerData.magenta = Math.max(tonerData.magenta, numbers[order[1]]);
          tonerData.yellow = Math.max(tonerData.yellow, numbers[order[2]]);
          tonerData.black = Math.max(tonerData.black, numbers[order[3]]);
          
          console.log(`Extracted toner data from block:`, {
            cyan: numbers[order[0]],
            magenta: numbers[order[1]],
            yellow: numbers[order[2]],
            black: numbers[order[3]]
          });
          break;
        }
      }
    }
  }
  
  // 模式4: 直接从文本中提取所有数字，按顺序尝试分配
  // 先从原始文本中提取所有数字
  const ocrNumbers = lowerText.match(/\b(\d{1,3})\b/g)?.map(m => parseInt(m)).filter(n => n >= 0 && n <= 100) || [];
  
  // 过滤掉可能是IP地址的数字
  // 查找可能的IP地址模式（xxx.xxx.xxx.xxx）并提取这些数字
  const ipAddressNumbers = [];
  const ipMatches = text.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/g);
  if (ipMatches) {
    ipMatches.forEach(ip => {
      const ipParts = ip.split('.').map(part => parseInt(part));
      ipAddressNumbers.push(...ipParts);
    });
  }
  
  // 创建过滤后的数字列表，排除IP地址中的数字
  // 增强逻辑：只排除连续的IP地址数字，而不是单独的数字
  const filteredDigits = ocrNumbers.filter((num, index, arr) => {
    // 检查这个数字是否在IP地址数字中，并且前后数字也在IP地址中
    // 这样可以避免误过滤与IP地址数字相同的墨粉数据
    if (!ipAddressNumbers.includes(num)) {
      return true;
    }
    
    // 检查前后数字是否也在IP地址中
    const prevNum = index > 0 ? arr[index - 1] : null;
    const nextNum = index < arr.length - 1 ? arr[index + 1] : null;
    
    // 如果这个数字孤立存在，不像是IP地址的一部分，则保留
    return !(prevNum && ipAddressNumbers.includes(prevNum) && nextNum && ipAddressNumbers.includes(nextNum));
  });
  
  // 增强逻辑：降低触发条件，在部分颜色数据缺失的情况下也尝试分配
  if (filteredDigits.length >= 4 && (tonerData.black === 0 || tonerData.cyan === 0 || tonerData.magenta === 0 || tonerData.yellow === 0)) {
    console.log(`Trying to assign toner levels from filtered digits for missing colors:`, filteredDigits);
    
    // 尝试不同的连续4个数字组合
    for (let i = 0; i <= filteredDigits.length - 4; i++) {
      const [a, b, c, d] = filteredDigits.slice(i, i + 4);
      
      // 假设这些数字代表墨粉百分比（避免明显的非墨粉数值）
      if (!(a === 0 && b === 0 && c === 0 && d === 0) && !(a === 100 && b === 100 && c === 100 && d === 100)) {
        // 分配不同的可能顺序
        const possibleAssignments = [
          { black: d, cyan: a, magenta: b, yellow: c },  // CMYK
          { black: a, cyan: b, magenta: c, yellow: d },  // KCMY
          { black: b, cyan: a, magenta: d, yellow: c },  // BCMY
          { black: c, cyan: d, magenta: a, yellow: b }   // 额外的可能顺序
        ];
        
        for (const assignment of possibleAssignments) {
          // 使用这个赋值如果它看起来合理
          if (Object.values(assignment).every(v => v >= 0 && v <= 100)) {
            // 增强逻辑：更新所有缺失的颜色数据，而不仅仅是值为0的情况
            // 优先考虑接近典型墨粉值（10-90）的数据
            Object.keys(assignment).forEach(key => {
              // 如果当前值为0，或者新值更接近典型墨粉值范围，则更新
              if (tonerData[key] === 0 || 
                  (assignment[key] >= 10 && assignment[key] <= 90 && (tonerData[key] < 10 || tonerData[key] > 90))) {
                tonerData[key] = assignment[key];
              }
            });
            
            console.log(`Assigned toner data from digits:`, assignment);
            break;
          }
        }
      }
    }
  }
  
  // 如果过滤后仍然没有有效数据，尝试使用原始数字但增加额外的判断逻辑
  if ((tonerData.black === 0 || tonerData.cyan === 0 || tonerData.magenta === 0 || tonerData.yellow === 0) && ocrNumbers.length >= 4) {
    console.log(`Trying to find more relevant toner levels from ocr numbers with extra checks`);
    
    // 查找接近典型墨粉值的数字（10-90范围的数字）
    const relevantNumbers = ocrNumbers.filter(num => num >= 10 && num <= 90);
    
    if (relevantNumbers.length >= 1) {
      // 如果找到至少一个相关数字，就尝试用它作为黑色墨粉值
      tonerData.black = relevantNumbers[0];
      console.log(`Assigned black toner level based on most relevant number: ${relevantNumbers[0]}%`);
    } else if (ocrNumbers.length >= 1) {
      // 如果没有找到相关数字，尝试使用最大的非100数字作为黑色墨粉值
      const non100Numbers = ocrNumbers.filter(num => num !== 100);
      if (non100Numbers.length > 0) {
        tonerData.black = Math.max(...non100Numbers);
        console.log(`Assigned black toner level based on maximum non-100 number: ${tonerData.black}%`);
      }
    }
  }
  
  console.log(`Parsed toner data:`, tonerData);
  return tonerData;
}

/**
 * 使用静默截图和OCR获取打印机墨粉数据
 * @param {string} printerIp - 打印机IP地址
 * @returns {Promise<{black: number, cyan: number, magenta: number, yellow: number}>} 墨粉数据
 */
async function getTonerDataWithScreenshotOcr(printerIp) {
  try {
    console.log(`Starting screenshot OCR process for printer ${printerIp}`);
    
    // 1. 静默截图
    const screenshotPath = await takeScreenshot(printerIp);
    
    // 2. OCR识别
    const tonerData = await recognizeTonerData(screenshotPath);
    
    // 3. 验证数据
    const validData = {
      black: isNaN(tonerData.black) || tonerData.black < 0 || tonerData.black > 100 ? 0 : tonerData.black,
      cyan: isNaN(tonerData.cyan) || tonerData.cyan < 0 || tonerData.cyan > 100 ? 0 : tonerData.cyan,
      magenta: isNaN(tonerData.magenta) || tonerData.magenta < 0 || tonerData.magenta > 100 ? 0 : tonerData.magenta,
      yellow: isNaN(tonerData.yellow) || tonerData.yellow < 0 || tonerData.yellow > 100 ? 0 : tonerData.yellow
    };
    
    console.log(`Final validated toner data for ${printerIp}:`, validData);
    return validData;
  } catch (error) {
    console.error(`Error in screenshot OCR process for ${printerIp}:`, error.message);
    throw error;
  }
}

module.exports = {
  getTonerDataWithScreenshotOcr
};