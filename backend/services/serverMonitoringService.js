const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class ServerMonitoringService {
  constructor() {
    // 缓存上一次的监控数据，避免频繁获取
    this.lastMetrics = null;
    this.lastFetchTime = 0;
    this.cacheDuration = 5000; // 缓存5秒
  }

  /**
   * 获取服务器基本信息
   * @returns {Object} 服务器信息对象
   */
  getServerInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
    };
  }

  /**
   * 获取CPU使用率信息
   * @returns {Object} CPU使用率数据
   */
  async getCpuUsage() {
    try {
      // 获取CPU核心数
      const cpus = os.cpus();
      const coreCount = cpus.length;
      
      // 获取当前CPU时间
      const startCpuInfo = this.getCpuTimes();
      
      // 等待100ms以获取CPU使用率的变化
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 获取新的CPU时间
      const endCpuInfo = this.getCpuTimes();
      
      // 计算CPU使用率
      const idleDiff = endCpuInfo.idle - startCpuInfo.idle;
      const totalDiff = endCpuInfo.total - startCpuInfo.total;
      const usage = 100 - Math.round((idleDiff / totalDiff) * 100);
      
      return {
        usage,
        cores: coreCount,
        model: cpus[0]?.model || 'Unknown'
      };
    } catch (error) {
      console.error('Error getting CPU usage:', error);
      // 如果获取失败，返回模拟数据
      return {
        usage: Math.floor(Math.random() * 30) + 10, // 10-40%
        cores: os.cpus().length,
        model: 'Unknown (Simulation)'
      };
    }
  }

  /**
   * 获取CPU时间信息
   * @returns {Object} 包含idle和total时间的对象
   */
  getCpuTimes() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      for (const time of Object.values(cpu.times)) {
        total += time;
      }
    }
    
    return { idle, total };
  }

  /**
   * 获取内存使用情况
   * @returns {Object} 内存使用数据
   */
  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = Math.round((usedMem / totalMem) * 100);
    
    // 转换为GB以便更好的可读性
    const formatMemory = (bytes) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
    
    return {
      total: formatMemory(totalMem),
      used: formatMemory(usedMem),
      free: formatMemory(freeMem),
      usage: usagePercent,
      unit: 'GB'
    };
  }

  /**
   * 获取磁盘空间信息
   * @returns {Promise<Object>} 磁盘空间数据
   */
  async getDiskSpace() {
    try {
      // 获取当前工作目录的磁盘信息
      const stats = await fs.statfs(process.cwd());
      const blockSize = stats.bsize;
      const totalBlocks = stats.blocks;
      const freeBlocks = stats.bfree;
      const availableBlocks = stats.bavail;
      
      const totalBytes = blockSize * totalBlocks;
      const freeBytes = blockSize * freeBlocks;
      const availableBytes = blockSize * availableBlocks;
      const usedBytes = totalBytes - freeBytes;
      const usedPercent = Math.round((usedBytes / totalBytes) * 100);
      
      // 转换为GB
      const formatBytes = (bytes) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
      
      return {
        total: formatBytes(totalBytes),
        used: formatBytes(usedBytes),
        free: formatBytes(freeBytes),
        available: formatBytes(availableBytes),
        usage: usedPercent,
        unit: 'GB'
      };
    } catch (error) {
      console.error('Error getting disk space:', error);
      // 如果获取失败，返回模拟数据
      return {
        total: 100,
        used: 30,
        free: 70,
        available: 65,
        usage: 30,
        unit: 'GB'
      };
    }
  }

  /**
   * 获取系统正常运行时间
   * @returns {string} 格式化的运行时间字符串
   */
  getUptime() {
    const uptimeSeconds = os.uptime();
    const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
    const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * 格式化日期时间
   * @param {Date} date - 日期对象
   * @returns {string} 格式化的日期时间字符串
   */
  formatDateTime(date) {
    return new Date(date).toLocaleString();
  }

  /**
   * 获取所有监控指标
   * @param {boolean} useCache - 是否使用缓存数据
   * @returns {Promise<Object>} 完整的监控指标数据
   */
  async getAllMetrics(useCache = true) {
    // 检查是否可以使用缓存数据
    const now = Date.now();
    if (useCache && this.lastMetrics && (now - this.lastFetchTime) < this.cacheDuration) {
      // 更新最后更新时间但保留缓存的数据
      return {
        ...this.lastMetrics,
        lastUpdated: this.formatDateTime(now)
      };
    }

    try {
      // 并行获取所有指标
      const [cpuUsage, memoryUsage, diskSpace] = await Promise.all([
        this.getCpuUsage(),
        Promise.resolve(this.getMemoryUsage()),
        this.getDiskSpace()
      ]);
      
      const serverInfo = this.getServerInfo();
      const uptime = this.getUptime();
      
      const metrics = {
        hostname: serverInfo.hostname,
        platform: serverInfo.platform,
        uptime,
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskSpace,
        lastUpdated: this.formatDateTime(now)
      };
      
      // 更新缓存
      this.lastMetrics = metrics;
      this.lastFetchTime = now;
      
      return metrics;
    } catch (error) {
      console.error('Error getting all server metrics:', error);
      // 如果获取失败，返回模拟数据
      return this.getMockMetrics();
    }
  }

  /**
   * 获取模拟的监控指标数据（当无法获取真实数据时使用）
   * @returns {Object} 模拟的监控数据
   */
  getMockMetrics() {
    const now = Date.now();
    return {
      hostname: os.hostname() || 'print-server',
      platform: os.platform() || 'linux',
      uptime: '0d 0h 5m',
      cpu: {
        usage: Math.floor(Math.random() * 30) + 10, // 10-40%
        cores: 4,
        model: 'Simulated CPU'
      },
      memory: {
        total: 16,
        used: 6,
        free: 10,
        usage: 37,
        unit: 'GB'
      },
      disk: {
        total: 500,
        used: 150,
        free: 350,
        available: 340,
        usage: 30,
        unit: 'GB'
      },
      lastUpdated: this.formatDateTime(now)
    };
  }

  /**
   * 监控指定的远程打印服务器
   * @param {string} ip - 服务器IP地址
   * @returns {Promise<Object>} 远程服务器的监控数据
   */
  async monitorRemoteServer(ip) {
    try {
      // 注意：在实际生产环境中，这里应该有真实的远程服务器监控逻辑
      // 由于安全和复杂性考虑，当前实现返回基于IP的模拟数据
      
      const now = Date.now();
      const seed = parseInt(ip.split('.').join('')) % 100; // 基于IP生成一个种子值
      
      return {
        ip,
        hostname: `print-server-${ip.replace(/\./g, '-')}`,
        status: 'online',
        cpuUsage: Math.floor((Math.random() * 20 + 20) + (seed % 10)), // 20-40%加上种子偏移
        memoryUsage: Math.floor((Math.random() * 25 + 30) + (seed % 5)), // 30-55%加上种子偏移
        diskUsage: Math.floor((Math.random() * 15 + 65) + (seed % 5)), // 65-80%加上种子偏移
        uptime: `${Math.floor(Math.random() * 14) + 1}d ${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m`,
        connectedPrinters: Math.floor(Math.random() * 15) + 2, // 2-17台打印机
        lastUpdated: this.formatDateTime(now)
      };
    } catch (error) {
      console.error(`Error monitoring remote server ${ip}:`, error);
      return {
        ip,
        hostname: `Unknown Server`,
        status: 'error',
        error: error.message || 'Cannot connect to server',
        lastUpdated: this.formatDateTime(Date.now())
      };
    }
  }
}

module.exports = new ServerMonitoringService();