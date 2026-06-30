import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Switch, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, CircularProgress, Tooltip
} from '@mui/material';
import { Add, Edit, Delete, Dns } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/useAuthContext';
import ENV_CONFIG from '../config/env';

const PrintServerConfig = () => {
  const { t } = useTranslation();
  const { accessToken } = useAuthContext();
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [formData, setFormData] = useState({ name: '', ip: '', enabled: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchServers = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`${ENV_CONFIG.API_BASE_URL}/print-servers`, { headers });
      if (response.ok) {
        const data = await response.json();
        setServers(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch print servers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [accessToken, fetchServers]);

  const handleOpenDialog = (server = null) => {
    if (server) {
      setEditingServer(server);
      setFormData({ name: server.name, ip: server.ip, enabled: server.enabled });
    } else {
      setEditingServer(null);
      setFormData({ name: '', ip: '', enabled: true });
    }
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.ip.trim()) {
      setError('Name and IP address are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingServer
        ? `${ENV_CONFIG.API_BASE_URL}/print-servers/${editingServer.id}`
        : `${ENV_CONFIG.API_BASE_URL}/print-servers`;
      const method = editingServer ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (response.ok) {
        setDialogOpen(false);
        fetchServers();
      } else {
        setError(data.message || 'Failed to save');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (server) => {
    if (!window.confirm(`Delete print server "${server.name}"?`)) return;
    try {
      await fetch(`${ENV_CONFIG.API_BASE_URL}/print-servers/${server.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      fetchServers();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleToggleEnabled = async (server) => {
    try {
      await fetch(`${ENV_CONFIG.API_BASE_URL}/print-servers/${server.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ enabled: !server.enabled })
      });
      fetchServers();
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Dns fontSize="small" />
          {t('printerManagement.printServerManagement')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="small"
          onClick={() => handleOpenDialog()}
          sx={{ backgroundColor: 'var(--primary-color)', '&:hover': { backgroundColor: 'var(--primary-hover, #5a61e6)' } }}
        >
          {t('printerManagement.addServer')}
        </Button>
      </Box>

      {servers.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {t('printerManagement.noServersClickAdd')}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>{t('printerManagement.serverName')}</strong></TableCell>
                <TableCell><strong>{t('printerManagement.serverIp')}</strong></TableCell>
                <TableCell><strong>{t('common.status')}</strong></TableCell>
                <TableCell><strong>{t('printerManagement.maintenance')}</strong></TableCell>
                <TableCell align="right"><strong>{t('common.actions')}</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {servers.map((server) => (
                <TableRow key={server.id}>
                  <TableCell>{server.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{server.ip}</TableCell>
                  <TableCell>
                    <Box sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1, py: 0.25,
                      borderRadius: 1,
                      bgcolor: server.online ? '#e8f5e9' : '#ffebee',
                      color: server.online ? '#2e7d32' : '#c62828',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: server.online ? '#4caf50' : '#f44336'
                      }} />
                      {server.online ? t('printerManagement.online') : t('printerManagement.offline')}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t('printerManagement.maintenanceTooltipServer')} arrow>
                      <Switch
                        size="small"
                        checked={!server.enabled}
                        onChange={() => handleToggleEnabled(server)}
                        color="warning"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(server)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(server)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingServer ? t('printerManagement.editPrintServer') : t('printerManagement.addPrintServer')}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            fullWidth
            label={t('printerManagement.serverName')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            placeholder="e.g. Beijing Print Server"
          />
          <TextField
            fullWidth
            label={t('printerManagement.serverIp')}
            value={formData.ip}
            onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
            margin="normal"
            placeholder="e.g. 10.128.20.1"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('printerManagement.cancel')}</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={20} /> : t('printerManagement.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrintServerConfig;
