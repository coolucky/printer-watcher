/**
 * 快照路由模块
 * 提供系统快照的创建、列表、恢复、删除和导出功能
 */
const express = require('express');
const router = express.Router();
const snapshotService = require('../services/snapshotService');
const settingsService = require('../services/settingsService');
const alertService = require('../services/alertService');
const userService = require('../services/userService');
const fs = require('fs');
const path = require('path');
const { authorizeRole } = require('../middleware/authMiddleware');

const PRINTERS_FILE = path.join(__dirname, '../config/printers.json');

/**
 * GET / - 获取快照列表
 */
router.get('/', (req, res) => {
  try {
    const snapshots = snapshotService.listSnapshots();
    res.apiSuccess(snapshots, 'Snapshots fetched successfully');
  } catch (error) {
    res.apiError('Failed to fetch snapshots', 500, error.message);
  }
});

/**
 * POST / - 创建新快照（自动收集所有系统数据）
 */
router.post('/', authorizeRole('Administrator'), (req, res) => {
  try {
    const { name } = req.body;

    // Collect all system data
    const settings = settingsService.getSettings();
    const users = userService.getAllUsers();
    const alertConfig = alertService.getConfig();

    let printers = [];
    try {
      if (fs.existsSync(PRINTERS_FILE)) {
        printers = JSON.parse(fs.readFileSync(PRINTERS_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('Failed to read printers config:', e.message);
    }

    let printServers = [];
    try {
      const printServersFile = path.join(__dirname, '../config/printServers.json');
      if (fs.existsSync(printServersFile)) {
        printServers = JSON.parse(fs.readFileSync(printServersFile, 'utf8'));
      }
    } catch (e) {
      console.warn('Failed to read print servers config:', e.message);
    }

    const snapshot = snapshotService.createSnapshot(name, {
      settings,
      users,
      alertConfig,
      printers,
      printServers
    });

    res.apiSuccess(snapshot, 'Snapshot created successfully');
  } catch (error) {
    console.error('Failed to create snapshot:', error);
    res.apiError('Failed to create snapshot', 500, error.message);
  }
});

/**
 * GET /:id - 获取单个快照完整数据
 */
router.get('/:id', (req, res) => {
  try {
    const snapshot = snapshotService.getSnapshot(req.params.id);
    if (!snapshot) {
      return res.apiError('Snapshot not found', 404);
    }
    res.apiSuccess(snapshot, 'Snapshot fetched');
  } catch (error) {
    res.apiError('Failed to fetch snapshot', 500, error.message);
  }
});

/**
 * POST /:id/restore - 恢复快照
 */
router.post('/:id/restore', authorizeRole('Administrator'), (req, res) => {
  try {
    const state = snapshotService.restoreSnapshot(req.params.id);
    if (!state) {
      return res.apiError('Snapshot not found', 404);
    }

    // Restore settings
    if (state.settings) {
      settingsService.saveSettings(state.settings);
    }

    // Restore alert config
    if (state.alertConfig) {
      alertService.saveConfig(state.alertConfig);
    }

    // Restore users
    if (state.users && state.users.length > 0) {
      userService.saveUsers(state.users);
    }

    // Restore printer configs
    if (state.printers && state.printers.length > 0) {
      try {
        fs.writeFileSync(PRINTERS_FILE, JSON.stringify(state.printers, null, 2), 'utf8');
      } catch (e) {
        console.warn('Failed to restore printers:', e.message);
      }
    }

    // Restore print servers
    if (state.printServers) {
      try {
        const printServersFile = path.join(__dirname, '../config/printServers.json');
        fs.writeFileSync(printServersFile, JSON.stringify(state.printServers, null, 2), 'utf8');
      } catch (e) {
        console.warn('Failed to restore print servers:', e.message);
      }
    }

    res.apiSuccess(state, 'Snapshot restored successfully');
  } catch (error) {
    console.error('Failed to restore snapshot:', error);
    res.apiError('Failed to restore snapshot', 500, error.message);
  }
});

/**
 * DELETE /:id - 删除快照
 */
router.delete('/:id', authorizeRole('Administrator'), (req, res) => {
  try {
    snapshotService.deleteSnapshot(req.params.id);
    res.apiSuccess(null, 'Snapshot deleted successfully');
  } catch (error) {
    res.apiError('Failed to delete snapshot', 500, error.message);
  }
});

/**
 * GET /:id/export - 导出快照为下载文件
 */
router.get('/:id/export', (req, res) => {
  try {
    const snapshot = snapshotService.getSnapshot(req.params.id);
    if (!snapshot) {
      return res.apiError('Snapshot not found', 404);
    }

    const filename = `snapshot-${snapshot.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-${snapshot.id}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(snapshot, null, 2));
  } catch (error) {
    res.apiError('Failed to export snapshot', 500, error.message);
  }
});

/**
 * POST /import - 导入快照
 */
router.post('/import', authorizeRole('Administrator'), (req, res) => {
  try {
    const importedData = req.body;
    if (!importedData || !importedData.state) {
      return res.apiError('Invalid snapshot data', 400);
    }

    const snapshot = snapshotService.createSnapshot(
      importedData.name ? `[Imported] ${importedData.name}` : 'Imported Snapshot',
      importedData.state
    );

    res.apiSuccess(snapshot, 'Snapshot imported successfully');
  } catch (error) {
    res.apiError('Failed to import snapshot', 500, error.message);
  }
});

module.exports = { router };
