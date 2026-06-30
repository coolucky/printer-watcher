/**
 * 使用AuthContext的自定义Hook
 */

import { useContext } from 'react';
import AuthContext from './AuthContext';

/**
 * useAuthContext Hook
 * 在组件中使用认证状态和方法
 * @returns {Object} 认证context对象
 */
export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return context;
}

export default useAuthContext;
