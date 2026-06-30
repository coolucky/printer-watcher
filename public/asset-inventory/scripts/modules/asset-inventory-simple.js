// 资产盘点模块 - 简化测试版
(function() {
  'use strict';
  
  console.log('📦 ========== 资产盘点模块（简化版）脚本已加载 ==========');
  
  // 加载资产盘点模块
  window.loadAssetInventoryModule = function(container) {
    console.log('📦 加载资产盘点模块（简化版）...');
    console.log('📦 接收到的容器参数:', container);
    
    const contentArea = container || document.getElementById('content-area');
    if (!contentArea) {
      console.error('❌ 找不到内容区域');
      console.log('尝试的容器:', container);
      console.log('document.getElementById("content-area"):', document.getElementById('content-area'));
      return;
    }
    
    console.log('✅ 找到内容区域，准备渲染...');
    
    contentArea.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <h1 style="color: #667eea; font-size: 48px; margin-bottom: 20px;">📦 资产盘点模块</h1>
        <p style="font-size: 18px; color: #666;">模块正在加载中...</p>
        <p style="font-size: 14px; color: #999; margin-top: 20px;">如果你看到这个消息，说明模块已经成功加载！</p>
        <p style="font-size: 12px; color: #aaa; margin-top: 10px;">容器 ID: ${contentArea.id || '无ID'}</p>
      </div>
    `;
    
    console.log('✅ 内容已渲染到容器');
  };

  console.log('✅ window.loadAssetInventoryModule 函数已定义（简化版）');
  console.log('✅ 资产盘点模块（简化版）加载完成');

})();
