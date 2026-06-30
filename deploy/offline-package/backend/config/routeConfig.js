/**
 * 后端路由配置管理
 * 集中管理所有API路由前缀和初始化
 */

const routeConfig = {
  // 路由前缀定义
  prefixes: {
    health: '/health',
    printers: '/printers',
    settings: '/settings',
    reports: '/reports',
    auth: '/auth',
    users: '/users',
  },

  // 路由元数据 - 用于日志和监控
  routes: [
    {
      name: '健康检查',
      path: '/health',
      methods: ['GET'],
      public: true,
    },
    {
      name: '打印机管理',
      path: '/printers',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      public: false,
    },
    {
      name: '系统设置',
      path: '/settings',
      methods: ['GET', 'POST'],
      public: false,
    },
    {
      name: '报告生成',
      path: '/reports',
      methods: ['POST', 'GET'],
      public: false,
    },
    {
      name: '用户认证',
      path: '/auth',
      methods: ['POST'],
      public: true,
    },
    {
      name: '用户管理',
      path: '/users',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      public: false,
    },
  ],

  /**
   * 获取公开路由列表
   */
  getPublicRoutes() {
    return this.routes.filter(route => route.public);
  },

  /**
   * 获取受保护的路由列表
   */
  getProtectedRoutes() {
    return this.routes.filter(route => !route.public);
  },

  /**
   * 是否为公开路由
   */
  isPublicRoute(path) {
    return this.getPublicRoutes().some(route => path.includes(route.path));
  },

  /**
   * 打印所有路由信息
   */
  printRouteInfo() {
    console.log('\n========== 后端API路由信息 ==========');
    console.log('公开路由 (无需认证):');
    this.getPublicRoutes().forEach(route => {
      console.log(`  ✓ ${route.methods.join('|').padEnd(8)} /api${route.path} - ${route.name}`);
    });

    console.log('\n受保护路由 (需要认证):');
    this.getProtectedRoutes().forEach(route => {
      console.log(`  🔒 ${route.methods.join('|').padEnd(8)} /api${route.path} - ${route.name}`);
    });
    console.log('=====================================\n');
  },
};

module.exports = routeConfig;
