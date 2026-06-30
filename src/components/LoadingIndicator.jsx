import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAppContext } from '../context';

/**
 * LoadingIndicator Component - 加载指示器
 * 显示应用加载状态
 */
const LoadingIndicator = () => {
  const { state } = useAppContext();
  const { loading } = state;

  if (!loading) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress />
    </Box>
  );
};

export default LoadingIndicator;
