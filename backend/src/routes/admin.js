const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { withdrawProcessRules, handleValidation } = require('../middleware/validate');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const { sendError } = require('../lib/errors');

const router = express.Router();

// ⚡ 一键开通管理员（发布后应删除此接口）
router.post('/admin/claim', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'Missing wallet address' });
    const user = await prisma.user.upsert({
      where: { walletAddress: wallet },
      update: { role: 'admin' },
      create: { walletAddress: wallet, role: 'admin' },
    });
    res.json({ success: true, user: { id: user.id, wallet: user.walletAddress, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 管理接口统一限流
router.use(adminLimiter);

// ==================== 管理后台 API ====================

// 收益总览
router.get('/admin/overview', requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalTrades, totalRevenue, revenueToday] = await Promise.all([
      prisma.user.count(),
      prisma.trade.count({ where: { status: 'filled' } }),
      prisma.platformRevenue.aggregate({ _sum: { amount: true } }),
      // 今日收益
      prisma.platformRevenue.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    // 总充值 / 总提现（未完成的）
    const [totalDeposits, pendingWithdraws, activeUsersToday] = await Promise.all([
      prisma.deposit.aggregate({ _sum: { amount: true }, where: { status: 'confirmed' } }),
      prisma.withdraw.count({ where: { status: 'pending' } }),
      prisma.trade.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }).then(groups => groups.length),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsersToday,
        totalTrades,
        totalRevenue: totalRevenue._sum.amount || 0,
        revenueToday: revenueToday._sum.amount || 0,
        totalDeposits: totalDeposits._sum.amount || 0,
        pendingWithdraws,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 收益记录
router.get('/admin/revenue', requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const revenues = await prisma.platformRevenue.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 按天汇总
    const dailyRevenue = {};
    revenues.forEach(r => {
      const day = r.createdAt.toISOString().split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + r.amount;
    });

    const daily = Object.entries(dailyRevenue)
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 10000) / 10000 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data: { records: revenues, daily } });
  } catch (err) {
    sendError(res, err);
  }
});

// 交易记录
router.get('/admin/trades', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: { user: { select: { walletAddress: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.trade.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        trades,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 用户列表
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 提现审核列表
router.get('/admin/withdraws', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const withdraws = await prisma.withdraw.findMany({
      where,
      include: { user: { select: { walletAddress: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: withdraws });
  } catch (err) {
    sendError(res, err);
  }
});

// 处理提现（审核通过/拒绝）— 校验 + 审计
router.post('/admin/withdraws/:id/process', requireAdmin,
  withdrawProcessRules,
  handleValidation,
  auditMiddleware(AUDIT_EVENTS.WITHDRAW_PROCESS, (req) => ({
    withdrawId: req.params.id,
    action: req.body.action,
    txHash: req.body.txHash,
  })),
  async (req, res) => {
  try {
    const { action, txHash } = req.body; // action: 'complete' | 'reject'

    if (!['complete', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action 必须为 complete 或 reject' });
    }

    const balanceService = require('../services/balance');
    const result = await balanceService.processWithdraw(req.params.id, action, txHash);

    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
