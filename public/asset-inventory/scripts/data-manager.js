// 数据管理模块 - 统一的数据存储和备份管理
let fs, path, os;
let isElectron = false;
try {
  fs = require('fs');
  path = require('path');
  os = require('os');
  isElectron = true;
} catch (e) {
  // Running in browser without Node.js/Electron
}

// ============================================
// 数据存储路径配置
// ============================================

// 用户数据目录：~/Documents/IT助手数据/
const USER_DATA_DIR = isElectron ? path.join(os.homedir(), 'Documents', 'IT助手数据') : '';
const BACKUP_DIR = isElectron ? path.join(USER_DATA_DIR, 'backups') : '';
const DATA_FILE = isElectron ? path.join(USER_DATA_DIR, 'app-data.json') : '';

// 确保目录存在
function ensureDataDirectories() {
  if (!isElectron) return;
  try {
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
      console.log('✅ 创建用户数据目录:', USER_DATA_DIR);
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('✅ 创建备份目录:', BACKUP_DIR);
    }
  } catch (err) {
    console.error('❌ 创建目录失败:', err);
  }
}

// ============================================
// 数据收集 - 从 localStorage 收集所有数据
// ============================================

function collectAllData() {
  const allData = {
    version: '1.0.0',
    exportTime: new Date().toISOString(),
    data: {}
  };

  // 收集所有 localStorage 数据
  const keys = [
    'mtr-inspection-calendar',
    'mtr-issue-tracker',
    'mtr-devices',
    'mtr-execution-history',
    'daily-report-data',
    'routine-filter-preference',
    'event-support-active-events',
    'event-support-archived-events',
    'computer-distribution-records',
    'computer-recovery-records',
    'batch_account_history',
    'role_groups',
    'account_mgmt_custom_roles',
    'asset-inventory-data'
  ];

  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        allData.data[key] = JSON.parse(value);
      }
    } catch (err) {
      console.warn(`⚠️ 收集数据失败 [${key}]:`, err.message);
    }
  });

  return allData;
}

// ============================================
// 保存数据到文件
// ============================================

function saveDataToFile(data, filePath = DATA_FILE) {
  if (!isElectron) return { success: false, error: 'Browser mode - using localStorage' };
  try {
    ensureDataDirectories();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, path: filePath };
  } catch (err) {
    console.error('❌ 保存数据失败:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// 从文件加载数据
// ============================================

function loadDataFromFile(filePath = DATA_FILE) {
  if (!isElectron) return { success: false, error: 'Browser mode - using localStorage' };
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return { success: true, data };
  } catch (err) {
    console.error('❌ 加载数据失败:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// 将数据恢复到 localStorage
// ============================================

function restoreDataToLocalStorage(data) {
  let restoredCount = 0;
  let failedCount = 0;

  if (data && data.data) {
    Object.keys(data.data).forEach(key => {
      try {
        localStorage.setItem(key, JSON.stringify(data.data[key]));
        restoredCount++;
      } catch (err) {
        console.error(`❌ 恢复数据失败 [${key}]:`, err.message);
        failedCount++;
      }
    });
  }

  return { restoredCount, failedCount };
}

// ============================================
// 自动保存 - 实时同步到文件
// ============================================

function enableAutoSave() {
  // 监听 localStorage 变化并自动保存
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    
    // 延迟保存，避免频繁写入
    if (window.autoSaveTimer) {
      clearTimeout(window.autoSaveTimer);
    }
    window.autoSaveTimer = setTimeout(() => {
      const data = collectAllData();
      saveDataToFile(data);
      console.log('💾 数据已自动保存到文件');
    }, 2000); // 2秒后保存
  };
}

// ============================================
// 创建备份
// ============================================

function createBackup() {
  if (!isElectron) return { success: false, error: 'Browser mode - backup not needed' };
  try {
    ensureDataDirectories();
    const data = collectAllData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    
    const result = saveDataToFile(data, backupFile);
    if (result.success) {
      console.log('✅ 备份创建成功:', backupFile);
      
      // 清理旧备份（保留最近30个）
      cleanOldBackups(30);
    }
    return result;
  } catch (err) {
    console.error('❌ 创建备份失败:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// 清理旧备份
// ============================================

function cleanOldBackups(keepCount = 30) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime); // 按时间倒序

    // 删除多余的备份
    if (files.length > keepCount) {
      files.slice(keepCount).forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log('🗑️ 删除旧备份:', file.name);
        } catch (err) {
          console.warn('删除备份失败:', err.message);
        }
      });
    }
  } catch (err) {
    console.error('清理旧备份失败:', err);
  }
}

// ============================================
// 获取备份列表
// ============================================

function getBackupList() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }
    
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          path: filePath,
          size: stats.size,
          mtime: stats.mtime,
          formattedTime: stats.mtime.toLocaleString('zh-CN')
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // 按时间倒序

    return files;
  } catch (err) {
    console.error('获取备份列表失败:', err);
    return [];
  }
}

// ============================================
// 初始化 - 应用启动时调用
// ============================================

function initDataManager() {
  console.log('📂 初始化数据管理器...');
  ensureDataDirectories();
  
  // 尝试从文件加载数据
  const result = loadDataFromFile();
  if (result.success) {
    console.log('📥 从文件加载数据...');
    const { restoredCount } = restoreDataToLocalStorage(result.data);
    console.log(`✅ 已恢复 ${restoredCount} 项数据`);
  } else {
    console.log('ℹ️ 没有找到已保存的数据文件，这可能是首次运行');
    // 如果文件不存在，从 localStorage 创建初始文件
    const data = collectAllData();
    if (Object.keys(data.data).length > 0) {
      saveDataToFile(data);
      console.log('✅ 已从 localStorage 创建初始数据文件');
    }
  }
  
  // 启用自动保存
  enableAutoSave();
  console.log('✅ 自动保存已启用');
  
  // 创建首次启动备份
  createBackup();
}

// ============================================
// 导出接口
// ============================================

window.DataManager = {
  // 核心功能
  init: initDataManager,
  exportData: collectAllData,
  importData: restoreDataToLocalStorage,
  
  // 文件操作
  saveToFile: saveDataToFile,
  loadFromFile: loadDataFromFile,
  
  // 备份管理
  createBackup,
  getBackupList,
  cleanOldBackups,
  
  // 路径信息
  getDataDir: () => USER_DATA_DIR,
  getBackupDir: () => BACKUP_DIR,
  getDataFile: () => DATA_FILE
};

console.log('✅ 数据管理模块已加载');
