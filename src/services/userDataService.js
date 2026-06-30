// 直接使用localStorage进行数据存储

// 用户数据存储键名
const USERS_STORAGE_KEY = 'system_users';

// 简单的密码哈希函数
const hashPassword = (password) => {
  // 简单的SHA类似实现（不是密码学安全的，但比明文好）
  let hash = 0;
  if (typeof password !== 'string' || password.length === 0) {
    return hash.toString();
  }
  
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  return Math.abs(hash).toString(16);
};

// 默认管理员账号
const DEFAULT_ADMIN = {
  id: '1',
  username: 'admin',
  ntid: 'ADMIN',
  email: '',
  password: hashPassword('admin321'), // 已加密存储
  role: 'admin',
  createdAt: new Date().toISOString(),
  lastLogin: null
};

// 初始化用户数据
export const initializeUsers = async () => {
  try {
    // 获取现有用户数据
    try {
      const savedUsers = localStorage.getItem(USERS_STORAGE_KEY);
      const existingUsers = savedUsers ? JSON.parse(savedUsers) : [];
      
      if (!Array.isArray(existingUsers) || existingUsers.length === 0) {
        // 如果没有用户数据，创建默认管理员账号
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([DEFAULT_ADMIN]));
        console.log('默认管理员账号已创建');
        return [DEFAULT_ADMIN];
      }
      
      return existingUsers;
    } catch (parseError) {
      console.error('解析用户数据失败:', parseError);
      return [DEFAULT_ADMIN];
    }
  } catch (error) {
    console.error('初始化用户数据失败:', error);
    return [DEFAULT_ADMIN];
  }
};

// 登录功能
export const login = async (username, password) => {
  try {
    const users = await initializeUsers();
    const user = users.find(u => u.username === username && u.password === hashPassword(password));
    
    if (user) {
      // 更新最后登录时间
      user.lastLogin = new Date().toISOString();
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      } catch (e) {
        console.error('保存用户数据失败:', e);
      }
      
      // 保存登录状态
      localStorage.setItem('currentUser', JSON.stringify({
        id: user.id,
        username: user.username,
        ntid: user.ntid,
        email: user.email,
        role: user.role
      }));
      
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          ntid: user.ntid,
          email: user.email,
          role: user.role
        }
      };
    } else {
      return {
        success: false,
        message: '用户名或密码错误'
      };
    }
  } catch (error) {
    console.error('登录失败:', error);
    return {
      success: false,
      message: '登录过程中发生错误'
    };
  }
};

// 创建用户功能
export const createUser = async (userData) => {
  try {
    const users = await initializeUsers();
    
    // 检查用户名是否已存在
    if (users.find(u => u.username === userData.username)) {
      return { success: false, message: '用户名已存在' };
    }
    
    // 检查邮箱是否已存在
    if (users.find(u => u.email === userData.email)) {
      return { success: false, message: '邮箱已被注册' };
    }
    
    // 创建新用户
    const newUser = {
      id: String(users.length + 1),
      username: userData.username,
      ntid: userData.ntid || '',
      email: userData.email,
      password: hashPassword(userData.password),
      role: userData.role || 'viewer',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    
    users.push(newUser);
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('保存用户数据失败:', e);
      throw new Error('保存用户数据失败');
    }
    
    return { success: true, user: newUser };
  } catch (error) {
    console.error('创建用户失败:', error);
    return { success: false, message: '创建用户过程中发生错误' };
  }
};

// 注册功能
export const register = async (userData) => {
  try {
    const users = await initializeUsers();
    
    // 检查用户名是否已存在
    if (users.find(u => u.username === userData.ntid)) {
      return {
        success: false,
        message: '该用户名已存在'
      };
    }
    
    // 检查邮箱是否已存在
    if (users.find(u => u.email === userData.email)) {
      return {
        success: false,
        message: '该邮箱已被注册'
      };
    }
    
    // 密码验证
    if (userData.password.length < 6) {
      return {
        success: false,
        message: '密码长度至少为6位'
      };
    }
    
    // 创建新用户
    const newUser = {
      id: Date.now().toString(),
      username: userData.ntid, // 使用NTID作为用户名
      ntid: userData.ntid,
      email: userData.email,
      password: hashPassword(userData.password), // 已加密存储
      role: 'viewer', // 新用户默认角色为观察者
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    
    users.push(newUser);
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('保存用户数据失败:', e);
      throw new Error('保存用户数据失败');
    }
    
    return {
      success: true,
      user: newUser
    };
  } catch (error) {
    console.error('注册失败:', error);
    return {
      success: false,
      message: '注册过程中发生错误'
    };
  }
};

// 登出功能
export const logout = () => {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('authSession');
};

// 获取当前登录用户
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
};

// 检查是否已登录
export const isLoggedIn = () => {
  return !!getCurrentUser();
};

// 获取所有用户（仅管理员）
export const getAllUsers = async () => {
  try {
    const users = await initializeUsers();
    return users.map(user => ({
      id: user.id,
      username: user.username,
      ntid: user.ntid,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
};

// 更新用户信息
export const updateUser = async (userId, updatedData) => {
  try {
    const users = await initializeUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    // 更新用户信息（不更新密码）
    users[userIndex] = {
      ...users[userIndex],
      ...updatedData,
      password: users[userIndex].password // 保留原密码
    };
    
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('保存用户数据失败:', e);
      throw new Error('保存用户数据失败');
    }
    
    // 如果更新的是当前登录用户，更新localStorage
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('currentUser', JSON.stringify({
        ...currentUser,
        ...updatedData
      }));
    }
    
    return {
      success: true,
      user: users[userIndex]
    };
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return {
      success: false,
      message: '更新用户信息失败'
    };
  }
};

// 重置用户密码
export const resetPassword = async (userId, newPassword) => {
  try {
    const users = await initializeUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    // 密码验证
    if (newPassword.length < 6) {
      return {
        success: false,
        message: '密码长度至少为6位'
      };
    }
    
    users[userIndex].password = hashPassword(newPassword);
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('保存用户数据失败:', e);
      throw new Error('保存用户数据失败');
    }
    
    return {
      success: true,
      message: '密码重置成功'
    };
  } catch (error) {
    console.error('重置密码失败:', error);
    return {
      success: false,
      message: '重置密码失败'
    };
  }
};

// 删除用户
export const deleteUser = async (userId) => {
  try {
    // 不允许删除管理员账号
    if (userId === '1') {
      return {
        success: false,
        message: '不能删除管理员账号'
      };
    }
    
    const users = await initializeUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    
    if (filteredUsers.length === users.length) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filteredUsers));
    } catch (e) {
      console.error('保存用户数据失败:', e);
      throw new Error('保存用户数据失败');
    }
    
    return {
      success: true,
      message: '用户删除成功'
    };
  } catch (error) {
    console.error('删除用户失败:', error);
    return {
      success: false,
      message: '删除用户失败'
    };
  }
};

// initializeUsers 函数已在定义时导出

// 发送重置密码邮件（模拟）
export const sendPasswordResetEmail = async (userEmail, newPassword) => {
  try {
    // 这里只是模拟发送邮件
    // 实际应用中应该调用真实的邮件发送API
    console.log(`模拟发送密码重置邮件到 ${userEmail}，新密码：${newPassword}`);
    
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      message: '密码重置邮件已发送'
    };
  } catch (error) {
    console.error('发送邮件失败:', error);
    return {
      success: false,
      message: '发送邮件失败'
    };
  }
};