/**
 * 系统更新路由 - 处理离线包上传和自动更新
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const { authorizeRole } = require('../middleware/authMiddleware');

// 配置 multer 存储
const UPLOAD_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `update-${Date.now()}.zip`)
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  }
});

/**
 * 获取当前系统版本信息
 */
router.get('/info', (req, res) => {
  try {
    const rootDir = path.resolve(__dirname, '../..');
    const backendPkg = path.join(__dirname, '../package.json');
    
    let version = '1.0.0';
    if (fs.existsSync(backendPkg)) {
      const pkg = JSON.parse(fs.readFileSync(backendPkg, 'utf8'));
      version = pkg.version || version;
    }

    // 检查上次更新时间
    const updateLogFile = path.join(__dirname, '../config/update-log.json');
    let lastUpdate = null;
    if (fs.existsSync(updateLogFile)) {
      const log = JSON.parse(fs.readFileSync(updateLogFile, 'utf8'));
      lastUpdate = log.lastUpdate || null;
    }

    res.apiSuccess({
      version,
      lastUpdate,
      platform: process.platform,
      nodeVersion: process.version
    });
  } catch (error) {
    res.apiError('Failed to get system info', 500, error.message);
  }
});

/**
 * 上传并安装更新包
 * POST /api/update/upload
 */
router.post('/upload', authorizeRole('Administrator'), upload.single('package'), async (req, res) => {
  if (!req.file) {
    return res.apiError('No file uploaded', 400);
  }

  const zipPath = req.file.path;
  const extractDir = path.join(UPLOAD_DIR, `extract-${Date.now()}`);
  
  try {
    console.log(`[UPDATE] Received update package: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // 确定项目根目录 (在生产环境离线部署中，结构是 offline-package/ 作为根)
    const rootDir = path.resolve(__dirname, '../..');
    const backendDir = path.resolve(__dirname, '..');
    const distDir = path.join(rootDir, 'dist');

    // 解压 zip 文件
    console.log('[UPDATE] Extracting update package...');
    fs.mkdirSync(extractDir, { recursive: true });

    if (process.platform === 'win32') {
      // Windows: 使用 PowerShell 解压
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`, {
        timeout: 120000
      });
    } else {
      // macOS/Linux: 使用 unzip
      execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
        timeout: 120000
      });
    }

    // 查找解压后的目录结构 (可能有一层 offline-package/ 目录)
    let sourceDir = extractDir;
    const entries = fs.readdirSync(extractDir).filter(e => e !== '__MACOSX' && !e.startsWith('.'));
    
    // 如果只有一个子文件夹 (如 offline-package/)，进入它
    if (entries.length === 1) {
      const singleEntry = path.join(extractDir, entries[0]);
      if (fs.statSync(singleEntry).isDirectory()) {
        sourceDir = singleEntry;
      }
    } else {
      // 尝试直接找 offline-package 目录
      const offlinePkgDir = path.join(extractDir, 'offline-package');
      if (fs.existsSync(offlinePkgDir) && fs.statSync(offlinePkgDir).isDirectory()) {
        sourceDir = offlinePkgDir;
      }
    }

    // 验证解压后的内容
    const hasDist = fs.existsSync(path.join(sourceDir, 'dist'));
    const hasBackend = fs.existsSync(path.join(sourceDir, 'backend'));
    
    if (!hasDist && !hasBackend) {
      throw new Error('Invalid update package: missing dist/ or backend/ directory');
    }

    console.log(`[UPDATE] Package validated - dist: ${hasDist}, backend: ${hasBackend}`);

    // 备份当前文件
    const backupDir = path.join(rootDir, `backup-before-update-${Date.now()}`);
    fs.mkdirSync(backupDir, { recursive: true });
    
    if (fs.existsSync(distDir)) {
      copyDirSync(distDir, path.join(backupDir, 'dist'));
    }
    // 备份后端关键文件 (不备份 node_modules 和 config)
    const backendFilesToBackup = ['server.js', 'index.js', 'package.json', 'printerScraper.js'];
    fs.mkdirSync(path.join(backupDir, 'backend'), { recursive: true });
    for (const f of backendFilesToBackup) {
      const src = path.join(backendDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupDir, 'backend', f));
      }
    }
    
    console.log(`[UPDATE] Backup created at: ${backupDir}`);

    // 覆盖前端文件
    if (hasDist) {
      console.log('[UPDATE] Updating frontend files (dist/)...');
      // 删除旧 dist 并复制新的
      if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
      }
      copyDirSync(path.join(sourceDir, 'dist'), distDir);
    }

    // 覆盖后端文件 (保留 config/ 和 node_modules/)
    if (hasBackend) {
      console.log('[UPDATE] Updating backend files...');
      const newBackendDir = path.join(sourceDir, 'backend');
      
      // 复制后端文件 (排除 config, node_modules, temp, .env)
      const skipDirs = ['config', 'node_modules', 'temp', '.env'];
      copyDirSync(newBackendDir, backendDir, skipDirs);
      
      // 如果新包有 node_modules 并且没有现有的，则复制
      const newNodeModules = path.join(newBackendDir, 'node_modules');
      const existingNodeModules = path.join(backendDir, 'node_modules');
      if (fs.existsSync(newNodeModules) && !fs.existsSync(existingNodeModules)) {
        console.log('[UPDATE] Copying node_modules...');
        copyDirSync(newNodeModules, existingNodeModules);
      }
      
      // 检查是否需要更新 node_modules (比较 package.json)
      const newPkgPath = path.join(newBackendDir, 'package.json');
      const curPkgPath = path.join(backendDir, 'package.json');
      if (fs.existsSync(newPkgPath) && fs.existsSync(curPkgPath)) {
        const newPkg = JSON.parse(fs.readFileSync(newPkgPath, 'utf8'));
        const curPkg = JSON.parse(fs.readFileSync(curPkgPath, 'utf8'));
        if (JSON.stringify(newPkg.dependencies) !== JSON.stringify(curPkg.dependencies)) {
          console.log('[UPDATE] Dependencies changed, updating node_modules...');
          // 覆盖 package.json
          fs.copyFileSync(newPkgPath, curPkgPath);
          // 复制新的 node_modules
          if (fs.existsSync(newNodeModules)) {
            fs.rmSync(existingNodeModules, { recursive: true, force: true });
            copyDirSync(newNodeModules, existingNodeModules);
          }
        }
      }
    }

    // 复制根目录其他文件 (如 settings.json, frontend-server.js 等)
    const rootFiles = ['frontend-server.js', 'start-service.bat', 'stop-service.bat'];
    for (const f of rootFiles) {
      const src = path.join(sourceDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(rootDir, f));
      }
    }

    // 记录更新日志
    const updateLogFile = path.join(__dirname, '../config/update-log.json');
    const updateLog = {
      lastUpdate: new Date().toISOString(),
      filename: req.file.originalname,
      size: req.file.size,
      backupDir: backupDir
    };
    fs.writeFileSync(updateLogFile, JSON.stringify(updateLog, null, 2), 'utf8');

    // 清理临时文件
    console.log('[UPDATE] Cleaning up temp files...');
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    // 清理过期备份 (保留最近3个)
    cleanOldBackups(rootDir, 3);

    console.log('[UPDATE] Update completed successfully!');

    res.apiSuccess({
      message: 'Update installed successfully',
      filename: req.file.originalname,
      updatedComponents: {
        frontend: hasDist,
        backend: hasBackend
      },
      backupDir,
      restartRequired: hasBackend
    }, 'System update installed. Service restart required.');

  } catch (error) {
    console.error('[UPDATE] Update failed:', error);
    // 清理临时文件
    try {
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch (e) { /* ignore cleanup errors */ }
    
    res.apiError('Update failed: ' + error.message, 500);
  }
});

/**
 * 重启服务
 * POST /api/update/restart
 */
router.post('/restart', authorizeRole('Administrator'), (req, res) => {
  try {
    console.log('[UPDATE] Service restart requested...');
    
    // 先返回成功响应
    res.apiSuccess({ message: 'Service restarting...' }, 'Restart initiated');

    // 延迟2秒后重启，确保响应已发送
    setTimeout(() => {
      const rootDir = path.resolve(__dirname, '../..');
      
      if (process.platform === 'win32') {
        // Windows: 使用 restart-service.bat
        const restartScript = path.join(rootDir, 'restart-service.bat');
        if (fs.existsSync(restartScript)) {
          spawn('cmd', ['/c', restartScript], {
            detached: true,
            stdio: 'ignore',
            cwd: rootDir
          }).unref();
        } else {
          // 如果没有 restart 脚本，直接退出进程让 Windows 服务管理器重启
          console.log('[UPDATE] No restart script found, exiting process...');
          process.exit(0);
        }
      } else {
        // macOS/Linux: 直接退出进程 (如果有 PM2 或 systemd 会自动重启)
        console.log('[UPDATE] Exiting process for restart...');
        process.exit(0);
      }
    }, 2000);
    
  } catch (error) {
    console.error('[UPDATE] Restart failed:', error);
    res.apiError('Restart failed: ' + error.message, 500);
  }
});

/**
 * 递归复制目录
 */
function copyDirSync(src, dest, skipDirs = []) {
  if (!fs.existsSync(src)) return;
  
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    if (skipDirs.includes(entry.name)) continue;
    
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 清理过期备份目录
 */
function cleanOldBackups(rootDir, keepCount) {
  try {
    const entries = fs.readdirSync(rootDir)
      .filter(e => e.startsWith('backup-before-update-'))
      .map(e => ({ name: e, path: path.join(rootDir, e) }))
      .sort((a, b) => b.name.localeCompare(a.name)); // 最新的在前
    
    if (entries.length > keepCount) {
      for (let i = keepCount; i < entries.length; i++) {
        console.log(`[UPDATE] Removing old backup: ${entries[i].name}`);
        fs.rmSync(entries[i].path, { recursive: true, force: true });
      }
    }
  } catch (e) {
    console.warn('[UPDATE] Failed to clean old backups:', e.message);
  }
}

module.exports = { router };
