import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info', duration: 4000 });

  const notify = useCallback((message, severity = 'info', duration = 4000) => {
    setNotification({ open: true, message, severity, duration });
  }, []);

  const success = useCallback((msg) => notify(msg, 'success'), [notify]);
  const error = useCallback((msg) => notify(msg, 'error', 6000), [notify]);
  const warning = useCallback((msg) => notify(msg, 'warning', 5000), [notify]);
  const info = useCallback((msg) => notify(msg, 'info'), [notify]);

  const handleClose = useCallback((_, reason) => {
    if (reason === 'clickaway') return;
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, success, error, warning, info }}>
      {children}
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleClose} severity={notification.severity} variant="filled" sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
