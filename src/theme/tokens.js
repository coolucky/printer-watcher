/**
 * Design Tokens - Single source of truth for all design values
 * All colors, spacing, typography, and shadows derive from here.
 */

export const palette = {
  light: {
    primary: { main: '#1976d2', hover: '#1565c0', light: '#e3f2fd' },
    text: { primary: '#213547', secondary: '#64748b' },
    background: { default: '#f8fafc', paper: '#ffffff', secondary: '#f8fafc', highlight: '#fafafa' },
    border: '#e2e8f0',
    success: { main: '#10b981', hover: '#059669', light: '#e8f5e9' },
    warning: { main: '#f59e0b', hover: '#d97706', light: '#fff3e0' },
    error: { main: '#ef4444', hover: '#dc2626', light: '#ffebee' },
    info: { main: '#3b82f6', hover: '#2563eb', light: '#f3e5f5' },
    status: {
      online: '#4caf50',
      onlineDark: '#2e7d32',
      onlineLight: '#e8f5e9',
      offline: '#f44336',
      offlineDark: '#c62828',
      offlineLight: '#ffebee',
      warning: '#ff9800',
      unknown: '#9e9e9e',
      info: '#1976d2',
    },
  },
  dark: {
    primary: { main: '#818cf8', hover: '#93c5fd', light: '#312e81' },
    text: { primary: '#f8fafc', secondary: '#cbd5e1' },
    background: { default: '#0f172a', paper: '#334155', secondary: '#0f172a', highlight: '#1e293b' },
    border: '#475569',
    success: { main: '#34d399', hover: '#2dd4bf', light: '#064e3b' },
    warning: { main: '#fbbf24', hover: '#f59e0b', light: '#78350f' },
    error: { main: '#f87171', hover: '#fb7185', light: '#7f1d1d' },
    info: { main: '#60a5fa', hover: '#93c5fd', light: '#1e3a5f' },
    status: {
      online: '#66bb6a',
      onlineDark: '#43a047',
      onlineLight: '#1b3d1e',
      offline: '#ef5350',
      offlineDark: '#e53935',
      offlineLight: '#3d1b1b',
      warning: '#ffa726',
      unknown: '#bdbdbd',
      info: '#42a5f5',
    },
  },
};

export const typography = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontFamilySystem: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadows = {
  card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
  cardHover: '0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
  elevated: '0 10px 25px rgba(0,0,0,0.12)',
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4,0,0.2,1)',
  normal: '250ms cubic-bezier(0.4,0,0.2,1)',
  slow: '350ms cubic-bezier(0.4,0,0.2,1)',
};
