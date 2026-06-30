// 测试脚本：使用HTTP API获取打印机数据
const path = require('path');
const printerScraper = require('./printerScraper');
const printerService = require('./services/printerService');
const configFilePath = path.join(__dirname, 'config', 'printers.json');

/**
 * 测试获取打印机数据
 * @param {string} ip - 打印机IP地址
 */
async function testPrinterData(ip) {
  try {
    console.log(`\n===== 测试打印机数据获取 (${ip}) =====`);
    
    // 直接测试printerService中的HTTP API方法
    console.log('\n1. 直接测试HTTP API方法:');
    const apiStatus = await printerService.getPrinterStatus(ip);
    console.log('API响应:', JSON.stringify(apiStatus, null, 2));
    
    // 测试完整的数据获取流程
    console.log('\n2. 测试完整的数据获取流程:');
    if (printerScraper.scrapePrinterTonerData) {
      const tonerData = await printerScraper.scrapePrinterTonerData(ip);
      console.log('最终获取的墨粉数据:', JSON.stringify(tonerData, null, 2));
    } else {
      console.log('scrapePrinterTonerData函数不可用，可能未正确导出');
      
      // 直接测试原始的HTTP API调用
      console.log('\n尝试直接调用printerService.getPrinterStatus方法:');
      const apiData = await printerService.getPrinterStatus(ip);
      console.log('直接API调用结果:', JSON.stringify(apiData, null, 2));
    }
    
    console.log('\n测试完成!');
  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('错误栈:', error.stack);
  }
}

// 运行测试
async function runTests() {
  const fs = require('fs').promises;
  
  try {
    // 安全地读取配置文件
    const configData = await fs.readFile(configFilePath, 'utf8');
    const config = JSON.parse(configData);
    
    if (config && config.printers && Array.isArray(config.printers)) {
      const printerIps = config.printers.map(printer => printer.ip).filter(Boolean);
      
      if (printerIps.length > 0) {
        console.log(`找到 ${printerIps.length} 台打印机进行测试`);
        
        // 逐一测试每台打印机
        for (const ip of printerIps) {
          await testPrinterData(ip);
        }
        return;
      }
      console.log('配置文件中没有有效的打印机IP，使用默认测试IP');
    } else {
      console.log('配置文件格式不正确，使用默认测试IP');
    }
  } catch (error) {
    console.error('加载配置文件失败:', error.message);
    console.log('使用默认测试IP');
  }
  
  // 使用默认的测试IP
  await testPrinterData('10.128.20.6'); // 使用北京的打印机作为测试
}

// 启动测试
runTests();