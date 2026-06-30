import { useContext } from 'react';
import { AppContext } from './AppContext';

/**
 * 自定义hook - 用于访问AppContext
 * 在任何组件中使用: const { state, actions } = useAppContext()
 */
export const useAppContext = () => {
  const context = useContext(AppContext);
  
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  
  return context;
};

export default useAppContext;
