const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../lib/prisma');
const { authLimiter } = require('../middleware/rateLimiter');
const { loginRules, emailLoginRules, registerRules, handleValidation } = require('../middleware/validate');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const logger = require('../lib/logger');
const { sendError } = require('../lib/errors');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

/** 生成随机推荐码（8位十六进制） */
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex');
}

/** 签发 JWT */
function signToken(user) {
  return jwt.sign(
    { id: user.id, walletAddress: user.walletAddress, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
}

/** 序列化用户返回 */
function serializeUser(user) {
  return {
    id: user.id,
    walletAddress: user.walletAddress,
    email: user.email,
    username: user.username,
    role: user.role,
    balance: user.balance,
    lockedBalance: user.lockedBalance,
    totalDeposited: user.totalDeposited,
    totalWithdrawn: user.totalWithdrawn,
    tradeVolume: user.tradeVolume,
    feePaid: user.feePaid,
    referralCode: user.referralCode,
    referralEarnings: user.referralEarnings,
    createdAt: user.createdAt.toISOString(),
  };
}

// 钱包地址登录
router.post('/login',
  authLimiter,
  loginRules,
  handleValidation,
  auditMiddleware(AUDIT_EVENTS.LOGIN, (req) => ({ walletAddress: req.body.walletAddress?.toLowerCase() })),
  async (req, res) => {
  try {
    const { walletAddress, referralCode } = req.body;
    const addr = walletAddress.toLowerCase();

    let user = await prisma.user.findUnique({ where: { walletAddress: addr } });
    if (!user) {
      let referredBy = null;
      if (referralCode) {
        const inviter = await prisma.user.findUnique({ where: { referralCode } });
        if (inviter?.id) referredBy = inviter.id;
      }
      for (let i = 0; i < 5; i++) {
        try {
          const code = generateReferralCode();
          user = await prisma.user.create({
            data: {
              walletAddress: addr,
              referralCode: code,
              ...(referredBy ? { referredBy } : {}),
            },
          });
          break;
        } catch (err) {
          if (err.code !== 'P2002') throw err;
          if (i === 4) throw new Error('推荐码生成冲突，请重试');
        }
      }
    }

    const token = signToken(user);
    res.json({ success: true, data: { token, user: serializeUser(user) } });
  } catch (err) {
    console.error('[auth/login] 捕获错误:', { message: err.message, code: err.code, meta: err.meta, stack: err.stack });
    sendError(res, err);
  }
});

// 邮箱注册
router.post('/register',
  authLimiter,
  registerRules,
  handleValidation,
  async (req, res) => {
    try {
      const { email, password, username } = req.body;

      // 查重
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ success: false, error: '该邮箱已被注册' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      let user = null;
      for (let i = 0; i < 5; i++) {
        try {
          const code = generateReferralCode();
          user = await prisma.user.create({
            data: {
              email,
              passwordHash,
              username: username?.trim() || null,
              referralCode: code,
            },
          });
          break;
        } catch (err) {
          if (err.code !== 'P2002') throw err;
          if (i === 4) throw new Error('推荐码生成冲突，请重试');
        }
      }

      const token = signToken(user);
      logger.info({ userId: user.id, email }, '用户注册成功');
      res.status(201).json({ success: true, data: { token, user: serializeUser(user) } });
    } catch (err) {
      console.error('[auth/register] 捕获错误:', { message: err.message, code: err.code, stack: err.stack });
      sendError(res, err);
    }
  }
);

// 邮箱密码登录
router.post('/login/email',
  authLimiter,
  emailLoginRules,
  handleValidation,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ success: false, error: '邮箱或密码错误' });
      }
      if (!user.passwordHash) {
        return res.status(401).json({ success: false, error: '该账号未设置密码，请使用钱包登录' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ success: false, error: '邮箱或密码错误' });
      }

      const token = signToken(user);
      logger.info({ userId: user.id, email }, '邮箱登录成功');
      res.json({ success: true, data: { token, user: serializeUser(user) } });
    } catch (err) {
      console.error('[auth/login/email] 捕获错误:', { message: err.message, stack: err.stack });
      sendError(res, err);
    }
  }
);

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    // 兼容钱包用户和邮箱用户
    const where = {};
    if (decoded.walletAddress) where.walletAddress = decoded.walletAddress;
    else if (decoded.email) where.email = decoded.email;
    else if (decoded.id) where.id = decoded.id;
    else return res.status(401).json({ success: false, error: 'Token 无效' });

    const user = await prisma.user.findUnique({ where });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    res.json({
      success: true,
      data: serializeUser(user),
    });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Token 无效' });
  }
});

module.exports = router;
