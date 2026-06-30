// Data Backup Utilities
// This utility is used to automatically back up user-saved server data

/**
 * Backup server data from localStorage to file
 * Note: This function is used in browser environment
 */
export const backupPrintServers = () => {
  try {
    // 获取localStorage中的服务器数据
    const serversData = localStorage.getItem('printServers');
    
    if (serversData) {
      // 创建时间戳用于备份文件命名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {
        timestamp,
        data: JSON.parse(serversData),
        version: '1.0'
      };
      
      // 将备份数据转换为字符串
      const backupString = JSON.stringify(backupData, null, 2);
      
      // 创建Blob对象
      const blob = new Blob([backupString], { type: 'application/json' });
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `print-servers-backup-${timestamp}.json`;
      
      // 触发下载
      document.body.appendChild(a);
      a.click();
      
      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Server data backup successful!');
      return true;
    } else {
      console.warn('No server data found for backup');
      return false;
    }
  } catch (error) {
    console.error('Error backing up server data:', error);
    return false;
  }
};

/**
 * 自动备份数据（可以在保存服务器数据后调用）
 */
export const autoBackupData = () => {
  try {
    // 保存数据到localStorage后，立即创建备份
    // 1. 先检查是否已有备份标记
    const lastBackupTime = localStorage.getItem('lastBackupTime');
    const now = Date.now();
    
    // 如果距离上次备份不足5分钟，则不重复备份
    if (lastBackupTime && (now - parseInt(lastBackupTime)) < 5 * 60 * 1000) {
      return false;
    }
    
    // 更新备份时间
    localStorage.setItem('lastBackupTime', now.toString());
    
    // 创建备份
    console.log('正在自动备份服务器数据...');
    
    // 在实际应用中，这里可以调用backupPrintServers()函数
    // 但由于浏览器安全限制，自动下载可能会被阻止
    // 所以我们改为将备份数据存储在localStorage中
    const serversData = localStorage.getItem('printServers');
    if (serversData) {
      localStorage.setItem('printServersBackup', serversData);
      console.log('服务器数据已备份到localStorage');
      return true;
    }
    return false;
  } catch (error) {
    console.error('自动备份数据时出错:', error);
    return false;
  }
};

/**
 * 从localStorage备份恢复数据
 */
export const restoreFromBackup = () => {
  try {
    const backupData = localStorage.getItem('printServersBackup');
    if (backupData) {
      localStorage.setItem('printServers', backupData);
      console.log('已从localStorage备份恢复服务器数据');
      return true;
    } else {
      console.warn('没有找到localStorage备份数据');
      return false;
    }
  } catch (error) {
    console.error('恢复备份数据时出错:', error);
    return false;
  }
};

/**
 * 导出服务器数据为JSON文件
 */
export const exportServerData = () => {
  return backupPrintServers();
};

/**
 * 导入服务器数据从JSON文件
 * @param {File} file - 包含服务器数据的JSON文件
 * @returns {Promise<boolean>} - 是否导入成功
 */
export const importServerData = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          // 检查数据格式是否正确
          if (Array.isArray(data) || (data.data && Array.isArray(data.data))) {
            const serversData = Array.isArray(data) ? data : data.data;
            localStorage.setItem('printServers', JSON.stringify(serversData));
            console.log('服务器数据导入成功！');
            resolve(true);
          } else {
            console.error('导入的文件格式不正确');
            reject(new Error('导入的文件格式不正确'));
          }
        } catch (parseError) {
          console.error('解析导入文件时出错:', parseError);
          reject(parseError);
        }
      };
      reader.onerror = () => {
        reject(new Error('读取文件时出错'));
      };
      reader.readAsText(file);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * 获取当前保存的服务器数据
 */
export const getCurrentServerData = () => {
  try {
    const serversData = localStorage.getItem('printServers');
    return serversData ? JSON.parse(serversData) : [];
  } catch (error) {
    console.error('获取服务器数据时出错:', error);
    return [];
  }
};

/**
 * 检查数据完整性
 */
export const checkDataIntegrity = () => {
  try {
    const servers = getCurrentServerData();
    return Array.isArray(servers) && servers.every(server => 
      server.id && server.name && server.ip
    );
  } catch (error) {
    console.error('检查数据完整性时出错:', error);
    return false;
  }
};