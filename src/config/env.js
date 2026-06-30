/**
 * 环境配置文件 - 统一管理所有环境变量
 * 避免在整个应用中硬编码配置值
 */

const ENV_CONFIG = {
  // API 基础URL
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  
  // 应用环境
  NODE_ENV: import.meta.env.MODE || 'development',
  
  // 功能开关
  ENABLE_DEBUG_MODE: import.meta.env.DEV,
  ENABLE_MOCK_DATA: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true',
};

/**
 * 验证环境配置
 */
const validateConfig = () => {
  if (!ENV_CONFIG.API_BASE_URL) {
    console.warn('⚠️ API_BASE_URL not configured. Using default:', '/api');
  }
};

// 应用启动时验证配置
validateConfig();

export default ENV_CONFIG;
