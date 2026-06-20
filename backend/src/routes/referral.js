const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { sendError } = require('../lib/errors');

const router = express.Router();

/**
 * 生成随机推荐码（8位字母数字）
 */
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex'); // 8 chars
}

/**
 * 为没有推荐码的用户补发推荐码
 */
async function ensureReferralCode(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.referralCode) return user.referralCode;

  // 生成唯一推荐码（最多重试5次）
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
      return code;
    } catch {
      // 唯一约束冲突，重试
    }
  }
  return null;
}

// ==================== 获取推荐信息 ====================
// GET /api/referral
router.get('/referral', requireAuth, async (req, res) => {
  try {
    // 确保用户有推荐码
    const referralCode = await ensureReferralCode(req.user.id);
    if (!referralCode) {
      return res.status(500).json({ success: false, error: '推荐码生成失败' });
    }

    // 获取被邀请用户列表
    const invitedUsers = await prisma.user.findMany({
      where: { referredBy: req.user.id },
      select: {
        id: true,
        walletAddress: true,
        tradeVolume: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 获取佣金收益明细
    const earnings = await prisma.referralEarning.findMany({
      where: { referrerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 汇总统计
    const totalEarnings = earnings
      .filter(e => e.status === 'credited')
      .reduce((sum, e) => sum + e.commission, 0);

    const pendingEarnings = earnings
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + e.commission, 0);

    // 邀请链接
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const referralLink = `${frontendUrl}/?ref=${referralCode}`;

    res.json({
      success: true,
      data: {
        referralCode,
        referralLink,
        totalEarnings,
        pendingEarnings,
        invitedCount: invitedUsers.length,
        invitedUsers,
        earnings,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ==================== 生成/获取推荐码 ====================
// POST /api/referral/generate-code
router.post('/referral/generate-code', requireAuth, async (req, res) => {
  try {
    const code = await ensureReferralCode(req.user.id);
    if (!code) {
      return res.status(500).json({ success: false, error: '推荐码生成失败' });
    }
    res.json({ success: true, data: { referralCode: code } });
  } catch (err) {
    sendError(res, err);
  }
});

// ==================== 通过推荐码查找邀请人 ====================
// GET /api/referral/lookup/:code (无需认证，注册时调用)
router.get('/referral/lookup/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const inviter = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, walletAddress: true },
    });

    if (!inviter) {
      return res.status(404).json({ success: false, error: '推荐码无效' });
    }

    res.json({ success: true, data: { inviterId: inviter.id } });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
