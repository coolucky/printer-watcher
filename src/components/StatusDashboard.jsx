import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Divider, Button, CircularProgress, Fade, Dialog, DialogTitle, DialogContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, MenuItem, Chip } from '@mui/material';
import { Refresh, Search, Print, CheckCircle, Cancel, Warning as WarningIcon, AddCircleOutline } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/useAuthContext';
import ENV_CONFIG from '../config/env';
import PrinterCardSkeleton from './PrinterCardSkeleton';
import EmptyState from './EmptyState';

// 辅助函数定义
const getStatusColor = (status) => {
  const normalized = (status || '').toLowerCase();
  const colorMap = {
    online: 'var(--status-online)',
    ready: 'var(--status-online)',
    offline: 'var(--status-offline)',
    warning: 'var(--status-warning)',
    'paper jam': '#f44336',
    'no paper': '#ff9800',
    'door open': '#ff9800',
    error: 'var(--status-offline)',
    unknown: 'var(--status-unknown)'
  };
  return colorMap[normalized] || colorMap.unknown;
};

const getStatusLabel = (status) => {
  const normalized = (status || '').toLowerCase();
  const labelMap = {
    online: 'Online',
    ready: 'Online',
    offline: 'Offline',
    warning: 'Warning',
    'paper jam': 'Paper Jam',
    'no paper': 'No Paper',
    'door open': 'Door Open',
    error: 'Error',
    unknown: 'Unknown'
  };
  return labelMap[normalized] || status || 'Unknown';
};

const getPrinterName = (printer) => {
  if (!printer || typeof printer !== 'object') return 'Unknown Printer';
  return printer.name || 'Unknown Printer';
};

const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};



// 纯函数：渲染墨粉级别，避免在组件内重复创建
const renderTonerLevels = (printer, tonerMethodsStatus) => {
  // 定义标准墨粉颜色映射，确保与进度条颜色匹配
  const tonerColorMap = {
    black: '#333333',
    cyan: '#00a8e8',
    magenta: '#d9006e',
    yellow: '#ffd100'
  };

  // 获取打印机ID
  const printerId = printer.ip || printer.id;
  
  // 优先使用SNMP获取的实时数据
  const snmpData = tonerMethodsStatus[printerId]?.snmp?.status === 'success' ? tonerMethodsStatus[printerId].snmp.data : null;
  
  // 获取实际检测到的墨粉级别或默认为空对象
  const actualTonerLevels = printer && typeof printer === 'object' && printer.actualTonerLevels
    ? printer.actualTonerLevels
    : {};
  
  // 确保actualTonerLevels是对象
  const safeTonerLevels = typeof actualTonerLevels === 'object' && !Array.isArray(actualTonerLevels)
    ? actualTonerLevels
    : {};

  // 合并墨粉级别数据：优先使用SNMP实时数据，其次使用保存的数据
  const mergedTonerLevels = {
    black: snmpData?.black !== undefined ? snmpData.black : (safeTonerLevels.black !== undefined ? safeTonerLevels.black : 0),
    cyan: snmpData?.cyan !== undefined ? snmpData.cyan : (safeTonerLevels.cyan !== undefined ? safeTonerLevels.cyan : 0),
    magenta: snmpData?.magenta !== undefined ? snmpData.magenta : (safeTonerLevels.magenta !== undefined ? safeTonerLevels.magenta : 0),
    yellow: snmpData?.yellow !== undefined ? snmpData.yellow : (safeTonerLevels.yellow !== undefined ? safeTonerLevels.yellow : 0)
  };

  // Convert to entries for rendering
  const tonerEntries = Object.entries(mergedTonerLevels);

  return (
    <div>
      {tonerEntries.map(([color, level]) => {
        // Ensure level is a number
        const safeLevel = typeof level === 'number' ? Math.max(0, Math.min(100, level)) : 0;
        
        // Get color based on toner type (black, cyan, magenta, yellow)
        const tonerColor = tonerColorMap[color] || '#808080'; // Default to gray if color not found
        
        // Get status color based on level
        let statusColor;
        if (safeLevel > 50) {
          statusColor = '#4caf50'; // Green for good
        } else if (safeLevel > 20) {
          statusColor = '#ff9800'; // Orange for warning
        } else {
          statusColor = '#f44336'; // Red for critical
        }

        return (
          <div key={color} style={{ marginBottom: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <Typography variant="caption" style={{ color: tonerColor, textShadow: '0 0 1px rgba(0,0,0,0.3)', fontSize: '0.8rem' }}>
                {color.toUpperCase()}:
              </Typography>
              <Typography variant="caption" style={{ color: statusColor, textShadow: '0 0 1px rgba(0,0,0,0.3)', fontSize: '0.8rem' }}>
                {safeLevel}%
              </Typography>
            </div>
            <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--border-color)', borderRadius: '2px' }}>
              <div
                style={{
                  width: `${safeLevel}%`,
                  height: '100%',
                  backgroundColor: tonerColor,
                  borderRadius: '2px',
                  // Add border to make it visible against background
                  border: '1px solid rgba(0,0,0,0.2)'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Optimized Printer Card Component
// Error state label mapping
const errorLabelMap = {
  lowPaper: 'Low Paper',
  noPaper: 'No Paper',
  lowToner: 'Low Toner',
  noToner: 'No Toner',
  doorOpen: 'Door Open',
  jammed: 'Paper Jam',
  offline: 'Offline',
  serviceRequested: 'Service Required',
  inputTrayMissing: 'Input Tray Missing',
  outputTrayMissing: 'Output Tray Missing',
  outputNearFull: 'Output Near Full',
  outputFull: 'Output Full',
  inputTrayEmpty: 'Input Tray Empty'
};

const PrinterCard = React.memo(({ printer, index, tonerMethodsStatus, handleTonerMethodRefresh, handleUpdateTonerLevels }) => {
  const [showSnmpDetails, setShowSnmpDetails] = useState(false);
  const { t } = useTranslation();
  const status = printer.status || 'unknown';
  const statusColor = getStatusColor(status);
  const statusLabel = t(`statusDashboard.status.${status}`) || getStatusLabel(status);
  const printerName = getPrinterName(printer);
  const ip = printer.ip || 'Unknown IP';
  const model = 'FujiFilm Apeos C5570'; // All printers use this model
  const printerId = printer.ip || `printer-${index}`;

  // 使用稳定的ID作为key
  const stableKey = printer.id || printerId;

  return (
    <Card
      key={stableKey}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `4px solid ${statusColor}`,
        bgcolor: 'var(--background-paper)',
        color: 'var(--text-primary)',
        boxSizing: 'border-box',
        maxWidth: '100%',
        padding: '4px',
        minWidth: '0',
        transition: 'transform 150ms cubic-bezier(0.4,0,0.2,1), box-shadow 250ms cubic-bezier(0.4,0,0.2,1)',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
        },
      }}
    >
      <CardContent sx={{ padding: '6px' }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1} gap="8px">
          <div style={{ flex: 1 }}>
            <Typography variant="subtitle2" component="div" noWrap sx={{ fontSize: '0.9rem' }}>
              {typeof printerName === 'string' ? printerName : 'Unknown Printer'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem' }}>
              {model}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              IP: {ip}
            </Typography>
          </div>
          <Box
            sx={{
              backgroundColor: statusColor,
              color: 'white',
              padding: '2px 8px',
              borderRadius: '3px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              animation: status === 'online'
                ? 'onlinePulse 2s ease-in-out infinite'
                : status === 'offline'
                  ? 'offlinePulse 0.8s ease-in-out infinite'
                  : 'none',
            }}
          >
            {status === 'online' || status === 'ready' ? <CheckCircle sx={{ fontSize: '0.75rem' }} /> : status === 'offline' ? <Cancel sx={{ fontSize: '0.75rem' }} /> : <WarningIcon sx={{ fontSize: '0.75rem' }} />}
            {statusLabel}
          </Box>
        </Box>

        <Divider sx={{ my: 1, height: '2px' }} />

        {/* Printer Errors / Status Bar */}
        {(() => {
          const hasErrors = printer.printerErrors && printer.printerErrors.hasErrors;
          if (hasErrors) {
            const criticalErrors = printer.printerErrors.activeErrors.filter(e => ['noPaper', 'doorOpen', 'jammed', 'noToner', 'serviceRequested', 'offline'].includes(e));
            const infoErrors = printer.printerErrors.activeErrors.filter(e => ['lowPaper', 'lowToner', 'outputNearFull'].includes(e));
            if (criticalErrors.length > 0) {
              return (
                <div style={{ marginBottom: '6px', padding: '4px 6px', borderRadius: '4px', backgroundColor: 'rgba(244, 67, 54, 0.08)', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.3, fontSize: '0.75rem', color: '#f44336' }}>
                    ⚠ {t('statusDashboard.errorState')}
                  </Typography>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {criticalErrors.map(err => (
                      <Chip
                        key={err}
                        label={t(`statusDashboard.error.${err}`, errorLabelMap[err] || err)}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(244, 67, 54, 0.15)', color: '#d32f2f' }}
                      />
                    ))}
                  </div>
                </div>
              );
            }
            if (infoErrors.length > 0) {
              return (
                <div style={{ marginBottom: '6px', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 152, 0, 0.06)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#f57c00' }}>
                    ℹ {infoErrors.map(e => t(`statusDashboard.error.${e}`, errorLabelMap[e] || e)).join(', ')}
                  </Typography>
                </div>
              );
            }
          }
          return (
            <div style={{ marginBottom: '6px', padding: '3px 6px', borderRadius: '4px', backgroundColor: 'rgba(76, 175, 80, 0.06)', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#388e3c' }}>
                ✓ {t('statusDashboard.noIssues')}
              </Typography>
            </div>
          );
        })()}

        {/* Page Count */}
        {printer.pageCount && printer.pageCount.total != null && (
          <div style={{ marginBottom: '6px' }}>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
              {t('statusDashboard.totalPages')} <strong style={{ color: 'var(--text-primary)' }}>{printer.pageCount.total.toLocaleString()}</strong>
            </Typography>
          </div>
        )}

        {/* Toner levels */}
        <div>
          <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5, fontSize: '0.8rem' }}>
            {t('statusDashboard.tonerLevels')}
          </Typography>
          {renderTonerLevels(printer, tonerMethodsStatus)}
        </div>

        {/* Data Sources - SNMP only */}
        <div style={{ marginTop: '10px' }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5, fontSize: '0.8rem' }}>
            {t('statusDashboard.dataSources')}
          </Typography>
          {(() => {
            const methodStatus = tonerMethodsStatus[printerId]?.snmp || { status: 'idle' };
            const statusColor = {
              idle: 'var(--text-primary)',
              success: 'var(--status-online-dark)',
              error: 'var(--status-offline-dark)',
              loading: 'var(--status-info)'
            }[methodStatus.status] || 'var(--text-primary)';

            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                  <Button
                    size="small"
                    onClick={() => {
                      if (methodStatus.status === 'success') {
                        setShowSnmpDetails(!showSnmpDetails);
                      } else {
                        handleTonerMethodRefresh(printer, 'snmp', printerId);
                        setShowSnmpDetails(true);
                      }
                    }}
                    sx={{ minWidth: 'auto', padding: '2px 6px', color: statusColor, fontSize: '0.7rem' }}
                    disabled={methodStatus.status === 'loading'}
                  >
                    SNMP
                    {methodStatus.status === 'loading' && (
                      <CircularProgress size={12} sx={{ ml: 0.25, color: statusColor }} />
                    )}
                  </Button>
                  <div style={{ flex: 1, textAlign: 'right', fontSize: '0.65rem', color: statusColor }}>
                    {methodStatus.status === 'success' && t('statusDashboard.snmpSuccess')}
                    {methodStatus.status === 'error' && t('statusDashboard.snmpFailed')}
                    {methodStatus.status === 'loading' && t('statusDashboard.snmpFetching')}
                    {methodStatus.status === 'idle' && t('statusDashboard.snmpFetch')}
                  </div>
                </div>
                {showSnmpDetails && methodStatus.status === 'success' && methodStatus.data && (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.55rem', lineHeight: 1.3, color: '#2e7d32' }}>
                      {Object.entries(methodStatus.data)
                        .filter(([key]) => ['black', 'cyan', 'magenta', 'yellow'].includes(key.toLowerCase()))
                        .map(([color, level]) => (
                          <span key={color} style={{ marginRight: '8px' }}>
                            {color.toUpperCase()}: {level}%
                          </span>
                        ))}
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '2px' }}>
                      <Button
                        size="small"
                        onClick={() => handleUpdateTonerLevels(printerId, 'snmp')}
                        sx={{ minWidth: 'auto', padding: '2px 8px', color: '#2196f3', fontSize: '0.7rem' }}
                      >
                        {t('statusDashboard.update')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Printer details - timestamps at bottom */}
        <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '5px' }}>
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
            {t('statusDashboard.updated')} {formatDate(printer.lastUpdated || new Date().toISOString())}
          </Typography>
          {printer.lastPingTime && (
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem' }}>
              {t('statusDashboard.lastPing')} {formatDate(printer.lastPingTime)}
            </Typography>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// 主组件
const StatusDashboard = ({ 
  printerStatuses = [], 
  onRefresh, 
  loading = false,
  licenseDays 
}) => {
  const { t } = useTranslation();
  // 从localStorage获取缓存的ping结果，实现提前加载
  const getCachedPingResults = () => {
    try {
      const cached = localStorage.getItem('cachedPingResults');
      if (cached) {
        const parsed = JSON.parse(cached);
        // 检查缓存是否在10分钟内，如果超过则返回空对象
        const cacheTime = parsed.timestamp || 0;
        const now = Date.now();
        const tenMinutesInMs = 10 * 60 * 1000;
        
        if (now - cacheTime < tenMinutesInMs) {
          console.log('使用缓存的ping结果进行初始显示');
          return parsed.results || {};
        }
      }
    } catch (error) {
      console.warn('读取缓存的ping结果失败:', error);
    }
    return {};
  };

  // 从localStorage加载缓存的SNMP墨粉数据作为初始状态
  const getCachedTonerStatus = () => {
    try {
      const cached = localStorage.getItem('cachedTonerData');
      if (cached) {
        const parsed = JSON.parse(cached);
        const cacheTime = parsed.timestamp || 0;
        const now = Date.now();
        // 缓存10分钟内有效
        if (now - cacheTime < 10 * 60 * 1000 && parsed.data) {
          const result = {};
          Object.entries(parsed.data).forEach(([ip, tonerLevels]) => {
            result[ip] = {
              snmp: {
                status: 'success',
                data: tonerLevels,
                timestamp: new Date(cacheTime).toISOString()
              }
            };
          });
          return result;
        }
      }
    } catch (error) {
      console.warn('读取缓存的SNMP数据失败:', error);
    }
    return {};
  };

  // State Management
  const [refreshing, setRefreshing] = useState(false);
  const [tonerMethodsStatus, setTonerMethodsStatus] = useState(getCachedTonerStatus);
  // 使用缓存的ping结果作为初始状态，实现页面加载时的即时显示
  const [pingResults, setPingResults] = useState(getCachedPingResults);
  // Full backend status data per IP (printerErrors, pageCount, status)
  const [backendStatusData, setBackendStatusData] = useState({});
  // Printer logs dialog state
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [printerLogs, setPrinterLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilters, setLogFilters] = useState({ printerIp: '', event: '' });

  // 定义墨粉获取方法
  const tonerMethods = [
    { id: 'snmp', name: 'SNMP' }
  ];

  // 安全处理打印机数据
  const safePrinterStatuses = useMemo(() => {
    if (!Array.isArray(printerStatuses)) {
      console.warn('printerStatuses is not an array, returning empty array');
      return [];
    }
    return printerStatuses.map(printer => {
      if (!printer || typeof printer !== 'object') {
        return {
          id: `invalid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: 'Invalid Printer',
          ip: 'Unknown IP',
          status: 'unknown',
          lastUpdated: new Date().toISOString()
        };
      }
      return {
        id: printer.id || `printer_${printer.ip || Date.now()}`,
        name: printer.name || 'Unknown Printer',
        ip: printer.ip || 'Unknown IP',
        status: printer.status || 'unknown',
        lastUpdated: printer.lastUpdated || new Date().toISOString(),
        ...printer
      };
    });
  }, [printerStatuses]);

  // 刷新墨粉数据方法
  const handleTonerMethodRefresh = async (printer, methodId, printerId) => {
    // Update status to loading
    setTonerMethodsStatus(prev => ({
      ...prev,
      [printerId]: {
        ...prev[printerId],
        [methodId]: {
          status: 'loading',
          timestamp: new Date().toISOString()
        }
      }
    }));

    try {
      // Fetch data using the selected method
      const data = await fetchTonerDataByMethod(printer, methodId, printerId);
      
      // Update status to success with data
      setTonerMethodsStatus(prev => ({
        ...prev,
        [printerId]: {
          ...prev[printerId],
          [methodId]: {
            status: 'success',
            data: data,
            timestamp: new Date().toISOString()
          }
        }
      }));
    } catch (error) {
      // Update status to error - optimized status update
      setTonerMethodsStatus(prev => ({
        ...prev,
        [printerId]: {
          ...prev[printerId],
          [methodId]: {
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          }
        }
      }));
    }
  };
  
  // Helper function to fetch toner data based on method
  const fetchTonerDataByMethod = async (completePrinter, methodId) => {
    // Simulate data fetching based on method
    await new Promise(resolve => setTimeout(resolve, 800)); // Reduced timeout from 1000ms to 800ms
    
    let tonerData = null;
    
    switch (methodId) {
      case 'saved':
        // Try to get saved data from printer object
        if (completePrinter && completePrinter.actualTonerLevels && typeof completePrinter.actualTonerLevels === 'object') {
          tonerData = completePrinter.actualTonerLevels;
        } else if (completePrinter && completePrinter.manualTonerLevels && typeof completePrinter.manualTonerLevels === 'object') {
          // Fallback to manual levels if actual isn't available
          tonerData = completePrinter.manualTonerLevels;
        } else {
          throw new Error('No saved toner data available');
        }
        break;
        
      case 'webpage':
        // In a real implementation, this would scrape the printer's web interface
        if (completePrinter && completePrinter.webTonerData && typeof completePrinter.webTonerData === 'object') {
          tonerData = completePrinter.webTonerData;
          console.log(`使用打印机对象中已有的webTonerData:`, tonerData);
        } else if (completePrinter && completePrinter.actualTonerLevels && typeof completePrinter.actualTonerLevels === 'object') {
          // 如果没有webTonerData，优先使用actualTonerLevels作为替代
          tonerData = {
            ...completePrinter.actualTonerLevels,
            source: '实际墨粉级别数据'
          };
          console.log(`使用actualTonerLevels作为替代:`, tonerData);
        } else if (completePrinter && completePrinter.manualTonerLevels && typeof completePrinter.manualTonerLevels === 'object') {
          // 如果上述都没有，使用manualTonerLevels作为替代
          tonerData = {
            ...completePrinter.manualTonerLevels,
            source: '手动设置墨粉级别数据'
          };
          console.log(`使用manualTonerLevels作为替代:`, tonerData);
        } else if (completePrinter && completePrinter.ip && typeof completePrinter.ip === 'string') {
          // 如果所有上述数据都不存在，记录警告但不生成随机数据
          console.warn(`打印机 ${completePrinter.ip} 没有可用的墨粉数据，无法通过webpage方式获取实际数据`);
          throw new Error('没有可用的墨粉数据，请先确保打印机有实际的墨粉级别数据');
        } else {
          throw new Error('Printer IP not available for web page access');
        }
        break;
        
      case 'snmp':
        // Use backend API to get SNMP data
        if (completePrinter && completePrinter.ip) {
          try {
            const snmpHeaders = {};
            const snmpToken = authContext.accessToken || authContext.state?.accessToken;
            if (snmpToken) snmpHeaders.Authorization = `Bearer ${snmpToken}`;
            const response = await fetch(`${ENV_CONFIG.API_BASE_URL}/printers/${completePrinter.ip}/snmp`, { headers: snmpHeaders });
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.tonerLevels && typeof data.tonerLevels === 'object') {
              tonerData = data.tonerLevels;
            } else {
              throw new Error('No toner data returned from SNMP');
            }
          } catch (error) {
            console.error('Error fetching SNMP data:', error);
            throw new Error(`SNMP error: ${error.message}`);
          }
        } else {
          throw new Error('Printer IP not available for SNMP access');
        }
        break;
        
      case 'papercut':
        // Use backend API to get PaperCut data
        if (completePrinter && completePrinter.ip) {
          try {
            const pcHeaders = {};
            const pcToken = authContext.accessToken || authContext.state?.accessToken;
            if (pcToken) pcHeaders.Authorization = `Bearer ${pcToken}`;
            const response = await fetch(`${ENV_CONFIG.API_BASE_URL}/printer-status/${completePrinter.ip}`, { headers: pcHeaders });
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.tonerLevels && typeof data.tonerLevels === 'object') {
              tonerData = data.tonerLevels;
            } else {
              throw new Error('No toner data returned from PaperCut MF');
            }
          } catch (error) {
            console.error('Error fetching PaperCut data:', error);
            throw new Error(`PaperCut error: ${error.message}`);
          }
        } else {
          throw new Error('Printer IP not available for PaperCut access');
        }
        break;
        
      default:
        throw new Error('Unknown toner acquisition method');
    }
    
    return tonerData;
  };
  
  // Handle update toner levels with selected method data
  const handleUpdateTonerLevels = (printerId, methodId) => {
    // Get the method data from status state
    const methodData = tonerMethodsStatus[printerId]?.[methodId];
    
    if (methodData && methodData.status === 'success' && methodData.data) {
      console.log(`Updating toner levels for printer ${printerId} with data from ${methodId}:`, methodData.data);
      
      // Find the printer in safePrinterStatuses by IP or ID
      const printerToUpdate = safePrinterStatuses.find(p => p.ip === printerId || p.id === printerId);
      
      if (printerToUpdate && typeof printerToUpdate === 'object') {
        // Toner levels will be updated when data is saved to localStorage
        
        // Update local storage with new printer data
        try {
          // Get current printers from localStorage
          const savedPrinters = localStorage.getItem('printers');
          let printersArray = savedPrinters ? JSON.parse(savedPrinters) : [];
          
          // Find and update the printer in the array
          const printerIndex = printersArray.findIndex(p => p.ip === printerId || p.id === printerId);
          
          if (printerIndex !== -1) {
            // Update existing printer
            printersArray[printerIndex] = {
              ...printersArray[printerIndex],
              actualTonerLevels: methodData.data,
              lastUpdated: new Date().toISOString()
            };
          } else {
            // Printer not found in localStorage
            console.warn('Could not find printer in localStorage for update');
          }
          
          // Save updated printers back to localStorage
          localStorage.setItem('printers', JSON.stringify(printersArray));
          
          // Refresh the status to show updated data
          if (onRefresh && typeof onRefresh === 'function') {
            onRefresh();
          }
          
          console.log('Successfully updated printer toner levels');
        } catch (error) {
          console.error('Error updating printer toner levels:', error);
        }
      }
    }
  };

  // Status count functionality is now handled directly in the component rendering

  // Implement printer status detection function - wrapped with useCallback
  // 获取认证token用于API调用
  const authContext = useAuthContext();

  // 自动刷新token的辅助函数
  const fetchWithAutoRefresh = useCallback(async (url, options = {}) => {
    let currentToken = authContext.accessToken || authContext.state?.accessToken;
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 如果返回401，尝试刷新token后重试
    const storedRefreshToken = authContext.state?.refreshToken;
    if (response.status === 401 && storedRefreshToken) {
      try {
        const refreshResponse = await fetch(`${ENV_CONFIG.API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefreshToken })
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const newToken = refreshData.data?.accessToken || refreshData.accessToken;
          const newRefresh = refreshData.data?.refreshToken || refreshData.refreshToken;

          if (newToken) {
            // 更新auth context中的token
            authContext.setTokens(newToken, newRefresh || storedRefreshToken);

            // 用新token重试原始请求
            response = await fetch(url, {
              ...options,
              headers: {
                ...options.headers,
                'Authorization': `Bearer ${newToken}`,
                'Content-Type': 'application/json'
              }
            });
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }

    return response;
  }, [authContext]);

  // 通过后端API检测所有打印机在线状态
  const pingAllPrinters = useCallback(async () => {
    try {
      let response;
      const currentToken = authContext.accessToken || authContext.state?.accessToken;
      if (currentToken) {
        response = await fetchWithAutoRefresh(`${ENV_CONFIG.API_BASE_URL}/printers/all-printer-status`);
      } else {
        // 未登录时使用公开API
        response = await fetch(`${ENV_CONFIG.API_BASE_URL}/status/printers`);
      }

      // 如果认证请求失败，fallback到公开API
      if (!response.ok && currentToken) {
        console.warn('Authenticated request failed, falling back to public API');
        response = await fetch(`${ENV_CONFIG.API_BASE_URL}/status/printers`);
      }

      if (!response.ok) {
        console.warn('Failed to fetch printer status from backend:', response.status);
        return;
      }

      const result = await response.json();
      const statusData = result.data || result;

      const newPingResults = {};
      const newBackendStatus = {};
      if (Array.isArray(statusData)) {
        statusData.forEach(printer => {
          if (printer && printer.ip) {
            newPingResults[printer.ip] = printer.online === true || printer.status === 'Ready';
            // Store full backend status data (status, printerErrors, pageCount)
            newBackendStatus[printer.ip] = {
              status: printer.status,
              printerErrors: printer.printerErrors || null,
              pageCount: printer.pageCount || null
            };
          }
        });

        // 自动更新SNMP toner数据到tonerMethodsStatus
        const newTonerStatus = {};
        statusData.forEach(printer => {
          if (printer && printer.ip && printer.tonerLevels && typeof printer.tonerLevels === 'object') {
            const hasValidData = Object.keys(printer.tonerLevels).length > 0;
            if (hasValidData) {
              newTonerStatus[printer.ip] = {
                snmp: {
                  status: 'success',
                  data: printer.tonerLevels,
                  timestamp: new Date().toISOString()
                }
              };
            }
          }
        });

        if (Object.keys(newTonerStatus).length > 0) {
          setTonerMethodsStatus(prev => ({ ...prev, ...newTonerStatus }));
          // 缓存SNMP墨粉数据到localStorage，供Report Generation使用
          try {
            const tonerCache = {};
            Object.entries(newTonerStatus).forEach(([ip, data]) => {
              if (data.snmp?.status === 'success' && data.snmp.data) {
                tonerCache[ip] = data.snmp.data;
              }
            });
            if (Object.keys(tonerCache).length > 0) {
              localStorage.setItem('cachedTonerData', JSON.stringify({
                data: tonerCache,
                timestamp: Date.now()
              }));
            }
          } catch (cacheErr) {
            console.warn('Failed to cache toner data:', cacheErr);
          }
        }
      }

      // 更新状态
      setPingResults(newPingResults);
      setBackendStatusData(newBackendStatus);

      // 缓存ping结果到localStorage，用于下次页面加载时的提前显示
      try {
        const cacheData = {
          results: newPingResults,
          timestamp: Date.now()
        };
        localStorage.setItem('cachedPingResults', JSON.stringify(cacheData));
      } catch (error) {
        console.warn('缓存ping结果失败:', error);
      }
    } catch (error) {
      console.error('Error fetching printer statuses from backend:', error);
    }
  }, [fetchWithAutoRefresh, setPingResults]);

  // Schedule regular ping for all printers and initial loading
  useEffect(() => {
    // Execute ping immediately on mount
    pingAllPrinters();
    
    // Set timer to execute ping every 30 seconds
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      pingAllPrinters();
    }, 30000);
    
    // Cleanup function to clear the timer
    return () => clearInterval(intervalId);
  }, [pingAllPrinters]);

  // Update printer status based on ping result - optimized with useMemo
  const updatedPrinters = useMemo(() => {
    return safePrinterStatuses.map(printer => {
      if (!printer || typeof printer !== 'object') return { id: `invalid_${Date.now()}`, name: 'Invalid Printer', status: 'unknown', ip: 'Unknown IP' };
      
      // Merge backend status data (printerErrors, pageCount)
      const backendData = printer.ip ? (backendStatusData[printer.ip] || {}) : {};
      
      // If ping result exists, update status with ping result
      if (printer.ip && pingResults[printer.ip] !== undefined) {
        const isOnline = pingResults[printer.ip];
        // Preserve backend status (Warning, Paper Jam, etc.) if printer is online
        let derivedStatus;
        if (!isOnline) {
          derivedStatus = 'offline';
        } else {
          const backendStatus = (backendData.status || '').toLowerCase();
          const specialStatuses = ['warning', 'paper jam', 'no paper', 'door open', 'error'];
          derivedStatus = specialStatuses.includes(backendStatus) ? backendData.status : 'online';
        }
        return {
          ...printer,
          status: derivedStatus,
          printerErrors: backendData.printerErrors || null,
          pageCount: backendData.pageCount || null,
          lastPingTime: new Date().toISOString()
        };
      }
      
      return { ...printer, printerErrors: backendData.printerErrors || null, pageCount: backendData.pageCount || null };
    });
  }, [safePrinterStatuses, pingResults, backendStatusData]);

  // Calculate status counts using useMemo for optimization
  const statusCount = useMemo(() => {
    const nonTest = updatedPrinters.filter(p => p && !p.isTest);
    return {
      online: nonTest.filter(p => p.status === 'online').length,
      offline: nonTest.filter(p => p.status === 'offline').length,
      warning: nonTest.filter(p => {
        const s = (p.status || '').toLowerCase();
        return ['warning', 'paper jam', 'no paper', 'door open'].includes(s);
      }).length,
      error: nonTest.filter(p => p.status === 'error').length,
      total: nonTest.length
    };
  }, [updatedPrinters]);

  const lowTonerCount = useMemo(() => {
    const threshold = 20;
    return updatedPrinters.filter(p => {
      if (!p || p.isTest) return false;
      const toner = p.actualTonerLevels || p.manualTonerLevels || {};
      return Object.values(toner).some(v => typeof v === 'number' && v > 0 && v < threshold);
    }).length;
  }, [updatedPrinters]);



  // Handle refresh - re-fetch SNMP data and update all printer toner levels
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch all printer statuses (includes SNMP toner data)
      await pingAllPrinters();
      
      console.log('Refresh completed: Printer status and SNMP toner data updated');
    } catch (error) {
      console.error('Error refreshing status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch printer status logs
  const fetchPrinterLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (logFilters.printerIp) params.set('printerIp', logFilters.printerIp);
      if (logFilters.event) params.set('event', logFilters.event);
      params.set('limit', '100');
      
      const currentToken = authContext.accessToken || authContext.state?.accessToken;
      const url = currentToken
        ? `${ENV_CONFIG.API_BASE_URL}/printers/logs?${params}`
        : `${ENV_CONFIG.API_BASE_URL}/status/printers/logs?${params}`;
      const headers = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
      let res = await fetch(url, { headers });
      // Fallback to public endpoint if auth fails
      if (!res.ok && currentToken) {
        res = await fetch(`${ENV_CONFIG.API_BASE_URL}/status/printers/logs?${params}`);
      }
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPrinterLogs(data.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch printer logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [logFilters, authContext]);

  const handleOpenPrinterLogs = () => {
    setLogsDialogOpen(true);
    fetchPrinterLogs();
  };

  // Render printer grid
  const renderPrinterGrid = () => {
    // Filter out test mode printers
    const nonTestPrinters = updatedPrinters.filter(printer => !printer.isTest);
    
    if (nonTestPrinters.length === 0) {
      return (
        <EmptyState
          icon={AddCircleOutline}
          title={t('statusDashboard.noPrintersConfigured')}
          description={t('statusDashboard.addPrintersHint')}
        />
      );
    }

    return (
        <Grid container spacing={0.5}>
          {nonTestPrinters.map((printer, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={printer.id || `printer-${index}`}>
              <PrinterCard
                printer={printer}
                index={index}
                tonerMethodsStatus={tonerMethodsStatus}
                handleTonerMethodRefresh={handleTonerMethodRefresh}
                handleUpdateTonerLevels={handleUpdateTonerLevels}
              />
            </Grid>
          ))}
        </Grid>
      );
  };



  // 渲染加载状态 - 用骨架屏代替全屏spinner
  if (loading && updatedPrinters.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <PrinterCardSkeleton count={8} />
      </Box>
    );
  }



  return (
    <div>

      {/* License information */}
      {licenseDays !== undefined && (
        <Paper sx={{ p: 1, bgcolor: 'var(--background-info-light)', borderLeft: '4px solid var(--info-color)', mb: 2 }}>
          <Typography variant="body2">
            {licenseDays >= 0
              ? t('statusDashboard.licenseValid', { days: licenseDays })
              : t('statusDashboard.licenseExpired')}
          </Typography>
        </Paper>
      )}

      {/* Smart summary line */}
      {statusCount.total > 0 && (
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'var(--background-highlight)', border: '1px solid var(--border-color)', borderRadius: 2 }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {statusCount.offline > 0
              ? `⚠️ ${statusCount.offline} ${statusCount.offline === 1 ? 'printer' : 'printers'} offline, ${statusCount.online} online`
              : statusCount.warning > 0
                ? `⚡ All ${statusCount.online} printers online, ${statusCount.warning} with warnings`
                : `✅ All ${statusCount.online} printers online and healthy`}
            {lowTonerCount > 0 && ` · 🔶 ${lowTonerCount} low toner`}
          </Typography>
        </Paper>
      )}

      {/* Status overview */}
      <Grid container spacing={1} mb={1}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ bgcolor: 'var(--background-success-light)', borderLeft: '4px solid var(--success-color)', color: 'var(--text-primary)' }}>
            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle1" sx={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {t('statusDashboard.status.online')}
                </Typography>
                <Typography variant="h5" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {statusCount.online}
                </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ bgcolor: 'var(--background-error-light)', borderLeft: '4px solid var(--error-color)', color: 'var(--text-primary)' }}>
            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle1" sx={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {t('statusDashboard.status.offline')}
                </Typography>
                <Typography variant="h5" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {statusCount.offline}
                </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ bgcolor: 'var(--background-warning-light)', borderLeft: '4px solid var(--warning-color)', color: 'var(--text-primary)' }}>
            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle1" sx={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {t('statusDashboard.status.warning')}
                </Typography>
                <Typography variant="h5" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {statusCount.warning}
                </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ bgcolor: 'var(--background-info-light)', borderLeft: '4px solid var(--info-color)', color: 'var(--text-primary)' }}>
            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 }, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="subtitle1" sx={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {t('statusDashboard.status.error')}
                </Typography>
                <Typography variant="h5" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {statusCount.error}
                </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>



      {/* Printer Monitoring */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Print fontSize="small" />
            {t('statusDashboard.printerMonitoring')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button size="small" startIcon={<Search />} onClick={handleOpenPrinterLogs} variant="outlined">
              {t('statusDashboard.logs')}
            </Button>
            <Button
              size="small"
              startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : <Refresh />}
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outlined"
            >
              {refreshing ? t('common.refreshing') : t('common.refresh')}
            </Button>
          </Box>
        </Box>
        {renderPrinterGrid()}
      </Paper>

      {/* Printer Logs Dialog */}
      <Dialog open={logsDialogOpen} onClose={() => setLogsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('statusDashboard.logsTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
            <TextField
              select
              size="small"
              label={t('statusDashboard.printer')}
              value={logFilters.printerIp}
              onChange={(e) => setLogFilters(prev => ({ ...prev, printerIp: e.target.value }))}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">{t('statusDashboard.allPrinters')}</MenuItem>
              {(printerStatuses || []).map(p => (
                <MenuItem key={p.ip} value={p.ip}>{p.name || p.ip}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t('statusDashboard.event')}
              value={logFilters.event}
              onChange={(e) => setLogFilters(prev => ({ ...prev, event: e.target.value }))}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">{t('statusDashboard.allEvents')}</MenuItem>
              <MenuItem value="offline">{t('common.offline')}</MenuItem>
              <MenuItem value="recovery">{t('printServerMonitoring.eventRecovery')}</MenuItem>
            </TextField>
            <Button variant="contained" size="small" onClick={fetchPrinterLogs} startIcon={<Search />}>
              {t('common.search')}
            </Button>
          </Box>
          {logsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('statusDashboard.time')}</TableCell>
                    <TableCell>{t('statusDashboard.printer')}</TableCell>
                    <TableCell>{t('statusDashboard.event')}</TableCell>
                    <TableCell>{t('statusDashboard.details')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {printerLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">{t('statusDashboard.noLogsFound')}</TableCell>
                    </TableRow>
                  ) : (
                    printerLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>{log.printerName || log.printerIp}</TableCell>
                        <TableCell>
                          <Chip
                            label={log.event}
                            size="small"
                            color={log.event === 'offline' ? 'error' : 'success'}
                          />
                        </TableCell>
                        <TableCell>
                          {log.event === 'recovery' && log.downtimeMs
                            ? t('statusDashboard.recoveredAfter', { min: Math.round(log.downtimeMs / 1000 / 60) })
                            : log.event === 'offline' ? t('statusDashboard.printerWentOffline') : ''}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Server Dashboard section removed */}
    </div>
  );
};

export default StatusDashboard;