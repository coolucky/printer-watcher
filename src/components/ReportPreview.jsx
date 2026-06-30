import React from 'react';
import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box, Button, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

// Color mapping
const COLOR_NAMES = {
  black: 'Black',
  cyan: 'Cyan',
  magenta: 'Magenta',
  yellow: 'Yellow'
};

// Check if toner needs alert (below 20%)
const isTonerAlert = (level) => {
  return level < 20 && level >= 0;
};

// Get all toner levels with color mapping and percentage
const getTonerLevels = (printer) => {
  // Priority: actualTonerLevels > tonerLevels
  const tonerLevels = printer.actualTonerLevels || printer.tonerLevels || {};
  if (!tonerLevels || typeof tonerLevels !== 'object') return {};
  
  // Convert to standardized format with valid percentages
  const standardizedLevels = {};
  for (const [color, level] of Object.entries(tonerLevels)) {
    // Ensure level is a number between 0-100
    const safeLevel = typeof level === 'number' ? Math.max(0, Math.min(100, level)) : parseInt(level) || 0;
    standardizedLevels[color] = safeLevel;
  }
  
  return standardizedLevels;
};

// Filter toner that needs alert - 优先从actualTonerLevels获取墨粉数据
const getAlertToners = (printer) => {
  // 优先使用actualTonerLevels，其次使用tonerLevels
  const tonerLevels = printer.actualTonerLevels || printer.tonerLevels || {};
  if (!tonerLevels || typeof tonerLevels !== 'object') return [];
  
  return Object.entries(tonerLevels)
      .filter(([, level]) => isTonerAlert(parseInt(level) || 0))
      .map(([color, level]) => `${COLOR_NAMES[color]}(${level}%)`);
};

// Format toner levels for display in the table
const formatTonerDisplay = (printer) => {
  const tonerLevels = getTonerLevels(printer);
  const alertToners = getAlertToners(printer);
  
  if (printer.status === 'offline') {
    return 'Offline';
  }
  
  if (alertToners.length > 0) {
    return `Alert(${alertToners.join(', ')})`;
  }
  
  // Check if any toner data is available
  if (Object.keys(tonerLevels).length > 0) {
    return 'Normal';
  }
  
  return 'N/A';
};

const ReportPreview = ({ formData = {}, printerStatuses = [], licenseDays = 0, onSendReport, isLoading = false }) => {
  // Submit form to send report directly from preview
  const handleSendReport = async () => {
    if (!onSendReport) {
      console.error('onSendReport function is not provided');
      return;
    }
    
    await onSendReport();
  };
  // Always use actual printer status data, filtering out test mode printers
  // 确保过滤逻辑正确执行，并且只处理有效的打印机对象
  const displayData = Array.isArray(printerStatuses) ? 
    printerStatuses.filter(printer => {
      // 确保打印机对象有效且不是测试模式
      const isValidPrinter = printer && typeof printer === 'object';
      const isTestMode = isValidPrinter && Boolean(printer.isTest);
      
      // 调试信息：打印每个打印机的名称和测试模式状态
      if (isValidPrinter && printer.name) {
        console.log(`Printer ${printer.name}, isTest: ${isTestMode}`);
      }
      
      // 只返回有效的非测试模式打印机
      return isValidPrinter && !isTestMode;
    }) : [];

  // Get current date as check date
  const checkDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).replace(/\//g, '/');



  // Get printer function status
  const getFunctionStatus = (printer) => {
    // In actual application, it should display based on real status, simplified logic is used for demonstration
    if (printer.status === 'offline') {
      return { printing: false, copy: false, scan: false, network: false };
    }
    return { printing: true, copy: true, scan: true, network: true };
  };

  // Get site name
  const getSiteName = (location) => {
    if (!location) return 'Unknown';
    // Infer site naming rules from Excel format
    if (location.includes('Beijing')) return 'Beijing CP Tower';
    if (location.includes('Shanghai')) return 'Shanghai Lumina Tower';
    if (location.includes('Shenzhen')) return 'Shenzhen Kerry Plaza';
    return location.split(' ')[0];
  };

  // Safely format date
  const formatDate = (date) => {
    if (!date) return 'Not set';
    if (date instanceof Date) return date.toLocaleDateString();
    if (typeof date === 'string') {
      try {
        return new Date(date).toLocaleDateString();
      } catch {
        return date;
      }
    }
    return 'Not set';
  };

  return (
    <Paper sx={{ p: 3, mt: 2, bgcolor: 'var(--background-paper)' }}>
      <Typography variant="h6" gutterBottom>Report Preview</Typography>
      
      {/* Report title */}
      <Typography variant="h5" component="h2" sx={{ textAlign: 'center', mb: 3, fontWeight: 'bold', color: '#1976d2' }}>
        Printer Status Weekly Report
      </Typography>
      
      {/* Basic report information */}
      <Box sx={{ mb: 3, p: 2, border: '1px solid var(--border-color)', borderRadius: 1, bgcolor: 'var(--background-highlight)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, color: '#1976d2' }}>Weekly Report Basic Information</Typography>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
          <div>
            <Typography variant="caption" color="text.secondary">Report Period</Typography>
            <Typography>
              {formatDate(formData?.startDate)} -
              {formatDate(formData?.endDate)}
            </Typography>
          </div>
          <div>
            <Typography variant="caption" color="text.secondary">Recipient</Typography>
            <Typography>{formData?.toEmail || 'Not set'}</Typography>
          </div>
          <div>
            <Typography variant="caption" color="text.secondary">Sender</Typography>
            <Typography>{formData?.fromEmail || 'Not set'}</Typography>
          </div>
          <div>
            <Typography variant="caption" color="text.secondary">Total Printer Count</Typography>
            <Typography>{Array.isArray(displayData) ? displayData.length : 0} units</Typography>
          </div>
        </div>
      </Box>

      {/* Printer status table - optimized according to Excel format */}
      <TableContainer component={Paper} sx={{ mb: 3, bgcolor: 'var(--background-highlight)', border: '1px solid var(--border-color)' }}>
        <Table aria-label="printer status table" size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'var(--background-table-header)' }}>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Site</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Serial Number</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Port Info</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>IP</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Location</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Status</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Print</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Copy</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Scan</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Toner</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Network</span></TableCell>
              <TableCell sx={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>Check Date</span></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(displayData) && displayData.map((printer, index) => {
              // Skip if printer is not an object
              if (!printer || typeof printer !== 'object') {
                return null;
              }
              
              // 修复：使用修改后的getAlertToners函数，传入完整的printer对象
              const alertToners = getAlertToners(printer);
              const hasAlert = alertToners.length > 0;
              const functionStatus = getFunctionStatus(printer);
              const siteName = getSiteName(printer.location);
              
              // Get status color
              const getStatusColor = (status) => {
                const colorMap = {
                  online: '#4caf50',
                  offline: '#f44336',
                  warning: '#ff9800',
                  error: '#f44336',
                  unknown: '#9e9e9e'
                };
                return colorMap[status] || colorMap.unknown;
              };

              // Get status label
              const getStatusLabel = (status) => {
                const labelMap = {
                  online: 'Online',
                  offline: 'Offline',
                  warning: 'Warning',
                  error: 'Error',
                  unknown: 'Unknown'
                };
                return labelMap[status] || labelMap.unknown;
              };

              // 与StatusDashboard组件保持一致的状态处理逻辑
              // 保留原始状态，不自动将unknown状态设为online，以便准确反映真实网络状态
              let status = printer.status || 'unknown';
              const statusColor = getStatusColor(status);
              const statusLabel = getStatusLabel(status);

              return (
                  <TableRow key={printer.ip || index}>
                    <TableCell sx={{ border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{siteName}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{printer.sn || 'N/A'}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{printer.port || 'N/A'}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{printer.ip || 'N/A'}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{printer.location || 'Unknown'}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', padding: '2px 4px' }}>
                      <div 
                        style={{
                          backgroundColor: statusColor,
                          color: 'white',
                          padding: '1px 3px',
                          borderRadius: '2px',
                          fontSize: '0.55rem',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          display: 'inline-block'
                        }}
                      >
                        {statusLabel}
                      </div>
                    </TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', textAlign: 'center', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{functionStatus.printing ? '✓' : '✗'}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', textAlign: 'center', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{functionStatus.copy ? '✓' : '✗'}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', textAlign: 'center', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{functionStatus.scan ? '✓' : '✗'}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', padding: '2px 4px' }}>{hasAlert ? (
                      <span style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '0.55rem' }}>
                        Alert({alertToners.join(', ')})
                      </span>
                    ) : <span style={{ fontSize: '0.6rem' }}>{formatTonerDisplay(printer)}</span>}</TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', textAlign: 'center', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{functionStatus.network ? '✓' : '✗'}</span></TableCell>
                    <TableCell sx={{ border: '1px solid #ddd', padding: '2px 4px' }}><span style={{ fontSize: '0.6rem' }}>{checkDate}</span></TableCell>
                  </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* License information - optimized according to Excel format */}
      <Box sx={{ p: 2, border: '1px solid var(--border-color)', bgcolor: 'var(--background-success-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'var(--background-license-item)', color: 'white', padding: '5px 10px', minWidth: '150px' }}>
            <Typography variant="subtitle2" fontWeight="bold">PaperCut License Remaining Days</Typography>
          </div>
          <div style={{ marginLeft: '10px', padding: '5px 10px', backgroundColor: 'var(--background-license-value)', color: 'var(--text-primary)', minWidth: '100px' }}>
            <Typography variant="subtitle2" fontWeight="bold">{licenseDays} days</Typography>
          </div>
        </div>
      </Box>

      {/* Send Report Button */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', p: 2, bgcolor: 'var(--background-highlight)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SendIcon />}
          onClick={handleSendReport}
          disabled={isLoading}
        >
          {isLoading ? (
            <CircularProgress size={16} />
          ) : (
            'Send Report via Email'
          )}
        </Button>
      </Box>
    </Paper>
  );
};

export default ReportPreview;