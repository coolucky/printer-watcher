import React, { createContext, useReducer, useCallback, useEffect } from 'react';

/**
 * 应用全局状态上下文
 * 用于管理应用的全局状态，避免过深的prop drilling
 */
export const AppContext = createContext();

/**
 * 初始状态
 */
const getInitialTabValue = () => {
  try {
    // Only restore saved tab if user has a valid auth session
    const authSession = localStorage.getItem('authSession');
    if (authSession) {
      const session = JSON.parse(authSession);
      if (session && session.isAuthenticated) {
        const saved = localStorage.getItem('app_last_tab');
        if (saved !== null) {
          const parsed = Number.parseInt(saved, 10);
          if (Number.isInteger(parsed) && parsed >= 0) {
            return parsed;
          }
        }
      }
    }
  } catch { /* ignore */ }
  return 1; // Default: Status Monitoring
};

const initialState = {
  // 主题状态
  isDarkTheme: false,
  
  // UI状态
  tabValue: getInitialTabValue(),
  isUserProfileOpen: false,
  
  // 打印机相关状态
  printers: [],
  printerStatuses: [],
  
  // 许可和时间
  licenseDays: 0,
  currentDateTime: new Date(),
  
  // 加载和错误状态
  loading: false,
  error: null,
  reportSent: false,
  
  // 用户认证状态
  isAuthenticated: true,
  currentUser: null,
};

/**
 * Action类型常量
 */
export const ACTIONS = {
  // 主题
  TOGGLE_THEME: 'TOGGLE_THEME',
  SET_THEME: 'SET_THEME',
  
  // UI
  SET_TAB: 'SET_TAB',
  TOGGLE_USER_PROFILE: 'TOGGLE_USER_PROFILE',
  OPEN_USER_PROFILE: 'OPEN_USER_PROFILE',
  CLOSE_USER_PROFILE: 'CLOSE_USER_PROFILE',
  
  // 打印机
  SET_PRINTERS: 'SET_PRINTERS',
  SET_PRINTER_STATUSES: 'SET_PRINTER_STATUSES',
  ADD_PRINTER: 'ADD_PRINTER',
  UPDATE_PRINTER: 'UPDATE_PRINTER',
  DELETE_PRINTER: 'DELETE_PRINTER',
  
  // 许可和时间
  SET_LICENSE_DAYS: 'SET_LICENSE_DAYS',
  UPDATE_DATETIME: 'UPDATE_DATETIME',
  
  // 加载和错误
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_REPORT_SENT: 'SET_REPORT_SENT',
  CLEAR_REPORT_SENT: 'CLEAR_REPORT_SENT',
  
  // 用户认证
  SET_AUTHENTICATED: 'SET_AUTHENTICATED',
  SET_CURRENT_USER: 'SET_CURRENT_USER',
  LOGOUT: 'LOGOUT',
  
  // 批量更新
  SET_STATE: 'SET_STATE',
  RESET_STATE: 'RESET_STATE',
};

/**
 * Reducer函数
 */
function appReducer(state, action) {
  switch (action.type) {
    // 主题
    case ACTIONS.TOGGLE_THEME:
      return { ...state, isDarkTheme: !state.isDarkTheme };
    
    case ACTIONS.SET_THEME:
      return { ...state, isDarkTheme: action.payload };
    
    // UI
    case ACTIONS.SET_TAB:
      return { ...state, tabValue: action.payload };
    
    case ACTIONS.TOGGLE_USER_PROFILE:
      return { ...state, isUserProfileOpen: !state.isUserProfileOpen };
    
    case ACTIONS.OPEN_USER_PROFILE:
      return { ...state, isUserProfileOpen: true };
    
    case ACTIONS.CLOSE_USER_PROFILE:
      return { ...state, isUserProfileOpen: false };
    
    // 打印机
    case ACTIONS.SET_PRINTERS:
      return { ...state, printers: action.payload };
    
    case ACTIONS.SET_PRINTER_STATUSES:
      return { ...state, printerStatuses: action.payload };
    
    case ACTIONS.ADD_PRINTER: {
      const newPrinter = action.payload;
      return { ...state, printers: [...state.printers, newPrinter] };
    }
    
    case ACTIONS.UPDATE_PRINTER: {
      const { id, data } = action.payload;
      return {
        ...state,
        printers: state.printers.map(p => p.id === id ? { ...p, ...data } : p),
      };
    }
    
    case ACTIONS.DELETE_PRINTER: {
      return {
        ...state,
        printers: state.printers.filter(p => p.id !== action.payload),
      };
    }
    
    // 许可和时间
    case ACTIONS.SET_LICENSE_DAYS:
      return { ...state, licenseDays: action.payload };
    
    case ACTIONS.UPDATE_DATETIME:
      return { ...state, currentDateTime: action.payload };
    
    // 加载和错误
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    
    case ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    
    case ACTIONS.SET_REPORT_SENT:
      return { ...state, reportSent: action.payload };
    
    case ACTIONS.CLEAR_REPORT_SENT:
      return { ...state, reportSent: false };
    
    // 用户认证
    case ACTIONS.SET_AUTHENTICATED:
      return { ...state, isAuthenticated: action.payload };
    
    case ACTIONS.SET_CURRENT_USER:
      return { ...state, currentUser: action.payload, isAuthenticated: true };
    
    case ACTIONS.LOGOUT:
      return { ...state, currentUser: null, isAuthenticated: false };
    
    // 批量更新
    case ACTIONS.SET_STATE:
      return { ...state, ...action.payload };
    
    case ACTIONS.RESET_STATE:
      return initialState;
    
    default:
      return state;
  }
}

/**
 * AppContext Provider组件
 */
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, null, () => ({
    ...initialState,
    tabValue: getInitialTabValue(),
  }));

  // 更新时间的副作用
  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: ACTIONS.UPDATE_DATETIME, payload: new Date() });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 便捷的action creators
  const actions = {
    // 主题
    toggleTheme: useCallback(() => dispatch({ type: ACTIONS.TOGGLE_THEME }), []),
    setTheme: useCallback((isDark) => dispatch({ type: ACTIONS.SET_THEME, payload: isDark }), []),
    
    // UI
    setTab: useCallback((tabIndex) => dispatch({ type: ACTIONS.SET_TAB, payload: tabIndex }), []),
    toggleUserProfile: useCallback(() => dispatch({ type: ACTIONS.TOGGLE_USER_PROFILE }), []),
    openUserProfile: useCallback(() => dispatch({ type: ACTIONS.OPEN_USER_PROFILE }), []),
    closeUserProfile: useCallback(() => dispatch({ type: ACTIONS.CLOSE_USER_PROFILE }), []),
    
    // 打印机
    setPrinters: useCallback((printers) => dispatch({ type: ACTIONS.SET_PRINTERS, payload: printers }), []),
    setPrinterStatuses: useCallback((statuses) => dispatch({ type: ACTIONS.SET_PRINTER_STATUSES, payload: statuses }), []),
    addPrinter: useCallback((printer) => dispatch({ type: ACTIONS.ADD_PRINTER, payload: printer }), []),
    updatePrinter: useCallback((id, data) => dispatch({ type: ACTIONS.UPDATE_PRINTER, payload: { id, data } }), []),
    deletePrinter: useCallback((id) => dispatch({ type: ACTIONS.DELETE_PRINTER, payload: id }), []),
    
    // 许可和时间
    setLicenseDays: useCallback((days) => dispatch({ type: ACTIONS.SET_LICENSE_DAYS, payload: days }), []),
    
    // 加载和错误
    setLoading: useCallback((loading) => dispatch({ type: ACTIONS.SET_LOADING, payload: loading }), []),
    setError: useCallback((error) => dispatch({ type: ACTIONS.SET_ERROR, payload: error }), []),
    clearError: useCallback(() => dispatch({ type: ACTIONS.CLEAR_ERROR }), []),
    setReportSent: useCallback((sent) => dispatch({ type: ACTIONS.SET_REPORT_SENT, payload: sent }), []),
    clearReportSent: useCallback(() => dispatch({ type: ACTIONS.CLEAR_REPORT_SENT }), []),
    
    // 用户认证
    setAuthenticated: useCallback((auth) => dispatch({ type: ACTIONS.SET_AUTHENTICATED, payload: auth }), []),
    setCurrentUser: useCallback((user) => dispatch({ type: ACTIONS.SET_CURRENT_USER, payload: user }), []),
    logout: useCallback(() => dispatch({ type: ACTIONS.LOGOUT }), []),
    
    // 批量更新
    setState: useCallback((partialState) => dispatch({ type: ACTIONS.SET_STATE, payload: partialState }), []),
    resetState: useCallback(() => dispatch({ type: ACTIONS.RESET_STATE }), []),
  };

  const value = {
    state,
    dispatch,
    ...actions,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
