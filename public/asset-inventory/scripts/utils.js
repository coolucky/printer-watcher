// ============================================
// 工具函数
// ============================================

// 格式化日期
function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 格式化时间
function formatTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 格式化日期时间
function formatDateTime(date = new Date()) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// 判断是否为工作日
function isWorkday(date = new Date()) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // 周一到周五
}

// 导出到全局作用域，以便其他脚本可以访问
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatDateTime = formatDateTime;
window.isWorkday = isWorkday;
