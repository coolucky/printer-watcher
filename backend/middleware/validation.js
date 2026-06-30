/**
 * 输入验证中间件和工具函数
 * 用于验证API请求的输入数据
 */

// 验证IP地址格式
const validateIP = (ip) => {
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

// 验证MAC地址格式
const validateMAC = (mac) => {
  if (!mac) return true; // MAC可选
  const macPattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macPattern.test(mac);
};

// 验证端口号
const validatePort = (port) => {
  const num = parseInt(port, 10);
  return num >= 1 && num <= 65535;
};

// 验证打印机对象
const validatePrinter = (printer) => {
  const errors = [];
  
  if (!printer.name || typeof printer.name !== 'string' || printer.name.trim() === '') {
    errors.push('Printer name is required');
  }
  
  if (!printer.ip || !validateIP(printer.ip)) {
    errors.push('Invalid IP address');
  }
  
  if (printer.port && !validatePort(printer.port)) {
    errors.push('Port must be between 1 and 65535');
  }
  
  if (printer.macAddress && !validateMAC(printer.macAddress)) {
    errors.push('Invalid MAC address format');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// 验证电子邮件
const validateEmail = (email) => {
  if (!email) return true; // Email可选
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

// 验证对象不为空
const validateNotEmpty = (obj, fields) => {
  const errors = [];
  fields.forEach(field => {
    if (!obj[field] || obj[field].toString().trim() === '') {
      errors.push(`${field} is required`);
    }
  });
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Express 中间件：验证打印机数据
 */
const validatePrinterMiddleware = (req, res, next) => {
  if (['POST', 'PUT'].includes(req.method)) {
    const printer = req.body;
    const validation = validatePrinter(printer);
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }
  }
  next();
};

/**
 * Express 中间件：清理用户输入
 * 防止XSS攻击
 */
const sanitizeInputMiddleware = (req, res, next) => {
  // 允许包含HTML内容的路由和字段（用于邮件发送）
  const htmlAllowedFields = new Set(['reportHtml', 'html', 'htmlContent']);
  const isHtmlRoute = req.path && req.path.includes('/send-report');

  // 递归清理字符串字段
  const sanitizeValue = (value, key) => {
    if (typeof value === 'string') {
      // 邮件HTML内容字段跳过清理
      if (isHtmlRoute && htmlAllowedFields.has(key)) {
        return value;
      }
      // 移除危险的HTML/JS字符
      return value
        .replace(/[<>]/g, '')
        .trim();
    }
    if (typeof value === 'object' && value !== null) {
      Object.keys(value).forEach(k => {
        value[k] = sanitizeValue(value[k], k);
      });
    }
    return value;
  };
  
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(k => {
      req.body[k] = sanitizeValue(req.body[k], k);
    });
  }
  
  next();
};

/**
 * Express 中间件：防止注入攻击
 */
const preventInjectionMiddleware = (req, res, next) => {
  const hasInjection = (value) => {
    if (typeof value !== 'string') return false;
    
    const dangerousPatterns = [
      /;[\s]*drop/i,
      /;[\s]*delete/i,
      /;[\s]*insert/i,
      /;[\s]*update/i,
      /union[\s]+select/i,
      /exec\(/i,
      /eval\(/i
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(value));
  };
  
  const checkObject = (obj) => {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (hasInjection(obj[key]) || hasInjection(key)) {
          return true;
        }
        if (typeof obj[key] === 'object' && checkObject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({
      error: 'Invalid input detected'
    });
  }
  
  next();
};

module.exports = {
  validateIP,
  validateMAC,
  validatePort,
  validatePrinter,
  validateEmail,
  validateNotEmpty,
  validatePrinterMiddleware,
  sanitizeInputMiddleware,
  preventInjectionMiddleware
};
