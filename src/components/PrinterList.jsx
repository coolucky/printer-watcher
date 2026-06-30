import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Paper, Tooltip, Menu, MenuItem, Switch } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, History as HistoryIcon, DragIndicator as DragIndicatorIcon, Print as PrintIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// 导入历史数据服务
import * as historyDataService from '../services/historyDataService';

const PrinterList = ({ printers, onAddPrinter, onUpdatePrinter, onDeletePrinter, onReorderPrinters, currentUser }) => {
  const { t } = useTranslation();
  
  // 检查用户是否有编辑权限（只有 Administrator 和 Editor 可以编辑）
  const canEdit = currentUser && (currentUser.role === 'Administrator' || currentUser.role === 'Editor' || currentUser.role === 'admin' || currentUser.role === 'editor');
  // 初始化历史记录状态
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyMenuAnchor, setHistoryMenuAnchor] = useState(null);
  const [confirmRestoreDialogOpen, setConfirmRestoreDialogOpen] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState(null);

  // 初始化历史记录数据并从统一数据源加载
  useEffect(() => {
    try {
      // 首先初始化历史记录数据，确保从JSON文件同步到localStorage
      historyDataService.initializeHistoryData();
      
      // 然后从统一数据源加载历史记录
      const savedHistory = historyDataService.loadHistory();
      if (savedHistory && Array.isArray(savedHistory)) {
        setHistoryRecords(savedHistory);
        console.log('Successfully loaded printer history from unified source');
      }
    } catch (error) {
      console.error('Failed to initialize or load printer history:', error);
    }
  }, []);

  // 创建历史记录
  const createHistoryRecord = (description) => {
    try {
      const record = historyDataService.addHistoryRecord(description, printers);
      if (record) {
        const updatedHistory = historyDataService.loadHistory();
        if (updatedHistory && Array.isArray(updatedHistory)) {
          setHistoryRecords(updatedHistory);
        }
      }
    } catch (error) {
      console.error('Exception in createHistoryRecord:', error);
    }
  };

  // 恢复历史记录
  const restoreHistoryRecord = (record) => {
    setSelectedHistoryRecord(record);
    setConfirmRestoreDialogOpen(true);
  };

  // 确认恢复历史记录
  const confirmRestoreHistory = () => {
    if (selectedHistoryRecord) {
      try {
        // 恢复前先保存当前状态，以便撤销
        createHistoryRecord(`Before restore (backup)`);
        
        let updatedCount = 0;
        let addedCount = 0;
        
        // 遍历历史记录中的打印机数据
        selectedHistoryRecord.data.forEach(historyPrinter => {
          const existingIndex = printers.findIndex(p => p.name === historyPrinter.name);
          
          if (existingIndex >= 0) {
            onUpdatePrinter(existingIndex, historyPrinter);
            updatedCount++;
          } else {
            onAddPrinter(historyPrinter);
            addedCount++;
          }
        });
        
        createHistoryRecord(`Restored from ${new Date(selectedHistoryRecord.timestamp).toLocaleString()}`);
      } catch (error) {
        console.error('Failed to restore history:', error);
      } finally {
        setConfirmRestoreDialogOpen(false);
        setSelectedHistoryRecord(null);
        setHistoryMenuAnchor(null);
      }
    }
  };

  // 处理历史菜单点击
  const handleHistoryClick = (event) => {
    setHistoryMenuAnchor(event.currentTarget);
  };

  // 关闭历史菜单
  const handleHistoryClose = () => {
    setHistoryMenuAnchor(null);
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPrinter, setCurrentPrinter] = useState({ 
    name: '', 
    ip: '', 
    serialNumber: '', 
    port: '', 
    location: '',
    macAddress: '',
    assetTag: '',
    model: '',
    isTest: false,
    manualTonerLevels: {
      black: 0,
      cyan: 0,
      magenta: 0,
      yellow: 0
    }
  });
  const [editIndex, setEditIndex] = useState(-1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(-1);
  const [errors, setErrors] = useState({});
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggedElement, setDraggedElement] = useState(null);

  // Handle drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    setDraggedElement(printers[index]);
    // Set data transfer effect to allow moving
    e.dataTransfer.effectAllowed = 'move';
    // Add a delay to prevent the default selection behavior
    setTimeout(() => {
      if (e.currentTarget) {
        e.currentTarget.style.opacity = '0.5';
      }
    }, 0);
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
    return false;
  };

  // Handle drag enter
  const handleDragEnter = (e) => {
    e.preventDefault();
    return false;
  };

  // Handle drag leave
  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only reset dragOverIndex if we're leaving the row
    setDragOverIndex(null);
    return false;
  };

  // Handle drop
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset styles
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
    }
    
    // If the item is dropped on itself, do nothing
    if (draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDraggedElement(null);
      return;
    }
    
    // Create a new array to hold the reordered printers
    const newPrinters = [...printers];
    
    // Remove the dragged item from its original position
    newPrinters.splice(draggedIndex, 1);
    
    // Insert the dragged item at the new position
    newPrinters.splice(dropIndex, 0, draggedElement);
    
    // Update the order
    if (onReorderPrinters) {
      onReorderPrinters(newPrinters);
    }
    
    // Reset drag state
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDraggedElement(null);
    
    return false;
  };

  // Handle drag end
  const handleDragEnd = () => {
    // Reset styles for all rows
    const rows = document.querySelectorAll('[data-draggable="true"]');
    rows.forEach(row => {
      row.style.opacity = '1';
      row.style.backgroundColor = '';
    });
    
    // Reset drag state
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDraggedElement(null);
  };

  // Open add dialog
  const handleAddClick = () => {
    setCurrentPrinter({ 
      name: '', 
      ip: '', 
      serialNumber: '', 
      port: '', 
      location: '',
      macAddress: '',
      assetTag: '',
      model: '',
      manualTonerLevels: {
        black: 0,
        cyan: 0,
        magenta: 0,
        yellow: 0
      }
    });
    setEditIndex(-1);
    setErrors({});
    setDialogOpen(true);
  };

  // Open edit dialog
  const handleEditClick = (index) => {
    setCurrentPrinter({ 
      ...printers[index],
      // Ensure new fields exist
      serialNumber: printers[index].serialNumber || '',
      port: printers[index].port || '',
      location: printers[index].location || '',
      macAddress: printers[index].macAddress || '',
      assetTag: printers[index].assetTag || '',
      model: printers[index].model || '',
      isTest: printers[index].isTest || false,
      manualTonerLevels: printers[index].manualTonerLevels || {
        black: 0,
        cyan: 0,
        magenta: 0,
        yellow: 0
      }
    });
    setEditIndex(index);
    setErrors({});
    setDialogOpen(true);
  };

  // Open delete confirmation dialog
  const handleDeleteClick = (index) => {
    setDeleteIndex(index);
    setDeleteDialogOpen(true);
  };

  // Close dialog
  const handleDialogClose = () => {
    setDialogOpen(false);
    setCurrentPrinter({ name: '', ip: '', serialNumber: '', port: '', location: '' });
    setEditIndex(-1);
    setErrors({});
  };

  // Close delete dialog
  const handleDeleteDialogClose = () => {
    setDeleteDialogOpen(false);
    setDeleteIndex(-1);
  };

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Handle nested manualTonerLevels fields
    if (name.startsWith('toner_')) {
      const tonerColor = name.replace('toner_', '');
      // 允许空值，但在提交时会默认为0
      const parsedValue = value === '' ? '' : parseInt(value) || 0;
      setCurrentPrinter(prev => ({
        ...prev,
        manualTonerLevels: {
          ...(prev.manualTonerLevels || {}),
          [tonerColor]: parsedValue
        }
      }));
      
      // Clear error for toner field
      if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
    } else {
      // For port field, convert to number if value is not empty
      const processedValue = name === 'port' && value !== '' ? Number(value) : value;
      
      // 修改箭头函数，将日志放在内部以访问prev变量
      setCurrentPrinter(prev => {
        const newState = { ...prev, [name]: processedValue };
        // 添加更详细的日志，记录字段变化
        console.log(`字段${name}变化: 原值=${prev[name]}, 新值=${processedValue}, 类型=${typeof processedValue}`);
        console.log('当前完整状态:', newState);
        return newState;
      });

      // Simple validation
      if (value.trim() === '') {
        setErrors(prev => ({ ...prev, [name]: `${name === 'name' ? 'Name' : name === 'ip' ? 'IP address' : name === 'serialNumber' ? 'Serial Number' : name === 'port' ? 'Port' : 'Location'} cannot be empty` }));
      } else if (name === 'ip' && !validateIp(value)) {
        setErrors(prev => ({ ...prev, ip: 'Please enter a valid IP address' }));
      } else if (name === 'port' && (isNaN(value) || value < 1 || value > 65535)) {
        setErrors(prev => ({ ...prev, port: 'Please enter a valid port number (1-65535)' }));
      } else {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
    }
  };

  // Validate IP address format
  const validateIp = (ip) => {
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    return ipRegex.test(ip);
  };

  // Save printer configuration
  // Save printer (add or update) - 修改为异步函数，确保等待操作完成后再创建历史记录
  const handleSavePrinter = async () => {
    const newErrors = {};

    if (!currentPrinter.name.trim()) {
      newErrors.name = 'Name cannot be empty';
    }
    if (!currentPrinter.ip.trim()) {
      newErrors.ip = 'IP address cannot be empty';
    } else if (!validateIp(currentPrinter.ip)) {
      newErrors.ip = 'Please enter a valid IP address';
    }
    if (currentPrinter.port && (isNaN(currentPrinter.port) || currentPrinter.port < 1 || currentPrinter.port > 65535)) {
      newErrors.port = 'Please enter a valid port number (1-65535)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 添加日志，查看当前准备发送的数据
    console.log('准备更新打印机数据:', currentPrinter);
    console.log('编辑索引:', editIndex);
    console.log('包含的字段:', Object.keys(currentPrinter));

    try {
      // 确保正确调用onUpdatePrinter或onAddPrinter，并等待操作完成
      if (editIndex >= 0) {
        console.log('调用onUpdatePrinter，索引:', editIndex, '数据:', currentPrinter);
        await onUpdatePrinter(editIndex, currentPrinter);
      } else {
        console.log('调用onAddPrinter，数据:', currentPrinter);
        await onAddPrinter(currentPrinter);
      }
      
      // 等待操作完成后，根据操作类型创建历史记录
      console.log('操作完成，创建历史记录...');
      if (editIndex >= 0) {
        createHistoryRecord(`Edited printer: ${currentPrinter.name}`);
      } else {
        createHistoryRecord(`Added printer: ${currentPrinter.name}`);
      }

      handleDialogClose();
    } catch (error) {
      console.error('保存打印机失败:', error);
      // 即使失败也可以考虑创建历史记录，记录尝试操作
      if (editIndex >= 0) {
        createHistoryRecord(`Failed to edit printer: ${currentPrinter.name}`);
      } else {
        createHistoryRecord(`Failed to add printer: ${currentPrinter.name}`);
      }
    }
  };

  // Confirm delete printer - 修改为异步函数，确保等待操作完成后再创建历史记录
  const handleConfirmDelete = async () => {
    if (deleteIndex >= 0) {
      try {
        const deletedPrinter = printers[deleteIndex];
        console.log('调用onDeletePrinter，索引:', deleteIndex);
        await onDeletePrinter(deleteIndex);
        
        // 等待删除操作完成后创建历史记录
        console.log('删除操作完成，创建历史记录...');
        createHistoryRecord(`Deleted printer: ${deletedPrinter?.name || 'Unknown Printer'}`);
      } catch (error) {
        console.error('删除打印机失败:', error);
        // 即使失败也记录尝试操作
        const printerName = printers[deleteIndex]?.name || 'Unknown Printer';
        createHistoryRecord(`Failed to delete printer: ${printerName}`);
      }
    }
    handleDeleteDialogClose();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrintIcon fontSize="small" />
          {t('printerManagement.title')}
        </Typography>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 历史数据恢复按钮 */}
          <Tooltip title={`History (${historyRecords.length}/${historyDataService.MAX_HISTORY_RECORDS})`}>
            <IconButton
              sx={{ backgroundColor: '#7986cb', color: 'white', '&:hover': { backgroundColor: '#5c6bc0' } }}
              onClick={handleHistoryClick}
            >
              <HistoryIcon />
            </IconButton>
          </Tooltip>
          
          {/* 历史数据下拉菜单 */}
          <Menu
            anchorEl={historyMenuAnchor}
            open={Boolean(historyMenuAnchor)}
            onClose={handleHistoryClose}
            sx={{ '& .MuiPaper-root': { bgcolor: 'var(--background-paper)' } }}
          >
            {historyRecords.length === 0 ? (
              <MenuItem disabled>No historical data available</MenuItem>
            ) : (
              historyRecords.map((record) => (
                <MenuItem key={record.id} onClick={() => restoreHistoryRecord(record)}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', width: '300px' }}>
                    <Typography variant="body1">{record.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(record.timestamp).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {record.data.length} printers
                    </Typography>
                  </Box>
                </MenuItem>
              ))
            )}
          </Menu>

          {/* 添加打印机按钮 */}
          <Tooltip title={!canEdit ? (t('common.insufficientPermissions') || 'Only Administrators and Editors can add printers') : t('printerManagement.addPrinterTooltip')}>
            <span>
              <Button
                variant="contained"
                sx={{ backgroundColor: 'var(--primary-color)', '&:hover': { backgroundColor: 'var(--primary-hover)' } }}
                startIcon={<AddIcon />}
                onClick={handleAddClick}
                disabled={!canEdit}
              >
                {t('printerManagement.addPrinter')}
              </Button>
            </span>
          </Tooltip>
        </div>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 2, bgcolor: 'var(--background-paper)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.index')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.printerName')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.ipAddress')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.serialNumber')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.macAddress')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.port')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.location')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.assetTag')}</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', padding: '6px 6px' }}>{t('printerManagement.model')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('printerManagement.maintenance')}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px' }}>{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {printers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  {t('printerManagement.noPrintersYet')}
                </TableCell>
              </TableRow>
            ) : (
              printers.map((printer, index) => (
                <TableRow 
                  key={index} 
                  hover
                  data-draggable="true"
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnter={handleDragEnter}
                  onDragLeave={(e) => handleDragLeave(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  sx={{
                    opacity: draggedIndex === index ? 0.5 : 1,
                    backgroundColor: dragOverIndex === index ? 'rgba(95, 108, 255, 0.1)' : 'inherit',
                    cursor: 'grab',
                    '&:active': {
                      cursor: 'grabbing'
                    }
                  }}
                >
                  <TableCell sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' }, fontSize: '0.8125rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <DragIndicatorIcon size="small" color="action" />
                      {index + 1}
                    </div>
                  </TableCell>
                  <Tooltip title={printer.name || ''} arrow enterDelay={500}><TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>{printer.name}</TableCell></Tooltip>
                  <Tooltip title={printer.ip || ''} arrow enterDelay={500}><TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>{printer.ip}</TableCell></Tooltip>
                  <Tooltip title={printer.serialNumber || '-'} arrow enterDelay={500}><TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>{printer.serialNumber || '-'}</TableCell></Tooltip>
                  <Tooltip title={printer.macAddress || '-'} arrow enterDelay={500}><TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>{printer.macAddress || '-'}</TableCell></Tooltip>
                  <Tooltip title={printer.port || '-'} arrow enterDelay={500}><TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55px' }}>{printer.port || '-'}</TableCell></Tooltip>
                  <Tooltip title={printer.location || '-'} arrow enterDelay={500}><TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>{printer.location || '-'}</TableCell></Tooltip>
                  <Tooltip title={printer.assetTag || '-'} arrow enterDelay={500}><TableCell sx={{ fontSize: '0.8125rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70px' }}>{printer.assetTag || '-'}</TableCell></Tooltip>
                  <Tooltip title={printer.model || '-'} arrow enterDelay={500}><TableCell sx={{ fontSize: '0.75rem', padding: '6px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{printer.model || '-'}</TableCell></Tooltip>
                  <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    <Tooltip title={t('printerManagement.enableMaintenanceTooltip')} arrow>
                      <Switch 
                        checked={printer.isTest || false} 
                        onChange={(e) => {
                          const updatedPrinter = { ...printer, isTest: e.target.checked };
                          onUpdatePrinter(index, updatedPrinter);
                        }}
                        color="warning"
                        size="small"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8125rem', padding: '6px 4px', whiteSpace: 'nowrap' }}>
                    <Tooltip title={t('printerManagement.editTooltip')}>
                      <IconButton onClick={() => handleEditClick(index)} size="small" sx={{ mr: 1, padding: '2px' }} aria-label={`Edit ${printer.name}`} disabled={!canEdit}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('printerManagement.deleteTooltip')}>
                      <IconButton onClick={() => handleDeleteClick(index)} size="small" color="error" sx={{ padding: '2px' }} aria-label={`Delete ${printer.name}`} disabled={!canEdit}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth sx={{ '& .MuiPaper-root': { bgcolor: 'var(--background-paper)' } }}>
        <DialogTitle>
          {editIndex >= 0 ? t('printerManagement.editPrinter') : t('printerManagement.addNewPrinter')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('printerManagement.printerName')}
              name="name"
              value={currentPrinter.name}
              onChange={handleInputChange}
              fullWidth
              error={!!errors.name}
              helperText={errors.name}
              required
            />
            <TextField
              label={t('printerManagement.ipAddress')}
              name="ip"
              value={currentPrinter.ip}
              onChange={handleInputChange}
              fullWidth
              error={!!errors.ip}
              helperText={errors.ip || 'e.g. 192.168.1.101'}
              required
              placeholder="xxx.xxx.xxx.xxx"
            />
            <TextField
              label={t('printerManagement.serialNumber')}
              name="serialNumber"
              value={currentPrinter.serialNumber}
              onChange={handleInputChange}
              fullWidth
              error={!!errors.serialNumber}
              helperText={errors.serialNumber}
            />
            <TextField
              label={t('printerManagement.networkPort')}
              name="port"
              value={currentPrinter.port}
              onChange={handleInputChange}
              fullWidth
              error={!!errors.port}
              helperText={errors.port}
              type="number"
              inputProps={{ min: 1, max: 65535 }}
            />
            <TextField
                label={t('printerManagement.location')}
                name="location"
                value={currentPrinter.location}
                onChange={handleInputChange}
                fullWidth
                error={!!errors.location}
                helperText={errors.location}
              />
            <TextField
              label={t('printerManagement.macAddress')}
              name="macAddress"
              value={currentPrinter.macAddress}
              onChange={handleInputChange}
              fullWidth
              placeholder={t('printerManagement.macAddressPlaceholder')}
            />
            <TextField
              label={t('printerManagement.assetTag')}
              name="assetTag"
              value={currentPrinter.assetTag}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label={t('printerManagement.model')}
              name="model"
              value={currentPrinter.model}
              onChange={handleInputChange}
              fullWidth
            />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                <Typography>{t('printerManagement.maintenanceMode')}</Typography>
                <Switch
                  checked={currentPrinter.isTest || false}
                  onChange={(e) => setCurrentPrinter(prev => ({ ...prev, isTest: e.target.checked }))}
                  color="warning"
                />
                <Typography variant="caption" color="text.secondary">
                  {t('printerManagement.maintenanceDescription')}
                </Typography>
              </Box>
            

          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSavePrinter} variant="contained" color="primary">
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteDialogClose} sx={{ '& .MuiPaper-root': { bgcolor: 'var(--background-paper)' } }}>
        <DialogTitle>{t('printerManagement.confirmDeletion')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('printerManagement.deleteConfirmation')}
          </Typography>
          {deleteIndex >= 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Printer: {printers[deleteIndex].name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteDialogClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 历史数据恢复确认对话框 */}
      <Dialog open={confirmRestoreDialogOpen} onClose={() => {
        setConfirmRestoreDialogOpen(false);
        setSelectedHistoryRecord(null);
      }} sx={{ '& .MuiPaper-root': { bgcolor: 'var(--background-paper)' } }}>
        <DialogTitle>Confirm Restore History</DialogTitle>
        <DialogContent>
          {selectedHistoryRecord && (
            <Box>
              <Typography variant="body1" mb={2}>
                Are you sure you want to restore the following historical data?
              </Typography>
              <Typography variant="subtitle1">
                {selectedHistoryRecord.description}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Date: {new Date(selectedHistoryRecord.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Number of printers: {selectedHistoryRecord.data.length}
              </Typography>
              <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                Warning: Restoring will replace all current printer configurations.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setConfirmRestoreDialogOpen(false);
            setSelectedHistoryRecord(null);
          }}>
            Cancel
          </Button>
          <Button onClick={confirmRestoreHistory} variant="contained" color="primary">
            Restore
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrinterList;
