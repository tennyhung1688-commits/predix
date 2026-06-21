/**
 * 共享 JWT 认证中间件
 * 从 Authorization header 提取 token，验证并设置 req.user
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../lib/prisma');

// 提取用户信息到 req.user（全局中间件，对所有路由生效）
async function extractUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      // 支持 wallet / email / twitter 等认证方式
      const where = decoded.walletAddress
        ? { walletAddress: decoded.walletAddress }
        : decoded.email
        ? { email: decoded.email }
        : decoded.id
        ? { id: decoded.id }
        : null;
      if (where) {
        const user = await prisma.user.findUnique({ where });
        if (user) {
          req.user = {
            id: user.id,
            walletAddress: user.walletAddress,
            role: user.role,
            balance: user.balance,
            lockedBalance: user.lockedBalance,
          };
        }
      }
    } catch {
      // token 无效，继续但不设置 user
    }
  }
  next();
}

// 要求已认证的中间件
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, error: '请先登录' });
  }
  next();
}

// 要求管理员权限的中间件
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: '未登录' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: '无管理员权限' });
  }
  next();
}

module.exports = { extractUser, requireAuth, requireAdmin };
