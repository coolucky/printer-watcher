import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, ToggleButton, ToggleButtonGroup,
  CircularProgress, Chip, TextField, MenuItem, Button,
  Alert
} from '@mui/material';
import {
  BarChart, TrendingUp, CalendarMonth, Print as PrintIcon,
  Download as DownloadIcon, Settings as SettingsIcon
} from '@mui/icons-material';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/useAuthContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const PrintAnalytics = () => {
  const { t } = useTranslation();
  const { accessToken } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');
  const [dateRange, setDateRange] = useState('30'); // days
  const [selectedPrinter, setSelectedPrinter] = useState('all');
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [config, setConfig] = useState({ bwCostPerPage: 0.08, colorCostPerPage: 0.8, monthlyBudget: 0 });
  const [availableRange, setAvailableRange] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState(null);
  const [hasDailyDelta, setHasDailyDelta] = useState(true);

  const getDateRangeParams = useCallback(() => {
    const end = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() - parseInt(dateRange, 10));
    const start = d.toISOString().split('T')[0];
    return { start, end };
  }, [dateRange]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const { start, end } = getDateRangeParams();

      const params = new URLSearchParams({ start, end, period });
      if (selectedPrinter !== 'all') params.append('printer', selectedPrinter);

      const res = await fetch(`/api/analytics/data?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data.data);
        setSummary(result.data.summary);
        setConfig(result.data.config);
        setHasDailyDelta(Boolean(result.data.hasDailyDelta));

        if (result.data.summary?.totalPages === 0 && result.data.currentTotals) {
          const current = result.data.currentTotals;
          setSummary((prev) => ({
            ...(prev || {}),
            ...result.data.summary,
            displayTotalPages: current.totalPages,
            displayTotalBW: current.totalBW,
            displayTotalColor: current.totalColor,
            displayTotalCost: current.totalCost,
            displayFromCurrentCounter: true,
            byPrinter: result.data.summary.byPrinter,
            byLocation: result.data.summary.byLocation
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, period, selectedPrinter, getDateRangeParams]);

  const fetchRange = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/analytics/range', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const result = await res.json();
      if (result.success) setAvailableRange(result.data);
    } catch (e) { /* ignore */ }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
    fetchRange();
  }, [fetchData, fetchRange]);

  const saveConfig = async (newConfig) => {
    try {
      const res = await fetch('/api/analytics/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(newConfig)
      });
      const result = await res.json();
      if (result.success) {
        setConfig(newConfig);
        setMessage({ type: 'success', text: t('analytics.costSaved') || 'Cost settings saved' });
        fetchData(); // refresh with new costs
      }
    } catch (e) {
      setMessage({ type: 'error', text: t('analytics.saveFailed') || 'Failed to save' });
    }
  };

  const exportAnalytics = async () => {
    if (!accessToken) return;
    try {
      const { start, end } = getDateRangeParams();
      const params = new URLSearchParams({ start, end, period });
      if (selectedPrinter !== 'all') params.append('printer', selectedPrinter);

      const res = await fetch(`/api/analytics/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^\"]+)"?/i);
      const filename = match?.[1] || 'print-analytics.csv';

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: t('analytics.exportSuccess') || 'Export completed' });
    } catch (error) {
      console.error('Failed to export analytics:', error);
      setMessage({ type: 'error', text: t('analytics.exportFailed') || 'Export failed' });
    }
  };

  // Prepare chart data
  const chartData = data && data.length > 0 ? {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: t('analytics.bwPages') || 'B/W Pages',
        data: data.map(d => Object.values(d.printers).reduce((sum, p) => sum + (p.bw || 0), 0)),
        backgroundColor: 'rgba(100, 116, 139, 0.6)',
        borderColor: '#475569',
        borderWidth: 1,
        stack: 'pages'
      },
      {
        label: t('analytics.colorPages') || 'Color Pages',
        data: data.map(d => Object.values(d.printers).reduce((sum, p) => sum + (p.color || 0), 0)),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#2563eb',
        borderWidth: 1,
        stack: 'pages'
      }
    ]
  } : null;

  const costChartData = data && data.length > 0 ? {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: t('analytics.cost') || 'Cost (¥)',
        data: data.map(d => {
          const bw = Object.values(d.printers).reduce((sum, p) => sum + (p.bw || 0), 0);
          const color = Object.values(d.printers).reduce((sum, p) => sum + (p.color || 0), 0);
          return (bw * config.bwCostPerPage + color * config.colorCostPerPage).toFixed(2);
        }),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
    }
  };

  // Get list of available printers from summary
  const printerNames = summary?.byPrinter ? Object.keys(summary.byPrinter) : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChart sx={{ color: 'var(--primary-color)', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600}>
            {t('analytics.title') || 'Print Analytics'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setShowSettings(!showSettings)}
          >
            {t('analytics.costSettings') || 'Cost Settings'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportAnalytics}
          >
            {t('analytics.export') || 'Export'}
          </Button>
        </Box>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Cost Settings Panel */}
      {showSettings && (
        <Paper sx={{ p: 2, mb: 2, backgroundColor: 'var(--background-secondary)' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            {t('analytics.costConfig') || 'Cost Configuration'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label={t('analytics.bwCost') || 'B/W Cost (¥/page)'}
              type="number"
              size="small"
              value={config.bwCostPerPage}
              onChange={(e) => setConfig(prev => ({ ...prev, bwCostPerPage: parseFloat(e.target.value) || 0 }))}
              inputProps={{ step: 0.01, min: 0 }}
              sx={{ width: 160 }}
            />
            <TextField
              label={t('analytics.colorCost') || 'Color Cost (¥/page)'}
              type="number"
              size="small"
              value={config.colorCostPerPage}
              onChange={(e) => setConfig(prev => ({ ...prev, colorCostPerPage: parseFloat(e.target.value) || 0 }))}
              inputProps={{ step: 0.01, min: 0 }}
              sx={{ width: 160 }}
            />
            <TextField
              label={t('analytics.monthlyBudget') || 'Monthly Budget (¥)'}
              type="number"
              size="small"
              value={config.monthlyBudget}
              onChange={(e) => setConfig(prev => ({ ...prev, monthlyBudget: parseFloat(e.target.value) || 0 }))}
              inputProps={{ step: 100, min: 0 }}
              sx={{ width: 160 }}
              helperText="0 = no limit"
            />
            <Button variant="contained" size="small" onClick={() => saveConfig(config)}>
              {t('common.save') || 'Save'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Summary Cards */}
      {summary && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'var(--background-paper)' }}>
            <Typography variant="caption" color="text.secondary">{t('analytics.totalPages') || 'Total Pages'}</Typography>
            <Typography variant="h5" fontWeight={700} color="primary">
              {(summary.displayTotalPages ?? summary.totalPages ?? 0).toLocaleString()}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'var(--background-paper)' }}>
            <Typography variant="caption" color="text.secondary">{t('analytics.bwPages') || 'B/W Pages'}</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#475569' }}>
              {(summary.displayTotalBW ?? summary.totalBW ?? 0).toLocaleString()}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'var(--background-paper)' }}>
            <Typography variant="caption" color="text.secondary">{t('analytics.colorPages') || 'Color Pages'}</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#2563eb' }}>
              {(summary.displayTotalColor ?? summary.totalColor ?? 0).toLocaleString()}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'var(--background-paper)' }}>
            <Typography variant="caption" color="text.secondary">{t('analytics.estimatedCost') || 'Estimated Cost'}</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: summary.budgetExceeded ? '#ef4444' : '#10b981' }}>
              ¥{(summary.displayTotalCost ?? summary.totalCost ?? 0).toFixed(2)}
            </Typography>
            {summary.budgetExceeded && (
              <Chip label="Over Budget" size="small" color="error" sx={{ mt: 0.5 }} />
            )}
          </Paper>
        </Box>
      )}

      {summary?.displayFromCurrentCounter && !hasDailyDelta && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('analytics.counterHint') || 'No page increase detected in selected period; cards are showing latest device counters.'}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(e, val) => val && setPeriod(val)}
          size="small"
        >
          <ToggleButton value="day">{t('analytics.day') || 'Day'}</ToggleButton>
          <ToggleButton value="week">{t('analytics.week') || 'Week'}</ToggleButton>
          <ToggleButton value="month">{t('analytics.month') || 'Month'}</ToggleButton>
          <ToggleButton value="quarter">{t('analytics.quarter') || 'Quarter'}</ToggleButton>
          <ToggleButton value="year">{t('analytics.year') || 'Year'}</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          select
          size="small"
          label={t('analytics.range') || 'Range'}
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          sx={{ width: 140 }}
        >
          <MenuItem value="7">7 days</MenuItem>
          <MenuItem value="30">30 days</MenuItem>
          <MenuItem value="90">90 days</MenuItem>
          <MenuItem value="180">180 days</MenuItem>
          <MenuItem value="365">1 year</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label={t('analytics.printer') || 'Printer'}
          value={selectedPrinter}
          onChange={(e) => setSelectedPrinter(e.target.value)}
          sx={{ width: 180 }}
        >
          <MenuItem value="all">{t('analytics.allPrinters') || 'All Printers'}</MenuItem>
          {printerNames.map(name => (
            <MenuItem key={name} value={name}>{name}</MenuItem>
          ))}
        </TextField>

        {availableRange && (
          <Typography variant="caption" color="text.secondary">
            Data: {availableRange.oldest} ~ {availableRange.newest} ({availableRange.totalDays} days)
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !data || data.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CalendarMonth sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">
            {t('analytics.noData') || 'No data available yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('analytics.noDataHint') || 'Print analytics data will be collected automatically. Please check back after a few days.'}
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Print Volume Chart */}
          <Paper sx={{ p: 2, mb: 3, backgroundColor: 'var(--background-paper)' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PrintIcon fontSize="small" /> {t('analytics.volumeChart') || 'Print Volume'}
            </Typography>
            <Box sx={{ height: 280 }}>
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </Box>
          </Paper>

          {/* Cost Trend Chart */}
          <Paper sx={{ p: 2, mb: 3, backgroundColor: 'var(--background-paper)' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp fontSize="small" /> {t('analytics.costTrend') || 'Cost Trend'}
            </Typography>
            <Box sx={{ height: 220 }}>
              {costChartData && <Line data={costChartData} options={chartOptions} />}
            </Box>
          </Paper>

          {/* Cost Ranking by Printer */}
          {summary?.byPrinter && Object.keys(summary.byPrinter).length > 0 && (
            <Paper sx={{ p: 2, backgroundColor: 'var(--background-paper)' }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                {t('analytics.costRanking') || 'Cost Ranking by Printer'}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(summary.byPrinter)
                  .sort((a, b) => b[1].cost - a[1].cost)
                  .map(([name, stats], i) => (
                    <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1, borderRadius: 1, backgroundColor: i === 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                      <Typography variant="body2" sx={{ width: 24, fontWeight: 700, color: i < 3 ? '#ef4444' : 'text.secondary' }}>
                        #{i + 1}
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>{name}</Typography>
                      <Chip label={`${stats.total.toLocaleString()} pages`} size="small" variant="outlined" />
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#10b981', minWidth: 80, textAlign: 'right' }}>
                        ¥{stats.cost.toFixed(2)}
                      </Typography>
                    </Box>
                  ))
                }
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default PrintAnalytics;
