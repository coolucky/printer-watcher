const fs = require('fs');
const path = require('path');
const printerScraper = require('./printerScraper');

// 从配置文件加载打印机列表
function loadPrinters() {
  try {
    const configPath = path.join(__dirname, 'config', 'printers.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Failed to load printer config:', error.message);
    return [
      { name: 'Beijing_12A', ip: '10.128.20.6' },
      { name: 'Beijing_12B', ip: '10.128.21.6' },
      { name: 'Shanghai_26A', ip: '10.132.20.6' },
      { name: 'Shenzhen_18F', ip: '10.136.9.6' }
    ];
  }
}

// 测试获取所有打印机的墨粉数据
async function testAllPrinters() {
  console.log('=== 开始测试所有打印机墨粉数据获取 ===');
  console.log('当前时间:', new Date().toISOString());
  
  const printers = loadPrinters();
  const results = [];
  
  for (const printer of printers) {
    console.log(`\n测试打印机: ${printer.name} (${printer.ip})`);
    try {
      const startTime = Date.now();
      const tonerData = await printerScraper.scrapePrinterTonerData(printer.ip);
      const endTime = Date.now();
      
      results.push({
        name: printer.name,
        ip: printer.ip,
        success: true,
        data: tonerData,
        timeMs: endTime - startTime
      });
      
      console.log(`成功获取数据 (耗时: ${endTime - startTime}ms):`);
      console.log(`  黑色碳粉: ${tonerData.black}%`);
      console.log(`  青色碳粉: ${tonerData.cyan}%`);
      console.log(`  洋红碳粉: ${tonerData.magenta}%`);
      console.log(`  黄色碳粉: ${tonerData.yellow}%`);
      
    } catch (error) {
      results.push({
        name: printer.name,
        ip: printer.ip,
        success: false,
        error: error.message
      });
      
      console.error(`获取数据失败:`, error.message);
    }
  }
  
  console.log('\n=== 测试结果汇总 ===');
  results.forEach(result => {
    if (result.success) {
      console.log(`${result.name} (${result.ip}): 成功 (${result.timeMs}ms)`);
      console.log(`  黑色:${result.data.black}%, 青色:${result.data.cyan}%, 洋红:${result.data.magenta}%, 黄色:${result.data.yellow}%`);
    } else {
      console.log(`${result.name} (${result.ip}): 失败 - ${result.error}`);
    }
  });
  
  // 保存结果到文件以便分析
  const resultsPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n详细结果已保存到: ${resultsPath}`);
}

// 运行测试
if (require.main === module) {
  testAllPrinters().catch(err => {
    console.error('测试执行失败:', err);
    process.exit(1);
  });
}

module.exports = { testAllPrinters };