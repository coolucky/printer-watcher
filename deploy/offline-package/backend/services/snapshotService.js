/**
 * Snapshot Service - 管理系统快照的创建、存储和恢复
 * 快照保存到文件系统，包含所有关键系统数据
 */
const fs = require('fs');
const path = require('path');

const SNAPSHOTS_DIR = path.join(__dirname, '../../snapshots');
const SNAPSHOTS_INDEX_FILE = path.join(SNAPSHOTS_DIR, 'index.json');
const MAX_SNAPSHOTS = 10;

class SnapshotService {
  constructor() {
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
      fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(SNAPSHOTS_INDEX_FILE)) {
      fs.writeFileSync(SNAPSHOTS_INDEX_FILE, JSON.stringify([]), 'utf8');
    }
  }

  getIndex() {
    try {
      return JSON.parse(fs.readFileSync(SNAPSHOTS_INDEX_FILE, 'utf8'));
    } catch {
      return [];
    }
  }

  saveIndex(index) {
    fs.writeFileSync(SNAPSHOTS_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
  }

  /**
   * 创建快照 - 收集所有系统数据
   */
  createSnapshot(name, data) {
    const id = Date.now().toString();
    const snapshot = {
      id,
      name: name || `Snapshot ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      createdAt: new Date().toISOString(),
      state: {
        settings: data.settings || {},
        users: data.users || [],
        alertConfig: data.alertConfig || {},
        printers: data.printers || [],
        printServers: data.printServers || [],
        version: '2.0'
      }
    };

    // Calculate size
    const sizeBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
    if (sizeBytes < 1024) {
      snapshot.size = `${sizeBytes} B`;
    } else if (sizeBytes < 1024 * 1024) {
      snapshot.size = `${(sizeBytes / 1024).toFixed(2)} KB`;
    } else {
      snapshot.size = `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    snapshot.description = `Backup: settings, ${(data.users || []).length} users, ${(data.printers || []).length} printers, alert config`;

    // Save snapshot file
    const snapshotFile = path.join(SNAPSHOTS_DIR, `${id}.json`);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');

    // Update index
    let index = this.getIndex();
    index.unshift({ id, name: snapshot.name, createdAt: snapshot.createdAt, size: snapshot.size, description: snapshot.description });

    // Enforce limit
    if (index.length > MAX_SNAPSHOTS) {
      const removed = index.splice(MAX_SNAPSHOTS);
      removed.forEach(item => {
        const file = path.join(SNAPSHOTS_DIR, `${item.id}.json`);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
    }

    this.saveIndex(index);
    return snapshot;
  }

  /**
   * 获取快照列表（不含完整state数据）
   */
  listSnapshots() {
    return this.getIndex();
  }

  /**
   * 获取单个快照的完整数据
   */
  getSnapshot(id) {
    const file = path.join(SNAPSHOTS_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  /**
   * 删除快照
   */
  deleteSnapshot(id) {
    const file = path.join(SNAPSHOTS_DIR, `${id}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);

    let index = this.getIndex();
    index = index.filter(item => item.id !== id);
    this.saveIndex(index);
    return true;
  }

  /**
   * 恢复快照 - 将数据写回各服务
   */
  restoreSnapshot(id) {
    const snapshot = this.getSnapshot(id);
    if (!snapshot) return null;
    return snapshot.state;
  }
}

module.exports = new SnapshotService();
