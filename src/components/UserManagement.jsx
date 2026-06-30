import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Divider
} from '@mui/material';
import { Edit, Delete, Email, Refresh, LockReset, Send } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import * as userDataService from '../services/userDataService';
import { useAuthContext } from '../context/useAuthContext';

// Helper to get token from authSession in localStorage
const getToken = () => {
  try {
    const session = JSON.parse(localStorage.getItem('authSession'));
    return session?.accessToken || null;
  } catch {
    return null;
  }
};

const UserManagement = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openResetDialog, setOpenResetDialog] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToReset, setUserToReset] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [createForm, setCreateForm] = useState({
    username: '',
    ntid: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Viewer'
  });
  const [newPassword, setNewPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [currentUser] = useState(userDataService.getCurrentUser());
  
  // Forgot password email config
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('admin@example.com');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

  // Load forgot password email config
  const loadForgotPasswordEmail = async () => {
    try {
      const token = getToken();
      const response = await axios.get(`${API_BASE_URL}/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success && response.data.data) {
        setForgotPasswordEmail(response.data.data.forgotPasswordEmail || 'admin@example.com');
      }
    } catch (err) {
      console.error('Failed to load forgot password email config:', err);
    }
  };

  // Save forgot password email config
  const handleSaveForgotPasswordEmail = async () => {
    setEmailSaving(true);
    try {
      const token = getToken();
      await axios.post(`${API_BASE_URL}/settings`, { forgotPasswordEmail }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Forgot password sender email saved successfully');
    } catch (err) {
      setError('Failed to save forgot password sender email');
    } finally {
      setEmailSaving(false);
    }
  };

  // Test forgot password email
  const handleTestForgotPasswordEmail = async () => {
    if (!testEmailTo) {
      setError('Please enter a target email address for testing');
      return;
    }
    setEmailTesting(true);
    try {
      const token = getToken();
      const response = await axios.post(`${API_BASE_URL}/auth/test-forgot-password-email`, 
        { toEmail: testEmailTo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setSuccess(response.data.message || 'Test email sent successfully');
      } else {
        setError(response.data.message || 'Failed to send test email');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send test email');
    } finally {
      setEmailTesting(false);
    }
  };

  // Load user list
  const loadUsers = async () => {
    setLoading(true);
    try {
        const token = getToken();
        const response = await axios.get(`${API_BASE_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setUsers(response.data.data || []);
        } else {
          setError('Failed to load user list');
        }
      } catch (err) {
        setError('Failed to load user list');
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
  };

  // 获取角色颜色
  const getRoleColor = (role) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin' || r === 'administrator') return 'var(--warning-color)';
    if (r === 'editor') return 'var(--primary-color)';
    if (r === 'viewer') return 'var(--success-color)';
    return 'var(--text-secondary)';
  };

  // Get role display text
  const getRoleText = (role) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin' || r === 'administrator') return t('userManagement.roleAdmin');
    if (r === 'editor') return t('userManagement.roleEditor');
    if (r === 'viewer') return t('userManagement.roleViewer');
    return role || t('userManagement.roleUnknown');
  };

  useEffect(() => {
    loadUsers();
    loadForgotPasswordEmail();
  }, []);

  // 处理编辑用户
  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      ntid: user.ntid,
      email: user.email,
      role: user.role
    });
    setOpenEditDialog(true);
  };

  // 处理删除用户
  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setOpenDeleteDialog(true);
  };

  // 处理重置密码
  const handleResetPassword = (user) => {
    setUserToReset(user);
    setNewPassword('');
    setSendEmail(true);
    setOpenResetDialog(true);
  };

  // 保存用户编辑
  const handleSaveEdit = async () => {
    try {
      const token = getToken();
      const response = await axios.put(`${API_BASE_URL}/users/${editingUser.id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSuccess('User information updated successfully');
        loadUsers();
        setOpenEditDialog(false);
      } else {
        setError(response.data.message || 'Update failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
      console.error('Failed to update user:', err);
    }
  };

  // 确认删除用户
  const handleConfirmDelete = async () => {
    try {
      const token = getToken();
      const response = await axios.delete(`${API_BASE_URL}/users/${userToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSuccess('User deleted successfully');
        loadUsers();
        setOpenDeleteDialog(false);
      } else {
        setError(response.data.message || 'Deletion failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Deletion failed');
      console.error('Failed to delete user:', err);
    }
  };

  // 确认重置密码
  const handleConfirmResetPassword = async () => {
    try {
      const token = getToken();
      // 发送用户指定的新密码到后端
      const requestBody = newPassword ? { newPassword } : {};
      const response = await axios.post(`${API_BASE_URL}/users/${userToReset.id}/reset-password`, requestBody, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const finalPassword = response.data.data?.tempPassword || newPassword || 'TempPassword123!';
        // 如果需要发送邮件
        if (sendEmail && userToReset.email) {
          try {
            await axios.post(`${API_BASE_URL}/auth/send-password-email`, {
              email: userToReset.email,
              username: userToReset.username,
              password: finalPassword
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            setSuccess(`Password reset successfully (email sent to ${userToReset.email})`);
          } catch {
            setSuccess(`Password reset to: ${finalPassword} (email send failed)`);
          }
        } else {
          setSuccess(`Password reset to: ${finalPassword}`);
        }
        setNewPassword('');
        loadUsers();
        setOpenResetDialog(false);
      } else {
        setError(response.data.message || 'Password reset failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed');
      console.error('Failed to reset password:', err);
    }
  };

  // 关闭提示
  const handleCloseSnackbar = () => {
    setError('');
    setSuccess('');
  };

  // 处理创建用户
  const handleCreateUser = async () => {
    try {
      // Form validation
      if (!createForm.username || !createForm.password || !createForm.email) {
        setError('Please fill in all required fields');
        return;
      }
      
      if (createForm.password !== createForm.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      if (createForm.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      const token = getToken();
      const response = await axios.post(`${API_BASE_URL}/users`, {
        username: createForm.username,
        password: createForm.password,
        email: createForm.email,
        role: createForm.role,
        ntid: createForm.ntid
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccess('User created successfully');
        loadUsers();
        setOpenCreateDialog(false);
        // 重置表单
        setCreateForm({
          username: '',
          ntid: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'Viewer'
        });
      } else {
        setError(response.data.message || 'Creation failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Creation failed');
      console.error('Failed to create user:', err);
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return t('common.never');
    return new Date(dateString).toLocaleString();
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'Administrator')) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="warning" sx={{ mb: 4 }}>
          {t('userManagement.adminOnly')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h5" component="h2" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {t('userManagement.title')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={() => setOpenCreateDialog(true)}
              sx={{
                backgroundColor: 'var(--success-color)',
                '&:hover': {
                  backgroundColor: '#388e3c'
                }
              }}
            >
              {t('userManagement.createUser')}
            </Button>
            <Button
              variant="contained"
              onClick={loadUsers}
              startIcon={<Refresh />}
              sx={{
                backgroundColor: 'var(--primary-color)',
                '&:hover': {
                  backgroundColor: 'var(--primary-hover)'
                }
              }}
            >
              {t('userManagement.refreshList')}
            </Button>
          </Box>
        </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, backgroundColor: 'var(--background-paper)', color: 'var(--error-color)' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ backgroundColor: 'var(--background-paper)' }}>
          <Table aria-label="用户管理表格">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'var(--background-alt)' }}>
                <TableCell sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('userManagement.fullName')}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('userManagement.username')}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('userManagement.email')}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('userManagement.role')}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('userManagement.createdAt')}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('userManagement.lastLogin')}</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'var(--background-secondary)' } }}>
                  <TableCell component="th" scope="row" sx={{ color: 'var(--text-primary)' }}>
                    {user.ntid}
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-primary)' }}>{user.username}</TableCell>
                  <TableCell sx={{ color: 'var(--text-primary)' }}>{user.email}</TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        backgroundColor: getRoleColor(user.role),
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: 500
                      }}
                    >
                      {getRoleText(user.role)}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)' }}>{formatDate(user.createdAt)}</TableCell>
                  <TableCell sx={{ color: 'var(--text-secondary)' }}>{formatDate(user.lastLogin)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        onClick={() => handleEditUser(user)}
                        sx={{ color: 'var(--primary-color)' }}
                        title={t('userManagement.editUser')}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        onClick={() => handleResetPassword(user)}
                        sx={{ color: 'var(--warning-color)' }}
                        title={t('userManagement.resetPassword')}
                      >
                        <LockReset />
                      </IconButton>
                      {user.id !== '1' && (
                        <IconButton
                          onClick={() => handleDeleteUser(user)}
                          sx={{ color: 'var(--error-color)' }}
                          title={t('userManagement.deleteUser')}
                        >
                          <Delete />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Forgot Password Email Configuration */}
      <Paper sx={{ mt: 3, p: 3, backgroundColor: 'var(--background-paper)' }}>
        <Typography variant="h6" sx={{ mb: 2, color: 'var(--text-primary)' }}>
          {t('userManagement.forgotPasswordSettings')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {t('userManagement.forgotPasswordDescription')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <TextField
            label={t('userManagement.senderEmail')}
            variant="outlined"
            size="small"
            value={forgotPasswordEmail}
            onChange={(e) => setForgotPasswordEmail(e.target.value)}
            sx={{ flex: 1, maxWidth: 400 }}
          />
          <Button
            variant="contained"
            onClick={handleSaveForgotPasswordEmail}
            disabled={emailSaving}
            sx={{ minWidth: 80 }}
          >
            {emailSaving ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label={t('userManagement.testRecipientEmail')}
            variant="outlined"
            size="small"
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
            placeholder={t('userManagement.testRecipientPlaceholder')}
            sx={{ flex: 1, maxWidth: 400 }}
          />
          <Button
            variant="outlined"
            startIcon={emailTesting ? <CircularProgress size={16} /> : <Send />}
            onClick={handleTestForgotPasswordEmail}
            disabled={emailTesting || !testEmailTo}
            sx={{ minWidth: 120 }}
          >
            {t('userManagement.sendTest')}
          </Button>
        </Box>
      </Paper>

      {/* 编辑用户对话框 */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>{t('userManagement.editDialogTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('userManagement.fullName')}
            fullWidth
            value={editForm.ntid}
            onChange={(e) => setEditForm(prev => ({ ...prev, ntid: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label={t('userManagement.email')}
            type="email"
            fullWidth
            value={editForm.email}
            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('userManagement.role')}</InputLabel>
            <Select
              value={editForm.role}
              label={t('userManagement.role')}
              onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
            >
              <MenuItem value="Administrator">{t('userManagement.roleAdmin')}</MenuItem>
              <MenuItem value="Editor">{t('userManagement.roleEditor')}</MenuItem>
              <MenuItem value="Viewer">{t('userManagement.roleViewer')}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveEdit} sx={{ color: 'var(--primary-color)' }}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* 删除用户确认对话框 */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>{t('userManagement.deleteDialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('userManagement.deleteConfirmation', { username: userToDelete?.username })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmDelete} sx={{ color: 'var(--error-color)' }}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={openResetDialog} onClose={() => setOpenResetDialog(false)}>
        <DialogTitle>{t('userManagement.resetDialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('userManagement.resetDescription', { username: userToReset?.username })}
          </DialogContentText>
          <TextField
            margin="dense"
            label={t('userManagement.newPassword')}
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('userManagement.newPasswordPlaceholder')}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            <Button
              onClick={() => setSendEmail(!sendEmail)}
              startIcon={<Email sx={{ color: sendEmail ? '#fff' : undefined }} />}
              variant={sendEmail ? 'contained' : 'outlined'}
              color={sendEmail ? 'success' : 'primary'}
              sx={{ textTransform: 'none' }}
            >
              {t('userManagement.sendPasswordToEmail')}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResetDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmResetPassword} sx={{ color: 'var(--primary-color)' }}>{t('userManagement.confirmReset')}</Button>
        </DialogActions>
      </Dialog>

      {/* 新建用户对话框 */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('userManagement.createDialogTitle')}</DialogTitle>
        <DialogContent>
          <TextField
             autoFocus
             margin="dense"
             label={t('userManagement.usernameRequired')}
             fullWidth
             value={createForm.username}
             onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
             sx={{ mb: 2 }}
           />
          <TextField
            margin="dense"
            label={t('userManagement.fullName')}
            fullWidth
            value={createForm.ntid}
            onChange={(e) => setCreateForm(prev => ({ ...prev, ntid: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
             margin="dense"
             label={t('userManagement.emailRequired')}
             type="email"
             fullWidth
             value={createForm.email}
             onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
             sx={{ mb: 2 }}
           />
          <TextField
             margin="dense"
             label={t('userManagement.passwordRequired')}
             type="password"
             fullWidth
             value={createForm.password}
             onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
             sx={{ mb: 2 }}
           />
          <TextField
            margin="dense"
            label={t('userManagement.confirmPassword')}
            type="password"
            fullWidth
            value={createForm.confirmPassword}
            onChange={(e) => setCreateForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('userManagement.role')}</InputLabel>
            <Select
              value={createForm.role}
              label={t('userManagement.role')}
              onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value }))}
            >
              <MenuItem value="Administrator">{t('userManagement.roleAdmin')}</MenuItem>
              <MenuItem value="Editor">{t('userManagement.roleEditor')}</MenuItem>
              <MenuItem value="Viewer">{t('userManagement.roleViewer')}</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'var(--background-secondary)', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('userManagement.roleDescriptions')}</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>• {t('userManagement.adminDesc')}</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>• {t('userManagement.editorDesc')}</Typography>
            <Typography variant="body2">• {t('userManagement.viewerDesc')}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreateUser} sx={{ color: 'var(--success-color)' }}>{t('userManagement.createButton')}</Button>
        </DialogActions>
      </Dialog>

      {/* 成功/错误提示 */}
      <Snackbar
        open={!!success || !!error}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={success ? 'success' : 'error'}
          sx={{ width: '100%', backgroundColor: 'var(--background-paper)' }}
        >
          {success || error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;
