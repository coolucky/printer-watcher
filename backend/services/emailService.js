const nodemailer = require('nodemailer');
const { format } = require('date-fns');
const { sendMailWithRetry } = require('./emailRetryHelper');

class EmailService {
  constructor(config) {
    this.config = config;
    
    // 处理settingsService中的配置键名映射
    // 将smtpServer映射到host，smtpPort映射到port，useTls映射到secure
    const smtpConfig = {
      host: config.smtpServer || config.host,
      port: config.smtpPort || config.port || 25,
      secure: config.useTls || config.secure || false,
      requireTLS: false,
      ignoreTLS: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        // 内网环境下可设置为 false，生产环境建议设为 true
        rejectUnauthorized: config.tlsRejectUnauthorized !== undefined ? config.tlsRejectUnauthorized : false,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3'
      }
    };
    
    // 只有当提供了用户名和密码时才添加auth配置
    const smtpUser = config.smtpUser || config.user || '';
    const smtpPass = config.smtpPass || config.pass || '';
    
    if (smtpUser && smtpPass) {
      smtpConfig.auth = {
        user: smtpUser,
        pass: smtpPass
      };
    }

    console.log('Creating SMTP transporter with config:', smtpConfig);
    this.smtpConfig = smtpConfig;
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    return nodemailer.createTransport(this.smtpConfig);
  }

  // 生成周报HTML内容 - 与前端预览报告完全一致
  generateWeeklyReportHTML(printerData, licenseDays, startDate, endDate, emailData = {}) {
    // Format dates
    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US');
    };

    const reportStartDate = startDate ? formatDate(startDate) : 'N/A';
    const reportEndDate = endDate ? formatDate(endDate) : 'N/A';
    const toEmail = emailData.toEmail || 'N/A';
    const fromEmail = emailData.fromEmail || 'N/A';
    const ccEmail = emailData.ccEmail || 'N/A';

    // 生成完整的HTML，与前端预览报告完全一致
    return `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h1 style="color: #333; text-align: center;">Printer Status Weekly Report</h1>
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
        <p><strong>Report Period:</strong> ${reportStartDate} to ${reportEndDate}</p>
        <p><strong>To:</strong> ${toEmail}</p>
        <p><strong>CC:</strong> ${ccEmail}</p>
        <p><strong>From:</strong> ${fromEmail}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString('en-US')}</p>
      </div>
      
      <!-- License Status Section -->
      <h2 style="color: #333; margin-top: 30px;">License status</h2>
      <div style="margin-bottom: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
        <p style="margin: 0;"><strong>Papercut license remaining days:</strong> ${licenseDays || 0} days</p>
      </div>
      
      <!-- Printer Details Section -->
      <h2 style="color: #333; margin-top: 30px;">Printer details</h2>
      <div class="printer-grid">
        ${Array.isArray(printerData) ? printerData.map((printer) => {
          if (!printer || typeof printer !== 'object') return '';
          
          const name = printer.name || 'Unknown Printer';
          const ip = printer.ip || 'Unknown IP';
          const status = printer.status || 'unknown';
          // 优先使用actualTonerLevels，确保与Status Dashboard页面数据一致
          const tonerLevels = printer.actualTonerLevels || printer.tonerLevels || { black: 0, cyan: 0, magenta: 0, yellow: 0 };
          
          // Status color mapping
          const statusColors = {
            online: '#4caf50',
            offline: '#ff9800',
            error: '#f44336',
            unknown: '#9e9e9e'
          };
          
          // Toner color mapping
          const tonerColorMapping = {
            black: '#000000',
            cyan: '#03a9f4',
            magenta: '#e91e63',
            yellow: '#ffeb3b'
          };
          
          return `
            <div class="printer-card">
              <div class="printer-header">
                <h3>${name}</h3>
                <div class="status-indicator" style="background-color: ${statusColors[status] || statusColors.unknown}"></div>
              </div>
              <p><strong>IP Address:</strong> ${ip}</p>
              <p><strong>Status:</strong> ${status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : status === 'error' ? 'Error' : 'Unknown'}</p>
              
              <div class="toner-levels">
                ${typeof tonerLevels === 'object' && tonerLevels !== null ? Object.entries(tonerLevels).map(([color, level]) => {
                  const displayLevel = typeof level === 'number' ? Math.max(0, Math.min(100, level)) : 0;
                  const displayColor = color.charAt(0).toUpperCase() + color.slice(1);
                  
                  return `
                    <div class="toner-item">
                      <div class="toner-label">
                        <span class="toner-name">${displayColor}</span>
                        <span class="toner-percentage">${displayLevel}%</span>
                      </div>
                      <div class="toner-progress">
                        <div 
                          class="toner-progress-bar" 
                          style="
                            width: ${displayLevel}%;
                            background-color: ${tonerColorMapping[color] || '#9e9e9e'};
                          "
                        ></div>
                      </div>
                    </div>
                  `;
                }).join('') : '<p>No toner data available</p>'}
              </div>
            </div>
          `;
        }).join('') : '<p>No printer data available</p>'}
      </div>
    </div>
    
    <style>
      .printer-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 20px;
        width: 100%;
      }
      
      .printer-card {
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        min-width: 200px;
      }
      
      .printer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .printer-header h3 {
        margin: 0;
        font-size: 16px;
        color: #333;
      }
      
      .status-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }
      
      .printer-card p {
        margin: 5px 0;
        font-size: 14px;
        color: #666;
      }
      
      .toner-levels {
        margin-top: 10px;
      }
      
      .toner-item {
        margin-bottom: 8px;
      }
      
      .toner-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 13px;
      }
      
      .toner-name {
        color: #333;
      }
      
      .toner-percentage {
        font-weight: bold;
        color: #666;
      }
      
      .toner-progress {
        width: 100%;
        height: 8px;
        background-color: #f0f0f0;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .toner-progress-bar {
        height: 100%;
        border-radius: 4px;
      }
    </style>
    `;
  }

  // 使用打印机数据生成纯inline-style的邮件HTML并发送
  async sendWeeklyReportWithCustomHtml(htmlContent, emailData, printersStatus, licenseDays, serverUptimeData = null, selectedStyle = 1) {
    try {
      const { startDate, endDate, toEmail, fromEmail, ccEmail } = emailData;
      
      // 设置邮件主题
      const sendDate = new Date().toLocaleDateString('en-US');
      const subject = `[Report]Printer Status Weekly Report - ${sendDate}`;
      
      // 确定最终使用的HTML
      // 优先使用传入的htmlContent（由/preview端点生成，与预览页面完全一致）
      // 只有当htmlContent为空时，才使用后端重新生成
      let finalHtml;
      if (htmlContent) {
        // 使用预览端点生成的HTML（与Report Preview页面显示的完全一致）
        finalHtml = htmlContent;
      } else {
        // 无预览HTML时，使用后端生成（确保样式与预览一致）
        console.log('No preview HTML provided, generating report with backend template');
        finalHtml = this.generateInlineStyleReportHtml(printersStatus || [], licenseDays || 0, serverUptimeData, selectedStyle);
      }
      
      const mailOptions = {
        from: fromEmail,
        to: toEmail.split(/[,;]/).map(email => email.trim()).filter(email => email),
        subject: subject,
        html: finalHtml
      };
      
      if (ccEmail) {
        mailOptions.cc = ccEmail.split(/[,;]/).map(email => email.trim()).filter(email => email);
      }
      
      const result = await sendMailWithRetry({
        createTransporter: () => {
          this.transporter = this.createTransporter();
          return this.transporter;
        },
        mailOptions,
        contextLabel: 'Weekly report email',
        logger: console
      });
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error('Error sending report with custom HTML:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  }

  // 生成纯inline-style的报告HTML（无<style>标签，兼容所有邮件客户端和SMTP relay）
  generateInlineStyleReportHtml(printersStatus, licenseDays, serverUptimeData = null, selectedStyle = 1) {
    switch (selectedStyle) {
      case 2: return this.generateStyle2Html(printersStatus, licenseDays, serverUptimeData);
      case 3: return this.generateStyle3Html(printersStatus, licenseDays, serverUptimeData);
      case 4: return this.generateStyle4Html(printersStatus, licenseDays, serverUptimeData);
      case 5: return this.generateStyle5Html(printersStatus, licenseDays, serverUptimeData);
      default: return this.generateStyle1Html(printersStatus, licenseDays, serverUptimeData);
    }
  }

  // Style 1: Classic Blue - 蓝色header + 4列卡片布局 + 标准进度条（当前默认样式）
  generateStyle1Html(printersStatus, licenseDays, serverUptimeData = null) {
    // 过滤掉Test Mode的打印机
    const activePrinters = printersStatus.filter(p => !p.isTest);

    const getBarColor = (name) => {
      const n = (name || '').toLowerCase();
      if (n === 'black') return '#000000';
      if (n === 'cyan') return '#00bcd4';
      if (n === 'magenta') return '#e91e63';
      if (n === 'yellow') return '#ffeb3b';
      return '#9e9e9e';
    };

    // 与前端Report Preview保持一致的百分比颜色规则
    const getPercentageColor = (value) => {
      if (value < 30) return '#f44336'; // 低余量：红色
      if (value < 70) return '#ff9800'; // 中等余量：橙色
      return '#4caf50'; // 高余量：绿色
    };

    const getStatusColor = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'online' || s === 'ready') return '#4caf50';
      if (s === 'offline') return '#f44336';
      return '#ff9800';
    };

    const printerCards = activePrinters.map(printer => {
      const toner = printer.tonerLevels || {};
      const tonerItems = ['black', 'cyan', 'magenta', 'yellow'].map(color => {
        const level = toner[color] || 0;
        const barColor = getBarColor(color);
        const levelColor = getPercentageColor(level);
        return `
          <tr>
            <td style="padding: 3px 0; font-size: 13px; color: #0d47a1; font-weight: 500;">${color.charAt(0).toUpperCase() + color.slice(1)}</td>
            <td style="padding: 3px 0; width: 60%; position: relative;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="background-color: #e0e0e0; border-radius: 5px; height: 10px; padding: 0;">
                    <table width="${level}%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                      <tr><td style="background-color: ${barColor}; border-radius: 5px; height: 10px; font-size: 1px;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
            <td style="padding: 3px 0; text-align: right; font-size: 13px; color: ${levelColor}; font-weight: 600; width: 45px;">${level}%</td>
          </tr>`;
      }).join('');

      const statusColor = getStatusColor(printer.status);
      // Normalize status text: 'Ready' → 'Online', keep others as-is
      const rawStatus = (printer.status || 'unknown').toLowerCase();
      const normalizedStatus = rawStatus === 'ready' ? 'online' : rawStatus;
      const statusText = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);

      return `
        <td width="25%" valign="top" style="padding: 5px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; background: var(--background-paper, #fff); border: 1px solid #e0e0e0; border-radius: 6px; min-height: 220px;">
            <tr>
              <td style="background-color: #0d47a1; padding: 6px 8px; border-radius: 4px 4px 0 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="color: white; font-size: 0.9rem; font-weight: 600;">${printer.name || 'Unknown'}</td>
                    <td align="right" style="white-space: nowrap;">
                      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; margin-right: 4px; vertical-align: middle;"></span>
                      <span style="color: white; font-size: 0.8rem; text-transform: capitalize; vertical-align: middle;">${statusText}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px;">
                <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 0.85rem;"><strong>IP:</strong> ${printer.ip || 'N/A'}</p>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                  ${tonerItems}
                </table>
              </td>
            </tr>
          </table>
        </td>`;
    }).join('');

    // 将打印机按4个一行分组
    const rows = [];
    for (let i = 0; i < activePrinters.length; i += 4) {
      const rowCards = activePrinters.slice(i, i + 4);
      // 重新生成这一行的HTML
      const rowHtml = rowCards.map(printer => {
        const toner = printer.tonerLevels || {};
        const tonerItems = ['black', 'cyan', 'magenta', 'yellow'].map(color => {
          const level = toner[color] || 0;
          const barColor = getBarColor(color);
          const levelColor = getPercentageColor(level);
          return `
            <tr>
              <td style="padding: 3px 0; font-size: 13px; color: #0d47a1; font-weight: 500;">${color.charAt(0).toUpperCase() + color.slice(1)}</td>
              <td style="padding: 3px 0; width: 60%;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="background-color: #e0e0e0; border-radius: 5px; height: 10px; padding: 0;">
                      <table width="${level}%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                        <tr><td style="background-color: ${barColor}; border-radius: 5px; height: 10px; font-size: 1px;">&nbsp;</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="padding: 3px 0; text-align: right; font-size: 13px; color: ${levelColor}; font-weight: 600; width: 45px;">${level}%</td>
            </tr>`;
        }).join('');

        const statusColor = getStatusColor(printer.status);
        const statusText = (printer.status || 'unknown').charAt(0).toUpperCase() + (printer.status || 'unknown').slice(1);

        return `
          <td width="25%" valign="top" style="padding: 5px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border: 1px solid #e0e0e0; border-radius: 6px;">
              <tr>
                <td style="background-color: #0d47a1; padding: 6px 8px; border-radius: 4px 4px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    <tr>
                      <td style="color: white; font-size: 14px; font-weight: 600;">${printer.name || 'Unknown'}</td>
                      <td align="right" style="white-space: nowrap;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; margin-right: 4px; vertical-align: middle;"></span>
                        <span style="color: white; font-size: 13px; text-transform: capitalize; vertical-align: middle;">${statusText}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px;">
                  <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 13px;"><strong>IP:</strong> ${printer.ip || 'N/A'}</p>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    ${tonerItems}
                  </table>
                </td>
              </tr>
            </table>
          </td>`;
      }).join('');

      // 如果不足4个，补空单元格
      const emptyCells = Array(4 - rowCards.length).fill('<td width="25%" valign="top" style="padding: 5px;">&nbsp;</td>').join('');

      rows.push(`<tr>${rowHtml}${emptyCells}</tr>`);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Printer Status Weekly Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #333; line-height: 1.6; background-color: #f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; max-width: 1200px; margin: 0 auto; padding: 20px;">
<tr><td>
  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; background-color: #0d47a1; border-radius: 8px; margin-bottom: 30px;">
    <tr>
      <td align="center" style="padding: 25px 0;">
        <h1 style="margin: 0; font-size: 2rem; font-weight: 600; color: white;">Printer Status Weekly Report</h1>
        <p style="margin: 6px 0 0; font-size: 12px; color: rgba(255,255,255,0.75); font-weight: 300;">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </td>
    </tr>
  </table>

  <!-- License Status -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 35px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 25px;">
        <h2 style="color: #0d47a1; font-size: 1.5rem; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;">License Status</h2>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; background-color: #e3f2fd; border-radius: 6px; border-left: 4px solid #0d47a1;">
          <tr>
            <td align="center" style="padding: 20px;">
              <p style="margin: 0; font-size: 1.1rem; font-weight: 500;">Papercut License Remaining Days: ${licenseDays} days</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Printer Details -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 25px;">
        <h2 style="color: #0d47a1; font-size: 1.5rem; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;">Printer Details</h2>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
          ${rows.join('')}
        </table>
      </td>
    </tr>
  </table>

  ${serverUptimeData && Object.keys(serverUptimeData).length > 0 ? `
  <!-- Print Server Uptime -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 25px;">
        <h2 style="color: #0d47a1; font-size: 1.5rem; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0;">Print Server Uptime</h2>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; font-size: 14px;">
          <tr style="background-color: #0d47a1; color: white;">
            <th style="padding: 10px 12px; text-align: left;">Server Name</th>
            <th style="padding: 10px 12px; text-align: left;">IP Address</th>
            <th style="padding: 10px 12px; text-align: center;">Uptime (7d)</th>
            <th style="padding: 10px 12px; text-align: center;">Incidents</th>
          </tr>
          ${Object.values(serverUptimeData).map((server, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
            <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-weight: 600;">${server.name || 'N/A'}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-family: monospace;">${server.ip || 'N/A'}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: center;">
              <span style="color: ${server.uptimePercent >= 99 ? '#4caf50' : server.uptimePercent >= 95 ? '#ff9800' : '#f44336'}; font-weight: 600;">
                ${server.uptimePercent !== undefined ? server.uptimePercent + '%' : 'N/A'}
              </span>
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: center;">${server.incidents !== undefined ? server.incidents : 'N/A'}</td>
          </tr>
          `).join('')}
        </table>
      </td>
    </tr>
  </table>
  ` : ''}

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-top: 40px; border-top: 1px solid #e0e0e0;">
    <tr>
      <td align="center" style="padding: 20px; color: #0d47a1; font-size: 0.9rem;">
        Automatically generated by Print Service Monitoring System
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  }

  // Style 2: Modern Cards - 深绿header + 圆角大卡片 + 粗进度条 + 彩色状态标签
  generateStyle2Html(printersStatus, licenseDays, serverUptimeData = null) {
    const activePrinters = printersStatus.filter(p => !p.isTest);
    const primary = '#1b5e20';
    const primaryLight = '#e8f5e9';

    const getBarColor = (name) => {
      const n = (name || '').toLowerCase();
      if (n === 'black') return '#212121';
      if (n === 'cyan') return '#0097a7';
      if (n === 'magenta') return '#c2185b';
      if (n === 'yellow') return '#f9a825';
      return '#757575';
    };

    const getStatusBadge = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'online' || s === 'ready') return `<span style="display:inline-block;background-color:#4caf50;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;">Online</span>`;
      if (s === 'offline') return `<span style="display:inline-block;background-color:#f44336;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;">Offline</span>`;
      return `<span style="display:inline-block;background-color:#ff9800;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;">Unknown</span>`;
    };

    const colWidth = Math.floor(100 / Math.max(activePrinters.length, 1));
    const allCards = activePrinters.map(printer => {
      const toner = printer.tonerLevels || {};
      const tonerItems = ['black', 'cyan', 'magenta', 'yellow'].map(color => {
        const level = toner[color] || 0;
        const barColor = getBarColor(color);
        return `
            <tr>
              <td style="padding:3px 0;font-size:11px;color:#555;font-weight:600;width:55px;">${color.charAt(0).toUpperCase() + color.slice(1)}</td>
              <td style="padding:3px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr><td style="background-color:#e8e8e8;border-radius:7px;height:14px;padding:0;">
                    <table width="${level}%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr><td style="background-color:${barColor};border-radius:7px;height:14px;font-size:1px;">&nbsp;</td></tr>
                    </table>
                  </td></tr>
                </table>
              </td>
              <td style="padding:3px 0;text-align:right;font-size:12px;font-weight:700;width:38px;color:${level < 30 ? '#d32f2f' : level < 70 ? '#e65100' : '#2e7d32'};">${level}%</td>
            </tr>`;
      }).join('');

      return `
          <td width="${colWidth}%" valign="top" style="padding:5px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:2px solid #e0e0e0;border-radius:12px;border-top:4px solid ${primary};">
              <tr><td style="padding:12px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="font-size:14px;font-weight:700;color:#333;padding-bottom:4px;">${printer.name || 'Unknown'}</td>
                    <td align="right">${getStatusBadge(printer.status)}</td>
                  </tr>
                </table>
                <p style="margin:6px 0 10px;color:#888;font-size:12px;">IP: ${printer.ip || 'N/A'}</p>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  ${tonerItems}
                </table>
              </td></tr>
            </table>
          </td>`;
    }).join('');
    const rows = [`<tr>${allCards}</tr>`];

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Printer Status Weekly Report</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#333;line-height:1.6;background-color:#f0f4f0;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:1100px;margin:0 auto;padding:20px;">
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${primary};border-radius:12px;margin-bottom:30px;">
    <tr><td align="center" style="padding:35px 20px;">
      <h1 style="margin:0;font-size:2rem;font-weight:700;color:white;letter-spacing:0.5px;">Printer Status Weekly Report</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:30px;background-color:${primaryLight};border-radius:10px;border-left:5px solid ${primary};">
    <tr><td style="padding:20px 25px;">
      <h2 style="color:${primary};font-size:1.2rem;margin:0 0 10px;">License Status</h2>
      <p style="margin:0;font-size:1.1rem;font-weight:600;color:#333;">Papercut License Remaining: <span style="color:${primary};font-size:1.3rem;">${licenseDays}</span> days</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:20px;">
    <tr><td><h2 style="color:${primary};font-size:1.3rem;margin:0 0 15px;padding-bottom:10px;border-bottom:3px solid ${primary};">Printer Details</h2></td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.join('')}</table>
  ${serverUptimeData && Object.keys(serverUptimeData).length > 0 ? `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:30px;">
    <tr><td><h2 style="color:${primary};font-size:1.3rem;margin:0 0 15px;padding-bottom:10px;border-bottom:3px solid ${primary};">Print Server Uptime</h2></td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
    <tr style="background-color:${primary};color:white;">
      <th style="padding:12px;text-align:left;border-radius:8px 0 0 0;">Server</th>
      <th style="padding:12px;text-align:left;">IP</th>
      <th style="padding:12px;text-align:center;">Uptime</th>
      <th style="padding:12px;text-align:center;border-radius:0 8px 0 0;">Incidents</th>
    </tr>
    ${Object.values(serverUptimeData).map((server, idx) => `
    <tr style="background-color:${idx % 2 === 0 ? '#fff' : '#f5f5f5'};">
      <td style="padding:12px;border-bottom:1px solid #eee;font-weight:600;">${server.name || 'N/A'}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;font-family:monospace;">${server.ip || 'N/A'}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;font-weight:600;color:${server.uptimePercent >= 99 ? '#2e7d32' : server.uptimePercent >= 95 ? '#e65100' : '#c62828'};">${server.uptimePercent !== undefined ? server.uptimePercent + '%' : 'N/A'}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:center;">${server.incidents !== undefined ? server.incidents : 'N/A'}</td>
    </tr>`).join('')}
  </table>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:40px;border-top:2px solid #e0e0e0;">
    <tr><td align="center" style="padding:20px;color:${primary};font-size:0.9rem;">Automatically generated by Print Service Monitoring System</td></tr>
  </table>
</td></tr></table></body></html>`;
  }

  // Style 3: Table Report - 横幅header + 所有打印机在一个表格中 + 数字百分比带色块
  generateStyle3Html(printersStatus, licenseDays, serverUptimeData = null) {
    const activePrinters = printersStatus.filter(p => !p.isTest);
    const primary = '#006064';

    const getStatusHtml = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'online' || s === 'ready') return `<td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;text-align:center;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4caf50;margin-right:5px;"></span><span style="color:#2e7d32;font-weight:600;">Online</span></td>`;
      if (s === 'offline') return `<td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;text-align:center;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f44336;margin-right:5px;"></span><span style="color:#c62828;font-weight:600;">Offline</span></td>`;
      return `<td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;text-align:center;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff9800;margin-right:5px;"></span><span style="color:#e65100;font-weight:600;">Unknown</span></td>`;
    };

    const getTonerCell = (level) => {
      const bg = level < 30 ? '#ffebee' : level < 70 ? '#fff3e0' : '#e8f5e9';
      const color = level < 30 ? '#c62828' : level < 70 ? '#e65100' : '#2e7d32';
      return `<td style="padding:10px 8px;border-bottom:1px solid #e0e0e0;text-align:center;background-color:${bg};"><span style="font-weight:700;font-size:14px;color:${color};">${level}%</span></td>`;
    };

    const printerRows = activePrinters.map((printer, idx) => {
      const toner = printer.tonerLevels || {};
      return `<tr style="background-color:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
        <td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;font-weight:600;color:#333;">${printer.name || 'Unknown'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e0e0e0;font-family:monospace;color:#555;">${printer.ip || 'N/A'}</td>
        ${getStatusHtml(printer.status)}
        ${getTonerCell(toner.black || 0)}
        ${getTonerCell(toner.cyan || 0)}
        ${getTonerCell(toner.magenta || 0)}
        ${getTonerCell(toner.yellow || 0)}
      </tr>`;
    }).join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Printer Status Weekly Report</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.6;background-color:#eceff1;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:1000px;margin:0 auto;padding:20px;">
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${primary};margin-bottom:25px;">
    <tr><td style="padding:20px 30px;">
      <h1 style="margin:0;font-size:1.6rem;font-weight:700;color:white;">Printer Status Weekly Report</h1>
    </td><td align="right" style="padding:20px 30px;">
      <span style="color:rgba(255,255,255,0.9);font-size:13px;">${new Date().toLocaleDateString('en-US')}</span>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:25px;background-color:white;border:1px solid #e0e0e0;">
    <tr><td style="padding:15px 20px;border-left:4px solid ${primary};">
      <span style="font-size:14px;color:#555;">Papercut License:</span>
      <span style="font-size:18px;font-weight:700;color:${primary};margin-left:10px;">${licenseDays} days remaining</span>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:white;border:1px solid #e0e0e0;margin-bottom:25px;">
    <tr style="background-color:${primary};color:white;">
      <th style="padding:12px;text-align:left;">Printer Name</th>
      <th style="padding:12px;text-align:left;">IP Address</th>
      <th style="padding:12px;text-align:center;">Status</th>
      <th style="padding:8px;text-align:center;font-size:12px;">Black</th>
      <th style="padding:8px;text-align:center;font-size:12px;">Cyan</th>
      <th style="padding:8px;text-align:center;font-size:12px;">Magenta</th>
      <th style="padding:8px;text-align:center;font-size:12px;">Yellow</th>
    </tr>
    ${printerRows}
  </table>
  ${serverUptimeData && Object.keys(serverUptimeData).length > 0 ? `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:white;border:1px solid #e0e0e0;margin-bottom:25px;">
    <tr style="background-color:${primary};color:white;">
      <th style="padding:12px;text-align:left;">Server</th>
      <th style="padding:12px;text-align:left;">IP</th>
      <th style="padding:12px;text-align:center;">Uptime (7d)</th>
      <th style="padding:12px;text-align:center;">Incidents</th>
    </tr>
    ${Object.values(serverUptimeData).map((server, idx) => `
    <tr style="background-color:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600;">${server.name || 'N/A'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-family:monospace;">${server.ip || 'N/A'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:600;color:${server.uptimePercent >= 99 ? '#2e7d32' : '#c62828'};">${server.uptimePercent !== undefined ? server.uptimePercent + '%' : 'N/A'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${server.incidents !== undefined ? server.incidents : 'N/A'}</td>
    </tr>`).join('')}
  </table>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:20px;">
    <tr><td align="center" style="padding:15px;color:#78909c;font-size:12px;">Automatically generated by Print Service Monitoring System</td></tr>
  </table>
</td></tr></table></body></html>`;
  }

  // Style 4: Dark Executive - 深色背景 + 亮色文字 + 霓虹色进度条
  generateStyle4Html(printersStatus, licenseDays, serverUptimeData = null) {
    const activePrinters = printersStatus.filter(p => !p.isTest);
    const bgDark = '#1a1a2e';
    const bgCard = '#16213e';
    const bgSection = '#0f3460';
    const accent = '#e94560';
    const textLight = '#eaeaea';

    const getBarColor = (name) => {
      const n = (name || '').toLowerCase();
      if (n === 'black') return '#aaaaaa';
      if (n === 'cyan') return '#00e5ff';
      if (n === 'magenta') return '#ff4081';
      if (n === 'yellow') return '#ffea00';
      return '#757575';
    };

    const getStatusHtml = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'online' || s === 'ready') return `<span style="color:#00e676;font-weight:700;font-size:12px;">● ONLINE</span>`;
      if (s === 'offline') return `<span style="color:#ff1744;font-weight:700;font-size:12px;">● OFFLINE</span>`;
      return `<span style="color:#ffab00;font-weight:700;font-size:12px;">● UNKNOWN</span>`;
    };

    const rows = [];
    for (let i = 0; i < activePrinters.length; i += 4) {
      const rowCards = activePrinters.slice(i, i + 4);
      const rowHtml = rowCards.map(printer => {
        const toner = printer.tonerLevels || {};
        const tonerItems = ['black', 'cyan', 'magenta', 'yellow'].map(color => {
          const level = toner[color] || 0;
          const barColor = getBarColor(color);
          return `<tr>
            <td style="padding:3px 0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;">${color}</td>
            <td style="padding:3px 0;width:55%;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr><td style="background-color:#2a2a4a;border-radius:4px;height:8px;padding:0;">
                  <table width="${level}%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr><td style="background-color:${barColor};border-radius:4px;height:8px;font-size:1px;">&nbsp;</td></tr>
                  </table>
                </td></tr>
              </table>
            </td>
            <td style="padding:3px 0;text-align:right;font-size:12px;font-weight:700;color:${barColor};width:40px;">${level}%</td>
          </tr>`;
        }).join('');

        return `<td width="25%" valign="top" style="padding:5px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${bgCard};border-radius:8px;border:1px solid #2a2a4a;">
            <tr><td style="padding:12px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="font-size:14px;font-weight:700;color:${textLight};padding-bottom:4px;">${printer.name || 'Unknown'}</td>
                  <td align="right">${getStatusHtml(printer.status)}</td>
                </tr>
              </table>
              <p style="margin:6px 0 10px;color:#888;font-size:12px;">IP: ${printer.ip || 'N/A'}</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${tonerItems}</table>
            </td></tr>
          </table>
        </td>`;
      }).join('');
      const emptyCells = Array(4 - rowCards.length).fill('<td width="25%" valign="top" style="padding:5px;">&nbsp;</td>').join('');
      rows.push(`<tr>${rowHtml}${emptyCells}</tr>`);
    }

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Printer Status Weekly Report</title></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:${textLight};line-height:1.6;background-color:${bgDark};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:1200px;margin:0 auto;padding:20px;">
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${bgSection};border-radius:8px;margin-bottom:25px;border-left:4px solid ${accent};">
    <tr><td style="padding:25px 30px;">
      <h1 style="margin:0;font-size:1.8rem;font-weight:700;color:white;">Printer Status Weekly Report</h1>
      <p style="margin:5px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:25px;background-color:${bgCard};border-radius:8px;border:1px solid #2a2a4a;">
    <tr><td style="padding:18px 25px;">
      <span style="color:#888;font-size:13px;">LICENSE STATUS</span>
      <p style="margin:8px 0 0;font-size:1.3rem;font-weight:700;color:${accent};">${licenseDays} <span style="font-size:0.9rem;color:#aaa;font-weight:400;">days remaining</span></p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:10px;">
    <tr><td style="padding-bottom:15px;"><span style="color:#888;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Printer Details</span></td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.join('')}</table>
  ${serverUptimeData && Object.keys(serverUptimeData).length > 0 ? `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:25px;margin-bottom:10px;">
    <tr><td><span style="color:#888;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Print Server Uptime</span></td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${bgCard};border-radius:8px;border:1px solid #2a2a4a;font-size:13px;">
    <tr style="border-bottom:1px solid #2a2a4a;">
      <th style="padding:12px;text-align:left;color:#aaa;font-weight:600;">Server</th>
      <th style="padding:12px;text-align:left;color:#aaa;font-weight:600;">IP</th>
      <th style="padding:12px;text-align:center;color:#aaa;font-weight:600;">Uptime</th>
      <th style="padding:12px;text-align:center;color:#aaa;font-weight:600;">Incidents</th>
    </tr>
    ${Object.values(serverUptimeData).map(server => `
    <tr style="border-bottom:1px solid #2a2a4a;">
      <td style="padding:10px 12px;color:${textLight};font-weight:600;">${server.name || 'N/A'}</td>
      <td style="padding:10px 12px;color:#888;font-family:monospace;">${server.ip || 'N/A'}</td>
      <td style="padding:10px 12px;text-align:center;font-weight:700;color:${server.uptimePercent >= 99 ? '#00e676' : '#ff1744'};">${server.uptimePercent !== undefined ? server.uptimePercent + '%' : 'N/A'}</td>
      <td style="padding:10px 12px;text-align:center;color:#aaa;">${server.incidents !== undefined ? server.incidents : 'N/A'}</td>
    </tr>`).join('')}
  </table>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:40px;border-top:1px solid #2a2a4a;">
    <tr><td align="center" style="padding:20px;color:#666;font-size:12px;">Automatically generated by Print Service Monitoring System</td></tr>
  </table>
</td></tr></table></body></html>`;
  }

  // Style 5: Minimalist - 纯白底 + 左侧彩色竖线 + 细进度条 + 大量留白
  generateStyle5Html(printersStatus, licenseDays, serverUptimeData = null) {
    const activePrinters = printersStatus.filter(p => !p.isTest);
    const primary = '#5c6bc0';
    const accent = '#7c4dff';

    const getBarColor = (name) => {
      const n = (name || '').toLowerCase();
      if (n === 'black') return '#424242';
      if (n === 'cyan') return '#26c6da';
      if (n === 'magenta') return '#ec407a';
      if (n === 'yellow') return '#fdd835';
      return '#bdbdbd';
    };

    const getStatusText = (status) => {
      const s = (status || '').toLowerCase();
      if (s === 'online' || s === 'ready') return `<span style="color:#43a047;">Online</span>`;
      if (s === 'offline') return `<span style="color:#e53935;">Offline</span>`;
      return `<span style="color:#fb8c00;">Unknown</span>`;
    };

    const rows = [];
    for (let i = 0; i < activePrinters.length; i += 2) {
      const rowCards = activePrinters.slice(i, i + 2);
      const rowHtml = rowCards.map(printer => {
        const toner = printer.tonerLevels || {};
        const tonerItems = ['black', 'cyan', 'magenta', 'yellow'].map(color => {
          const level = toner[color] || 0;
          const barColor = getBarColor(color);
          return `<tr>
            <td style="padding:6px 0;font-size:13px;color:#666;width:80px;">${color.charAt(0).toUpperCase() + color.slice(1)}</td>
            <td style="padding:6px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr><td style="background-color:#f0f0f0;border-radius:3px;height:6px;padding:0;">
                  <table width="${level}%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr><td style="background-color:${barColor};border-radius:3px;height:6px;font-size:1px;">&nbsp;</td></tr>
                  </table>
                </td></tr>
              </table>
            </td>
            <td style="padding:6px 0;text-align:right;font-size:13px;color:#555;width:45px;">${level}%</td>
          </tr>`;
        }).join('');

        return `<td width="50%" valign="top" style="padding:10px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-left:3px solid ${accent};padding-left:0;">
            <tr><td style="padding:15px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="font-size:16px;font-weight:600;color:#333;">${printer.name || 'Unknown'}</td>
                  <td align="right" style="font-size:13px;font-weight:500;">${getStatusText(printer.status)}</td>
                </tr>
              </table>
              <p style="margin:6px 0 15px;color:#999;font-size:12px;">${printer.ip || 'N/A'}${printer.model ? ' · ' + printer.model : ''}</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${tonerItems}</table>
            </td></tr>
          </table>
        </td>`;
      }).join('');
      const emptyCells = rowCards.length < 2 ? '<td width="50%" valign="top" style="padding:10px;">&nbsp;</td>' : '';
      rows.push(`<tr>${rowHtml}${emptyCells}</tr>`);
    }

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Printer Status Weekly Report</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;line-height:1.7;background-color:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:900px;margin:0 auto;padding:40px 20px;">
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:40px;">
    <tr><td>
      <h1 style="margin:0;font-size:1.8rem;font-weight:300;color:#333;letter-spacing:-0.5px;">Printer Status <span style="font-weight:600;">Weekly Report</span></h1>
      <p style="margin:8px 0 0;color:#999;font-size:13px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:40px;border-left:3px solid ${primary};">
    <tr><td style="padding:12px 20px;">
      <span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;">License</span>
      <p style="margin:4px 0 0;font-size:1.5rem;font-weight:300;color:#333;">${licenseDays} <span style="font-size:0.9rem;color:#888;">days remaining</span></p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:20px;">
    <tr><td><span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;">Printers</span></td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.join('')}</table>
  ${serverUptimeData && Object.keys(serverUptimeData).length > 0 ? `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:40px;margin-bottom:15px;">
    <tr><td><span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;">Server Uptime</span></td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;">
    <tr style="border-bottom:2px solid #eee;">
      <th style="padding:10px 0;text-align:left;color:#999;font-weight:500;font-size:12px;text-transform:uppercase;">Server</th>
      <th style="padding:10px 0;text-align:left;color:#999;font-weight:500;font-size:12px;text-transform:uppercase;">IP</th>
      <th style="padding:10px 0;text-align:center;color:#999;font-weight:500;font-size:12px;text-transform:uppercase;">Uptime</th>
      <th style="padding:10px 0;text-align:center;color:#999;font-weight:500;font-size:12px;text-transform:uppercase;">Incidents</th>
    </tr>
    ${Object.values(serverUptimeData).map(server => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:12px 0;font-weight:500;">${server.name || 'N/A'}</td>
      <td style="padding:12px 0;color:#888;font-family:monospace;">${server.ip || 'N/A'}</td>
      <td style="padding:12px 0;text-align:center;font-weight:500;color:${server.uptimePercent >= 99 ? '#43a047' : '#e53935'};">${server.uptimePercent !== undefined ? server.uptimePercent + '%' : 'N/A'}</td>
      <td style="padding:12px 0;text-align:center;color:#888;">${server.incidents !== undefined ? server.incidents : 'N/A'}</td>
    </tr>`).join('')}
  </table>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:50px;">
    <tr><td align="center" style="padding:20px 0;color:#ccc;font-size:11px;">Automatically generated by Print Service Monitoring System</td></tr>
  </table>
</td></tr></table></body></html>`;
  }
  
  // 增强HTML内容以确保在Outlook中转发时格式不变
  enhanceEmailHtmlForOutlook(htmlContent) {
    // 前端已生成完整的、自包含的HTML文档（含inline styles）
    // 直接返回，不做额外包装，避免SMTP relay处理multipart/嵌套HTML结构时出错
    return htmlContent;
  }

  // 生成纯文本版本的邮件，作为HTML版本的备选
  generatePlainTextEmail(emailData) {
    const { startDate, endDate, toEmail, fromEmail } = emailData;
    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US');
    };
    
    const reportStartDate = startDate ? formatDate(startDate) : 'N/A';
    const reportEndDate = endDate ? formatDate(endDate) : 'N/A';
    
    return `Printer Status Weekly Report

Report Period: ${reportStartDate} to ${reportEndDate}
To: ${toEmail}
From: ${fromEmail}
Generated: ${new Date().toLocaleString('en-US')}

This is an automated printer status report. Please view the HTML version for detailed information.

If you cannot view the HTML version, please contact your system administrator.`;
  }
  
  // 发送周报邮件（生成HTML版本）
  async sendWeeklyReport(printerData, licenseDays, emailData) {
    try {
      const { startDate, endDate, toEmail, fromEmail, ccEmail } = emailData;
      
      // 生成HTML内容 - 传递完整的emailData给模板
      const htmlContent = this.generateWeeklyReportHTML(printerData, licenseDays, startDate, endDate, emailData);
      
      // 设置邮件主题 - 格式为[Report]Printer Status Weekly Report -Date
      const sendDate = new Date().toLocaleDateString('en-US');
      const subject = `[Report]Printer Status Weekly Report - ${sendDate}`;
      
      // 准备邮件选项
      const mailOptions = {
        from: fromEmail,
        to: toEmail.split(/[,;]/).map(email => email.trim()).filter(email => email),
        subject: subject,
        html: htmlContent
      };
      
      // 添加抄送人
      if (ccEmail) {
        mailOptions.cc = ccEmail.split(/[,;]/).map(email => email.trim()).filter(email => email);
      }
      
      // 发送邮件
      const result = await sendMailWithRetry({
        createTransporter: () => {
          this.transporter = this.createTransporter();
          return this.transporter;
        },
        mailOptions,
        contextLabel: 'Weekly report email',
        logger: console
      });
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error('Error sending weekly report:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  }
}

module.exports = EmailService;