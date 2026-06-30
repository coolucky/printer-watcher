// 数据迁移脚本 - 统一 localStorage key 命名
(function() {
  'use strict';
  
  console.log('🔄 开始数据迁移...');
  
  // 迁移映射表
  const migrations = [
    {
      oldKey: 'computerDistData',
      newKey: 'computer-distribution-records',
      name: '电脑分发数据'
    },
    {
      oldKey: 'computerRecoveryData',
      newKey: 'computer-recovery-records',
      name: '电脑回收数据'
    },
    {
      oldKey: 'assetInventoryData',
      newKey: 'asset-inventory-data',
      name: '资产库存数据'
    }
  ];
  
  let migrationCount = 0;
  
  migrations.forEach(({ oldKey, newKey, name }) => {
    try {
      const oldData = localStorage.getItem(oldKey);
      const newData = localStorage.getItem(newKey);
      
      if (oldData && !newData) {
        // 场景1: 只有旧数据，迁移到新key
        localStorage.setItem(newKey, oldData);
        console.log(`✅ ${name} 已迁移: ${oldKey} → ${newKey}`);
        migrationCount++;
      } else if (oldData && newData) {
        // 场景2: 新旧数据都存在，保留新数据（因为代码已经在用新key）
        console.log(`⚠️ ${name} 检测到新旧数据共存，保留新key数据`);
        // 不做任何操作，保留新数据
      } else if (!oldData && !newData) {
        console.log(`ℹ️ ${name} 暂无数据`);
      } else {
        // 只有新数据
        console.log(`✓ ${name} 已使用新key`);
      }
    } catch (error) {
      console.error(`❌ 迁移 ${name} 失败:`, error);
    }
  });
  
  if (migrationCount > 0) {
    console.log(`🎉 数据迁移完成！共迁移 ${migrationCount} 项数据`);
  } else {
    console.log('✓ 数据检查完成');
  }
  
})();
