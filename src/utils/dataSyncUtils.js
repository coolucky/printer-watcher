// 导入fileDataService
import fileDataService from '../services/fileDataService';

// 配置常量
const API_ENDPOINTS = {
  PRINTERS: '/api/printers',
  SAVE_PRINTERS: '/api/printers/save',
  HEALTH: '/api/health'
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒
const DATA_VERSION_KEY = 'printers_data_version';
const LAST_SYNC_KEY = 'printers_last_sync';

/**
 * 生成数据版本哈希
 */
const generateDataHash = (data) => {
  try {
    const stringData = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < stringData.length; i++) {
      const char = stringData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16);
  } catch {
    return Date.now().toString(16);
  }
};

/**
 * 带有重试机制的fetch函数
 */
const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 增加超时时间到15秒
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      // 检查网络连接状态
      if (!navigator.onLine && attempt === retries - 1) {
        throw new Error('Network offline, please check your connection');
      }
      
      // 如果是5xx错误、429限流或408超时错误，进行重试
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP error ${response.status}`);
        console.warn(`Server error (${response.status}), retrying (${attempt + 1}/${retries})...`);
        // 指数退避策略，添加一些随机性以避免同时重试
        const jitter = Math.random() * 0.5 + 0.75; // 0.75-1.25的随机因子
        const waitTime = Math.min(RETRY_DELAY * Math.pow(2, attempt) * jitter, 10000); // 最大等待10秒
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1 && error.name !== 'AbortError') {
        console.warn(`Request failed, retrying (${attempt + 1}/${retries})...`);
        // 指数退避策略
        const jitter = Math.random() * 0.5 + 0.75;
        const waitTime = Math.min(RETRY_DELAY * Math.pow(2, attempt) * jitter, 10000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // 记录最终错误
  console.error('All fetch attempts failed:', lastError?.message || 'Unknown error');
  throw lastError || new Error('All retries failed');
};

/**
 * 检查API健康状态
 */
const checkApiHealth = async () => {
  try {
    const response = await fetchWithRetry(API_ENDPOINTS.HEALTH, { timeout: 5000 });
    if (response.ok) {
      const healthData = await response.json();
      return healthData.status === 'healthy';
    }
    return false;
  } catch (error) {
    console.warn('API health check failed:', error.message);
    return false;
  }
};

/**
 * 初始化数据同步
 * 异步函数，使用智能同步策略，优先保证数据一致性
 */
export const initializeDataSync = async () => {
  try {
    console.log('Initializing data sync with improved strategy...');
    
    // 检查localStorage是否可用
    const localStorageAvailable = typeof localStorage !== 'undefined';
    let localPrinters = null;
    let localVersion = null;
    let lastSyncTime = null;
    
    // 从localStorage获取数据和版本信息
    if (localStorageAvailable) {
      try {
        const savedPrinters = localStorage.getItem('printers');
        localVersion = localStorage.getItem(DATA_VERSION_KEY);
        lastSyncTime = localStorage.getItem(LAST_SYNC_KEY);
        
        if (savedPrinters) {
          const parsedData = JSON.parse(savedPrinters);
          if (parsedData && Array.isArray(parsedData)) {
            localPrinters = validatePrintersData(parsedData);
            console.log(`Found ${localPrinters.length} printers in localStorage`);
          }
        }
      } catch (parseError) {
    console.error('Failed to parse data from localStorage:', parseError.message);
    // 清除损坏的数据
    try {
      localStorage.removeItem('printers');
      localStorage.removeItem(DATA_VERSION_KEY);
    } catch (storageError) {
      console.warn('Error clearing corrupted data:', storageError);
    }
  }
    }
    
    // 检查API健康状态
    const isApiHealthy = await checkApiHealth();
    
    // 决定同步策略
    if (isApiHealthy && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        console.log('API is healthy, fetching latest data...');
        const response = await fetchWithRetry(API_ENDPOINTS.PRINTERS);
        
        if (response.ok) {
          const apiData = await response.json();
          const apiPrinters = apiData.printers || [];
          
          // 验证API返回的数据
          const validatedPrinters = validatePrintersData(apiPrinters);
          const apiVersion = generateDataHash(validatedPrinters);
          
          // 数据冲突检测和解决
          let finalPrinters = validatedPrinters;
          
          if (localPrinters && localPrinters.length > 0) {
            // 检查是否需要合并数据
            if (apiVersion !== localVersion || !lastSyncTime) {
              console.log('Data version mismatch detected, performing conflict resolution...');
              
              // 基于最后更新时间进行冲突解决
              finalPrinters = mergePrinterData(validatedPrinters, localPrinters);
              console.log('Data merged successfully');
            }
          }
          
          // 更新localStorage
          if (localStorageAvailable) {
            try {
              localStorage.setItem('printers', JSON.stringify(finalPrinters));
              localStorage.setItem(DATA_VERSION_KEY, apiVersion);
              localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
              console.log('Data synced to localStorage with version control');
            } catch (updateError) {
                console.error('Failed to update localStorage:', updateError);
            }
          }
          
          return finalPrinters;
        }
      } catch (apiError) {
        console.error('Failed to fetch from API despite health check:', apiError);
      }
    }
    
    // 如果API不可用或失败，使用localStorage数据
    if (localPrinters && localPrinters.length > 0) {
      console.log('Using localStorage data as fallback');
      return localPrinters;
    }
    
    // 尝试使用fileDataService作为最后的备选
    try {
      console.log('Attempting to use fileDataService as data source...');
      const serviceData = fileDataService.getPrinters?.() || [];
      if (serviceData && Array.isArray(serviceData) && serviceData.length > 0) {
        const validatedServiceData = validatePrintersData(serviceData);
        
        // 保存到localStorage
        if (localStorageAvailable) {
          try {
            localStorage.setItem('printers', JSON.stringify(validatedServiceData));
            localStorage.setItem(DATA_VERSION_KEY, generateDataHash(validatedServiceData));
            localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
          } catch (saveError) {
        console.warn('Error saving sync error information:', saveError);
      }
    }
        
        return validatedServiceData;
      }
    } catch (serviceError) {
      console.warn('Failed to get printers from fileDataService:', serviceError.message);
    }
    
    // 如果所有数据源都失败，返回默认数据并保存
    console.log('All data sources failed, using default printer data');
    const defaultPrinters = [createDefaultPrinter(1), createDefaultPrinter(2), createDefaultPrinter(3), createDefaultPrinter(4)];
    const validatedDefaults = validatePrintersData(defaultPrinters);
    
    // 保存默认数据到localStorage
    if (localStorageAvailable) {
      try {
        localStorage.setItem('printers', JSON.stringify(validatedDefaults));
        localStorage.setItem(DATA_VERSION_KEY, generateDataHash(validatedDefaults));
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      } catch (saveError) {
        console.warn('Error saving default data to localStorage:', saveError);
      }
    }
    
    return validatedDefaults;
  } catch (error) {
      console.error('Critical error during data sync initialization:', error);
    
    // 最安全的回退：返回默认数据
    const defaultPrinters = validatePrintersData([
      createDefaultPrinter(1), 
      createDefaultPrinter(2), 
      createDefaultPrinter(3), 
      createDefaultPrinter(4)
    ]);
    
    // 尝试保存错误信息以便调试
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sync_error', JSON.stringify({
          message: error.message,
          timestamp: new Date().toISOString()
        }));
      } catch (saveError) {
        console.warn('Error saving to localStorage:', saveError);
      }
    }
    
    return defaultPrinters;
  }
};

/**
 * 合并打印机数据，基于最后更新时间解决冲突
 */
const mergePrinterData = (apiPrinters, localPrinters) => {
  // 创建ID到打印机的映射
  const apiMap = new Map(apiPrinters.map(p => [p.id, p]));
  const localMap = new Map(localPrinters.map(p => [p.id, p]));
  
  const mergedPrinters = [];
  const processedIds = new Set();
  
  // 处理所有存在的打印机ID
  [...apiMap.keys(), ...localMap.keys()].forEach(id => {
    if (processedIds.has(id)) return;
    processedIds.add(id);
    
    const apiPrinter = apiMap.get(id);
    const localPrinter = localMap.get(id);
    
    // 情况1：只存在于API
    if (apiPrinter && !localPrinter) {
      mergedPrinters.push(apiPrinter);
      return;
    }
    
    // 情况2：只存在于本地
    if (localPrinter && !apiPrinter) {
      mergedPrinters.push(localPrinter);
      return;
    }
    
    // 情况3：两边都存在，需要合并
    if (apiPrinter && localPrinter) {
      // 比较最后更新时间
      const apiTime = new Date(apiPrinter.lastUpdated || 0).getTime();
      const localTime = new Date(localPrinter.lastUpdated || 0).getTime();
      
      // 使用更新的版本
      if (apiTime >= localTime) {
        // API版本更新，但保留本地可能有的额外字段
        mergedPrinters.push({
          ...apiPrinter,
          ...localPrinter,
          lastUpdated: apiPrinter.lastUpdated,
          // 标记为已合并
          _merged: true
        });
      } else {
        // 本地版本更新
        mergedPrinters.push(localPrinter);
      }
    }
  });
  
  return mergedPrinters;
};

/**
 * 强制同步数据到统一数据源（文件系统或后端API）
 * 增强版：添加离线队列、数据验证、冲突检测和同步状态管理
 * @param {Array} printers - 要同步的打印机数据
 * @param {Object} options - 同步选项
 * @returns {Promise<Object>} - 同步结果对象，包含成功状态和详细信息
 */
export const forceSyncToUnifiedSource = async (printers, options = {}) => {
  const {
    priority = 'api', // 'api' 或 'local'
    skipLocalBackup = false,
    forceOverwrite = false
  } = options;
  
  try {
    console.log('Attempting to sync printers data with enhanced strategy:', {
      count: printers.length,
      priority,
      skipLocalBackup
    });
    
    // 验证数据结构
    const validatedPrinters = validatePrintersData(printers);
    
    // 为每个打印机添加或更新最后更新时间和同步元数据
    const printersWithMetadata = validatedPrinters.map(printer => ({
      ...printer,
      lastUpdated: new Date().toISOString(),
      syncVersion: generateDataHash(validatedPrinters),
      _syncAttempted: true
    }));
    
    // 检查localStorage是否可用
    const localStorageAvailable = typeof localStorage !== 'undefined';
    
    // 保存到localStorage作为备份
    if (localStorageAvailable && !skipLocalBackup) {
      try {
        localStorage.setItem('printers', JSON.stringify(printersWithMetadata));
        localStorage.setItem(DATA_VERSION_KEY, generateDataHash(printersWithMetadata));
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        console.log('Local backup saved successfully');
      } catch (localStorageError) {
        console.error('Failed to save local backup:', localStorageError);
      }
    }
    
    // 检查运行环境
    const isNodeEnv = false; // 禁用Node.js特定功能以避免ESLint错误
    const isBrowserEnv = typeof window !== 'undefined';
    
    // Node.js环境：直接写入文件系统（仅在Node环境中可用）
    if (isNodeEnv) {
      try {
        console.log('Node.js environment detected, but file system operations not available in browser');
        return {
          success: false,
          method: 'file_system',
          error: 'File system operations not available in browser',
          fallback: 'local_storage'
        };
      } catch (fileError) {
        console.error('Failed to save to file system:', fileError);
        return {
          success: false,
          method: 'file_system',
          error: fileError.message,
          fallback: 'none'
        };
      }
    }
    
    // 浏览器环境：优先使用API，失败则使用离线队列
    if (isBrowserEnv) {
      // 检查网络状态
      const isOnline = navigator.onLine;
      
      // 如果在线且API是优先选项，尝试API同步
      if (isOnline && (priority === 'api' || forceOverwrite)) {
        try {
          // 使用带重试的fetch
          const response = await fetchWithRetry(API_ENDPOINTS.SAVE_PRINTERS, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              printers: printersWithMetadata,
              version: generateDataHash(printersWithMetadata),
              timestamp: new Date().toISOString()
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`Printers data saved via API, synced ${printersWithMetadata.length} printers`);
            
            // 清除任何可能的离线队列
            if (localStorageAvailable) {
              try {
                localStorage.removeItem('sync_queue');
                localStorage.removeItem('pending_sync');
              } catch (parseError) {
              console.warn('Error clearing sync data:', parseError);
            }
            }
            
            return {
              success: true,
              method: 'api',
              savedCount: printersWithMetadata.length,
              serverHash: result.hash,
              message: 'Data synced successfully with server'
            };
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.warn(`API sync failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
            
            // 添加到离线队列
            const queueItem = {
              id: Date.now().toString(),
              data: printersWithMetadata,
              timestamp: new Date().toISOString(),
              attempts: 0,
              lastError: errorData.error || `HTTP error ${response.status}`
            };
            
            if (localStorageAvailable) {
              try {
                const currentQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
                currentQueue.push(queueItem);
                // 限制队列大小
                if (currentQueue.length > 50) {
                  currentQueue.shift(); // 移除最旧的项目
                }
                localStorage.setItem('sync_queue', JSON.stringify(currentQueue));
                console.log('Added sync task to offline queue');
              } catch (parseError) {
                console.error('Failed to add to sync queue:', parseError);
              }
            }
            
            return {
              success: false,
              method: 'api',
              error: errorData.error || 'API sync failed',
              fallback: 'offline_queue',
              queueSize: localStorageAvailable ? 
                (JSON.parse(localStorage.getItem('sync_queue') || '[]')).length : 0
            };
          }
        } catch (apiError) {
          console.error('API sync exception:', apiError);
          
          // 添加到离线队列
          if (localStorageAvailable) {
            try {
              const queueItem = {
                id: Date.now().toString(),
                data: printersWithMetadata,
                timestamp: new Date().toISOString(),
                attempts: 0,
                lastError: apiError.message
              };
              
              const currentQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
              currentQueue.push(queueItem);
              if (currentQueue.length > 50) {
                currentQueue.shift();
              }
              localStorage.setItem('sync_queue', JSON.stringify(currentQueue));
              console.log('Added sync task to offline queue due to network error');
            } catch (parseError) {
              console.error('Failed to add to sync queue:', parseError);
            }
          }
          
          return {
            success: false,
            method: 'api',
            error: apiError.message,
            fallback: localStorageAvailable ? 'offline_queue' : 'local_storage',
            isNetworkError: true
          };
        }
      } else {
        // 离线或优先本地存储
        console.log('Using local storage as primary sync target (offline or local priority)');
        
        if (localStorageAvailable) {
          try {
            // 标记为待同步
            localStorage.setItem('pending_sync', JSON.stringify(printersWithMetadata));
            
            // 记录同步尝试
            const syncHistory = JSON.parse(localStorage.getItem('sync_history') || '[]');
            syncHistory.push({
              timestamp: new Date().toISOString(),
              count: printersWithMetadata.length,
              status: 'pending',
              reason: isOnline ? 'local_priority' : 'offline'
            });
            // 限制历史记录大小
            if (syncHistory.length > 100) {
              syncHistory.shift();
            }
            localStorage.setItem('sync_history', JSON.stringify(syncHistory));
            
            return {
              success: true,
              method: 'local_storage',
              savedCount: printersWithMetadata.length,
              status: 'pending_sync',
              message: 'Data saved locally, will sync when online'
            };
          } catch (localError) {
            console.error('Failed to save to local storage:', localError);
            return {
              success: false,
              method: 'local_storage',
              error: localError.message,
              fallback: 'none'
            };
          }
        }
      }
    }
    
    // 如果无法确定环境，返回失败
    return {
      success: false,
      method: 'unknown',
      error: 'Unable to determine execution environment',
      fallback: 'none'
    };
  } catch (error) {
    console.error('Critical error during force sync:', error);
    return {
      success: false,
      method: 'unknown',
      error: error.message,
      fallback: 'none',
      isCritical: true
    };
  }
};

/**
 * 处理离线同步队列
 * 当网络恢复时调用此函数
 */
export const processOfflineQueue = async () => {
  try {
    // 检查环境和网络状态
    if (typeof window === 'undefined' || !navigator.onLine) {
      return { processed: 0, success: 0, failed: 0 };
    }
    
    if (typeof localStorage === 'undefined') {
      return { processed: 0, success: 0, failed: 0 };
    }
    
    // 获取队列
    const queueJson = localStorage.getItem('sync_queue');
    if (!queueJson) {
      console.log('No offline sync queue found');
      return { processed: 0, success: 0, failed: 0 };
    }
    
    let queue;
    try {
      queue = JSON.parse(queueJson);
      if (!Array.isArray(queue)) {
        throw new Error('Invalid queue format');
      }
    } catch (parseError) {
      console.error('Failed to parse sync queue:', parseError);
      localStorage.removeItem('sync_queue');
      return { processed: 0, success: 0, failed: 0 };
    }
    
    if (queue.length === 0) {
      localStorage.removeItem('sync_queue');
      return { processed: 0, success: 0, failed: 0 };
    }
    
    console.log(`Processing offline sync queue with ${queue.length} items`);
    
    let successCount = 0;
    let failedCount = 0;
    const remainingItems = [];
    
    // 处理队列中的每个项目
    for (const item of queue) {
      item.attempts = (item.attempts || 0) + 1;
      
      try {
        // 尝试同步
        const result = await forceSyncToUnifiedSource(item.data, {
          priority: 'api',
          skipLocalBackup: true
        });
        
        if (result.success && result.method === 'api') {
          successCount++;
          console.log(`Successfully synced queued item ${item.id} (attempt ${item.attempts})`);
        } else {
          // 如果尝试次数过多，放弃这个项目
          if (item.attempts >= MAX_RETRIES) {
            console.warn(`Dropping item ${item.id} after ${item.attempts} attempts`);
            failedCount++;
          } else {
            // 否则保留在队列中
            remainingItems.push({
              ...item,
              lastAttempt: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error);
        // 如果尝试次数过多，放弃
        if (item.attempts >= MAX_RETRIES) {
          failedCount++;
        } else {
          remainingItems.push({
            ...item,
            lastAttempt: new Date().toISOString(),
            lastError: error.message
          });
        }
      }
    }
    
    // 更新队列
    if (remainingItems.length > 0) {
      localStorage.setItem('sync_queue', JSON.stringify(remainingItems));
    } else {
      localStorage.removeItem('sync_queue');
    }
    
    // 更新同步历史
    const syncHistory = JSON.parse(localStorage.getItem('sync_history') || '[]');
    syncHistory.push({
      timestamp: new Date().toISOString(),
      processed: queue.length,
      success: successCount,
      failed: failedCount,
      remaining: remainingItems.length,
      type: 'offline_queue_processing'
    });
    if (syncHistory.length > 100) {
      syncHistory.shift();
    }
    localStorage.setItem('sync_history', JSON.stringify(syncHistory));
    
    return {
      processed: queue.length,
      success: successCount,
      failed: failedCount,
      remaining: remainingItems.length
    };
  } catch (error) {
    console.error('Failed to process offline queue:', error);
    return {
      processed: 0,
      success: 0,
      failed: 0,
      error: error.message
    };
  }
};

// 网络恢复时自动处理离线队列
if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network connection restored, processing offline sync queue...');
    // 延迟执行以确保网络完全就绪
    setTimeout(() => {
      processOfflineQueue().then(result => {
        console.log(`Offline queue processing complete: ${result.success} succeeded, ${result.failed} failed`);
      }).catch(error => {
        console.error('Failed to process offline queue after network restoration:', error);
      });
    }, 1000);
  });
}

/**
 * 获取数据最后更新信息
 * 增强版：支持多数据源的时间戳比较
 * @returns {Object} - 包含最后更新时间和来源的对象
 */
export const getUnifiedSourceLastUpdated = () => {
  try {
    console.log('Getting last updated information from all available sources...');
    
    const updateInfo = {
      local: null,
      server: null,
      file: null,
      lastSync: null,
      latest: null,
      latestSource: null
    };
    
    // 1. 从localStorage获取
    if (typeof localStorage !== 'undefined') {
      try {
        const lastSync = localStorage.getItem(LAST_SYNC_KEY);
        if (lastSync) {
          updateInfo.lastSync = lastSync;
        }
        
        const savedPrinters = localStorage.getItem('printers');
        if (savedPrinters) {
          const printers = JSON.parse(savedPrinters);
          if (Array.isArray(printers) && printers.length > 0) {
            const latestLocal = printers.reduce((latest, printer) => {
              if (!printer.lastUpdated) return latest;
              return printer.lastUpdated > latest ? printer.lastUpdated : latest;
            }, '');
            updateInfo.local = latestLocal || new Date().toISOString();
          }
        }
      } catch (syncError) {
        console.warn('Failed to get update info from localStorage:', syncError);
      }
    }
    
    // 2. 文件系统访问在浏览器中不可用，跳过此步骤
    console.log('File system access skipped in browser environment');
    
    // 3. 尝试从fileDataService获取
    try {
      if (fileDataService.getLastUpdatedTime) {
        const serviceTime = fileDataService.getLastUpdatedTime();
        if (serviceTime && (!updateInfo.file || serviceTime > updateInfo.file)) {
          updateInfo.file = serviceTime;
        }
      }
    } catch (serviceError) {
      console.warn('Failed to get update info from fileDataService:', serviceError);
    }
    
    // 确定最新的更新时间和来源
    const sources = [
      { name: 'local', time: updateInfo.local },
      { name: 'server', time: updateInfo.server },
      { name: 'file', time: updateInfo.file },
      { name: 'lastSync', time: updateInfo.lastSync }
    ];
    
    let latestTime = null;
    let latestSource = null;
    
    sources.forEach(source => {
      if (source.time && (!latestTime || source.time > latestTime)) {
        latestTime = source.time;
        latestSource = source.name;
      }
    });
    
    updateInfo.latest = latestTime || new Date().toISOString();
    updateInfo.latestSource = latestSource || 'unknown';
    
    console.log('Last updated information:', updateInfo);
    return updateInfo;
  } catch (e) {
    console.error('Failed to get unified source last updated:', e);
    const fallbackTime = new Date().toISOString();
    return {
      local: fallbackTime,
      server: null,
      file: null,
      lastSync: null,
      latest: fallbackTime,
      latestSource: 'fallback',
      error: e.message
    };
  }
};

/**
 * 清除同步相关的缓存数据
 * @param {Array} clearWhat - 要清除的内容数组，可选值: 'local', 'queue', 'history', 'all'
 */
export const clearSyncCache = (clearWhat = ['all']) => {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    
    const itemsToClear = [];
    
    if (clearWhat.includes('all')) {
      itemsToClear.push('printers', DATA_VERSION_KEY, LAST_SYNC_KEY, 'sync_queue', 'sync_history', 'pending_sync');
    } else {
      if (clearWhat.includes('local')) {
        itemsToClear.push('printers', DATA_VERSION_KEY, LAST_SYNC_KEY);
      }
      if (clearWhat.includes('queue')) {
        itemsToClear.push('sync_queue', 'pending_sync');
      }
      if (clearWhat.includes('history')) {
        itemsToClear.push('sync_history');
      }
    }
    
    itemsToClear.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`Cleared ${key} from localStorage`);
      } catch (queueError) {
        console.error(`Failed to clear ${key}:`, queueError);
      }
    });
    
    return true;
  } catch (clearError) {
    console.error('Failed to clear sync cache:', clearError);
    return false;
  }
};

/**
 * 清理无效的同步状态数据
 */
const cleanupSyncState = () => {
  try {
    if (typeof localStorage === 'undefined') return;
    
    // 检查并清理无效的sync_queue
    const syncQueue = localStorage.getItem('sync_queue');
    if (syncQueue) {
      try {
        const queue = JSON.parse(syncQueue);
        if (!Array.isArray(queue) || queue.length === 0) {
          localStorage.removeItem('sync_queue');
        }
      } catch {
                localStorage.removeItem('sync_queue');
              }
    }
    
    // 检查并清理无效的offline_sync_queue
    const offlineQueue = localStorage.getItem('offline_sync_queue');
    if (offlineQueue) {
      try {
        const queue = JSON.parse(offlineQueue);
        if (!Array.isArray(queue) || queue.length === 0) {
          localStorage.removeItem('offline_sync_queue');
        }
      } catch {
                localStorage.removeItem('offline_sync_queue');
              }
    }
    
    // 如果没有实际的同步队列，清除pending_sync标记
    const hasActiveQueue = !!localStorage.getItem('sync_queue') || !!localStorage.getItem('offline_sync_queue');
    if (!hasActiveQueue && localStorage.getItem('pending_sync')) {
      localStorage.removeItem('pending_sync');
    }
    
    console.log('同步状态清理完成');
  } catch (cleanupError) {
    console.error('Failed to cleanup sync state:', cleanupError);
    return false;
  }
};

/**
 * 获取同步状态信息
 */
export const getSyncStatus = () => {
  try {
    // 首先清理无效的同步状态数据
    cleanupSyncState();
    
    if (typeof localStorage === 'undefined') {
      return {
        hasPendingSync: false,
        queueLength: 0,
        lastSync: null,
        dataVersion: null,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
      };
    }
    
    const queueJson = localStorage.getItem('sync_queue');
    const pendingSync = localStorage.getItem('pending_sync');
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const dataVersion = localStorage.getItem(DATA_VERSION_KEY);
    
    let queueLength = 0;
    try {
      const queue = queueJson ? JSON.parse(queueJson) : [];
      queueLength = Array.isArray(queue) ? queue.length : 0;
    } catch (syncError) {
      console.warn('Failed to parse sync queue:', syncError);
    }
    
    return {
      hasPendingSync: !!pendingSync || queueLength > 0,
      queueLength,
      lastSync,
      dataVersion,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingSyncExists: !!pendingSync
    };
  } catch (statusError) {
    console.error('Error while getting sync status:', statusError);
    return {
      isSyncing: false,
      syncStatus: 'error',
      pendingChanges: 0,
      lastSyncTime: null,
      dataVersion: null,
      isOnline: true,
      error: statusError.message
    };
  }
};

/**
 * 验证打印机数据结构
 * @param {Array} printers - 要验证的打印机数据数组
 * @returns {Array} - 验证和修复后的打印机数据数组
 */
export const validatePrintersData = (printers) => {
  if (!Array.isArray(printers)) {
    return [];
  }
  
  return printers.map((printer, index) => {
    if (!printer || typeof printer !== 'object') {
      return createDefaultPrinter(index + 1);
    }
    
    return {
      id: printer.id || (index + 1).toString(),
      name: printer.name || `Printer ${index + 1}`,
      ip: printer.ip || '192.168.1.100',
      serialNumber: printer.serialNumber || `SN-DEFAULT-${index + 1}`,
      port: printer.port || 9100,
      location: printer.location || 'Default Location',
      model: printer.model || 'Default Model',
      manualTonerLevels: validateTonerLevels(printer.manualTonerLevels),
      lastUpdated: printer.lastUpdated || new Date().toISOString(),
      ...printer
    };
  });
};

/**
 * 验证墨粉级别数据
 * @param {Object} tonerLevels - 墨粉级别对象
 * @returns {Object} - 验证和修复后的墨粉级别对象
 */
export const validateTonerLevels = (tonerLevels) => {
  if (!tonerLevels || typeof tonerLevels !== 'object') {
    return { black: 50, cyan: 50, magenta: 50, yellow: 50 };
  }
  
  // 定义有效的墨粉颜色
  const validColors = ['black', 'cyan', 'magenta', 'yellow'];
  const validatedLevels = {};
  
  // 验证每个颜色的墨粉级别
  validColors.forEach(color => {
    let value = tonerLevels[color];
    // 确保值是有效的数字并在0-100范围内
    if (typeof value !== 'number' || isNaN(value)) {
      validatedLevels[color] = 50; // 默认值
    } else {
      validatedLevels[color] = Math.max(0, Math.min(100, Math.round(value)));
    }
  });
  
  return validatedLevels;
};

/**
 * 创建默认的打印机对象
 * @param {number} id - 打印机ID
 * @returns {Object} - 默认打印机对象
 */
export const createDefaultPrinter = (id) => {
  // 根据ID生成不同的默认数据
  const defaultData = {
    1: {
      name: 'Beijing_12A',
      ip: '192.168.1.101',
      serialNumber: 'SN-BJ-001',
      port: 9100,
      location: 'Beijing Office - Floor 12',
      model: 'HP LaserJet Pro M404dn',
      manualTonerLevels: { black: 75, cyan: 60, magenta: 50, yellow: 80 }
    },
    2: {
      name: 'Beijing_12B',
      ip: '192.168.1.102',
      serialNumber: 'SN-BJ-002',
      port: 9100,
      location: 'Beijing Office - Floor 12',
      model: 'Canon imageCLASS MF426dw',
      manualTonerLevels: { black: 45, cyan: 30, magenta: 25, yellow: 65 }
    },
    3: {
      name: 'Shanghai_26A',
      ip: '192.168.1.103',
      serialNumber: 'SN-SH-001',
      port: 9100,
      location: 'Shanghai Office - Floor 26',
      model: 'Brother HL-L2395DW',
      manualTonerLevels: { black: 90, cyan: 70, magenta: 65, yellow: 40 }
    },
    4: {
      name: 'Shenzhen_18F',
      ip: '192.168.1.104',
      serialNumber: 'SN-SZ-001',
      port: 9100,
      location: 'Shenzhen Office - Floor 18',
      model: 'Epson EcoTank ET-M3170',
      manualTonerLevels: { black: 60, cyan: 85, magenta: 55, yellow: 70 }
    }
  };
  
  const printerData = defaultData[id] || {
    name: `Default Printer ${id}`,
    ip: `192.168.1.${id + 100}`,
    serialNumber: `SN-DEFAULT-${id}`,
    port: 9100,
    location: 'Default Location',
    model: 'Generic Laser Printer',
    manualTonerLevels: { black: 50, cyan: 50, magenta: 50, yellow: 50 }
  };
  
  return {
    id: id.toString(),
    ...printerData,
    lastUpdated: new Date().toISOString()
  };
};

// 合并后的默认导出在文件末尾

/**
 * 从统一数据源获取数据（目前使用localStorage）
 * @param {string} key - 数据存储键名
 * @returns {any} - 获取的数据
 */
export const getFromUnifiedSource = async (key) => {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }
    return null;
  } catch (error) {
    console.error(`Failed to get data from unified source for key ${key}:`, error);
    return null;
  }
};

/**
 * 保存数据到统一数据源（目前使用localStorage）
 * @param {string} key - 数据存储键名
 * @param {any} data - 要保存的数据
 * @returns {boolean} - 是否保存成功
 */
export const saveToUnifiedSource = async (key, data) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to save data to unified source for key ${key}:`, error);
    return false;
  }
};

// 默认导出所有功能
const dataSyncUtils = {
  initializeDataSync,
  forceSyncToUnifiedSource,
  getUnifiedSourceLastUpdated,
  validatePrintersData,
  validateTonerLevels,
  createDefaultPrinter,
  getFromUnifiedSource,
  saveToUnifiedSource,
  fetchWithRetry,
  checkApiHealth,
  generateDataHash,
  mergePrinterData,
  processOfflineQueue,
  clearSyncCache,
  getSyncStatus
};

export default dataSyncUtils;
