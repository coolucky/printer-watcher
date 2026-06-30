import React, { useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme } from './index';
import { useAppContext } from '../context';

/**
 * Wraps the app with MUI ThemeProvider that reacts to the isDarkTheme context state.
 * Also injects CssBaseline for consistent cross-browser resets.
 */
export default function ThemeWrapper({ children }) {
  const { state } = useAppContext();
  const mode = state.isDarkTheme ? 'dark' : 'light';
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
