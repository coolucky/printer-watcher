import React, { useState, useEffect, useRef } from 'react'
import { Box, Container, Typography, Paper, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Logout, Login } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Legend } from 'chart.js';

// 导入文件数据服务
import * as fileDataService from './services/fileDataService';
// 导入环境配置
import ENV_CONFIG from './config/env';

// Register Chart.js components
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Legend);

// API base URL for backend communication (从环境配置读取)
const API_BASE_URL = ENV_CONFIG.API_BASE_URL;
const TAB_STORAGE_KEY = 'app_last_tab';
// Capture once at module load (before any effects can modify localStorage)
const HAD_AUTH_SESSION_ON_LOAD = !!localStorage.getItem('authSession');

// Import user service and components
import * as userDataService from './services/userDataService';
import LoginPage from './components/LoginPage';
import UserProfile from './components/UserProfile';

// 导入新的模块化组件
import Header from './components/Header';
import ErrorAlert from './components/ErrorAlert';
import LoadingIndicator from './components/LoadingIndicator';
import TabNavigation from './components/TabNavigation';
import AppContent from './components/AppContent';
import ErrorBoundary from './components/ErrorBoundary';
import StatusDashboard from './components/StatusDashboard';
import PrintServerMonitoring from './components/PrintServerMonitoring';

// 导入Context hook
import { useAppContext } from './context';
import { useAuthContext } from './context/useAuthContext';
import LoginDialog from './components/LoginDialog';
import { ENABLE_PRINT_ANALYTICS } from './config/features';





// Default theme colors
const themeColors = {
  primary: '#1976d2',
  primaryHover: '#1565c0',
  textPrimary: '#212121',
  textSecondary: '#757575',
  background: '#f5f5f5',
  backgroundPaper: '#ffffff',
  backgroundSecondary: '#fafafa',
  error: '#d32f2f',
  success: '#4caf50',
  warning: '#ff9800'
}

const App = () => {
  const { t } = useTranslation();
  // 从Context获取全局状态和action
  const {
    state,
    toggleTheme,
    setTab,
    openUserProfile,
    closeUserProfile,
    setPrinters,
    setPrinterStatuses,
    setLicenseDays,
    setLoading,
    setError,
    setReportSent,
    setAuthenticated,
    setCurrentUser,
    logout,
  } = useAppContext();

  // 认证Context
  const auth = useAuthContext();

  // 登录对话框状态
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // 认证状态检查 - 登录成功后关闭对话框
  useEffect(() => {
    if (auth.isAuthenticated && showLoginDialog) {
      setShowLoginDialog(false);
    }
  }, [auth.isAuthenticated]);

  // 同步AuthContext状态到AppContext - 确保Header等依赖state.isAuthenticated的组件正确显示
  useEffect(() => {
    if (auth.isAuthenticated && auth.state?.user) {
      if (!state.isAuthenticated || state.currentUser?.username !== auth.state.user.username) {
        setCurrentUser(auth.state.user);
        setAuthenticated(true);
        // 同步到localStorage，确保userDataService.getCurrentUser()能读取到
        localStorage.setItem('currentUser', JSON.stringify(auth.state.user));
      }
    } else if (!auth.isAuthenticated && state.isAuthenticated) {
      // AuthContext已登出但AppContext还未同步
      logout();
    }
  }, [auth.isAuthenticated, auth.state?.user]);

  useEffect(() => {
    // If analytics is hidden, keep users on visible tabs only.
    if (!ENABLE_PRINT_ANALYTICS && state.tabValue === 2) {
      setTab(1);
    }
  }, [state.tabValue, setTab]);

  // Tab persistence: save tab changes to localStorage; guard unauthenticated users.
  useEffect(() => {
    // If not authenticated and on a protected tab, redirect to status monitoring
    if (!auth.isAuthenticated && state.tabValue !== 1) {
      // But only if auth session is fully settled (no pending restore)
      if (!HAD_AUTH_SESSION_ON_LOAD) {
        // No session at all on page load — force tab 1
        setTab(1);
      }
      // If there WAS a saved session on load but auth isn't restored yet, do nothing (wait)
      return;
    }
    // Persist current tab
    try { localStorage.setItem(TAB_STORAGE_KEY, String(state.tabValue)); } catch {}
  }, [auth.isAuthenticated, state.tabValue, setTab]);
  
  // Format Beijing time (UTC+8)
  const formatBeijingTime = (date) => {
    // Directly use timeZone option to ensure correct handling of Beijing time
    const options = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai'  // Explicitly specify Shanghai timezone
    }; // Directly use current date object but force format with Asia/Shanghai timezone
    return date.toLocaleString('zh-CN', options).replace(/,/g, '').replace(/\//g, '-');
  };
  // 从本地存储加载打印机数据
  const loadPrintersFromStorage = async () => {
    try {
      // 检查版本，如果不匹配则清除旧数据
      const dataVersion = '2.0';
      const storedVersion = localStorage.getItem('printers_version');
      
      if (storedVersion !== dataVersion) {
        console.log('Printer data version mismatch, clearing old data');
        localStorage.removeItem('printers');
        localStorage.setItem('printers_version', dataVersion);
      }
      
      // 直接从localStorage加载打印机数据
      const printersData = localStorage.getItem('printers');
      
      if (printersData) {
        const parsedPrinters = JSON.parse(printersData);
        if (parsedPrinters && parsedPrinters.length > 0) {
          console.log('Printers data loaded successfully from localStorage:', parsedPrinters);
          return parsedPrinters;
        }
      }
      
      // 如果没有数据，使用默认数据
      const defaultPrinters = [
        {
          id: '1',
          name: 'Beijing_12A',
          ip: '10.128.20.6',
          serialNumber: '369160',
          port: 168,
          macAddress: '1C:7D:22:4C:C7:F3',
          location: '12A',
          assetTag: '40741827',
          model: 'Fujifilm Apeos C5570',
          manualTonerLevels: {
            black: 97,
            cyan: 83,
            magenta: 58,
            yellow: 58
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Beijing_12B',
          ip: '10.128.21.6',
          serialNumber: '369158',
          port: 490,
          macAddress: '1C:7D:22:4C:CA:0F',
          location: '12B',
          assetTag: '40741828',
          model: 'Fujifilm Apeos C5570',
          manualTonerLevels: {
            black: 40,
            cyan: 77,
            magenta: 79,
            yellow: 82
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Shenzhen_18F',
          ip: '10.136.9.6',
          serialNumber: '369166',
          port: 24,
          macAddress: '1C:7D:22:4C:C5:7F',
          location: '18F',
          assetTag: '40741829',
          model: 'Fujifilm Apeos C5570',
          manualTonerLevels: {
            black: 99,
            cyan: 98,
            magenta: 98,
            yellow: 99
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '4',
          name: 'Shanghai_26A',
          ip: '10.132.20.6',
          serialNumber: '369442',
          port: 88,
          macAddress: '1C:7D:22:4D:CF:B1',
          location: '26F pantry',
          assetTag: '40717301',
          model: 'Fujifilm Apeos C5570',
          manualTonerLevels: {
            black: 39,
            cyan: 47,
            magenta: 79,
            yellow: 99
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '5',
          name: 'Shanghai_26B',
          ip: '10.132.20.7',
          serialNumber: '369486',
          port: 1,
          macAddress: '1C:7D:22:4D:DC:60',
          location: '26F IT Lab',
          assetTag: '40717302',
          model: 'Fujifilm Apeos C5570',
          isTest: true,
          manualTonerLevels: {
            black: 100,
            cyan: 100,
            magenta: 98,
            yellow: 100
          },
          lastUpdated: new Date().toISOString()
        }
      ];
      
      // 将默认数据保存到localStorage
      localStorage.setItem('printers', JSON.stringify(defaultPrinters));
      console.log('Default printers data has been set in localStorage');
      
      return defaultPrinters;
    } catch (error) {
      console.error('Failed to load printers from localStorage:', error);
      
      // 返回默认数据作为后备
      return [
        {
          id: '1',
          name: 'Beijing_12A',
          ip: '10.128.20.6',
          serialNumber: '369160',
          port: 168,
          macAddress: '1C:7D:22:4C:C7:F3',
          location: '12A',
          assetTag: '40741827',
          model: 'Fujifilm Apeos C5570',
          manualTonerLevels: {
            black: 97,
            cyan: 83,
            magenta: 58,
            yellow: 58
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Beijing_12B',
          ip: '10.128.21.6',
          serialNumber: '369158',
          port: 490,
          macAddress: '1C:7D:22:4C:CA:0F',
          location: '12B',
          assetTag: '40741828',
          model: 'Fujifilm Apeos C5570',
          manualTonerLevels: {
            black: 40,
            cyan: 77,
            magenta: 79,
            yellow: 82
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Shenzhen_18F',
          ip: '10.136.9.6',
          serialNumber: '369166',
          port: 24,
          macAddress: '1C:7D:22:4C:C5:7F',
          location: '18F',
          assetTag: '40741829',
          model: 'Fujifilm Apeos C5570',
          manualTonerLevels: {
            black: 99,
            cyan: 98,
            magenta: 98,
            yellow: 99
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '4',
          name: 'Shanghai_26A',
          ip: '10.132.20.6',
          serialNumber: '369442',
          port: 88,
          macAddress: '1C:7D:22:4D:CF:B1',
          location: '26F pantry',
          assetTag: '40717301',
          model: 'Fujifilm Apeos C5570',
          manualTonerLevels: {
            black: 39,
            cyan: 47,
            magenta: 79,
            yellow: 99
          },
          lastUpdated: new Date().toISOString()
        },
        {
          id: '5',
          name: 'Shanghai_26B',
          ip: '10.132.20.7',
          serialNumber: '369486',
          port: 1,
          macAddress: '1C:7D:22:4D:DC:60',
          location: '26F IT Lab',
          assetTag: '40717302',
          model: 'Fujifilm Apeos C5570',
          isTest: true,
          manualTonerLevels: {
            black: 100,
            cyan: 100,
            magenta: 98,
            yellow: 100
          },
          lastUpdated: new Date().toISOString()
        }
      ];
    }
  };

  // 主题管理函数
  const handleToggleTheme = () => {
    const newTheme = !state.isDarkTheme;
    toggleTheme();
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    document.body.classList.toggle('dark-theme', newTheme);
  };

  // 从localStorage加载主题或使用系统偏好
  const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      const isDark = savedTheme === 'dark';
      // 通过context更新主题，但这里有个问题：context的setTheme没有导入
      // 需要在调用时直接调用toggleTheme或使用setState
      document.body.classList.toggle('dark-theme', isDark);
    } else {
      // 如果没有保存的主题，使用系统偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.toggle('dark-theme', prefersDark);
    }
  };
  
  // 数据版本管理
  const lastSyncTimestampRef = useRef(null);

  // 初始化时清理可能存在的同步状态数据
  useEffect(() => {
    console.log('App component mounted, isAuthenticated:', state.isAuthenticated);
    console.log('App component mounted, tabValue:', state.tabValue);
    try {
      // 清除可能存在的同步相关localStorage项，避免遗留数据影响
      localStorage.removeItem('sync_queue');
      localStorage.removeItem('offline_sync_queue');
      localStorage.removeItem('pending_sync');
      localStorage.removeItem('sync_history');
      console.log('初始化清理完成');
    } catch (error) {
      console.error('初始化清理时出错:', error);
    }
  }, []);
  
  // 初始化加载打印机数据
  useEffect(() => {
    const initializePrinters = async () => {
      try {
        const loadedPrinters = await loadPrintersFromStorage();
        setPrinters(loadedPrinters);
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize printers:', err);
        setLoading(false);
      }
    };
    
    // 测试后端API连接
    const testBackendConnection = async () => {
      console.log('测试后端API连接...');
      try {
        const response = await axios.get('http://127.0.0.1:3001/api/health');
        console.log('后端API连接测试成功:', response.data);
      } catch (err) {
        console.error('后端API连接测试失败:', err);
      }
    };
    
    initializePrinters();
    testBackendConnection();
  }, []);
  // 日志记录函数，帮助调试
  const logApiCall = (url, success, data, error) => {
    console.log('[API] ' + url + ' - ' + (success ? '成功' : '失败'));
    if (success && data) console.log('[API] 响应数据:', data);
    if (!success && error) console.error('[API] 错误:', error);
  };

  // 强制更新打印机函数，确保数据完整性并同步到统一数据源
  const forceUpdatePrinter = async (index, updatedPrinter) => {
    try {
      console.log('进入forceUpdatePrinter函数');
      console.log('索引:', index);
      console.log('更新的打印机数据:', updatedPrinter);
      
      // 检查printers数组和索引是否有效
      if (!state.printers || !Array.isArray(state.printers) || index < 0 || index >= state.printers.length) {
        console.error('无效的打印机索引或打印机数组');
        setError('Invalid printer index or printer array');
        alert('保存失败: 无效的打印机索引');
        return { success: false };
      }
      
      // 获取原始打印机对象
      let originalPrinter = state.printers[index];
      console.log('原始打印机对象:', originalPrinter);
      
      // 如果原始打印机不存在或为null，创建一个空对象
      if (!originalPrinter) {
        originalPrinter = {};
      }
      
      // 确保id存在 - 如果没有id，生成一个临时id
      const printerId = originalPrinter.id || Date.now().toString();
      
      // 确保基本字段存在，从updatedPrinter或originalPrinter获取
      const name = updatedPrinter.name || originalPrinter.name || '';
      const ip = updatedPrinter.ip || originalPrinter.ip || '';
      
      // 构建完整的打印机对象，确保包含所有必要的字段
      const forcedPrinterData = {
        id: printerId,
        name: name,
        ip: ip,
        serialNumber: updatedPrinter.serialNumber || originalPrinter.serialNumber || '',
        port: updatedPrinter.port || originalPrinter.port || '',
        location: updatedPrinter.location || originalPrinter.location || '',
        model: updatedPrinter.model || originalPrinter.model || '',
        manualTonerLevels: updatedPrinter.manualTonerLevels && typeof updatedPrinter.manualTonerLevels === 'object' 
          ? updatedPrinter.manualTonerLevels 
          : (originalPrinter.manualTonerLevels || {}),
        isTest: updatedPrinter.hasOwnProperty('isTest') ? updatedPrinter.isTest : (originalPrinter.isTest || false)
      };
      
      console.log('准备保存的打印机数据:', forcedPrinterData);
      
      // 更新打印机数组
      const newPrinters = [...state.printers];
      newPrinters[index] = {
        ...newPrinters[index],
        ...forcedPrinterData,
        lastUpdated: new Date().toISOString()
      };
      
      // 保存到localStorage
      try {
        localStorage.setItem('printers', JSON.stringify(newPrinters));
        localStorage.setItem('printers_timestamp', new Date().toISOString());
        console.log('打印机数据已成功更新并保存到localStorage');
        
        // 更新本地状态
        setPrinters(newPrinters);
        
        // 同步到后端（全局共享）
        const token = auth.accessToken || auth.state?.accessToken;
        if (token) {
          fetch(`${API_BASE_URL}/printers/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ printers: newPrinters })
          }).catch(err => console.warn('Failed to sync printers to backend:', err.message));
        }
        
        return { success: true, updatedPrinters: newPrinters };
      } catch (err) {
        console.error('Failed to save updated printer to localStorage:', err);
        alert('打印机配置已更新，但保存到本地存储失败');
        return { success: true, updatedPrinters: newPrinters, saveFailed: true };
      }
    } catch (error) {
      console.error('forceUpdatePrinter函数执行出错:', error);
      setError('Failed to update printer');
      alert('保存失败: 内部错误');
      return { success: false };
    }
  };

  // 单独获取license状态的函数，带本地缓存机制
  const fetchLicenseStatus = async () => {
    try {
      // 首先检查本地缓存
      const cachedLicense = localStorage.getItem('cachedLicense');
      const cachedTime = localStorage.getItem('cachedLicenseTime');
      const currentTime = Date.now();
      const FIVE_MINUTES = 5 * 60 * 1000; // 5分钟缓存时间
      
      // 如果缓存有效（5分钟内），直接使用缓存数据
      if (cachedLicense && cachedTime && (currentTime - parseInt(cachedTime)) < FIVE_MINUTES) {
        const parsedLicense = JSON.parse(cachedLicense);
        console.log('使用缓存的许可证数据:', parsedLicense);
        setLicenseDays(parsedLicense.remainingDays || 0);
        return;
      }
      
      // 如果缓存无效，尝试从API获取新数据
      try {
        const licenseResponse = await axios.get(`${API_BASE_URL}/license-days`);
        // API response is wrapped: { code, success, data: { remainingDays, ... } }
        const licenseData = licenseResponse.data?.data || licenseResponse.data || { remainingDays: 0 };
        console.log('API获取许可证数据成功:', licenseData.remainingDays);
        logApiCall(`${API_BASE_URL}/license-days`, true, licenseResponse.data, null);
        
        // 更新状态和缓存 (cache the unwrapped data)
        setLicenseDays(licenseData.remainingDays || 0);
        localStorage.setItem('cachedLicense', JSON.stringify(licenseData));
        localStorage.setItem('cachedLicenseTime', currentTime.toString());
      } catch (apiError) {
        // API调用失败时的降级处理
        console.warn('Failed to fetch license data from API:', apiError);
        logApiCall(`${API_BASE_URL}/license-days`, false, null, apiError);
        
        // 即使API失败，也尝试使用本地缓存数据作为最后的保障
        if (cachedLicense) {
          const parsedLicense = JSON.parse(cachedLicense);
          console.log('API调用失败，使用缓存的许可证数据:', parsedLicense);
          setLicenseDays(parsedLicense.remainingDays || 0);
        }
      }
    } catch (error) {
      console.error('获取许可证状态时出错:', error);
    }
  };
  // 初始化用户认证和应用数据
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 初始化用户数据服务
        userDataService.initializeUsers();
        
        // 检查用户认证状态
        console.log('Checking authentication status...');
        const currentUserStr = localStorage.getItem('currentUser');
        console.log('currentUser in localStorage:', currentUserStr);
        const user = userDataService.getCurrentUser();
        console.log('getCurrentUser returned:', user);
        if (user) {
          console.log('Setting currentUser and isAuthenticated to true');
          setCurrentUser(user);
          setAuthenticated(true);
        } else {
          console.log('No user found, user needs to login manually');
          setAuthenticated(false);
        }
      } catch (authError) {
        console.error('Authentication check failed:', authError);
        alert('Authentication error: ' + authError.message);
      }
    };

    initializeApp();
    // 初始化主题
    loadTheme();
  }, []);
  
  // 认证后加载数据
  useEffect(() => {
    const loadDataAfterAuth = async () => {
      if (state.isAuthenticated) {
        try {
          console.log('Fetching printers from backend (global source of truth)...');
          
          // 优先从后端API获取打印机数据（全局共享）
          const token = auth.accessToken || auth.state?.accessToken;
          let loaded = false;
          if (token) {
            try {
              const response = await fetch(`${API_BASE_URL}/printers`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (response.ok) {
                const data = await response.json();
                const apiPrinters = data.data || data;
                if (Array.isArray(apiPrinters) && apiPrinters.length > 0) {
                  console.log(`Loaded ${apiPrinters.length} printers from backend API`);
                  // 从localStorage获取本地数据，保留isTest等本地字段
                  let localPrinters = [];
                  try {
                    const savedLocal = localStorage.getItem('printers');
                    localPrinters = savedLocal ? JSON.parse(savedLocal) : [];
                  } catch (e) { /* ignore */ }
                  // 合并：以后端数据为主，但保留localStorage中的isTest字段
                  const mergedPrinters = apiPrinters.map(apiPrinter => {
                    const localMatch = localPrinters.find(lp => lp && (lp.id === apiPrinter.id || lp.ip === apiPrinter.ip));
                    return {
                      ...apiPrinter,
                      isTest: apiPrinter.isTest || (localMatch ? localMatch.isTest : false) || false
                    };
                  });
                  setPrinters(mergedPrinters);
                  localStorage.setItem('printers', JSON.stringify(mergedPrinters));
                  loaded = true;
                }
              }
            } catch (apiErr) {
              console.warn('Failed to fetch printers from API, falling back to localStorage:', apiErr.message);
            }
          }
          
          // 后端没有数据时回退到localStorage
          if (!loaded) {
            const savedPrinters = await loadPrintersFromStorage();
            if (savedPrinters && savedPrinters.length > 0) {
              console.log(`Fallback: loaded ${savedPrinters.length} printers from localStorage`);
              setPrinters(savedPrinters);
            }
          }
        } catch (error) {
          console.error('Error during application initialization:', error);
          
          // 最后备用：尝试从localStorage读取
          const savedPrinters = await loadPrintersFromStorage();
          if (savedPrinters && savedPrinters.length > 0) {
            setPrinters(savedPrinters);
          }
        }
        
        // 获取license状态
        fetchLicenseStatus();
        // 获取打印机状态
        getPrintersStatus();
      }
    };
    
    loadDataAfterAuth();
  }, [state.isAuthenticated]);
  
  // 后台每30秒自动刷新打印机状态（不依赖当前Tab）
  useEffect(() => {
    if (!auth.isAuthenticated) return;

    const backgroundRefresh = async () => {
      try {
        const token = auth.accessToken || auth.state?.accessToken;
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/printers/all-printer-status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) return;

        const result = await response.json();
        const statusData = result.data || result;

        if (Array.isArray(statusData)) {
          // 缓存ping结果
          const newPingResults = {};
          statusData.forEach(printer => {
            if (printer && printer.ip) {
              newPingResults[printer.ip] = printer.online === true || printer.status === 'Ready';
            }
          });
          localStorage.setItem('cachedPingResults', JSON.stringify({
            results: newPingResults,
            timestamp: Date.now()
          }));

          // 更新localStorage中的打印机状态，保留isTest等本地字段
          try {
            const savedPrinters = localStorage.getItem('printers');
            if (savedPrinters) {
              const localPrinters = JSON.parse(savedPrinters);
              if (Array.isArray(localPrinters)) {
                const updatedLocalPrinters = localPrinters.map(lp => {
                  if (!lp || !lp.ip) return lp;
                  const statusResult = statusData.find(sp => sp && sp.ip === lp.ip);
                  if (statusResult) {
                    return {
                      ...lp,
                      status: statusResult.online ? 'online' : 'offline',
                      lastUpdated: new Date().toISOString(),
                      // 更新toner数据（如果后端返回了有效数据）
                      ...(statusResult.tonerLevels && Object.keys(statusResult.tonerLevels).length > 0
                        ? { actualTonerLevels: statusResult.tonerLevels }
                        : {})
                    };
                  }
                  return lp;
                });
                localStorage.setItem('printers', JSON.stringify(updatedLocalPrinters));
              }
            }
          } catch (updateErr) {
            console.warn('Failed to update printer status in localStorage:', updateErr.message);
          }

          // 缓存SNMP墨粉数据
          const tonerCache = {};
          statusData.forEach(printer => {
            if (printer && printer.ip && printer.tonerLevels && typeof printer.tonerLevels === 'object') {
              if (Object.keys(printer.tonerLevels).length > 0) {
                tonerCache[printer.ip] = printer.tonerLevels;
              }
            }
          });
          if (Object.keys(tonerCache).length > 0) {
            localStorage.setItem('cachedTonerData', JSON.stringify({
              data: tonerCache,
              timestamp: Date.now()
            }));
          }

          // 立即刷新UI状态，避免显示unknown
          getPrintersStatus(false);
        }
      } catch (error) {
        // 后台刷新失败不影响用户操作
        console.warn('Background printer status refresh failed:', error.message);
      }
    };

    // 立即执行一次
    backgroundRefresh();
    // 每30秒执行
    const intervalId = setInterval(backgroundRefresh, 30000);

    return () => clearInterval(intervalId);
  }, [auth.isAuthenticated, auth.accessToken, auth.state?.accessToken]);


  // 处理登录
  const handleLogin = (user) => {
    setCurrentUser(user);
    setAuthenticated(true);
  };

  // 处理登出
  const handleLogout = async () => {
    try {
      // 先关闭用户资料对话框
      closeUserProfile();
      // 调用登出服务（清除localStorage中的currentUser和authSession）
      await userDataService.logout();
      // 重置AuthContext状态（清除token和认证状态）
      auth.logout();
      // 重置AppContext状态
      logout();
      setTab(1); // 登出后回到 Status Monitoring（公开页面）
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // 处理用户信息更新
  const handleUserUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  // 获取用户头像首字母
  const getUserInitials = (username) => {
    return username ? username.charAt(0).toUpperCase() : 'U';
  };

  // 获取头像背景色
  const getAvatarColor = (username) => {
    const colors = [
      '#1976d2', '#1565c0', '#0277bd', '#00838f', '#00695c',
      '#2e7d32', '#1976d2', '#1565c0', '#0d47a1', '#1976d2'
    ];
    const index = username ? username.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // 只有在没有用户保存的主题偏好时才应用系统变化
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        setIsDarkTheme(e.matches);
        document.body.classList.toggle('dark-theme', e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 获取打印机状态的统一函数，可在初始化和刷新时使用
  const getPrintersStatus = async (setLoadingState = true) => {
    if (setLoadingState) setLoading(true);
    try {
      // 直接从localStorage获取最新数据
      console.log('Getting latest printers data from localStorage...');
      
      // 从localStorage或当前状态获取数据
      let safePrinters;
      try {
        const savedPrinters = localStorage.getItem('printers');
        safePrinters = savedPrinters ? JSON.parse(savedPrinters) : [];
        // 确保是数组
        if (!Array.isArray(safePrinters)) {
          safePrinters = [];
        }
      } catch (e) {
        console.warn('Failed to load printers from localStorage, using current state:', e);
        // 回退到当前状态
        safePrinters = Array.isArray(state.printers) ? state.printers : [];
      }
      
      // 如果没有配置打印机，直接返回空数组
      if (safePrinters.length === 0) {
        setPrinterStatuses([]);
        setError(null);
        return true;
      }
      
      // 尝试从localStorage获取最新的ping检测结果
      let cachedPingResults = {};
      try {
        const pingCache = localStorage.getItem('cachedPingResults');
        if (pingCache) {
          const parsedCache = JSON.parse(pingCache);
          cachedPingResults = parsedCache.results || {};
        }
      } catch (pingError) {
        console.warn('Failed to load cached ping results:', pingError);
      }
      
      // 创建最终的打印机状态数据 - 使用从localStorage加载的打印机数据，并考虑最新的ping结果
      // 过滤掉测试模式的打印机，不在Status Monitoring中显示
      const finalPrinterStatuses = safePrinters.filter(p => p && !p.isTest).map(localPrinter => {
        try {
          // 确保localPrinter是对象
          if (!localPrinter || typeof localPrinter !== 'object') {
            return {
              id: `printer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              name: 'Unknown Printer',
              model: 'Unknown Model',
              ip: 'Unknown IP',
              status: 'unknown',
              lastUpdated: new Date().toISOString(),
              actualTonerLevels: {}
            };
          }
          
          // 获取打印机IP用于查找ping结果
          const printerIp = localPrinter.ip || '';
          
          // 优先从cachedPingResults获取状态，如果有且有效
          let printerStatus = 'unknown';
          if (printerIp && cachedPingResults[printerIp] !== undefined) {
            // 使用ping检测结果作为打印机状态
            printerStatus = cachedPingResults[printerIp] === true ? 'online' : 'offline';
          } else if (localPrinter.status && localPrinter.status !== 'unknown') {
            // 否则使用localStorage中保存的状态（排除unknown）
            printerStatus = localPrinter.status;
          }
          
          // 构建完整的打印机数据 - 只使用本地配置的数据，确保数据一致性
          const mergedData = {
            // 确保基本字段存在
            id: localPrinter.id || `printer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: localPrinter.name || 'Unknown Printer',
            model: localPrinter.model || 'Unknown Model',
            ip: printerIp,
            serialNumber: localPrinter.serialNumber || '',
            port: localPrinter.port || '',
            location: localPrinter.location || '',
            // 使用确定的状态
            status: printerStatus,
            lastUpdated: localPrinter.lastUpdated || new Date().toISOString(),
            // 处理墨粉数据 - 优先使用实际墨粉数据，如果没有则使用手动配置的
            actualTonerLevels: localPrinter.actualTonerLevels || localPrinter.manualTonerLevels || {},
            // 包含所有本地配置的数据
            ...localPrinter
          };
          
          return mergedData;
        } catch (printerError) {
          console.error(`Error processing printer data for ${localPrinter?.ip || 'unknown IP'}:`, printerError);
          // 返回一个安全的默认值
          return {
            id: localPrinter?.id || `printer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: localPrinter?.name || 'Unknown Printer',
            model: localPrinter?.model || 'Unknown Model',
            ip: localPrinter?.ip || 'Unknown IP',
            status: 'unknown',
            lastUpdated: new Date().toISOString(),
            actualTonerLevels: localPrinter?.manualTonerLevels || {}
          };
        }
      });

      setPrinterStatuses(finalPrinterStatuses);
      setError(null);
      return true;
    } catch (err) {
      console.error('Failed to fetch printer status data:', err);
      setError('Failed to fetch printer status, some features may be limited');
      
      // 错误情况下，显示本地配置的打印机，与正常流程保持一致
      const fallbackStatuses = Array.isArray(state.printers) ? 
        state.printers.filter(p => !p?.isTest).map(printer => ({
          id: printer?.id || `printer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: printer?.name || 'Unknown Printer',
          model: printer?.model || 'Unknown Model',
          ip: printer?.ip || 'Unknown IP',
          serialNumber: printer?.serialNumber || '',
          port: printer?.port || '',
          location: printer?.location || '',
          status: printer?.status || 'unknown',
          lastUpdated: printer?.lastUpdated || new Date().toISOString(),
          actualTonerLevels: printer?.actualTonerLevels || printer?.manualTonerLevels || {},
          ...printer
        })) : [];
      setPrinterStatuses(fallbackStatuses);
      throw err;
    } finally {
      if (setLoadingState) setLoading(false);
    }
  };

  // 初始化时获取打印机状态
  useEffect(() => {
    getPrintersStatus();
  }, [state.printers]);

  // 保存打印机数据到本地存储
  const enhancedSyncPrintersData = async () => {
    if (!state.printers || state.printers.length === 0) return;
    
    console.log('Printers data changed, saving to storage...');
    
    try {
      // 保存到localStorage
      localStorage.setItem('printers', JSON.stringify(state.printers));
      localStorage.setItem('printers_timestamp', new Date().toISOString());
      console.log('Printers data saved to localStorage with timestamp');
    } catch (error) {
      console.error('Failed to save printers data to localStorage:', error);
    }
  };
  

  
  // 监听打印机数据变化，保存到存储
  useEffect(() => {
    enhancedSyncPrintersData();
  }, [state.printers]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    // 未登录时，只允许访问 Tab 1 (Status Monitoring)
    if (!auth.isAuthenticated && newValue !== 1) {
      setShowLoginDialog(true);
      return;
    }
    setTab(newValue);
    // Reset report sent status
    if (state.tabValue === 3 && newValue !== 3) {
      setReportSent(false);
    }
  };

  // Add new printer - 添加到本地并同步到统一数据源
  const addPrinter = async (newPrinter) => {
    try {
      // 为新打印机生成ID
      const printerId = Date.now().toString();
      const printerToAdd = {
        id: printerId,
        name: newPrinter.name || '',
        ip: newPrinter.ip || '',
        serialNumber: newPrinter.serialNumber || '',
        port: newPrinter.port || '',
        location: newPrinter.location || '',
        model: newPrinter.model || '',
        manualTonerLevels: newPrinter.manualTonerLevels || {},
        lastUpdated: new Date().toISOString()
      };
      
      // 添加到本地状态
      const updatedPrinters = [...state.printers, printerToAdd];
      setPrinters(updatedPrinters);
      
      // 保存到localStorage
      try {
        localStorage.setItem('printers', JSON.stringify(updatedPrinters));
        localStorage.setItem('printers_timestamp', new Date().toISOString());
        console.log('Printer added and saved to localStorage:', printerToAdd);
        
        // 同步到后端（全局共享）
        const token = auth.accessToken || auth.state?.accessToken;
        if (token) {
          fetch(`${API_BASE_URL}/printers/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ printers: updatedPrinters })
          }).catch(err => console.warn('Failed to sync printers to backend after add:', err.message));
        }
        
        return true;
      } catch (err) {
        console.error('Failed to save new printer to localStorage:', err);
        return false;
      }
    } catch (err) {
      console.error('Failed to add printer:', err);
      setError('Failed to add printer: ' + err.message);
      return false;
    }
  };

  // Update printer - 更新到本地并同步到统一数据源
  const updatePrinter = async (index, updatedPrinter) => {
    try {
      // 直接使用强制更新函数，确保索引和数据正确传递
      const result = await forceUpdatePrinter(index, updatedPrinter);
      
      // forceUpdatePrinter函数已经处理了同步，这里不需要再次同步
      return result;
    } catch (err) {
      console.error('Failed to update printer:', err);
      setError('Failed to update printer: ' + err.message);
      return false;
    }
  };

  // Delete printer - 删除并同步到统一数据源
  const deletePrinter = async (index) => {
    try {
      // 删除打印机
      const newPrinters = state.printers.filter((_, i) => i !== index);
      setPrinters(newPrinters);
      
      // 保存到localStorage
      try {
        localStorage.setItem('printers', JSON.stringify(newPrinters));
        localStorage.setItem('printers_timestamp', new Date().toISOString());
        console.log('Printer deleted and saved to localStorage');
        
        // 同步到后端（全局共享）
        const token = auth.accessToken || auth.state?.accessToken;
        if (token) {
          fetch(`${API_BASE_URL}/printers/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ printers: newPrinters })
          }).catch(err => console.warn('Failed to sync printers to backend after delete:', err.message));
        }
        
        return true;
      } catch (err) {
        console.error('Failed to save after deleting printer:', err);
        return false;
      }
    } catch (err) {
      console.error('Failed to delete printer:', err);
      setError('Failed to delete printer: ' + err.message);
      return false;
    }
  };

  // Generate and send report - 改进以包含完整的打印机状态数据和前端生成的HTML
  const generateAndSendReport = async (reportData, selectedStyle = 1) => {
    try {
      setLoading(true);
      
      // 准备报告数据 - 发送打印机配置让后端实时获取墨粉数据
      const enhancedReportData = {
        ...reportData,
        // 不发送manualData，让后端实时抓取墨粉数据
        manualData: null,
        // 发送打印机配置（name + ip），后端会实时获取toner数据
        printers: state.printerStatuses.filter(printer => !printer.isTest).map(printer => ({
            name: printer.name || 'Unknown Printer',
            ip: printer.ip || 'Unknown IP',
            model: printer.model || 'Unknown Model',
          })),
        // 保留前端生成的HTML内容作为备用
        reportHtml: reportData.reportHtml,
        // 添加选中的样式
        selectedStyle: selectedStyle
      };
      
      console.log('Sending enhanced report data:', enhancedReportData);
      let currentToken = auth.accessToken;
      try {
        const response = await axios.post(`${API_BASE_URL}/reports/generate`, enhancedReportData, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        return { success: true, data: response.data };
      } catch (reqError) {
        // 如果401，尝试刷新token后重试
        if (reqError.response?.status === 401 && auth.state?.refreshToken) {
          try {
            const refreshRes = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken: auth.state.refreshToken
            });
            const newToken = refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;
            const newRefresh = refreshRes.data?.data?.refreshToken || refreshRes.data?.refreshToken;
            if (newToken) {
              auth.setTokens(newToken, newRefresh || auth.state.refreshToken);
              const retryRes = await axios.post(`${API_BASE_URL}/reports/generate`, enhancedReportData, {
                headers: { Authorization: `Bearer ${newToken}` }
              });
              return { success: true, data: retryRes.data };
            }
          } catch (refreshErr) {
            console.error('Token refresh failed:', refreshErr);
          }
        }
        throw reqError;
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Refresh status data - 分离打印机状态和license状态获取
  const refreshStatusData = async () => {
    setLoading(true);
    
    try {
      // 同时刷新打印机状态和license状态，但使用并行处理
      await Promise.all([
        refreshPrinterStatus(),
        refreshLicenseStatus()
      ]);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh status data:', err);
      setError('Failed to refresh status, using local data');
    } finally {
      setLoading(false);
    }
  };

  // 单独刷新打印机状态
  const refreshPrinterStatus = async () => {
    try {
      // 直接使用统一的getPrintersStatus函数
      await getPrintersStatus(false); // 设置为false，因为loading状态由refreshStatusData控制
    } catch (err) {
      console.error('Failed to refresh printer status:', err);
      throw err;
    }
  };

  // 单独刷新license状态（忽略缓存）
  const refreshLicenseStatus = async () => {
    try {
      // 直接从API获取新数据，不使用缓存
      const licenseResponse = await axios.get(`${API_BASE_URL}/license-days`);
      // API response is wrapped: { code, success, data: { remainingDays, ... } }
      const licenseData = licenseResponse.data?.data || licenseResponse.data || { remainingDays: 0 };
      console.log('刷新许可证数据成功:', licenseData.remainingDays);
      logApiCall(`${API_BASE_URL}/license-days`, true, licenseResponse.data, null);
      
      // 更新状态和缓存 (cache the unwrapped data)
      setLicenseDays(licenseData.remainingDays || 0);
      localStorage.setItem('cachedLicense', JSON.stringify(licenseData));
      localStorage.setItem('cachedLicenseTime', Date.now().toString());
    } catch (apiError) {
      console.warn('Failed to refresh license data from API:', apiError);
      logApiCall(`${API_BASE_URL}/license-days`, false, null, apiError);
      // 不抛出错误，让打印机状态刷新继续
    }
  };

  // Update system settings
  const updateSettings = async (settings) => {
    try {
      await axios.post(`${API_BASE_URL}/settings`, settings);
      // Refresh status data after updating settings
      refreshStatusData();
      return { success: true };
    } catch (error) {
      console.error('Failed to update settings:', error);
      return { success: false, error: error.message };
    }
  };

  // Handle printer reordering
  const handleReorderPrinters = async (newOrder) => {
    try {
      console.log('Reordering printers:', newOrder);
      setPrinters(newOrder);
      // 保存到localStorage
      try {
        localStorage.setItem('printers', JSON.stringify(newOrder));
        localStorage.setItem('printers_timestamp', new Date().toISOString());
        console.log('Printers reordered and saved to localStorage');
        
        // 同步到后端（全局共享）
        const token = auth.accessToken || auth.state?.accessToken;
        if (token) {
          fetch(`${API_BASE_URL}/printers/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ printers: newOrder })
          }).catch(err => console.warn('Failed to sync reorder to backend:', err.message));
        }
        
        return true;
      } catch (err) {
        console.error('Failed to save reordered printers:', err);
        return false;
      }
    } catch (error) {
      console.error('Failed to reorder printers:', error);
      setError('Failed to reorder printers: ' + error.message);
      return false;
    }
  };

  return (
    <>
      {/* Login Dialog */}
      <LoginDialog
        open={showLoginDialog && !auth.isAuthenticated}
        onClose={() => {
          setShowLoginDialog(false);
          // 未登录时关闭对话框，回到 Status Monitoring
          if (!auth.isAuthenticated) {
            setTab(1);
          }
        }}
      />

      <Container maxWidth="lg" sx={{ py: 1.5, minHeight: '100vh', backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      {state.isAuthenticated && (
        <Header
          formatBeijingTime={formatBeijingTime}
          onUserProfileClick={openUserProfile}
          onThemeToggle={handleToggleTheme}
          getUserInitials={getUserInitials}
          getAvatarColor={getAvatarColor}
        />
      )}
      
      {!state.isAuthenticated && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 2,
            px: 3,
            backgroundColor: 'var(--background-paper)',
            borderRadius: 2,
            boxShadow: 1,
            mb: 3
          }}
        >
          <Typography variant="h4" component="h1" sx={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.75rem' }}>
            Print Service Monitoring System
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Login />}
            onClick={() => setShowLoginDialog(true)}
            sx={{ textTransform: 'none' }}
          >
            Login
          </Button>
        </Box>
      )}
      
      {/* Error Alert */}
      <ErrorAlert />
      
      {/* Loading Indicator */}
      <LoadingIndicator />
      
      {/* Tab Navigation - 始终显示 */}
      <TabNavigation
        currentUser={state.currentUser}
        onTabChange={handleTabChange}
      />
      
      {/* Main Content */}
      {!state.isAuthenticated ? (
        <Paper sx={{ p: 2, pt: 1.5, backgroundColor: 'var(--background-paper)', boxSizing: 'border-box' }}>
          <StatusDashboard
            printerStatuses={state.printerStatuses}
            onRefresh={refreshStatusData}
            licenseDays={state.licenseDays}
          />
          <PrintServerMonitoring />
        </Paper>
      ) : (
        <ErrorBoundary>
          <AppContent
            onAddPrinter={addPrinter}
            onUpdatePrinter={updatePrinter}
            onDeletePrinter={deletePrinter}
            onReorderPrinters={handleReorderPrinters}
            onGenerateReport={generateAndSendReport}
            onUpdateSettings={updateSettings}
            onRefreshStatus={refreshStatusData}
            printers={state.printers}
            printerStatuses={state.printerStatuses}
            currentUser={state.currentUser}
          />
        </ErrorBoundary>
      )}
      
      {/* System status */}
      <Box sx={{
        mt: 'auto',
        pt: 3,
        pb: 1.5,
        px: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4caf50', flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
          {t('statusDashboard.systemStatus')} {t('common.online')} | {t('statusDashboard.lastUpdated')} {new Date().toLocaleTimeString()}
        </Typography>
      </Box>
      
      {/* User Profile Dialog */}
      <Dialog
        open={state.isUserProfileOpen}
        onClose={closeUserProfile}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>User Profile</DialogTitle>
        <DialogContent>
          <UserProfile
            user={state.currentUser}
            onUserUpdate={handleUserUpdate}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleLogout}
            color="error"
            startIcon={<Logout />}
          >
            Logout
          </Button>
          <Button onClick={closeUserProfile}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
    </>
  );
};

export default App;
