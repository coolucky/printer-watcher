/**
 * 认证Context - 管理用户认证状态
 */

import React, { createContext, useReducer, useCallback } from 'react';

export const AuthContext = createContext();

// 认证状态初始值
const initialState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  error: null,
  tokenExpiringWarning: false
};

// 认证Actions
export const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOGOUT: 'LOGOUT',
  SET_TOKEN: 'SET_TOKEN',
  REFRESH_TOKEN_START: 'REFRESH_TOKEN_START',
  REFRESH_TOKEN_SUCCESS: 'REFRESH_TOKEN_SUCCESS',
  REFRESH_TOKEN_ERROR: 'REFRESH_TOKEN_ERROR',
  TOKEN_EXPIRING_SOON: 'TOKEN_EXPIRING_SOON',
  RESTORE_SESSION: 'RESTORE_SESSION',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// 认证Reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        loading: false,
        error: null,
        tokenExpiringWarning: false
      };

    case AUTH_ACTIONS.LOGIN_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState
      };

    case AUTH_ACTIONS.SET_TOKEN:
      return {
        ...state,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken
      };

    case AUTH_ACTIONS.REFRESH_TOKEN_START:
      return {
        ...state,
        loading: true
      };

    case AUTH_ACTIONS.REFRESH_TOKEN_SUCCESS:
      return {
        ...state,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken || state.refreshToken,
        loading: false,
        error: null,
        tokenExpiringWarning: false
      };

    case AUTH_ACTIONS.REFRESH_TOKEN_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false
      };

    case AUTH_ACTIONS.TOKEN_EXPIRING_SOON:
      return {
        ...state,
        tokenExpiringWarning: true
      };

    case AUTH_ACTIONS.RESTORE_SESSION:
      return {
        ...state,
        ...action.payload
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
}

/**
 * 认证Context Provider组件
 */
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 从localStorage恢复session
  React.useEffect(() => {
    const savedSession = localStorage.getItem('authSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        dispatch({
          type: AUTH_ACTIONS.RESTORE_SESSION,
          payload: session
        });
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem('authSession');
      }
    }
  }, []);

  // 保存session到localStorage
  React.useEffect(() => {
    if (state.isAuthenticated && state.accessToken) {
      localStorage.setItem('authSession', JSON.stringify({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken
      }));
    } else {
      localStorage.removeItem('authSession');
    }
  }, [state.isAuthenticated, state.user, state.accessToken, state.refreshToken]);

  // Action创建函数
  const login = useCallback((username, password) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });
    // 实际的登录逻辑会在组件中调用
    return (accessToken, refreshToken, user) => {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, accessToken, refreshToken }
      });
    };
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  }, []);

  const setTokens = useCallback((accessToken, refreshToken) => {
    dispatch({
      type: AUTH_ACTIONS.SET_TOKEN,
      payload: { accessToken, refreshToken }
    });
  }, []);

  const refreshTokens = useCallback((newAccessToken, newRefreshToken) => {
    dispatch({
      type: AUTH_ACTIONS.REFRESH_TOKEN_SUCCESS,
      payload: { accessToken: newAccessToken, refreshToken: newRefreshToken }
    });
  }, []);

  const setLoginError = useCallback((error) => {
    dispatch({
      type: AUTH_ACTIONS.LOGIN_ERROR,
      payload: error
    });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  const setTokenExpiringWarning = useCallback((warning) => {
    if (warning) {
      dispatch({ type: AUTH_ACTIONS.TOKEN_EXPIRING_SOON });
    } else {
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
    }
  }, []);

  const value = {
    // State
    state,
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    loading: state.loading,
    error: state.error,
    tokenExpiringWarning: state.tokenExpiringWarning,

    // Actions
    login,
    logout,
    setTokens,
    refreshTokens,
    setLoginError,
    clearError,
    setTokenExpiringWarning,
    dispatch
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
