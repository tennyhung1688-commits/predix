const express = require('express');
const prisma = require('../lib/prisma');
const { sendError } = require('../lib/errors');

const router = express.Router();

// GET /api/leaderboard?period=weekly|monthly|all
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    if (period === 'all') {
      // 总榜：基于 User 模型的累计交易量
      const users = await prisma.user.findMany({
        where: { tradeVolume: { gt: 0 } },
        orderBy: { tradeVolume: 'desc' },
        take: limit,
        select: {
          walletAddress: true,
          tradeVolume: true,
          feePaid: true,
          balance: true,
        },
      });

      const data = users.map((u, i) => ({
        rank: i + 1,
        walletAddress: u.walletAddress,
        tradeVolume: u.tradeVolume,
        feePaid: u.feePaid,
        balance: u.balance,
      }));

      return res.json({ success: true, data });
    }

    // 周榜 / 月榜：基于 Trade 表在时间段内的聚合
    const now = new Date();
    let since;
    if (period === 'weekly') {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'monthly') {
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      return res.status(400).json({ error: 'Invalid period. Use: weekly, monthly, all' });
    }

    const rows = await prisma.$queryRaw`
      SELECT
        u."walletAddress",
        COALESCE(SUM(t."executePrice" * t."size"), 0)::FLOAT as "tradeVolume",
        COALESCE(SUM(t."spreadFee"), 0)::FLOAT as "feePaid"
      FROM "User" u
      INNER JOIN "Trade" t ON t."userId" = u.id
        AND t.status IN ('filled', 'pending')
        AND t."createdAt" >= ${since}
      GROUP BY u.id, u."walletAddress"
      ORDER BY "tradeVolume" DESC
      LIMIT ${limit}
    `;

    // 为周期榜补充余额（从 User 表查询）
    const addresses = rows.map(r => r.walletAddress.toLowerCase());
    const userBalances = {};
    if (addresses.length > 0) {
      const users = await prisma.user.findMany({
        where: { walletAddress: { in: addresses, mode: 'insensitive' } },
        select: { walletAddress: true, balance: true },
      });
      users.forEach(u => {
        userBalances[u.walletAddress.toLowerCase()] = u.balance;
      });
    }

    const data = rows.map((r, i) => ({
      rank: i + 1,
      walletAddress: r.walletAddress,
      tradeVolume: Number(r.tradeVolume),
      feePaid: Number(r.feePaid),
      balance: userBalances[r.walletAddress.toLowerCase()] ?? 0,
    }));

    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
