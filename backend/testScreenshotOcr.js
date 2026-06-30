const axios = require('axios');

/**
 * 测试使用静默截图和OCR获取打印机墨粉数据
 */
async function testScreenshotOcr() {
  try {
    const printerIp = '10.128.20.6'; // Beijing_12A的IP地址
    console.log(`开始测试静默截图和OCR功能，打印机IP: ${printerIp}`);
    
    // 调用新的API端点
    const response = await axios.get(`http://localhost:3001/api/printers/scrape/printer/${printerIp}/toner/screenshot`);
    
    console.log('静默截图和OCR测试结果:');
    console.log('成功状态:', response.data.success);
    console.log('数据来源:', response.data.source);
    console.log('墨粉数据:', response.data.data);
    console.log('时间戳:', response.data.timestamp);
    
    return response.data;
  } catch (error) {
    console.error('静默截图和OCR测试失败:', error.message);
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }
    return null;
  }
}

/**
 * 运行测试
 */
async function runTests() {
  console.log('开始测试静默截图和OCR功能...');
  
  const result = await testScreenshotOcr();
  
  if (result && result.success) {
    console.log('\n测试成功! 成功获取墨粉数据。');
  } else {
    console.log('\n测试失败! 未能获取墨粉数据。');
  }
  
  console.log('\n测试完成!');
}

runTests();