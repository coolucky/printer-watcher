import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Switch, FormControlLabel,
  Alert, Divider, CircularProgress, Chip, Stack, IconButton, Tooltip,
  Autocomplete
} from '@mui/material';
import {
  NotificationsActive, NotificationsOff, Send, Email,
  PowerOff, PowerSettingsNew, FormatColorFill, CheckCircle, Error as ErrorIcon,
  DnsOutlined, Save as SaveIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/useAuthContext';

const AlertSettings = ({ currentUser }) => {
  const { t } = useTranslation();
  const { accessToken } = useAuthContext();
  
  // 只有 Administrator 和 Editor 可以配置警报
  const canEdit = currentUser && (currentUser.role === 'Administrator' || currentUser.role === 'Editor' || currentUser.role === 'admin' || currentUser.role === 'editor');

  const [config, setConfig] = useState({
    offlineAlertEnabled: false,
    tonerAlertEnabled: false,
    printerErrorAlertEnabled: false,
    fromEmail: '',
    toEmails: '',
    tonerThreshold: 5
  });
  const [emailContacts, setEmailContacts] = useState({ senders: [], recipients: [], ccRecipients: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }
  const [testResults, setTestResults] = useState({
    offline: null, // 'loading' | 'success' | 'error'
    recovery: null,
    toner: null
  });


  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);

      // Helper to apply contacts
      const applyContacts = (contacts) => {
        if (!contacts) return;
        setEmailContacts({
          senders: contacts.senders || [],
          recipients: contacts.recipients || [],
          ccRecipients: contacts.ccRecipients || []
        });
        setConfig(prev => ({
          ...prev,
          fromEmail: prev.fromEmail || (contacts.senders && contacts.senders[0]) || '',
          toEmails: prev.toEmails || (contacts.recipients && contacts.recipients.join(', ')) || ''
        }));
      };

      // Load from localStorage first (always available)
      try {
        const localSettings = JSON.parse(localStorage.getItem('settings') || '{}');
        if (localSettings.emailContacts) {
          applyContacts(localSettings.emailContacts);
        }
      } catch (e) { /* ignore */ }

      // Then try API for latest data
      const [alertRes, settingsRes] = await Promise.all([
        fetch('/api/alerts', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/settings', { headers: { Authorization: `Bearer ${accessToken}` } })
      ]);
      const alertData = await alertRes.json();
      if (alertData.success && alertData.data) {
        const data = { ...alertData.data };
        // Backward compatibility: migrate old 'enabled' field to new individual flags
        if ('enabled' in data && !('offlineAlertEnabled' in data)) {
          data.offlineAlertEnabled = data.enabled;
          data.tonerAlertEnabled = data.enabled;
        }
        delete data.enabled;
        setConfig(prev => ({ ...prev, ...data }));
      }
      const settingsData = await settingsRes.json();
      const contacts = settingsData?.data?.emailContacts || settingsData?.emailContacts;
      if (contacts) {
        applyContacts(contacts);
      }
    } catch (err) {
      console.error('Failed to load alert config:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) fetchConfig();
  }, [accessToken, fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: t('alertSettings.savedSuccess') });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type) => {
    setTestResults(prev => ({ ...prev, [type]: 'loading' }));
    try {
      const res = await fetch(`/api/alerts/test/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [type]: data.success ? 'success' : 'error' }));
      if (data.success) {
        setMessage({ type: 'success', text: `Test ${type} alert sent successfully!` });
      } else {
        setMessage({ type: 'error', text: `Test ${type} alert failed: ${data.message || 'Unknown error'}` });
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, [type]: 'error' }));
      setMessage({ type: 'error', text: `Test failed: ${err.message}` });
    }
    // Reset icon after 4s
    setTimeout(() => setTestResults(prev => ({ ...prev, [type]: null })), 4000);
  };

  // Handle switch toggle - directly save without confirmation
  const handleSwitchToggle = async (field, newValue) => {
    const updatedConfig = { ...config, [field]: newValue };
    setConfig(updatedConfig);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(updatedConfig)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: newValue ? t('alertSettings.alertEnabled') : t('alertSettings.alertDisabled') });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save.' });
        setConfig(prev => ({ ...prev, [field]: !newValue })); // revert
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error: ' + err.message });
      setConfig(prev => ({ ...prev, [field]: !newValue })); // revert
    }
  };



  // Save only email configuration section
  const handleSaveEmailConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: t('alertSettings.emailSavedSuccess') });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const TestButton = ({ type, label, icon, color }) => {
    const state = testResults[type];
    return (
      <Button
        variant="outlined"
        size="small"
        disabled={state === 'loading' || !config.fromEmail || !config.toEmails || !canEdit}
        onClick={() => handleTest(type)}
        startIcon={
          state === 'loading' ? <CircularProgress size={16} /> :
          state === 'success' ? <CheckCircle sx={{ color: '#4caf50' }} /> :
          state === 'error' ? <ErrorIcon sx={{ color: '#f44336' }} /> :
          icon
        }
        sx={{
          borderColor: state === 'success' ? '#4caf50' : state === 'error' ? '#f44336' : color,
          color: state === 'success' ? '#4caf50' : state === 'error' ? '#f44336' : color,
          textTransform: 'none',
          '&:hover': {
            borderColor: color,
            backgroundColor: `${color}10`
          }
        }}
      >
        {label}
      </Button>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const alertCardSx = {
    p: 2.5,
    backgroundColor: 'var(--background-paper)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <Box>
      {/* Header */}
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Email Configuration - full width */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'var(--background-paper)', border: '1px solid var(--border-color, #e0e0e0)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Email sx={{ color: '#1976d2', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600}>{t('alertSettings.emailConfiguration')}</Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
          <Autocomplete
            freeSolo
            options={emailContacts.senders}
            value={config.fromEmail}
            onChange={(e, val) => setConfig(prev => ({ ...prev, fromEmail: val || '' }))}
            onInputChange={(e, val) => setConfig(prev => ({ ...prev, fromEmail: val || '' }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('alertSettings.senderEmail')}
                size="small"
                placeholder={t('alertSettings.senderPlaceholder')}
                helperText={emailContacts.senders.length > 0 ? t('alertSettings.senderHelperAddressBook') : t('alertSettings.senderHelperConfigure')}
              />
            )}
          />
          <Autocomplete
            multiple
            freeSolo
            options={emailContacts.recipients}
            value={config.toEmails ? config.toEmails.split(',').map(e => e.trim()).filter(Boolean) : []}
            onChange={(e, val) => setConfig(prev => ({ ...prev, toEmails: val.join(', ') }))}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip label={option} size="small" {...getTagProps({ index })} key={option} />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('alertSettings.recipientEmails')}
                size="small"
                placeholder={t('alertSettings.recipientPlaceholder')}
                helperText={emailContacts.recipients.length > 0 ? t('alertSettings.recipientHelperAddressBook') : t('alertSettings.recipientHelperConfigure')}
              />
            )}
          />
        </Box>
        <TextField
          label={t('alertSettings.tonerThreshold')}
          type="number"
          size="small"
          value={config.tonerThreshold}
          onChange={(e) => setConfig(prev => ({ ...prev, tonerThreshold: Math.max(1, Math.min(100, parseInt(e.target.value) || 5)) }))}
          inputProps={{ min: 1, max: 100 }}
          sx={{ width: 200, display: 'none' }}
          helperText={t('alertSettings.tonerThresholdHelper')}
        />
        {/* Save Email Config Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveEmailConfig}
            disabled={saving || !canEdit}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            sx={{
              textTransform: 'none',
              px: 3,
              backgroundColor: '#1976d2',
              '&:hover': { backgroundColor: '#1565c0' }
            }}
          >
            {saving ? t('common.saving') : t('alertSettings.saveSettings')}
          </Button>
        </Box>
      </Paper>

      {/* Alert Rules - 2x2 card grid */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>{t('alertSettings.alertRules')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mb: 3 }}>
        {/* Offline Alert Card */}
        <Paper sx={alertCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <PowerOff sx={{ color: '#f44336', fontSize: 20 }} />
            <Typography variant="body1" fontWeight={600} color="#f44336">{t('alertSettings.offlineRecoveryAlerts')}</Typography>
          </Box>
          <Tooltip title={config.offlineAlertEnabled ? 'Click to disable offline/recovery alerts' : 'Click to enable offline/recovery alerts'} arrow>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={config.offlineAlertEnabled || false}
                  onChange={(e) => handleSwitchToggle('offlineAlertEnabled', e.target.checked)}
                  disabled={!canEdit}
                />
              }
              label={<Typography variant="body2">{t('alertSettings.enableOfflineAlerts')}</Typography>}
              sx={{ ml: 0, mb: 1 }}
            />
          </Tooltip>
          <Box component="ul" sx={{ m: 0, pl: 2.5, flex: 1, '& li': { mb: 0.5, fontSize: 13, color: 'text.secondary' } }}>
            <li>{t('alertSettings.offlineRule1')}</li>
            <li>{t('alertSettings.offlineRule2')}</li>
            <li>{t('alertSettings.offlineRule3')}</li>
            <li>{t('alertSettings.offlineRule4')}</li>
          </Box>
        </Paper>

        {/* Printer Fault Alert Card */}
        <Paper sx={alertCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <ErrorIcon sx={{ color: '#d32f2f', fontSize: 20 }} />
            <Typography variant="body1" fontWeight={600} color="#d32f2f">{t('alertSettings.printerFaultAlerts')}</Typography>
          </Box>
          <Tooltip title={config.printerErrorAlertEnabled ? 'Click to disable printer fault alerts' : 'Click to enable printer fault alerts'} arrow>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={config.printerErrorAlertEnabled || false}
                  onChange={(e) => handleSwitchToggle('printerErrorAlertEnabled', e.target.checked)}
                  disabled={!canEdit}
                />
              }
              label={<Typography variant="body2">{t('alertSettings.enablePrinterFaultAlerts')}</Typography>}
              sx={{ ml: 0, mb: 1 }}
            />
          </Tooltip>
          <Box component="ul" sx={{ m: 0, pl: 2.5, flex: 1, '& li': { mb: 0.5, fontSize: 13, color: 'text.secondary' } }}>
            <li>{t('alertSettings.faultRule1')}</li>
            <li>{t('alertSettings.faultRule2')}</li>
            <li>{t('alertSettings.faultRule3')}</li>
            <li>{t('alertSettings.faultRule4')}</li>
          </Box>
        </Paper>

        {/* Low Toner Alert Card */}
        <Paper sx={alertCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <FormatColorFill sx={{ color: '#ff9800', fontSize: 20 }} />
            <Typography variant="body1" fontWeight={600} color="#ff9800">{t('alertSettings.lowTonerAlerts')}</Typography>
          </Box>
          <Tooltip title={config.tonerAlertEnabled ? 'Click to disable low toner alerts' : 'Click to enable low toner alerts'} arrow>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={config.tonerAlertEnabled || false}
                  onChange={(e) => handleSwitchToggle('tonerAlertEnabled', e.target.checked)}
                  disabled={!canEdit}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">{t('alertSettings.enableLowTonerAlerts')}</Typography>
                  {[5, 10].map((val) => (
                    <Chip
                      key={val}
                      label={`${val}%`}
                      size="small"
                      variant={config.tonerThreshold === val ? 'filled' : 'outlined'}
                      color={config.tonerThreshold === val ? 'warning' : 'default'}
                      disabled={!canEdit}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!canEdit) return;
                        const updated = { ...config, tonerThreshold: val };
                        setConfig(updated);
                        fetch('/api/alerts', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                          body: JSON.stringify(updated)
                        }).then(r => r.json()).then(d => {
                          if (d.success) setMessage({ type: 'success', text: `Threshold set to ${val}%` });
                        }).catch(() => {});
                      }}
                      sx={{
                        fontWeight: 600,
                        cursor: 'pointer',
                        ...(config.tonerThreshold === val ? {
                          backgroundColor: '#ff9800',
                          color: '#fff',
                          boxShadow: '0 2px 4px rgba(255,152,0,0.4)',
                          border: '2px solid #e65100',
                          ...(config.tonerAlertEnabled ? {
                            '@keyframes breathe': {
                              '0%': { opacity: 0.7, transform: 'scale(0.95)', boxShadow: '0 2px 4px rgba(255,152,0,0.3)' },
                              '50%': { opacity: 1, transform: 'scale(1.05)', boxShadow: '0 3px 8px rgba(255,152,0,0.6)' },
                              '100%': { opacity: 0.7, transform: 'scale(0.95)', boxShadow: '0 2px 4px rgba(255,152,0,0.3)' },
                            },
                            animation: 'breathe 2s ease-in-out infinite',
                          } : {}),
                        } : {
                          backgroundColor: 'transparent',
                          color: 'text.secondary',
                          border: '1px dashed #ccc',
                          opacity: 0.7,
                        })
                      }}
                    />
                  ))}
                </Box>
              }
              sx={{ ml: 0, mb: 1 }}
            />
          </Tooltip>
          <Box component="ul" sx={{ m: 0, pl: 2.5, flex: 1, '& li': { mb: 0.5, fontSize: 13, color: 'text.secondary' } }}>
            <li>{t('alertSettings.tonerRule1', { threshold: config.tonerThreshold })}</li>
            <li>{t('alertSettings.tonerRule2')}</li>
            <li>{t('alertSettings.tonerRule3', { threshold: config.tonerThreshold })}</li>
          </Box>
        </Paper>

        {/* Print Server Alert Card */}
        <Paper sx={alertCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <PowerOff sx={{ color: '#9c27b0', fontSize: 20 }} />
            <Typography variant="body1" fontWeight={600} color="#9c27b0">{t('alertSettings.printServerOfflineAlerts')}</Typography>
          </Box>
          <Tooltip title={config.serverAlertEnabled ? 'Click to disable print server offline alerts' : 'Click to enable print server offline alerts'} arrow>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={config.serverAlertEnabled || false}
                  onChange={(e) => handleSwitchToggle('serverAlertEnabled', e.target.checked)}
                  disabled={!canEdit}
                />
              }
              label={<Typography variant="body2">{t('alertSettings.enableServerAlerts')}</Typography>}
              sx={{ ml: 0, mb: 1 }}
            />
          </Tooltip>
          <Box component="ul" sx={{ m: 0, pl: 2.5, flex: 1, '& li': { mb: 0.5, fontSize: 13, color: 'text.secondary' } }}>
            <li>{t('alertSettings.serverRule1')}</li>
            <li>{t('alertSettings.serverRule2')}</li>
            <li>{t('alertSettings.serverRule3')}</li>
          </Box>
        </Paper>
      </Box>

      {/* Test Alerts - full width */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'var(--background-paper)', border: '1px solid var(--border-color, #e0e0e0)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Send sx={{ color: '#9c27b0', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600}>{t('alertSettings.testAlerts')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('alertSettings.testDescription')}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('alertSettings.title')}
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TestButton type="offline" label={t('alertSettings.offlineAlert')} icon={<PowerOff />} color="#f44336" />
              <TestButton type="recovery" label={t('alertSettings.recoveryAlert')} icon={<PowerSettingsNew />} color="#4caf50" />
              <TestButton type="toner" label={t('alertSettings.lowTonerAlert')} icon={<FormatColorFill />} color="#ff9800" />
              <TestButton type="printer-error" label={t('alertSettings.printerFault')} icon={<ErrorIcon />} color="#d32f2f" />
            </Stack>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('alertSettings.printServerAlerts')}
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TestButton type="server-offline" label={t('alertSettings.serverOffline')} icon={<DnsOutlined />} color="#d32f2f" />
              <TestButton type="server-recovery" label={t('alertSettings.serverRecovery')} icon={<DnsOutlined />} color="#388e3c" />
            </Stack>
          </Box>
        </Box>

        {(!config.fromEmail || !config.toEmails) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            {t('alertSettings.enableTestingHint')}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default AlertSettings;
