import React, { useState, useEffect, useCallback } from 'react';
// Import data backup utilities
// fetchServerData import removed as it's not used
import { autoBackupData, exportServerData, importServerData } from '../utils/dataBackupUtils';
import { Box, Typography, Paper, Grid, Card, CardContent, Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton } from '@mui/material';
import { Settings, Check, X, Info } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Print Server Dashboard Component
const PrintServerDashboard = () => {
  const { t } = useTranslation();
  // State Management
  const [servers, setServers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingServer, setEditingServer] = useState(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [serverLoadingStates, setServerLoadingStates] = useState({}); // Manage loading state separately for each server

  // Load server data from API
  const fetchServerData = useCallback(async () => {
    // Set loading state for each server
    setServerLoadingStates(() => {
      const newStates = {};
      servers.forEach(server => {
        newStates[server.id] = true;
      });
      return newStates;
    });
    try {
      // First load all user-saved server data from localStorage
      const savedServers = localStorage.getItem('printServers');
      let userServers = [];
      
      if (savedServers) {
        try {
          userServers = JSON.parse(savedServers);
          if (!Array.isArray(userServers)) {
            userServers = [];
          }
        } catch (e) {
          console.error('Failed to parse saved servers:', e);
        }
      }
      
      // Then try to get metrics data for the local server from API
      try {
        const response = await fetch('/api/server-metrics');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Only update metrics for the local server, not other servers
            setServers(prevServers => {
              const updatedServers = [...prevServers];
              const localServerIndex = updatedServers.findIndex(server => server.id === 'local');
              
              if (localServerIndex >= 0) {
                // Update existing local server metrics
                updatedServers[localServerIndex] = {
                  ...updatedServers[localServerIndex],
                  cpuUsage: data.data.cpuUsage,
                  memoryUsage: data.data.memoryUsage,
                  diskSpace: data.data.diskSpace,
                  uptime: data.data.uptime,
                  lastUpdated: new Date().toISOString()
                };
              } else if (prevServers.length === 0) {
                // If no servers and initial load, add local server
                updatedServers.push({
                  id: 'local',
                  name: 'Local Server',
                  ip: 'localhost',
                  domain: 'localhost',
                  status: 'online',
                  cpuUsage: data.data.cpuUsage,
                  memoryUsage: data.data.memoryUsage,
                  diskSpace: data.data.diskSpace,
                  uptime: data.data.uptime,
                  connectedPrinters: 0,
                  lastUpdated: new Date().toISOString()
                });
              }
              return updatedServers;
            });
          }
        } else {
          // API call returned non-OK status code, set local server resource usage to unknown
          setServers(prevServers => {
            const updatedServers = [...prevServers];
            const localServerIndex = updatedServers.findIndex(server => server.id === 'local');
            
            if (localServerIndex >= 0) {
              updatedServers[localServerIndex] = {
                ...updatedServers[localServerIndex],
                status: 'error',
                cpuUsage: 'unknown',
                memoryUsage: 'unknown',
                diskSpace: 'unknown',
                uptime: 'unknown',
                lastUpdated: new Date().toISOString()
              };
            } else if (prevServers.length === 0) {
                // If no servers and initial load, add local server with unknown values
              updatedServers.push({
                id: 'local',
                name: 'Local Server',
                ip: 'localhost',
                domain: 'localhost',
                status: 'error',
                cpuUsage: 'unknown',
                memoryUsage: 'unknown',
                diskSpace: 'unknown',
                uptime: 'unknown',
                connectedPrinters: 0,
                lastUpdated: new Date().toISOString()
              });
            }
            return updatedServers;
          });
        }
      } catch (apiError) {
        console.error('Failed to fetch API server metrics:', apiError);
        // API调用异常，将本地服务器资源占用率设置为unknown
        setServers(prevServers => {
          const updatedServers = [...prevServers];
          const localServerIndex = updatedServers.findIndex(server => server.id === 'local');
          
          if (localServerIndex >= 0) {
            updatedServers[localServerIndex] = {
              ...updatedServers[localServerIndex],
              status: 'error',
              cpuUsage: 'unknown',
              memoryUsage: 'unknown',
              diskSpace: 'unknown',
              uptime: 'unknown',
              lastUpdated: new Date().toISOString()
            };
          } else if (prevServers.length === 0) {
            // 如果没有服务器且是初始加载，添加本地服务器但使用unknown值
            updatedServers.push({
              id: 'local',
              name: 'Local Server',
              ip: 'localhost',
              domain: 'localhost',
              status: 'error',
              cpuUsage: 'unknown',
              memoryUsage: 'unknown',
              diskSpace: 'unknown',
              uptime: 'unknown',
              connectedPrinters: 0,
              lastUpdated: new Date().toISOString()
            });
          }
          return updatedServers;
        });
      }
      
      // 为用户添加的每台远程服务器单独获取真实指标数据
      // 只更新变化的数值，不重新渲染整个列表
      await Promise.all(
        userServers.map(async (server) => {
          // 跳过本地服务器和已经是localhost的服务器
          if (server.ip === 'localhost' || server.ip === '127.0.0.1') {
            return;
          }
          
          try {
            // 设置该服务器为加载状态
            setServerLoadingStates(prev => ({ ...prev, [server.id]: true }));
            
            // 调用远程服务器指标API
            const response = await fetch(`/api/remote-server-metrics/${server.ip}`);
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data) {
                // 只更新这台服务器的指标，不影响其他服务器
                setServers(prevServers => 
                  prevServers.map(s => 
                    s.id === server.id 
                      ? {
                          ...s,
                          status: data.data.status || s.status,
                          cpuUsage: data.data.cpuUsage || s.cpuUsage,
                          memoryUsage: data.data.memoryUsage || s.memoryUsage,
                          diskSpace: data.data.diskSpace || s.diskSpace,
                          uptime: data.data.uptime || s.uptime,
                          lastUpdated: new Date().toISOString()
                        } 
                      : s
                  )
                );
              }
            }
          } catch (error) {
            console.error(`Failed to fetch metrics for server ${server.ip}:`, error);
            // 如果获取失败，更新状态为error，并将资源占用率设置为'unknown'
            setServers(prevServers => 
              prevServers.map(s => 
                s.id === server.id 
                  ? { 
                      ...s, 
                      status: 'error', 
                      cpuUsage: 'unknown',
                      memoryUsage: 'unknown',
                      diskSpace: 'unknown',
                      uptime: 'unknown',
                      lastUpdated: new Date().toISOString() 
                    } 
                  : s
              )
            );
          } finally {
            // 取消该服务器的加载状态
            setServerLoadingStates(prev => ({ ...prev, [server.id]: false }));
          }
        })
      );
      
      // 如果API调用失败或没有数据，使用用户保存的数据
      if (userServers.length > 0) {
        setServers(userServers);
      } else {
        // 如果用户没有保存的数据，添加默认服务器但使用unknown值而不是模拟数据
        const defaultServers = [
          {
            id: '1',
            name: 'Main Print Server',
            ip: '192.168.1.100',
            domain: 'print-server.company.com',
            status: 'error', // 默认显示为错误状态，因为没有实际数据
            cpuUsage: 'unknown',
            memoryUsage: 'unknown',
            diskSpace: 'unknown',
            uptime: 'unknown',
            connectedPrinters: 0,
            lastUpdated: new Date().toISOString()
          }
        ];
        setServers(defaultServers);
      }
    } catch (error) {
      console.error('Failed to load server data:', error);
      // 出错时也尝试加载localStorage中的数据
      const savedServers = localStorage.getItem('printServers');
      if (savedServers) {
        try {
          const parsedServers = JSON.parse(savedServers);
          setServers(Array.isArray(parsedServers) ? parsedServers : []);
        } catch (e) {
          console.error('Failed to parse saved servers:', e);
        }
      }
    } finally {
      setInitialLoading(false);
    }
  }, [servers]);

    // 保存服务器数据到localStorage
  useEffect(() => {
    if (servers.length > 0) {
      try {
        localStorage.setItem('printServers', JSON.stringify(servers));
      } catch (err) {
        console.error('Failed to save server data:', err);
      }
    }
  }, [servers]);

  // 从API刷新服务器指标数据
    const refreshServerMetrics = useCallback(async () => {
    setServerLoadingStates(() => {
      const newStates = {};
      servers.forEach(server => {
        newStates[server.id] = true;
      });
      return newStates;
    });
    try {
      await fetchServerData();
    } catch (err) {
      console.error('Failed to refresh server metrics:', err);
    } finally {
      // Clear loading states after refresh
      setServerLoadingStates(prev => {
        const newStates = { ...prev };
        servers.forEach(server => {
          newStates[server.id] = false;
        });
        return newStates;
      });
    }
  }, [servers, fetchServerData]);

    // 定时从API刷新服务器指标
  useEffect(() => {
    const interval = setInterval(refreshServerMetrics, 30000); // 每30秒刷新一次
    return () => clearInterval(interval);
  }, [refreshServerMetrics]);

  // 初始化加载数据
  useEffect(() => {
    fetchServerData();
  }, [fetchServerData]);

  // 打开配置对话框
  const handleOpenConfig = (server = null) => {
    setEditingServer(server || {
      name: '',
      ip: '',
      domain: ''
    });
    setConfigDialogOpen(true);
  };

  // Close configuration dialog
  const handleCloseConfig = () => {
    setConfigDialogOpen(false);
    setEditingServer(null);
  };

  // Save server configuration
  const handleSaveServer = () => {
    if (!editingServer.name || !editingServer.ip) {
      return; // Basic validation
    }

    if (editingServer.id) {
      // 更新现有服务器
      setServers(prevServers => 
        prevServers.map(server => 
          server.id === editingServer.id ? editingServer : server
        )
      );
    } else {
      // 添加新服务器
      const newServer = {
        ...editingServer,
        id: Date.now().toString(),
        status: 'online',
        cpuUsage: Math.floor(Math.random() * 50) + 20, // Random 20-70%
        memoryUsage: Math.floor(Math.random() * 50) + 20, // Random 20-70%
        diskSpace: Math.floor(Math.random() * 40) + 60, // Random 60-100%
        uptime: '0d 0h 5m',
        connectedPrinters: 0,
        lastUpdated: new Date().toISOString()
      };
      setServers(prevServers => [...prevServers, newServer]);
    }

    handleCloseConfig();
    
    // After data update, delay backup slightly to ensure localStorage is updated
    setTimeout(() => {
      autoBackupData();
      console.log('Server data saved and automatically backed up');
    }, 100);
  };

  // 删除服务器
  const handleDeleteServer = (serverId) => {
    const updatedServers = servers.filter(server => server.id !== serverId);
    setServers(updatedServers);
    
    // 立即更新localStorage以防止数据恢复
    try {
      localStorage.setItem('printServers', JSON.stringify(updatedServers));
      console.log('服务器已从localStorage中删除');
    } catch (error) {
      console.error('Failed to update localStorage after deletion:', error);
    }
    
    // 数据删除后也执行备份
    setTimeout(() => {
      autoBackupData();
      console.log('服务器数据已删除并自动备份');
    }, 100);
  };

  // 导入/导出相关状态
  const [showDataToolsDialog, setShowDataToolsDialog] = useState(false);

  // 处理文件导入
  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      importServerData(file)
        .then(() => {
          // 导入成功后重新加载数据
          fetchServerData();
          setShowDataToolsDialog(false);
          // 清空文件输入
          event.target.value = '';
        })
        .catch(error => {
          console.error('导入数据失败:', error);
          alert('导入数据失败: ' + error.message);
        });
    }
  };

  // 获取状态颜色
  const getStatusColor = (status) => {
    const colorMap = {
      online: '#4caf50',
      offline: '#f44336',
      warning: '#ff9800',
      error: '#f44336'
    };
    return colorMap[status] || '#9e9e9e';
  };

  // 获取指标颜色
  const getMetricColor = (value, type) => {
    // 如果值为unknown，返回次要文本颜色
    if (value === 'unknown') return 'var(--text-secondary)';
    
    if (type === 'diskSpace') {
      // 磁盘空间: 空间越多越好
      if (value > 70) return '#4caf50';
      if (value > 40) return '#ff9800';
      return '#f44336';
    } else {
      // CPU和内存: 使用率越低越好
      if (value < 60) return '#4caf50';
      if (value < 80) return '#ff9800';
      return '#f44336';
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  // 渲染服务器卡片
  const renderServerCard = (server) => {
    const statusColor = getStatusColor(server.status);

    return (
      <Card
        key={server.id}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: `4px solid ${statusColor}`,
          bgcolor: 'var(--background-paper)',
          color: 'var(--text-primary)',
          boxSizing: 'border-box'
        }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5} gap="8px">
            <div style={{ flex: 1 }}>
              <Typography variant="subtitle2" component="div" noWrap>
                {server.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {server.ip} | {server.domain}
              </Typography>
            </div>
            <div
              style={{
                backgroundColor: statusColor,
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
            >
              {server.status.toUpperCase()}
            </div>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* 服务器指标 */}
          <div style={{ marginBottom: '10px' }}>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
              Updated: {formatDate(server.lastUpdated)}
            </Typography>
          </div>

          {/* 性能指标卡片 - 横向拉满布局 */}
          <Grid container style={{ marginBottom: '0px' }}>
            <Grid size={12} style={{ padding: '0px' }}>
              <div style={{ backgroundColor: 'var(--background-secondary)', padding: '8px', borderRadius: '4px', width: '100%' }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>CPU Usage</Typography>
                <Typography variant="h6" style={{ color: server.cpuUsage === 'unknown' ? 'var(--text-secondary)' : getMetricColor(server.cpuUsage, 'cpu') }}>
                  {server.cpuUsage === 'unknown' ? 'unknown' : `${Math.round(server.cpuUsage)}%`}
                </Typography>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', marginTop: '4px' }}>
                  <div
                    style={{
                      width: server.cpuUsage === 'unknown' ? '0%' : `${Math.min(100, server.cpuUsage)}%`,
                      height: '100%',
                      backgroundColor: server.cpuUsage === 'unknown' ? 'var(--border-color)' : getMetricColor(server.cpuUsage, 'cpu'),
                      borderRadius: '2px'
                    }}
                  />
                </div>
              </div>
            </Grid>
          </Grid>
          
          <Grid container style={{ marginBottom: '0px', marginTop: '4px' }}>
            <Grid size={12} style={{ padding: '0px' }}>
              <div style={{ backgroundColor: 'var(--background-secondary)', padding: '8px', borderRadius: '4px', width: '100%' }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Memory Usage</Typography>
                <Typography variant="h6" style={{ color: server.memoryUsage === 'unknown' ? 'var(--text-secondary)' : getMetricColor(server.memoryUsage, 'memory') }}>
                  {server.memoryUsage === 'unknown' ? 'unknown' : `${Math.round(server.memoryUsage)}%`}
                </Typography>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', marginTop: '4px' }}>
                  <div
                    style={{
                      width: server.memoryUsage === 'unknown' ? '0%' : `${Math.min(100, server.memoryUsage)}%`,
                      height: '100%',
                      backgroundColor: server.memoryUsage === 'unknown' ? 'var(--border-color)' : getMetricColor(server.memoryUsage, 'memory'),
                      borderRadius: '2px'
                    }}
                  />
                </div>
              </div>
            </Grid>
          </Grid>

          <Grid container style={{ marginBottom: '0px', marginTop: '4px' }}>
            <Grid size={12} style={{ padding: '0px' }}>
              <div style={{ backgroundColor: 'var(--background-secondary)', padding: '8px', borderRadius: '4px', width: '100%' }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Free Disk Space</Typography>
                <Typography variant="h6" style={{ color: server.diskSpace === 'unknown' ? 'var(--text-secondary)' : getMetricColor(server.diskSpace, 'diskSpace') }}>
                  {server.diskSpace === 'unknown' ? 'unknown' : `${Math.round(server.diskSpace)}%`}
                </Typography>
              </div>
            </Grid>
          </Grid>

          <Grid container style={{ marginTop: '4px' }}>
            <Grid size={12} style={{ padding: '0px' }}>
              <div style={{ backgroundColor: 'var(--background-secondary)', padding: '8px', borderRadius: '4px', width: '100%' }}>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Uptime</Typography>
                <Typography variant="h6" style={{ color: server.uptime === 'unknown' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                  {server.uptime}
                </Typography>
              </div>
            </Grid>
          </Grid>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <IconButton
              size="small"
              onClick={() => handleOpenConfig(server)}
              sx={{ color: 'var(--primary-color)', minWidth: 'auto' }}
              title="Edit Server"
            >
              <Settings size={16} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleDeleteServer(server.id)}
              sx={{ color: 'var(--error-color)', minWidth: 'auto' }}
              title="Delete Server"
            >
              <X size={16} />
            </IconButton>
          </div>
        </CardContent>
      </Card>
    );
  };

  // 渲染初始加载状态
  if (initialLoading && servers.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <CircularProgress size={40} />
      </div>
    );
  }

  return (
    <div>
      {/* 配置按钮 */}
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={2}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="outlined"
            startIcon={<Info />}
            onClick={() => setShowDataToolsDialog(true)}
            sx={{
              borderColor: 'var(--primary-color)',
              color: 'var(--primary-color)',
              '&:hover': {
                borderColor: 'var(--primary-hover)',
                backgroundColor: 'rgba(33, 150, 243, 0.04)'
              }
            }}
          >
            数据管理
          </Button>
          <Button
            variant="outlined"
            startIcon={<Settings />}
            onClick={() => handleOpenConfig()}
            sx={{
              borderColor: 'var(--primary-color)',
              color: 'var(--primary-color)',
              '&:hover': {
                borderColor: 'var(--primary-hover)',
                backgroundColor: 'rgba(33, 150, 243, 0.04)'
              }
            }}
          >
            {t('printerManagement.addServer')}
          </Button>
        </div>
      </Box>

      {/* 服务器卡片网格 */}
      <Grid container spacing={2}>
        {servers.map(server => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={server.id}>
            <div style={{ position: 'relative' }}>
            {renderServerCard(server)}
            {serverLoadingStates[server.id] && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '4px',
                zIndex: 1
              }}>
                <CircularProgress size={20} style={{ color: 'white' }} />
              </div>
            )}
          </div>
        </Grid>
      ))}
    </Grid>

      {/* 服务器配置对话框 */}
      <Dialog
        open={configDialogOpen}
        onClose={handleCloseConfig}
        sx={{
          '& .MuiPaper-root': {
            bgcolor: 'var(--background-paper)',
            color: 'var(--text-primary)'
          }
        }}
      >
        <DialogTitle sx={{ color: 'var(--text-primary)' }}>
          {editingServer && editingServer.id ? 'Edit Server' : 'Add New Print Server'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Server Name"
            fullWidth
            variant="outlined"
            value={editingServer?.name || ''}
            onChange={(e) => setEditingServer(prev => ({ ...prev, name: e.target.value }))}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'var(--border-color)'
                },
                '&:hover fieldset': {
                  borderColor: 'var(--primary-color)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--primary-color)'
                }
              },
              '& .MuiInputLabel-root': {
                color: 'var(--text-secondary)'
              }
            }}
          />
          <TextField
            margin="dense"
            label="Server IP Address"
            fullWidth
            variant="outlined"
            value={editingServer?.ip || ''}
            onChange={(e) => setEditingServer(prev => ({ ...prev, ip: e.target.value }))}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'var(--border-color)'
                },
                '&:hover fieldset': {
                  borderColor: 'var(--primary-color)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--primary-color)'
                }
              },
              '& .MuiInputLabel-root': {
                color: 'var(--text-secondary)'
              }
            }}
          />
          <TextField
            margin="dense"
            label="Domain Name (optional)"
            fullWidth
            variant="outlined"
            value={editingServer?.domain || ''}
            onChange={(e) => setEditingServer(prev => ({ ...prev, domain: e.target.value }))}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'var(--border-color)'
                },
                '&:hover fieldset': {
                  borderColor: 'var(--primary-color)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--primary-color)'
                }
              },
              '& .MuiInputLabel-root': {
                color: 'var(--text-secondary)'
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfig} sx={{ color: 'var(--text-secondary)' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveServer} 
            sx={{
              color: 'var(--primary-color)',
              '&:disabled': {
                color: 'var(--disabled-color)'
              }
            }}
            disabled={!editingServer?.name || !editingServer?.ip}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* 数据工具对话框（导入/导出） */}
      <Dialog 
        open={showDataToolsDialog} 
        onClose={() => setShowDataToolsDialog(false)}
        sx={{
          '& .MuiPaper-root': {
            bgcolor: 'var(--background-paper)',
            color: 'var(--text-primary)'
          }
        }}
      >
        <DialogTitle sx={{ color: 'var(--text-primary)' }}>服务器数据管理</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom sx={{ color: 'var(--text-primary)' }}>
            您可以通过以下功能备份或恢复服务器数据：
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={exportServerData}
              fullWidth
              sx={{ py: 1.5 }}
            >
              导出服务器数据
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                // 触发文件选择对话框
                document.getElementById('serverDataImport').click();
              }}
              fullWidth
              sx={{ py: 1.5 }}
            >
              导入服务器数据
            </Button>
            <input
              id="serverDataImport"
              type="file"
              accept=".json"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
            <Divider />
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              注意：导入数据将覆盖当前所有服务器配置。建议在导入前先导出备份。
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDataToolsDialog(false)} sx={{ color: 'var(--text-secondary)' }}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default PrintServerDashboard;