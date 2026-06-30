// ============================================
// Asset Inventory Tool - 主应用脚本
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 DOMContentLoaded 触发');
  
  loadAssetInventory();
  
  // 延迟初始化数据管理器
  setTimeout(() => {
    if (window.DataManager) {
      console.log('🚀 初始化数据管理器...');
      window.DataManager.init();
    }
  }, 100);
});

// ============================================
// 加载 Asset Inventory 模块
// ============================================
function loadAssetInventory() {
  const contentBody = document.getElementById('content-body');
  const moduleTitle = document.getElementById('module-title');
  
  if (moduleTitle) {
    moduleTitle.textContent = 'Asset Inventory Management';
  }
  
  // 重置到步骤0 - 仅在没有活跃会话时重置
  if (window.assetInventoryData && !localStorage.getItem('assetInventorySessionId')) {
    window.assetInventoryData.currentStep = 0;
    localStorage.setItem('assetInventoryData', JSON.stringify(window.assetInventoryData));
  }
  
  if (typeof window.loadAssetInventoryModule === 'function') {
    window.loadAssetInventoryModule(contentBody);
  } else {
    console.error('资产盘点模块未加载');
    contentBody.innerHTML = `
      <div class="card">
        <div class="card-title">⚠️ 模块加载失败</div>
        <p style="color: #ef4444; padding: 20px;">资产盘点模块未正确加载,请刷新页面重试</p>
      </div>
    `;
  }
}

// ============================================
// 通知系统
// ============================================
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  if (!notification) return;
  
  const icon = notification.querySelector('.notification-icon');
  const messageEl = notification.querySelector('.notification-message');
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  icon.textContent = icons[type] || icons.info;
  messageEl.textContent = message;
  
  notification.classList.remove('success', 'error', 'warning', 'info');
  notification.classList.add(type, 'show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

window.showNotification = showNotification;
window.loadAssetInventory = loadAssetInventory;
