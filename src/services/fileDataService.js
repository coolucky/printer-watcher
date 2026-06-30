// 文件数据服务 - 仅负责与printers-data.json文件进行交互，不再使用localStorage

// 定义数据文件路径（相对于项目根目录）
const DATA_FILE_NAME = 'printers-data.json';

// Node.js环境的文件操作实现（浏览器环境下全部为null）
let nodeFs = null;
let DATA_FILE_PATH = null;

// 初始化文件操作模块
const initializeFileModules = () => {
  try {
    // 在浏览器环境中禁用Node.js文件系统功能
    console.log('File modules initialization skipped in browser environment');
    // 设置为null表示不支持文件操作
    nodeFs = null;
    DATA_FILE_PATH = null;
  } catch (error) {
    console.warn('Failed to initialize file modules:', error.message);
  }
};

// 初始化模块
initializeFileModules();

// 确保文件存在的辅助函数
const ensureFileExists = () => {
  try {
    if (!nodeFs || !DATA_FILE_PATH) {
      console.warn('File system access not available');
      return false;
    }
    
    if (!nodeFs.existsSync(DATA_FILE_PATH)) {
      // 如果文件不存在，创建一个包含默认打印机数据的新文件
      const defaultPrinters = [
        {
          id: '1',
          name: 'Beijing_12A',
          ip: '192.168.1.101',
          serialNumber: 'SN-BJ-001',
          port: 9100,
          location: 'Beijing Office - Floor 12',
          model: 'HP LaserJet Pro M404dn',
          manualTonerLevels: {
            black: 75,
            cyan: 60,
            magenta: 50,
            yellow: 80
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Beijing_12B',
          ip: '192.168.1.102',
          serialNumber: 'SN-BJ-002',
          port: 9100,
          location: 'Beijing Office - Floor 12',
          model: 'Canon imageCLASS MF426dw',
          manualTonerLevels: {
            black: 45,
            cyan: 30,
            magenta: 25,
            yellow: 65
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Shanghai_26A',
          ip: '192.168.1.103',
          serialNumber: 'SN-SH-001',
          port: 9100,
          location: 'Shanghai Office - Floor 26',
          model: 'Brother HL-L2395DW',
          manualTonerLevels: {
            black: 90,
            cyan: 70,
            magenta: 65,
            yellow: 40
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '4',
          name: 'Shenzhen_18F',
          ip: '192.168.1.104',
          serialNumber: 'SN-SZ-001',
          port: 9100,
          location: 'Shenzhen Office - Floor 18',
          model: 'Epson EcoTank ET-M3170',
          manualTonerLevels: {
            black: 60,
            cyan: 85,
            magenta: 55,
            yellow: 70
          },
          lastUpdated: new Date().toISOString()
        }
      ];
      
      // 直接写入打印机数组（不再包装在对象中）
      nodeFs.writeFileSync(DATA_FILE_PATH, JSON.stringify(defaultPrinters, null, 2));
      console.log('Created new printers data file with default data:', DATA_FILE_PATH);
    }
    return true;
  } catch (error) {
    console.error('Failed to ensure data file exists:', error);
    return false;
  }
};

// 从文件读取打印机数据
export const loadPrintersFromFile = () => {
  try {
    // 确保文件存在
    if (!ensureFileExists()) {
      console.warn('File access not available, returning empty array');
      return [];
    }
    
    // 读取文件内容
    const fileContent = nodeFs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // 兼容两种格式：直接的打印机数组或包装在对象中的printers数组
    if (Array.isArray(data)) {
      console.log('Loaded printers data from file (array format):', data.length, 'printers');
      return data;
    } else if (data && Array.isArray(data.printers)) {
      console.log('Loaded printers data from file (object format):', data.printers.length, 'printers');
      return data.printers;
    }
    
    console.warn('Invalid data format in file, returning empty array');
    return [];
  } catch (error) {
    console.error('Failed to load printers from file:', error);
    return [];
  }
};

// 将打印机数据保存到文件
export const savePrintersToFile = (printers) => {
  try {
    // 确保文件存在
    if (!ensureFileExists()) {
      console.warn('File access not available, cannot save printers');
      return false;
    }
    
    // 直接写入打印机数组（不再包装在对象中）
    nodeFs.writeFileSync(DATA_FILE_PATH, JSON.stringify(printers, null, 2));
    console.log('Printers data saved directly to file:', DATA_FILE_PATH);
    return true;
  } catch (error) {
    console.error('Failed to save printers to file:', error);
    return false;
  }
};

// 获取最后更新时间（从打印机数据中提取）
export const getLastUpdatedTime = () => {
  try {
    // 加载打印机数据
    const printers = loadPrintersFromFile();
    
    if (Array.isArray(printers) && printers.length > 0) {
      // 找到最新的更新时间
      const latestUpdate = printers.reduce((latest, printer) => {
        if (!printer.lastUpdated) return latest;
        return printer.lastUpdated > latest ? printer.lastUpdated : latest;
      }, '');
      
      return latestUpdate || new Date().toISOString();
    }
    
    return new Date().toISOString();
  } catch (error) {
    console.error('Failed to get last updated time:', error);
    return new Date().toISOString();
  }
};

// 清除浏览器中可能存在的localStorage数据（用于清理）
export const clearLocalStorageData = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('printers');
      localStorage.removeItem('printers_timestamp');
      console.log('Cleared any existing localStorage printer data to avoid conflicts');
      return true;
    }
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
  return false;
};

// 统一的保存接口 - 仅使用文件系统作为数据源
export const savePrinters = (printers) => {
  try {
    // 首先确保清除任何可能存在的localStorage数据，避免冲突
    clearLocalStorageData();
    
    // 然后尝试保存到文件系统
    if (nodeFs) {
      // 确保文件存在
      ensureFileExists();
      // 直接写入打印机数组
      nodeFs.writeFileSync(DATA_FILE_PATH, JSON.stringify(printers, null, 2));
      console.log('Printers data saved to file:', DATA_FILE_PATH);
      return true;
    }
    
    console.warn('File system access not available, cannot save printers data');
    return false;
  } catch (error) {
    console.error('Failed to save printers data:', error);
    return false;
  }
};

// 统一的加载接口 - 仅使用文件系统作为数据源，不再使用localStorage
export const loadPrinters = () => {
  try {
    // 首先确保清除任何可能存在的localStorage数据，避免冲突
    clearLocalStorageData();
    
    // 从文件系统加载数据
    const printers = loadPrintersFromFile();
    
    // 如果加载成功并有数据，返回数据
    if (Array.isArray(printers) && printers.length > 0) {
      console.log('Loaded printers from file system:', printers.length, 'printers');
      return printers;
    }
    
    console.log('No printers data found in file system, returning empty array');
    return [];
  } catch (error) {
    console.error('Failed to load printers data:', error);
    return [];
  }
};

export default {
  loadPrinters,
  savePrinters,
  loadPrintersFromFile,
  savePrintersToFile,
  clearLocalStorageData,
  getLastUpdatedTime,
  DATA_FILE_PATH
};
