import React, { useState, useEffect, Fragment, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Tooltip,
  LinearProgress,
  Chip,
  Divider,
  Snackbar,
  Fade,
  MenuItem
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuthContext } from '../context/useAuthContext';

const mergeSettingsWithDefaults = (defaults, incoming = {}) => ({
  ...defaults,
  ...incoming,
  email: { ...defaults.email, ...(incoming.email || {}) },
  emailContacts: { ...defaults.emailContacts, ...(incoming.emailContacts || {}) },
  papercut: { ...defaults.papercut, ...(incoming.papercut || {}) },
  license: { ...defaults.license, ...(incoming.license || {}) },
  monitoring: {
    printers: { ...defaults.monitoring.printers, ...(incoming.monitoring?.printers || {}) },
    printServers: { ...defaults.monitoring.printServers, ...(incoming.monitoring?.printServers || {}) }
  }
});

const SettingsPanel = (props) => {
  console.log('SettingsPanel props:', props);
  const { t } = useTranslation();
  const { isAuthenticated, accessToken } = useAuthContext();
  const { onUpdateSettings, currentUser } = props;
  
  // 只有 Administrator 可以修改设置
  const canEdit = currentUser && (currentUser.role === 'Administrator' || currentUser.role === 'admin');
  const [settings, setSettings] = useState({
    email: {
      smtpServer: '',
      smtpPort: '25',
      smtpUser: '',
      smtpPass: '',
      useTls: false,
      defaultFrom: 'printer-report@example.com',
      defaultTo: 'admin@example.com'
    },
    emailContacts: {
      senders: [],
      recipients: [],
      ccRecipients: []
    },
    papercut: {
      enabled: false,
      serverUrl: '',
      apiKey: '',
      host: '',
      port: '9191',
      username: '',
      password: '',
      apiToken: ''
    },
    license: {
      expirationDate: ''
    },
    monitoring: {
      printers: {
        intervalMs: 30000,
        backoffEnabled: false,
        backoffMultiplier: 1.5,
        maxIntervalMs: 120000
      },
      printServers: {
        intervalMs: 30000,
        backoffEnabled: false,
        backoffMultiplier: 1.5,
        maxIntervalMs: 120000
      }
    }
  });
  const [newLicenseDate, setNewLicenseDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');
  const [snapshotSuccess, setSnapshotSuccess] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [actionDetails, setActionDetails] = useState([]);
  const progressIntervalRef = useRef(null);
  const maxDetailsDisplay = 10;
  const MAX_SNAPSHOTS = 10;

  // System Update state
  const [updateFile, setUpdateFile] = useState(null);
  const [updateUploading, setUpdateUploading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState(''); // 'uploading', 'extracting', 'restarting', 'success', 'error'
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  const fileInputRef = useRef(null);

  // Email contact input state
  const [newSender, setNewSender] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [newCcRecipient, setNewCcRecipient] = useState('');
  const [runtimeMonitoring, setRuntimeMonitoring] = useState(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);

  // Dirty state tracking per section
  const [initialSettings, setInitialSettings] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const isLicenseDirty = initialSettings && newLicenseDate && 
    newLicenseDate.toISOString().split('T')[0] !== (initialSettings.license?.expirationDate || '');
  const isSmtpDirty = initialSettings && (
    settings.email?.smtpServer !== initialSettings.email?.smtpServer ||
    settings.email?.smtpPort !== initialSettings.email?.smtpPort ||
    settings.email?.smtpUser !== initialSettings.email?.smtpUser ||
    settings.email?.smtpPass !== initialSettings.email?.smtpPass
  );
  const isEmailContactsDirty = initialSettings && (
    JSON.stringify(settings.emailContacts) !== JSON.stringify(initialSettings.emailContacts)
  );
  const isMonitoringDirty = initialSettings && (
    JSON.stringify(settings.monitoring) !== JSON.stringify(initialSettings.monitoring)
  );

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const addEmailContact = (category, email, setInput) => {
    const trimmed = email.trim();
    if (!trimmed || !emailRegex.test(trimmed)) return;
    setSettings(prev => {
      const list = prev.emailContacts?.[category] || [];
      if (list.includes(trimmed)) return prev;
      return { ...prev, emailContacts: { ...prev.emailContacts, [category]: [...list, trimmed] } };
    });
    setInput('');
  };

  const removeEmailContact = (category, email) => {
    setSettings(prev => ({
      ...prev,
      emailContacts: {
        ...prev.emailContacts,
        [category]: (prev.emailContacts?.[category] || []).filter(e => e !== email)
      }
    }));
  };

  // Helper function to calculate snapshot size
  const calculateSnapshotSize = (snapshot) => {
    try {
      const snapshotString = JSON.stringify(snapshot);
      const sizeInBytes = new Blob([snapshotString]).size;
      
      if (sizeInBytes < 1024) {
        return `${sizeInBytes} B`;
      } else if (sizeInBytes < 1024 * 1024) {
        return `${(sizeInBytes / 1024).toFixed(2)} KB`;
      } else {
        return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch {
      return 'N/A';
    }
  };

  useEffect(() => {
    // Test if component is mounted
    console.log('SettingsPanel component mounted');
    
    // Default settings
    const defaultSettings = {
      email: {
        smtpServer: '',
        smtpPort: '25',
        smtpUser: '',
        smtpPass: '',
        useTls: false,
        defaultFrom: 'printer-report@example.com',
        defaultTo: 'admin@example.com'
      },
      papercut: {
        enabled: false,
        serverUrl: '',
        apiKey: '',
        host: '',
        port: '9191',
        username: '',
        password: '',
        apiToken: ''
      },
      license: {
        expirationDate: ''
      },
      monitoring: {
        printers: {
          intervalMs: 30000,
          backoffEnabled: false,
          backoffMultiplier: 1.5,
          maxIntervalMs: 120000
        },
        printServers: {
          intervalMs: 30000,
          backoffEnabled: false,
          backoffMultiplier: 1.5,
          maxIntervalMs: 120000
        }
      }
    };
    
    // Fetch current system settings
    const fetchSettings = async () => {
      console.log('Starting to fetch settings...');
      let hasCachedSettings = false;
      try {
        // First try to get settings from localStorage
        const localSettings = localStorage.getItem('settings');
        if (localSettings) {
          const data = mergeSettingsWithDefaults(defaultSettings, JSON.parse(localSettings));
          console.log('Loaded settings from localStorage:', data);
          setSettings(data);
          setInitialSettings(JSON.parse(JSON.stringify(data)));
          hasCachedSettings = true;
          // Set initial license date
          if (data.license?.expirationDate) {
            setNewLicenseDate(new Date(data.license.expirationDate));
          }
          console.log('Settings updated successfully from localStorage');
        }

        // Only query protected API after user is authenticated.
        if (!isAuthenticated || !accessToken) {
          console.log('Skipping /api/settings fetch because user is not authenticated yet');
          if (!hasCachedSettings) {
            setSettings(defaultSettings);
          }
          return;
        }

        console.log('Making authenticated API request to /api/settings');
        const response = await axios.get('/api/settings', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        const data = mergeSettingsWithDefaults(defaultSettings, response.data?.data || response.data || {});
        console.log('API response received:', data);

        setSettings(data);
        setInitialSettings(JSON.parse(JSON.stringify(data)));
        if (data.license?.expirationDate) {
          setNewLicenseDate(new Date(data.license.expirationDate));
        }
        localStorage.setItem('settings', JSON.stringify(data));
        console.log('Settings updated successfully from API and saved to localStorage');
      } catch (err) {
        console.error('Failed to fetch system settings:', err);
        if (!hasCachedSettings) {
          console.log('Using in-memory default settings');
          setSettings(defaultSettings);
          setError('Failed to load system settings from API');
        }
      }
    };

    // Fetch system snapshots from backend
      const fetchSnapshots = async () => {
        try {
          const response = await axios.get('/api/snapshots', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const data = response.data?.data || response.data || [];
          setSnapshots(Array.isArray(data) ? data : []);
          console.log('Loaded snapshots from backend:', data);
        } catch (err) {
          console.error('Failed to load snapshots:', err);
          // Fallback to localStorage for backward compatibility
          try {
            const savedSnapshots = localStorage.getItem('systemSnapshots');
            if (savedSnapshots) {
              setSnapshots(JSON.parse(savedSnapshots));
            }
          } catch { /* ignore */ }
        }
      };

    fetchSettings();
    fetchSnapshots();
    refreshRuntimeStatus();
  }, [isAuthenticated, accessToken]);

  const handleInputChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleMonitoringChange = (target, field, value) => {
    setSettings(prev => ({
      ...prev,
      monitoring: {
        ...prev.monitoring,
        [target]: {
          ...prev.monitoring[target],
          [field]: value
        }
      }
    }));
  };

  const refreshRuntimeStatus = async () => {
    setRuntimeLoading(true);
    try {
      const response = await axios.get('/api/health/runtime');
      setRuntimeMonitoring(response.data?.data?.monitoring || null);
    } catch (runtimeErr) {
      console.warn('Failed to fetch runtime monitoring status:', runtimeErr.message);
    } finally {
      setRuntimeLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Update all settings — use newLicenseDate if set, otherwise keep existing
      const licenseDate = newLicenseDate
        ? newLicenseDate.toISOString().split('T')[0]
        : (settings.license?.expirationDate || '');

      const updatedSettings = {
        ...settings,
        license: {
          ...settings.license,
          expirationDate: licenseDate
        }
      };

      // Save to localStorage first for offline use
      localStorage.setItem('settings', JSON.stringify(updatedSettings));
      console.log('Settings saved to localStorage');

      // Try to save to backend
      try {
        await axios.post('/api/settings', updatedSettings, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('Settings saved to backend');
        await refreshRuntimeStatus();
      } catch (apiErr) {
        console.warn('Failed to save settings to backend, but saved to localStorage:', apiErr);
      }

      // Reset dirty state
      setInitialSettings(JSON.parse(JSON.stringify(updatedSettings)));
      setSnackbar({ open: true, message: 'Settings saved successfully', severity: 'success' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSnackbar({ open: true, message: 'Save failed: ' + err.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Add action details to list
  const addActionDetail = (message) => {
    setActionDetails(prev => {
      const newDetails = [message, ...prev];
      // Keep only the most recent records
      return newDetails.slice(0, maxDetailsDisplay);
    });
  };

  // Reset progress and details state
  const resetProgressState = () => {
    setProgress(0);
    setProgressMessage('');
    setShowProgress(false);
    setActionDetails([]);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Simulate progress updates
  const simulateProgress = (totalSteps, duration = 5000) => {
    const stepTime = duration / totalSteps;
    let currentStep = 0;
    
    // Clear any existing timer
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    // Set up timer to simulate progress
    progressIntervalRef.current = setInterval(() => {
      currentStep++;
      const newProgress = Math.min(100, Math.round((currentStep / totalSteps) * 100));
      setProgress(newProgress);
      
      if (currentStep >= totalSteps) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }, stepTime);
  };

  // Handle snapshot creation
  const handleCreateSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotError('');
    setSnapshotSuccess('');
    setShowProgress(true);
    setActionDetails([]);
    setProgress(0);

    try {
      addActionDetail('Starting system snapshot creation...');
      setProgressMessage('Creating snapshot via backend API');
      setProgress(20);

      const response = await axios.post('/api/snapshots', {
        name: snapshotName.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      setProgress(80);
      addActionDetail('Snapshot data collected: settings, users, alert config, printers');

      const snapshot = response.data?.data || response.data;
      addActionDetail(`✅ Snapshot created: ${snapshot.name}`);
      addActionDetail(`Size: ${snapshot.size || 'N/A'}`);
      addActionDetail(`${snapshot.description || ''}`);

      // Refresh snapshot list
      const listResponse = await axios.get('/api/snapshots', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const listData = listResponse.data?.data || listResponse.data || [];
      setSnapshots(Array.isArray(listData) ? listData : []);
      setSnapshotName('');

      setProgress(100);
      setProgressMessage('Backup complete');
      addActionDetail('Snapshot created successfully!');
      setSnapshotSuccess('System snapshot created successfully!');

      setTimeout(() => resetProgressState(), 3000);
    const fetchRuntimeStatus = async () => {
      setRuntimeLoading(true);
      try {
        const response = await axios.get('/api/health/runtime');
        const runtime = response.data?.data?.monitoring || null;
        setRuntimeMonitoring(runtime);
      } catch (runtimeErr) {
        console.warn('Failed to fetch runtime monitoring status:', runtimeErr.message);
      } finally {
        setRuntimeLoading(false);
      }
    };
      setTimeout(() => setSnapshotSuccess(''), 5000);
    } catch (err) {
    fetchRuntimeStatus();
      console.error('Failed to create snapshot:', err);
      setSnapshotError('Failed to create snapshot: ' + (err.response?.data?.message || err.message));
      addActionDetail(`Error: ${err.message}`);
      resetProgressState();
    } finally {
      setSnapshotLoading(false);
    }
  };

  // Handle snapshot restoration
  const handleRestoreSnapshot = async (snapshot) => {
    if (!window.confirm(t('settingsPanel.restoreConfirm'))) {
      return;
    }

    setSnapshotLoading(true);
    setSnapshotError('');
    setSnapshotSuccess('');
    setShowProgress(true);
    setActionDetails([]);
    setProgress(0);

    try {
      addActionDetail(`Restoring snapshot: ${snapshot.name}`);
      setProgressMessage('Restoring snapshot via backend API');
      setProgress(30);

      const response = await axios.post(`/api/snapshots/${snapshot.id}/restore`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      setProgress(70);
      const state = response.data?.data || response.data;

      if (state.settings) {
        setSettings(state.settings);
        localStorage.setItem('settings', JSON.stringify(state.settings));
        addActionDetail('✅ System settings restored');
      }
      if (state.users) {
        addActionDetail(`✅ Restored ${state.users.length} users`);
      }
      if (state.alertConfig) {
        addActionDetail('✅ Alert configuration restored');
      }
      if (state.printers) {
        addActionDetail(`✅ Restored ${state.printers.length} printer configurations`);
      }
      if (state.printServers) {
        addActionDetail(`✅ Restored print server configurations`);
      }

      setProgress(100);
      setProgressMessage('Restoration complete');
      addActionDetail('System snapshot restored successfully!');
      setSnapshotSuccess('System snapshot restored successfully! Please refresh the page to apply all changes.');

      setTimeout(() => resetProgressState(), 3000);
      setTimeout(() => setSnapshotSuccess(''), 8000);
    } catch (err) {
      console.error('Failed to restore snapshot:', err);
      setSnapshotError('Failed to restore snapshot: ' + (err.response?.data?.message || err.message));
      addActionDetail(`Error: ${err.message}`);
      resetProgressState();
    } finally {
      setSnapshotLoading(false);
    }
  };

  // Handle snapshot deletion
  const handleDeleteSnapshot = async (snapshotId) => {
    if (!window.confirm(t('settingsPanel.deleteConfirm'))) {
      return;
    }

    setSnapshotLoading(true);
    setSnapshotError('');
    setSnapshotSuccess('');

    try {
      await axios.delete(`/api/snapshots/${snapshotId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Refresh list
      const response = await axios.get('/api/snapshots', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = response.data?.data || response.data || [];
      setSnapshots(Array.isArray(data) ? data : []);
      setSnapshotSuccess('Snapshot deleted successfully!');
      setTimeout(() => setSnapshotSuccess(''), 2000);
    } catch (err) {
      console.error('Failed to delete snapshot:', err);
      setSnapshotError('Failed to delete snapshot: ' + (err.response?.data?.message || err.message));
    } finally {
      setSnapshotLoading(false);
    }
  };

  // Handle snapshot export/download
  const handleExportSnapshot = async (snapshotId, snapshotName) => {
    try {
      const response = await axios.get(`/api/snapshots/${snapshotId}/export`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `snapshot-${snapshotName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export snapshot:', err);
      setSnapshotError('Failed to export snapshot');
    }
  };

  const fetchUpdateInfo = async () => {
    try {
      const response = await axios.get('/api/update/info', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setUpdateInfo(response.data?.data || response.data);
    } catch (err) {
      console.warn('Failed to fetch update info:', err.message);
    }
  };

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchUpdateInfo();
    }
  }, [isAuthenticated, accessToken]);

  const handleUpdateFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setUpdateStatus('error');
        setUpdateMessage('Please select a .zip file');
        return;
      }
      setUpdateFile(file);
      setUpdateStatus('');
      setUpdateMessage('');
    }
  };

  const handleUploadUpdate = async () => {
    if (!updateFile) return;

    setUpdateUploading(true);
    setUpdateProgress(0);
    setUpdateStatus('uploading');
    setUpdateMessage('Uploading update package...');

    try {
      const formData = new FormData();
      formData.append('package', updateFile);

      const response = await axios.post('/api/update/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${accessToken}`
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUpdateProgress(percent);
          if (percent >= 100) {
            setUpdateStatus('extracting');
            setUpdateMessage('Extracting and installing update...');
          }
        }
      });

      const result = response.data?.data || response.data;
      setUpdateStatus('success');
      setUpdateMessage(`Update installed successfully! ${result.restartRequired ? 'Click "Restart Service" to apply changes.' : 'Changes applied.'}`);
      setUpdateFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchUpdateInfo();
    } catch (error) {
      setUpdateStatus('error');
      setUpdateMessage(`Update failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setUpdateUploading(false);
      setUpdateProgress(0);
    }
  };

  const handleRestartService = async () => {
    setUpdateStatus('restarting');
    setUpdateMessage('Restarting service... Page will reload in 10 seconds.');

    try {
      await axios.post('/api/update/restart', {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // 等待服务重启后自动刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (error) {
      // 连接断开是正常的（因为服务在重启）
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        setTimeout(() => {
          window.location.reload();
        }, 8000);
      } else {
        setUpdateStatus('error');
        setUpdateMessage(`Restart failed: ${error.message}`);
      }
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'var(--background-paper)' }}>

        {/* License Settings */}
        <Accordion sx={{ mb: 2, bgcolor: 'var(--background-paper)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{t('settingsPanel.licenseSettings')}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ bgcolor: 'var(--background-paper)' }}>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label={t('settingsPanel.selectExpirationDate')}
                    value={newLicenseDate}
                    onChange={(date) => setNewLicenseDate(date)}
                    renderInput={(params) => <TextField {...params} fullWidth required />}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Fade in={!!isLicenseDirty}>
                  <Button
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={loading || !canEdit}
                    size="small"
                  >
                    {loading ? t('common.saving') : t('common.save')}
                  </Button>
                </Fade>
              </Grid>

            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* SMTP Settings */}
        <Accordion sx={{ mb: 2, bgcolor: 'var(--background-paper)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{t('settingsPanel.smtpEmailSettings')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label={t('settingsPanel.smtpServer')}
                  value={settings.email.smtpServer}
                  onChange={(e) => handleInputChange('email', 'smtpServer', e.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label={t('settingsPanel.smtpPort')}
                  type="number"
                  value={settings.email.smtpPort}
                  onChange={(e) => handleInputChange('email', 'smtpPort', e.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label={t('settingsPanel.smtpUsername')}
                  value={settings.email.smtpUser}
                  onChange={(e) => handleInputChange('email', 'smtpUser', e.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label={t('settingsPanel.smtpPassword')}
                  type="password"
                  value={settings.email.smtpPass}
                  onChange={(e) => handleInputChange('email', 'smtpPass', e.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Fade in={!!isSmtpDirty}>
                  <Button
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={loading || !canEdit}
                    size="small"
                  >
                    {loading ? t('common.saving') : t('common.save')}
                  </Button>
                </Fade>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Email Address Book - Separate Accordion */}
        <Accordion sx={{ mb: 2, bgcolor: 'var(--background-paper)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{t('settingsPanel.emailAddressBook')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settingsPanel.emailAddressBookDescription')}
            </Typography>

                {/* Senders */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>{t('settingsPanel.senderAddresses')}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      size="small"
                      placeholder={t('settingsPanel.addSenderPlaceholder')}
                      value={newSender}
                      onChange={(e) => setNewSender(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmailContact('senders', newSender, setNewSender); } }}
                      sx={{ flex: 1 }}
                    />
                    <IconButton
                      color="primary"
                      onClick={() => addEmailContact('senders', newSender, setNewSender)}
                      disabled={!newSender.trim()}
                    >
                      <AddCircleOutlineIcon />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(settings.emailContacts?.senders || []).map((email) => (
                      <Chip key={email} label={email} onDelete={() => removeEmailContact('senders', email)} size="small" />
                    ))}
                  </Box>
                </Box>

                {/* Recipients */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>{t('settingsPanel.recipientAddresses')}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      size="small"
                      placeholder={t('settingsPanel.addRecipientPlaceholder')}
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmailContact('recipients', newRecipient, setNewRecipient); } }}
                      sx={{ flex: 1 }}
                    />
                    <IconButton
                      color="primary"
                      onClick={() => addEmailContact('recipients', newRecipient, setNewRecipient)}
                      disabled={!newRecipient.trim()}
                    >
                      <AddCircleOutlineIcon />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(settings.emailContacts?.recipients || []).map((email) => (
                      <Chip key={email} label={email} onDelete={() => removeEmailContact('recipients', email)} size="small" />
                    ))}
                  </Box>
                </Box>

                {/* CC Recipients */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>{t('settingsPanel.ccAddresses')}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      size="small"
                      placeholder={t('settingsPanel.addCcPlaceholder')}
                      value={newCcRecipient}
                      onChange={(e) => setNewCcRecipient(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmailContact('ccRecipients', newCcRecipient, setNewCcRecipient); } }}
                      sx={{ flex: 1 }}
                    />
                    <IconButton
                      color="primary"
                      onClick={() => addEmailContact('ccRecipients', newCcRecipient, setNewCcRecipient)}
                      disabled={!newCcRecipient.trim()}
                    >
                      <AddCircleOutlineIcon />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(settings.emailContacts?.ccRecipients || []).map((email) => (
                      <Chip key={email} label={email} onDelete={() => removeEmailContact('ccRecipients', email)} size="small" />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Fade in={!!isEmailContactsDirty}>
                    <Button
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={loading || !canEdit}
                      size="small"
                    >
                      {loading ? t('common.saving') : t('common.save')}
                    </Button>
                  </Fade>
                </Box>
          </AccordionDetails>
        </Accordion>

        {/* Monitoring Tuning */}
        <Accordion sx={{ mb: 2, bgcolor: 'var(--background-paper)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{t('settingsPanel.monitoringTuning')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settingsPanel.monitoringTuningDesc')}
            </Typography>

            {/* Printer Monitoring */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('settingsPanel.printerMonitoring')}</Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={t('settingsPanel.intervalMs')}
                  type="number"
                  value={settings.monitoring?.printers?.intervalMs || 30000}
                  onChange={(e) => handleMonitoringChange('printers', 'intervalMs', Number(e.target.value) || 30000)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={t('settingsPanel.backoff')}
                  select
                  value={settings.monitoring?.printers?.backoffEnabled ? 'on' : 'off'}
                  onChange={(e) => handleMonitoringChange('printers', 'backoffEnabled', e.target.value === 'on')}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="off">{t('settingsPanel.backoffOff')}</MenuItem>
                  <MenuItem value="on">{t('settingsPanel.backoffOn')}</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={t('settingsPanel.backoffMultiplier')}
                  type="number"
                  inputProps={{ step: 0.1, min: 1.1 }}
                  value={settings.monitoring?.printers?.backoffMultiplier || 1.5}
                  onChange={(e) => handleMonitoringChange('printers', 'backoffMultiplier', Number(e.target.value) || 1.5)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={t('settingsPanel.maxIntervalMs')}
                  type="number"
                  value={settings.monitoring?.printers?.maxIntervalMs || 120000}
                  onChange={(e) => handleMonitoringChange('printers', 'maxIntervalMs', Number(e.target.value) || 120000)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Print Server Monitoring */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('settingsPanel.printServerMonitoring')}</Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={t('settingsPanel.intervalMs')}
                  type="number"
                  value={settings.monitoring?.printServers?.intervalMs || 30000}
                  onChange={(e) => handleMonitoringChange('printServers', 'intervalMs', Number(e.target.value) || 30000)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={t('settingsPanel.backoff')}
                  select
                  value={settings.monitoring?.printServers?.backoffEnabled ? 'on' : 'off'}
                  onChange={(e) => handleMonitoringChange('printServers', 'backoffEnabled', e.target.value === 'on')}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="off">{t('settingsPanel.backoffOff')}</MenuItem>
                  <MenuItem value="on">{t('settingsPanel.backoffOn')}</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={t('settingsPanel.backoffMultiplier')}
                  type="number"
                  inputProps={{ step: 0.1, min: 1.1 }}
                  value={settings.monitoring?.printServers?.backoffMultiplier || 1.5}
                  onChange={(e) => handleMonitoringChange('printServers', 'backoffMultiplier', Number(e.target.value) || 1.5)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  label={t('settingsPanel.maxIntervalMs')}
                  type="number"
                  value={settings.monitoring?.printServers?.maxIntervalMs || 120000}
                  onChange={(e) => handleMonitoringChange('printServers', 'maxIntervalMs', Number(e.target.value) || 120000)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Runtime Status */}
            <Grid container spacing={2}>
              <Grid size={12}>
                <Box sx={{ p: 1.5, border: '1px solid var(--divider-color)', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{t('settingsPanel.currentRuntimeStatus')}</Typography>
                    <Button size="small" onClick={refreshRuntimeStatus} disabled={runtimeLoading}>{t('settingsPanel.refresh')}</Button>
                  </Box>
                  {runtimeLoading && <Typography variant="caption" color="text.secondary">{t('settingsPanel.loadingRuntimeStatus')}</Typography>}
                  {!runtimeLoading && runtimeMonitoring && (
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" display="block">{t('settingsPanel.printersStatus', { interval: runtimeMonitoring.printers?.intervalMs || '-' })}</Typography>
                        <Typography variant="caption" display="block">{t('settingsPanel.nextCheck', { time: runtimeMonitoring.printers?.nextCheckAt || '-' })}</Typography>
                        <Chip size="small" label={runtimeMonitoring.printers?.backoffEnabled ? t('settingsPanel.backoffOnLabel') : t('settingsPanel.backoffOffLabel')} sx={{ mt: 0.5 }} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" display="block">{t('settingsPanel.printServersStatus', { interval: runtimeMonitoring.printServers?.intervalMs || '-' })}</Typography>
                        <Typography variant="caption" display="block">{t('settingsPanel.nextCheck', { time: runtimeMonitoring.printServers?.nextCheckAt || '-' })}</Typography>
                        <Chip size="small" label={runtimeMonitoring.printServers?.backoffEnabled ? t('settingsPanel.backoffOnLabel') : t('settingsPanel.backoffOffLabel')} sx={{ mt: 0.5 }} />
                      </Grid>
                    </Grid>
                  )}
                </Box>
              </Grid>

              <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Fade in={!!isMonitoringDirty}>
                  <Button
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={loading || !canEdit}
                    size="small"
                  >
                    {loading ? t('common.saving') : t('common.save')}
                  </Button>
                </Fade>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>



        {/* System Snapshot Section */}
        <Accordion sx={{ mb: 2, bgcolor: 'var(--background-paper)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{t('settingsPanel.systemSnapshotManagement')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {snapshotError && (
              <Alert severity="error" sx={{ mb: 2, bgcolor: 'var(--background-paper)', color: 'var(--error-color)' }}>
                {snapshotError}
              </Alert>
            )}
            {snapshotSuccess && (
              <Alert severity="success" sx={{ mb: 2, bgcolor: 'var(--background-paper)', color: 'var(--success-color)' }}>
                {snapshotSuccess}
              </Alert>
            )}
            
            {/* Progress Bar and Action Details */}
            {showProgress && (
              <Box sx={{ mb: 3, p: 2, border: '1px solid var(--divider-color)', borderRadius: 1, bgcolor: 'var(--background-alt)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" fontWeight="medium">{progressMessage}</Typography>
                  <Typography variant="body2">{progress}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={progress} 
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'var(--divider-color)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      bgcolor: 'var(--primary-color)'
                    },
                    mb: 2
                  }}
                />
                
                {/* Action Details List */}
                <Box sx={{ maxHeight: 120, overflowY: 'auto', fontSize: '0.75rem' }}>
                  {actionDetails.map((detail, index) => (
                    <Typography 
                      key={index} 
                      variant="caption" 
                      sx={{ 
                        display: 'block', 
                        mb: 0.5,
                        color: detail.startsWith('Error') ? 'var(--error-color)' : 
                              detail.startsWith('✅') ? 'var(--success-color)' : 
                              detail.startsWith('⚠️') ? 'var(--warning-color)' : 'var(--text-secondary)'
                      }}
                    >
                      {detail}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Create Snapshot */}
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    label={t('settingsPanel.snapshotName')}
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    placeholder={t('settingsPanel.snapshotNamePlaceholder')}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Button
                    variant="contained"
                    startIcon={<CreateNewFolderIcon />}
                    fullWidth
                    onClick={handleCreateSnapshot}
                    disabled={snapshotLoading || showProgress}
                    sx={{ backgroundColor: 'var(--primary-color)', '&:hover': { backgroundColor: 'var(--primary-hover)' } }}
                  >
                    {snapshotLoading ? (
                      <><CircularProgress size={20} color="inherit" /> {t('settingsPanel.creating')}</>
                    ) : (
                      t('settingsPanel.createSnapshot')
                    )}
                  </Button>
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('settingsPanel.maxSnapshotsHint', { max: MAX_SNAPSHOTS })}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('settingsPanel.snapshotsInclude')}
              </Typography>
            </Box>

            {/* Snapshot List */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('settingsPanel.existingSnapshots', { count: snapshots.length, max: MAX_SNAPSHOTS })}</Typography>
              {snapshots.length === 0 ? (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>{t('settingsPanel.noSnapshots')}</Typography>
              ) : (
                <List dense sx={{ maxHeight: 400, overflow: 'auto', bgcolor: 'var(--background-paper)' }}>
                  {snapshots.map((snapshot, index) => (
                    <ListItem
                      key={snapshot.id}
                      sx={{
                        borderBottom: '1px solid var(--border-color)',
                        '&:last-child': { borderBottom: 'none' },
                        transition: 'background-color 0.2s',
                        '&:hover': { backgroundColor: 'var(--background-alt)' }
                      }}
                    >
                      <ListItemText
                        primary={snapshot.name || `Snapshot #${snapshots.length - index}`}
                        secondary={
                          <>
                            <span style={{ display: 'block', marginBottom: '0.125rem', fontWeight: 500 }}>{new Date(snapshot.createdAt).toLocaleString({
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span>Size: {snapshot.size || calculateSnapshotSize(snapshot)}</span>
                              {snapshot.description && <span>{snapshot.description}</span>}
                              {snapshot.totalItems && <span>Items: {snapshot.totalItems}</span>}
                            </span>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title={t('settingsPanel.exportSnapshot')}>
                          <IconButton
                            edge="end"
                            aria-label="export"
                            onClick={() => handleExportSnapshot(snapshot.id, snapshot.name)}
                            disabled={snapshotLoading || showProgress}
                            sx={{ 
                              color: 'var(--text-secondary)', 
                              mr: 1,
                              transition: 'transform 0.2s',
                              '&:hover': { transform: 'scale(1.1)' }
                            }}
                          >
                            <FileDownloadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('settingsPanel.restoreSnapshot')}>
                          <IconButton
                            edge="end"
                            aria-label="restore"
                            onClick={() => handleRestoreSnapshot(snapshot)}
                            disabled={snapshotLoading || showProgress}
                            sx={{ 
                              color: 'var(--primary-color)', 
                              mr: 1,
                              transition: 'transform 0.2s',
                              '&:hover': { transform: 'scale(1.1)' }
                            }}
                          >
                            <RestoreIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('settingsPanel.deleteSnapshot')}>
                          <IconButton
                            edge="end"
                            aria-label="delete"
                            onClick={() => handleDeleteSnapshot(snapshot.id)}
                            disabled={snapshotLoading || showProgress}
                            sx={{ 
                              color: 'var(--error-color)',
                              transition: 'transform 0.2s',
                              '&:hover': { transform: 'scale(1.1)' }
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* System Update Section */}
        <Accordion sx={{ mb: 2, bgcolor: 'var(--background-paper)' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SystemUpdateAltIcon fontSize="small" />
              {t('settingsPanel.systemUpdate')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Update Info */}
            {updateInfo && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'var(--background-alt)', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">{t('settingsPanel.version')}</Typography>
                    <Typography variant="body2" fontWeight="medium">{updateInfo.version}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">{t('settingsPanel.platform')}</Typography>
                    <Typography variant="body2">{updateInfo.platform === 'win32' ? 'Windows' : updateInfo.platform}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">{t('settingsPanel.nodeJs')}</Typography>
                    <Typography variant="body2">{updateInfo.nodeVersion}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">{t('settingsPanel.lastUpdated')}</Typography>
                    <Typography variant="body2">
                      {updateInfo.lastUpdate ? new Date(updateInfo.lastUpdate).toLocaleString() : t('common.never')}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Upload Area */}
            <Box sx={{ 
              border: '2px dashed', 
              borderColor: updateFile ? 'var(--primary-color)' : 'var(--divider-color)',
              borderRadius: 2, 
              p: 3, 
              textAlign: 'center',
              mb: 2,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': { borderColor: 'var(--primary-color)', bgcolor: 'rgba(25, 118, 210, 0.04)' }
            }}
              onClick={() => !updateUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={handleUpdateFileSelect}
              />
              <CloudUploadIcon sx={{ fontSize: 48, color: 'var(--text-secondary)', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                {updateFile ? updateFile.name : t('settingsPanel.selectUpdatePackage')}
              </Typography>
              {updateFile && (
                <Typography variant="caption" color="text.secondary">
                  {(updateFile.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              )}
            </Box>

            {/* Progress */}
            {updateUploading && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress 
                  variant={updateStatus === 'extracting' ? 'indeterminate' : 'determinate'} 
                  value={updateProgress} 
                  sx={{ height: 8, borderRadius: 4, mb: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {updateStatus === 'uploading' ? `${t('settingsPanel.uploading')} ${updateProgress}%` : t('settingsPanel.installingUpdate')}
                </Typography>
              </Box>
            )}

            {/* Status Messages */}
            {updateStatus === 'success' && (
              <Alert severity="success" sx={{ mb: 2 }}>{updateMessage}</Alert>
            )}
            {updateStatus === 'error' && (
              <Alert severity="error" sx={{ mb: 2 }}>{updateMessage}</Alert>
            )}
            {updateStatus === 'restarting' && (
              <Alert severity="info" sx={{ mb: 2 }}>{updateMessage}</Alert>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<CloudUploadIcon />}
                onClick={handleUploadUpdate}
                disabled={!updateFile || updateUploading || updateStatus === 'restarting'}
                sx={{ 
                  backgroundColor: 'var(--primary-color)', 
                  '&:hover': { backgroundColor: 'var(--primary-hover)' }
                }}
              >
                {updateUploading ? t('settingsPanel.installing') : t('settingsPanel.uploadInstall')}
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<RestartAltIcon />}
                onClick={handleRestartService}
                disabled={updateUploading || updateStatus === 'restarting'}
              >
                {t('settingsPanel.restartService')}
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              {t('settingsPanel.updateHint')}
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Snackbar for save feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SettingsPanel;