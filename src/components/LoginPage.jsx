import React, { useState } from 'react';
import { Box, Container, Paper, TextField, Button, Typography, Alert, Modal, Grid, IconButton } from '@mui/material';
import { LockOutlined, MailOutlined, PersonOutlined, Visibility, VisibilityOff } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import * as userDataService from '../services/userDataService';

const LoginPage = ({ onLogin }) => {
  const { t } = useTranslation();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [registerForm, setRegisterForm] = useState({
    ntid: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await userDataService.login(loginForm.username, loginForm.password);
      if (result.success) {
        onLogin(result.user);
      } else {
        setError(result.message || t('loginPage.loginFailed'));
      }
    } catch (err) {
      setError(t('loginPage.loginError'));
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 表单验证
    if (!registerForm.ntid || !registerForm.email || !registerForm.password) {
      setError(t('loginPage.fillAllFields'));
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError(t('loginPage.passwordMismatch'));
      return;
    }

    if (registerForm.password.length < 6) {
      setError(t('loginPage.passwordMinLength'));
      return;
    }

    try {
      const result = await userDataService.register({
        ntid: registerForm.ntid,
        email: registerForm.email,
        password: registerForm.password
      });

      if (result.success) {
        setSuccess(t('loginPage.registrationSuccess'));
        setRegisterForm({ ntid: '', email: '', password: '', confirmPassword: '' });
        setTimeout(() => setIsRegisterMode(false), 2000);
      } else {
        setError(result.message || t('loginPage.registrationFailed'));
      }
    } catch (err) {
      setError(t('loginPage.registrationError'));
      console.error('Register error:', err);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container maxWidth="sm" sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', py: 8 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--background-paper)',
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <LockOutlined sx={{ fontSize: 40, color: 'var(--primary-color)', mb: 2 }} />
          <Typography variant="h5" component="h1" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {isRegisterMode ? t('loginPage.registerAccount') : t('loginPage.userLogin')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 1 }}>
            {isRegisterMode ? t('loginPage.registerDescription') : t('loginPage.loginDescription')}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, backgroundColor: 'var(--background-paper)', color: 'var(--error-color)' }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3, backgroundColor: 'var(--background-paper)', color: 'var(--success-color)' }}>
            {success}
          </Alert>
        )}

        {!isRegisterMode ? (
          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              margin="normal"
              label={t('loginPage.username')}
              name="username"
              value={loginForm.username}
              onChange={handleLoginChange}
              required
              InputProps={{
                startAdornment: <PersonOutlined sx={{ mr: 1, color: 'var(--text-secondary)' }} />
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label={t('loginPage.password')}
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={loginForm.password}
              onChange={handleLoginChange}
              required
              InputProps={{
                startAdornment: <LockOutlined sx={{ mr: 1, color: 'var(--text-secondary)' }} />,
                endAdornment: (
                  <IconButton onClick={togglePasswordVisibility}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                )
              }}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                backgroundColor: 'var(--primary-color)',
                '&:hover': {
                  backgroundColor: 'var(--primary-hover)'
                }
              }}
            >
              {isLoading ? t('loginPage.loggingIn') : t('loginPage.login')}
            </Button>
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2">
                {t('loginPage.dontHaveAccount')}
                <Button
                  onClick={() => setIsRegisterMode(true)}
                  sx={{ ml: 1, color: 'var(--primary-color)', textTransform: 'none' }}
                >
                  {t('loginPage.registerNow')}
                </Button>
              </Typography>
            </Box>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <TextField
              fullWidth
              margin="normal"
              label={t('loginPage.fullName')}
              name="ntid"
              value={registerForm.ntid}
              onChange={handleRegisterChange}
              required
              InputProps={{
                startAdornment: <PersonOutlined sx={{ mr: 1, color: 'var(--text-secondary)' }} />
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label={t('loginPage.email')}
              name="email"
              type="email"
              value={registerForm.email}
              onChange={handleRegisterChange}
              required
              InputProps={{
                startAdornment: <MailOutlined sx={{ mr: 1, color: 'var(--text-secondary)' }} />
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label={t('loginPage.password')}
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={registerForm.password}
              onChange={handleRegisterChange}
              required
              InputProps={{
                startAdornment: <LockOutlined sx={{ mr: 1, color: 'var(--text-secondary)' }} />,
                endAdornment: (
                  <IconButton onClick={togglePasswordVisibility}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                )
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label={t('loginPage.confirmPassword')}
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={registerForm.confirmPassword}
              onChange={handleRegisterChange}
              required
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                py: 1.5,
                fontSize: '1rem',
                backgroundColor: 'var(--primary-color)',
                '&:hover': {
                  backgroundColor: 'var(--primary-hover)'
                }
              }}
            >
              {t('loginPage.register')}
            </Button>
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2">
                {t('loginPage.alreadyHaveAccount')}
                <Button
                  onClick={() => setIsRegisterMode(false)}
                  sx={{ ml: 1, color: 'var(--primary-color)', textTransform: 'none' }}
                >
                  {t('loginPage.backToLogin')}
                </Button>
              </Typography>
            </Box>
          </form>
        )}
      </Paper>
    </Container>
  );
};

export default LoginPage;