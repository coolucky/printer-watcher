import React from 'react';
import { Alert } from '@mui/material';
import { useAppContext } from '../context';

/**
 * ErrorAlert Component - 错误提示组件
 * 显示应用级别的错误信息
 */
const ErrorAlert = () => {
  const { state } = useAppContext();
  const { error } = state;

  if (!error) {
    return null;
  }

  return (
    <Alert
      severity="error"
      sx={{
        mb: 2,
        backgroundColor: 'var(--background-paper)',
        color: 'var(--error-color)'
      }}
    >
      {error}
    </Alert>
  );
};

export default ErrorAlert;
