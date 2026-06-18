/**
 * 审计日志中间件
 * 记录所有敏感操作（交易、提现、管理操作）到结构化日志，
 * 包含 who/when/what/ip 等信息，满足金融合规追溯需求
 */
const logger = require('../lib/logger');

// 审计事件类型
const AUDIT_EVENTS = {
  LOGIN: 'user.login',
  ORDER_CREATE: 'trade.order.create',
  ORDER_CANCEL: 'trade.order.cancel',
  DEPOSIT: 'balance.deposit',
  WITHDRAW: 'balance.withdraw',
  WITHDRAW_PROCESS: 'admin.withdraw.process',
  SETTLE_MARKET: 'admin.settle',
  COMBO_CREATE: 'trade.combo.create',
  ALERT_CREATE: 'alert.create',
  COMMENT_CREATE: 'comment.create',
};

/**
 * 创建审计日志条目
 * @param {object} req - Express 请求对象
 * @param {string} action - 操作类型（AUDIT_EVENTS 中的值）
 * @param {object} details - 操作详情
 * @param {string} result - 结果：'success' | 'failure'
 * @param {string|null} errorMsg - 错误信息
 */
function auditLog(req, action, details = {}, result = 'success', errorMsg = null) {
  const entry = {
    audit: true,
    action,
    result,
    timestamp: new Date().toISOString(),
    userId: req.user?.id || null,
    walletAddress: req.user?.walletAddress || null,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    method: req.method,
    path: req.originalUrl || req.url,
    details,
  };

  if (errorMsg) {
    entry.error = errorMsg;
  }

  if (result === 'failure') {
    logger.warn(entry, `AUDIT FAIL: ${action}`);
  } else {
    logger.info(entry, `AUDIT: ${action}`);
  }
}

/**
 * Express 中间件工厂函数
 * 在请求处理成功后自动记录审计日志
 *
 * @param {string} action - 操作类型
 * @param {function} detailsExtractor - 从 req 和 res 提取详情的函数
 * @returns {function} Express 中间件
 */
function auditMiddleware(action, detailsExtractor) {
  return (req, res, next) => {
    // 拦截 res.json 以获取响应结果
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const result = body?.success !== false ? 'success' : 'failure';
      const errorMsg = body?.success === false ? body?.error || 'unknown' : null;
      const details = detailsExtractor ? detailsExtractor(req, body) : {};
      auditLog(req, action, details, result, errorMsg);
      return originalJson(body);
    };
    next();
  };
}

module.exports = { auditLog, auditMiddleware, AUDIT_EVENTS };
