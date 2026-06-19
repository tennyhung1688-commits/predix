const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { sendError } = require('../lib/errors');

const router = express.Router();

// ========== 等级计算 ==========
// 根据累计邀请人数返回等级和佣金率
function getReferralTier(inviteCount) {
  if (inviteCount >= 50) return { tier: 'diamond',  label: '💎 钻石', l1Rate: 0.35, l2Rate: 0.15 };
  if (inviteCount >= 20) return { tier: 'gold',     label: '🥇 黄金', l1Rate: 0.30, l2Rate: 0.10 };
  if (inviteCount >= 5)  return { tier: 'silver',   label: '🥈 白银', l1Rate: 0.25, l2Rate: 0.05 };
  return                 { tier: 'bronze',  label: '🥉 青铜', l1Rate: 0.20, l2Rate: 0.00 };
}

// ========== 辅助 ==========
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex');
}

async function ensureReferralCode(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.referralCode) return user.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch { /* retry on unique conflict */ }
  }
  return null;
}

// ========== GET /api/referral ==========
router.get('/referral', requireAuth, async (req, res) => {
  try {
    const referralCode = await ensureReferralCode(req.user.id);
    if (!referralCode) return res.status(500).json({ success: false, error: '推荐码生成失败' });

    // L1 — 直接邀请
    const l1Users = await prisma.user.findMany({
      where: { referredBy: req.user.id },
      select: { id: true, walletAddress: true, tradeVolume: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // L2 — 间接邀请（被邀请人的被邀请人）
    const l2UserIds = l1Users.map(u => u.id);
    const l2Users = l2UserIds.length > 0
      ? await prisma.user.findMany({
          where: { referredBy: { in: l2UserIds } },
          select: { id: true, walletAddress: true, tradeVolume: true, createdAt: true, referredBy: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // 佣金明细
    const earnings = await prisma.referralEarning.findMany({
      where: { referrerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 统计
    const totalEarnings = earnings.filter(e => e.status === 'credited').reduce((s, e) => s + e.commission, 0);
    const pendingEarnings = earnings.filter(e => e.status === 'pending').reduce((s, e) => s + e.commission, 0);
    const l1Earnings = earnings.filter(e => e.level === 1).reduce((s, e) => s + e.commission, 0);
    const l2Earnings = earnings.filter(e => e.level === 2).reduce((s, e) => s + e.commission, 0);

    // 等级
    const totalInvites = l1Users.length;
    const tier = getReferralTier(totalInvites);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    res.json({
      success: true,
      data: {
        referralCode,
        referralLink: `${frontendUrl}/?ref=${referralCode}`,
        totalEarnings,
        pendingEarnings,
        l1Earnings,
        l2Earnings,
        invitedCount: totalInvites,
        tier,
        invitedUsers: l1Users,
        l2Users,
        earnings,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ========== POST /api/referral/generate-code ==========
router.post('/referral/generate-code', requireAuth, async (req, res) => {
  try {
    const code = await ensureReferralCode(req.user.id);
    if (!code) return res.status(500).json({ success: false, error: '推荐码生成失败' });
    res.json({ success: true, data: { referralCode: code } });
  } catch (err) {
    sendError(res, err);
  }
});

// ========== GET /api/referral/lookup/:code ==========
router.get('/referral/lookup/:code', async (req, res) => {
  try {
    const inviter = await prisma.user.findUnique({
      where: { referralCode: req.params.code },
      select: { id: true, walletAddress: true },
    });
    if (!inviter) return res.status(404).json({ success: false, error: '推荐码无效' });
    res.json({ success: true, data: { inviterId: inviter.id } });
  } catch (err) {
    sendError(res, err);
  }
});

// ========== GET /api/referral/leaderboard ==========
router.get('/referral/leaderboard', async (req, res) => {
  try {
    const period = req.query.period || 'all'; // all | month

    // 总榜：按累计佣金排序
    const topReferrers = await prisma.referralEarning.groupBy({
      by: ['referrerId'],
      _sum: { commission: true },
      _count: { id: true },
      where: {
        status: 'credited',
        ...(period === 'month' ? { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } : {}),
      },
      orderBy: { _sum: { commission: 'desc' } },
      take: 50,
    });

    // 获取用户信息
    const userIds = topReferrers.map(r => r.referrerId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, walletAddress: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const leaderboard = topReferrers.map((r, i) => ({
      rank: i + 1,
      walletAddress: userMap.get(r.referrerId)?.walletAddress || '',
      totalCommission: r._sum.commission || 0,
      referralCount: r._count.id || 0,
    }));

    res.json({ success: true, data: leaderboard });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;

// ========== 导出供 trading.js 记录返佣 ==========
async function recordReferralEarnings(userId, tradeId, spreadFee) {
  if (spreadFee <= 0) return;

  // L1 — 用户是被邀请的
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredBy: true },
  });
  if (!user?.referredBy) return;

  const l1Referrer = user.referredBy;

  // 计算 L1 佣金
  const l1InviteCount = await prisma.user.count({ where: { referredBy: l1Referrer } });
  const l1Tier = getReferralTier(l1InviteCount);
  const l1Commission = spreadFee * l1Tier.l1Rate;

  await prisma.referralEarning.create({
    data: {
      referrerId: l1Referrer,
      referredId: userId,
      tradeId,
      tradeFee: spreadFee,
      commission: l1Commission,
      rate: l1Tier.l1Rate,
      level: 1,
    },
  });

  // L2 — 邀请人也有被邀请人
  const l1User = await prisma.user.findUnique({
    where: { id: l1Referrer },
    select: { referredBy: true },
  });
  if (!l1User?.referredBy) return;

  const l2Referrer = l1User.referredBy;
  const l2InviteCount = await prisma.user.count({ where: { referredBy: l2Referrer } });
  const l2Tier = getReferralTier(l2InviteCount);
  if (l2Tier.l2Rate <= 0) return; // 青铜没有 L2

  const l2Commission = spreadFee * l2Tier.l2Rate;
  await prisma.referralEarning.create({
    data: {
      referrerId: l2Referrer,
      referredId: userId,
      tradeId,
      tradeFee: spreadFee,
      commission: l2Commission,
      rate: l2Tier.l2Rate,
      level: 2,
    },
  });
}

module.exports.recordReferralEarnings = recordReferralEarnings;
