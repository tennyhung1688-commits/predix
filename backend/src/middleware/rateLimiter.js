/**
 * 速率限制中间件
 * - 全局限制：防止整体 API 滥用
 * - 认证接口限制：防止暴力登录
 * - 交易接口限制：防止刷单
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// 获取可信代理配置（Docker 环境下需要 trust proxy）
const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production';

// IP-based key generator factory（包装 ipKeyGenerator 以正确处理 IPv6）
const ipBasedKeyGenerator = (req) => ipKeyGenerator(req) || req.ip || 'unknown';

// 用户优先 + IP 回退的 key generator
const userBasedKeyGenerator = (req) => {
  const wallet = req.user?.walletAddress;
  if (wallet) return wallet;
  return ipKeyGenerator(req) || req.ip || 'unknown';
};

// 通用 API 全局限流：15 分钟内最多 1000 次请求
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
  keyGenerator: ipBasedKeyGenerator,
});

// 认证接口限流：15 分钟内最多 30 次登录尝试
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '登录请求过于频繁，请15分钟后再试' },
  keyGenerator: ipBasedKeyGenerator,
});

// 交易接口限流：1 分钟内最多 60 次（平均每秒 1 次）
const tradingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '交易请求过于频繁，请稍后再试' },
  keyGenerator: userBasedKeyGenerator,
});

// 提现接口限流：15 分钟内最多 5 次
const withdrawLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '提现请求过于频繁，请15分钟后再试' },
  keyGenerator: userBasedKeyGenerator,
});

// 管理接口限流：1 分钟内最多 120 次
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
  keyGenerator: userBasedKeyGenerator,
});

// 评论接口限流：1 分钟内最多发 10 条评论，5 分钟内最多 30 次点赞
const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 涵盖评论、回复、删除、点赞
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '评论操作过于频繁，请稍后再试' },
  keyGenerator: userBasedKeyGenerator,
});

module.exports = {
  globalLimiter,
  authLimiter,
  tradingLimiter,
  withdrawLimiter,
  adminLimiter,
  commentLimiter,
};
