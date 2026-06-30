/**
 * 认证路由
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  decodeToken
} = require('../utils/jwtUtils');
const { authenticateToken } = require('../middleware/authMiddleware');
const userService = require('../services/userService');
const nodemailer = require('nodemailer');
const settingsService = require('../services/settingsService');

// 登录频率限制：15分钟内最多10次尝试
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many sensitive requests, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * POST /auth/login
 * 用户登录
 * 请求体: { username, password }
 * 响应: { accessToken, refreshToken, user }
 */
router.post('/login', loginLimiter, (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.apiError('Username and password are required', 400);
    }

    // 输入长度校验 - 防止 DoS
    if (username.length > 128 || password.length > 256) {
      return res.apiError('Input too long', 400);
    }

    console.log(`[AUTH] Login attempt for user: ${username}`);

    // 验证密码
    const user = userService.verifyPassword(username, password);
    if (!user) {
      console.log(`[AUTH] ✗ Login failed for ${username}: Invalid credentials`);
      return res.apiError('Invalid username or password', 401);
    }

    // 更新最后登录时间
    userService.updateLastLogin(user.id);

    // 生成Token
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    console.log(`[AUTH] ✓ Login successful for ${username}`);

    res.apiSuccess(
      {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          ntid: user.ntid,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword || false
        }
      },
      'Login successful'
    );
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.apiError('Login failed', 500, error.message);
  }
});

/**
 * POST /auth/logout
 * 用户登出（可选，因为JWT是无状态的）
 */
router.post('/logout', authenticateToken, (req, res) => {
  console.log(`[AUTH] Logout for user: ${req.user.username}`);
  res.apiSuccess({}, 'Logout successful');
});

/**
 * POST /auth/refresh
 * 刷新Access Token
 * 请求体: { refreshToken }
 * 响应: { accessToken }
 */
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.apiError('Refresh token is required', 400);
    }

    // 验证Refresh Token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      console.log('[AUTH] ✗ Refresh token verification failed');
      return res.apiError('Invalid or expired refresh token', 401);
    }

    // 获取用户信息
    const user = userService.getUserById(decoded.userId);
    if (!user) {
      return res.apiError('User not found', 404);
    }

    // 生成新的Access Token
    const newAccessToken = generateAccessToken(user);
    // Refresh Token 轮换 - 每次刷新时生成新的 refresh token
    const newRefreshToken = generateRefreshToken(user);

    console.log(`[AUTH] ✓ Token refreshed for ${user.username}`);

    res.apiSuccess(
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      },
      'Token refreshed successfully'
    );
  } catch (error) {
    console.error('[AUTH] Refresh token error:', error);
    res.apiError('Token refresh failed', 500, error.message);
  }
});

/**
 * GET /auth/verify
 * 验证当前Token是否有效
 */
router.get('/verify', authenticateToken, (req, res) => {
  res.apiSuccess(
    {
      valid: true,
      user: req.user
    },
    'Token is valid'
  );
});

/**
 * POST /auth/register
 * 注册新用户（通常只有管理员可以）
 * 请求体: { username, password, email, role }
 */
router.post('/register', authenticateToken, (req, res) => {
  try {
    // 检查权限（仅限管理员）
    if (req.user.role !== 'Administrator') {
      return res.apiError('Only administrators can create users', 403);
    }

    const { username, password, email, role, ntid } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.apiError('Username and password are required', 400);
    }

    if (username.length > 128 || password.length > 256) {
      return res.apiError('Input too long', 400);
    }

    if (password.length < 6) {
      return res.apiError('Password must be at least 6 characters', 400);
    }

    // 创建用户
    const newUser = userService.createUser({
      username,
      password,
      email,
      role: role || 'User',
      ntid
    });

    console.log(`[AUTH] ✓ New user created: ${username}`);

    res.apiSuccess(newUser, 'User created successfully', 201);
  } catch (error) {
    console.error('[AUTH] Registration error:', error);
    if (error.message.includes('already exists')) {
      return res.apiError(error.message, 400);
    }
    res.apiError('User registration failed', 500, error.message);
  }
});

/**
 * POST /auth/change-password
 * 修改当前用户密码
 * 请求体: { oldPassword, newPassword }
 */
router.post('/change-password', authenticateToken, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!oldPassword || !newPassword) {
      return res.apiError('Old password and new password are required', 400);
    }

    if (oldPassword.length > 256 || newPassword.length > 256) {
      return res.apiError('Input too long', 400);
    }

    if (newPassword.length < 6) {
      return res.apiError('New password must be at least 6 characters', 400);
    }

    // 验证旧密码
    const user = userService.getUserById(userId);
    if (!user) {
      return res.apiError('User not found', 404);
    }

    // 通过用户名和旧密码验证
    const verified = userService.verifyPassword(user.username, oldPassword);
    if (!verified) {
      return res.apiError('Invalid old password', 401);
    }

    // 修改密码
    userService.changePassword(userId, newPassword);

    console.log(`[AUTH] ✓ Password changed for ${user.username}`);

    res.apiSuccess({}, 'Password changed successfully');
  } catch (error) {
    console.error('[AUTH] Change password error:', error);
    res.apiError('Password change failed', 500, error.message);
  }
});

/**
 * GET /auth/me
 * 获取当前用户信息
 */
router.get('/me', authenticateToken, (req, res) => {
  const userId = req.user.userId || req.user.id;
  const user = userService.getUserById(userId);

  if (!user) {
    return res.apiError('User not found', 404);
  }

  res.apiSuccess(user, 'User information retrieved');
});

/**
 * POST /auth/forgot-password
 * 忘记密码 - 发送随机密码到用户邮箱
 * 请求体: { username }
 */
router.post('/forgot-password', sensitiveActionLimiter, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.apiError('Username is required', 400);
    }

    if (username.length > 128) {
      return res.apiError('Input too long', 400);
    }

    // 查找用户
    const user = userService.getUserByUsername(username);
    if (!user) {
      // 为安全起见，不透露用户是否存在
      return res.apiSuccess({}, 'If the account exists, a password reset email has been sent');
    }

    if (!user.email) {
      return res.apiError('No email address associated with this account. Please contact administrator.', 400);
    }

    // 生成6位随机密码
    const randomPassword = Math.floor(100000 + Math.random() * 900000).toString();

    // 更新用户密码
    userService.changePassword(user.id, randomPassword);

    // 获取发件邮箱配置
    const settings = settingsService.getSettings();
    const forgotPasswordFrom = settings.forgotPasswordEmail || 'admin@example.com';
    const smtpConfig = {
      host: settings.email?.smtpServer || 'smtp.example.com',
      port: parseInt(settings.email?.smtpPort || '25'),
      secure: false,
      requireTLS: false,
      ignoreTLS: true,
      tls: { rejectUnauthorized: false }
    };

    // 添加认证（如果有）
    const smtpUser = settings.email?.smtpUser || '';
    const smtpPass = settings.email?.smtpPass || '';
    if (smtpUser && smtpPass) {
      smtpConfig.auth = { user: smtpUser, pass: smtpPass };
    }

    // 发送邮件
    const transporter = nodemailer.createTransport(smtpConfig);
    await transporter.sendMail({
      from: forgotPasswordFrom,
      to: user.email,
      subject: 'Printing Service Monitoring - Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
          <h2 style="color: #1976d2;">Password Reset</h2>
          <p>Hello <strong>${user.username}</strong>,</p>
          <p>Your password has been reset. Please use the following temporary password to log in:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #333;">${randomPassword}</span>
          </div>
          <p>Please change your password after logging in.</p>
          <p style="color: #666; font-size: 12px;">This is an automated message from Print Service Monitoring System.</p>
        </div>
      `
    });
    transporter.close();

    console.log(`[AUTH] ✓ Password reset email sent to ${user.email} for user ${username}`);
    res.apiSuccess({}, 'Password reset email has been sent');
  } catch (error) {
    console.error('[AUTH] Forgot password error:', error);
    res.apiError('Failed to send password reset email: ' + error.message, 500);
  }
});

/**
 * POST /auth/test-forgot-password-email
 * 测试忘记密码邮件发送（管理员）
 */
router.post('/test-forgot-password-email', authenticateToken, sensitiveActionLimiter, async (req, res) => {
  try {
    if (req.user.role !== 'Administrator') {
      return res.apiError('Only administrators can test email', 403);
    }

    const { toEmail } = req.body;
    if (!toEmail) {
      return res.apiError('Target email address is required', 400);
    }

    if (toEmail.length > 256) {
      return res.apiError('Input too long', 400);
    }

    const settings = settingsService.getSettings();
    const forgotPasswordFrom = settings.forgotPasswordEmail || 'admin@example.com';
    const smtpConfig = {
      host: settings.email?.smtpServer || 'smtp.example.com',
      port: parseInt(settings.email?.smtpPort || '25'),
      secure: false,
      requireTLS: false,
      ignoreTLS: true,
      tls: { rejectUnauthorized: false }
    };

    const smtpUser = settings.email?.smtpUser || '';
    const smtpPass = settings.email?.smtpPass || '';
    if (smtpUser && smtpPass) {
      smtpConfig.auth = { user: smtpUser, pass: smtpPass };
    }

    const transporter = nodemailer.createTransport(smtpConfig);
    await transporter.sendMail({
      from: forgotPasswordFrom,
      to: toEmail,
      subject: 'Printing Service Monitoring - Forgot Password Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
          <h2 style="color: #4caf50;">Email Test Successful</h2>
          <p>This is a test email from the Forgot Password feature.</p>
          <p><strong>Sender:</strong> ${forgotPasswordFrom}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <p style="color: #666;">If you received this email, the forgot password email configuration is working correctly.</p>
        </div>
      `
    });
    transporter.close();

    console.log(`[AUTH] ✓ Test forgot-password email sent from ${forgotPasswordFrom} to ${toEmail}`);
    res.apiSuccess({}, `Test email sent successfully from ${forgotPasswordFrom} to ${toEmail}`);
  } catch (error) {
    console.error('[AUTH] Test email error:', error);
    res.apiError('Failed to send test email: ' + error.message, 500);
  }
});

/**
 * POST /auth/send-password-email
 * 发送重置后的密码到用户邮箱（管理员操作）
 * 请求体: { email, password }
 */
router.post('/send-password-email', authenticateToken, sensitiveActionLimiter, async (req, res) => {
  try {
    if (req.user.role !== 'Administrator') {
      return res.apiError('Only administrators can send password emails', 403);
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.apiError('Email and password are required', 400);
    }

    if (email.length > 256 || password.length > 256) {
      return res.apiError('Input too long', 400);
    }

    const settings = settingsService.getSettings();
    const forgotPasswordFrom = settings.forgotPasswordEmail || 'admin@example.com';
    const smtpConfig = {
      host: settings.email?.smtpServer || 'smtp.example.com',
      port: parseInt(settings.email?.smtpPort || '25'),
      secure: false,
      requireTLS: false,
      ignoreTLS: true,
      tls: { rejectUnauthorized: false }
    };

    const smtpUser = settings.email?.smtpUser || '';
    const smtpPass = settings.email?.smtpPass || '';
    if (smtpUser && smtpPass) {
      smtpConfig.auth = { user: smtpUser, pass: smtpPass };
    }

    const transporter = nodemailer.createTransport(smtpConfig);
    await transporter.sendMail({
      from: forgotPasswordFrom,
      to: email,
      subject: 'Printing Service Monitoring - Your New Password',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
          <h2 style="color: #1976d2;">Password Reset by Administrator</h2>
          <p>Hello,</p>
          <p>Your password has been reset by an administrator. Please use the following password to log in:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; text-align: center; margin: 20px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 1px; color: #333;">${password}</span>
          </div>
          <p>Please change your password after logging in for security purposes.</p>
          <p style="color: #666; font-size: 12px;">This is an automated message from Print Service Monitoring System.</p>
        </div>
      `
    });
    transporter.close();

    console.log(`[AUTH] ✓ Password email sent to ${email}`);
    res.apiSuccess({}, 'Password email sent successfully');
  } catch (error) {
    console.error('[AUTH] Send password email error:', error);
    res.apiError('Failed to send password email: ' + error.message, 500);
  }
});

module.exports = router;
