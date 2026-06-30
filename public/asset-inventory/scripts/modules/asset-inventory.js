// Asset Inventory Management Module
(function() {
  'use strict';
  
  console.log('📦 ========== Asset Inventory Module Script Loaded ==========');
  
  // 音效文件路径 (使用 Web Audio API 生成)
  let audioContext;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('✅ Audio Context 创建成功');
  } catch (e) {
    console.error('❌ Audio Context 创建失败:', e);
    audioContext = null;
  }
  
  // 从 localStorage 恢复数据或初始化新数据
  function initializeData() {
    try {
      const savedData = localStorage.getItem('assetInventoryData');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        console.log('📂 从本地存储恢复盘点数据:', parsed);
        
        // 数据迁移: 如果没有 inventoryMode 字段,说明是旧版本数据
        if (parsed.inventoryMode === undefined) {
          console.log('🔄 检测到旧版本数据,正在迁移...');
          parsed.inventoryMode = null;
          parsed.currentStep = 0; // 重置到步骤0让用户选择模式
          console.log('✅ 数据迁移完成');
        }
        
        // 数据迁移: 确保 locationMismatches 字段存在
        if (!parsed.locationMismatches) {
          console.log('🔄 添加 locationMismatches 字段');
          parsed.locationMismatches = [];
        }
        
        // 🆕 数据迁移: 修复旧格式的位置差异数据
        if (parsed.locationMismatches && parsed.locationMismatches.length > 0) {
          console.log('🔄 检查位置差异数据格式...');
          let needsMigration = false;
          
          // 检查是否有旧格式数据（包含 'Serial Number' 而不是 'serialNumber'）
          parsed.locationMismatches = parsed.locationMismatches.map(item => {
            if (item['Serial Number'] && !item.serialNumber) {
              needsMigration = true;
              console.log('🔄 迁移位置差异记录:', item['Serial Number']);
              return {
                serialNumber: item['Serial Number'] || 'N/A',
                assetTag: item['Asset Tag'] || 'N/A',
                model: item['Model'] || 'N/A',
                actualLocation: item._currentLocation || item.actualLocation || 'N/A',
                systemLocation: item._originalLocation || item.systemLocation || item['Grid Reference'] || 'N/A',
                inventoryPerson: item._inventoryPerson || item.inventoryPerson || 'N/A',
                scanTime: item.scanTime || item._scannedTime || new Date().toISOString()
              };
            }
            return item;
          });
          
          if (needsMigration) {
            console.log('✅ 位置差异数据迁移完成');
          }
        }
        
        return parsed;
      }
    } catch (e) {
      console.warn('⚠️ 无法恢复本地盘点数据:', e);
    }
    
    // 返回默认数据
    return {
      currentStep: 0,           // 从步骤0开始 - 选择盘点模式
      inventoryMode: null,      // 盘点模式: 'warehouse'(库房) 或 'inuse'(现役)
      inventoryPerson: '',      // 当前盘点人姓名(兼容旧版)
      inventoryPersonList: [],  // 盘点人员列表(支持多人)
      currentInventoryPerson: '', // 当前正在盘点的人
      baselineData: [],        // 基准数据(上传的表格)
      scannedAssets: [],        // 已扫描的资产
      notFoundAssets: [],       // 扫描到但不在基准表中的资产
      locationMismatches: [],   // 位置差异的资产
      scanHistory: [],          // 扫描历史记录
      inventoryStartTime: null, // 盘点开始时间
      inventoryEndTime: null,   // 盘点结束时间
      inUseLocationPresetEnabled: false, // 现役盘点-位置预设功能开关
      selectedPresetLocation: null  // 当前选择的预设位置(房间)
    };
  }
  
  // 保存数据到 localStorage
  function saveData() {
    try {
      localStorage.setItem('assetInventoryData', JSON.stringify(window.assetInventoryData));
      console.log('💾 盘点数据已保存到本地存储');
    } catch (e) {
      console.warn('⚠️ 无法保存盘点数据到本地存储:', e);
    }
  }

  // 灵活获取字段值的辅助函数 - 尝试多种可能的列名
  function getFieldValue(asset, ...possibleKeys) {
    for (let key of possibleKeys) {
      if (asset[key] && asset[key] !== 'undefined' && asset[key] !== 'null') {
        return asset[key];
      }
    }
    return 'N/A';
  }

  // 根据序列号或资产标签查找资产
  function findAssetBySerialOrTag(code) {
    if (!code || !assetInventoryData.baselineData) return null;
    
    const trimmedCode = String(code).trim().toUpperCase();
    
    return assetInventoryData.baselineData.find(asset => {
      const serialNumber = getFieldValue(asset, 'Serial Number', '序列号', 'SN', 'SerialNumber');
      const assetTag = getFieldValue(asset, 'Asset Tag', '资产标签', 'AssetTag', 'Tag');
      
      return String(serialNumber).trim().toUpperCase() === trimmedCode ||
             String(assetTag).trim().toUpperCase() === trimmedCode;
    });
  }
  
  // 使用全局变量保存数据
  if (!window.assetInventoryData) {
    window.assetInventoryData = initializeData();
  }
  
  // 引用全局数据
  let assetInventoryData = window.assetInventoryData;
  
  // SN修正开关状态 (去除首字符)
  let snRemoveFirstCharEnabled = false;

  // MTR 会议室列表 (现役盘点-位置预设)
  // Beijing 会议室列表
  const MTR_ROOM_LIST = [
    'IT Lab (Beijing)',
    'Palace (Beijing)',
    'Greatwall (Beijing)',
    'Lane (Beijing)',
    'Tower (Beijing)',
    'Path (Beijing)',
    'Spring (Beijing)',
    'River (Beijing)',
    'Moon (Beijing)',
    'Temple (Beijing)',
    'Sunset (Beijing)',
    'F3 (Beijing)',
    'Pass (Beijing)',
    'Snow (Beijing)',
    'Mountain (Beijing)',
    'Peak (Beijing)',
    'Gateway (Beijing)',
    'City (Beijing)',
    'Situation Room (Beijing)',
    'Platform (Beijing)',
    'Emperor (Beijing)',
    'Townhall (Beijing)',
    'Bridge (Beijing)',
    'Adventure (Beijing)',
    'Mount (Beijing)',
    'Boat (Beijing)',
    'TPX-SITE OPERATIONS (Beijing)',
    'Operation (Beijing)',
    'Reception (Beijing)',
    'Security (Beijing)'
  ].sort(); // 按字母顺序排序，方便查找
  
  // Shanghai 会议室列表
  const SHANGHAI_ROOM_LIST = [
    'bytheriver (Shanghai)',
    'BreakRM (Shanghai)',
    'GALAXY (Shanghai)',
    'LSR (Shanghai)',
    'FIRMAMENT (Shanghai)',
    'BLOSSOMS (Shanghai)',
    'SRE (Shanghai)',
    'AnDingLane (Shanghai)',
    'JianYeLane (Shanghai)',
    'HuaiHaiLane (Shanghai)',
    'SituationRoom (Shanghai)',
    'WarRoon (Shanghai)',
    'Monitorning (Shanghai)',
    'ShanghaiBund (Shanghai)',
    'Gardenbridge (Shanghai)',
    'IT LAB (Shanghai)',
    'Security (Shanghai)'
  ].sort(); // 按字母顺序排序，方便查找

  // 全局变量存储已加载的声音列表
  let voicesLoaded = false;
  let availableVoices = [];

  // 初始化语音系统 - 预加载声音列表
  function initVoiceSystem() {
    if ('speechSynthesis' in window) {
      // 获取声音列表
      const loadVoices = () => {
        availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          voicesLoaded = true;
          console.log('🔊 语音系统已初始化，可用声音数量:', availableVoices.length);
          console.log('🔊 可用女性英文声音:', availableVoices.filter(v => 
            (v.lang.startsWith('en') || v.lang.startsWith('zh-TW')) && 
            (v.name.includes('female') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Mei-Jia') || v.name.includes('Ting-Ting'))
          ).map(v => v.name));
        }
      };

      // 立即尝试加载
      loadVoices();

      // 监听声音列表变化（某些浏览器需要异步加载）
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }

      // 如果2秒后还没加载，强制重新获取
      setTimeout(() => {
        if (!voicesLoaded || availableVoices.length === 0) {
          loadVoices();
        }
      }, 2000);
    }
  }

  // 初始化语音系统（页面加载时预加载声音列表）
  initVoiceSystem();

  // HTML转义函数
  function escapeHtml(str) {
    if (!str) return str;
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // 转义 HTML 属性值（只转义引号）
  function escapeAttr(str) {
    if (!str) return str;
    return String(str)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 播放成功音效
  function playSuccessSound() {
    if (!audioContext) return;
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 880; // A5 - 高音
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      console.warn('播放音效失败:', e);
    }
  }

  // 播放错误音效
  function playErrorSound() {
    if (!audioContext) return;
    try {
      // 第一个音符
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);
      
      oscillator1.frequency.value = 200; // 低音
      oscillator1.type = 'sawtooth';
      
      gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.1);
      
      // 第二个音符
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.frequency.value = 200;
      oscillator2.type = 'sawtooth';
      
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.15);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
      
      oscillator2.start(audioContext.currentTime + 0.15);
      oscillator2.stop(audioContext.currentTime + 0.25);
    } catch (e) {
      console.warn('播放音效失败:', e);
    }
  }

  // 播放重复音效
  function playDuplicateSound() {
    if (!audioContext) return;
    try {
      // 第一个音符
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);
      
      oscillator1.frequency.value = 440; // A4 - 中音
      oscillator1.type = 'square';
      
      gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.1);
      
      // 第二个音符
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.frequency.value = 440;
      oscillator2.type = 'square';
      
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.12);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.22);
      
      oscillator2.start(audioContext.currentTime + 0.12);
      oscillator2.stop(audioContext.currentTime + 0.22);
    } catch (e) {
      console.warn('播放音效失败:', e);
    }
  }

  // 播放完成音效
  // 播放完成音效
  function playCompleteSound() {
    if (!audioContext) return;
    try {
      const frequencies = [523, 659, 784, 1047]; // C-E-G-C 和弦
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = freq;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
        }, index * 100);
      });
    } catch (e) {
      console.warn('播放音效失败:', e);
    }
  }

  // 播放铃声音效(用于确认选择)
  function playBellSound() {
    if (!audioContext) return;
    try {
      // C6 (1047Hz) 和 E6 (1319Hz) 和弦铃声
      const frequencies = [1047, 1319];
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + index * 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.05 + 0.2);
        
        oscillator.start(audioContext.currentTime + index * 0.05);
        oscillator.stop(audioContext.currentTime + index * 0.05 + 0.2);
      });
    } catch (e) {
      console.warn('播放音效失败:', e);
    }
  }

  // 通用播放音效函数
  function playTone(frequency, duration, type = 'sine') {
    if (!audioContext) return;
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.warn('播放音效失败:', e);
    }
  }

  // 播放语音提示(使用Web Speech API)
  function playVoice(text) {
    try {
      if ('speechSynthesis' in window) {
        // 如果声音列表还没加载，先加载
        if (!voicesLoaded || availableVoices.length === 0) {
          availableVoices = window.speechSynthesis.getVoices();
          if (availableVoices.length > 0) {
            voicesLoaded = true;
          }
        }

        // 停止之前的语音
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // 获取当前语言设置，翻译中文文本为英文
        const currentLang = window.assetInventoryI18n?.getCurrentLanguage() || 'zh-CN';
        
        // 语音提示映射表（中文 -> 英文）
        const voiceMap = {
          '重复扫描': 'Duplicate scan',
          '设备差异': 'Device discrepancy',
          '位置差异': 'Location discrepancy',
          '扫码错误': 'Scan error',
          '请手动输入位置': 'Please enter location manually',
          '盘点数据已重置': 'Inventory data has been reset'
        };
        
        // 如果是中文文本且有映射，使用英文
        const voiceText = voiceMap[text] || text;
        utterance.text = voiceText;
        
        // 设置为英文台湾女性声音
        utterance.lang = 'zh-TW'; // 台湾中文语言代码
        utterance.rate = 1.1; // 语速适中
        utterance.pitch = 1.1; // 音调稍高（女性声音）
        utterance.volume = 1.0;
        
        // 优先选择台湾女性英文声音
        const preferredVoices = [
          'Mei-Jia',           // macOS 台湾女性声音
          'Ting-Ting',         // macOS 台湾女性声音
          'Samantha',          // macOS 美式女性英文声音
          'Karen',             // macOS 澳洲女性英文声音
          'Google US English', // Chrome 美式女性英文
          'Microsoft Zira'     // Windows 美式女性英文
        ];
        
        // 查找匹配的声音（使用缓存的声音列表）
        for (const voiceName of preferredVoices) {
          const voice = availableVoices.find(v => 
            v.name.includes(voiceName) || 
            v.name.toLowerCase().includes(voiceName.toLowerCase())
          );
          if (voice) {
            utterance.voice = voice;
            console.log('🔊 使用语音:', voice.name);
            break;
          }
        }
        
        // 如果没找到特定声音，使用英文女性声音
        if (!utterance.voice) {
          const femaleEnglishVoice = availableVoices.find(v => 
            (v.lang.startsWith('en') || v.lang.startsWith('zh-TW')) && 
            v.name.toLowerCase().includes('female')
          );
          if (femaleEnglishVoice) {
            utterance.voice = femaleEnglishVoice;
          }
        }
        
        window.speechSynthesis.speak(utterance);
        console.log('🔊 播放语音:', voiceText, '(原文:', text, ')');
      } else {
        console.warn('浏览器不支持语音合成');
      }
    } catch (e) {
      console.warn('播放语音失败:', e);
    }
  }

  // 更新统计信息
  function updateStats() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    const statsContainer = document.getElementById('inventory-stats-container');
    if (!statsContainer) return;
    
    const totalBaseline = assetInventoryData.baselineData.length;
    const totalScanned = assetInventoryData.scannedAssets.length;
    const scanProgress = totalBaseline > 0 ? Math.round((totalScanned / totalBaseline) * 100) : 0;
    
    statsContainer.innerHTML = `
      <div style="background: var(--background-paper, #ffffff); border: 1px solid var(--border-color, #e2e8f0); padding: 8px 14px; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px;">
          <div style="text-align: center; padding: 6px 8px; background: var(--background-secondary, #f8fafc); border-radius: 6px;">
            <div style="font-size: 24px; font-weight: 700; color: #1976d2;">${totalBaseline}</div>
            <div style="font-size: 14px; color: var(--text-secondary, #64748b); font-weight: 500;">${t('stats.baseline')}</div>
          </div>
          <div style="text-align: center; padding: 6px 8px; background: var(--background-secondary, #f8fafc); border-radius: 6px;">
            <div style="font-size: 24px; font-weight: 700; color: #7c3aed;">${totalScanned}</div>
            <div style="font-size: 14px; color: var(--text-secondary, #64748b); font-weight: 500;">${t('stats.scanned')}</div>
          </div>
          <div style="text-align: center; padding: 6px 8px; background: var(--background-secondary, #f8fafc); border-radius: 6px;">
            <div style="font-size: 24px; font-weight: 700; color: ${scanProgress >= 100 ? '#10b981' : '#f59e0b'};">${scanProgress}%</div>
            <div style="font-size: 14px; color: var(--text-secondary, #64748b); font-weight: 500;">${t('stats.progress')}</div>
          </div>
          <div style="text-align: center; padding: 6px 8px; background: var(--background-secondary, #f8fafc); border-radius: 6px;">
            <div style="font-size: 24px; font-weight: 700; color: ${totalBaseline - totalScanned > 0 ? '#ef4444' : '#10b981'};">${totalBaseline - totalScanned}</div>
            <div style="font-size: 14px; color: var(--text-secondary, #64748b); font-weight: 500;">${t('stats.not_inventoried')}</div>
          </div>
        </div>
      </div>
    `;
  }

  // 获取所有可用的Grid Reference选项 - 固定列表
  function getAvailableGridReferences(filterLocation) {
    const gridReferences = [];
    
    // 获取当前session的location（从session名称推断）
    const sessionLocation = filterLocation || getSessionLocation();
    
    // Beijing 货架位置 (A1-K4)
    if (!sessionLocation || sessionLocation === 'Beijing') {
      const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
      const levels = [1, 2, 3, 4];
      
      columns.forEach(col => {
        levels.forEach(level => {
          gridReferences.push({
            value: `${col}${level}`,
            label: `${col}${level}`,
            city: 'Beijing'
          });
        });
      });
      
      gridReferences.push({
        value: 'WAREHOUSE',
        label: 'WAREHOUSE',
        city: 'Beijing'
      });
    }
    
    // Shanghai 货架位置
    if (!sessionLocation || sessionLocation === 'Shanghai') {
      for (let i = 1; i <= 3; i++) {
        gridReferences.push({ value: `N${i}`, label: `N${i}`, city: 'Shanghai' });
      }
      for (let i = 1; i <= 4; i++) {
        gridReferences.push({ value: `S${i}`, label: `S${i}`, city: 'Shanghai' });
      }
      for (let i = 1; i <= 5; i++) {
        gridReferences.push({ value: `M${i}`, label: `M${i}`, city: 'Shanghai' });
      }
      gridReferences.push({ value: 'Q1', label: 'Q1', city: 'Shanghai' });
      gridReferences.push({ value: 'P1', label: 'P1', city: 'Shanghai' });
    }
    
    return gridReferences;
  }

  // 从session名称推断location
  function getSessionLocation() {
    try {
      const sm = window.assetInventorySessionManager;
      if (!sm) return null;
      const sessionId = sm.getCurrentSessionId();
      if (!sessionId) return null;
      // 从 localStorage 获取 session 列表缓存
      const sessionsCache = localStorage.getItem('assetInventorySessions');
      if (sessionsCache) {
        const sessions = JSON.parse(sessionsCache);
        const current = sessions.find(s => s.id === sessionId);
        if (current && current.name) {
          if (current.name.includes('Beijing') || current.name.includes('北京')) return 'Beijing';
          if (current.name.includes('Shanghai') || current.name.includes('上海')) return 'Shanghai';
          if (current.name.includes('Shenzhen') || current.name.includes('深圳')) return 'Shenzhen';
        }
      }
    } catch(e) {}
    return null;
  }

  // 渲染可搜索的货架位置 Combobox
  function renderGridCombobox(availableGrids) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    return `
      <div id="grid-combobox-wrapper" style="position: relative; width: 100%; margin-bottom: 10px;">
        <input 
          type="text" 
          id="current-grid-reference"
          placeholder="${t('scan.grid_search_placeholder') || '输入或选择货架位置...'}"
          style="width: 100%; padding: 12px 40px 12px 16px; border: 2px solid white; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center; text-transform: uppercase; background: white; color: #1e293b; cursor: text;"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          onfocus="openGridDropdown()"
          oninput="filterGridOptions(this.value)"
          onkeydown="handleGridComboKeydown(event)"
        >
        <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #94a3b8; font-size: 14px;">▼</div>
        <div id="grid-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: white; border: 2px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.15);">
        </div>
      </div>
    `;
  }

  // 显示Grid Reference输入对话框
  function showGridReferenceDialog(scannedValue, defaultGrid, callback) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    // 转义参数
    const escapedScannedValue = escapeHtml(scannedValue);
    const escapedDefaultGrid = escapeHtml(defaultGrid);
    const displayGrid = escapedDefaultGrid || '未设置';
    
    // 获取所有可用的Grid Reference选项
    const availableGrids = getAvailableGridReferences();
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 0;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease-out;
    `;
    
    dialog.innerHTML = `
      <style>
        @keyframes slideIn {
          from { transform: translateY(-50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
      <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 12px 12px 0 0;">
        <div style="font-size: 22px; font-weight: 600; margin-bottom: 4px;">${t('notfound.not_in_baseline')}</div>
        <div style="font-size: 13px; opacity: 0.9;">${t('notfound.dialog_subtitle')}</div>
      </div>
      <div style="padding: 24px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-weight: 600; color: #475569; margin-bottom: 8px; font-size: 13px;">
            ${t('notfound.grid_scanned_label')} <span style="font-size: 11px; font-weight: 400; color: #94a3b8;">(${t('notfound.grid_editable')})</span>
          </label>
          <input type="text" id="scanned-value-input" 
                 value="${escapedScannedValue}"
                 style="width: 100%; padding: 12px 14px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; font-family: monospace; transition: border-color 0.2s; background: white;"
                 placeholder="${t('notfound.grid_scanned_placeholder')}">
          <div style="font-size: 11px; color: #64748b; margin-top: 6px;">${t('notfound.grid_edit_hint')}</div>
        </div>
        
        <div style="background: #f8fafc; border-left: 3px solid #4f46e5; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
          <div style="font-weight: 600; color: #475569; margin-bottom: 6px; font-size: 13px;">${t('notfound.grid_current_location')}</div>
          <div style="color: #4f46e5; font-family: monospace; font-size: 15px; font-weight: 500;">${displayGrid}</div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; color: #1e293b; margin-bottom: 8px; font-size: 13px;">
            ${t('notfound.grid_label')}
          </label>
          <select id="grid-ref-input" 
                 style="width: 100%; padding: 12px 14px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; font-family: monospace; text-transform: uppercase; transition: border-color 0.2s; background: white; cursor: pointer;">
            <option value="">${t('notfound.grid_placeholder')}</option>
            ${availableGrids.map(grid => `
              <option value="${escapeHtml(grid.value)}" ${grid.value === escapedDefaultGrid ? 'selected' : ''}>
                ${escapeHtml(grid.label)}
              </option>
            `).join('')}
            <option value="__CUSTOM__">✏️ 手动输入其他位置...</option>
          </select>
          <input type="text" id="grid-ref-custom-input" 
                 style="width: 100%; padding: 12px 14px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; font-family: monospace; text-transform: uppercase; transition: border-color 0.2s; margin-top: 10px; display: none;"
                 placeholder="输入自定义 Grid Reference...">
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button id="grid-ref-cancel" style="flex: 1; padding: 12px; background: white; color: #64748b; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; cursor: pointer; font-weight: 600; transition: all 0.2s;">
            取消
          </button>
          <button id="grid-ref-confirm" style="flex: 1; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; font-weight: 600; transition: all 0.2s;">
            确认
          </button>
        </div>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    const scannedValueInput = dialog.querySelector('#scanned-value-input');
    const selectInput = dialog.querySelector('#grid-ref-input');
    const customInput = dialog.querySelector('#grid-ref-custom-input');
    const cancelBtn = dialog.querySelector('#grid-ref-cancel');
    const confirmBtn = dialog.querySelector('#grid-ref-confirm');
    
    // 处理选择框变化 - 显示/隐藏自定义输入框
    selectInput.onchange = () => {
      if (selectInput.value === '__CUSTOM__') {
        customInput.style.display = 'block';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
      }
    };
    
    // 添加按钮悬停效果
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.background = '#f8fafc';
      cancelBtn.style.borderColor = '#cbd5e1';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.background = 'white';
      cancelBtn.style.borderColor = '#e2e8f0';
    };
    
    confirmBtn.onmouseenter = () => {
      confirmBtn.style.background = '#059669';
    };
    confirmBtn.onmouseleave = () => {
      confirmBtn.style.background = '#10b981';
    };
    
    // 输入框聚焦效果
    scannedValueInput.onfocus = () => {
      scannedValueInput.style.borderColor = '#4f46e5';
    };
    scannedValueInput.onblur = () => {
      scannedValueInput.style.borderColor = '#e2e8f0';
    };
    
    selectInput.onfocus = () => {
      selectInput.style.borderColor = '#4f46e5';
    };
    selectInput.onblur = () => {
      selectInput.style.borderColor = '#e2e8f0';
    };
    
    customInput.onfocus = () => {
      customInput.style.borderColor = '#4f46e5';
    };
    customInput.onblur = () => {
      customInput.style.borderColor = '#e2e8f0';
    };
    
    // 聚焦选择框
    setTimeout(() => {
      selectInput.focus();
    }, 100);
    
    // 关闭对话框
    const closeDialog = () => {
      overlay.remove();
    };
    
    // 取消按钮
    cancelBtn.onclick = () => {
      closeDialog();
      callback(null);
    };
    
    // 确认按钮
    confirmBtn.onclick = () => {
      // 获取修改后的扫描值
      const finalScannedValue = scannedValueInput.value.trim();
      if (!finalScannedValue) {
        scannedValueInput.style.borderColor = '#ef4444';
        scannedValueInput.focus();
        return;
      }
      
      let gridValue = '';
      
      if (selectInput.value === '__CUSTOM__') {
        // 使用自定义输入
        gridValue = customInput.value.trim().toUpperCase();
        if (!gridValue) {
          customInput.style.borderColor = '#ef4444';
          customInput.focus();
          return;
        }
      } else {
        // 使用选择的值
        gridValue = selectInput.value.trim().toUpperCase();
        if (!gridValue) {
          selectInput.style.borderColor = '#ef4444';
          selectInput.focus();
          return;
        }
      }
      
      closeDialog();
      // 返回对象包含修改后的扫描值和Grid Reference
      callback({
        scannedValue: finalScannedValue,
        gridReference: gridValue
      });
    };
    
    // 回车键确认,但禁用ESC键关闭
    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      }
      // ESC键不再触发取消,强制用户点击按钮
    };
    
    selectInput.onkeydown = handleKeydown;
    customInput.onkeydown = handleKeydown;
    
    // 🚫 禁止点击遮罩层关闭对话框 - 必须点击取消或确认按钮
    // 移除了遮罩层的点击关闭功能,强制用户做出明确选择
  }

  console.log('🔧 准备定义 loadAssetInventoryModule 函数...');

  // ============================================
  // Step Gate Guards - 步骤门控
  // ============================================
  function hasActiveSession() {
    return !!localStorage.getItem('assetInventorySessionId');
  }

  function canProceedToStep(targetStep) {
    if (targetStep <= 0) return true; // Step 0 (create task) always accessible
    if (!hasActiveSession()) return false;
    if (targetStep === 1) return true; // Step 1 (select mode) just needs session
    if (targetStep === 2) return !!assetInventoryData.inventoryMode;
    if (targetStep === 3) return !!assetInventoryData.inventoryMode && Array.isArray(assetInventoryData.baselineData) && assetInventoryData.baselineData.length > 0;
    if (targetStep === 4) return canProceedToStep(3) && Array.isArray(assetInventoryData.scannedAssets) && assetInventoryData.scannedAssets.length > 0;
    return false;
  }

  function getStepBlockReason(targetStep) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    if (targetStep >= 1 && !hasActiveSession()) return t('gate.noSession') || 'Please create an inventory task first';
    if (targetStep === 2 && !assetInventoryData.inventoryMode) return t('gate.noMode') || 'Please select inventory mode first';
    if (targetStep === 3 && (!assetInventoryData.baselineData || assetInventoryData.baselineData.length === 0)) return t('gate.noBaseline') || 'Please upload baseline data first';
    if (targetStep === 4 && (!assetInventoryData.scannedAssets || assetInventoryData.scannedAssets.length === 0)) return t('gate.noScan') || 'Please scan at least one asset first';
    return '';
  }

  function renderStepIndicatorHTML(activeStep) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    const modeText = assetInventoryData.inventoryMode === 'warehouse' ? t('mode.warehouse') :
                     assetInventoryData.inventoryMode === 'inuse' ? t('mode.inuse') : t('step.mode');
    const steps = [
      { num: 0, label: t('session.create') || 'New Task', fn: '_stepCreateTask' },
      { num: 1, label: activeStep > 1 ? modeText : t('step.mode'), fn: 'inventoryRenderStep0' },
      { num: 2, label: t('step.upload'), fn: 'inventoryRenderStep1' },
      { num: 3, label: t('step.scan'), fn: 'inventoryRenderStep2' },
      { num: 4, label: t('step.report'), fn: 'inventoryRenderStep3' },
    ];
    return `<div class="step-indicator-horizontal">${steps.map(s => {
      const isActive = s.num === activeStep;
      const isCompleted = s.num < activeStep;
      const canGo = canProceedToStep(s.num);
      const locked = !isActive && !isCompleted && !canGo;
      const clickAttr = locked
        ? `onclick="alert('${getStepBlockReason(s.num).replace(/'/g, "\\'")}')" title="${getStepBlockReason(s.num)}"`
        : isActive
          ? ''
          : `onclick="${s.fn}()" style="cursor:pointer;"`;
      const cls = isActive ? 'active' : isCompleted ? 'completed' : locked ? 'locked' : '';
      const num = isCompleted ? '✓' : isActive && s.num === 4 ? '📊' : s.num;
      return `<div class="step-item ${cls}" ${clickAttr}>
        <div class="step-num">${num}</div>
        <div class="step-text">${s.label}</div>
        ${locked ? '<div style="font-size:10px;color:#94a3b8;">🔒</div>' : ''}
      </div>`;
    }).join('')}</div>`;
  }

  // Step 0 action: create task inline
  window._stepCreateTask = function() {
    if (window._sessionCreateInline) {
      window._sessionCreateInline();
    } else if (window._sessionCreate) {
      window._sessionCreate();
    } else if (window.showSessionManager) {
      window.showSessionManager();
    }
  };

  function renderNoSessionEmptyState() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;">
        <div style="width:72px;height:72px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
          <span style="font-size:32px;">📋</span>
        </div>
        <h3 style="color:#1e293b;font-size:18px;margin-bottom:8px;">${t('session.empty') || 'No active inventory task'}</h3>
        <p style="color:#64748b;font-size:14px;max-width:360px;margin-bottom:20px;">
          ${t('gate.noSession') || 'Click "New Task" above or the button below to create a task'}
        </p>
        <button onclick="window._stepCreateTask()" style="
          padding:10px 20px;border:none;border-radius:8px;
          background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;
          font-size:14px;font-weight:600;cursor:pointer;
          box-shadow:0 4px 12px rgba(59,130,246,0.3);transition:all 0.2s;
        " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
          ➕ ${t('session.create') || 'New Inventory Task'}
        </button>
      </div>
    `;
  }

  // 语言切换函数
  window.toggleInventoryLanguage = function() {
    if (!window.assetInventoryI18n) {
      console.error('❌ i18n 模块未加载');
      alert('语言切换功能暂不可用');
      return;
    }
    
    const currentLang = window.assetInventoryI18n.getCurrentLanguage();
    const newLang = currentLang === 'zh-CN' ? 'en-US' : 'zh-CN';
    
    window.assetInventoryI18n.setLanguage(newLang);
    console.log('🌐 语言已切换:', currentLang, '→', newLang);
    
    // 重新加载模块以应用新语言
    window.loadAssetInventoryModule();
  };

  // Load Asset Inventory Module
  window.loadAssetInventoryModule = function(container) {
    console.log('📦 Loading Asset Inventory Module...');
    console.log('📦 Received container parameter:', container);
    
    // 重新同步本地引用（session切换后window.assetInventoryData可能已更新）
    assetInventoryData = window.assetInventoryData;
    
    // 尝试多种方式获取内容区域
    let contentArea = container;
    if (!contentArea) {
      // 尝试通过 ID 查找
      contentArea = document.getElementById('content-body');
      if (!contentArea) {
        contentArea = document.getElementById('content-area');
      }
      if (!contentArea) {
        // 尝试通过 class 查找
        contentArea = document.querySelector('.content-body');
      }
    }
    
    if (!contentArea) {
      console.error('❌ 找不到内容区域');
      return;
    }
    
    console.log('✅ 找到内容区域，ID:', contentArea.id || contentArea.className);
    
    const currentLang = window.assetInventoryI18n?.getCurrentLanguage() || 'zh-CN';
    const langButtonText = currentLang === 'zh-CN' ? 'English' : '中文';
    
    contentArea.innerHTML = `
      <div class="inventory-module">
        <div id="inventory-stats-container"></div>
        <div id="step-indicator-horizontal"></div>
        <div id="inventory-upload-section"></div>
        <div id="inventory-scan-section"></div>
        <div id="inventory-result-section"></div>
      </div>
    `;
    
    // Gate: 无 session 时直接弹出新建任务表单
    if (!hasActiveSession()) {
      // 渲染步骤指示器，Step 0 高亮
      const stepIndicator = document.getElementById('step-indicator-horizontal');
      if (stepIndicator) stepIndicator.innerHTML = renderStepIndicatorHTML(0);
      // 自动触发新建任务表单（等 session-manager 初始化完成）
      setTimeout(() => {
        if (window._sessionCreateInline) {
          window._sessionCreateInline();
        } else if (window._sessionCreate) {
          window._sessionCreate();
        }
      }, 100);
      return;
    }

    // 根据当前步骤渲染对应界面
    if (assetInventoryData.currentStep === 0) {
      inventoryRenderStep0();
    } else if (assetInventoryData.currentStep === 1) {
      inventoryRenderStep1();
    } else if (assetInventoryData.currentStep === 2) {
      inventoryRenderStep2();
    } else if (assetInventoryData.currentStep === 3) {
      inventoryRenderStep3();
    } else {
      // 默认进入步骤0 - 选择盘点模式
      inventoryRenderStep0();
    }
    
    updateStats();
    

  };

  console.log('✅ window.loadAssetInventoryModule 函数已定义');

  // 重置盘点数据
  window.resetInventoryData = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    if (confirm(t('reset.confirm'))) {
      window.assetInventoryData = {
        currentStep: 0,
        inventoryMode: null,
        baselineData: [],
        scannedAssets: [],
        notFoundAssets: [],
        locationMismatches: [],    // 添加位置差异字段
        scanHistory: [],
        inventoryStartTime: null,
        inventoryEndTime: null
      };
      assetInventoryData = window.assetInventoryData;
      saveData();
      console.log('✅ Asset Inventory Data Reset');
      window.loadAssetInventoryModule();
    }
  };

  // 渲染步骤0 - 选择盘点模式 (显示为 Step 1 in indicator)
  window.inventoryRenderStep0 = function() {
    // Gate: 必须有 session
    if (!hasActiveSession()) {
      window.loadAssetInventoryModule();
      return;
    }
    assetInventoryData.currentStep = 0;
    saveData();
    
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    const stepIndicator = document.getElementById('step-indicator-horizontal');
    if (stepIndicator) {
      stepIndicator.innerHTML = renderStepIndicatorHTML(1);
    }
    
    const uploadSection = document.getElementById('inventory-upload-section');
    if (uploadSection) {
      uploadSection.innerHTML = `
        <div style="max-width: 1200px; margin: 12px auto; padding: 0 16px;">
          <div style="text-align: center; margin-bottom: 12px;">
            <h2 style="color: var(--text-primary, #1e293b); font-size: 20px; margin-bottom: 4px; font-weight: 700;">
              ${t('mode.select.title')}
            </h2>
            <p style="color: var(--text-secondary, #64748b); font-size: 14px; margin: 0;">
              ${t('mode.select.subtitle')}
            </p>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- 库房盘点 -->
            <div onclick="selectInventoryMode('warehouse')" style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 18px 20px;
              cursor: pointer;
              transition: all 0.3s;
              box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
            " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 32px rgba(102, 126, 234, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 24px rgba(102, 126, 234, 0.3)';">
              <div style="text-align: center;">
                <div style="font-size: 36px; margin-bottom: 6px;">📦</div>
                <h3 style="color: white; font-size: 17px; margin-bottom: 6px; font-weight: 700;">
                  ${t('mode.warehouse')}
                </h3>
                <p style="color: rgba(255, 255, 255, 0.9); font-size: 13px; line-height: 1.5; margin-bottom: 10px;">
                  ${t('mode.warehouse.desc')}
                </p>
                <div style="background: rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 8px 10px; margin-top: 8px;">
                  <div style="color: white; font-size: 12px; text-align: left; line-height: 1.6;">
                    ✓ ${t('mode.warehouse.feature1')}<br/>
                    ✓ ${t('mode.warehouse.feature2')}<br/>
                    ✓ ${t('mode.warehouse.feature3')}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 现役盘点 -->
            <div onclick="selectInventoryMode('inuse')" style="
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              border-radius: 12px;
              padding: 18px 20px;
              cursor: pointer;
              transition: all 0.3s;
              box-shadow: 0 8px 24px rgba(240, 147, 251, 0.3);
            " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 32px rgba(240, 147, 251, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 24px rgba(240, 147, 251, 0.3)';">
              <div style="text-align: center;">
                <div style="font-size: 36px; margin-bottom: 6px;">💼</div>
                <h3 style="color: white; font-size: 17px; margin-bottom: 6px; font-weight: 700;">
                  ${t('mode.inuse')}
                </h3>
                <p style="color: rgba(255, 255, 255, 0.9); font-size: 13px; line-height: 1.5; margin-bottom: 10px;">
                  ${t('mode.inuse.desc')}
                </p>
                <div style="background: rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 8px 10px; margin-top: 8px;">
                  <div style="color: white; font-size: 12px; text-align: left; line-height: 1.6;">
                    ✓ ${t('mode.inuse.feature1')}<br/>
                    ✓ ${t('mode.inuse.feature2')}<br/>
                    ✓ ${t('mode.inuse.feature3')}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div style="background: var(--background-secondary, #f1f5f9); padding: 10px 16px; border-radius: 8px; margin-top: 12px; border-left: 4px solid #3b82f6;">
            <div style="font-weight: 600; color: var(--status-info, #1e40af); margin-bottom: 4px; font-size: 13px;">${t('mode.tips.title')}</div>
            <ul style="color: var(--text-secondary, #475569); font-size: 13px; margin: 0; padding-left: 20px; line-height: 1.6;">
              <li>${t('mode.tips.warehouse')}</li>
              <li>${t('mode.tips.inuse')}</li>
            </ul>
          </div>
          
          <!-- 刷新盘点数据按钮 -->
          <div style="text-align: center; margin-top: 16px;">
            <button onclick="resetInventoryData()" style="
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              color: white;
              border: none;
              padding: 14px 32px;
              border-radius: 8px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
              transition: all 0.3s;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(239, 68, 68, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.3)';">
              ${t('button.reset')}
            </button>
            <div style="color: var(--text-secondary, #64748b); font-size: 13px; margin-top: 10px;">
              ${t('button.reset.hint')}
            </div>
          </div>
        </div>
      `;
    }
    
    // 清空其他区域
    document.getElementById('inventory-scan-section').innerHTML = '';
    document.getElementById('inventory-result-section').innerHTML = '';
    
    updateStats();
  };

  // 选择盘点模式
  window.selectInventoryMode = function(mode) {
    console.log('选择盘点模式:', mode);
    assetInventoryData.inventoryMode = mode;
    saveData();
    
    // 播放成功音效
    playBellSound();
    
    // 进入步骤1
    inventoryRenderStep1();
  };

  // 重置盘点数据
  window.resetInventoryData = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    // 显示确认对话框
    const confirmed = confirm(
      `${t('reset.confirm_title')}\n\n` +
      `${t('reset.confirm_description')}\n` +
      `${t('reset.confirm_item1')}\n` +
      `${t('reset.confirm_item2')}\n` +
      `${t('reset.confirm_item3')}\n` +
      `${t('reset.confirm_item4')}\n\n` +
      `${t('reset.confirm_warning')}`
    );
    
    if (!confirmed) {
      return;
    }
    
    console.log('🔄 重置盘点数据...');
    
    // 重置数据到初始状态
    assetInventoryData.currentStep = 0;
    assetInventoryData.inventoryMode = null;
    assetInventoryData.baselineData = [];
    assetInventoryData.scannedAssets = [];
    assetInventoryData.notFoundAssets = [];
    assetInventoryData.locationMismatches = [];
    assetInventoryData.scanHistory = [];
    assetInventoryData.inventoryStartTime = null;
    assetInventoryData.inventoryEndTime = null;
    
    // 保存数据
    saveData();
    
    // 播放语音提示
    playVoice(t('reset.voice_message'));
    
    // 显示成功提示
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 20px 40px;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
      z-index: 10000;
      animation: fadeInOut 2s ease-in-out;
    `;
    feedback.innerHTML = t('reset.success_message');
    document.body.appendChild(feedback);
    
    // 2秒后移除提示
    setTimeout(() => {
      feedback.remove();
      // 返回模式选择界面
      inventoryRenderStep0();
    }, 2000);
  };

  // 渲染步骤1 - 上传基准数据
  window.inventoryRenderStep1 = function() {
    // Gate: 必须已选择模式
    if (!canProceedToStep(2)) {
      alert(getStepBlockReason(2));
      return;
    }
    assetInventoryData.currentStep = 1;
    saveData();
    
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    const stepIndicator = document.getElementById('step-indicator-horizontal');
    if (stepIndicator) {
      stepIndicator.innerHTML = renderStepIndicatorHTML(2);
    }
    
    const uploadSection = document.getElementById('inventory-upload-section');
    if (uploadSection) {
      uploadSection.innerHTML = renderUploadSection();
    }
    
    // 清空其他区域
    document.getElementById('inventory-scan-section').innerHTML = '';
    document.getElementById('inventory-result-section').innerHTML = '';
    
    updateStats();
  };

  // 渲染上传区域
  function renderUploadSection() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    const hasData = assetInventoryData.baselineData.length > 0;
    
    let html = `
      <div style="max-width: 1600px; margin: 0 auto;">
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
            ${t('upload.title')}
          </h2>
    `;
    
    if (!hasData) {
      html += `
        <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; border: 2px dashed #cbd5e1; margin-bottom: 20px;">
          <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
          <h3 style="color: #475569; font-size: 18px; margin-bottom: 10px;">${t('upload.prompt')}</h3>
          <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
            ${t('upload.formats')}<br/>
            ${t('upload.required_fields')}
          </p>
          <input type="file" id="baseline-file-input" accept=".xlsx,.xls,.csv" style="display: none;" onchange="handleBaselineUpload(event)">
          <div style="display: flex; gap: 12px; justify-content: center; align-items: center;">
            <button onclick="document.getElementById('baseline-file-input').click()" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s;">
              ${t('upload.button')}
            </button>
            <button onclick="downloadBaselineTemplate()" style="background: white; color: #475569; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#3b82f6';this.style.color='#3b82f6'" onmouseout="this.style.borderColor='#cbd5e1';this.style.color='#475569'">
              📥 ${t('upload.download_template') || 'Download Template'}
            </button>
          </div>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">${t('upload.format_title')}</div>
          <ul style="color: #78350f; font-size: 14px; margin: 0; padding-left: 20px;">
            <li>${t('upload.field.serial')}</li>
            <li>${t('upload.field.tag')}</li>
            <li>${t('upload.field.model')}</li>
            <li>${t('upload.field.grid')}</li>
            <li>${t('upload.field.user')}</li>
            <li>${t('upload.field.location')}</li>
            <li>${t('upload.field.status')}</li>
          </ul>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #fde68a; color: #78350f; font-size: 13px;">
            ${t('upload.scan_tip')}
          </div>
        </div>
      `;
    } else {
      html += `
        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 20px;">
          <div style="font-weight: 600; color: #047857; margin-bottom: 5px;">${t('upload.loaded')}</div>
          <div style="color: #065f46; font-size: 14px;">${t('upload.records', { count: assetInventoryData.baselineData.length })}</div>
        </div>
      `;
      
      // 数据校验函数 (在生成HTML之前定义) - 根据盘点模式使用不同规则
      const validateBuilding = (building) => {
        const buildingStr = String(building || '').trim();
        if (buildingStr === 'BJH01') {
          return { color: '#059669', bg: '#d1fae5', valid: true }; // 绿色
        } else if (buildingStr === 'SXL01') {
          return { color: '#ec4899', bg: '#fce7f3', valid: true }; // 粉色
        } else {
          return { color: '#dc2626', bg: '#fee2e2', valid: false }; // 红色 - 异常
        }
      };
      
      const validateState = (state) => {
        const stateStr = String(state || '').trim();
        
        // 现役盘点模式 - 接受所有State值（不校验State）
        if (assetInventoryData.inventoryMode === 'inuse') {
          return { color: '#059669', bg: '#d1fae5', valid: true }; // 全部有效
        }
        
        // 库房盘点模式 - 只允许 In Stock
        if (stateStr === 'In Stock') {
          return { color: '#059669', bg: '#d1fae5', valid: true }; // 绿色 - 正常
        } else {
          return { color: '#dc2626', bg: '#fee2e2', valid: false }; // 红色 - 异常
        }
      };
      
      const validateSubState = (subState) => {
        const subStateStr = String(subState || '').trim();
        
        // 现役盘点模式 - 接受所有SubState值（不校验SubState）
        if (assetInventoryData.inventoryMode === 'inuse') {
          return { color: '#059669', bg: '#d1fae5', valid: true }; // 全部有效
        }
        
        // 库房盘点模式 - 只允许特定值
        const validSubStates = ['Available', 'Broken', 'Vendor Collection', 'User Collection'];
        if (validSubStates.includes(subStateStr)) {
          return { color: '#059669', bg: '#d1fae5', valid: true }; // 绿色 - 正常
        } else {
          return { color: '#dc2626', bg: '#fee2e2', valid: false }; // 红色 - 异常
        }
      };
      
      const validateSpace = (space) => {
        const spaceStr = String(space || '').trim();
        
        // 现役盘点模式 - 接受所有Space值（不校验Space）
        if (assetInventoryData.inventoryMode === 'inuse') {
          return { color: '#8b5cf6', bg: '#f3e8ff', valid: true }; // 全部有效（紫色）
        }
        
        // 库房盘点模式 - 必须包含 Warehouse
        if (spaceStr.includes('Warehouse') || spaceStr.includes('warehouse')) {
          return { color: '#8b5cf6', bg: '#f3e8ff', valid: true }; // 紫色 - 正常
        } else {
          return { color: '#dc2626', bg: '#fee2e2', valid: false }; // 红色 - 异常
        }
      };
      
      // 先收集异常数据
      const invalidAssets = [];
      assetInventoryData.baselineData.forEach((asset, index) => {
        const buildingStyle = validateBuilding(asset['Building']);
        const stateStyle = validateState(asset['State']);
        const subStateStyle = validateSubState(asset['SubState']);
        const spaceStyle = validateSpace(asset['Space']);
        
        const hasError = !buildingStyle.valid || !stateStyle.valid || !subStateStyle.valid || !spaceStyle.valid;
        if (hasError) {
          const errors = [];
          if (!buildingStyle.valid) errors.push('Building');
          if (!stateStyle.valid) errors.push('State');
          if (!subStateStyle.valid) errors.push('SubState');
          if (!spaceStyle.valid) errors.push('Space');
          
          invalidAssets.push({
            index: index + 1,
            asset: asset,
            errors: errors,
            styles: { buildingStyle, stateStyle, subStateStyle, spaceStyle }
          });
        }
      });
      
      // 生成HTML - 根据盘点模式显示不同的校验规则说明（仅在有异常数据时显示）
      if (invalidAssets.length > 0) {
        if (assetInventoryData.inventoryMode === 'warehouse') {
          // 库房盘点模式 - 显示完整校验规则
          html += `
            <!-- 数据校验规则说明 -->
            <div style="background: #fef3c7; padding: 8px 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-bottom: 12px;">
              <div style="font-weight: 600; font-size: 11px; color: #92400e; margin-bottom: 4px;">${t('validation.title')}</div>
              <div style="display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #78350f;">
                <div><strong>${t('validation.building')}</strong> <span style="color: #059669;">${t('validation.building.valid')}</span> | <span style="color: #dc2626;">${t('validation.building.invalid')}</span></div>
                <div><strong>${t('validation.state')}</strong> <span style="color: #059669;">${t('validation.state.valid')}</span> | <span style="color: #dc2626;">${t('validation.state.invalid')}</span></div>
                <div><strong>${t('validation.substate')}</strong> <span style="color: #059669;">${t('validation.substate.valid')}</span> | <span style="color: #dc2626;">${t('validation.substate.invalid')}</span></div>
                <div><strong>${t('validation.space')}</strong> <span style="color: #8b5cf6;">${t('validation.space.valid')}</span> | <span style="color: #dc2626;">${t('validation.space.invalid')}</span></div>
              </div>
            </div>
          `;
        } else {
          // 现役盘点模式 - 简化校验规则（只校验Building）
          html += `
            <!-- 数据校验规则说明 -->
            <div style="background: #e0f2fe; padding: 8px 12px; border-radius: 6px; border-left: 4px solid #0ea5e9; margin-bottom: 12px;">
              <div style="font-weight: 600; font-size: 11px; color: #0369a1; margin-bottom: 4px;">${t('validation.title_inuse')}</div>
              <div style="display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #075985;">
                <div><strong>${t('validation.building')}</strong> <span style="color: #059669;">${t('validation.building.valid').split('|')[0].trim()}</span> | <span style="color: #ec4899;">${t('validation.building.valid').split('|')[1].trim()}</span> | <span style="color: #dc2626;">${t('validation.building.invalid')}</span></div>
                <div><strong>${t('validation.state_inuse')}</strong> <span style="color: #059669;">${t('validation.state_inuse.valid')}</span></div>
              </div>
              <div style="margin-top: 4px; padding: 6px 8px; background: white; border-radius: 4px; font-size: 11px; color: #0369a1;">
                ${t('validation.inuse_note')}
              </div>
            </div>
          `;
        }
      }
      
      // 如果有异常数据,先显示异常数据窗格
      if (invalidAssets.length > 0) {
        html += `
          <div style="background: #fee2e2; padding: 20px; border-radius: 12px; border: 2px solid #dc2626; margin-bottom: 20px;">
            <h3 style="color: #991b1b; font-size: 18px; margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;">
              ${t('abnormal.title', { count: invalidAssets.length })}
              <span style="font-size: 14px; color: #dc2626; font-weight: normal; margin-left: 10px;">
                📍 ${t('abnormal.warning')}
              </span>
            </h3>
            <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.15); max-height: 400px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); position: sticky; top: 0; z-index: 10;">
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 60px;">${t('table.row')}</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 180px;">${t('table.serial')}</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 140px;">${t('table.tag')}</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 200px;">${t('table.model')}</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 100px;">${t('table.space')}</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 120px;">${t('table.building')}</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 100px;">${t('table.state')}</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 120px;">${t('table.substate')}</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 150px;">${t('table.abnormal_fields')}</th>
                  </tr>
                </thead>
                <tbody>
        `;
        
        invalidAssets.forEach((item) => {
          const asset = item.asset;
          const styles = item.styles;
          const serialNum = String(asset['Serial Number'] || asset['序列号'] || '');
          const assetTag = String(asset['Asset Tag'] || '');
          
          html += `
            <tr style="border-bottom: 1px solid #fecaca; background: ${item.index % 2 === 0 ? '#fff' : '#fef2f2'};">
              <td style="padding: 10px; font-size: 13px; color: #dc2626; font-weight: 700;">#${item.index}</td>
              <td style="padding: 10px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: 600;">${escapeHtml(serialNum || 'N/A')}</td>
              <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(assetTag || 'N/A')}</td>
              <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(asset['Model'] || 'N/A')}</td>
              <td style="padding: 10px; font-size: 13px; color: ${styles.spaceStyle.color}; background: ${styles.spaceStyle.bg}; font-weight: 600;">
                ${escapeHtml(asset['Space'] || 'N/A')}
                ${!styles.spaceStyle.valid ? ' ⚠️' : ''}
              </td>
              <td style="padding: 10px; font-size: 13px; color: ${styles.buildingStyle.color}; background: ${styles.buildingStyle.bg}; font-weight: 600;">
                ${escapeHtml(asset['Building'] || 'N/A')}
                ${!styles.buildingStyle.valid ? ' ⚠️' : ''}
              </td>
              <td style="padding: 10px; font-size: 13px; color: ${styles.stateStyle.color}; background: ${styles.stateStyle.bg}; font-weight: 600;">
                ${escapeHtml(asset['State'] || 'N/A')}
                ${!styles.stateStyle.valid ? ' ⚠️' : ''}
              </td>
              <td style="padding: 10px; font-size: 13px; color: ${styles.subStateStyle.color}; background: ${styles.subStateStyle.bg}; font-weight: 600;">
                ${escapeHtml(asset['SubState'] || 'N/A')}
                ${!styles.subStateStyle.valid ? ' ⚠️' : ''}
              </td>
              <td style="padding: 10px; font-size: 13px; color: #dc2626; font-weight: 600;">
                ${item.errors.join(', ')}
              </td>
            </tr>
          `;
        });
        
        html += `
                </tbody>
              </table>
            </div>
            <div style="margin-top: 12px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #dc2626;">
              <div style="font-size: 13px; color: #7f1d1d; line-height: 1.6;">
                ${t('abnormal.note')}
              </div>
            </div>
          </div>
        `;
      }
      
      // 完整数据表格
      html += `
        <div style="background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; max-height: 600px; overflow: auto;">
          <table style="width: 100%; border-collapse: collapse; min-width: 1100px;">
            <thead>
              <tr style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); position: sticky; top: 0; z-index: 10;">
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 60px;">序号</th>
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 180px;">Serial Number / 序列号</th>
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 140px;">Asset Tag</th>
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 200px;">Model</th>
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 100px;">Space</th>
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 120px;">Grid Reference</th>
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 120px;">Building</th>
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 100px;">State</th>
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 120px;">SubState</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      assetInventoryData.baselineData.forEach((asset, index) => {
        const serialNum = String(asset['Serial Number'] || asset['序列号'] || '');
        const assetTag = String(asset['Asset Tag'] || '');
        
        // 获取校验结果
        const buildingStyle = validateBuilding(asset['Building']);
        const stateStyle = validateState(asset['State']);
        const subStateStyle = validateSubState(asset['SubState']);
        const spaceStyle = validateSpace(asset['Space']);
        
        // 渲染表格行
        html += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-size: 13px; color: #64748b;">${index + 1}</td>
            <td style="padding: 10px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: 600;">${escapeHtml(serialNum || 'N/A')}</td>
            <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(assetTag || 'N/A')}</td>
            <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(asset['Model'] || 'N/A')}</td>
            <td style="padding: 10px; font-size: 13px; color: ${spaceStyle.color}; background: ${spaceStyle.bg}; font-weight: 600;">
              ${escapeHtml(asset['Space'] || 'N/A')}
              ${!spaceStyle.valid ? ' ⚠️' : ''}
            </td>
            <td style="padding: 10px; font-size: 13px; color: #ea580c; font-weight: 600;">${escapeHtml(asset['Grid Reference'] || 'N/A')}</td>
            <td style="padding: 10px; font-size: 13px; color: ${buildingStyle.color}; background: ${buildingStyle.bg}; font-weight: 600;">
              ${escapeHtml(asset['Building'] || 'N/A')}
              ${!buildingStyle.valid ? ' ⚠️' : ''}
            </td>
            <td style="padding: 10px; font-size: 13px; color: ${stateStyle.color}; background: ${stateStyle.bg}; font-weight: 600;">
              ${escapeHtml(asset['State'] || 'N/A')}
              ${!stateStyle.valid ? ' ⚠️' : ''}
            </td>
            <td style="padding: 10px; font-size: 13px; color: ${subStateStyle.color}; background: ${subStateStyle.bg}; font-weight: 600;">
              ${escapeHtml(asset['SubState'] || 'N/A')}
              ${!subStateStyle.valid ? ' ⚠️' : ''}
            </td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button onclick="inventoryRenderStep0()" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
            ${t('button.back_mode')}
          </button>
          <button onclick="reuploadBaseline()" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
            ${t('button.reupload')}
          </button>
          <button onclick="inventoryRenderStep1_5()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
            ${t('button.next')}
          </button>
        </div>
      `;
    }
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }

  // CSV解析辅助函数
  function parseCSV(text) {
    const lines = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === ',' || ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === ',' ) {
          lines[lines.length - 1] = lines[lines.length - 1] || [];
          lines[lines.length - 1].push(current.trim());
          current = '';
        } else {
          if (ch === '\r' && text[i + 1] === '\n') i++;
          if (current || (lines.length > 0 && lines[lines.length - 1])) {
            lines[lines.length - 1] = lines[lines.length - 1] || [];
            lines[lines.length - 1].push(current.trim());
            current = '';
          }
          lines.push(null); // placeholder for next row
        }
      } else {
        if (lines.length === 0) lines.push(null);
        current += ch;
      }
    }
    // last field
    if (current || (lines.length > 0 && lines[lines.length - 1])) {
      lines[lines.length - 1] = lines[lines.length - 1] || [];
      lines[lines.length - 1].push(current.trim());
    }
    
    return lines.filter(row => row && row.length > 0);
  }

  // 下载基准表模版
  window.downloadBaselineTemplate = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    if (typeof ExcelJS !== 'undefined') {
      // Use ExcelJS to create a proper .xlsx template
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Baseline Template');
      
      // Define columns
      sheet.columns = [
        { header: 'Serial Number', key: 'serial', width: 20 },
        { header: 'Asset Tag', key: 'tag', width: 18 },
        { header: 'Model', key: 'model', width: 25 },
        { header: 'Grid Reference', key: 'grid', width: 15 },
        { header: 'User', key: 'user', width: 18 },
        { header: 'Location', key: 'location', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ];
      
      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 22;
      
      // Add sample data rows
      const sampleData = [
        { serial: 'SN-2024-001', tag: 'AT-10001', model: 'HP EliteBook 840 G8', grid: 'A-01-02', user: 'John Smith', location: 'Beijing', status: 'Active' },
        { serial: 'SN-2024-002', tag: 'AT-10002', model: 'Dell Latitude 5520', grid: 'B-03-05', user: 'Jane Doe', location: 'Shanghai', status: 'Active' },
        { serial: 'SN-2024-003', tag: 'AT-10003', model: 'Lenovo ThinkPad T14', grid: 'C-02-01', user: '', location: 'Shenzhen', status: 'In Stock' },
      ];
      sampleData.forEach(row => sheet.addRow(row));
      
      // Auto-filter
      sheet.autoFilter = { from: 'A1', to: 'G1' };
      
      workbook.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory-baseline-template.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      });
    } else {
      // Fallback: generate CSV
      const csvContent = [
        'Serial Number,Asset Tag,Model,Grid Reference,User,Location,Status',
        'SN-2024-001,AT-10001,HP EliteBook 840 G8,A-01-02,John Smith,Beijing,Active',
        'SN-2024-002,AT-10002,Dell Latitude 5520,B-03-05,Jane Doe,Shanghai,Active',
        'SN-2024-003,AT-10003,Lenovo ThinkPad T14,C-02-01,,Shenzhen,In Stock',
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory-baseline-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // 处理基准表格上传
  window.handleBaselineUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📂 正在读取文件:', file.name);
    
    try {
      const data = [];
      const fileExt = file.name.split('.').pop().toLowerCase();
      
      if (fileExt === 'csv') {
        // CSV文件解析
        const text = await file.text();
        const rows = parseCSV(text);
        
        if (rows.length < 2) {
          alert('❌ CSV文件中没有找到数据行!');
          return;
        }
        
        const headers = rows[0];
        console.log('📋 CSV表头:', headers);
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowData = {};
          for (let j = 0; j < headers.length; j++) {
            if (headers[j]) {
              rowData[headers[j]] = row[j] || '';
            }
          }
          if (rowData['Serial Number'] || rowData['序列号'] || rowData['Asset Tag']) {
            data.push(rowData);
            if (data.length === 1) {
              console.log('📄 第一行数据样本:', rowData);
            }
          }
        }
      } else {
        // Excel文件解析
        const ExcelJS = window.ExcelJS;
        if (!ExcelJS) {
          alert('❌ ExcelJS 库未加载，请刷新页面重试');
          return;
        }
        const workbook = new ExcelJS.Workbook();
        
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          alert('❌ 文件中没有找到工作表!');
          return;
        }
        
        const headers = [];
        
        // 读取表头
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = cell.value;
        });
        
        console.log('📋 Excel表头:', headers);
        
        // 读取数据行
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          
          const rowData = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              rowData[header] = cell.value;
            }
          });
          
          if (rowData['Serial Number'] || rowData['序列号'] || rowData['Asset Tag']) {
            data.push(rowData);
            if (data.length === 1) {
              console.log('📄 第一行数据样本:', rowData);
            }
          }
        });
      }
      
      if (data.length === 0) {
        alert('❌ 没有找到有效数据!\n\n请确保表格包含以下列:\n- Serial Number\n- Asset Tag\n- Model');
        return;
      }
      
      assetInventoryData.baselineData = data;
      assetInventoryData.scannedAssets = [];
      assetInventoryData.scanHistory = [];
      saveData();
      
      const t = window.assetInventoryI18n?.t || ((key) => key);
      alert(t('upload.success', { count: data.length }));
      inventoryRenderStep1();
      
    } catch (error) {
      console.error('❌ 读取文件失败:', error);
      const t = window.assetInventoryI18n?.t || ((key) => key);
      alert(t('upload.error', { error: error.message }));
    }
  };

  // 重新上传基准表格
  window.reuploadBaseline = function() {
    if (confirm('确定要重新上传基准表格吗?\n\n这将清空当前的基准数据和扫描记录。')) {
      assetInventoryData.baselineData = [];
      assetInventoryData.scannedAssets = [];
      assetInventoryData.scanHistory = [];
      saveData();
      inventoryRenderStep1();
    }
  };

  // 渲染步骤1.5 - 输入盘点人信息
  window.inventoryRenderStep1_5 = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    if (assetInventoryData.baselineData.length === 0) {
      alert(t('alert.upload_first'));
      inventoryRenderStep1();
      return;
    }
    
    // 自动从session获取盘点人，跳过人员信息页面
    if (assetInventoryData.inventoryPersonList.length === 0) {
      // 从session header bar或localStorage获取当前用户作为盘点人
      let personName = '';
      // 尝试从session header bar DOM获取
      const headerBar = document.getElementById('session-header-bar');
      if (headerBar) {
        const personSpan = headerBar.querySelector('span');
        if (personSpan) {
          const text = personSpan.textContent.trim();
          if (text && text !== 'Unknown') personName = text;
        }
      }
      if (!personName) {
        try {
          const userStr = localStorage.getItem('currentUser');
          if (userStr) {
            const user = JSON.parse(userStr);
            personName = user.displayName || user.ntid || user.username || 'Unknown';
          }
        } catch(e) {}
      }
      if (!personName) personName = 'Unknown';
      
      assetInventoryData.inventoryPersonList = [personName];
      assetInventoryData.currentInventoryPerson = personName;
      assetInventoryData.inventoryPerson = personName;
      saveData();
    }
    
    // 直接进入扫码步骤
    inventoryRenderStep2();
    return;
    
    // 以下为旧的人员信息页面代码（已跳过）
    saveData();
    
    const stepIndicator = document.getElementById('step-indicator-horizontal');
    if (stepIndicator) {
      const modeText = assetInventoryData.inventoryMode === 'warehouse' ? t('mode.warehouse') : 
                       assetInventoryData.inventoryMode === 'inuse' ? t('mode.inuse') : t('step.mode');
      stepIndicator.innerHTML = `
        <div class="step-indicator-horizontal">
          <div class="step-item completed" onclick="inventoryRenderStep0()" style="cursor: pointer;">
            <div class="step-num">✓</div>
            <div class="step-text">${modeText}</div>
          </div>
          <div class="step-item completed" onclick="inventoryRenderStep1()" style="cursor: pointer;">
            <div class="step-num">✓</div>
            <div class="step-text">${t('step.upload')}</div>
          </div>
          <div class="step-item active">
            <div class="step-num">1.5</div>
            <div class="step-text">${t('step.personnel')}</div>
          </div>
          <div class="step-item" onclick="inventoryRenderStep2()" style="cursor: pointer;">
            <div class="step-num">2</div>
            <div class="step-text">${t('step.scan')}</div>
          </div>
          <div class="step-item" onclick="inventoryRenderStep3()" style="cursor: pointer;">
            <div class="step-num">3</div>
            <div class="step-text">${t('step.report')}</div>
          </div>
        </div>
      `;
    }
    
    const uploadSection = document.getElementById('inventory-upload-section');
    if (uploadSection) {
      // 确保inventoryPersonList是数组
      if (!assetInventoryData.inventoryPersonList) {
        assetInventoryData.inventoryPersonList = [];
      }
      
      uploadSection.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto;">
          <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h2 style="color: #1e293b; font-size: 28px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
              ${t('personnel.title')}
            </h2>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 30px;">
              ${t('personnel.subtitle')}
            </p>
            
            <div style="margin-bottom: 30px;">
              <label style="display: block; color: #475569; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                ${t('personnel.add_label')} <span style="color: #ef4444;">*</span>
              </label>
              <div style="display: flex; gap: 12px;">
                <input 
                  type="text" 
                  id="inventory-person-input" 
                  placeholder="${t('personnel.add_placeholder')}"
                  style="flex: 1; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; outline: none; transition: border-color 0.2s;"
                  onkeypress="if(event.key === 'Enter') addInventoryPerson()"
                  onfocus="this.style.borderColor='#4f46e5'"
                  onblur="this.style.borderColor='#e2e8f0'"
                />
                <button onclick="addInventoryPerson()" style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;">
                  ${t('personnel.add_button')}
                </button>
              </div>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 6px;">
                ${t('personnel.add_tip')}
              </p>
            </div>
            
            <!-- 盘点人列表 -->
            <div id="inventory-person-list-container" style="margin-bottom: 30px;">
              ${assetInventoryData.inventoryPersonList.length > 0 ? `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                  <h3 style="color: #475569; font-size: 14px; font-weight: 600; margin-bottom: 16px;">
                    ${t('personnel.list_title', { count: assetInventoryData.inventoryPersonList.length })}
                  </h3>
                  <div style="display: grid; gap: 12px;">
                    ${assetInventoryData.inventoryPersonList.map((person, index) => `
                      <div style="background: white; border: 2px solid ${person === assetInventoryData.currentInventoryPerson ? '#10b981' : '#e2e8f0'}; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                          <span style="font-size: 20px;">${person === assetInventoryData.currentInventoryPerson ? '✓' : '👤'}</span>
                          <span style="color: #1e293b; font-size: 14px; font-weight: ${person === assetInventoryData.currentInventoryPerson ? '600' : '500'};">
                            ${escapeHtml(person)}
                          </span>
                          ${person === assetInventoryData.currentInventoryPerson ? `
                            <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${t('personnel.current_badge')}</span>
                          ` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                          ${person !== assetInventoryData.currentInventoryPerson ? `
                            <button onclick="setCurrentInventoryPerson('${escapeHtml(person)}')" style="background: #f1f5f9; color: #475569; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                              ${t('personnel.set_current')}
                            </button>
                          ` : ''}
                          <button onclick="removeInventoryPerson(${index})" style="background: #fee2e2; color: #dc2626; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                            ${t('personnel.remove')}
                          </button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : `
                <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; text-align: center;">
                  <p style="color: #92400e; font-size: 14px; margin: 0;">
                    ${t('personnel.empty_warning')}
                  </p>
                </div>
              `}
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 30px;">
              <div style="display: flex; align-items: start; gap: 12px;">
                <span style="font-size: 20px;">ℹ️</span>
                <div style="flex: 1;">
                  <p style="color: #475569; font-size: 13px; margin: 0; line-height: 1.6;">
                    <strong>${t('personnel.info_title')}</strong><br>
                    ${t('personnel.info_1')}<br>
                    ${t('personnel.info_2')}<br>
                    ${t('personnel.info_3')}<br>
                    ${t('personnel.info_4')}
                  </p>
                </div>
              </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button onclick="inventoryRenderStep1()" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
                ${t('personnel.prev_step')}
              </button>
              <button onclick="proceedToScan()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
                ${t('personnel.start_scan')}
              </button>
            </div>
          </div>
        </div>
      `;
    }
    
    // 清空其他区域
    document.getElementById('inventory-scan-section').innerHTML = '';
    document.getElementById('inventory-result-section').innerHTML = '';
    document.getElementById('inventory-stats-container').innerHTML = '';
    
    // 自动聚焦到输入框
    setTimeout(() => {
      const personInput = document.getElementById('inventory-person-input');
      if (personInput) {
        personInput.focus();
      }
    }, 100);
  };

  // 添加盘点人
  window.addInventoryPerson = function() {
    const personInput = document.getElementById('inventory-person-input');
    if (!personInput) return;
    
    const personName = personInput.value.trim();
    
    if (!personName) {
      alert('⚠️ 请输入盘点人姓名!');
      personInput.focus();
      return;
    }
    
    // 检查是否已存在
    if (assetInventoryData.inventoryPersonList.includes(personName)) {
      alert('⚠️ 该盘点人已存在!');
      personInput.value = '';
      personInput.focus();
      return;
    }
    
    // 添加到列表
    assetInventoryData.inventoryPersonList.push(personName);
    
    // 如果是第一个,设为当前盘点人
    if (assetInventoryData.inventoryPersonList.length === 1) {
      assetInventoryData.currentInventoryPerson = personName;
      assetInventoryData.inventoryPerson = personName; // 兼容旧版
    }
    
    saveData();
    playBellSound();
    
    // 清空输入框
    personInput.value = '';
    personInput.focus();
    
    // 重新渲染
    inventoryRenderStep1_5();
  };

  // 移除盘点人
  window.removeInventoryPerson = function(index) {
    const person = assetInventoryData.inventoryPersonList[index];
    
    if (confirm(`确定要移除盘点人 "${person}" 吗?`)) {
      assetInventoryData.inventoryPersonList.splice(index, 1);
      
      // 如果移除的是当前盘点人,切换到第一个
      if (assetInventoryData.currentInventoryPerson === person) {
        assetInventoryData.currentInventoryPerson = assetInventoryData.inventoryPersonList[0] || '';
        assetInventoryData.inventoryPerson = assetInventoryData.currentInventoryPerson;
      }
      
      saveData();
      inventoryRenderStep1_5();
    }
  };

  // 设置当前盘点人
  window.setCurrentInventoryPerson = function(person) {
    assetInventoryData.currentInventoryPerson = person;
    assetInventoryData.inventoryPerson = person; // 兼容旧版
    saveData();
    playBellSound();
    inventoryRenderStep1_5();
  };

  // 进入扫描步骤
  window.proceedToScan = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    if (assetInventoryData.inventoryPersonList.length === 0) {
      // 从session header bar或localStorage获取当前用户作为盘点人
      let personName = '';
      const headerBar = document.getElementById('session-header-bar');
      if (headerBar) {
        const personSpan = headerBar.querySelector('span');
        if (personSpan) {
          const text = personSpan.textContent.trim();
          if (text && text !== 'Unknown') personName = text;
        }
      }
      if (!personName) {
        try {
          const userStr = localStorage.getItem('currentUser');
          if (userStr) {
            const user = JSON.parse(userStr);
            personName = user.displayName || user.ntid || user.username || 'Unknown';
          }
        } catch(e) {}
      }
      if (!personName) personName = 'Unknown';
      assetInventoryData.inventoryPersonList = [personName];
    }
    
    if (!assetInventoryData.currentInventoryPerson) {
      assetInventoryData.currentInventoryPerson = assetInventoryData.inventoryPersonList[0];
      assetInventoryData.inventoryPerson = assetInventoryData.currentInventoryPerson;
      saveData();
    }
    
    playBellSound();
    console.log('✅ 盘点人员已设置:', assetInventoryData.inventoryPersonList);
    console.log('✅ 当前盘点人:', assetInventoryData.currentInventoryPerson);
    
    // 进入步骤2 - 开始盘点
    inventoryRenderStep2();
  };

  // 在扫描界面切换盘点人
  window.switchInventoryPerson = function(person) {
    assetInventoryData.currentInventoryPerson = person;
    assetInventoryData.inventoryPerson = person; // 兼容旧版
    saveData();
    playBellSound();
    
    console.log('✅ 已切换盘点人:', person);
    
    // 更新当前盘点人显示
    const currentPersonDisplay = document.getElementById('current-person-display');
    if (currentPersonDisplay) {
      const t = window.assetInventoryI18n?.t || ((key) => key);
      currentPersonDisplay.innerHTML = `
        <span style="color: #10b981; font-weight: 600;">${t('scan.current_person')}: ${escapeHtml(person)}</span>
      `;
    }
    
    // 重新渲染所有盘点人按钮以更新高亮状态
    const personButtonsContainer = document.getElementById('inventory-person-buttons');
    if (personButtonsContainer && assetInventoryData.inventoryPersonList) {
      personButtonsContainer.innerHTML = assetInventoryData.inventoryPersonList.map(p => `
        <button 
          onclick="switchInventoryPerson('${escapeHtml(p)}')" 
          style="background: ${p === person ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)'}; 
                 color: ${p === person ? 'white' : '#475569'}; 
                 border: none; 
                 padding: 8px 16px; 
                 border-radius: 6px; 
                 font-size: 13px; 
                 font-weight: 600; 
                 cursor: pointer;
                 display: flex;
                 align-items: center;
                 gap: 6px;">
          ${p === person ? '✓' : '👤'} ${escapeHtml(p)}
        </button>
      `).join('');
    }
  };

  // 保存盘点人信息并进入步骤2 (保留用于兼容)
  window.saveInventoryPerson = function() {
    proceedToScan();
  };

  // 渲染步骤2 - 扫码盘点
  window.inventoryRenderStep2 = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    // Gate: 必须已上传基准数据
    if (!canProceedToStep(3)) {
      alert(getStepBlockReason(3));
      if (!assetInventoryData.inventoryMode) inventoryRenderStep0();
      else inventoryRenderStep1();
      return;
    }
    
    if (assetInventoryData.inventoryPersonList.length === 0) {
      // 从session header bar或localStorage获取当前用户作为盘点人
      let personName = '';
      const headerBar = document.getElementById('session-header-bar');
      if (headerBar) {
        const personSpan = headerBar.querySelector('span');
        if (personSpan) {
          const text = personSpan.textContent.trim();
          if (text && text !== 'Unknown') personName = text;
        }
      }
      if (!personName) {
        try {
          const userStr = localStorage.getItem('currentUser');
          if (userStr) {
            const user = JSON.parse(userStr);
            personName = user.displayName || user.ntid || user.username || 'Unknown';
          }
        } catch(e) {}
      }
      if (!personName) personName = 'Unknown';
      assetInventoryData.inventoryPersonList = [personName];
      assetInventoryData.currentInventoryPerson = personName;
      assetInventoryData.inventoryPerson = personName;
      saveData();
    }
    
    assetInventoryData.currentStep = 2;
    if (!assetInventoryData.inventoryStartTime) {
      assetInventoryData.inventoryStartTime = new Date().toISOString();
    }
    saveData();
    
    const stepIndicator = document.getElementById('step-indicator-horizontal');
    if (stepIndicator) {
      stepIndicator.innerHTML = renderStepIndicatorHTML(3);
    }
    
    const scanSection = document.getElementById('inventory-scan-section');
    if (scanSection) {
      scanSection.innerHTML = renderScanSection();
    }
    
    // 清空其他区域
    document.getElementById('inventory-upload-section').innerHTML = '';
    document.getElementById('inventory-result-section').innerHTML = '';
    
    // 自动聚焦到扫码输入框
    setTimeout(() => {
      const scanInput = document.getElementById('scan-input');
      if (scanInput) {
        scanInput.focus();
      }
    }, 100);
    
    updateStats();
  };

  // 渲染扫码区域
  function renderScanSection() {
    // 根据盘点模式渲染不同的扫码界面
    if (assetInventoryData.inventoryMode === 'warehouse') {
      return renderWarehouseScanSection();
    } else if (assetInventoryData.inventoryMode === 'inuse') {
      return renderInUseScanSection();
    } else {
      // 如果没有选择模式,默认使用库房模式
      return renderWarehouseScanSection();
    }
  }

  // 渲染库房盘点扫码界面
  function renderWarehouseScanSection() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    // 获取所有可用的Grid Reference选项
    const availableGrids = getAvailableGridReferences();
    
    let html = `
      <div style="max-width: 1600px; margin: 0 auto;">
        <!-- 盘点人切换区 -->
        ${assetInventoryData.inventoryPersonList.length > 1 ? `
          <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <h3 style="color: #475569; font-size: 14px; font-weight: 600; margin: 0;">
                ${t('scan.personnel_section')}
              </h3>
              <div id="current-person-display">
                <span style="color: #10b981; font-weight: 600;">${t('scan.current_person')}: ${escapeHtml(assetInventoryData.currentInventoryPerson || '')}</span>
              </div>
            </div>
            <div id="inventory-person-buttons" style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${assetInventoryData.inventoryPersonList.map(person => `
                <button 
                  onclick="switchInventoryPerson('${escapeHtml(person)}')" 
                  style="background: ${person === assetInventoryData.currentInventoryPerson ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)'}; 
                         color: ${person === assetInventoryData.currentInventoryPerson ? 'white' : '#475569'}; 
                         border: none; 
                         padding: 8px 16px; 
                         border-radius: 6px; 
                         font-size: 13px; 
                         font-weight: 600; 
                         cursor: pointer;
                         display: flex;
                         align-items: center;
                         gap: 6px;">
                  ${person === assetInventoryData.currentInventoryPerson ? '✓' : '👤'} ${escapeHtml(person)}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- 扫码输入区 -->
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
            ${t('scan.title')}
            ${assetInventoryData.inventoryPersonList.length === 1 ? `
              <span style="background: #ecfdf5; color: #047857; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                👤 ${escapeHtml(assetInventoryData.currentInventoryPerson)}
              </span>
            ` : ''}
          </h2>
          
          <!-- 货架位置选择 + SN修正工具 合并为一排 -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <!-- 货架位置选择 -->
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px;">
              <div style="text-align: center; color: white;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${t('scan.grid_title')}</div>
                ${renderGridCombobox(availableGrids)}
                <div style="font-size: 12px; opacity: 0.95;">
                  ${t('scan.grid_tip')}
                </div>
              </div>
            </div>
            
            <!-- SN修正工具 -->
            <div id="sn-correction-tool" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); padding: 20px; border-radius: 12px;">
              <div style="text-align: center; color: white;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${t('scan.sn_tool_title')}</div>
                <button 
                  id="sn-correction-toggle"
                  onclick="toggleSnCorrection()" 
                  style="background: white; color: #475569; border: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2); margin-bottom: 10px;"
                  onmouseover="this.style.transform='scale(1.05)'" 
                  onmouseout="this.style.transform='scale(1)'"
                >
                  ${t('scan.sn_tool_off')}
                </button>
                <div style="font-size: 12px; opacity: 0.95;">
                  ${t('scan.sn_tool_tip')}
                </div>
              </div>
            </div>
          </div>
          
          <!-- 扫码枪扫描 + 手动输入 合并为一排 -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <!-- 扫码枪扫描 -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 25px; border-radius: 12px;">
              <div style="text-align: center; color: white;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${t('scan.scan_title')}</div>
                <input 
                  type="text" 
                  id="scan-input" 
                  placeholder="${t('scan.scan_placeholder')}"
                  style="width: 100%; padding: 15px 20px; border: 3px solid white; border-radius: 8px; font-size: 17px; text-align: center; font-family: monospace; font-weight: 600; margin-bottom: 10px;"
                  onkeydown="handleScanInput(event)"
                  oninput="handleScanInputChange(event)"
                  autocomplete="off"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck="false"
                  inputmode="none"
                  autofocus
                >
                <div style="font-size: 12px; opacity: 0.9;">
                  ${t('scan.scan_tip')}
                </div>
              </div>
            </div>
            
            <!-- 手动输入区 -->
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 25px; border-radius: 12px;">
              <div style="text-align: center; color: white;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${t('scan.manual_title')}</div>
                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                  <input 
                    type="text" 
                    id="manual-input" 
                    placeholder="${t('scan.manual_placeholder')}"
                    style="flex: 1; padding: 15px 16px; border: 2px solid white; border-radius: 8px; font-size: 16px; font-family: monospace;"
                    onkeypress="handleManualInputKeypress(event)"
                    autocomplete="off"
                  >
                  <button 
                    onclick="submitManualInput()" 
                    style="background: white; color: #7c3aed; border: none; padding: 12px 20px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap;"
                    onmouseover="this.style.background='#f3e8ff'" 
                    onmouseout="this.style.background='white'"
                  >
                    ${t('scan.manual_button')}
                  </button>
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                  ${t('scan.manual_tip')}
                </div>
              </div>
            </div>
          </div>
          
          <!-- 最近扫描记录 -->
          <div id="recent-scans-container">
            ${renderRecentScans()}
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
            <button onclick="inventoryRenderStep0()" style="background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
              ${t('scan.button_home')}
            </button>
            <button onclick="inventoryRenderStep1()" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
              ${t('scan.button_back')}
            </button>
            <button onclick="completeInventory()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
              ${t('scan.button_complete')}
            </button>
          </div>
        </div>
        
        <!-- 已扫描列表 -->
        <div id="scanned-assets-container" style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h3 style="color: #1e293b; font-size: 20px; margin-bottom: 15px;">${t('scan.scanned_list_title')}</h3>
          <div id="scanned-list-content">
            ${renderScannedList()}
          </div>
        </div>
      </div>
    `;
    
    return html;
  }

  // 渲染最近扫描记录
  function renderRecentScans() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    const recentScans = assetInventoryData.scanHistory.slice(-5).reverse();
    
    if (recentScans.length === 0) {
      return `
        <div style="text-align: center; padding: 20px; color: #64748b; font-size: 14px;">
          ${t('scan.recent_none')}
        </div>
      `;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    
    recentScans.forEach(scan => {
      const statusConfig = {
        'success': { bg: '#dcfce7', color: '#047857', icon: '✅', text: t('scan.status_success') },
        'error': { bg: '#fee2e2', color: '#dc2626', icon: '❌', text: t('scan.status_notfound') },
        'duplicate': { bg: '#fef3c7', color: '#92400e', icon: '⚠️', text: t('scan.status_duplicate') },
        'warning': { bg: '#fef3c7', color: '#92400e', icon: '⚠️', text: t('scan.status_warning') }
      };
      
      const config = statusConfig[scan.status] || statusConfig['success'];
      
      html += `
        <div style="background: ${config.bg}; padding: 12px 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 20px;">${config.icon}</span>
            <div>
              <div style="font-family: monospace; font-weight: 600; color: ${config.color};">${escapeHtml(scan.serialNumber)}</div>
              <div style="font-size: 12px; color: ${config.color}; opacity: 0.8;">${new Date(scan.timestamp).toLocaleTimeString('zh-CN')}</div>
            </div>
          </div>
          <div style="background: ${config.color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
            ${config.text}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }

  // 渲染现役盘点扫码界面 (新功能)
  function renderInUseScanSection() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    let html = `
      <div style="max-width: 1600px; margin: 0 auto;">
        <!-- 盘点人切换区 -->
        ${assetInventoryData.inventoryPersonList.length > 1 ? `
          <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <h3 style="color: #475569; font-size: 14px; font-weight: 600; margin: 0;">
                ${t('scan.personnel_section')}
              </h3>
              <div id="current-person-display">
                <span style="color: #10b981; font-weight: 600;">${t('scan.current_person')}: ${escapeHtml(assetInventoryData.currentInventoryPerson || '')}</span>
              </div>
            </div>
            <div id="inventory-person-buttons" style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${assetInventoryData.inventoryPersonList.map(person => `
                <button 
                  onclick="switchInventoryPerson('${escapeHtml(person)}')" 
                  style="background: ${person === assetInventoryData.currentInventoryPerson ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)'}; 
                         color: ${person === assetInventoryData.currentInventoryPerson ? 'white' : '#475569'}; 
                         border: none; 
                         padding: 8px 16px; 
                         border-radius: 6px; 
                         font-size: 13px; 
                         font-weight: 600; 
                         cursor: pointer;
                         display: flex;
                         align-items: center;
                         gap: 6px;">
                  ${person === assetInventoryData.currentInventoryPerson ? '✓' : '👤'} ${escapeHtml(person)}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- MTR会议室盘点开关 -->
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${assetInventoryData.inUseLocationPresetEnabled ? '16px' : '0'};">
            <div>
              <h3 style="color: #475569; font-size: 16px; font-weight: 600; margin: 0 0 4px 0;">
                ${t('mtr.title')}
              </h3>
              <p style="color: #64748b; font-size: 13px; margin: 0;">
                ${t('mtr.subtitle')}
              </p>
            </div>
            <button 
              onclick="toggleInUseLocationPreset()" 
              style="background: ${assetInventoryData.inUseLocationPresetEnabled ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #64748b 0%, #475569 100%)'}; 
                     color: white; 
                     border: none; 
                     padding: 10px 24px; 
                     border-radius: 8px; 
                     font-size: 14px; 
                     font-weight: 600; 
                     cursor: pointer; 
                     transition: all 0.2s;
                     min-width: 100px;"
              onmouseover="this.style.transform='scale(1.05)'" 
              onmouseout="this.style.transform='scale(1)'"
            >
              ${assetInventoryData.inUseLocationPresetEnabled ? t('mtr.toggle_on') : t('mtr.toggle_off')}
            </button>
          </div>
          
          <!-- 房间选择器 (仅当开关开启时显示) -->
          ${assetInventoryData.inUseLocationPresetEnabled ? `
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
              
              <!-- Beijing 会议室下拉列表 -->
              <div style="margin-bottom: 16px;">
                <label style="display: block; color: #475569; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                  ${t('mtr.beijing_label')}
                </label>
                <select 
                  id="beijing-room-select"
                  onchange="selectPresetLocation(this.value)"
                  style="width: 100%; 
                         padding: 12px 16px; 
                         border: 2px solid #e2e8f0; 
                         border-radius: 8px; 
                         font-size: 14px; 
                         color: #475569;
                         background: white;
                         cursor: pointer;
                         transition: all 0.2s;"
                  onfocus="this.style.borderColor='#10b981'"
                  onblur="this.style.borderColor='#e2e8f0'"
                >
                  <option value="">${t('mtr.select_beijing')}</option>
                  ${MTR_ROOM_LIST.filter(room => room.includes('Beijing')).map(room => `
                    <option value="${escapeAttr(room)}" ${assetInventoryData.selectedPresetLocation === room ? 'selected' : ''}>
                      ${escapeHtml(room)}
                    </option>
                  `).join('')}
                </select>
              </div>
              
              <!-- Shanghai 会议室下拉列表 (待添加) -->
              <div style="margin-bottom: 16px;">
                <label style="display: block; color: #475569; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                  ${t('mtr.shanghai_label')}
                </label>
                <select 
                  id="shanghai-room-select"
                  onchange="selectPresetLocation(this.value)"
                  style="width: 100%; 
                         padding: 12px 16px; 
                         border: 2px solid #e2e8f0; 
                         border-radius: 8px; 
                         font-size: 14px; 
                         color: #475569;
                         background: white;
                         cursor: pointer;
                         transition: all 0.2s;"
                  onfocus="this.style.borderColor='#10b981'"
                  onblur="this.style.borderColor='#e2e8f0'"
                >
                  <option value="">${t('mtr.select_shanghai')}</option>
                  ${SHANGHAI_ROOM_LIST.map(room => `
                    <option value="${escapeAttr(room)}" ${assetInventoryData.selectedPresetLocation === room ? 'selected' : ''}>
                      ${escapeHtml(room)}
                    </option>
                  `).join('')}
                </select>
              </div>
              
              <!-- 位置预设提示信息 -->
              <div id="location-preset-message">
                ${assetInventoryData.selectedPresetLocation ? `
                  <div style="margin-top: 12px; padding: 12px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; color: #047857; font-size: 13px;">
                    ${t('mtr.current_selection', { room: escapeHtml(assetInventoryData.selectedPresetLocation) })}
                  </div>
                ` : `
                  <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; color: #92400e; font-size: 13px;">
                    ${t('mtr.please_select')}
                  </div>
                `}
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- 扫码输入区 -->
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 15px; display: flex; align-items: center; gap: 12px;">
            ${t('scan.inuse_title')}
            ${assetInventoryData.inventoryPersonList.length === 1 ? `
              <span style="background: #ecfdf5; color: #047857; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                👤 ${escapeHtml(assetInventoryData.currentInventoryPerson)}
              </span>
            ` : ''}
          </h2>
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="color: white; font-size: 14px; line-height: 1.6;">
              <strong>${t('scan.inuse_flow_title')}</strong><br/>
              ${t('scan.inuse_flow_1')}<br/>
              ${t('scan.inuse_flow_2')}<br/>
              ${t('scan.inuse_flow_3')}<br/>
              ${t('scan.inuse_flow_4')}
            </div>
          </div>
          
          <!-- SN修正工具 -->
          <div id="sn-correction-tool" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <div style="text-align: center; color: white;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${t('scan.sn_tool_title')}</div>
              <button 
                id="sn-correction-toggle"
                onclick="toggleSnCorrection()" 
                style="background: white; color: #475569; border: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2); margin-bottom: 10px;"
                onmouseover="this.style.transform='scale(1.05)'" 
                onmouseout="this.style.transform='scale(1)'"
              >
                ${t('scan.sn_tool_off')}
              </button>
              <div style="font-size: 12px; opacity: 0.95;">
                ${t('scan.sn_tool_tip')}
              </div>
            </div>
          </div>
          
          <!-- 扫码枪扫描 + 手动输入 合并为一排 -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <!-- 扫码枪扫描 -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 25px; border-radius: 12px;">
              <div style="text-align: center; color: white;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${t('scan.scan_title')}</div>
                <input 
                  type="text" 
                  id="scan-input" 
                  placeholder="${t('scan.scan_placeholder')}"
                  style="width: 100%; padding: 15px 20px; border: 3px solid white; border-radius: 8px; font-size: 17px; text-align: center; font-family: monospace; font-weight: 600; margin-bottom: 10px;"
                  onkeydown="handleInUseScanInput(event)"
                  oninput="handleInUseScanInputChange(event)"
                  autocomplete="off"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck="false"
                  inputmode="none"
                  autofocus
                >
                <div style="font-size: 12px; opacity: 0.9;">
                  ${t('scan.inuse_scan_tip')}
                </div>
              </div>
            </div>
            
            <!-- 手动输入区 -->
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 25px; border-radius: 12px;">
              <div style="text-align: center; color: white;">
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">${t('scan.manual_title')}</div>
                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                  <input 
                    type="text" 
                    id="manual-input" 
                    placeholder="${t('scan.manual_placeholder')}"
                    style="flex: 1; padding: 15px 16px; border: 2px solid white; border-radius: 8px; font-size: 16px; font-family: monospace;"
                    onkeypress="handleInUseManualInputKeypress(event)"
                    autocomplete="off"
                  >
                  <button 
                    onclick="submitInUseManualInput()" 
                    style="background: white; color: #7c3aed; border: none; padding: 12px 20px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap;"
                    onmouseover="this.style.background='#f3e8ff'" 
                    onmouseout="this.style.background='white'"
                  >
                    ${t('scan.manual_button')}
                  </button>
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                  ${t('scan.inuse_manual_tip')}
                </div>
              </div>
            </div>
          </div>
          
          <!-- 最近扫描记录 -->
          <div id="recent-scans-container">
            ${renderRecentScans()}
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
            <button onclick="inventoryRenderStep0()" style="background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
              ${t('scan.button_home')}
            </button>
            <button onclick="inventoryRenderStep1()" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
              ${t('scan.button_back')}
            </button>
            <button onclick="completeInventory()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
              ${t('scan.button_complete')}
            </button>
          </div>
        </div>
        
        <!-- 已扫描列表 -->
        <div id="scanned-assets-container" style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h3 style="color: #1e293b; font-size: 20px; margin-bottom: 15px;">${t('scan.scanned_list_title')}</h3>
          <div id="scanned-list-content">
            ${renderScannedList()}
          </div>
        </div>
      </div>
    `;
    
    return html;
  }

  // 渲染已扫描列表
  function renderScannedList() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    if (assetInventoryData.scannedAssets.length === 0) {
      return `
        <div style="text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px; color: #64748b;">
          ${t('scan.scanned_none')}
        </div>
      `;
    }
    
    let html = `
      <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-height: 500px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); position: sticky; top: 0; z-index: 10;">
              <th style="padding: 14px 12px; text-align: center; color: white; font-weight: 600; font-size: 13px; width: 50px;">${t('scan.table_index')}</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 120px;">${t('table.serial')}</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 100px;">${t('table.tag')}</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 100px;">${t('table.model')}</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 80px;">${t('table.user')}</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 120px;">${t('table.grid_reference')}</th>
              <th style="padding: 14px 12px; text-align: left; color: white; font-weight: 600; font-size: 13px; min-width: 140px;">${t('scan.table_time')}</th>
              <th style="padding: 14px 12px; text-align: center; color: white; font-weight: 600; font-size: 13px; width: 80px;">${t('scan.table_action')}</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    assetInventoryData.scannedAssets.forEach((asset, index) => {
      // 灵活获取字段值 - 尝试多种可能的列名
      const getFieldValue = (asset, ...possibleKeys) => {
        for (let key of possibleKeys) {
          if (asset[key] && asset[key] !== 'undefined' && asset[key] !== 'null') {
            return asset[key];
          }
        }
        return 'N/A';
      };
      
      const serialNumber = getFieldValue(asset, 'Serial Number', '序列号');
      const assetTag = getFieldValue(asset, 'Asset Tag', '资产标签');
      const model = getFieldValue(asset, 'Model', '型号');
      const user = getFieldValue(asset, 'User', '用户', '使用人');
      
      // 位置信息 - 根据盘点模式显示不同内容
      let locationCell = '';
      if (assetInventoryData.inventoryMode === 'inuse' && asset._locationChanged !== undefined) {
        // 现役盘点模式 - 显示位置变更信息
        if (asset._locationChanged) {
          locationCell = `
            <td style="padding: 10px;">
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="background: #e2e8f0; color: #64748b; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">原位置</span>
                  <span style="font-size: 12px; color: #64748b; font-family: monospace;">${escapeHtml(asset._originalLocation)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">⚠️ 新位置</span>
                  <span style="font-size: 13px; color: #ea580c; font-weight: 600; font-family: monospace;">${escapeHtml(asset._currentLocation)}</span>
                </div>
              </div>
            </td>
          `;
        } else {
          locationCell = `<td style="padding: 10px; font-size: 13px; color: #059669; font-weight: 600; font-family: monospace;">${escapeHtml(asset._currentLocation)}</td>`;
        }
      } else {
        // 库房盘点模式 - 显示Grid Reference
        const gridReference = getFieldValue(asset, 'Grid Reference', 'grid reference', 'GridReference');
        
        // 🆕 检查是否有位置差异
        if (asset._gridReferenceChanged) {
          locationCell = `
            <td style="padding: 10px;">
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="background: #e2e8f0; color: #64748b; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">${t('scan.original_grid')}</span>
                  <span style="font-size: 12px; color: #64748b; font-family: monospace;">${escapeHtml(asset._originalGridReference)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="background: #fef3c7; color: #92400e; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">📍 ${t('scan.actual_grid')}</span>
                  <span style="font-size: 13px; color: #ea580c; font-weight: 600; font-family: monospace;">${escapeHtml(asset._actualGridReference)}</span>
                </div>
              </div>
            </td>
          `;
        } else {
          locationCell = `<td style="padding: 10px; font-size: 13px; color: #ea580c; font-weight: 600; font-family: monospace;">${escapeHtml(gridReference)}</td>`;
        }
      }
      
      // 🆕 检查是否为"不在基准表"的设备
      const notInBaselineBadge = asset._isNotInBaseline ? 
        `<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 6px; white-space: nowrap;">⚠️ ${t('scan.not_in_baseline_badge')}</span>` : 
        '';
      
      // 🆕 检查是否有位置差异（库房模式）或位置变更（现役模式）
      const hasLocationIssue = asset._isNotInBaseline || asset._gridReferenceChanged || asset._locationChanged;
      const rowBackground = hasLocationIssue ? 'background: #fffbeb;' : '';
      
      html += `
        <tr style="border-bottom: 1px solid #e2e8f0; ${rowBackground}">
          <td style="padding: 10px; font-size: 13px; color: #64748b; text-align: center;">${index + 1}</td>
          <td style="padding: 10px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: 600;">
            ${escapeHtml(serialNumber)}${notInBaselineBadge}
          </td>
          <td style="padding: 10px; font-size: 13px; color: #475569; font-family: monospace;">${escapeHtml(assetTag)}</td>
          <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(model)}</td>
          <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(user)}</td>
          ${locationCell}
          <td style="padding: 10px; font-size: 12px; color: #64748b; font-family: monospace; white-space: nowrap;">${new Date(asset.scanTime || asset._scannedTime).toLocaleString('zh-CN')}</td>
          <td style="padding: 10px; text-align: center;">
            <button 
              onclick="removeScannedAsset(${index})" 
              style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s;"
              onmouseover="this.style.background='#dc2626'" 
              onmouseout="this.style.background='#ef4444'"
              title="${t('delete.button_title')}"
            >
              ${t('delete.button')}
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    return html;
  }

  // 自动触发扫描的定时器
  let scanInputTimer = null;

  // ========== USB扫码枪兼容性优化 ==========
  // 1. 焦点恢复：用户点击页面空白区域后自动将焦点恢复到扫码输入框
  // 2. 全局键盘拦截：如果焦点不在扫码框，但用户开始输入，自动重定向到扫码框
  // 3. 防止页面可见性切换导致焦点丢失

  let _scannerFocusInterval = null;

  function startScannerFocusGuard() {
    // 清理之前的守卫
    stopScannerFocusGuard();

    // 点击页面空白区域时恢复焦点到扫码框
    document.addEventListener('click', _scannerRefocusOnClick, true);

    // 全局键盘事件：如果焦点不在input/textarea/select，将输入重定向到扫码框
    document.addEventListener('keydown', _scannerRedirectKeystrokes, true);

    // 页面重新可见时恢复焦点
    document.addEventListener('visibilitychange', _scannerRefocusOnVisible);

    // 定时检查焦点（保底机制，每2秒）
    _scannerFocusInterval = setInterval(() => {
      const scanInput = document.getElementById('scan-input');
      if (!scanInput) return;
      const activeEl = document.activeElement;
      // 如果焦点不在任何输入类元素上，恢复到扫码框
      if (activeEl && activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'SELECT' && !activeEl.isContentEditable) {
        scanInput.focus();
      }
    }, 2000);

    console.log('🔫 Scanner focus guard started');
  }

  function stopScannerFocusGuard() {
    document.removeEventListener('click', _scannerRefocusOnClick, true);
    document.removeEventListener('keydown', _scannerRedirectKeystrokes, true);
    document.removeEventListener('visibilitychange', _scannerRefocusOnVisible);
    if (_scannerFocusInterval) {
      clearInterval(_scannerFocusInterval);
      _scannerFocusInterval = null;
    }
  }

  function _scannerRefocusOnClick(e) {
    const scanInput = document.getElementById('scan-input');
    if (!scanInput) return;
    // 如果点击的不是另一个输入框/按钮/下拉菜单，则恢复焦点
    const tag = e.target.tagName;
    const inGridCombo = e.target.closest('#grid-combobox-wrapper');
    if (inGridCombo) return; // 正在操作货架选择器，不抢焦点
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && tag !== 'BUTTON' && !e.target.closest('button')) {
      setTimeout(() => scanInput.focus(), 50);
    }
  }

  function _scannerRedirectKeystrokes(e) {
    const scanInput = document.getElementById('scan-input');
    if (!scanInput) return;
    // 如果焦点不在任何输入元素上，且按下的是可打印字符，重定向到扫码框
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'SELECT' && !activeEl.isContentEditable) {
      // 忽略修饰键和功能键
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // 不在下拉菜单操作中
        if (!_gridDropdownOpen) {
          scanInput.focus();
        }
      }
    }
  }

  function _scannerRefocusOnVisible() {
    if (document.visibilityState === 'visible') {
      setTimeout(() => {
        const scanInput = document.getElementById('scan-input');
        if (scanInput) scanInput.focus();
      }, 200);
    }
  }

  // 在扫码界面渲染后启动守卫 - 覆盖原有的 inventoryRenderStep2
  const _originalRenderStep2 = window.inventoryRenderStep2;
  window.inventoryRenderStep2 = function() {
    if (_originalRenderStep2) _originalRenderStep2();
    // 启动焦点守卫
    startScannerFocusGuard();
  };

  // 离开扫码界面时停止守卫
  const _origStep0 = window.inventoryRenderStep0;
  window.inventoryRenderStep0 = function() { stopScannerFocusGuard(); if (_origStep0) _origStep0(); };
  const _origStep1 = window.inventoryRenderStep1;
  window.inventoryRenderStep1 = function() { stopScannerFocusGuard(); if (_origStep1) _origStep1(); };
  const _origStep3 = window.inventoryRenderStep3;
  window.inventoryRenderStep3 = function() { stopScannerFocusGuard(); if (_origStep3) _origStep3(); };

  // ========== 可搜索的货架位置 Combobox ==========
  let _gridDropdownOpen = false;
  let _gridHighlightIndex = -1;

  window.openGridDropdown = function() {
    const dropdown = document.getElementById('grid-dropdown');
    const input = document.getElementById('current-grid-reference');
    if (!dropdown || !input) return;
    _gridDropdownOpen = true;
    filterGridOptions(input.value);
    dropdown.style.display = 'block';
  };

  window.closeGridDropdown = function() {
    const dropdown = document.getElementById('grid-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    _gridDropdownOpen = false;
    _gridHighlightIndex = -1;
  };

  window.filterGridOptions = function(query) {
    const dropdown = document.getElementById('grid-dropdown');
    if (!dropdown) return;

    const grids = getAvailableGridReferences();
    const q = (query || '').trim().toUpperCase();
    
    const filtered = q 
      ? grids.filter(g => g.value.toUpperCase().startsWith(q) || g.value.toUpperCase().includes(q))
      : grids;

    if (filtered.length === 0 && q) {
      dropdown.innerHTML = `
        <div style="padding: 10px 16px; color: #64748b; font-size: 13px; text-align: center;">
          按 Enter 使用 "${escapeHtml(q)}" 作为自定义位置
        </div>
      `;
    } else {
      dropdown.innerHTML = filtered.map((g, i) => `
        <div class="grid-option ${i === _gridHighlightIndex ? 'grid-option-active' : ''}" 
             data-value="${escapeHtml(g.value)}"
             onmousedown="selectGridOption('${escapeHtml(g.value)}')"
             onmouseenter="highlightGridOption(${i})"
             style="padding: 8px 16px; cursor: pointer; font-size: 14px; font-weight: 600; text-align: center; color: #1e293b; ${i === _gridHighlightIndex ? 'background: #eff6ff;' : ''} transition: background 0.1s;">
          ${escapeHtml(g.value)}
        </div>
      `).join('');
    }

    _gridHighlightIndex = -1;
    if (!_gridDropdownOpen) {
      dropdown.style.display = 'block';
      _gridDropdownOpen = true;
    }
  };

  window.selectGridOption = function(value) {
    const input = document.getElementById('current-grid-reference');
    if (input) {
      input.value = value;
      input.style.background = '#ecfdf5';
      input.style.borderColor = '#10b981';
      setTimeout(() => {
        input.style.background = 'white';
        input.style.borderColor = 'white';
      }, 1500);
    }
    closeGridDropdown();
    // 聚焦到扫码输入框
    setTimeout(() => {
      const scanInput = document.getElementById('scan-input');
      if (scanInput) scanInput.focus();
    }, 100);
  };

  window.highlightGridOption = function(index) {
    _gridHighlightIndex = index;
    const options = document.querySelectorAll('#grid-dropdown .grid-option');
    options.forEach((opt, i) => {
      opt.style.background = i === index ? '#eff6ff' : '';
    });
  };

  window.handleGridComboKeydown = function(event) {
    const dropdown = document.getElementById('grid-dropdown');
    const options = dropdown ? dropdown.querySelectorAll('.grid-option') : [];

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!_gridDropdownOpen) openGridDropdown();
      _gridHighlightIndex = Math.min(_gridHighlightIndex + 1, options.length - 1);
      highlightGridOption(_gridHighlightIndex);
      if (options[_gridHighlightIndex]) options[_gridHighlightIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      _gridHighlightIndex = Math.max(_gridHighlightIndex - 1, 0);
      highlightGridOption(_gridHighlightIndex);
      if (options[_gridHighlightIndex]) options[_gridHighlightIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (_gridHighlightIndex >= 0 && options[_gridHighlightIndex]) {
        selectGridOption(options[_gridHighlightIndex].dataset.value);
      } else {
        // 使用当前输入值作为自定义货架号
        const input = event.target;
        const val = input.value.trim().toUpperCase();
        if (val) {
          input.value = val;
          selectGridOption(val);
        }
      }
    } else if (event.key === 'Escape') {
      closeGridDropdown();
    } else if (event.key === 'Tab') {
      closeGridDropdown();
    }
  };

  // 点击外部关闭下拉
  document.addEventListener('mousedown', function(e) {
    const wrapper = document.getElementById('grid-combobox-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeGridDropdown();
    }
  });

  // 切换SN修正功能 (去除首字符)
  window.toggleSnCorrection = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    snRemoveFirstCharEnabled = !snRemoveFirstCharEnabled;
    
    const toolContainer = document.getElementById('sn-correction-tool');
    const toggleBtn = document.getElementById('sn-correction-toggle');
    
    if (snRemoveFirstCharEnabled) {
      // 开启状态 - 绿色
      toolContainer.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      toggleBtn.innerHTML = t('scan.sn_tool_on');
      toggleBtn.style.color = '#059669';
      
      // 播放开启音效
      playTone(600, 0.1, 'sine');
      setTimeout(() => playTone(800, 0.1, 'sine'), 80);
      
      console.log('✅ SN修正已开启 - 将自动去除扫描内容的首字符');
    } else {
      // 关闭状态 - 灰色
      toolContainer.style.background = 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
      toggleBtn.innerHTML = t('scan.sn_tool_off');
      toggleBtn.style.color = '#475569';
      
      // 播放关闭音效
      playTone(800, 0.1, 'sine');
      setTimeout(() => playTone(600, 0.1, 'sine'), 80);
      
      console.log('⭕ SN修正已关闭');
    }
  };
  
  // 切换现役盘点位置预设功能
  window.toggleInUseLocationPreset = function() {
    assetInventoryData.inUseLocationPresetEnabled = !assetInventoryData.inUseLocationPresetEnabled;
    
    if (assetInventoryData.inUseLocationPresetEnabled) {
      // 开启时清除已选位置
      assetInventoryData.selectedPresetLocation = null;
    }
    
    saveData();
    
    // 重新渲染扫码界面
    inventoryRenderStep2();
    
    // 播放音效
    if (assetInventoryData.inUseLocationPresetEnabled) {
      playTone(600, 0.1, 'sine');
      setTimeout(() => playTone(800, 0.1, 'sine'), 80);
      console.log('✅ 位置预设已开启 - MTR会议室盘点模式');
    } else {
      playTone(800, 0.1, 'sine');
      setTimeout(() => playTone(600, 0.1, 'sine'), 80);
      console.log('⭕ 位置预设已关闭 - 恢复手动输入模式');
    }
  };
  
  // 选择预设位置(房间)
  window.selectPresetLocation = function(location) {
    if (!location) {
      console.log('⚠️ 选择了空值，忽略');
      return; // 空值不处理
    }
    
    console.log('📍 选择房间:', location);
    console.log('📍 之前的房间:', assetInventoryData.selectedPresetLocation);
    
    assetInventoryData.selectedPresetLocation = location;
    saveData();
    
    console.log('📍 更新后的房间:', assetInventoryData.selectedPresetLocation);
    
    // 播放音效
    playBellSound();
    
    // 只更新提示信息，不重新渲染整个区域
    updateLocationPresetMessage();
    
    // 聚焦到扫码输入框
    setTimeout(() => {
      const scanInput = document.getElementById('scan-input');
      if (scanInput) {
        scanInput.focus();
        console.log('✅ 已聚焦到扫码输入框');
      }
    }, 100);
  };
  
  // 更新位置预设提示信息
  function updateLocationPresetMessage() {
    const messageContainer = document.getElementById('location-preset-message');
    if (!messageContainer) {
      console.warn('⚠️ 找不到位置预设消息容器');
      return;
    }
    
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    if (assetInventoryData.selectedPresetLocation) {
      messageContainer.innerHTML = `
        <div style="margin-top: 12px; padding: 12px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; color: #047857; font-size: 13px;">
          ✓ 当前选择: <strong>${escapeHtml(assetInventoryData.selectedPresetLocation)}</strong> - 扫码后将自动比对位置
        </div>
      `;
    } else {
      messageContainer.innerHTML = `
        <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; color: #92400e; font-size: 13px;">
          ⚠️ 请先选择一个房间再开始扫码
        </div>
      `;
    }
  }
  
  // 处理扫码输入变化
  window.handleScanInputChange = function(event) {
    const input = event.target;
    const value = input.value.trim();
    
    // 清除之前的定时器
    if (scanInputTimer) {
      clearTimeout(scanInputTimer);
    }
    
    // 如果输入框有值,设置一个短暂延迟后自动处理
    // 扫描枪输入速度很快,通常在50-200ms内完成全部字符输入
    // 使用300ms延迟确保：1)所有字符已输入完 2)给Enter键发送时间
    if (value) {
      scanInputTimer = setTimeout(() => {
        // 再次检查值是否有变化（避免Enter已经处理过的情况）
        if (input.value.trim() && input.value.trim() === value) {
          console.log('⏰ 自动触发扫描处理(300ms无新输入)');
          processScan(input, true); // 标记为自动扫描
        }
      }, 300); // 300ms后如果没有新输入就自动处理
    }
  };

  // 手动输入提交
  window.submitManualInput = function() {
    const input = document.getElementById('manual-input');
    if (input && input.value.trim()) {
      console.log('✍️ 手动输入提交:', input.value.trim());
      processScan(input, false); // 标记为手动输入
    }
  };

  // 手动输入回车键处理
  window.handleManualInputKeypress = function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitManualInput();
    }
  };

  // 删除已扫描资产
  window.removeScannedAsset = function(index) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    if (index < 0 || index >= assetInventoryData.scannedAssets.length) {
      console.error('❌ 无效的索引:', index);
      return;
    }
    
    const asset = assetInventoryData.scannedAssets[index];
    const serialNumber = asset['Serial Number'] || asset['序列号'] || t('delete.unknown_device');
    
    // 确认删除
    const confirmMsg = `${t('delete.confirm_title')}\n\n` +
                       `Serial Number: ${serialNumber}\n` +
                       `Asset Tag: ${asset['Asset Tag'] || 'N/A'}\n` +
                       `Model: ${asset['Model'] || 'N/A'}`;
    
    if (confirm(confirmMsg)) {
      // 从数组中移除
      assetInventoryData.scannedAssets.splice(index, 1);
      
      // 同时检查并移除位置差异记录(如果存在)
      if (assetInventoryData.locationMismatches) {
        const mismatchIndex = assetInventoryData.locationMismatches.findIndex(
          m => m.serialNumber === serialNumber
        );
        if (mismatchIndex !== -1) {
          assetInventoryData.locationMismatches.splice(mismatchIndex, 1);
          console.log('🗑️ 同时删除位置差异记录');
        }
      }
      
      // 🆕 同时检查并移除"不在基准表"记录(如果存在)
      if (assetInventoryData.notFoundAssets) {
        const notFoundIndex = assetInventoryData.notFoundAssets.findIndex(
          a => String(a.scannedValue).trim().toUpperCase() === String(serialNumber).trim().toUpperCase()
        );
        if (notFoundIndex !== -1) {
          assetInventoryData.notFoundAssets.splice(notFoundIndex, 1);
          console.log('🗑️ 同时删除"不在基准表"记录');
        }
      }
      
      console.log('🗑️ 已删除资产:', serialNumber);
      
      // 保存数据并更新界面
      saveData();
      updateScanUI();
      
      // 显示删除成功提示
      showScanFeedback(t('delete.success', { serial: serialNumber }), 'success');
    }
  };

  // 处理扫描的核心逻辑
  // isAutoScan: true表示自动扫描(扫码枪), false表示手动输入
  function processScan(input, isAutoScan = true) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    let scannedValue = input.value.trim();
    
    if (!scannedValue) {
      // 空值,重新聚焦
      input.focus();
      return;
    }
    
    // 🔍 检查是否已选择货架位置
    const currentGridInput = document.getElementById('current-grid-reference');
    const currentGrid = currentGridInput ? currentGridInput.value.trim() : '';
    
    if (!currentGrid) {
      // 未选择货架位置,提示用户
      playErrorSound();
      showScanFeedback(t('feedback.select_grid_first'), 'warning');
      console.warn('⚠️ 用户未选择货架位置就开始扫描');
      
      // 高亮货架选择框提醒用户
      if (currentGridInput) {
        currentGridInput.style.borderColor = '#ef4444';
        currentGridInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
        currentGridInput.focus();
        
        // 3秒后恢复正常样式
        setTimeout(() => {
          currentGridInput.style.borderColor = '';
          currentGridInput.style.boxShadow = '';
        }, 3000);
      }
      
      // 清空输入框
      input.value = '';
      return;
    }
    
    // 🔧 SN修正功能只影响自动扫描,不影响手动输入
    let originalValue = scannedValue;
    if (isAutoScan && snRemoveFirstCharEnabled && scannedValue.length > 1) {
      scannedValue = scannedValue.substring(1);
      console.log(`✂️ SN修正(自动扫描): "${originalValue}" → "${scannedValue}"`);
    } else if (!isAutoScan) {
      console.log('✍️ 手动输入,跳过SN修正');
    }
    
    console.log('📷 扫描到代码:', scannedValue);
    console.log('📊 基准数据总数:', assetInventoryData.baselineData.length);
    
    // 打印第一条数据的所有字段名（用于调试）
    if (assetInventoryData.baselineData.length > 0) {
      const firstAsset = assetInventoryData.baselineData[0];
      console.log('📋 数据字段列表:', Object.keys(firstAsset));
      console.log('📄 第一条数据示例:', firstAsset);
    }
    
    // 先在基准数据中查找（支持 Serial Number、序列号 或 Asset Tag 匹配）
    // 使用灵活匹配来兼容不同的列名
    let foundAsset = null;
    let matchedField = '';
    
    for (let asset of assetInventoryData.baselineData) {
      for (let key in asset) {
        const fieldValue = String(asset[key]);
        // 大小写不敏感匹配
        if (fieldValue.trim().toUpperCase() === scannedValue.toUpperCase()) {
          foundAsset = asset;
          matchedField = key;
          console.log('✅ 匹配成功! 字段名:', key, '字段值:', fieldValue);
          break;
        }
      }
      if (foundAsset) break;
    }
    
    console.log('🔍 查找结果:', foundAsset ? '找到资产' : '未找到资产');
    if (foundAsset) {
      console.log('📦 找到的资产:', foundAsset);
      console.log('🎯 匹配的字段:', matchedField);
    }
    
    if (!foundAsset) {
      // 先检查是否已经记录过这个设备差异 (大小写不敏感)
      const alreadyNotFound = assetInventoryData.notFoundAssets && 
        assetInventoryData.notFoundAssets.some(item => 
          String(item.scannedValue).trim().toUpperCase() === String(scannedValue).trim().toUpperCase()
        );
      
      if (alreadyNotFound) {
        // 已经记录过的设备差异 - 提示重复扫描
        playVoice(t('diff.duplicate_scan')); // 语音提示
        showScanFeedback(t('diff.duplicate_recorded', { value: scannedValue }), 'warning');
        console.log('🔄 Duplicate scan of recorded device discrepancy:', scannedValue);
        
        // 记录扫描历史
        assetInventoryData.scanHistory.push({
          scannedValue: scannedValue,
          status: 'duplicate',
          timestamp: new Date().toISOString()
        });
        
        saveData();
        updateScanUI();
        
        input.value = '';
        setTimeout(() => input.focus(), 50);
        return;
      }
      
      // 未找到资产且未记录过 - 询问是否记录差异
      playVoice(t('diff.device_discrepancy')); // 语音提示设备差异
      
      // 获取当前Grid Reference作为默认值
      const currentGridInput = document.getElementById('current-grid-reference');
      const defaultGrid = currentGridInput ? currentGridInput.value.trim().toUpperCase() : '';
      
      // 使用自定义对话框来输入Grid Reference
      showGridReferenceDialog(scannedValue, defaultGrid, (result) => {
        if (!result) {
          // 用户取消或输入为空
          showScanFeedback(t('feedback.scan_cancelled', { value: scannedValue }), 'error');
          console.log('🚫 用户取消记录差异:', scannedValue);
          input.value = '';
          setTimeout(() => input.focus(), 50);
          return;
        }
        
        // 使用修改后的扫描值
        const finalScannedValue = result.scannedValue;
        const finalGrid = result.gridReferenc        // � 保存扫描前选择的位置（defaultGrid）用于PDF导出
        // finalGrid 用于显示在对话框中，但实际导出时使用 defaultGrid（扫描前选择的会议室）
        const currentLocationForExport = defaultGrid; // 这是扫描前选择的会议室
        
        // �🔄 重新在基准表中查找修改后的扫描值
        console.log('🔄 重新验证修改后的扫描值:', finalScannedValue);
        let reFoundAsset = null;
        let reMatchedField = null;
        
        for (let asset of assetInventoryData.baselineData) {
          for (let key in asset) {
            const fieldValue = String(asset[key]);
            // 大小写不敏感匹配
            if (fieldValue.trim().toUpperCase() === String(finalScannedValue).trim().toUpperCase()) {
              reFoundAsset = asset;
              reMatchedField = key;
              console.log('✅ 修改后找到匹配! 字段名:', key, '字段值:', fieldValue);
              break;
            }
          }
          if (reFoundAsset) break;
        }
        
        if (reFoundAsset) {
          // 🎉 修改后在基准表中找到了!
          console.log('🎉 修改后在基准表中找到资产!');
          console.log('📦 找到的资产:', reFoundAsset);
          
          // 检查是否已经扫描过
          // 🔧 修复：同时排除 foundSN/foundAT 为 'N/A' 的情况，防止多台设备共享 'N/A' 导致误判重复
          const isDuplicate = assetInventoryData.scannedAssets.some(scanned => {
            const scannedSN = getFieldValue(scanned, 'Serial Number', '序列号', 'SN', 'SerialNumber');
            const scannedAT = getFieldValue(scanned, 'Asset Tag', '资产标签', 'AssetTag');
            const foundSN = getFieldValue(reFoundAsset, 'Serial Number', '序列号', 'SN', 'SerialNumber');
            const foundAT = getFieldValue(reFoundAsset, 'Asset Tag', '资产标签', 'AssetTag');
            
            // 大小写不敏感比较，两端都不能是 N/A，否则不构成唯一标识
            return (scannedSN !== 'N/A' && foundSN !== 'N/A' && String(scannedSN).trim().toUpperCase() === String(foundSN).trim().toUpperCase()) || 
                   (scannedAT !== 'N/A' && foundAT !== 'N/A' && String(scannedAT).trim().toUpperCase() === String(foundAT).trim().toUpperCase());
          });
          
          if (isDuplicate) {
            playVoice(t('diff.duplicate_scan')); // 语音提示
            showScanFeedback(t('diff.duplicate_simple', { value: finalScannedValue }), 'warning');
            console.log('⚠️ Device already scanned');
            input.value = '';
            setTimeout(() => input.focus(), 50);
            return;
          }
          
          // 检查位置是否匹配
          const assetGrid = getFieldValue(reFoundAsset, 'Grid Reference', 'GridReference', 'Grid', '位置');
          const currentGridInput = document.getElementById('current-grid-reference');
          const currentGrid = currentGridInput ? currentGridInput.value.trim().toUpperCase() : '';
          
          if (assetGrid !== 'N/A' && currentGrid && assetGrid.toUpperCase() !== currentGrid) {
            // 位置不匹配 - 警告但仍然记录
            console.warn('⚠️ Location mismatch! Baseline:', assetGrid, 'Current shelf:', currentGrid);
            playVoice(t('diff.location_discrepancy')); // 语音提示位置差异
            showScanFeedback(`⚠️ Location mismatch! Should be at ${assetGrid}, currently at ${currentGrid}`, 'warning');
            
            // 记录位置差异
            if (!assetInventoryData.locationMismatches) {
              assetInventoryData.locationMismatches = [];
            }
            
            assetInventoryData.locationMismatches.push({
              serialNumber: getFieldValue(reFoundAsset, 'Serial Number', '序列号', 'SN', 'SerialNumber'),
              assetTag: getFieldValue(reFoundAsset, 'Asset Tag', '资产标签', 'AssetTag'),
              model: getFieldValue(reFoundAsset, 'Model', '型号'),
              actualLocation: currentGrid,
              systemLocation: assetGrid,
              inventoryPerson: assetInventoryData.currentInventoryPerson || assetInventoryData.inventoryPerson,
              scanTime: new Date().toISOString()
            });
            
            // 🆕 标记设备的位置已变更
            reFoundAsset._gridReferenceChanged = true;
            reFoundAsset._originalGridReference = assetGrid;
            reFoundAsset._actualGridReference = currentGrid;
          } else {
            // 位置匹配或没有位置信息
            playBellSound(); // 播放铃声
            showScanFeedback(t('feedback.scan_corrected', { value: finalScannedValue }), 'success');
          }
          
          // 添加到已扫描列表
          reFoundAsset.scanTime = new Date().toISOString();
          reFoundAsset.scannedBy = finalScannedValue; // 记录扫描的值
          reFoundAsset.inventoryPerson = assetInventoryData.currentInventoryPerson || assetInventoryData.inventoryPerson; // 记录盘点人
          reFoundAsset.actualGridReference = currentGrid || assetGrid; // 记录实际位置
          reFoundAsset._originalScannedValue = scannedValue; // 记录原始扫描值(修正前)
          reFoundAsset._correctedScannedValue = finalScannedValue; // 记录修正后的值
          reFoundAsset._matchedField = reMatchedField; // 记录匹配的字段
          
          assetInventoryData.scannedAssets.push(reFoundAsset);
          
          assetInventoryData.scanHistory.push({
            scannedValue: finalScannedValue,
            status: 'success',
            timestamp: new Date().toISOString(),
            matchedAsset: reFoundAsset,
            corrected: true, // 标记为手动修正
            originalValue: scannedValue
          });
          
          console.log('✅ 已添加到扫描列表 (修正后)');
          console.log('📊 当前已扫描资产数量:', assetInventoryData.scannedAssets.length);
          
          // 保存数据
          saveData();
          
          // 更新UI
          updateScanUI();
          
          input.value = '';
          setTimeout(() => input.focus(), 50);
          return;
        }
        
        // 修改后仍未找到 - 记录为差异
        console.log('❌ 修改后仍未在基准表中找到');
        
        // 用户确认记录差异
        // 如果还没有 notFoundAssets 数组，创建一个
        if (!assetInventoryData.notFoundAssets) {
          assetInventoryData.notFoundAssets = [];
        }
        
        // 添加到未找到列表,包含位置信息
        // 🔧 修复：保存扫描前选择的会议室位置（currentLocationForExport）到 selectedLocation
        // selectedLocation 用于PDF导出，显示扫描时的实际位置
        console.log('💾 保存notFoundAssets数据:', {
          scannedValue: finalScannedValue,
          gridReference: finalGrid,
          selectedLocation: currentLocationForExport,
          defaultGrid: defaultGrid
        });
        
        assetInventoryData.notFoundAssets.push({
          scannedValue: finalScannedValue,
          gridReference: finalGrid,  // 对话框中选择/输入的位置
          scanTime: new Date().toISOString(),
          selectedLocation: currentLocationForExport || assetInventoryData.selectedPresetLocation || ''  // 扫描前选择的会议室
        });
        
        // 🆕 同时添加到已扫描列表，方便用户查看和删除
        if (!assetInventoryData.scannedAssets.some(a => 
          String(a['Serial Number'] || '').trim().toUpperCase() === String(finalScannedValue).trim().toUpperCase()
        )) {
          assetInventoryData.scannedAssets.push({
            'Serial Number': finalScannedValue,
            'Asset Tag': 'N/A',
            'Model': 'N/A',
            'User': 'N/A',
            'Grid Reference': finalGrid,
            scanTime: new Date().toISOString(),
            inventoryPerson: assetInventoryData.currentInventoryPerson || assetInventoryData.inventoryPerson,
            actualGridReference: finalGrid,
            _isNotInBaseline: true  // 标记为不在基准表中的设备
          });
        }
        
        assetInventoryData.scanHistory.push({
          scannedValue: finalScannedValue,
          status: 'error',
          timestamp: new Date().toISOString()
        });
        
        showScanFeedback(t('feedback.diff_recorded', { value: finalScannedValue, location: finalGrid }), 'warning');
        console.log('📝 用户确认记录差异:', { scannedValue: finalScannedValue, gridReference: finalGrid });
        
        // 🆕 保存数据并更新UI
        saveData();
        updateScanUI();
        
        // 清空输入框并重新聚焦
        input.value = '';
        setTimeout(() => input.focus(), 50);
      });
      return; // 等待对话框回调
    } else {
      // 找到资产，检查是否已经扫描过这个设备
      console.log('🔄 检查是否重复扫描...');
      console.log('📊 当前已扫描数量:', assetInventoryData.scannedAssets.length);
      
      // 改进的重复检测：只比较唯一标识字段（Serial Number、序列号、Asset Tag等）
      // 不能比较Model等通用字段，否则同型号的设备会被误判为重复
      const uniqueFields = ['Serial Number', '序列号', 'Asset Tag', 'serial number', 'asset tag', 'SN', 'sn'];
      
      const alreadyScanned = assetInventoryData.scannedAssets.find(scannedAsset => {
        // 只检查唯一标识字段
        for (let field of uniqueFields) {
          const foundValue = foundAsset[field];
          const scannedValue = scannedAsset[field];
          
          // 如果这个字段在两个对象中都有值，且值相同，则认为是同一设备 (大小写不敏感)
          // 🔧 修复：排除 'N/A' 值 —— 'N/A' 不是唯一标识符，不能用于判重
          // 否则基准表中 Asset Tag 为空（上传后自动转为 N/A）的多台设备，
          // 会因为 'N/A' === 'N/A' 而被误判为重复扫描
          if (foundValue && scannedValue && 
              String(foundValue) !== 'undefined' && String(foundValue) !== 'null' && String(foundValue) !== '' &&
              String(foundValue).trim().toUpperCase() !== 'N/A' &&
              String(scannedValue) !== 'undefined' && String(scannedValue) !== 'null' && String(scannedValue) !== '' &&
              String(scannedValue).trim().toUpperCase() !== 'N/A' &&
              String(foundValue).trim().toUpperCase() === String(scannedValue).trim().toUpperCase()) {
            console.log(`🎯 通过字段 "${field}" 检测到重复:`, foundValue);
            return true;
          }
        }
        return false;
      });
      
      console.log('🔍 重复检查结果:', alreadyScanned ? '已扫描过' : '首次扫描');
      
      if (alreadyScanned) {
        // 重复扫描 - 提示后继续
        playDuplicateSound();
        assetInventoryData.scanHistory.push({
          scannedValue: scannedValue,
          status: 'duplicate',
          timestamp: new Date().toISOString(),
          matchedAsset: alreadyScanned
        });
        
        // 显示第一个非空字段作为标识
        let displayInfo = scannedValue;
        for (let key in alreadyScanned) {
          const val = alreadyScanned[key];
          if (val && val !== 'undefined' && val !== 'null' && val !== '' && 
              !key.includes('scan') && !key.includes('Scan')) {
            displayInfo = val;
            break;
          }
        }
        playVoice(t('diff.duplicate_scan')); // 语音提示
        showScanFeedback(t('diff.duplicate_simple', { value: displayInfo }), 'warning');
      } else {
        // 首次扫描 - 检查位置差异
        const currentGridInput = document.getElementById('current-grid-reference');
        const currentGrid = currentGridInput ? currentGridInput.value.trim().toUpperCase() : '';
        
        // 获取系统中的 Grid Reference
        const getFieldValue = (asset, ...possibleKeys) => {
          for (let key of possibleKeys) {
            if (asset[key] && asset[key] !== 'undefined' && asset[key] !== 'null') {
              return String(asset[key]).trim().toUpperCase();
            }
          }
          return '';
        };
        
        const systemGrid = getFieldValue(foundAsset, 'Grid Reference', 'grid reference', 'GridReference');
        
        // 检查位置差异
        if (currentGrid && systemGrid && currentGrid !== systemGrid) {
          // 位置不匹配 - 弹出确认对话框
          playVoice(t('diff.location_discrepancy')); // 语音提示位置差异
          
          const serialNumber = foundAsset['Serial Number'] || foundAsset['序列号'] || scannedValue;
          const confirmMsg = `${t('location.diff_title')}\n\n` +
                           `${t('location.diff_device', { serial: serialNumber })}\n` +
                           `${t('location.diff_current', { current: currentGrid })}\n` +
                           `${t('location.diff_system', { system: systemGrid })}\n\n` +
                           `${t('location.diff_confirm')}`;
          
          if (!confirm(confirmMsg)) {
            showScanFeedback(t('location.scan_cancelled'), 'error');
            input.value = '';
            setTimeout(() => input.focus(), 50);
            updateScanUI();
            saveData();
            return;
          }
          
          // 记录位置差异
          if (!assetInventoryData.locationMismatches) {
            assetInventoryData.locationMismatches = [];
          }
          
          assetInventoryData.locationMismatches.push({
            serialNumber: serialNumber,
            assetTag: foundAsset['Asset Tag'] || foundAsset['资产标签'] || '',
            model: foundAsset['Model'] || foundAsset['型号'] || '',
            actualLocation: currentGrid,
            systemLocation: systemGrid,
            inventoryPerson: assetInventoryData.currentInventoryPerson || assetInventoryData.inventoryPerson,
            scanTime: new Date().toISOString()
          });
          
          // 🆕 标记设备的位置已变更
          foundAsset._gridReferenceChanged = true;
          foundAsset._originalGridReference = systemGrid;
          foundAsset._actualGridReference = currentGrid;
          
          console.log('📍 记录位置差异:', {
            device: serialNumber,
            actual: currentGrid,
            system: systemGrid
          });
        }
        
        // 成功，添加到已扫描列表
        playBellSound(); // 播放铃声
        foundAsset.scanTime = new Date().toISOString();
        foundAsset.scannedBy = scannedValue; // 记录扫描的值（是 SN 还是 Asset Tag）
        foundAsset.inventoryPerson = assetInventoryData.currentInventoryPerson || assetInventoryData.inventoryPerson; // 记录盘点人
        foundAsset.actualGridReference = currentGrid || systemGrid; // 记录实际位置
        assetInventoryData.scannedAssets.push(foundAsset);
        assetInventoryData.scanHistory.push({
          scannedValue: scannedValue,
          status: 'success',
          timestamp: new Date().toISOString(),
          matchedAsset: foundAsset
        });
        
        console.log('✅ 扫描成功，已添加到列表:', foundAsset);
        console.log('📊 当前已扫描资产数量:', assetInventoryData.scannedAssets.length);
        
        showScanFeedback(t('feedback.scan_success', { value: scannedValue }), 'success');
      }
    }
    
    // 保存数据
    saveData();
    
    // 清空输入框并重新聚焦
    input.value = '';
    setTimeout(() => {
      input.focus();
    }, 50);
    
    // 更新UI
    updateScanUI();
  }

  // 处理扫码输入 - 回车键触发
  // 现役盘点模式 - 扫码输入处理
  window.handleInUseScanInput = function(event) {
    console.log('🔔 handleInUseScanInput 被调用', { key: event.key, value: event.target.value });
    
    if (event.key === 'Enter') {
      console.log('✅ 检测到回车键');
      event.preventDefault();
      
      const input = event.target;
      const serialNumber = input.value.trim();
      
      console.log('📝 输入值:', serialNumber);
      
      if (!serialNumber) {
        console.log('⚠️ 输入为空，退出');
        return;
      }
      
      // 扫码错误检测：检查位数是否为7位
      // 注意：MTR会议室盘点模式下不限制位数
      if (!assetInventoryData.inUseLocationPresetEnabled && serialNumber.length !== 7) {
        console.log('❌ 扫码错误：位数不正确', { 长度: serialNumber.length, 值: serialNumber });
        
        // 播放语音提示
        playVoice('扫码错误');
        
        // 显示扫码错误提示
        showScanErrorDialog(serialNumber, serialNumber.length);
        
        // 清空输入框
        input.value = '';
        
        return;
      }
      
      console.log('✅ 扫码验证通过', { 
        模式: assetInventoryData.inUseLocationPresetEnabled ? 'MTR会议室盘点' : '常规现役盘点',
        位数: serialNumber.length 
      });
      
      // SN修正 - 用户可以手动控制
      let processedSN = serialNumber;
      
      if (snRemoveFirstCharEnabled && processedSN.length > 1) {
        processedSN = processedSN.substring(1);
        console.log('✂️ SN修正已应用 - 去除首字符');
      }
      
      console.log('🔍 现役盘点扫码:', { 
        原始: serialNumber, 
        处理后: processedSN,
        SN修正: snRemoveFirstCharEnabled ? '已启用' : '已禁用',
        模式: assetInventoryData.inUseLocationPresetEnabled ? 'MTR会议室盘点' : '常规现役盘点'
      });
      
      // 清空输入框
      input.value = '';
      
      // 检查是否已经记录为"未找到"(设备差异) - 大小写不敏感
      const alreadyNotFound = assetInventoryData.notFoundAssets.some(
        a => String(a.scannedValue).trim().toUpperCase() === String(processedSN).trim().toUpperCase()
      );
      
      if (alreadyNotFound) {
        console.log('🔄 Duplicate scan of recorded device');
        playDuplicateVoice();
        showScanFeedback(t('diff.duplicate_device', { sn: processedSN }), 'warning');
        
        // 记录扫描历史
        assetInventoryData.scanHistory.push({
          serialNumber: processedSN,
          status: 'duplicate',
          timestamp: new Date().toISOString()
        });
        
        saveData();
        updateScanUI();
        return;
      }
      
      // 查找资产
      const asset = findAssetBySerialOrTag(processedSN);
      
      console.log('🔎 查找结果:', asset ? '找到资产' : '未找到', asset);
      
      if (asset) {
        // 显示位置确认对话框
        console.log('📍 准备显示位置确认对话框...');
        showLocationConfirmDialog(asset, processedSN);
      } else {
        // 未找到资产 - 显示设备确认对话框
        console.log('❌ 未找到资产，显示设备确认对话框');
        showDeviceNotFoundDialog(processedSN);
      }
    }
  };

  // 现役盘点模式 - 输入变化自动触发（扫码枪可能不发送回车）
  let inUseScanTimer = null;
  window.handleInUseScanInputChange = function(event) {
    const input = event.target;
    const value = input.value.trim();
    
    console.log('📝 现役盘点输入变化:', value);
    
    // 清除之前的定时器
    if (inUseScanTimer) {
      clearTimeout(inUseScanTimer);
    }
    
    // 如果输入框有值,设置一个短暂延迟后自动处理
    // 扫描枪输入速度很快,通常在50-200ms内完成全部字符输入
    if (value && value.length > 3) { // 至少3个字符才触发
      inUseScanTimer = setTimeout(() => {
        // 再次检查值是否有变化（避免Enter已经处理过的情况）
        if (input.value.trim() && input.value.trim() === value) {
          console.log('⏰ 现役盘点自动触发处理(300ms无新输入):', value);
          
          // 模拟回车事件
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          });
          
          // 手动设置target
          Object.defineProperty(enterEvent, 'target', {
            writable: false,
            value: input
          });
          
          handleInUseScanInput(enterEvent);
        }
      }, 300); // 300ms延迟，给扫码枪足够时间完成输入
    }
  };

  // 现役盘点模式 - 手动输入处理
  window.handleInUseManualInputKeypress = function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitInUseManualInput();
    }
  };

  window.submitInUseManualInput = function() {
    const input = document.getElementById('manual-input');
    if (!input) return;
    
    const serialNumber = input.value.trim();
    if (!serialNumber) {
      alert('请输入 Serial Number 或 Asset Tag');
      return;
    }
    
    // 手动输入不检查位数限制,允许任意长度
    console.log('📝 手动输入:', serialNumber);
    
    // SN修正
    let processedSN = serialNumber;
    if (snRemoveFirstCharEnabled && processedSN.length > 1) {
      processedSN = processedSN.substring(1);
    }
    
    // 清空输入框
    input.value = '';
    
    // 检查是否已经记录为"未找到"(设备差异) - 大小写不敏感
    console.log('🔍 检查 notFoundAssets 列表:', {
      processedSN,
      notFoundCount: assetInventoryData.notFoundAssets.length,
      notFoundList: assetInventoryData.notFoundAssets.map(a => a.scannedValue)
    });
    
    const alreadyNotFound = assetInventoryData.notFoundAssets.some(
      a => String(a.scannedValue).trim().toUpperCase() === String(processedSN).trim().toUpperCase()
    );
    
    console.log('🔍 alreadyNotFound 检查结果:', alreadyNotFound);
    
    if (alreadyNotFound) {
      console.log('🔄 重复输入已记录的设备');
      playDuplicateVoice();
      showScanFeedback(t('feedback.duplicate_input', { value: processedSN }), 'warning');
      
      // 记录扫描历史
      assetInventoryData.scanHistory.push({
        serialNumber: processedSN,
        status: 'duplicate',
        timestamp: new Date().toISOString()
      });
      
      saveData();
      updateScanUI();
      return;
    }
    
    // 查找资产
    const asset = findAssetBySerialOrTag(processedSN);
    
    console.log('🔍 findAssetBySerialOrTag 结果:', {
      processedSN,
      found: !!asset,
      assetDetails: asset ? { sn: asset['Serial Number'], tag: asset['Asset Tag'], model: asset.Model } : null
    });
    
    if (asset) {
      // 显示位置确认对话框
      showLocationConfirmDialog(asset, processedSN);
    } else {
      // 未找到资产 - 显示设备确认对话框
      console.log('❌ 未找到资产，显示设备确认对话框');
      showDeviceNotFoundDialog(processedSN);
    }
  };

  // 显示位置确认对话框(现役盘点专用)
  function showLocationConfirmDialog(asset, scannedCode) {
    console.log('📍 showLocationConfirmDialog 被调用', { asset, scannedCode });
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    // 检查是否重复扫描 (大小写不敏感)
    // 优先使用 Serial Number,如果为空则使用 Asset Tag
    const assetSN = String(asset['Serial Number'] || '').trim().toUpperCase();
    const assetTag = String(asset['Asset Tag'] || '').trim().toUpperCase();
    
    // 如果序列号和资产标签都为空,则不检查重复(允许扫描)
    const shouldCheckDuplicate = assetSN || assetTag;
    
    let alreadyScanned = null;
    if (shouldCheckDuplicate) {
      alreadyScanned = assetInventoryData.scannedAssets.find(a => {
        const scannedSN = String(a['Serial Number'] || '').trim().toUpperCase();
        const scannedTag = String(a['Asset Tag'] || '').trim().toUpperCase();
        
        // 如果有序列号,优先匹配序列号
        if (assetSN && scannedSN) {
          return scannedSN === assetSN;
        }
        
        // 否则匹配资产标签
        if (assetTag && scannedTag) {
          return scannedTag === assetTag;
        }
        
        return false;
      });
    }
    
    console.log('🔄 重复扫描检查:', alreadyScanned ? '是重复' : '不重复', 
      '| SN:', assetSN || '无', '| Tag:', assetTag || '无');
    
    if (alreadyScanned) {
      playDuplicateVoice();
      showScanFeedback(t('feedback.duplicate_scan', { value: scannedCode }), 'warning');
      
      // 记录扫描历史
      assetInventoryData.scanHistory.push({
        serialNumber: scannedCode,
        status: 'duplicate',
        timestamp: new Date().toISOString()
      });
      
      saveData();
      updateScanUI();
      return;
    }
    
    // 获取原位置信息
    const originalLocation = getFieldValue(
      asset,
      'Grid Reference',
      'Location',
      'User',
      'Department'
    );
    
    // ========== 位置预设模式 (MTR会议室盘点) ==========
    if (assetInventoryData.inUseLocationPresetEnabled) {
      console.log('🎯 位置预设模式已启用');
      
      // 检查是否已选择房间
      if (!assetInventoryData.selectedPresetLocation) {
        alert('⚠️ 请先选择一个房间再开始扫码！');
        playErrorSound();
        return;
      }
      
      const presetLocation = assetInventoryData.selectedPresetLocation;
      console.log('📍 预设位置:', presetLocation);
      console.log('📍 系统位置:', originalLocation);
      
      // 提取房间名称（去除括号中的城市标识）
      const extractRoomName = (location) => {
        if (!location) return '';
        const str = String(location).trim();
        // 如果包含括号，只取括号前的部分
        const match = str.match(/^([^(]+)/);
        return match ? match[1].trim().toUpperCase() : str.toUpperCase();
      };
      
      const presetRoomName = extractRoomName(presetLocation);
      const originalRoomName = extractRoomName(originalLocation);
      
      console.log('🏷️ 预设房间名:', presetRoomName);
      console.log('🏷️ 系统房间名:', originalRoomName);
      
      // 比对位置（只比较房间名称，忽略括号中的城市）
      const locationMatch = presetRoomName === originalRoomName;
      
      if (!locationMatch) {
        // 位置不匹配 - 显示差异提示
        console.log('⚠️ 位置差异检测到!');
        playLocationDifferenceVoice();
        
        const confirmed = confirm(
          `${t('location_confirm.title')}\n\n` +
          `${t('location_confirm.device', { serial: asset['Serial Number'] })}\n` +
          `${t('location_confirm.current_room', { current: presetLocation })}\n` +
          `${t('location_confirm.system_location', { system: originalLocation })}\n\n` +
          `${t('location_confirm.question')}`
        );
        
        if (!confirmed) {
          console.log('❌ 用户取消添加');
          showScanFeedback(t('location.scan_cancelled'), 'info');
          return;
        }
      } else {
        // 位置匹配
        console.log('✅ 位置匹配');
        playBellSound(); // 使用和库房盘点一样的铃声
      }
      
      // 自动添加资产（使用预设位置作为当前位置）
      const scannedAsset = { ...asset };
      scannedAsset.scanTime = new Date().toISOString();
      scannedAsset._scannedTime = scannedAsset.scanTime;
      scannedAsset._currentLocation = presetLocation;
      scannedAsset._originalLocation = originalLocation;
      scannedAsset._locationChanged = !locationMatch;
      scannedAsset._inventoryPerson = assetInventoryData.currentInventoryPerson;
      
      // 添加到已扫描列表
      assetInventoryData.scannedAssets.push(scannedAsset);
      
      // 如果位置有差异,添加到位置差异列表
      if (!locationMatch) {
        const mismatch = {
          serialNumber: asset['Serial Number'] || 'N/A',
          assetTag: asset['Asset Tag'] || 'N/A',
          model: asset['Model'] || 'N/A',
          actualLocation: presetLocation,
          systemLocation: originalLocation,
          inventoryPerson: assetInventoryData.currentInventoryPerson || assetInventoryData.inventoryPerson,
          scanTime: new Date().toISOString()
        };
        assetInventoryData.locationMismatches.push(mismatch);
        console.log('📍 已添加到位置差异列表:', mismatch);
      }
      
      // 记录扫描历史
      assetInventoryData.scanHistory.push({
        serialNumber: scannedCode,
        status: locationMatch ? 'success' : 'location_mismatch',
        timestamp: new Date().toISOString()
      });
      
      saveData();
      updateScanUI();
      
      // 显示反馈
      showScanFeedback(
        locationMatch ? 
          `✅ ${scannedCode} - 位置正确` : 
          `⚠️ ${scannedCode} - 位置差异已记录`,
        locationMatch ? 'success' : 'warning'
      );
      
      return; // 位置预设模式下直接返回，不显示对话框
    }
    // ========== 位置预设模式结束 ==========
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.id = 'location-confirm-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s;
    `;
    
    // 保存资产数据到临时变量,避免在HTML中传递复杂字符
    window._tempLocationConfirmData = {
      asset: asset,
      serialNumber: asset['Serial Number'],
      originalLocation: originalLocation,
      scannedCode: scannedCode
    };
    
    dialog.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 30px; max-width: 600px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <h3 style="color: #1e293b; font-size: 22px; margin-bottom: 20px; text-align: center;">
          ${t('location_dialog.title')}
        </h3>
        
        <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <div style="margin-bottom: 15px;">
            <div style="color: #64748b; font-size: 13px; margin-bottom: 5px;">Serial Number</div>
            <div style="font-family: monospace; font-weight: 600; color: #1e293b; font-size: 16px;">${escapeHtml(asset['Serial Number'])}</div>
          </div>
          <div style="margin-bottom: 15px;">
            <div style="color: #64748b; font-size: 13px; margin-bottom: 5px;">Asset Tag</div>
            <div style="font-family: monospace; font-weight: 600; color: #1e293b; font-size: 16px;">${escapeHtml(getFieldValue(asset, 'Asset Tag'))}</div>
          </div>
          <div>
            <div style="color: #64748b; font-size: 13px; margin-bottom: 5px;">Model</div>
            <div style="font-weight: 600; color: #1e293b;">${escapeHtml(getFieldValue(asset, 'Model'))}</div>
          </div>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
          <div style="color: #92400e; font-size: 14px; margin-bottom: 8px;">
            <strong>${t('location_dialog.baseline_location')}</strong>
          </div>
          <div style="font-family: monospace; font-weight: 600; color: #78350f; font-size: 15px;">
            ${escapeHtml(originalLocation)}
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #1e293b; font-weight: 600; margin-bottom: 10px;">
            ${t('location_dialog.current_location')}
          </label>
          <input 
            type="text" 
            id="location-input" 
            value="${escapeHtml(originalLocation)}"
            placeholder="${t('location_dialog.placeholder')}"
            style="width: 100%; padding: 12px 16px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 15px; font-family: monospace;"
            autofocus
          >
          <div style="color: #64748b; font-size: 13px; margin-top: 8px;">
            ${t('location_dialog.hint')}
          </div>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button 
            onclick="closeLocationDialog()" 
            style="background: #e2e8f0; color: #475569; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;"
          >
            ${t('location_dialog.cancel')}
          </button>
          <button 
            onclick="confirmLocationFromTemp()" 
            style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;"
          >
            ${t('location_dialog.confirm')}
          </button>
        </div>
      </div>
    `;
    
    console.log('🎨 对话框HTML已生成，准备添加到body');
    document.body.appendChild(dialog);
    console.log('✅ 对话框已添加到DOM');
    
    // 播放提示音,提醒用户确认位置
    console.log('🔔 播放提示铃声');
    playBellSound();
    
    // 聚焦到输入框
    setTimeout(() => {
      const locationInput = document.getElementById('location-input');
      if (locationInput) {
        console.log('🎯 找到location-input，设置焦点');
        locationInput.focus();
        locationInput.select();
        
        // 回车确认
        locationInput.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmLocationFromTemp();
          }
        });
      }
    }, 100);
  };

  // 从临时数据确认位置
  window.confirmLocationFromTemp = function() {
    if (!window._tempLocationConfirmData) {
      alert('数据丢失，请重新扫描');
      closeLocationDialog();
      return;
    }
    
    const { serialNumber, originalLocation, scannedCode } = window._tempLocationConfirmData;
    confirmLocation(serialNumber, originalLocation, scannedCode);
  };

  // 关闭位置对话框
  window.closeLocationDialog = function() {
    // 清理临时数据
    delete window._tempLocationConfirmData;
    
    const dialogs = document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 10000"]');
    dialogs.forEach(dialog => dialog.remove());
    
    // 重新聚焦到扫码输入框
    setTimeout(() => {
      const scanInput = document.getElementById('scan-input');
      if (scanInput) scanInput.focus();
    }, 100);
  };

  // 显示扫码错误对话框
  function showScanErrorDialog(scannedCode, length) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    console.log('❌ 显示扫码错误对话框:', { 扫码值: scannedCode, 长度: length });
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    dialog.innerHTML = `
      <div style="
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(239, 68, 68, 0.3);
        max-width: 500px;
        width: 90%;
        border: 3px solid #ef4444;
      ">
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="font-size: 64px; margin-bottom: 15px;">⚠️</div>
          <h3 style="color: #dc2626; font-size: 24px; margin: 0 0 10px 0; font-weight: 700;">
            ${t('scan_error.title')}
          </h3>
          <p style="color: #64748b; font-size: 15px; margin: 0;">
            ${t('scan_error.subtitle')}
          </p>
        </div>
        
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
          <div style="color: #991b1b; font-size: 14px; margin-bottom: 8px;">
            <strong>${t('scan_error.reason')}</strong> ${t('scan_error.reason_text')}
          </div>
          <div style="color: #991b1b; font-size: 14px; margin-bottom: 8px;">
            <strong>${t('scan_error.scanned_value')}</strong> <span style="font-family: monospace; background: white; padding: 2px 8px; border-radius: 4px;">${escapeHtml(scannedCode)}</span>
          </div>
          <div style="color: #991b1b; font-size: 14px; margin-bottom: 8px;">
            <strong>${t('scan_error.actual_length')}</strong> ${length} ${t('scan_error.actual_length').includes('位') ? '位' : 'digits'}
          </div>
          <div style="color: #991b1b; font-size: 14px;">
            <strong>${t('scan_error.required_length')}</strong> 7 ${t('scan_error.required_length').includes('位') ? '位' : 'digits'}
          </div>
        </div>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
          <div style="color: #1e40af; font-size: 13px; line-height: 1.6;">
            💡 <strong>${t('scan_error.tip_title')}</strong><br>
            ${t('scan_error.tip_1')}<br>
            ${t('scan_error.tip_2')}<br>
            ${t('scan_error.tip_3')}<br>
            ${t('scan_error.tip_4')}
          </div>
        </div>
        
        <div style="text-align: center;">
          <button 
            onclick="closeScanErrorDialog()" 
            style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; min-width: 160px;"
          >
            ${t('scan_error.button_rescan')}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 自动聚焦关闭按钮，支持回车关闭
    setTimeout(() => {
      const button = dialog.querySelector('button');
      if (button) {
        button.focus();
        button.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            closeScanErrorDialog();
          }
        });
      }
    }, 100);
  }

  // 关闭扫码错误对话框
  window.closeScanErrorDialog = function() {
    const dialogs = document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 10000"]');
    dialogs.forEach(dialog => dialog.remove());
    
    // 重新聚焦到扫码输入框
    setTimeout(() => {
      const scanInput = document.getElementById('scan-input');
      if (scanInput) {
        scanInput.value = '';
        scanInput.focus();
      }
    }, 100);
  };

  // 显示设备确认对话框（未在基准表中找到）
  function showDeviceNotFoundDialog(scannedCode) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    console.log('🔴 显示设备确认对话框:', scannedCode);
    
    // 获取上一个记录的位置（从最近的扫描记录中获取）
    let lastLocation = '';
    if (assetInventoryData.scannedAssets.length > 0) {
      const lastAsset = assetInventoryData.scannedAssets[assetInventoryData.scannedAssets.length - 1];
      lastLocation = lastAsset._currentLocation || '';
    } else if (assetInventoryData.notFoundAssets.length > 0) {
      const lastNotFound = assetInventoryData.notFoundAssets[assetInventoryData.notFoundAssets.length - 1];
      lastLocation = lastNotFound.location || '';
    }
    
    console.log('📍 上一个记录位置:', lastLocation);
    
    // 播放语音提示：请手动输入位置
    console.log('� 播放语音提示：请手动输入位置');
    playVoice('请手动输入位置');
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s;
    `;
    
    dialog.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 35px; max-width: 600px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 3px solid #3b82f6;">
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="font-size: 64px; margin-bottom: 15px;">📋</div>
          <h3 style="color: #1e40af; font-size: 24px; margin: 0 0 10px 0;">
            ${t('notfound.dialog_title')}
          </h3>
          <div style="color: #64748b; font-size: 15px;">
            ${t('notfound.dialog_subtitle')}
          </div>
        </div>
        
        <div style="background: #eff6ff; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
          <div style="color: #1e40af; font-size: 14px; margin-bottom: 10px;">
            <strong>${t('notfound.scanned_label')}</strong>
          </div>
          <input 
            type="text" 
            id="device-not-found-input" 
            value="${escapeHtml(scannedCode)}"
            style="width: 100%; font-family: monospace; font-weight: 700; color: #1e40af; font-size: 18px; background: white; padding: 14px; border: 2px solid #93c5fd; border-radius: 8px; text-align: center;"
            placeholder="${t('notfound.input_placeholder')}"
          >
          <div style="color: #1e40af; font-size: 12px; margin-top: 8px; text-align: center;">
            ${t('notfound.input_hint')}
          </div>
        </div>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
          <div style="color: #1e40af; font-size: 14px; margin-bottom: 10px;">
            <strong>${t('notfound.location_label')}</strong>
          </div>
          <input 
            type="text" 
            id="device-not-found-location-input" 
            value="${escapeHtml(lastLocation)}"
            style="width: 100%; font-weight: 600; color: #1e40af; font-size: 16px; background: white; padding: 14px; border: 2px solid #93c5fd; border-radius: 8px; text-align: center;"
            placeholder="${t('notfound.location_placeholder')}"
          >
          <div style="color: #1e40af; font-size: 12px; margin-top: 8px; text-align: center;">
            ${t('notfound.location_hint')}
          </div>
        </div>
        
        <div style="background: #fffbeb; padding: 18px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
          <div style="color: #92400e; font-size: 14px; line-height: 1.8;">
            <strong>${t('notfound.possible_reasons')}</strong><br/>
            ${t('notfound.reason1')}<br/>
            ${t('notfound.reason2')}<br/>
            ${t('notfound.reason3')}
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 20px;">
          <button 
            onclick="retryDeviceSearch()" 
            style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);"
            onmouseover="this.style.transform='scale(1.02)'" 
            onmouseout="this.style.transform='scale(1)'"
          >
            ${t('notfound.retry_button')}
          </button>
          <button 
            onclick="cancelDeviceNotFound()" 
            style="background: #e2e8f0; color: #475569; border: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;"
            onmouseover="this.style.background='#cbd5e1'" 
            onmouseout="this.style.background='#e2e8f0'"
          >
            ${t('notfound.cancel_button')}
          </button>
          <button 
            onclick="confirmDeviceNotFound()" 
            style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);"
            onmouseover="this.style.transform='scale(1.02)'" 
            onmouseout="this.style.transform='scale(1)'"
          >
            ${t('notfound.confirm_button')}
          </button>
        </div>
        
        <div style="color: #64748b; font-size: 13px; text-align: center; line-height: 1.6;">
          ${t('notfound.hint_rescan')}<br/>
          ${t('notfound.hint_confirm')}
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    console.log('✅ 设备确认对话框已添加到DOM');
    
    // 聚焦到输入框
    setTimeout(() => {
      const input = document.getElementById('device-not-found-input');
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  }

  // 取消设备确认
  window.cancelDeviceNotFound = function() {
    console.log('❌ 用户取消设备确认');
    closeLocationDialog();
    
    // 重新聚焦到扫码输入框
    setTimeout(() => {
      const scanInput = document.getElementById('scan-input');
      if (scanInput) {
        scanInput.focus();
        scanInput.value = ''; // 清空输入框
      }
    }, 100);
  };

  // 确认设备信息
  window.confirmDeviceNotFound = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    const input = document.getElementById('device-not-found-input');
    const locationInput = document.getElementById('device-not-found-location-input');
    
    if (!input) return;
    
    const scannedCode = input.value.trim();
    const location = locationInput ? locationInput.value.trim() : '';
    
    console.log('✅ 用户确认设备信息:', scannedCode, '位置:', location);
    
    // 验证位置是否已填写
    if (!location) {
      alert('⚠️ 请输入设备位置');
      if (locationInput) locationInput.focus();
      return;
    }
    
    // 记录到未找到列表(使用正确的字段名,并包含位置信息) - 大小写不敏感去重
    if (!assetInventoryData.notFoundAssets.some(a => 
      String(a.scannedValue).trim().toUpperCase() === String(scannedCode).trim().toUpperCase()
    )) {
      console.log('💾 保存notFoundAssets数据(现役盘点):', {
        scannedValue: scannedCode,
        gridReference: location,
        selectedLocation: assetInventoryData.selectedPresetLocation
      });
      
      assetInventoryData.notFoundAssets.push({
        scannedValue: scannedCode,      // 修正: 使用 scannedValue 而不是 scannedCode
        location: location,             // 保留: 兼容旧版本
        gridReference: location,        // 🔧 修复: 将用户输入的位置保存到 gridReference 字段
        scanTime: new Date().toISOString(),  // 修正: 使用 scanTime 而不是 timestamp
        selectedLocation: assetInventoryData.selectedPresetLocation || ''  // 保存当时选择的扫描位置
      });
    }
    
    // 🆕 同时添加到已扫描列表，方便用户查看和删除
    if (!assetInventoryData.scannedAssets.some(a => 
      String(a['Serial Number'] || '').trim().toUpperCase() === String(scannedCode).trim().toUpperCase()
    )) {
      assetInventoryData.scannedAssets.push({
        'Serial Number': scannedCode,
        'Asset Tag': 'N/A',
        'Model': 'N/A',
        'User': 'N/A',
        'Grid Reference': location,  // 🔧 修复：将用户输入的位置保存到 Grid Reference
        '_currentLocation': location,
        '_originalLocation': '',
        '_locationChanged': false,
        '_scannedTime': new Date().toISOString(),
        '_isNotInBaseline': true  // 标记为不在基准表中的设备
      });
    }
    
    // 记录扫描历史
    assetInventoryData.scanHistory.push({
      serialNumber: scannedCode,
      status: 'error',
      timestamp: new Date().toISOString()
    });
    
    // 显示反馈
    showScanFeedback(t('feedback.device_recorded', { value: scannedCode, location: location }), 'success');
    
    saveData();
    updateScanUI();
    
    // 关闭对话框
    closeLocationDialog();
    
    // 重新聚焦到扫码输入框
    setTimeout(() => {
      const scanInput = document.getElementById('scan-input');
      if (scanInput) scanInput.focus();
    }, 100);
  };

  // 重新查找设备（使用修改后的序列号）
  window.retryDeviceSearch = function() {
    const input = document.getElementById('device-not-found-input');
    if (!input) return;
    
    const newCode = input.value.trim();
    console.log('🔄 重新查找设备:', newCode);
    
    if (!newCode) {
      alert('请输入序列号或资产标签');
      return;
    }
    
    // 查找资产
    const asset = findAssetBySerialOrTag(newCode);
    
    if (asset) {
      console.log('✅ 找到资产！显示位置确认对话框');
      // 关闭当前对话框
      closeLocationDialog();
      
      // 显示位置确认对话框
      setTimeout(() => {
        showLocationConfirmDialog(asset, newCode);
      }, 100);
    } else {
      console.log('❌ 仍未找到资产');
      // 更新输入框样式提示
      input.style.borderColor = '#ef4444';
      input.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.2)';
      
      // 播放错误音效
      playErrorVoice('设备差异请确认');
      
      // 弹出提示
      alert(`仍未找到设备: ${newCode}\n\n请检查输入是否正确，或确认此设备是否在基准表中。`);
      
      // 恢复样式
      setTimeout(() => {
        input.style.borderColor = '#fca5a5';
        input.style.boxShadow = '';
        input.focus();
        input.select();
      }, 2000);
    }
  };

  // 确认位置
  window.confirmLocation = function(serialNumber, originalLocation, scannedCode) {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    const locationInput = document.getElementById('location-input');
    if (!locationInput) return;
    
    const currentLocation = locationInput.value.trim();
    
    // 查找资产 (大小写不敏感)
    const asset = assetInventoryData.baselineData.find(
      a => String(a['Serial Number']).trim().toUpperCase() === String(serialNumber).trim().toUpperCase()
    );
    
    if (!asset) {
      console.error('❌ 未找到资产:', { 
        serialNumber, 
        baselineCount: assetInventoryData.baselineData.length,
        firstFewSNs: assetInventoryData.baselineData.slice(0, 5).map(a => a['Serial Number'])
      });
      alert('未找到资产数据');
      return;
    }
    
    // 创建扫描记录(包含位置信息)
    const scannedAsset = { ...asset };
    scannedAsset._currentLocation = currentLocation;
    scannedAsset._originalLocation = originalLocation;
    scannedAsset._locationChanged = (currentLocation !== originalLocation);
    scannedAsset._scannedTime = new Date().toISOString();
    scannedAsset.inventoryPerson = assetInventoryData.currentInventoryPerson || assetInventoryData.inventoryPerson; // 记录盘点人
    
    // 添加到已扫描列表
    assetInventoryData.scannedAssets.push(scannedAsset);
    
    // 如果位置有变化,记录到位置差异列表
    if (scannedAsset._locationChanged) {
      // 检查是否已存在(避免重复)
      const exists = assetInventoryData.locationMismatches.some(
        item => item.serialNumber === serialNumber || item.assetTag === asset['Asset Tag']
      );
      
      if (!exists) {
        assetInventoryData.locationMismatches.push({
          serialNumber: serialNumber,
          assetTag: asset['Asset Tag'] || 'N/A',
          model: asset['Model'] || 'N/A',
          actualLocation: currentLocation,      // 修正: 实际位置
          systemLocation: originalLocation,     // 修正: 系统位置(基准表中的位置)
          inventoryPerson: assetInventoryData.currentInventoryPerson || assetInventoryData.inventoryPerson,
          scanTime: new Date().toISOString()
        });
      }
    }
    
    // 记录扫描历史
    const historyStatus = scannedAsset._locationChanged ? 'warning' : 'success';
    assetInventoryData.scanHistory.push({
      serialNumber: scannedCode,
      status: historyStatus,
      timestamp: new Date().toISOString(),
      locationChanged: scannedAsset._locationChanged
    });
    
    saveData();
    
    // 播放音效和提示
    if (scannedAsset._locationChanged) {
      // 位置有变化时,播放"位置差异"语音提示
      playLocationDifferenceVoice();
      showScanFeedback(t('feedback.location_changed'), 'warning');
    } else {
      // 位置无变化时,播放铃声
      playBellSound();
      showScanFeedback(t('feedback.location_unchanged'), 'success');
    }
    
    // 清理临时数据
    delete window._tempLocationConfirmData;
    
    // 关闭对话框
    closeLocationDialog();
    
    // 更新UI
    updateScanUI();
  };

  // 播放位置差异语音
  function playLocationDifferenceVoice() {
    if ('speechSynthesis' in window) {
      // 如果声音列表还没加载，先加载
      if (!voicesLoaded || availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          voicesLoaded = true;
        }
      }

      // 停止之前的语音
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance('Location discrepancy');
      
      // 设置为英文台湾女性声音
      utterance.lang = 'zh-TW'; // 台湾中文语言代码
      utterance.rate = 1.1; // 语速适中
      utterance.pitch = 1.1; // 音调稍高（女性声音）
      utterance.volume = 1.0;
      
      // 优先选择台湾女性英文声音
      const preferredVoices = [
        'Mei-Jia',           // macOS 台湾女性声音
        'Ting-Ting',         // macOS 台湾女性声音
        'Samantha',          // macOS 美式女性英文声音
        'Karen',             // macOS 澳洲女性英文声音
        'Google US English', // Chrome 美式女性英文
        'Microsoft Zira'     // Windows 美式女性英文
      ];
      
      // 查找匹配的声音（使用缓存的声音列表）
      for (const voiceName of preferredVoices) {
        const voice = availableVoices.find(v => 
          v.name.includes(voiceName) || 
          v.name.toLowerCase().includes(voiceName.toLowerCase())
        );
        if (voice) {
          utterance.voice = voice;
          console.log('🔊 使用位置差异语音:', voice.name);
          break;
        }
      }
      
      // 如果没找到特定声音，使用英文女性声音
      if (!utterance.voice) {
        const femaleEnglishVoice = voices.find(v => 
          (v.lang.startsWith('en') || v.lang.startsWith('zh-TW')) && 
          v.name.toLowerCase().includes('female')
        );
        if (femaleEnglishVoice) {
          utterance.voice = femaleEnglishVoice;
        }
      }
      
      window.speechSynthesis.speak(utterance);
      console.log('🔊 播放位置差异语音: Location discrepancy');
    }
  }

  // 播放错误语音
  function playErrorVoice(message) {
    if ('speechSynthesis' in window) {
      // 如果声音列表还没加载，先加载
      if (!voicesLoaded || availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          voicesLoaded = true;
        }
      }

      // 停止之前的语音
      window.speechSynthesis.cancel();
      
      // 语音提示映射表（中文 -> 英文）
      const voiceMap = {
        '设备差异请确认': 'Device discrepancy, please confirm'
      };
      
      // 如果是中文文本且有映射，使用英文
      const voiceText = voiceMap[message] || message;
      
      const utterance = new SpeechSynthesisUtterance(voiceText);
      
      // 设置为英文台湾女性声音
      utterance.lang = 'zh-TW'; // 台湾中文语言代码
      utterance.rate = 1.1; // 语速适中
      utterance.pitch = 1.1; // 音调稍高（女性声音）
      utterance.volume = 1.0;
      
      // 优先选择台湾女性英文声音
      const preferredVoices = [
        'Mei-Jia',           // macOS 台湾女性声音
        'Ting-Ting',         // macOS 台湾女性声音
        'Samantha',          // macOS 美式女性英文声音
        'Karen',             // macOS 澳洲女性英文声音
        'Google US English', // Chrome 美式女性英文
        'Microsoft Zira'     // Windows 美式女性英文
      ];
      
      // 查找匹配的声音（使用缓存的声音列表）
      for (const voiceName of preferredVoices) {
        const voice = availableVoices.find(v => 
          v.name.includes(voiceName) || 
          v.name.toLowerCase().includes(voiceName.toLowerCase())
        );
        if (voice) {
          utterance.voice = voice;
          console.log('🔊 使用错误提示语音:', voice.name);
          break;
        }
      }
      
      // 如果没找到特定声音，使用英文女性声音
      if (!utterance.voice) {
        const femaleEnglishVoice = availableVoices.find(v => 
          (v.lang.startsWith('en') || v.lang.startsWith('zh-TW')) && 
          v.name.toLowerCase().includes('female')
        );
        if (femaleEnglishVoice) {
          utterance.voice = femaleEnglishVoice;
        }
      }
      
      window.speechSynthesis.speak(utterance);
      console.log('🔊 播放错误提示语音:', voiceText, '(原文:', message, ')');
    }
  }

  // 播放重复扫码语音
  function playDuplicateVoice() {
    if ('speechSynthesis' in window) {
      // 如果声音列表还没加载，先加载
      if (!voicesLoaded || availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          voicesLoaded = true;
        }
      }

      // 停止之前的语音
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance('Duplicate scan');
      
      // 设置为英文台湾女性声音
      utterance.lang = 'zh-TW'; // 台湾中文语言代码
      utterance.rate = 1.1; // 语速适中
      utterance.pitch = 1.1; // 音调稍高（女性声音）
      utterance.volume = 1.0;
      
      // 优先选择台湾女性英文声音
      const preferredVoices = [
        'Mei-Jia',           // macOS 台湾女性声音
        'Ting-Ting',         // macOS 台湾女性声音
        'Samantha',          // macOS 美式女性英文声音
        'Karen',             // macOS 澳洲女性英文声音
        'Google US English', // Chrome 美式女性英文
        'Microsoft Zira'     // Windows 美式女性英文
      ];
      
      // 查找匹配的声音（使用缓存的声音列表）
      for (const voiceName of preferredVoices) {
        const voice = availableVoices.find(v => 
          v.name.includes(voiceName) || 
          v.name.toLowerCase().includes(voiceName.toLowerCase())
        );
        if (voice) {
          utterance.voice = voice;
          console.log('🔊 使用重复扫码语音:', voice.name);
          break;
        }
      }
      
      // 如果没找到特定声音，使用英文女性声音
      if (!utterance.voice) {
        const femaleEnglishVoice = availableVoices.find(v => 
          (v.lang.startsWith('en') || v.lang.startsWith('zh-TW')) && 
          v.name.toLowerCase().includes('female')
        );
        if (femaleEnglishVoice) {
          utterance.voice = femaleEnglishVoice;
        }
      }
      
      window.speechSynthesis.speak(utterance);
      console.log('🔊 播放重复扫码语音: Duplicate scan');
    }
  }

  // 库房盘点模式 - 扫码输入处理
  window.handleScanInput = function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      
      // 清除自动触发的定时器
      if (scanInputTimer) {
        clearTimeout(scanInputTimer);
        scanInputTimer = null;
      }
      
      const input = event.target;
      processScan(input, true); // 标记为自动扫描
    }
  };

  // 更新扫描UI
  function updateScanUI() {
    // 更新界面
    const recentScansContainer = document.getElementById('recent-scans-container');
    if (recentScansContainer) {
      recentScansContainer.innerHTML = renderRecentScans();
    }
    
    // 更新已扫描列表
    const scannedListContent = document.getElementById('scanned-list-content');
    if (scannedListContent) {
      scannedListContent.innerHTML = renderScannedList();
    }
    
    updateStats();
  }

  // 显示扫描反馈
  function showScanFeedback(message, type) {
    const colors = {
      'success': { bg: '#dcfce7', color: '#047857' },
      'error': { bg: '#fee2e2', color: '#dc2626' },
      'warning': { bg: '#fef3c7', color: '#92400e' },
      'info': { bg: '#dbeafe', color: '#1e40af' }
    };
    
    const config = colors[type] || colors['info'];
    
    // 创建浮动提示
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${config.bg};
      color: ${config.color};
      padding: 15px 25px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
      pointer-events: none;
    `;
    feedback.textContent = message;
    
    document.body.appendChild(feedback);
    
    // 确保输入框保持焦点
    setTimeout(() => {
      const scanInput = document.getElementById('scan-input');
      if (scanInput) {
        scanInput.focus();
      }
    }, 50);
    
    setTimeout(() => {
      feedback.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(feedback);
        // 提示框移除后再次确保输入框有焦点
        const scanInput = document.getElementById('scan-input');
        if (scanInput) {
          scanInput.focus();
        }
      }, 300);
    }, 2000);
  }
  
  // 将 showScanFeedback 暴露为全局函数供其他函数使用
  window.showAssetInventoryFeedback = showScanFeedback;

  // 完成盘点
  window.completeInventory = function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    if (assetInventoryData.scannedAssets.length === 0) {
      alert(t('complete.no_scan'));
      return;
    }
    
    if (confirm(t('complete.confirm'))) {
      assetInventoryData.inventoryEndTime = new Date().toISOString();
      assetInventoryData.currentStep = 3;
      saveData();
      
      // 添加到日报统计
      if (window.addEventToDailyReport) {
        const inventoriedCount = assetInventoryData.scannedAssets.length;
        const expectedCount = assetInventoryData.baselineData ? assetInventoryData.baselineData.length : 0;
        const modeText = assetInventoryData.inventoryMode === 'warehouse' ? 'Warehouse Inventory' : 
                        assetInventoryData.inventoryMode === 'inuse' ? 'In-Use Inventory' : 'Asset Inventory';
        
        window.addEventToDailyReport({
          type: 'completed',
          description: `Completed ${modeText} - Inventoried ${inventoriedCount}/${expectedCount} assets`,
          metadata: {
            'Inventory Mode': modeText,
            'Inventoried': `${inventoriedCount} items`,
            'Baseline': `${expectedCount} items`,
            'Coverage': expectedCount > 0 ? `${(inventoriedCount / expectedCount * 100).toFixed(1)}%` : 'N/A',
            'Start Time': assetInventoryData.inventoryStartTime ? new Date(assetInventoryData.inventoryStartTime).toLocaleString('en-US') : 'N/A',
            'Completion Time': new Date().toLocaleString('en-US')
          },
          source: 'Asset Inventory',
          silent: false
        });
      }
      
      playCompleteSound();
      inventoryRenderStep3();
    }
  };

  // 渲染步骤3 - 差异报告
  window.inventoryRenderStep3 = function() {
    // Gate: 必须已扫描资产
    if (!canProceedToStep(4)) {
      alert(getStepBlockReason(4));
      return;
    }
    assetInventoryData.currentStep = 3;
    saveData();
    
    const t = window.assetInventoryI18n?.t || ((key) => key);
    
    const stepIndicator = document.getElementById('step-indicator-horizontal');
    if (stepIndicator) {
      stepIndicator.innerHTML = renderStepIndicatorHTML(4);
    }
    
    const resultSection = document.getElementById('inventory-result-section');
    if (resultSection) {
      resultSection.innerHTML = renderDifferenceReport();
    }
    
    // 清空其他区域
    document.getElementById('inventory-upload-section').innerHTML = '';
    document.getElementById('inventory-scan-section').innerHTML = '';
    
    updateStats();
  };

  // 生成差异报告
  function generateDifferenceData() {
    const scanned = assetInventoryData.scannedAssets.map(a => a['Serial Number']);
    const baseline = assetInventoryData.baselineData;
    
    // 🔧 清理 notFoundAssets:移除现在已经在基准表中的记录
    if (assetInventoryData.notFoundAssets && assetInventoryData.notFoundAssets.length > 0) {
      const originalCount = assetInventoryData.notFoundAssets.length;
      assetInventoryData.notFoundAssets = assetInventoryData.notFoundAssets.filter(notFoundItem => {
        const scannedValue = notFoundItem.scannedValue;
        if (!scannedValue) return false; // 移除无效数据
        
        // 检查这个扫描值是否现在能在基准表中找到(大小写不敏感)
        const foundInBaseline = baseline.some(asset => {
          for (let key in asset) {
            const fieldValue = String(asset[key]);
            if (fieldValue.trim().toUpperCase() === String(scannedValue).trim().toUpperCase()) {
              return true;
            }
          }
          return false;
        });
        
        // 如果在基准表中找到了,就不保留在 notFoundAssets 中
        return !foundInBaseline;
      });
      
      const cleanedCount = originalCount - assetInventoryData.notFoundAssets.length;
      if (cleanedCount > 0) {
        console.log(`🧹 已清理 ${cleanedCount} 条现在已在基准表中的记录`);
        saveData(); // 保存清理后的数据
      }
    }
    
    // 已盘点
    const inventoried = assetInventoryData.scannedAssets;
    
    // 未盘点
    const missing = baseline.filter(asset => 
      !scanned.includes(asset['Serial Number'])
    );
    
    // 重复扫描 - 从 scanHistory 中提取
    const duplicates = assetInventoryData.scanHistory
      .filter(scan => scan.status === 'duplicate')
      .map(scan => {
        // 尝试多种方式获取标识符
        if (scan.serialNumber) return scan.serialNumber;
        if (scan.scannedValue) return scan.scannedValue;
        if (scan.matchedAsset) {
          // 从匹配的资产中提取序列号
          return scan.matchedAsset['Serial Number'] || 
                 scan.matchedAsset.serialNumber || 
                 scan.matchedAsset['Asset Tag'] || 
                 scan.matchedAsset.assetTag;
        }
        return null;
      })
      .filter(item => item); // 过滤掉 null/undefined
    
    // 未找到的(不在基准表中) - 从 notFoundAssets 获取，并去重保留最后一次扫描
    const notFoundRaw = assetInventoryData.notFoundAssets || [];
    
    // 使用 Map 来去重，key 是 scannedValue，value 是整个记录对象
    // 后面的记录会覆盖前面的记录，从而保留最后一次扫描
    const notFoundMap = new Map();
    notFoundRaw.forEach(item => {
      notFoundMap.set(item.scannedValue, item);
    });
    
    // 转换回数组，并按扫描时间倒序排列（最新的在前）
    const notFound = Array.from(notFoundMap.values()).sort((a, b) => {
      return new Date(b.scanTime) - new Date(a.scanTime);
    });
    
    // 位置差异 - 去重保留最后一次扫描
    const locationMismatchesRaw = assetInventoryData.locationMismatches || [];
    
    console.log('🔍 位置差异原始数据:', locationMismatchesRaw);
    console.log('🔍 位置差异数据长度:', locationMismatchesRaw.length);
    
    // 使用 Map 来去重，优先使用 serialNumber，如果没有则使用 assetTag
    const locationMismatchesMap = new Map();
    locationMismatchesRaw.forEach(item => {
      const key = item.serialNumber || item.assetTag;
      console.log('🔍 处理位置差异记录:', { key, item });
      if (key) {
        locationMismatchesMap.set(key, item);
      }
    });
    
    // 转换回数组，并按扫描时间倒序排列（最新的在前）
    const locationMismatches = Array.from(locationMismatchesMap.values()).sort((a, b) => {
      return new Date(b.scanTime) - new Date(a.scanTime);
    });
    
    console.log('🔍 位置差异去重后数据:', locationMismatches);
    
    return {
      inventoried,
      missing,
      duplicates: [...new Set(duplicates)], // 去重
      notFound: notFound, // 已去重的未在表中设备
      locationMismatches: locationMismatches // 已去重的位置差异设备
    };
  }

  // 渲染差异报告
  function renderDifferenceReport() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    const diff = generateDifferenceData();
    
    // 🔍 调试：输出位置差异数据
    console.log('📊 差异报告数据:', {
      已盘点: diff.inventoried.length,
      未盘点: diff.missing.length,
      重复扫描: diff.duplicates.length,
      未在表中: diff.notFound.length,
      位置差异: diff.locationMismatches.length
    });
    console.log('📍 位置差异详细数据:', diff.locationMismatches);
    console.log('💾 原始 locationMismatches 数据:', assetInventoryData.locationMismatches);
    
    let html = `
      <div style="max-width: 1600px; margin: 0 auto;">
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #1e293b; font-size: 24px; margin: 0; display: flex; align-items: center; gap: 12px;">
              ${t('report.title')}
            </h2>
            <div style="display: flex; gap: 10px;">
              <button onclick="exportDifferenceReportPDF()" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                ${t('report.export_pdf')}
              </button>
            </div>
          </div>
          
          <!-- 汇总统计 -->
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 10px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${diff.inventoried.length}</div>
              <div style="font-size: 14px; opacity: 0.9;">✅ ${t('report.card_inventoried')}</div>
            </div>
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 15px 10px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${diff.missing.length}</div>
              <div style="font-size: 14px; opacity: 0.9;">❌ ${t('report.card_not_inventoried')}</div>
            </div>
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px 10px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${diff.duplicates.length}</div>
              <div style="font-size: 14px; opacity: 0.9;">⚠️ ${t('report.card_duplicates')}</div>
            </div>
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 15px 10px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${diff.notFound.length}</div>
              <div style="font-size: 14px; opacity: 0.9;">🔍 ${t('report.card_not_in_baseline')}</div>
            </div>
            <div style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: white; padding: 15px 10px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${diff.locationMismatches.length}</div>
              <div style="font-size: 14px; opacity: 0.9;">📍 ${t('report.card_location_diff')}</div>
            </div>
          </div>
          
          <!-- 盘点时间 -->
          ${assetInventoryData.inventoryStartTime ? `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
              <div style="color: #475569; font-size: 14px;">
                <strong>${t('report.start_time')}:</strong> ${new Date(assetInventoryData.inventoryStartTime).toLocaleString('zh-CN')}
              </div>
              ${assetInventoryData.inventoryEndTime ? `
                <div style="color: #475569; font-size: 14px;">
                  <strong>${t('report.end_time')}:</strong> ${new Date(assetInventoryData.inventoryEndTime).toLocaleString('zh-CN')}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
        
        <!-- 未盘点资产列表 -->
        ${diff.missing.length > 0 ? `
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h3 style="color: #dc2626; font-size: 20px; margin-bottom: 15px;">${t('report.missing_assets_title', { count: diff.missing.length })}</h3>
            <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-height: 400px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); position: sticky; top: 0;">
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px;">Serial Number</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px;">Asset Tag</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px;">Model</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px;">User</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px;">Grid Reference</th>
                    <th style="padding: 12px; text-align: left; color: white; font-weight: 600; font-size: 13px;">Location</th>
                  </tr>
                </thead>
                <tbody>
                  ${diff.missing.map(asset => {
                    const getFieldValue = (asset, ...possibleKeys) => {
                      for (let key of possibleKeys) {
                        if (asset[key] && asset[key] !== 'undefined' && asset[key] !== 'null') {
                          return asset[key];
                        }
                      }
                      return 'N/A';
                    };
                    
                    const gridReference = getFieldValue(asset, 'Grid Reference', 'grid reference', 'GridReference');
                    
                    return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: 600;">${escapeHtml(asset['Serial Number'])}</td>
                      <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(asset['Asset Tag'] || 'N/A')}</td>
                      <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(asset['Model'] || 'N/A')}</td>
                      <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(asset['User'] || 'N/A')}</td>
                      <td style="padding: 10px; font-size: 13px; color: #ea580c; font-weight: 600;">${escapeHtml(gridReference)}</td>
                      <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(asset['Location'] || 'N/A')}</td>
                    </tr>
                  `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- 位置差异列表 -->
        ${diff.locationMismatches.length > 0 ? `
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h3 style="color: #be123c; font-size: 18px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
              ${t('report.location_diff_title', { count: diff.locationMismatches.length })}
              <span style="font-size: 12px; color: #64748b; font-weight: normal;">${t('report.location_diff_subtitle')}</span>
            </h3>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #fef2f2; border-bottom: 2px solid #fecaca;">
                    <th style="padding: 12px; text-align: left; color: #991b1b; font-size: 13px;">${t('table.serial')}</th>
                    <th style="padding: 12px; text-align: left; color: #991b1b; font-size: 13px;">${t('table.tag')}</th>
                    <th style="padding: 12px; text-align: left; color: #991b1b; font-size: 13px;">${t('table.model')}</th>
                    <th style="padding: 12px; text-align: left; color: #991b1b; font-size: 13px;">${t('report.actual_location')}</th>
                    <th style="padding: 12px; text-align: left; color: #991b1b; font-size: 13px;">${t('report.system_location')}</th>
                    <th style="padding: 12px; text-align: left; color: #991b1b; font-size: 13px;">${t('scan.table_time')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${diff.locationMismatches.map(mismatch => {
                    return `
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: 600;">${escapeHtml(mismatch.serialNumber)}</td>
                        <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(mismatch.assetTag)}</td>
                        <td style="padding: 10px; font-size: 13px; color: #475569;">${escapeHtml(mismatch.model)}</td>
                        <td style="padding: 10px; font-size: 14px; color: #dc2626; font-weight: 700; background: #fef2f2;">${escapeHtml(mismatch.actualLocation)}</td>
                        <td style="padding: 10px; font-size: 14px; color: #64748b; font-weight: 600;">${escapeHtml(mismatch.systemLocation)}</td>
                        <td style="padding: 10px; font-size: 12px; color: #64748b;">${new Date(mismatch.scanTime).toLocaleString('zh-CN')}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- 未在表中的设备列表 -->
        ${diff.notFound.length > 0 ? `
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h3 style="color: #7c3aed; font-size: 18px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
              ${t('report.not_in_baseline_title', { count: diff.notFound.length })}
              <span style="font-size: 12px; color: #64748b; font-weight: normal;">${t('report.not_in_baseline_subtitle')}</span>
            </h3>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f5f3ff; border-bottom: 2px solid #ddd6fe;">
                    <th style="padding: 12px; text-align: left; color: #5b21b6; font-size: 13px;">${t('report.scanned_value')}</th>
                    <th style="padding: 12px; text-align: left; color: #5b21b6; font-size: 13px;">${t('report.grid_reference')}</th>
                    <th style="padding: 12px; text-align: left; color: #5b21b6; font-size: 13px;">${t('scan.table_time')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${diff.notFound.map(item => {
                    // 防止 undefined 显示
                    const scannedValue = item.scannedValue || item.serialNumber || 'N/A';
                    // 🔧 修复：Grid Reference 显示手动输入的位置（gridReference），而不是扫描前选择的会议室
                    const gridReference = item.gridReference || 'N/A';
                    const scanTime = item.scanTime ? new Date(item.scanTime).toLocaleString('zh-CN') : 'N/A';
                    
                    console.log('🖥️ UI渲染notFoundAssets记录:', {
                      scannedValue: item.scannedValue,
                      gridReference: item.gridReference,
                      selectedLocation: item.selectedLocation,
                      最终显示GridRef: gridReference
                    });
                    
                    return `
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: 600;">${escapeHtml(scannedValue)}</td>
                        <td style="padding: 10px; font-size: 14px; color: #7c3aed; font-weight: 700; background: #f5f3ff;">${escapeHtml(gridReference)}</td>
                        <td style="padding: 10px; font-size: 12px; color: #64748b;">${scanTime}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
        
        <!-- 操作按钮 -->
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button onclick="inventoryRenderStep2()" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
            ${t('report.button_back_scan')}
          </button>
          <button onclick="sendInventoryReportEmail()" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            ${t('report.send_email')}
          </button>
          <button onclick="resetInventoryData()" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
            ${t('report.button_new_inventory')}
          </button>
        </div>
      </div>
    `;
    
    return html;
  }

  // 导出差异报告到 Excel
  window.exportDifferenceReport = async function() {
    try {
      const diff = generateDifferenceData();
      const ExcelJS = window.ExcelJS;
      if (!ExcelJS) {
        alert('❌ ExcelJS 库未加载，请刷新页面重试');
        return;
      }
      
      const workbook = new ExcelJS.Workbook();
      
      // 工作表1: 汇总
      const summarySheet = workbook.addWorksheet('盘点汇总');
      summarySheet.columns = [
        { header: '项目', key: 'item', width: 20 },
        { header: '数量', key: 'count', width: 15 }
      ];
      
      summarySheet.addRow({ item: '基准总数', count: assetInventoryData.baselineData.length });
      summarySheet.addRow({ item: '已盘点', count: diff.inventoried.length });
      summarySheet.addRow({ item: '未盘点', count: diff.missing.length });
      summarySheet.addRow({ item: '盘点率', count: `${Math.round((diff.inventoried.length / assetInventoryData.baselineData.length) * 100)}%` });
      summarySheet.addRow({ item: '重复扫描', count: diff.duplicates.length });
      summarySheet.addRow({ item: '未在表中', count: diff.notFound.length });
      summarySheet.addRow({ item: '位置差异', count: diff.locationMismatches.length });
      
      if (assetInventoryData.inventoryStartTime) {
        summarySheet.addRow({ item: '开始时间', count: new Date(assetInventoryData.inventoryStartTime).toLocaleString('zh-CN') });
      }
      if (assetInventoryData.inventoryEndTime) {
        summarySheet.addRow({ item: '结束时间', count: new Date(assetInventoryData.inventoryEndTime).toLocaleString('zh-CN') });
      }
      if (assetInventoryData.inventoryPersonList && assetInventoryData.inventoryPersonList.length > 0) {
        summarySheet.addRow({ item: '盘点人', count: assetInventoryData.inventoryPersonList.join(', ') });
      } else if (assetInventoryData.inventoryPerson) {
        summarySheet.addRow({ item: '盘点人', count: assetInventoryData.inventoryPerson });
      }
      
      // 样式化汇总表
      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      
      // 工作表2: 已盘点
      const inventoriedSheet = workbook.addWorksheet('已盘点');
      inventoriedSheet.columns = [
        { header: 'Serial Number', key: 'serialNumber', width: 25 },
        { header: 'Asset Tag', key: 'assetTag', width: 20 },
        { header: 'Model', key: 'model', width: 25 },
        { header: 'User', key: 'user', width: 20 },
        { header: 'Grid Reference', key: 'gridReference', width: 20 },
        { header: 'Location', key: 'location', width: 15 },
        { header: '盘点人', key: 'inventoryPerson', width: 15 },
        { header: '扫描时间', key: 'scanTime', width: 20 }
      ];
      
      diff.inventoried.forEach(asset => {
        const getFieldValue = (asset, ...possibleKeys) => {
          for (let key of possibleKeys) {
            if (asset[key] && asset[key] !== 'undefined' && asset[key] !== 'null') {
              return asset[key];
            }
          }
          return '';
        };
        
        inventoriedSheet.addRow({
          serialNumber: asset['Serial Number'],
          assetTag: asset['Asset Tag'],
          model: asset['Model'],
          user: asset['User'],
          gridReference: getFieldValue(asset, 'Grid Reference', 'grid reference', 'GridReference'),
          location: asset['Location'],
          inventoryPerson: asset.inventoryPerson || assetInventoryData.inventoryPerson || 'N/A',
          scanTime: new Date(asset.scanTime).toLocaleString('zh-CN')
        });
      });
      
      // 样式化表头
      inventoriedSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      inventoriedSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
      };
      
      // 工作表3: 未盘点
      const missingSheet = workbook.addWorksheet('未盘点');
      missingSheet.columns = [
        { header: 'Serial Number', key: 'serialNumber', width: 25 },
        { header: 'Asset Tag', key: 'assetTag', width: 20 },
        { header: 'Model', key: 'model', width: 25 },
        { header: 'User', key: 'user', width: 20 },
        { header: 'Grid Reference', key: 'gridReference', width: 20 },
        { header: 'Location', key: 'location', width: 15 }
      ];
      
      diff.missing.forEach(asset => {
        const getFieldValue = (asset, ...possibleKeys) => {
          for (let key of possibleKeys) {
            if (asset[key] && asset[key] !== 'undefined' && asset[key] !== 'null') {
              return asset[key];
            }
          }
          return '';
        };
        
        missingSheet.addRow({
          serialNumber: asset['Serial Number'],
          assetTag: asset['Asset Tag'],
          model: asset['Model'],
          user: asset['User'],
          gridReference: getFieldValue(asset, 'Grid Reference', 'grid reference', 'GridReference'),
          location: asset['Location']
        });
      });
      
      // 样式化表头
      missingSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      missingSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF0000' }
      };
      
      // 工作表4: 位置差异
      if (diff.locationMismatches.length > 0) {
        const mismatchSheet = workbook.addWorksheet('位置差异');
        mismatchSheet.columns = [
          { header: 'Serial Number', key: 'serialNumber', width: 25 },
          { header: 'Asset Tag', key: 'assetTag', width: 20 },
          { header: 'Model', key: 'model', width: 25 },
          { header: '实际位置', key: 'actualLocation', width: 15 },
          { header: '系统位置', key: 'systemLocation', width: 15 },
          { header: '盘点人', key: 'inventoryPerson', width: 15 },
          { header: '扫描时间', key: 'scanTime', width: 20 }
        ];
        
        diff.locationMismatches.forEach(mismatch => {
          mismatchSheet.addRow({
            serialNumber: mismatch.serialNumber,
            assetTag: mismatch.assetTag,
            model: mismatch.model,
            actualLocation: mismatch.actualLocation,
            systemLocation: mismatch.systemLocation,
            inventoryPerson: mismatch.inventoryPerson || assetInventoryData.inventoryPerson || 'N/A',
            scanTime: new Date(mismatch.scanTime).toLocaleString('zh-CN')
          });
        });
        
        // 样式化表头
        mismatchSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        mismatchSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFBE123C' }
        };
      }
      
      // 工作表5: 未在表中
      if (diff.notFound.length > 0) {
        const notFoundSheet = workbook.addWorksheet('未在表中');
        notFoundSheet.columns = [
          { header: '扫描内容', key: 'scannedValue', width: 30 },
          { header: 'Grid Reference', key: 'gridReference', width: 30 },
          { header: '扫描时间', key: 'scanTime', width: 20 }
        ];
        
        diff.notFound.forEach(item => {
          // 🔧 修复：Grid Reference 显示手动输入的位置（gridReference），不再显示"位置"列
          const gridRef = item.gridReference || 'N/A';
          
          console.log('📊 导出Not in Baseline记录:', {
            scannedValue: item.scannedValue,
            gridReference: item.gridReference,
            最终GridRef: gridRef
          });
          
          notFoundSheet.addRow({
            scannedValue: item.scannedValue,
            gridReference: gridRef,  // Grid Reference列显示手动输入的位置
            scanTime: new Date(item.scanTime).toLocaleString('zh-CN')
          });
        });
        
        // 样式化表头
        notFoundSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        notFoundSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF8B5CF6' }
        };
      }
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `Asset_Inventory_Report_${timestamp}.xlsx`;
      
      // 浏览器下载文件
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      const worksheetInfo = `- 盘点汇总\n- 已盘点 (${diff.inventoried.length}条)\n- 未盘点 (${diff.missing.length}条)` + 
                           (diff.locationMismatches.length > 0 ? `\n- 位置差异 (${diff.locationMismatches.length}条)` : '') +
                           (diff.notFound.length > 0 ? `\n- 未在表中 (${diff.notFound.length}条)` : '');
      
      alert(`✅ 导出成功!\n\n文件: ${fileName}\n\n包含以下工作表:\n${worksheetInfo}`);
      
    } catch (error) {
      console.error('❌ 导出失败:', error);
      alert('❌ 导出失败!\n\n错误信息: ' + error.message);
    }
  };

  // 添加CSS动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // PDF导出函数 - 使用与邮件预览相同的内容
  window.exportDifferenceReportPDF = async function() {
    try {
      const t = window.assetInventoryI18n?.t || ((key) => key);
      
      // 显示加载提示
      if (window.showAssetInventoryFeedback) {
        window.showAssetInventoryFeedback(t('report.exporting_pdf') || 'Generating PDF...', 'info');
      }
      
      // 获取当前结果区域的渲染内容（与邮件预览一致）
      const resultSection = document.getElementById('inventory-result-section');
      if (!resultSection) {
        window.showAssetInventoryFeedback?.('Report content not found', 'error');
        return;
      }
      
      // 克隆内容并移除操作按钮
      const tempClone = resultSection.cloneNode(true);
      tempClone.querySelectorAll('button').forEach(btn => {
        const parent = btn.closest('div[style*="justify-content"]');
        if (parent) parent.remove(); else btn.remove();
      });
      
      // 动态加载 html2pdf 库（如果尚未加载）
      if (!window.html2pdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/asset-inventory/scripts/lib/html2pdf.bundle.min.js';
          script.onload = resolve;
          script.onerror = () => {
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('html2pdf library load failed'));
          };
          document.head.appendChild(script);
        });
      }
      
      // 创建临时容器用于PDF生成
      // html2canvas 需要元素在正常文档流中才能完整捕获内容
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = 'width:794px;padding:20px;background:white;color:#333;font-family:Arial,sans-serif;box-sizing:border-box;';
      tempDiv.innerHTML = tempClone.innerHTML;
      
      // 强制表格适应容器宽度，防止内容溢出被裁切
      const style = document.createElement('style');
      style.textContent = `
        #pdf-temp-container table { table-layout: fixed; width: 100% !important; word-wrap: break-word; }
        #pdf-temp-container td, #pdf-temp-container th { word-break: break-word; overflow-wrap: break-word; white-space: normal !important; }
        #pdf-temp-container div[style*="max-width"] { max-width: none !important; }
        #pdf-temp-container div[style*="overflow"] { overflow: visible !important; max-height: none !important; }
        #pdf-temp-container div[style*="grid-template-columns"] { grid-template-columns: repeat(5, 1fr) !important; gap: 8px !important; }
      `;
      tempDiv.id = 'pdf-temp-container';
      tempDiv.appendChild(style);
      document.body.appendChild(tempDiv);
      
      // 等待浏览器渲染完成
      await new Promise(r => setTimeout(r, 200));
      
      const fileName = `Asset_Inventory_Report_${new Date().toISOString().slice(0,10)}.pdf`;
      
      try {
        await html2pdf().set({
          margin: [10, 5, 10, 5],
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, width: tempDiv.scrollWidth, windowWidth: tempDiv.scrollWidth },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], before: '.page-break' }
        }).from(tempDiv).save();
        
        if (window.showAssetInventoryFeedback) {
          window.showAssetInventoryFeedback(`✅ ${t('report.pdf_success') || 'PDF 已下载'}: ${fileName}`, 'success');
        }
      } finally {
        document.body.removeChild(tempDiv);
      }
      
    } catch (error) {
      console.error('PDF导出失败:', error);
      if (window.showAssetInventoryFeedback) {
        const t = window.assetInventoryI18n?.t || ((key) => key);
        window.showAssetInventoryFeedback(`${t('report.pdf_error') || 'PDF export failed'}: ${error.message}`, 'error');
      }
    }
  };

  // 发送盘点报告邮件
  window.sendInventoryReportEmail = async function() {
    const t = window.assetInventoryI18n?.t || ((key) => key);
    const isDark = document.body.classList.contains('dark-theme');
    
    // 获取当前登录用户邮箱作为默认发件人
    let defaultFromEmail = '';
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        defaultFromEmail = user.email || '';
      }
    } catch(e) {}
    
    // 获取系统设置中的邮箱联系人列表
    let emailContacts = { senders: [], recipients: [], ccRecipients: [] };
    try {
      const resp = await fetch('/api/status/report-settings');
      const data = await resp.json();
      if (data.success && data.data?.emailContacts) {
        emailContacts = data.data.emailContacts;
      }
    } catch(e) {}
    
    // 获取报告内容 - 用于预览
    const resultSection = document.getElementById('inventory-result-section');
    if (!resultSection) {
      window.showAssetInventoryFeedback?.('Report content not found', 'error');
      return;
    }
    // 克隆内容并移除操作按钮（仅用于Modal预览）
    const tempClone = resultSection.cloneNode(true);
    tempClone.querySelectorAll('button').forEach(btn => btn.closest('div[style*="justify-content: center"]')?.remove() || btn.remove());
    const reportContentHtml = tempClone.innerHTML;
    
    // 创建预览弹窗
    const overlay = document.createElement('div');
    overlay.id = 'email-preview-overlay';
    overlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;`;
    
    const modalBg = isDark ? '#1e293b' : '#ffffff';
    const modalColor = isDark ? '#e2e8f0' : '#1e293b';
    const inputBg = isDark ? '#334155' : '#f8fafc';
    const inputBorder = isDark ? '#475569' : '#e2e8f0';
    const dropdownBg = isDark ? '#1e293b' : '#ffffff';
    const dropdownHover = isDark ? '#334155' : '#f1f5f9';
    
    overlay.innerHTML = `
      <div style="background:${modalBg};color:${modalColor};border-radius:12px;width:90%;max-width:800px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 50px rgba(0,0,0,0.25);">
        <!-- Header -->
        <div style="padding:16px 24px;border-bottom:1px solid ${inputBorder};display:flex;align-items:center;justify-content:space-between;">
          <h3 style="margin:0;font-size:18px;font-weight:700;">📧 ${t('report.email_preview_title')}</h3>
          <button id="email-preview-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:${modalColor};padding:4px 8px;">✕</button>
        </div>
        
        <!-- Email Fields -->
        <div style="padding:16px 24px;border-bottom:1px solid ${inputBorder};display:flex;flex-direction:column;gap:12px;">
          <!-- 发件人 -->
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:14px;font-weight:600;width:70px;flex-shrink:0;">${t('report.from')}:</label>
            <input id="email-from-input" type="email" value="${escapeHtml(defaultFromEmail)}" 
              style="flex:1;padding:8px 12px;border:1px solid ${inputBorder};border-radius:6px;font-size:14px;background:${inputBg};color:${modalColor};outline:none;"
              placeholder="${t('report.from_placeholder')}" />
          </div>
          <!-- 收件人 -->
          <div style="display:flex;align-items:flex-start;gap:8px;position:relative;">
            <label style="font-size:14px;font-weight:600;width:70px;flex-shrink:0;margin-top:8px;">${t('report.to')}:</label>
            <div style="flex:1;position:relative;">
              <input id="email-to-input" type="text" 
                style="width:100%;padding:8px 12px;border:1px solid ${inputBorder};border-radius:6px;font-size:14px;background:${inputBg};color:${modalColor};outline:none;"
                placeholder="${t('report.to_placeholder')}" />
              <div id="email-to-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:${dropdownBg};border:1px solid ${inputBorder};border-radius:6px;margin-top:4px;max-height:150px;overflow-y:auto;z-index:10001;box-shadow:0 4px 12px rgba(0,0,0,0.15);"></div>
            </div>
          </div>
          <!-- 抄送 -->
          <div style="display:flex;align-items:flex-start;gap:8px;position:relative;">
            <label style="font-size:14px;font-weight:600;width:70px;flex-shrink:0;margin-top:8px;">${t('report.cc')}:</label>
            <div style="flex:1;position:relative;">
              <input id="email-cc-input" type="text" 
                style="width:100%;padding:8px 12px;border:1px solid ${inputBorder};border-radius:6px;font-size:14px;background:${inputBg};color:${modalColor};outline:none;"
                placeholder="${t('report.cc_placeholder')}" />
              <div id="email-cc-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:${dropdownBg};border:1px solid ${inputBorder};border-radius:6px;margin-top:4px;max-height:150px;overflow-y:auto;z-index:10001;box-shadow:0 4px 12px rgba(0,0,0,0.15);"></div>
            </div>
          </div>
        </div>
        
        <!-- Report Preview -->
        <div style="flex:1;overflow-y:auto;padding:16px 24px;min-height:200px;max-height:400px;">
          <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;font-weight:600;">${t('report.preview')}:</div>
          <div id="email-report-preview" style="border:1px solid ${inputBorder};border-radius:8px;padding:12px;font-size:12px;overflow:auto;max-height:350px;">
            ${reportContentHtml}
          </div>
        </div>
        
        <!-- Footer -->
        <div style="padding:16px 24px;border-top:1px solid ${inputBorder};display:flex;justify-content:flex-end;gap:12px;">
          <button id="email-preview-cancel" style="padding:10px 24px;border:1px solid ${inputBorder};border-radius:6px;background:${inputBg};color:${modalColor};cursor:pointer;font-size:14px;font-weight:500;">
            ${t('report.cancel')}
          </button>
          <button id="email-preview-send" style="padding:10px 24px;border:none;border-radius:6px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;">
            📧 ${t('report.send')}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // 设置下拉自动补全逻辑
    function setupAutocomplete(inputId, dropdownId, suggestions) {
      const input = document.getElementById(inputId);
      const dropdown = document.getElementById(dropdownId);
      if (!input || !dropdown) return;
      
      function showDropdown() {
        const currentVal = input.value;
        // 获取最后一个逗号之后的部分作为搜索词
        const parts = currentVal.split(',');
        const searchTerm = parts[parts.length - 1].trim().toLowerCase();
        
        const filtered = suggestions.filter(s => 
          s.toLowerCase().includes(searchTerm) && !parts.slice(0, -1).map(p => p.trim()).includes(s)
        );
        
        if (filtered.length === 0) {
          dropdown.style.display = 'none';
          return;
        }
        
        dropdown.innerHTML = filtered.map(email => `
          <div class="email-dropdown-item" style="padding:8px 12px;cursor:pointer;font-size:13px;transition:background 0.15s;" 
               onmouseenter="this.style.background='${dropdownHover}'" 
               onmouseleave="this.style.background='transparent'"
               data-email="${escapeHtml(email)}">
            ${escapeHtml(email)}
          </div>
        `).join('');
        dropdown.style.display = 'block';
        
        // 点击选项
        dropdown.querySelectorAll('.email-dropdown-item').forEach(item => {
          item.addEventListener('click', () => {
            const email = item.getAttribute('data-email');
            const parts = input.value.split(',');
            parts[parts.length - 1] = ' ' + email;
            input.value = parts.join(',').replace(/^,\s*/, '');
            dropdown.style.display = 'none';
            input.focus();
          });
        });
      }
      
      input.addEventListener('focus', showDropdown);
      input.addEventListener('input', showDropdown);
      input.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 200);
      });
    }
    
    setupAutocomplete('email-to-input', 'email-to-dropdown', emailContacts.recipients || []);
    setupAutocomplete('email-cc-input', 'email-cc-dropdown', emailContacts.ccRecipients || []);
    
    // 关闭/取消
    const closeModal = () => overlay.remove();
    document.getElementById('email-preview-close').addEventListener('click', closeModal);
    document.getElementById('email-preview-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    
    // 发送
    document.getElementById('email-preview-send').addEventListener('click', async () => {
      const fromEmail = document.getElementById('email-from-input').value.trim();
      const toEmail = document.getElementById('email-to-input').value.trim();
      const ccEmail = document.getElementById('email-cc-input').value.trim();
      
      if (!toEmail) {
        window.showAssetInventoryFeedback?.('❌ ' + (t('report.recipient_required') || '请输入收件人邮箱'), 'error');
        return;
      }
      
      // 生成邮件兼容的HTML报告（使用table布局，纯色背景，无CSS3特性）
      const diff = generateDifferenceData();
      const startTime = assetInventoryData.inventoryStartTime ? new Date(assetInventoryData.inventoryStartTime).toLocaleString('zh-CN') : 'N/A';
      const endTime = assetInventoryData.inventoryEndTime ? new Date(assetInventoryData.inventoryEndTime).toLocaleString('zh-CN') : 'N/A';
      
      let emailTableRows = '';
      
      // 未盘点资产表格
      if (diff.missing.length > 0) {
        emailTableRows += `
          <tr><td colspan="6" style="padding:20px 0 10px 0;font-size:16px;font-weight:bold;color:#dc2626;border:none;">
            Missing Assets (${diff.missing.length})
          </td></tr>
          <tr style="background-color:#ef4444;">
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Serial Number</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Asset Tag</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Model</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">User</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Grid Reference</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Location</th>
          </tr>`;
        diff.missing.forEach(asset => {
          const gridRef = asset['Grid Reference'] || asset['grid reference'] || asset['GridReference'] || 'N/A';
          emailTableRows += `
          <tr>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(asset['Serial Number'] || '')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;">${escapeHtml(asset['Asset Tag'] || 'N/A')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;">${escapeHtml(asset['Model'] || 'N/A')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;">${escapeHtml(asset['User'] || 'N/A')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;color:#ea580c;font-weight:bold;">${escapeHtml(gridRef)}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;">${escapeHtml(asset['Location'] || 'N/A')}</td>
          </tr>`;
        });
      }
      
      // 位置差异表格
      if (diff.locationMismatches.length > 0) {
        emailTableRows += `
          <tr><td colspan="6" style="padding:20px 0 10px 0;font-size:16px;font-weight:bold;color:#be123c;border:none;">
            Location Differences (${diff.locationMismatches.length})
          </td></tr>
          <tr style="background-color:#f43f5e;">
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Serial Number</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Asset Tag</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Model</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Actual Location</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">System Location</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Scan Time</th>
          </tr>`;
        diff.locationMismatches.forEach(m => {
          emailTableRows += `
          <tr>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(m.serialNumber || '')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;">${escapeHtml(m.assetTag || 'N/A')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;">${escapeHtml(m.model || 'N/A')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;color:#dc2626;font-weight:bold;">${escapeHtml(m.actualLocation || '')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;">${escapeHtml(m.systemLocation || '')}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;">${m.scanTime ? new Date(m.scanTime).toLocaleString('zh-CN') : 'N/A'}</td>
          </tr>`;
        });
      }
      
      // 未在表中设备
      if (diff.notFound.length > 0) {
        emailTableRows += `
          <tr><td colspan="6" style="padding:20px 0 10px 0;font-size:16px;font-weight:bold;color:#7c3aed;border:none;">
            Not in Baseline (${diff.notFound.length})
          </td></tr>
          <tr style="background-color:#7c3aed;">
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Scanned Value</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;">Grid Reference</th>
            <th style="padding:8px;color:white;font-size:12px;border:1px solid #ddd;text-align:left;" colspan="4">Scan Time</th>
          </tr>`;
        diff.notFound.forEach(item => {
          const sv = item.scannedValue || item.serialNumber || 'N/A';
          const gr = item.gridReference || 'N/A';
          const st = item.scanTime ? new Date(item.scanTime).toLocaleString('zh-CN') : 'N/A';
          emailTableRows += `
          <tr>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(sv)}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;color:#7c3aed;font-weight:bold;">${escapeHtml(gr)}</td>
            <td style="padding:6px 8px;font-size:12px;border:1px solid #e2e8f0;" colspan="4">${st}</td>
          </tr>`;
        });
      }

      const reportHtml = [
        '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
        '<html xmlns="http://www.w3.org/1999/xhtml">',
        '<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /></head>',
        '<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333333;">',
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:900px;margin:0 auto;padding:20px;">',
        '<tr><td>',
        '<h2 style="color:#1e293b;font-size:22px;margin:0 0 20px 0;">Inventory Difference Report</h2>',
        '<table width="100%" cellpadding="8" cellspacing="0" border="0" style="margin-bottom:20px;">',
        '<tr>',
          '<td style="background-color:#10b981;color:white;text-align:center;padding:12px;font-weight:bold;border-radius:4px;width:20%;">' + diff.inventoried.length + '<br/><small>Inventoried</small></td>',
          '<td style="background-color:#ef4444;color:white;text-align:center;padding:12px;font-weight:bold;border-radius:4px;width:20%;">' + diff.missing.length + '<br/><small>Not Inventoried</small></td>',
          '<td style="background-color:#f59e0b;color:white;text-align:center;padding:12px;font-weight:bold;border-radius:4px;width:20%;">' + diff.duplicates.length + '<br/><small>Duplicates</small></td>',
          '<td style="background-color:#8b5cf6;color:white;text-align:center;padding:12px;font-weight:bold;border-radius:4px;width:20%;">' + diff.notFound.length + '<br/><small>Not in Baseline</small></td>',
          '<td style="background-color:#ec4899;color:white;text-align:center;padding:12px;font-weight:bold;border-radius:4px;width:20%;">' + diff.locationMismatches.length + '<br/><small>Location Diff</small></td>',
        '</tr>',
        '</table>',
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:15px;background-color:#f8fafc;padding:10px;">',
        '<tr><td style="padding:5px;font-size:13px;color:#475569;"><strong>Start Time:</strong> ' + startTime + '</td>',
        '<td style="padding:5px;font-size:13px;color:#475569;"><strong>End Time:</strong> ' + endTime + '</td></tr>',
        '</table>',
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">',
        emailTableRows,
        '</table>',
        '</td></tr></table>',
        '</body></html>'
      ].join('');
      
      const subject = 'Asset Inventory Report - ' + new Date().toLocaleDateString();
      
      const sendBtn = document.getElementById('email-preview-send');
      sendBtn.disabled = true;
      sendBtn.innerHTML = '⏳ ' + (t('report.sending') || '发送中...');
      
      try {
        const response = await fetch('/api/asset-inventory/send-report', {
          method: 'POST',
          headers: (() => {
            const h = { 'Content-Type': 'application/json' };
            try { const s = JSON.parse(localStorage.getItem('authSession')); if (s?.accessToken) h['Authorization'] = `Bearer ${s.accessToken}`; } catch(e) {}
            return h;
          })(),
          body: JSON.stringify({ reportHtml, subject, recipients: toEmail, fromEmail, ccEmail })
        });
        
        const result = await response.json();
        
        if (result.success) {
          window.showAssetInventoryFeedback?.('✅ ' + (t('report.email_sent_success') || 'Email sent successfully!'), 'success');
          closeModal();
        } else {
          window.showAssetInventoryFeedback?.('❌ ' + (result.message || 'Failed to send email'), 'error');
          sendBtn.disabled = false;
          sendBtn.innerHTML = '📧 ' + (t('report.send') || '发送');
        }
      } catch (error) {
        console.error('Email send error:', error);
        window.showAssetInventoryFeedback?.('❌ ' + error.message, 'error');
        sendBtn.disabled = false;
        sendBtn.innerHTML = '📧 ' + (t('report.send') || '发送');
      }
    });
  };

  console.log('✅ Asset Inventory Module Loaded Successfully');

})();
