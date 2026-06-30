import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Paper, TextField, Button, Typography, Divider, Grid, Box, Alert, Chip, Modal, FormControl, Select, MenuItem, CircularProgress, Accordion, AccordionSummary, AccordionDetails, ToggleButton, ToggleButtonGroup, Autocomplete, InputLabel, Switch, FormControlLabel, Fade } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useTranslation } from 'react-i18next';
import ReportPreview from './ReportPreview';
import { useAuthContext } from '../context/useAuthContext';

// 定义5种不同的报告样式配置
const reportStyles = {
  // 样式1：专业商务（与样式2互换）
  1: {
    primaryColor: '#0d47a1',
    secondaryColor: '#1565c0',
    headerBg: '#0d47a1',
    headerColor: 'white',
    sectionBg: '#f5f5f5',
    sectionBorder: '#e0e0e0',
    licenseBoxBg: '#e3f2fd',
    licenseBoxBorder: '#0d47a1',
  },
  
  // 样式2：简洁现代（与样式1互换）
  2: {
    primaryColor: '#1976d2',
    secondaryColor: '#667eea',
    headerBg: '#1976d2',
    headerColor: 'white',
    sectionBg: '#fafafa',
    sectionBorder: '#e0e0e0',
    licenseBoxBg: '#e8f5e9',
    licenseBoxBorder: '#1565c0',
  },
  
  // 样式3：活力色彩
  3: {
    primaryColor: '#4caf50',
    secondaryColor: '#81c784',
    headerBg: '#4caf50',
    headerColor: 'white',
    sectionBg: '#f1f8e9',
    sectionBorder: '#c8e6c9',
    licenseBoxBg: '#e8f5e9',
    licenseBoxBorder: '#4caf50',
  },
  
  // 样式4：优雅黑白
  4: {
    primaryColor: '#212121',
    secondaryColor: '#616161',
    headerBg: '#212121',
    headerColor: 'white',
    sectionBg: '#f5f5f5',
    sectionBorder: '#e0e0e0',
    licenseBoxBg: '#e0e0e0',
    licenseBoxBorder: '#424242',
  },
  
  // 样式5：科技感
  5: {
    primaryColor: '#00bcd4',
    secondaryColor: '#26c6da',
    headerBg: '#00bcd4',
    headerColor: 'white',
    sectionBg: '#e0f7fa',
    sectionBorder: '#b2ebf2',
    licenseBoxBg: '#e0f7fa',
    licenseBoxBorder: '#00bcd4',
  }
};

// Helper function to generate the report HTML for preview (using Grid layout)
const generateReportHtml = (formData, printerStatuses, licenseDays = 0, selectedStyle = 1, serverUptimeData = null) => {
  // 尝试从localStorage获取最新的ping检测结果，与StatusDashboard组件保持一致
  let cachedPingResults = {};
  try {
    const pingCache = localStorage.getItem('cachedPingResults');
    if (pingCache) {
      const parsedCache = JSON.parse(pingCache);
      cachedPingResults = parsedCache.results || {};
    }
  } catch (pingError) {
    console.warn('Failed to load cached ping results in report:', pingError);
  }

  // 从localStorage获取最新的SNMP墨粉数据，与StatusDashboard实时数据保持一致
  let cachedTonerData = {};
  try {
    const tonerCache = localStorage.getItem('cachedTonerData');
    if (tonerCache) {
      const parsedCache = JSON.parse(tonerCache);
      cachedTonerData = parsedCache.data || {};
    }
  } catch (tonerError) {
    console.warn('Failed to load cached toner data in report:', tonerError);
  }
  
  // Filter out test mode printers and use actual printer statuses
  const currentPrinters = Array.isArray(printerStatuses) ? printerStatuses
    .filter(printer => printer && typeof printer === 'object' && !printer.isTest)
    .map(printer => {
      // 获取打印机IP用于查找ping结果
      const printerIp = printer?.ip || '';
      
      // 优先从cachedPingResults获取状态，如果有且有效
      let printerStatus = printer?.status || 'unknown';
      if (printerIp && cachedPingResults[printerIp] !== undefined) {
        // 使用ping检测结果作为打印机状态
        printerStatus = cachedPingResults[printerIp] === true ? 'online' : 'offline';
      }

      // 优先使用SNMP实时缓存的墨粉数据（与StatusDashboard一致）
      let tonerData = printer?.actualTonerLevels || {};
      if (printerIp && cachedTonerData[printerIp]) {
        tonerData = cachedTonerData[printerIp];
      }
      
      return {
        ...printer,
        status: printerStatus,
        actualTonerLevels: tonerData
      };
    }) : [];

  // Format dates and email placeholders removed as they are not used in the report

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Printer Status Weekly Report</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
          color: #333;
          line-height: 1.6;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          padding: 30px 0;
          background: ${reportStyles[selectedStyle].headerBg};
          color: ${reportStyles[selectedStyle].headerColor} !important;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          font-size: 2.2rem;
          font-weight: 600;
          color: ${reportStyles[selectedStyle].headerColor} !important;
        }
        .section {
          margin-bottom: 35px;
          background-color: ${reportStyles[selectedStyle].sectionBg};
          border-radius: 8px;
          padding: 25px;
          border: 1px solid ${reportStyles[selectedStyle].sectionBorder};
        }
        .section-title {
          color: ${reportStyles[selectedStyle].primaryColor};
          font-size: 1.5rem;
          margin-top: 0;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid ${reportStyles[selectedStyle].sectionBorder};
        }
        .license-box {
          background-color: ${reportStyles[selectedStyle].licenseBoxBg};
          border-radius: 6px;
          padding: 20px;
          text-align: center;
          border-left: 4px solid ${reportStyles[selectedStyle].licenseBoxBorder};
        }
        .license-box p {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 500;
        }
        .printer-row {
          width: 100%;
          margin-bottom: 20px;
          font-size: 0; /* Remove whitespace between inline-block elements */
        }
        .printer-cell {
          display: inline-block;
          width: 24%;
          padding: 0 4px;
          box-sizing: border-box;
          font-size: 12px;
        }
        .printer-card {
          background: var(--background-paper);
          border-radius: 6px;
          padding: 10px;
          border: 1px solid ${reportStyles[selectedStyle].sectionBorder};
          min-height: 220px;
        }
        .printer-card h3 {
          margin-top: 0;
          margin-bottom: 10px;
          color: white;
          font-size: 1rem;
          background-color: ${reportStyles[selectedStyle].primaryColor};
          padding: 6px 8px;
          border-radius: 4px;
          border: none;
        }
        .printer-card p {
          margin: 4px 0;
          color: #6c757d;
          line-height: 1.2;
          font-size: 0.85rem;
        }
        .status-indicator {
          display: inline-block;
          margin: 12px 0;
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 8px;
          display: inline-block;
          vertical-align: middle;
        }
        .toner-section {
          margin-top: 15px;
        }
        .toner-item {
          margin-bottom: 8px;
        }
        .toner-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
          font-size: 0.8rem;
        }
        .toner-name {
          color: ${reportStyles[selectedStyle].primaryColor};
          font-weight: 500;
        }
        .toner-percentage {
          font-weight: 600;
        }
        .toner-bar-container {
          width: 100%;
          height: 10px;
          background-color: ${reportStyles[selectedStyle].sectionBorder};
          border-radius: 5px;
          overflow: hidden;
        }
        .toner-bar {
          height: 100%;
          border-radius: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding: 20px;
          color: ${reportStyles[selectedStyle].primaryColor};
          font-size: 0.9rem;
          border-top: 1px solid ${reportStyles[selectedStyle].sectionBorder};
        }
        /* Email client compatible responsive styles */
        @media only screen and (max-width: 1200px) {
          .printer-cell {
            width: 24%;
          }
        }
        @media only screen and (max-width: 1024px) {
          .printer-cell {
            width: 50%;
          }
        }
        @media only screen and (max-width: 768px) {
          .container {
            padding: 10px;
          }
          .printer-cell {
            width: 100%;
          }
          .header h1 {
            font-size: 1.8rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>Printer Status Weekly Report</h1>
        </div>
        
        <!-- License Status Section -->
        <div class="section">
          <h2 class="section-title">License Status</h2>
          <div class="license-box">
            <p>Papercut License Remaining Days: ${licenseDays} days</p>
          </div>
        </div>
        
        <!-- Printer Status Section -->
        <div class="section">
          <h2 class="section-title">Printer Details</h2>
          <div class="printer-row">
            ${(() => {
              if (!Array.isArray(currentPrinters)) return '';
              
              return currentPrinters.map((printer, index) => {
                if (!printer || typeof printer !== 'object') return '';
                
                const name = printer.name || `Printer ${index + 1}`;
                const ip = printer.ip || 'N/A';
                // 状态已经在currentPrinters中处理过，直接使用
                let status = printer.status || 'online';
                // 与StatusDashboard相同的墨粉数据获取逻辑
                const actualTonerLevels = printer && typeof printer === 'object' && printer.actualTonerLevels
                  ? printer.actualTonerLevels
                  : {};
                  
                // 确保actualTonerLevels是对象
                const safeTonerLevels = typeof actualTonerLevels === 'object' && !Array.isArray(actualTonerLevels)
                  ? actualTonerLevels
                  : {};
                
                // 合并墨粉级别数据：优先使用实际检测到的数据
                const mergedTonerLevels = {
                  black: safeTonerLevels.black !== undefined ? safeTonerLevels.black : 0,
                  cyan: safeTonerLevels.cyan !== undefined ? safeTonerLevels.cyan : 0,
                  magenta: safeTonerLevels.magenta !== undefined ? safeTonerLevels.magenta : 0,
                  yellow: safeTonerLevels.yellow !== undefined ? safeTonerLevels.yellow : 0
                };
                
                // 设置状态颜色
                const statusColor = status === 'online' ? '#4caf50' : status === 'offline' ? '#f44336' : '#ff9800';
                
                return `
                  <div class="printer-cell">
                    <div class="printer-card">
                      <div style="display: flex; justify-content: flex-start; align-items: center; background-color: ${reportStyles[selectedStyle].primaryColor}; padding: 8px 10px; border-radius: 4px; margin-bottom: 10px; gap: 10px;">
                        <div style="flex-grow: 1; max-width: 70%;">
                          <div style="margin: 0; color: white; font-size: 0.9rem; font-weight: 600;">${name}</div>
                        </div>
                        <div class="status-indicator" style="margin: 0; display: flex; align-items: center; white-space: nowrap;">
                          <div class="status-dot" style="background-color: ${statusColor};"></div>
                          <span style="text-transform: capitalize; vertical-align: middle; color: white; margin-left: 5px; font-size: 0.85rem;">${status}</span>
                        </div>
                      </div>
                      <p><strong>IP:</strong> ${ip}</p>
                      
                      <div class="toner-section" style="margin-top: 10px;">
                        ${(() => {
                          // 确保即使没有墨粉数据也显示所有四种颜色
                          const defaultColors = ['black', 'cyan', 'magenta', 'yellow'];
                          const colorMap = {
                            black: '#000000',
                            cyan: '#00bcd4',
                            magenta: '#e91e63',
                            yellow: '#ffeb3b'
                          };
                          
                          return defaultColors.map(color => {
                            const levelValue = typeof mergedTonerLevels[color] === 'number' ? mergedTonerLevels[color] : 0;
                            const barColor = colorMap[color] || '#9e9e9e';
                            
                            // 根据墨粉余量水平设置百分比数字的颜色
                            const getPercentageColor = (value) => {
                              if (value < 30) return '#f44336'; // 低余量：红色
                              if (value < 70) return '#ff9800'; // 中等余量：黄色
                              return '#4caf50'; // 高余量：绿色
                            };
                            const percentageColor = getPercentageColor(levelValue);
                            
                            return `
                              <div class="toner-item">
                                <div class="toner-label">
                                  <span class="toner-name">${color.charAt(0).toUpperCase() + color.slice(1)}</span>
                                  <span class="toner-percentage" style="color: ${percentageColor};">${levelValue}%</span>
                                </div>
                                <div class="toner-bar-container">
                                  <div 
                                    class="toner-bar"
                                    style="
                                      width: ${levelValue}%;
                                      background-color: ${barColor};
                                    "
                                  ></div>
                                </div>
                              </div>
                            `;
                          }).join('');
                        })()}
                      </div>
                    </div>
                  </div>
                `;
              }).join('');
            })()}
          </div>
        </div>
        
        ${serverUptimeData ? `
        <!-- Print Server Uptime Section -->
        <div class="section">
          <h2 class="section-title">Print Server Uptime</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:${reportStyles[selectedStyle].primaryColor};color:white;">
                <th style="padding:10px 12px;text-align:left;border-radius:4px 0 0 0;">Server Name</th>
                <th style="padding:10px 12px;text-align:left;">IP Address</th>
                <th style="padding:10px 12px;text-align:center;">Uptime (24h)</th>
                <th style="padding:10px 12px;text-align:center;border-radius:0 4px 0 0;">Incidents</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(serverUptimeData).map((server, idx) => `
                <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f9'};">
                  <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600;">${server.name || 'N/A'}</td>
                  <td style="padding:10px 12px;border-bottom:1px solid #eee;font-family:monospace;">${server.ip || 'N/A'}</td>
                  <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">
                    <span style="color:${server.uptimePercent >= 99 ? '#4caf50' : server.uptimePercent >= 95 ? '#ff9800' : '#f44336'};font-weight:600;">
                      ${server.uptimePercent !== undefined ? server.uptimePercent + '%' : 'N/A'}
                    </span>
                  </td>
                  <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${server.incidents !== undefined ? server.incidents : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <p>Automatically generated by Print Service Monitoring System</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

// Email report function removed as it's not used

const ReportForm = ({ onGenerateReport: generateAndSendReport, printerStatuses, licenseDays = 0, setReportSent, currentUser }) => {
  const { t } = useTranslation();
  const { accessToken } = useAuthContext();
  
  // 检查用户是否有权生成报告（只有 Administrator 和 Editor 可以）
  const canGenerateReport = currentUser && (currentUser.role === 'Administrator' || currentUser.role === 'Editor' || currentUser.role === 'admin' || currentUser.role === 'editor');
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem('savedReportEmails');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          fromEmail: parsed.fromEmail || '',
          toEmail: parsed.toEmail || '',
          ccEmail: parsed.ccEmail || ''
        };
      }
    } catch (e) {
      console.error('Failed to load saved report emails:', e);
    }
    return { fromEmail: '', toEmail: '', ccEmail: '' };
  });

  const [initialEmails, setInitialEmails] = useState(null);
  const isReportEmailDirty = initialEmails && (
    formData.fromEmail !== initialEmails.fromEmail ||
    formData.toEmail !== initialEmails.toEmail ||
    formData.ccEmail !== initialEmails.ccEmail
  );
  
  // Email history state
  const [emailHistory, setEmailHistory] = useState({
    fromEmails: [],
    toEmails: [],
    ccEmails: []
  });
  
  // Weekly schedule state
  const [weeklySchedule, setWeeklySchedule] = useState(() => {
    try {
      const saved = localStorage.getItem('weeklyEmailSchedule');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load weekly schedule:', e);
    }
    return null; // { enabled, dayOfWeek, hour, minute, fromEmail, toEmail, ccEmail }
  });
  const [scheduleEnabled, setScheduleEnabled] = useState(() => {
    return weeklySchedule?.enabled || false;
  });
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(() => {
    return weeklySchedule?.dayOfWeek ?? 1;
  });
  const [scheduleStyle, setScheduleStyle] = useState(() => {
    return weeklySchedule?.selectedStyle ?? 1;
  });
  const [scheduleTime, setScheduleTime] = useState(() => {
    const d = new Date();
    d.setHours(weeklySchedule?.hour ?? 9, weeklySchedule?.minute ?? 0, 0, 0);
    return d;
  });
  const [lastScheduleSent, setLastScheduleSent] = useState(() => {
    try {
      return localStorage.getItem('lastScheduleSentWeek') || '';
    } catch { return ''; }
  });
  
  // Load report settings from backend on mount (shared across all clients)
  // Helper to apply report settings data to state
  const applyReportSettingsData = (data) => {
    const reportSettings = data?.data?.reportSettings || data?.reportSettings;
    if (reportSettings) {
      // Load lastSentWeek from server (global dedup)
      if (reportSettings.lastSentWeek) {
        setLastScheduleSent(reportSettings.lastSentWeek);
        localStorage.setItem('lastScheduleSentWeek', reportSettings.lastSentWeek);
      }
      // Apply saved report emails from server
      if (reportSettings.emails) {
        const emails = reportSettings.emails;
        setFormData({
          fromEmail: emails.fromEmail || '',
          toEmail: emails.toEmail || '',
          ccEmail: emails.ccEmail || ''
        });
        setInitialEmails({
          fromEmail: emails.fromEmail || '',
          toEmail: emails.toEmail || '',
          ccEmail: emails.ccEmail || ''
        });
        localStorage.setItem('savedReportEmails', JSON.stringify(emails));
      }
      // Apply weekly schedule from server
      if (reportSettings.weeklySchedule) {
        const schedule = reportSettings.weeklySchedule;
        setWeeklySchedule(schedule);
        setScheduleEnabled(schedule.enabled || false);
        if (schedule.dayOfWeek !== undefined) setScheduleDayOfWeek(schedule.dayOfWeek);
        if (schedule.selectedStyle !== undefined) setScheduleStyle(schedule.selectedStyle);
        if (schedule.hour !== undefined || schedule.minute !== undefined) {
          const d = new Date();
          d.setHours(schedule.hour || 9, schedule.minute || 0, 0, 0);
          setScheduleTime(d);
        }
        localStorage.setItem('weeklyEmailSchedule', JSON.stringify(schedule));
      }
    }
    // Also apply email contacts from same response
    const contacts = data?.data?.emailContacts || data?.emailContacts;
    if (contacts) {
      applyEmailContacts(contacts);
    }
  };

  useEffect(() => {
    // Always try public endpoint first for immediate display
    fetch('/api/status/report-settings')
      .then(res => res.json())
      .then(data => applyReportSettingsData(data))
      .catch(() => {});
    
    // If authenticated, also load from full settings (may have more data)
    if (accessToken) {
      fetch('/api/settings', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(res => res.json())
        .then(data => applyReportSettingsData(data))
        .catch(err => console.warn('Failed to load report settings from server:', err.message));
    }
  }, [accessToken]);

  // Manual data state has been removed as requested
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isTogglingSchedule, setIsTogglingSchedule] = useState(false);
  const [loading, setLoading] = useState(false);
  // State for backend-generated preview HTML (same as email content)
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  // State for report style selection in preview modal
  const [selectedStyle, setSelectedStyle] = useState(1);

  // Email contacts from system settings
  const [emailContacts, setEmailContacts] = useState({ senders: [], recipients: [], ccRecipients: [] });

  // Server uptime data for report
  const [serverUptimeData, setServerUptimeData] = useState(null);

  // Helper to apply email contacts to state
  const applyEmailContacts = (contacts) => {
    if (!contacts) return;
    setEmailContacts({
      senders: contacts.senders || [],
      recipients: contacts.recipients || [],
      ccRecipients: contacts.ccRecipients || []
    });
    setFormData(prev => ({
      fromEmail: prev.fromEmail || (contacts.senders && contacts.senders[0]) || '',
      toEmail: prev.toEmail || (contacts.recipients && contacts.recipients[0]) || '',
      ccEmail: prev.ccEmail || (contacts.ccRecipients && contacts.ccRecipients[0]) || ''
    }));
  };

  // Fetch server uptime and apply cached email contacts
  useEffect(() => {
    // Set initial emails baseline for dirty state detection
    if (!initialEmails) {
      setInitialEmails({ ...formData });
    }

    // Fetch server uptime data for report
    if (accessToken) {
      fetch('/api/print-servers/uptime?range=24h', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data && Object.keys(data.data).length > 0) {
            setServerUptimeData(data.data);
          }
        })
        .catch(() => {});
    }
    // Try localStorage first for immediate display (email contacts cache)
    try {
      const localSettings = JSON.parse(localStorage.getItem('settings') || '{}');
      if (localSettings.emailContacts) {
        applyEmailContacts(localSettings.emailContacts);
      }
    } catch (e) { /* ignore */ }
  }, [accessToken]);

  // Initialize manual data state
  useState(() => {
    const initialManualData = {};
    if (Array.isArray(printerStatuses)) {
      printerStatuses.forEach(printer => {
        if (!printer || typeof printer !== 'object') return;
        initialManualData[printer.ip] = {
          status: printer.status || 'online',
          tonerLevels: printer.tonerLevels || { black: 100, cyan: 100, magenta: 100, yellow: 100 }
        };
      });
    }
    // Manual data state has been removed as requested
  }, [printerStatuses]);

  // Manual data handling functions have been removed as requested
  // Load email history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('emailHistory');
    if (savedHistory) {
      try {
        setEmailHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to load email history:', error);
      }
    }
  }, []);
  
  // Save email history to localStorage
  const saveEmailHistory = (newHistory) => {
    setEmailHistory(newHistory);
    localStorage.setItem('emailHistory', JSON.stringify(newHistory));
  };
  
  // Add email to history
  const addEmailToHistory = (type, email) => {
    if (!email.trim()) return;
    
    setEmailHistory(prev => {
      const emails = prev[`${type}Emails`] || [];
      // Remove duplicate if exists
      const filteredEmails = emails.filter(e => e !== email);
      // Add to beginning of array and limit to 5 items
      const newEmails = [email, ...filteredEmails].slice(0, 5);
      
      const newHistory = {
        ...prev,
        [`${type}Emails`]: newEmails
      };
      
      localStorage.setItem('emailHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle email selection from history
  const handleEmailSelect = (type, email) => {
    setFormData(prev => ({
      ...prev,
      [`${type}Email`]: email
    }));
  };
  
  // Toggle schedule enabled/disabled
  const handleScheduleToggle = async (checked) => {
    if (isTogglingSchedule) return;

    const previousEnabled = scheduleEnabled;
    const previousSchedule = weeklySchedule;
    setScheduleEnabled(checked);
    if (weeklySchedule) {
      const updated = { ...weeklySchedule, enabled: checked };
      setWeeklySchedule(updated);
      setError('');
      setSuccess('');
      try {
        localStorage.setItem('weeklyEmailSchedule', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save schedule toggle:', e);
      }

      // Sync toggle to backend immediately so page refresh keeps the latest state.
      if (accessToken) {
        const emails = {
          fromEmail: formData.fromEmail,
          toEmail: formData.toEmail,
          ccEmail: formData.ccEmail || ''
        };
        setIsTogglingSchedule(true);
        try {
          const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ reportSettings: { emails, weeklySchedule: updated } })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (err) {
          console.warn('Failed to sync schedule toggle to server:', err.message);
          setScheduleEnabled(previousEnabled);
          setWeeklySchedule(previousSchedule);
          try {
            if (previousSchedule) {
              localStorage.setItem('weeklyEmailSchedule', JSON.stringify(previousSchedule));
            }
          } catch (storageError) {
            console.error('Failed to rollback schedule in localStorage:', storageError);
          }
          setError('Failed to update weekly schedule. Your previous setting was restored.');
          return;
        } finally {
          setIsTogglingSchedule(false);
        }
      }

      setSuccess(checked ? 'Weekly schedule enabled!' : 'Weekly schedule disabled!');
      setTimeout(() => setSuccess(''), 3000);
    } else if (checked) {
      // No schedule configured yet, expand to configure
      setScheduleExpanded(true);
      setScheduleEnabled(false); // Reset until actually saved
    }
  };

  // Save email settings permanently (to backend + localStorage)
  const saveEmailSettings = () => {
    if (!formData.fromEmail && !formData.toEmail) {
      setError('Please enter at least a From or To email address');
      return;
    }
    try {
      const emails = {
        fromEmail: formData.fromEmail,
        toEmail: formData.toEmail,
        ccEmail: formData.ccEmail || ''
      };
      localStorage.setItem('savedReportEmails', JSON.stringify(emails));
      if (formData.fromEmail) addEmailToHistory('from', formData.fromEmail);
      if (formData.toEmail) addEmailToHistory('to', formData.toEmail);
      if (formData.ccEmail) addEmailToHistory('cc', formData.ccEmail);
      setInitialEmails({ ...formData });

      // Sync to backend so all clients share the same settings
      if (accessToken) {
        const reportSettingsPayload = { emails };
        if (weeklySchedule) reportSettingsPayload.weeklySchedule = weeklySchedule;
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({ reportSettings: reportSettingsPayload })
        }).catch(err => console.warn('Failed to sync email settings to server:', err.message));
      }

      setSuccess('Email settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error('Failed to save email settings:', e);
      setError('Failed to save email settings');
    }
  };

  // Save weekly schedule
  const saveWeeklySchedule = () => {
    if (!validateForm()) return;
    if (!scheduleTime) {
      setError('Please select a send time');
      return;
    }
    
    const schedule = {
      enabled: true,
      dayOfWeek: scheduleDayOfWeek,
      selectedStyle: scheduleStyle,
      hour: scheduleTime.getHours(),
      minute: scheduleTime.getMinutes(),
      fromEmail: formData.fromEmail,
      toEmail: formData.toEmail,
      ccEmail: formData.ccEmail || '',
      savedAt: new Date().toISOString()
    };
    
    try {
      localStorage.setItem('weeklyEmailSchedule', JSON.stringify(schedule));
    } catch (e) {
      console.error('Failed to save weekly schedule:', e);
    }
    
    // Sync to backend so all clients share the same schedule
    if (accessToken) {
      const emails = { fromEmail: formData.fromEmail, toEmail: formData.toEmail, ccEmail: formData.ccEmail || '' };
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ reportSettings: { emails, weeklySchedule: schedule } })
      }).catch(err => console.warn('Failed to sync schedule to server:', err.message));
    }

    setWeeklySchedule(schedule);
    setScheduleEnabled(true);
    addEmailToHistory('from', formData.fromEmail);
    addEmailToHistory('to', formData.toEmail);
    if (formData.ccEmail) addEmailToHistory('cc', formData.ccEmail);
    
    setSuccess('Weekly schedule saved successfully!');
    setTimeout(() => setSuccess(''), 5000);
  };
  
  // Cancel weekly schedule
  const cancelWeeklySchedule = () => {
    try {
      localStorage.removeItem('weeklyEmailSchedule');
    } catch (e) {
      console.error('Failed to remove weekly schedule:', e);
    }
    
    // Sync cancellation to backend
    if (accessToken) {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ reportSettings: { weeklySchedule: { enabled: false } } })
      }).catch(err => console.warn('Failed to sync schedule cancellation to server:', err.message));
    }

    setWeeklySchedule(null);
    setScheduleEnabled(false);
  };
  
  // Edit weekly schedule - populate form from saved schedule
  const editWeeklySchedule = () => {
    if (weeklySchedule) {
      setFormData({
        fromEmail: weeklySchedule.fromEmail,
        toEmail: weeklySchedule.toEmail,
        ccEmail: weeklySchedule.ccEmail || ''
      });
      setScheduleDayOfWeek(weeklySchedule.dayOfWeek);
      if (weeklySchedule.selectedStyle) setScheduleStyle(weeklySchedule.selectedStyle);
      const t = new Date();
      t.setHours(weeklySchedule.hour, weeklySchedule.minute, 0, 0);
      setScheduleTime(t);
      setScheduleExpanded(true);
    }
  };
  
  // Form validation - includes email validation
  const validateForm = () => {
    setError('');
    setSuccess('');
    
    // Validate required email fields
    if (!formData.fromEmail.trim()) {
      setError('Please enter sender email');
      return false;
    }
    
    if (!formData.toEmail.trim()) {
      setError('Please enter recipient email');
      return false;
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.fromEmail.trim())) {
      setError('Please enter a valid sender email');
      return false;
    }
    
    if (!emailRegex.test(formData.toEmail.trim())) {
      setError('Please enter a valid recipient email');
      return false;
    }
    
    // Validate CC email if provided
    if (formData.ccEmail && !emailRegex.test(formData.ccEmail.trim())) {
      setError('Please enter a valid CC email');
      return false;
    }
    
    return true;
  };

  // Function to send report
  const sendReport = async () => {
    // 确保函数返回一个Promise
    return new Promise(async (resolve, reject) => {
      if (!validateForm()) {
        reject(new Error('表单验证失败'));
        return;
      }

      setLoading(true);
      setError('');

      try {
        // Prepare report data with email fields
        const reportData = {
          fromEmail: formData.fromEmail,
          toEmail: formData.toEmail,
          ccEmail: formData.ccEmail,
          manualData: null,
          // 使用后端生成的previewHtml（与邮件发送使用相同的inline-style HTML）
          // 如果previewHtml不可用，回退到前端生成的HTML
          reportHtml: previewHtml || generateReportHtml(formData, printerStatuses, licenseDays, selectedStyle, serverUptimeData)
        };
        
        // Add emails to history
        addEmailToHistory('from', formData.fromEmail);
        addEmailToHistory('to', formData.toEmail);
        if (formData.ccEmail) {
          addEmailToHistory('cc', formData.ccEmail);
        }

        // Call parent component's generate report function
        const result = await generateAndSendReport(reportData, selectedStyle);

        if (result.success) {
          setSuccess('Weekly report has been successfully generated and sent!');
          
          // Set report sent status
          if (setReportSent) {
            setReportSent(true);
          }
          
          // Clear success message after 5 seconds
          setTimeout(() => setSuccess(''), 5000);
          
          resolve(result); // 成功时解析Promise
        } else {
          const errorMsg = `Failed to generate report: ${result.error || 'Unknown error'}`;
          setError(errorMsg);
          reject(new Error(errorMsg)); // 失败时拒绝Promise
        }
      } catch (err) {
        const errorMsg = `Submission failed: ${err.message}`;
        setError(errorMsg);
        reject(err); // 捕获异常并拒绝Promise
      } finally {
        // Reset loading state
        setLoading(false);
      }
    });
  };

  // Weekly schedule execution now runs on the backend to avoid duplicate sends
  // from multiple open browsers or concurrent client sessions.

  // Email history helper function removed as emails are not used

  // Date handling removed as dates are not used in report generation

  // Handle manual data changes functions have been removed
  // Handle manual toner data changes
  // Handle manual toner change function has been removed;

  // Submit form to generate report
  const handleSubmit = async () => {
    await sendReport(false);
  };

  // Preview send report function removed as it's not used
  
  // 从后端获取预览HTML（与邮件发送使用完全相同的inline-style HTML）
  const fetchPreviewHtml = async (styleOverride) => {
    const styleToUse = styleOverride !== undefined ? styleOverride : selectedStyle;
    setPreviewLoading(true);
    try {
      const response = await fetch('/api/reports/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          printers: printerStatuses.filter(p => !p.isTest).map(p => ({
            name: p.name || 'Unknown Printer',
            ip: p.ip || '',
            model: p.model || ''
          })),
          selectedStyle: styleToUse
        })
      });
      const data = await response.json();
      if (data.success && data.data?.previewHtml) {
        setPreviewHtml(data.data.previewHtml);
      } else {
        // 后端无法生成时，回退使用前端HTML
        setPreviewHtml(generateReportHtml(formData, printerStatuses, licenseDays, styleToUse, serverUptimeData));
      }
    } catch (err) {
      console.warn('Failed to fetch preview from backend, using frontend HTML:', err.message);
      setPreviewHtml(generateReportHtml(formData, printerStatuses, licenseDays, styleToUse, serverUptimeData));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle style change in preview modal
  const handleStyleChange = (event, newStyle) => {
    if (newStyle !== null) {
      setSelectedStyle(newStyle);
      fetchPreviewHtml(newStyle);
    }
  };

  return (
    <Box sx={{ maxWidth: '100%' }}>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0', bgcolor: 'var(--background-paper)' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Email input fields - full width rows */}
          <Autocomplete
            freeSolo
            options={[...new Set([...emailContacts.senders, ...emailHistory.fromEmails])]}
            value={formData.fromEmail}
            onChange={(e, val) => setFormData(prev => ({ ...prev, fromEmail: val || '' }))}
            onInputChange={(e, val) => setFormData(prev => ({ ...prev, fromEmail: val || '' }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('reportForm.fromEmail')}
                variant="outlined"
                required
                placeholder={t('reportForm.fromPlaceholder')}
                fullWidth
              />
            )}
          />
          <Autocomplete
            freeSolo
            options={[...new Set([...emailContacts.recipients, ...emailHistory.toEmails])]}
            value={formData.toEmail}
            onChange={(e, val) => setFormData(prev => ({ ...prev, toEmail: val || '' }))}
            onInputChange={(e, val) => setFormData(prev => ({ ...prev, toEmail: val || '' }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('reportForm.toEmail')}
                variant="outlined"
                required
                placeholder={t('reportForm.toPlaceholder')}
                fullWidth
              />
            )}
          />
          <Autocomplete
            freeSolo
            options={[...new Set([...emailContacts.ccRecipients, ...emailHistory.ccEmails])]}
            value={formData.ccEmail}
            onChange={(e, val) => setFormData(prev => ({ ...prev, ccEmail: val || '' }))}
            onInputChange={(e, val) => setFormData(prev => ({ ...prev, ccEmail: val || '' }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('reportForm.ccEmail')}
                variant="outlined"
                placeholder={t('reportForm.ccPlaceholder')}
                fullWidth
              />
            )}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Fade in={!!isReportEmailDirty}>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={saveEmailSettings}
                size="small"
              >
                {t('common.save')}
              </Button>
            </Fade>
          </Box>
          <Typography variant="body1">
            {t('reportForm.instruction')}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Weekly Schedule Section */}
        <Accordion expanded={scheduleExpanded} onChange={(e, expanded) => setScheduleExpanded(expanded)} sx={{ mb: 2, border: '1px solid #e0e0e0', boxShadow: 'none', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <ScheduleIcon color={scheduleEnabled ? 'primary' : 'action'} />
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {t('reportForm.weeklyScheduledSend')}
              </Typography>
              {weeklySchedule && (
                <Chip
                  label={`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][weeklySchedule.dayOfWeek]} ${String(weeklySchedule.hour).padStart(2,'0')}:${String(weeklySchedule.minute).padStart(2,'0')}`}
                  color="primary"
                  size="small"
                  sx={{ ml: 1 }}
                />
              )}
              <Box sx={{ ml: 'auto', mr: 1 }} onClick={(e) => e.stopPropagation()}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={scheduleEnabled}
                      onChange={(e) => handleScheduleToggle(e.target.checked)}
                      disabled={isTogglingSchedule || !canGenerateReport}
                      color="success"
                      size="small"
                    />
                  }
                  label={
                    <Chip
                      label={scheduleEnabled ? t('common.enabled') : t('common.disabled')}
                      size="small"
                      color={scheduleEnabled ? 'success' : 'default'}
                      variant={scheduleEnabled ? 'filled' : 'outlined'}
                    />
                  }
                  sx={{ m: 0 }}
                />
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {/* Active schedule display */}
            {weeklySchedule && (
              <Alert severity="info" sx={{ mb: 2 }} action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" startIcon={<EditIcon />} onClick={editWeeklySchedule}>{t('common.edit')}</Button>
                  <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={cancelWeeklySchedule}>{t('common.delete')}</Button>
                </Box>
              }>
                <Typography variant="body2">
                  <strong>{t('reportForm.activeSchedule')}</strong> Every {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][weeklySchedule.dayOfWeek]} at {String(weeklySchedule.hour).padStart(2,'0')}:{String(weeklySchedule.minute).padStart(2,'0')} (Style {weeklySchedule.selectedStyle || 1})
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  From: {weeklySchedule.fromEmail} → To: {weeklySchedule.toEmail}{weeklySchedule.ccEmail ? ` (CC: ${weeklySchedule.ccEmail})` : ''}
                </Typography>
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('reportForm.scheduleDescription')}
            </Typography>

            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('reportForm.style')}</InputLabel>
                  <Select
                    value={scheduleStyle}
                    onChange={(e) => setScheduleStyle(e.target.value)}
                    label={t('reportForm.style')}
                  >
                    <MenuItem value={1}>Style 1</MenuItem>
                    <MenuItem value={2}>Style 2</MenuItem>
                    <MenuItem value={3}>Style 3</MenuItem>
                    <MenuItem value={4}>Style 4</MenuItem>
                    <MenuItem value={5}>Style 5</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('reportForm.dayOfWeek')}</InputLabel>
                  <Select
                    value={scheduleDayOfWeek}
                    onChange={(e) => setScheduleDayOfWeek(e.target.value)}
                    label={t('reportForm.dayOfWeek')}
                  >
                    <MenuItem value={1}>{t('reportForm.monday')}</MenuItem>
                    <MenuItem value={2}>{t('reportForm.tuesday')}</MenuItem>
                    <MenuItem value={3}>{t('reportForm.wednesday')}</MenuItem>
                    <MenuItem value={4}>{t('reportForm.thursday')}</MenuItem>
                    <MenuItem value={5}>{t('reportForm.friday')}</MenuItem>
                    <MenuItem value={6}>{t('reportForm.saturday')}</MenuItem>
                    <MenuItem value={0}>{t('reportForm.sunday')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <TimePicker
                    label={t('reportForm.sendTime')}
                    value={scheduleTime}
                    onChange={(newTime) => setScheduleTime(newTime)}
                    ampm={false}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<ScheduleIcon />}
                  onClick={saveWeeklySchedule}
                  disabled={!canGenerateReport}
                >
                  {weeklySchedule ? t('reportForm.updateSchedule') : t('reportForm.saveSchedule')}
                </Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Manual data entry feature has been removed as requested */}

        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => {
              fetchPreviewHtml();
              setPreviewOpen(true);
            }}
            disabled={!canGenerateReport}
          >
            {t('reportForm.previewReport')}
          </Button>
          
          {/* Preview Modal */}
          <Modal
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            aria-labelledby="report-preview-modal"
            aria-describedby="preview of printer status report"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{
              backgroundColor: 'var(--background-paper)',
              width: '95%',
              maxWidth: '1400px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '20px',
              borderRadius: '4px',
              boxShadow: '0px 3px 5px 2px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#333' }}>{t('reportForm.reportPreview')}</h2>
                
                {/* Style selection buttons */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="subtitle2" style={{ marginRight: '8px' }}>{t('reportForm.reportStyle')}</Typography>
                  <ToggleButtonGroup
                    value={selectedStyle}
                    exclusive
                    onChange={handleStyleChange}
                    aria-label="Report Style Selection"
                    size="small"
                  >
                    <ToggleButton value={1} aria-label="Style 1">
                      Style 1
                    </ToggleButton>
                    <ToggleButton value={2} aria-label="Style 2">
                      Style 2
                    </ToggleButton>
                    <ToggleButton value={3} aria-label="Style 3">
                      Style 3
                    </ToggleButton>
                    <ToggleButton value={4} aria-label="Style 4">
                      Style 4
                    </ToggleButton>
                    <ToggleButton value={5} aria-label="Style 5">
                      Style 5
                    </ToggleButton>
                  </ToggleButtonGroup>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Email sending button */}
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="small"
                    startIcon={<SendIcon />}
                    onClick={() => {
                      setPreviewOpen(false);
                      sendReport();
                    }}
                    disabled={!canGenerateReport}
                  >
                    {t('reportForm.sendReport')}
                  </Button>
                  
                  <Button onClick={() => setPreviewOpen(false)} variant="contained" color="primary" size="small">
                    {t('common.close')}
                  </Button>
                </div>
              </div>
              {previewLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                  <CircularProgress />
                  <Typography sx={{ ml: 2 }}>{t('reportForm.loadingPreview')}</Typography>
                </div>
              ) : (
                <div 
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml || generateReportHtml(formData, printerStatuses, licenseDays, selectedStyle, serverUptimeData)) }}
                />
              )}
            </div>
          </Modal>
          
          {/* Schedule Dialog removed - now inline in form */}
        </Box>
      </Paper>


    </Box>
  );
};

export default ReportForm;