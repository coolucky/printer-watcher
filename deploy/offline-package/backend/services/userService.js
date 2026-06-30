/**
 * 用户服务
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const USERS_FILE = path.join(__dirname, '../../users.json');

// 默认用户（如果users.json不存在）
const DEFAULT_USERS = [
  {
    id: 'admin-001',
    username: 'admin',
    ntid: 'ADMIN',
    email: '',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'Administrator',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    active: true,
    mustChangePassword: true
  }
];

/**
 * 加载所有用户
 * @returns {Array} 用户列表
 */
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading users:', error.message);
  }
  return DEFAULT_USERS;
}

/**
 * 保存用户列表
 * @param {Array} users - 用户列表
 */
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users:', error.message);
    throw error;
  }
}

/**
 * 根据用户名获取用户
 * @param {string} username - 用户名
 * @returns {Object|null} 用户对象或null
 */
function getUserByUsername(username) {
  const users = loadUsers();
  return users.find(u => u.username === username && u.active) || null;
}

/**
 * 根据ID获取用户
 * @param {string} userId - 用户ID
 * @returns {Object|null} 用户对象或null
 */
function getUserById(userId) {
  const users = loadUsers();
  return users.find(u => u.id === userId && u.active) || null;
}

/**
 * 验证用户密码
 * @param {string} username - 用户名
 * @param {string} password - 明文密码
 * @returns {Object|null} 用户对象或null（验证失败返回null）
 */
function verifyPassword(username, password) {
  const user = getUserByUsername(username);
  if (!user) return null;

  try {
    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (isValid) {
      return {
        id: user.id,
        username: user.username,
        ntid: user.ntid,
        email: user.email,
        role: user.role
      };
    }
  } catch (error) {
    console.error('Error verifying password:', error.message);
  }

  return null;
}

/**
 * 创建新用户
 * @param {Object} userData - 用户数据
 * @returns {Object} 创建的用户对象
 */
function createUser(userData) {
  const users = loadUsers();

  // 检查用户名是否已存在
  if (users.find(u => u.username === userData.username)) {
    throw new Error('Username already exists');
  }

  const newUser = {
    id: uuidv4(),
    username: userData.username,
    ntid: userData.ntid || '',
    email: userData.email || '',
    passwordHash: bcrypt.hashSync(userData.password, 10),
    role: userData.role || 'User',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    active: true
  };

  users.push(newUser);
  saveUsers(users);

  // 返回不包含密码的用户对象
  const { passwordHash, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

/**
 * 更新用户最后登录时间
 * @param {string} userId - 用户ID
 */
function updateLastLogin(userId) {
  const users = loadUsers();
  const user = users.find(u => u.id === userId);

  if (user) {
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
  }
}

/**
 * 更改用户密码
 * @param {string} userId - 用户ID
 * @param {string} newPassword - 新密码
 */
function changePassword(userId, newPassword) {
  const users = loadUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    throw new Error('User not found');
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  saveUsers(users);
}

/**
 * 获取所有用户（不包括密码）
 * @returns {Array} 用户列表
 */
function getAllUsers() {
  const users = loadUsers();
  return users
    .filter(u => u.active)
    .map(u => {
      const { passwordHash, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
}

/**
 * 重置用户密码为默认密码
 * @param {string} userId - 用户ID
 * @returns {string} 新密码
 */
function resetPassword(userId) {
  const defaultPassword = 'TempPassword123!';
  const users = loadUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    throw new Error('User not found');
  }

  user.passwordHash = bcrypt.hashSync(defaultPassword, 10);
  saveUsers(users);

  return defaultPassword;
}

/**
 * 删除用户（逻辑删除）
 * @param {string} userId - 用户ID
 */
function deleteUser(userId) {
  const users = loadUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    throw new Error('User not found');
  }

  user.active = false;
  saveUsers(users);
}

module.exports = {
  loadUsers,
  saveUsers,
  getUserByUsername,
  getUserById,
  verifyPassword,
  createUser,
  updateLastLogin,
  changePassword,
  getAllUsers,
  resetPassword,
  deleteUser
};
