const snmp = require('net-snmp');

const monitorVerboseLogs = process.env.MONITOR_VERBOSE_LOGS === 'true' || process.env.SNMP_VERBOSE_LOGS === 'true';

function logVerbose(...args) {
  if (monitorVerboseLogs) {
    console.log(...args);
  }
}

class SnmpService {
  constructor() {
    this.timeout = 5000; // 5秒超时
  }

  safeCloseSession(session) {
    if (!session || typeof session.close !== 'function') {
      return;
    }
    try {
      session.close();
    } catch (error) {
      if (error && error.code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') {
        console.warn('[SNMP] Failed to close session:', error.message);
      }
    }
  }

  /**
   * Get printer toner levels via SNMP
   * Uses RFC 3805 Printer MIB:
   *   OID .8 = prtMarkerSuppliesMaxCapacity (max capacity)
   *   OID .9 = prtMarkerSuppliesLevel (current remaining level)
   * Formula: percentage = (currentLevel / maxCapacity) * 100
   * @param {string} ip - Printer IP address
   * @param {string} community - SNMP community string (default: public)
   * @returns {Promise<object>} Toner levels
   */
  async getTonerLevels(ip, community = 'public') {
    return new Promise((resolve, reject) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        timeout: this.timeout,
        retries: 2
      });

      // RFC 3805 Printer MIB OIDs:
      // 1.3.6.1.2.1.43.11.1.1.8 = prtMarkerSuppliesMaxCapacity
      // 1.3.6.1.2.1.43.11.1.1.9 = prtMarkerSuppliesLevel (current remaining)
      const tonerOids = {
        blackMax: '1.3.6.1.2.1.43.11.1.1.8.1.1',
        cyanMax: '1.3.6.1.2.1.43.11.1.1.8.1.2',
        magentaMax: '1.3.6.1.2.1.43.11.1.1.8.1.3',
        yellowMax: '1.3.6.1.2.1.43.11.1.1.8.1.4',
        blackLevel: '1.3.6.1.2.1.43.11.1.1.9.1.1',
        cyanLevel: '1.3.6.1.2.1.43.11.1.1.9.1.2',
        magentaLevel: '1.3.6.1.2.1.43.11.1.1.9.1.3',
        yellowLevel: '1.3.6.1.2.1.43.11.1.1.9.1.4'
      };

      const oids = Object.values(tonerOids);

      session.get(oids, (error, varbinds) => {
        if (error) {
          console.error(`SNMP error for ${ip}:`, error);
          this.safeCloseSession(session);
          reject(new Error(`SNMP error: ${error.message}`));
          return;
        }

        const tonerValues = {};

        varbinds.forEach((varbind, index) => {
          if (snmp.isVarbindError(varbind)) {
            console.error(`SNMP varbind error for ${ip}:`, snmp.varbindError(varbind));
          } else {
            const key = Object.keys(tonerOids)[index];
            let value;
            if (typeof varbind.value === 'number') {
              value = varbind.value;
            } else if (varbind.value && typeof varbind.value === 'object' && varbind.value.toString) {
              value = parseInt(varbind.value.toString());
            } else if (typeof varbind.value === 'string') {
              value = parseInt(varbind.value, 10);
            } else {
              value = null;
            }
            if (value !== null && !isNaN(value) && value > 0) {
              tonerValues[key] = value;
            }
          }
        });

        this.safeCloseSession(session);

        // Calculate toner percentages: level / maxCapacity * 100
        const tonerLevels = {};
        const colors = ['black', 'cyan', 'magenta', 'yellow'];

        colors.forEach(color => {
          const maxKey = `${color}Max`;
          const levelKey = `${color}Level`;

          if (tonerValues[maxKey] && tonerValues[levelKey] !== undefined) {
            const max = tonerValues[maxKey];
            const level = tonerValues[levelKey];
            const percentage = Math.round((level / max) * 100);
            tonerLevels[color] = Math.min(100, Math.max(0, percentage));
            logVerbose(`Toner ${color} on ${ip}: ${tonerLevels[color]}% (level=${level}, max=${max})`);
          }
        });

        if (Object.keys(tonerLevels).length > 0) {
          resolve(tonerLevels);
        } else {
          logVerbose(`No valid toner data from standard OIDs for ${ip}, trying vendor OIDs...`);
          this.getTonerLevelsWithVendorOids(ip, community)
            .then(resolve)
            .catch(() => resolve(null));
        }
      });

      session.on('error', (error) => {
        console.error(`SNMP session error for ${ip}:`, error);
        this.safeCloseSession(session);
        resolve(null);
      });
    });
  }

  /**
   * Fallback: Get toner levels using SNMP subtree walk
   * Used when direct OID access fails (different index numbering)
   * @param {string} ip - Printer IP address
   * @param {string} community - SNMP community string
   * @returns {Promise<object>} Toner levels
   */
  async getTonerLevelsWithVendorOids(ip, community) {
    return new Promise((resolve, reject) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        timeout: this.timeout,
        retries: 1
      });

      // Walk the supplies subtree to find all max capacities and levels
      const maxCapacityBase = '1.3.6.1.2.1.43.11.1.1.8';
      const currentLevelBase = '1.3.6.1.2.1.43.11.1.1.9';
      const descriptionBase = '1.3.6.1.2.1.43.11.1.1.6';

      const maxValues = {};
      const levelValues = {};
      const descriptions = {};

      // Walk max capacity subtree
      session.subtree(maxCapacityBase, (varbinds) => {
        varbinds.forEach(varbind => {
          if (!snmp.isVarbindError(varbind)) {
            const oid = varbind.oid.toString();
            const index = oid.split('.').pop();
            const value = typeof varbind.value === 'number' ? varbind.value : parseInt(varbind.value.toString());
            if (!isNaN(value) && value > 0) {
              maxValues[index] = value;
            }
          }
        });
      }, (error) => {
        if (error && error.message !== 'OID not increasing') {
          console.error(`Subtree walk (max) failed for ${ip}:`, error.message);
        }

        // Walk current level subtree
        session.subtree(currentLevelBase, (varbinds) => {
          varbinds.forEach(varbind => {
            if (!snmp.isVarbindError(varbind)) {
              const oid = varbind.oid.toString();
              const index = oid.split('.').pop();
              const value = typeof varbind.value === 'number' ? varbind.value : parseInt(varbind.value.toString());
              if (!isNaN(value)) {
                levelValues[index] = value;
              }
            }
          });
        }, (error2) => {
          if (error2 && error2.message !== 'OID not increasing') {
            console.error(`Subtree walk (level) failed for ${ip}:`, error2.message);
          }

          this.safeCloseSession(session);

          // Match max and level values by index
          const tonerLevels = {};
          const colorOrder = ['black', 'cyan', 'magenta', 'yellow'];
          const indices = Object.keys(maxValues).sort((a, b) => parseInt(a) - parseInt(b));

          indices.forEach((idx, i) => {
            if (i < colorOrder.length && levelValues[idx] !== undefined && maxValues[idx]) {
              const color = colorOrder[i];
              const percentage = Math.round((levelValues[idx] / maxValues[idx]) * 100);
              tonerLevels[color] = Math.min(100, Math.max(0, percentage));
              console.log(`Toner (walk) ${color} on ${ip}: ${tonerLevels[color]}% (level=${levelValues[idx]}, max=${maxValues[idx]})`);
            }
          });

          if (Object.keys(tonerLevels).length > 0) {
            resolve(tonerLevels);
          } else {
            resolve(null);
          }
        });
      });

      session.on('error', (error) => {
        console.error(`SNMP session error for ${ip}:`, error);
        this.safeCloseSession(session);
        resolve(null);
      });
    });
  }

  /**
   * Normalize toner level to 0-100%
   * @param {number|object} value - SNMP value
   * @returns {number|null} Normalized toner level or null if cannot be normalized
   */
  normalizeTonerLevel(value) {
    // 处理不同类型的返回值
    let level;
    
    if (typeof value === 'number') {
      level = value;
    } else if (value && typeof value === 'object' && value.toString) {
      level = parseInt(value.toString());
    } else if (typeof value === 'string') {
      level = parseInt(value, 10);
    } else {
      // 无法解析值，返回失败
      return null;
    }

    if (isNaN(level)) {
      return null;
    }

    // 有些设备返回0-100的百分比
    if (level <= 100 && level >= 0) {
      return level;
    } else if (level > 100) {
      // 检查是否可能是基于不同最大值的原始值
      // 常见的墨粉容量范围：10000-20000
      if (level <= 20000) {
        // 尝试两种计算方式，选择更合理的结果
        const maxCapacity = 15000;
        const percentage1 = Math.round((level / maxCapacity) * 100); // 假设是剩余量
        const percentage2 = Math.round((1 - level / maxCapacity) * 100); // 假设是已使用量
        
        // 根据用户提供的实际数据，选择更接近的计算方式
        // 对于10.128.20.6，黄色墨粉原始值13650，实际约45%
        // 计算方式1: (13650/15000)*100=91%，计算方式2: (1-13650/15000)*100=9%
        // 青色墨粉原始值9450，实际约65%
        // 计算方式1: (9450/15000)*100=63%，计算方式2: (1-9450/15000)*100=38%
        // 看起来计算方式1更接近青色，但与黄色不符
        // 可能不同颜色的计算方式不同，或者最大值不同
        // 暂时使用计算方式1，但添加日志以便进一步分析
        console.log(`Calculating toner level: raw=${level}, max=${maxCapacity}, method1=${percentage1}%, method2=${percentage2}%`);
        return Math.min(100, Math.max(0, percentage1));
      } else if (level <= 65535) {
        // 对于更大的值，使用65535作为最大值
        return Math.round((level / 65535) * 100);
      } else {
        // 无法确定合理范围，返回失败
        return null;
      }
    }
    // 无法解析值，返回失败
    return null;
  }

  /**
   * Get printer error states via SNMP
   * Uses HOST-RESOURCES-MIB: hrPrinterDetectedErrorState (1.3.6.1.2.1.25.3.5.1.2)
   * Returns a bitmap indicating: lowPaper, noPaper, lowToner, doorOpen, jammed, offline, etc.
   * @param {string} ip - Printer IP address
   * @param {string} community - SNMP community string
   * @returns {Promise<object|null>} Error states object or null
   */
  async getPrinterErrors(ip, community = 'public') {
    return new Promise((resolve) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        timeout: this.timeout,
        retries: 1
      });

      // hrPrinterDetectedErrorState OID
      const errorStateOid = '1.3.6.1.2.1.25.3.5.1.2.1';

      session.get([errorStateOid], (error, varbinds) => {
        this.safeCloseSession(session);
        if (error) {
          console.warn(`[SNMP] getPrinterErrors failed for ${ip}:`, error.message);
          resolve(null);
          return;
        }

        if (!varbinds || varbinds.length === 0 || snmp.isVarbindError(varbinds[0])) {
          resolve(null);
          return;
        }

        // The value is an OCTET STRING (byte array) representing error bits
        const rawValue = varbinds[0].value;
        let bytes;
        if (Buffer.isBuffer(rawValue)) {
          bytes = rawValue;
        } else if (typeof rawValue === 'string') {
          bytes = Buffer.from(rawValue, 'binary');
        } else {
          resolve(null);
          return;
        }

        // Parse the bitmap according to RFC 3805 / HOST-RESOURCES-MIB
        // Byte 0 bits (MSB first): lowPaper(0), noPaper(1), lowToner(2), noToner(3), doorOpen(4), jammed(5), offline(6), serviceRequested(7)
        // Byte 1 bits: inputTrayMissing(0), outputTrayMissing(1), markerSupplyMissing(2), outputNearFull(3), outputFull(4), inputTrayEmpty(5), overduePreventMaint(6)
        const byte0 = bytes.length > 0 ? bytes[0] : 0;
        const byte1 = bytes.length > 1 ? bytes[1] : 0;

        const errors = {
          lowPaper: !!(byte0 & 0x80),
          noPaper: !!(byte0 & 0x40),
          lowToner: !!(byte0 & 0x20),
          noToner: !!(byte0 & 0x10),
          doorOpen: !!(byte0 & 0x08),
          jammed: !!(byte0 & 0x04),
          offline: !!(byte0 & 0x02),
          serviceRequested: !!(byte0 & 0x01),
          inputTrayMissing: !!(byte1 & 0x80),
          outputTrayMissing: !!(byte1 & 0x40),
          outputNearFull: !!(byte1 & 0x10),
          outputFull: !!(byte1 & 0x08),
          inputTrayEmpty: !!(byte1 & 0x04)
        };

        // Filter to only active errors
        const activeErrors = Object.entries(errors)
          .filter(([, v]) => v)
          .map(([k]) => k);

        if (activeErrors.length > 0) {
          console.warn(`[SNMP] Printer errors for ${ip}: ${activeErrors.join(', ')}`);
        } else {
          logVerbose(`[SNMP] Printer errors for ${ip}: none`);
        }

        resolve({
          raw: bytes.toString('hex'),
          errors,
          activeErrors,
          hasErrors: activeErrors.length > 0
        });
      });

      session.on('error', () => {
        this.safeCloseSession(session);
        resolve(null);
      });
    });
  }

  /**
   * Get printer page count (total pages printed) via SNMP
   * Uses Printer-MIB: prtMarkerLifeCount (1.3.6.1.2.1.43.10.2.1.4)
   * @param {string} ip - Printer IP address
   * @param {string} community - SNMP community string
   * @returns {Promise<object|null>} Page count object or null
   */
  async getPageCount(ip, community = 'public') {
    return new Promise((resolve) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        timeout: this.timeout,
        retries: 1
      });

      // prtMarkerLifeCount - total impressions for each marker (color)
      // Index: .1.1 = marker unit 1 (typically black/total)
      const pageCountOid = '1.3.6.1.2.1.43.10.2.1.4.1.1';

      session.get([pageCountOid], (error, varbinds) => {
        if (error) {
          // Fallback: try walking the subtree to find any page count
          session.subtree('1.3.6.1.2.1.43.10.2.1.4', (subtreeVarbinds) => {
            subtreeVarbinds.forEach(varbind => {
              if (!snmp.isVarbindError(varbind)) {
                const value = typeof varbind.value === 'number' ? varbind.value : parseInt(varbind.value.toString());
                if (!isNaN(value) && value >= 0) {
                  this.safeCloseSession(session);
                  logVerbose(`[SNMP] Page count for ${ip}: ${value} (via subtree walk)`);
                  resolve({ total: value });
                }
              }
            });
          }, () => {
            this.safeCloseSession(session);
            resolve(null);
          });
          return;
        }

        if (!varbinds || varbinds.length === 0 || snmp.isVarbindError(varbinds[0])) {
          this.safeCloseSession(session);
          resolve(null);
          return;
        }

        const rawValue = varbinds[0].value;
        let value;
        if (typeof rawValue === 'number') {
          value = rawValue;
        } else if (rawValue && typeof rawValue === 'object' && rawValue.toString) {
          value = parseInt(rawValue.toString());
        } else {
          this.safeCloseSession(session);
          resolve(null);
          return;
        }

        this.safeCloseSession(session);

        if (isNaN(value) || value < 0) {
          resolve(null);
          return;
        }

        logVerbose(`[SNMP] Page count for ${ip}: ${value}`);
        resolve({ total: value });
      });

      session.on('error', () => {
        this.safeCloseSession(session);
        resolve(null);
      });
    });
  }

  /**
   * Get color page count via SNMP
   * Fujifilm Apeos uses prtMarkerLifeCount for each marker unit
   * Index .1.1 = total/black, .1.2+ = color markers
   * Some printers use vendor-specific OIDs for color page count
   * @param {string} ip - Printer IP address
   * @param {string} community - SNMP community string
   * @returns {Promise<number|null>} Color page count or null
   */
  async getColorPageCount(ip, community = 'public') {
    return new Promise((resolve) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        timeout: this.timeout,
        retries: 1
      });

      // Try common OIDs for color page count:
      // Fujifilm/Xerox: 1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.1 (color impressions)
      // Generic: prtMarkerLifeCount second marker unit (.1.2)
      const colorOids = [
        '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.1', // Xerox/Fujifilm color total
        '1.3.6.1.2.1.43.10.2.1.4.1.2'            // prtMarkerLifeCount marker 2 (color)
      ];

      session.get(colorOids, (error, varbinds) => {
        if (!error && varbinds) {
          for (const varbind of varbinds) {
            if (!snmp.isVarbindError(varbind)) {
              const rawValue = varbind.value;
              let value;
              if (typeof rawValue === 'number') value = rawValue;
              else if (rawValue && rawValue.toString) value = parseInt(rawValue.toString(), 10);

              if (!isNaN(value) && value >= 0) {
                this.safeCloseSession(session);
                logVerbose(`[SNMP] Color page count for ${ip}: ${value}`);
                resolve(value);
                return;
              }
            }
          }
        }

        // Fallback: walk marker life count subtree and pick the max non-total marker counter.
        // On many printers the first marker is total/black and following markers are color units.
        const markerLifeBase = '1.3.6.1.2.1.43.10.2.1.4.1';
        const markerCounts = [];

        session.subtree(markerLifeBase, (subtreeVarbinds) => {
          subtreeVarbinds.forEach((varbind) => {
            if (snmp.isVarbindError(varbind)) return;
            const rawValue = varbind.value;
            const value = typeof rawValue === 'number'
              ? rawValue
              : parseInt(rawValue && rawValue.toString ? rawValue.toString() : '', 10);
            if (!isNaN(value) && value >= 0) {
              markerCounts.push(value);
            }
          });
        }, () => {
          this.safeCloseSession(session);
          if (markerCounts.length >= 2) {
            const candidate = Math.max(...markerCounts.slice(1));
            logVerbose(`[SNMP] Color page count for ${ip}: ${candidate} (via marker fallback)`);
            resolve(candidate);
            return;
          }
          resolve(null);
        });
      });

      session.on('error', () => {
        this.safeCloseSession(session);
        resolve(null);
      });
    });
  }

  /**
   * Get paper tray levels via SNMP
   * Uses Printer-MIB: prtInputMaxCapacity (1.3.6.1.2.1.43.8.2.1.9) and prtInputCurrentLevel (1.3.6.1.2.1.43.8.2.1.10)
   * @param {string} ip - Printer IP address
   * @param {string} community - SNMP community string
   * @returns {Promise<object|null>} Paper tray info or null
   */
  async getPaperTrayLevels(ip, community = 'public') {
    return new Promise((resolve) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        timeout: this.timeout,
        retries: 1
      });

      const maxCapacityBase = '1.3.6.1.2.1.43.8.2.1.9';
      const currentLevelBase = '1.3.6.1.2.1.43.8.2.1.10';

      const maxValues = {};
      const levelValues = {};

      // Walk max capacity subtree
      session.subtree(maxCapacityBase, (varbinds) => {
        varbinds.forEach(varbind => {
          if (!snmp.isVarbindError(varbind)) {
            const oid = varbind.oid.toString();
            const index = oid.split('.').pop();
            const value = typeof varbind.value === 'number' ? varbind.value : parseInt(varbind.value.toString());
            if (!isNaN(value)) {
              maxValues[index] = value;
            }
          }
        });
      }, (error) => {
        if (error && error.message !== 'OID not increasing') {
          console.warn(`[SNMP] Paper tray max walk failed for ${ip}:`, error.message);
        }

        // Walk current level subtree
        session.subtree(currentLevelBase, (varbinds) => {
          varbinds.forEach(varbind => {
            if (!snmp.isVarbindError(varbind)) {
              const oid = varbind.oid.toString();
              const index = oid.split('.').pop();
              const value = typeof varbind.value === 'number' ? varbind.value : parseInt(varbind.value.toString());
              if (!isNaN(value)) {
                levelValues[index] = value;
              }
            }
          });
        }, (error2) => {
          if (error2 && error2.message !== 'OID not increasing') {
            console.warn(`[SNMP] Paper tray level walk failed for ${ip}:`, error2.message);
          }

          this.safeCloseSession(session);

          const indices = Object.keys(maxValues).sort((a, b) => parseInt(a) - parseInt(b));
          if (indices.length === 0) {
            resolve(null);
            return;
          }

          const trays = [];
          let lowCount = 0;
          indices.forEach(idx => {
            const max = maxValues[idx];
            const current = levelValues[idx];
            if (max !== undefined && current !== undefined) {
              // max = -1 means "unknown capacity", max = -2 means "unlimited"
              // current = -1 means "unknown level", current = -2 means "unknown", current = -3 means "at least one"
              let percentage = null;
              let isLow = false;
              if (max > 0 && current >= 0) {
                percentage = Math.round((current / max) * 100);
                isLow = percentage <= 15; // Below 15% is considered low
              } else if (current === 0 && max > 0) {
                percentage = 0;
                isLow = true;
              }
              trays.push({ index: idx, max, current, percentage, isLow });
              if (isLow) lowCount++;
            }
          });

          logVerbose(`[SNMP] Paper trays for ${ip}: ${trays.length} trays, ${lowCount} low`);
          resolve({ trays, lowCount, totalTrays: trays.length });
        });
      });

      session.on('error', () => {
        this.safeCloseSession(session);
        resolve(null);
      });
    });
  }

  /**
   * Test SNMP connectivity to a printer
   * @param {string} ip - Printer IP address
   * @param {string} community - SNMP community string
   * @returns {Promise<boolean>} True if SNMP is accessible
   */
  async testSnmpConnectivity(ip, community = 'public') {
    return new Promise((resolve) => {
      const session = snmp.createSession(ip, community, {
        port: 161,
        timeout: 3000,
        retries: 1
      });

      // 尝试获取系统描述符
      const sysDescrOid = '1.3.6.1.2.1.1.1.0';

      session.get([sysDescrOid], (error, varbinds) => {
        this.safeCloseSession(session);
        if (error || varbinds.some(snmp.isVarbindError)) {
          resolve(false);
        } else {
          resolve(true);
        }
      });

      session.on('error', () => {
        this.safeCloseSession(session);
        resolve(false);
      });
    });
  }
}

module.exports = new SnmpService();