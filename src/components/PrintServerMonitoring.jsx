import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, ToggleButtonGroup, ToggleButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress,
  Chip, TextField, MenuItem
} from '@mui/material';
import { Timeline, Search, Refresh, CheckCircle, Cancel } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/useAuthContext';
import ENV_CONFIG from '../config/env';

const RANGE_OPTIONS = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' }
];

/**
 * Grafana-style timeline bar for a single server
 */
const TimelineBar = ({ timeline, startTime, endTime, serverName, online }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    if (width === 0) return; // Skip if not laid out yet

    const height = 8;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const totalDuration = endTime - startTime;
    if (totalDuration <= 0) return;

    // Draw background (assume online) with rounded rect
    const radius = 4;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.fillStyle = '#66bb6a';
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, radius);
    ctx.clip();

    if (timeline && timeline.length > 0) {
      // Draw offline/unreachable segments
      let lastStatus = 'online';
      let lastX = 0;

      for (let i = 0; i < timeline.length; i++) {
        const entry = timeline[i];
        const x = Math.round(((entry.timestamp - startTime) / totalDuration) * width);

        if (lastStatus === 'offline' || lastStatus === 'unreachable') {
          ctx.fillStyle = '#ef5350';
          ctx.fillRect(lastX, 0, x - lastX, height);
        }

        lastStatus = entry.status;
        lastX = x;
      }

      if (lastStatus === 'offline' || lastStatus === 'unreachable') {
        ctx.fillStyle = '#ef5350';
        ctx.fillRect(lastX, 0, width - lastX, height);
      }
    }

    ctx.restore();
  }, [timeline, startTime, endTime]);

  // Use ResizeObserver to redraw when container width changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    drawTimeline();

    const observer = new ResizeObserver(() => {
      drawTimeline();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [drawTimeline]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', flex: 1, position: 'relative', overflow: 'hidden', borderRadius: '3px' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '8px',
          display: 'block'
        }}
      />
      {/* Flowing light effect */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '3px',
          overflow: 'hidden',
          pointerEvents: 'none',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '40%',
            height: '100%',
            background: online
              ? 'linear-gradient(90deg, transparent, rgba(144,255,144,0.7), rgba(0,255,100,0.9), rgba(144,255,144,0.7), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(255,120,120,0.7), rgba(255,60,60,0.9), rgba(255,120,120,0.7), transparent)',
            animation: 'flowLight 2s linear infinite',
          },
        }}
      />
    </Box>
  );
};

/**
 * Time axis labels - dynamic based on time range
 */
const TimeAxis = ({ startTime, endTime, timeRange }) => {
  const getLabels = () => {
    if (!startTime || !endTime) return [];
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (timeRange === '1h') {
      // Show every 10 minutes
      const labels = [];
      for (let i = 0; i <= 6; i++) {
        const t = new Date(startTime + (endTime - startTime) * (i / 6));
        labels.push(`${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`);
      }
      return labels;
    } else if (timeRange === '6h') {
      // Show every hour
      const labels = [];
      for (let i = 0; i <= 6; i++) {
        const t = new Date(startTime + (endTime - startTime) * (i / 6));
        labels.push(`${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`);
      }
      return labels;
    } else if (timeRange === '7d') {
      // Show day names
      const labels = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 0; i <= 7; i++) {
        const t = new Date(startTime + (endTime - startTime) * (i / 7));
        labels.push(`${days[t.getDay()]} ${t.getDate()}`);
      }
      return labels;
    } else {
      // 24h - show hours of the day
      return ['0:00', '4:00', '8:00', '12:00', '16:00', '20:00', '23:59'];
    }
  };

  const labels = getLabels();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, mt: 0.5 }}>
      {/* Spacer matching status dot */}
      <Box sx={{ width: 8, flexShrink: 0 }} />
      {/* Spacer matching server info */}
      <Box sx={{ minWidth: 140, flexShrink: 0 }} />
      {/* Time labels - fills same space as timeline bar */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
        {labels.map((label, i) => (
          <Typography key={i} variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
            {label}
          </Typography>
        ))}
      </Box>
      {/* Spacer matching status chip */}
      <Chip label="Online" size="small" sx={{ visibility: 'hidden', ml: 1, height: 20, fontSize: '0.68rem' }} />
    </Box>
  );
};

const PrintServerMonitoring = () => {
  const { t } = useTranslation();
  const { accessToken } = useAuthContext();
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const [servers, setServers] = useState([]);
  const [timelines, setTimelines] = useState({});
  const [timeRange, setTimeRange] = useState('24h');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilters, setLogFilters] = useState({ serverId: '', event: '' });

  const fetchData = useCallback(async () => {
    try {
      const token = accessTokenRef.current;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const statusUrl = token
        ? `${ENV_CONFIG.API_BASE_URL}/print-servers/status`
        : `${ENV_CONFIG.API_BASE_URL}/status/print-servers`;
      const timelineUrl = token
        ? `${ENV_CONFIG.API_BASE_URL}/print-servers/timeline?range=${timeRange}`
        : `${ENV_CONFIG.API_BASE_URL}/status/print-servers/timeline?range=${timeRange}`;

      // Fetch servers status
      const serverRes = await fetch(statusUrl, { headers });
      if (serverRes.ok) {
        const data = await serverRes.json();
        setServers(data.data || []);
      }

      // Fetch timeline
      const timelineRes = await fetch(timelineUrl, { headers });
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimelines(data.data?.timelines || {});
        setStartTime(data.data?.startTime || 0);
        setEndTime(data.data?.endTime || Date.now());
      }
    } catch (err) {
      console.error('Failed to fetch print server data:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (logFilters.serverId) params.set('serverId', logFilters.serverId);
      if (logFilters.event) params.set('event', logFilters.event);

      const token = accessTokenRef.current;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const logsUrl = token
        ? `${ENV_CONFIG.API_BASE_URL}/print-servers/logs?${params}`
        : `${ENV_CONFIG.API_BASE_URL}/status/print-servers/logs?${params}`;

      let res = await fetch(logsUrl, { headers });
      // Fallback to public endpoint if auth fails
      if (!res.ok && token) {
        res = await fetch(`${ENV_CONFIG.API_BASE_URL}/status/print-servers/logs?${params}`);
      }
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [logFilters]);

  const handleOpenLogs = () => {
    setLogsDialogOpen(true);
    fetchLogs();
  };

  if (loading && servers.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (servers.length === 0) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Timeline fontSize="small" />
          {t('printServerMonitoring.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t('printServerMonitoring.noServers')}
        </Typography>
        <Button variant="outlined" size="small" onClick={() => {
          const devicesTab = document.querySelector('[role="tab"]:nth-child(3)');
          if (devicesTab) devicesTab.click();
        }}>
          {t('printServerMonitoring.goToDevices')}
        </Button>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Timeline fontSize="small" />
          {t('printServerMonitoring.title')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={(_, val) => val && setTimeRange(val)}
            size="small"
          >
            {RANGE_OPTIONS.map(opt => (
              <ToggleButton key={opt.value} value={opt.value} sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>
                {opt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button size="small" startIcon={<Search />} onClick={handleOpenLogs} variant="outlined">
            {t('printServerMonitoring.logs')}
          </Button>
          <Button size="small" startIcon={<Refresh />} onClick={fetchData} variant="outlined">
            {t('common.refresh')}
          </Button>
        </Box>
      </Box>

      {/* Server Timeline Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {servers.map((server) => (
          <Box
            key={server.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1,
              px: 1.5,
              borderRadius: 1,
              '&:hover': { bgcolor: 'action.hover' },
              transition: 'background-color 0.15s'
            }}
          >
            {/* Status indicator with breathing animation */}
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: server.online ? 'var(--status-online)' : 'var(--status-offline)',
              flexShrink: 0,
              boxShadow: server.online
                ? '0 0 4px rgba(102,187,106,0.5)'
                : '0 0 4px rgba(239,83,80,0.5)',
              animation: server.online
                ? 'breathe 2s ease-in-out infinite'
                : 'breatheOffline 0.8s ease-in-out infinite',
            }} />
            {/* Server info */}
            <Box sx={{ minWidth: 140, flexShrink: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.82rem', lineHeight: 1.3 }}>
                {server.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.68rem' }}>
                {server.ip}
              </Typography>
            </Box>
            {/* Timeline bar */}
            <TimelineBar
              timeline={timelines[server.id] || []}
              startTime={startTime}
              endTime={endTime}
              serverName={server.name}
              online={server.online}
            />
            {/* Status chip with pulse glow */}
            <Chip
              icon={server.online ? <CheckCircle sx={{ fontSize: '0.75rem !important' }} /> : <Cancel sx={{ fontSize: '0.75rem !important' }} />}
              label={server.online ? t('printServerMonitoring.online') : t('printServerMonitoring.offline')}
              size="small"
              sx={{
                ml: 1,
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 500,
                bgcolor: server.online ? 'var(--status-online-light)' : 'var(--status-offline-light)',
                color: server.online ? 'var(--status-online-dark)' : 'var(--status-offline-dark)',
                '& .MuiChip-icon': { color: 'inherit', ml: '4px', mr: '-2px' },
                flexShrink: 0,
                animation: server.online
                  ? 'chipPulse 2s ease-in-out infinite'
                  : 'chipPulseOffline 0.8s ease-in-out infinite',
              }}
            />
          </Box>
        ))}
      </Box>

      {/* Time Axis */}
      {startTime > 0 && endTime > 0 && (
        <TimeAxis startTime={startTime} endTime={endTime} timeRange={timeRange} />
      )}

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 16, height: 6, bgcolor: 'var(--status-online)', borderRadius: 0.5 }} />
          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{t('printServerMonitoring.online')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 16, height: 6, bgcolor: 'var(--status-offline)', borderRadius: 0.5 }} />
          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{t('printServerMonitoring.offline')}</Typography>
        </Box>
      </Box>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onClose={() => setLogsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('printServerMonitoring.logsTitle')}</DialogTitle>
        <DialogContent>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 1 }}>
            <TextField
              select
              size="small"
              label={t('printServerMonitoring.server')}
              value={logFilters.serverId}
              onChange={(e) => setLogFilters({ ...logFilters, serverId: e.target.value })}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">{t('printServerMonitoring.allServers')}</MenuItem>
              {servers.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t('printServerMonitoring.event')}
              value={logFilters.event}
              onChange={(e) => setLogFilters({ ...logFilters, event: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">{t('printServerMonitoring.allEvents')}</MenuItem>
              <MenuItem value="offline">{t('printServerMonitoring.eventOffline')}</MenuItem>
              <MenuItem value="recovery">{t('printServerMonitoring.eventRecovery')}</MenuItem>
            </TextField>
            <Button size="small" variant="contained" onClick={fetchLogs}>
              {t('common.search')}
            </Button>
          </Box>

          {logsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : logs.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              {t('printServerMonitoring.noLogsFound')}
            </Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('printServerMonitoring.time')}</strong></TableCell>
                    <TableCell><strong>{t('printServerMonitoring.server')}</strong></TableCell>
                    <TableCell><strong>{t('printServerMonitoring.event')}</strong></TableCell>
                    <TableCell><strong>{t('printServerMonitoring.details')}</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.serverName}</Typography>
                        <Typography variant="caption" color="text.secondary">{log.serverIp}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.event === 'offline' ? t('printServerMonitoring.eventOffline') : t('printServerMonitoring.eventRecovery')}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: log.event === 'offline' ? '#ffebee' : '#e8f5e9',
                            color: log.event === 'offline' ? '#c62828' : '#2e7d32'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {log.downtime ? `${t('printServerMonitoring.downtime')} ${log.downtime}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogsDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default PrintServerMonitoring;
