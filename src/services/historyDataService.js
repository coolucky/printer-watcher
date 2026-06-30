// 历史数据服务 - 用于管理打印历史记录

// 定义历史记录文件路径
const HISTORY_FILE_NAME = 'printer-history.json';

// 最大历史记录数量 - 保留最近6次配置变更
export const MAX_HISTORY_RECORDS = 6;

// 浏览器环境下的初始化
const initializeBrowserEnvironment = () => {
  console.log('History data service initialized in browser environment');
};

// 直接初始化环境
initializeBrowserEnvironment();

// 清除浏览器中可能存在的localStorage历史数据（用于清理）
const clearLocalStorageHistory = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('unifiedPrinterHistory');
      console.log('Cleared any existing localStorage history data to avoid conflicts');
    }
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
};

// 不再立即清理localStorage，保留现有的历史记录
// 只在显式调用clearHistory时才清理

// 浏览器环境下不再需要文件存在检查函数

// 从localStorage加载历史记录
const loadHistoryFromStorage = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const storedData = localStorage.getItem('unifiedPrinterHistory');
      if (storedData) {
        const data = JSON.parse(storedData);
        return data.records || [];
      }
    }
    return [];
  } catch (error) {
    console.error('Failed to load history from storage:', error);
    return [];
  }
};

// 保存历史记录的功能已直接在saveHistory函数中实现

// 添加新的历史记录
export const addHistoryRecord = (description, printerData) => {
  try {
    const newRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      description,
      data: printerData ? JSON.parse(JSON.stringify(printerData)) : []
    };
    
    const existingRecords = loadHistory();
    // 新记录在前，限制最多保留 MAX_HISTORY_RECORDS 条
    const updatedRecords = [newRecord, ...existingRecords].slice(0, MAX_HISTORY_RECORDS);
    
    const saveResult = saveHistory(updatedRecords);
    return saveResult ? newRecord : null;
  } catch (error) {
    console.error('[historyDataService] addHistoryRecord failed:', error);
    return null;
  }
};

// 统一的保存接口
export const saveHistory = (records) => {
  try {
    const recordsArray = Array.isArray(records) ? records : [];
    // 保留前 MAX_HISTORY_RECORDS 条（最新在前）
    const limitedRecords = recordsArray.slice(0, MAX_HISTORY_RECORDS);
    
    const dataToSave = {
      records: limitedRecords,
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('unifiedPrinterHistory', JSON.stringify(dataToSave));
      return true;
    }
    return false;
  } catch (error) {
    console.error('[historyDataService] saveHistory failed:', error);
    return false;
  }
};

// 统一的加载接口
export const loadHistory = () => {
  return loadHistoryFromStorage();
};

// 清除所有历史记录
export const clearHistory = () => {
  try {
    // 确保清除任何可能存在的localStorage数据
    clearLocalStorageHistory();
    
    // 浏览器环境下不需要文件系统操作
    return true;
  } catch (error) {
    console.error('Failed to clear history:', error);
    return false;
  }
};

// 初始化历史记录数据
export const initializeHistoryData = () => {
  try {
    const existingHistory = loadHistoryFromStorage();
    if (!existingHistory || existingHistory.length === 0) {
      console.log('No history records found - will be populated on first config change');
    }
  } catch (error) {
    console.error('Error during history data initialization:', error);
  }
};

export default {
  loadHistory,
  saveHistory,
  addHistoryRecord,
  clearHistory,
  initializeHistoryData,
  MAX_HISTORY_RECORDS
};