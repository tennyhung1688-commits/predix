const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../lib/prisma');
const { authLimiter } = require('../middleware/rateLimiter');
const { loginRules, handleValidation } = require('../middleware/validate');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const logger = require('../lib/logger');
const { sendError } = require('../lib/errors');

const router = express.Router();

/** 生成随机推荐码（8位十六进制） */
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex');
}

// 注册/登录（基于钱包地址）— 限流 + 校验 + 审计
router.post('/login',
  authLimiter,
  loginRules,
  handleValidation,
  auditMiddleware(AUDIT_EVENTS.LOGIN, (req) => ({ walletAddress: req.body.walletAddress?.toLowerCase() })),
  async (req, res) => {
  try {
    const { walletAddress, referralCode } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ success: false, error: '缺少钱包地址' });
    }

    const addr = walletAddress.toLowerCase();

    // 查找或创建用户
    let user = await prisma.user.findUnique({ where: { walletAddress: addr } });
    if (!user) {
      // 解析邀请人
      let referredBy = null;
      if (referralCode) {
        const inviter = await prisma.user.findUnique({ where: { referralCode } });
        if (inviter && inviter.id) {
          referredBy = inviter.id;
        }
      }

      // 生成唯一推荐码（最多重试5次）
      let newReferralCode = null;
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
          newReferralCode = code;
          break;
        } catch (err) {
          logger.error({ err: err.message, stack: err.stack, attempt: i + 1 }, '用户创建失败');
          // 只有唯一约束冲突才重试，其他错误（连接失败、表不存在等）直接抛出
          if (err.code !== 'P2002') {
            throw err;
          }
          if (i === 4) throw new Error('推荐码生成冲突，请重试');
        }
      }
    }

    const token = jwt.sign(
      { id: user.id, walletAddress: user.walletAddress, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
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
        },
      },
    });
  } catch (err) {
    // 临时：打印完整错误到 stdout，方便 Render 日志排查
    console.error('[auth/login] 捕获错误:', {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
    });
    sendError(res, err);
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { walletAddress: decoded.walletAddress },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        walletAddress: user.walletAddress,
        role: user.role,
        balance: user.balance,
        lockedBalance: user.lockedBalance,
        available: user.balance - user.lockedBalance,
        totalDeposited: user.totalDeposited,
        totalWithdrawn: user.totalWithdrawn,
        tradeVolume: user.tradeVolume,
        feePaid: user.feePaid,
        referralCode: user.referralCode,
        referralEarnings: user.referralEarnings,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Token 无效' });
  }
});

module.exports = router;
