/**
 * 用户管理路由
 */
const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { authorizeRole } = require('../middleware/authMiddleware');

/**
 * GET / - 获取所有用户列表（仅管理员）
 */
router.get('/', authorizeRole('Administrator'), (req, res) => {
  try {
    const users = userService.getAllUsers();
    res.apiSuccess(users, 'Users fetched successfully');
  } catch (error) {
    console.error('Failed to get users:', error);
    res.apiError('Failed to fetch users', 500, error.message);
  }
});

/**
 * POST / - 创建新用户（仅管理员）
 */
router.post('/', authorizeRole('Administrator'), (req, res) => {
  try {
    const { username, password, email, role, ntid } = req.body;

    if (!username || !password) {
      return res.apiError('Username and password are required', 400);
    }

    const newUser = userService.createUser({
      username,
      password,
      email,
      role: role || 'Viewer',
      ntid
    });

    console.log(`[USERS] Created user: ${username}`);
    res.apiSuccess(newUser, 'User created successfully', 201);
  } catch (error) {
    console.error('Failed to create user:', error);
    if (error.message.includes('already exists')) {
      return res.apiError(error.message, 400);
    }
    res.apiError('Failed to create user', 500, error.message);
  }
});

/**
 * PUT /:id - 更新用户信息（仅管理员）
 */
router.put('/:id', authorizeRole('Administrator'), (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, ntid } = req.body;

    const users = userService.loadUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return res.apiError('User not found', 404);
    }

    if (email !== undefined) users[userIndex].email = email;
    if (role !== undefined) users[userIndex].role = role;
    if (ntid !== undefined) users[userIndex].ntid = ntid;

    userService.saveUsers(users);

    const { passwordHash, ...userWithoutPassword } = users[userIndex];
    console.log(`[USERS] Updated user: ${users[userIndex].username}`);
    res.apiSuccess(userWithoutPassword, 'User updated successfully');
  } catch (error) {
    console.error('Failed to update user:', error);
    res.apiError('Failed to update user', 500, error.message);
  }
});

/**
 * DELETE /:id - 删除用户（仅管理员，不能删除自己）
 */
router.delete('/:id', authorizeRole('Administrator'), (req, res) => {
  try {
    const { id } = req.params;

    // 不能删除自己
    if (req.user.userId === id || req.user.id === id) {
      return res.apiError('Cannot delete your own account', 400);
    }

    userService.deleteUser(id);
    console.log(`[USERS] Deleted user: ${id}`);
    res.apiSuccess({}, 'User deleted successfully');
  } catch (error) {
    console.error('Failed to delete user:', error);
    if (error.message.includes('not found')) {
      return res.apiError(error.message, 404);
    }
    res.apiError('Failed to delete user', 500, error.message);
  }
});

/**
 * POST /:id/reset-password - 重置用户密码（仅管理员）
 */
router.post('/:id/reset-password', authorizeRole('Administrator'), (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword: specifiedPassword } = req.body;
    let finalPassword;

    if (specifiedPassword && specifiedPassword.length >= 6) {
      // 使用管理员指定的密码
      userService.changePassword(id, specifiedPassword);
      finalPassword = specifiedPassword;
    } else {
      // 未指定密码时生成随机密码
      finalPassword = userService.resetPassword(id);
    }

    console.log(`[USERS] Password reset for user: ${id}`);
    res.apiSuccess({ tempPassword: finalPassword }, 'Password reset successfully');
  } catch (error) {
    console.error('Failed to reset password:', error);
    if (error.message.includes('not found')) {
      return res.apiError(error.message, 404);
    }
    res.apiError('Failed to reset password', 500, error.message);
  }
});

module.exports = { router };
