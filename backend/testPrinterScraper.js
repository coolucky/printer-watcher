const axios = require('axios');

// 测试单台打印机数据爬取
async function testSinglePrinter() {
  try {
    const printerIp = '10.128.20.6'; // Beijing_12A的IP地址
    const response = await axios.get(`http://localhost:3001/api/printers/scrape/printer/${printerIp}/toner`);
    console.log('单台打印机爬取结果:', response.data);
    return response.data;
  } catch (error) {
    console.error('单台打印机爬取失败:', error.message);
    return null;
  }
}

// 测试多台打印机批量爬取
async function testBatchPrinters() {
  try {
    const printerIps = ['10.128.20.6', '10.128.20.7', '10.128.20.8'];
    const response = await axios.post('http://localhost:3001/api/printers/scrape/printers/toner/batch', {
      ips: printerIps
    });
    console.log('批量打印机爬取结果:', response.data);
    return response.data;
  } catch (error) {
    console.error('批量打印机爬取失败:', error.message);
    return null;
  }
}

// 运行测试
async function runTests() {
  console.log('开始测试打印机爬虫功能...');
  
  // 测试单台打印机
  console.log('\n测试单台打印机爬取:');
  const singleResult = await testSinglePrinter();
  
  // 测试多台打印机
  console.log('\n测试批量打印机爬取:');
  const batchResult = await testBatchPrinters();
  
  console.log('\n测试完成!');
}

runTests();