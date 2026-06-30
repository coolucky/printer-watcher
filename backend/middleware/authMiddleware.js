/**
 * 认证中间件
 */

const { extractTokenFromHeader, verifyAccessToken, verifyRefreshToken } = require('../utils/jwtUtils');

const shouldLogAuthSuccess = process.env.AUTH_LOG_SUCCESS === 'true';

function logAuthSuccess(message) {
  if (shouldLogAuthSuccess) {
    console.log(message);
  }
}

/**
 * 验证JWT Token的中间件
 * 检查Authorization header中的Bearer token
 * @param {Object} req - Express request对象
 * @param {Object} res - Express response对象
 * @param {Function} next - 下一个中间件
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    console.log('[AUTH] Missing token in request');
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Missing authentication token',
      error: 'No bearer token provided'
    });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    console.log('[AUTH] Invalid or expired token');
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired authentication token',
      error: 'Token verification failed'
    });
  }

  // 将用户信息附加到req对象
  req.user = decoded;
  req.token = token;

  logAuthSuccess(`[AUTH] ✓ Authenticated as ${decoded.username} (${decoded.role})`);
  next();
}

/**
 * 验证用户角色的中间件工厂
 * @param {string|Array<string>} allowedRoles - 允许的角色
 * @returns {Function} 中间件函数
 */
function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    // 确保在此之前已经调用了authenticateToken
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'User not authenticated'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.user.role)) {
      console.log(`[AUTH] ✗ User ${req.user.username} denied access (role: ${req.user.role})`);
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        error: `This action requires one of the following roles: ${roles.join(', ')}`
      });
    }

    logAuthSuccess(`[AUTH] ✓ Authorization check passed for ${req.user.username}`);
    next();
  };
}

/**
 * 检查Token是否将要过期的中间件
 * 如果token将在5分钟内过期，返回特殊状态码
 * @param {Object} req - Express request对象
 * @param {Object} res - Express response对象
 * @param {Function} next - 下一个中间件
 */
function checkTokenExpiry(req, res, next) {
  if (req.token) {
    const { isTokenExpiringSoon } = require('../utils/jwtUtils');
    if (isTokenExpiringSoon(req.token)) {
      res.setHeader('X-Token-Expiring-Soon', 'true');
      console.log(`[AUTH] ⚠️  Token for ${req.user.username} will expire soon`);
    }
  }
  next();
}

/**
 * 可选认证中间件
 * 如果提供了token就验证，但不验证失败
 * @param {Object} req - Express request对象
 * @param {Object} res - Express response对象
 * @param {Function} next - 下一个中间件
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      req.user = decoded;
      req.token = token;
      logAuthSuccess(`[AUTH] ✓ Optional auth: Authenticated as ${decoded.username}`);
    }
  }

  next();
}

module.exports = {
  authenticateToken,
  authorizeRole,
  checkTokenExpiry,
  optionalAuth
};
