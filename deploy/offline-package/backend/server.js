const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// 导入验证中间件
const { sanitizeInputMiddleware, preventInjectionMiddleware } = require('./middleware/validation');
// 导入响应格式化中间件
const { responseHelperMiddleware } = require('./middleware/responseFormatter');
// 导入路由配置
const routeConfig = require('./config/routeConfig');

// Create Express application
const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:9191',
  'http://127.0.0.1:9191'
];

// Middleware configuration
// CORS 配置 - 限制只允许前端域名
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : defaultAllowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 安全中间件：清理和防止注入
app.use(sanitizeInputMiddleware);
app.use(preventInjectionMiddleware);

// 响应格式化中间件
app.use(responseHelperMiddleware);

// Basic route test
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Printer Status API is running',
    timestamp: new Date().toISOString()
  });
});

// Import and use API routes
const routes = require('./routes');
const scheduledReportService = require('./services/scheduledReportService');
app.use('/api', routes);


// 生产环境中提供前端静态文件
if (process.env.NODE_ENV === 'production') {
  // 设置静态文件目录
  const frontendDir = path.resolve(__dirname, '../dist');
  app.use(express.static(frontendDir));
  
  // 处理SPA路由，所有未匹配的路由都返回index.html
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server with timeout settings
const server = app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✓ Backend server running on http://localhost:${PORT}`);
  console.log(`✓ Server started at ${new Date().toISOString()}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // 打印路由信息
  routeConfig.printRouteInfo();

  scheduledReportService.start();
  
  console.log(`${'='.repeat(50)}\n`);
});

// Set server timeout to 40 seconds (longer than the 30s timeout set for Puppeteer and axios)
// This ensures the server doesn't timeout before the operation completes
server.setTimeout(40000); // 40 seconds

// Handle server errors gracefully
server.on('error', (error) => {
  console.error('Server error:', error);
  // Don't exit the process on error
});

// Handle unhandled rejections globally
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions globally
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process on exception
});

// Keep the server running by preventing it from exiting due to no active handles
// This is a safeguard to ensure the server stays running
setInterval(() => {
  // This empty interval keeps the event loop alive
}, 10000);

console.log('Server initialized with error handling and keep-alive mechanism');
module.exports = app;