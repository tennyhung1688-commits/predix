/**
 * CSRF 保护中间件 — 双重提交 Cookie 模式
 *
 * 适用于 SPA + JWT Bearer token 场景（管理面板如使用 cookie 鉴权，则本中间件提供额外防护）。
 *
 * 原理：
 * 1. 后端在首次请求时下发一个随机 CSRF token 到 httpOnly=false 的 cookie
 * 2. 前端从 cookie 读取 token，并在每次状态变更请求中通过 X-CSRF-Token 请求头携带
 * 3. 后端比对 cookie 中的 token 和请求头中的 token，一致才放行
 *
 * 安全属性：
 * - SameSite=Strict: 防止跨站请求携带 cookie
 * - httpOnly=false: 允许前端 JS 读取 cookie 值（用于回显到请求头）
 * - Secure=true (生产环境): 仅 HTTPS 传输
 * - Token 长度 32 字节随机 hex
 */

const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

// 需要 CSRF 保护的方法
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// 不需要 CSRF 保护的白名单路径
const CSRF_WHITELIST = [
  '/api/auth/login',
  '/api/health',
];

/**
 * 生成 CSRF token 并设置 cookie
 */
function generateToken(req, res) {
  const token = crypto.randomBytes(TOKEN_LENGTH).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,   // 前端需要读取
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 小时
  });
  return token;
}

/**
 * Express CSRF 中间件
 * - 为 GET/HEAD 等安全方法设置 cookie
 * - 为 POST/PUT/DELETE 等方法校验 token
 */
function csrfProtection(req, res, next) {
  // 白名单路径跳过
  if (CSRF_WHITELIST.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // 非 API 路径跳过
  if (!req.path.startsWith('/api')) {
    return next();
  }

  // 安全方法：下发 CSRF cookie
  if (!PROTECTED_METHODS.includes(req.method)) {
    // 如果请求还没有 CSRF cookie，下发一个
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      generateToken(req, res);
    }
    return next();
  }

  // 状态变更方法：校验 CSRF token
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF 验证失败：缺少 token',
    });
  }

  // 恒定时间比较防止时序攻击
  if (!crypto.timingSafeEqual(
    Buffer.from(cookieToken, 'utf8'),
    Buffer.from(headerToken, 'utf8')
  )) {
    return res.status(403).json({
      success: false,
      error: 'CSRF 验证失败：token 不匹配',
    });
  }

  next();
}

module.exports = csrfProtection;
