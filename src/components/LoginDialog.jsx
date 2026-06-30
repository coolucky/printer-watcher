/**
 * 登录对话框组件
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Box,
  Typography,
  Link
} from '@mui/material';
import axios from 'axios';
import { useAuthContext } from '../context/useAuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * 登录对话框组件
 * @param {boolean} open - 对话框是否打开
 * @param {Function} onClose - 关闭对话框的回调
 */
function LoginDialog({ open, onClose }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [forgotMode, setForgotMode] = useState(false);

  const auth = useAuthContext();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      console.log('[LOGIN] Attempting login for user:', username);

      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        username,
        password
      });

      if (response.data.success) {
        const { accessToken, refreshToken, user } = response.data.data;

        console.log('[LOGIN] ✓ Login successful');

        // 更新认证状态
        auth.dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user,
            accessToken,
            refreshToken
          }
        });

        // 清空表单
        setPassword('');

        // 关闭对话框
        onClose();
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('[LOGIN] Error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      auth.dispatch({
        type: 'LOGIN_ERROR',
        payload: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccessMsg(null);

    if (!username) {
      setError('Please enter your username first');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        username
      });

      if (response.data.success) {
        setSuccessMsg('Password reset email has been sent. Please check your inbox.');
        setForgotMode(false);
      } else {
        setError(response.data.message || 'Failed to send reset email');
      }
    } catch (err) {
      console.error('[FORGOT] Error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send reset email';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setForgotMode(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">
            {forgotMode ? 'Forgot Password' : 'System Login'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {successMsg && (
            <Alert severity="success" onClose={() => setSuccessMsg(null)}>
              {successMsg}
            </Alert>
          )}

          <TextField
            label="Username"
            type="text"
            variant="outlined"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            placeholder="Enter your username"
            autoComplete="username"
          />

          {!forgotMode && (
            <TextField
              label="Password"
              type="password"
              variant="outlined"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your password"
              autoComplete="current-password"
              onKeyPress={(e) => e.key === 'Enter' && handleLogin(e)}
            />
          )}

          {forgotMode ? (
            <Typography variant="body2" color="textSecondary">
              Enter your username and click "Send Reset Email". A temporary password will be sent to your registered email address.
            </Typography>
          ) : (
            <Box display="flex" justifyContent="flex-end" alignItems="center">
              <Link
                component="button"
                variant="caption"
                onClick={(e) => {
                  e.preventDefault();
                  setForgotMode(true);
                  setError(null);
                  setSuccessMsg(null);
                }}
                sx={{ cursor: 'pointer' }}
              >
                Forgot Password?
              </Link>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        {forgotMode ? (
          <>
            <Button
              onClick={() => { setForgotMode(false); setError(null); setSuccessMsg(null); }}
              disabled={isLoading}
              variant="outlined"
            >
              Back to Login
            </Button>
            <Button
              onClick={handleForgotPassword}
              disabled={isLoading || !username}
              variant="contained"
              sx={{ minWidth: 140 }}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Send Reset Email'}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleClose}
              disabled={isLoading}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogin}
              disabled={isLoading || !username || !password}
              variant="contained"
              sx={{ minWidth: 100 }}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Login'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default LoginDialog;
