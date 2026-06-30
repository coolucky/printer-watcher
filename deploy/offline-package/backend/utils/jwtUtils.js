/**
 * JWT Token管理工具
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// JWT密钥 - 优先从环境变量读取，否则从文件读取或生成持久化密钥
function getOrCreateSecret(envKey, fileName) {
  if (process.env[envKey]) return process.env[envKey];
  
  const secretFile = path.join(__dirname, '../config', fileName);
  try {
    if (fs.existsSync(secretFile)) {
      return fs.readFileSync(secretFile, 'utf8').trim();
    }
  } catch (e) { /* ignore read error */ }
  
  // Generate and persist
  const secret = crypto.randomBytes(64).toString('hex');
  try {
    const configDir = path.join(__dirname, '../config');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(secretFile, secret, 'utf8');
    console.log(`[JWT] Generated and saved persistent secret to ${fileName}`);
  } catch (e) {
    console.warn(`[JWT] Could not persist secret to ${fileName}: ${e.message}`);
  }
  return secret;
}

const JWT_SECRET = getOrCreateSecret('JWT_SECRET', '.jwt-secret');
const JWT_REFRESH_SECRET = getOrCreateSecret('JWT_REFRESH_SECRET', '.jwt-refresh-secret');
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

/**
 * 生成JWT Access Token
 * @param {Object} user - 用户对象
 * @param {string} user.id - 用户ID
 * @param {string} user.username - 用户名
 * @param {string} user.role - 用户角色
 * @returns {string} JWT Token
 */
function generateAccessToken(user) {
  const payload = {
    userId: user.id || user.userId,
    username: user.username,
    role: user.role || 'user',
    ntid: user.ntid || ''
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
    issuer: 'printer-status-system',
    subject: user.username,
    audience: 'printer-status-app'
  });
}

/**
 * 生成JWT Refresh Token
 * @param {Object} user - 用户对象
 * @returns {string} Refresh Token
 */
function generateRefreshToken(user) {
  const payload = {
    userId: user.id || user.userId,
    username: user.username
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRE,
    issuer: 'printer-status-system',
    subject: user.username
  });
}

/**
 * 验证Access Token
 * @param {string} token - JWT Token
 * @returns {Object|null} 解码后的payload或null
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'printer-status-system',
      audience: 'printer-status-app'
    });
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error.message);
    return null;
  }
}

/**
 * 验证Refresh Token
 * @param {string} token - Refresh Token
 * @returns {Object|null} 解码后的payload或null
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'printer-status-system'
    });
    return decoded;
  } catch (error) {
    console.error('Refresh token verification error:', error.message);
    return null;
  }
}

/**
 * 从Authorization头中提取Token
 * @param {string} authHeader - Authorization header值
 * @returns {string|null} Token或null
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * 获取Token信息（不验证签名，仅解码）
 * @param {string} token - JWT Token
 * @returns {Object|null} 解码后的payload或null
 */
function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

/**
 * 检查Token是否即将过期（在5分钟内）
 * @param {string} token - JWT Token
 * @returns {boolean} 是否需要刷新
 */
function isTokenExpiringSoon(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = decoded.exp - now;
  
  // 如果在5分钟内过期，则返回true
  return timeUntilExpiry < 300;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  decodeToken,
  isTokenExpiringSoon,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRE,
  JWT_REFRESH_EXPIRE
};
