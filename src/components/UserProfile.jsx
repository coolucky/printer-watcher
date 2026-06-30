import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
  IconButton,
  Avatar,
  Divider,
  CircularProgress
} from '@mui/material';
import { AccountCircle, Edit, Lock, Check, Cancel, Mail, Person, Refresh } from '@mui/icons-material';
import * as userDataService from '../services/userDataService';

const UserProfile = ({ user, onUserUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartEdit = () => {
    setEditForm({
      email: user.email
    });
    setIsEditing(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      const result = await userDataService.updateUser(user.id, editForm);
      if (result.success) {
        setSuccess('Profile updated successfully');
        onUserUpdate(result.user);
        setIsEditing(false);
      } else {
        setError(result.message || 'Update failed');
      }
    } catch (err) {
      setError('Update failed');
      console.error('Failed to update profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

  const handleChangePassword = async () => {
    // Form validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      // Validate current password first
      const loginResult = await userDataService.login(user.username, passwordForm.currentPassword);
      if (!loginResult.success) {
        setError('Current password is incorrect');
        return;
      }

      // Update password
      const resetResult = await userDataService.resetPassword(user.id, passwordForm.newPassword);
      if (resetResult.success) {
        setSuccess('Password changed successfully');
        setOpenPasswordDialog(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setError(resetResult.message || 'Failed to change password');
      }
    } catch (err) {
      setError('Failed to change password');
      console.error('Failed to change password:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  const handleClosePasswordDialog = () => {
    setOpenPasswordDialog(false);
    setError('');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  // 生成用户头像（使用用户名首字母）
  const getInitials = (username) => {
    return username ? username.charAt(0).toUpperCase() : 'U';
  };

  // 生成随机背景色
  const getRandomColor = (username) => {
    const colors = [
      '#1976d2', '#2196f3', '#03a9f4', '#00bcd4', '#009688',
      '#4caf50', '#8bc34a', '#cddc39', '#ffc107', '#ff9800',
      '#ff5722', '#795548', '#607d8b', '#9c27b0', '#673ab7'
    ];
    const index = username ? username.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  if (!user) return null;

  return (
    <Paper sx={{ p: 4, backgroundColor: 'var(--background-paper)', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, mb: 4 }}>
        <Avatar
          sx={{
            width: 80,
            height: 80,
            fontSize: '2.5rem',
            backgroundColor: getRandomColor(user.username),
            color: 'white',
            fontWeight: 600
          }}
        >
          {getInitials(user.username)}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" component="h2" sx={{ color: 'var(--text-primary)', fontWeight: 600, mb: 1 }}>
            {user.username}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Mail fontSize="small" sx={{ color: 'var(--text-secondary)' }} />
            <Typography variant="body1" sx={{ color: 'var(--text-secondary)' }}>{user.email}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Person fontSize="small" sx={{ color: 'var(--text-secondary)' }} />
            <Typography variant="body1" sx={{ color: 'var(--text-secondary)' }}>Full Name: {user.ntid}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setOpenPasswordDialog(true)}
            startIcon={<Lock />}
            sx={{
              borderColor: 'var(--primary-color)',
              color: 'var(--primary-color)',
              '&:hover': {
                borderColor: 'var(--primary-hover)',
                backgroundColor: 'rgba(25, 118, 210, 0.04)'
              }
            }}
          >
            Change Password
          </Button>
          <Button
            variant="contained"
            onClick={handleStartEdit}
            startIcon={<Edit />}
            sx={{
              backgroundColor: 'var(--primary-color)',
              '&:hover': {
                backgroundColor: 'var(--primary-hover)'
              }
            }}
          >
            Edit Profile
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 4 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--text-primary)', mb: 1 }}>
            Username
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--text-secondary)', backgroundColor: 'var(--background-secondary)', p: 1.5, borderRadius: 1 }}>
            {user.username}
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--text-primary)', mb: 1 }}>
            Full Name
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--text-secondary)', backgroundColor: 'var(--background-secondary)', p: 1.5, borderRadius: 1 }}>
            {user.ntid}
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--text-primary)', mb: 1 }}>
            Email
          </Typography>
          {isEditing ? (
            <TextField
              fullWidth
              name="email"
              value={editForm.email}
              onChange={handleEditChange}
              type="email"
              sx={{ backgroundColor: 'var(--background-secondary)' }}
            />
          ) : (
            <Typography variant="body1" sx={{ color: 'var(--text-secondary)', backgroundColor: 'var(--background-secondary)', p: 1.5, borderRadius: 1 }}>
              {user.email}
            </Typography>
          )}
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--text-primary)', mb: 1 }}>
            Role
          </Typography>
          <Box
            sx={{
              display: 'inline-block',
              px: 2,
              py: 1,
              borderRadius: 1,
              backgroundColor: user.role === 'admin' ? 'var(--warning-color)' : 'var(--success-color)',
              color: 'white',
              fontWeight: 500
            }}
          >
            {user.role === 'admin' ? 'Admin' : 'User'}
          </Box>
        </Box>
      </Box>

      {isEditing && (
        <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button onClick={handleClose} variant="outlined" startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            startIcon={<Check />}
            disabled={loading}
            sx={{
              backgroundColor: 'var(--primary-color)',
              '&:hover': {
                backgroundColor: 'var(--primary-hover)'
              }
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </Box>
      )}

      {/* Password change dialog */}
      <Dialog open={openPasswordDialog} onClose={handleClosePasswordDialog}>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Current Password"
            type="password"
            name="currentPassword"
            value={passwordForm.currentPassword}
            onChange={handlePasswordChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="New Password"
            type="password"
            name="newPassword"
            value={passwordForm.newPassword}
            onChange={handlePasswordChange}
            fullWidth
            placeholder="At least 6 characters"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Confirm New Password"
            type="password"
            name="confirmPassword"
            value={passwordForm.confirmPassword}
            onChange={handlePasswordChange}
            fullWidth
            sx={{ mb: 2 }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2, backgroundColor: 'var(--background-paper)', color: 'var(--error-color)' }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePasswordDialog}>Cancel</Button>
          <Button
            onClick={handleChangePassword}
            disabled={loading}
            sx={{ color: 'var(--primary-color)' }}
          >
            {loading ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Processing...
              </>
            ) : (
              'Confirm Change'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default UserProfile;