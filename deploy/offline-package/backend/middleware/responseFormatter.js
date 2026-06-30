/**
 * API 响应格式统一处理工具
 * 确保所有 API 端点返回相同的响应结构
 */

/**
 * 成功响应格式
 * @param {*} data - 响应数据
 * @param {string} message - 响应消息
 * @param {number} code - HTTP状态码
 */
const successResponse = (data = null, message = 'Success', code = 200) => {
  return {
    code,
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

/**
 * 错误响应格式
 * @param {string} message - 错误消息
 * @param {number} code - HTTP状态码
 * @param {*} details - 错误详情
 */
const errorResponse = (message = 'Error', code = 500, details = null) => {
  return {
    code,
    success: false,
    message,
    details,
    timestamp: new Date().toISOString()
  };
};

/**
 * 分页响应格式
 * @param {Array} items - 数据项数组
 * @param {number} total - 总数
 * @param {number} page - 当前页
 * @param {number} pageSize - 每页数量
 * @param {string} message - 响应消息
 */
const paginatedResponse = (items = [], total = 0, page = 1, pageSize = 10, message = 'Success') => {
  const totalPages = Math.ceil(total / pageSize);
  return {
    code: 200,
    success: true,
    message,
    data: {
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    },
    timestamp: new Date().toISOString()
  };
};

/**
 * Express 响应助手 - 在路由中使用
 * 示例: res.apiSuccess(data, 'Data fetched successfully')
 */
const responseHelperMiddleware = (req, res, next) => {
  // 成功响应方法
  res.apiSuccess = (data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json(successResponse(data, message, statusCode));
  };

  // 错误响应方法
  res.apiError = (message = 'Error', statusCode = 500, details = null) => {
    return res.status(statusCode).json(errorResponse(message, statusCode, details));
  };

  // 分页响应方法
  res.apiPaginated = (items = [], total = 0, page = 1, pageSize = 10, message = 'Success') => {
    return res.status(200).json(paginatedResponse(items, total, page, pageSize, message));
  };

  next();
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  responseHelperMiddleware
};
