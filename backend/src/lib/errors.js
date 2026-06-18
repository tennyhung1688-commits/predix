/**
 * 统一错误处理模块
 * - 生产环境隐藏 5xx 错误细节，只返回通用消息
 * - 4xx 客户端错误保留原消息（用户需要知道原因）
 * - 所有错误统一记入结构化日志
 */
const logger = require('./logger');

/**
 * 应用错误类 — 用于业务层抛出可预期的错误
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * 统一错误响应发送函数
 * @param {Response} res - Express response
 * @param {Error} err - 错误对象
 * @param {number} statusCode - HTTP 状态码，默认 500
 */
function sendError(res, err, statusCode = 500) {
  const isProduction = process.env.NODE_ENV === 'production';
  const code = err.statusCode || statusCode;

  // 5xx 错误记入日志
  if (code >= 500) {
    logger.error({ err: err.message, stack: err.stack, statusCode: code }, 'Server error');
  }

  // 生产环境：5xx 返回通用消息；4xx 保留原始消息
  const message = (isProduction && code >= 500)
    ? '服务器内部错误，请稍后重试'
    : err.message || '未知错误';

  res.status(code).json({ success: false, error: message });
}

/**
 * Express 全局错误处理中间件（4 参数）
 * 捕获所有 next(err) 传递的错误
 */
function globalErrorHandler(err, _req, res, _next) {
  sendError(res, err);
}

module.exports = { AppError, sendError, globalErrorHandler };
