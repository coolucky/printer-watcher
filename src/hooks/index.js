/**
 * usePrinters Hook - 管理打印机数据的自定义hook
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import ENV_CONFIG from '../config/env';

export const usePrinters = () => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 从localStorage加载打印机数据
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
          setPrinters(parsedPrinters);
          setLoading(false);
          return;
        }
      }

      // 如果localStorage中没有数据，从API加载
      const response = await axios.get(`${ENV_CONFIG.API_BASE_URL}/all-printer-status`);
      if (response.data && response.data.length > 0) {
        const data = response.data.map((printer, index) => ({
          id: printer.id || (index + 1).toString(),
          ...printer
        }));
        setPrinters(data);
        localStorage.setItem('printers', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to load printers:', error);
      setError(error.message);
      // 返回默认数据作为后备
      setDefaultPrinters();
    } finally {
      setLoading(false);
    }
  };

  // 设置默认打印机数据
  const setDefaultPrinters = () => {
    const defaultData = [
      {
        id: '1',
        name: 'Beijing_12A',
        ip: '192.168.1.101',
        serialNumber: '369160',
        port: 168,
        macAddress: '1C:7D:22:4C:C7:F3',
        location: '12A',
        assetTag: '40741827',
        model: 'Fujifilm Apeos C5570',
        manualTonerLevels: { black: 97, cyan: 83, magenta: 58, yellow: 58 }
      },
      {
        id: '2',
        name: 'Beijing_12B',
        ip: '192.168.1.102',
        serialNumber: '369158',
        port: 490,
        macAddress: '1C:7D:22:4C:CA:0F',
        location: '12B',
        assetTag: '40741828',
        model: 'Fujifilm Apeos C5570',
        manualTonerLevels: { black: 40, cyan: 77, magenta: 79, yellow: 82 }
      },
      {
        id: '3',
        name: 'Shenzhen_18F',
        ip: '192.168.1.104',
        serialNumber: '369166',
        port: 24,
        macAddress: '1C:7D:22:4C:C5:7F',
        location: '18F',
        assetTag: '40741829',
        model: 'Fujifilm Apeos C5570',
        manualTonerLevels: { black: 99, cyan: 98, magenta: 98, yellow: 99 }
      },
      {
        id: '4',
        name: 'Shanghai_26A',
        ip: '192.168.1.103',
        serialNumber: '369442',
        port: 88,
        macAddress: '1C:7D:22:4D:CF:B1',
        location: '26F pantry',
        assetTag: '40717301',
        model: 'Fujifilm Apeos C5570',
        manualTonerLevels: { black: 39, cyan: 47, magenta: 79, yellow: 99 }
      },
      {
        id: '5',
        name: 'Shanghai_26B',
        ip: '192.168.1.105',
        serialNumber: '369486',
        port: 1,
        macAddress: '1C:7D:22:4D:DC:60',
        location: '26F IT Lab',
        assetTag: '40717302',
        model: 'Fujifilm Apeos C5570',
        manualTonerLevels: { black: 100, cyan: 100, magenta: 98, yellow: 100 }
      }
    ];
    setPrinters(defaultData);
    localStorage.setItem('printers', JSON.stringify(defaultData));
  };

  useEffect(() => {
    loadPrintersFromStorage();
  }, []);

  // 更新打印机
  const updatePrinter = (index, updatedPrinter) => {
    const newPrinters = [...printers];
    newPrinters[index] = { ...newPrinters[index], ...updatedPrinter };
    setPrinters(newPrinters);
    localStorage.setItem('printers', JSON.stringify(newPrinters));
  };

  // 添加打印机
  const addPrinter = (newPrinter) => {
    const printer = {
      id: Date.now().toString(),
      ...newPrinter
    };
    const newPrinters = [...printers, printer];
    setPrinters(newPrinters);
    localStorage.setItem('printers', JSON.stringify(newPrinters));
  };

  // 删除打印机
  const removePrinter = (index) => {
    const newPrinters = printers.filter((_, i) => i !== index);
    setPrinters(newPrinters);
    localStorage.setItem('printers', JSON.stringify(newPrinters));
  };

  return {
    printers,
    setPrinters,
    updatePrinter,
    addPrinter,
    removePrinter,
    loading,
    error
  };
};

/**
 * useTheme Hook - 管理主题的自定义hook
 */
export const useTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return {
    isDarkMode,
    setIsDarkMode,
    toggleTheme
  };
};

/**
 * useCurrentTime Hook - 管理当前时间的自定义hook
 */
export const useCurrentTime = () => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 格式化北京时间 (UTC+8)
  const formatBeijingTime = (date) => {
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai'
    };
    return date.toLocaleString('zh-CN', options).replace(/,/g, '').replace(/\//g, '-');
  };

  const formattedTime = formatBeijingTime(currentDateTime);

  return {
    currentDateTime,
    formattedTime,
    formatBeijingTime
  };
};

/**
 * useAuth Hook - 管理身份认证的自定义hook
 */
export const useAuth = () => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(!!user);

  const login = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('user');
  };

  return {
    user,
    isLoggedIn,
    setUser,
    login,
    logout
  };
};
