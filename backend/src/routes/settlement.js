const express = require('express');
const settlementService = require('../services/settlement');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const { sendError } = require('../lib/errors');

const router = express.Router();

// ==================== 用户端 ====================

// 获取用户持仓列表
router.get('/positions', requireAuth, async (req, res) => {
  try {
    const prisma = require('../lib/prisma');
    const positions = await prisma.position.findMany({
      where: { userId: req.user.id, status: 'open', size: { gt: 0 } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: positions });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取用户所有持仓（含已结算）
router.get('/positions/all', requireAuth, async (req, res) => {
  try {
    const prisma = require('../lib/prisma');
    const positions = await prisma.position.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: positions });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取用户结算汇总
router.get('/settlements/summary', requireAuth, async (req, res) => {
  try {
    const summary = await settlementService.getUserSettlementSummary(req.user.id);
    res.json({ success: true, data: summary });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取用户结算历史
router.get('/settlements', requireAuth, async (req, res) => {
  try {
    const { page, limit } = req.query;
    const data = await settlementService.getSettlementHistory({
      page,
      limit,
      userId: req.user.id,
    });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// ==================== 管理端 ====================

// 手动结算市场（管理员）— 审计
router.post('/admin/settle', requireAdmin,
  auditMiddleware(AUDIT_EVENTS.SETTLE_MARKET, (req) => ({
    marketId: req.body.marketId,
    outcomeTokenId: req.body.outcomeTokenId,
    payoutPerShare: parseFloat(req.body.payoutPerShare || '1'),
  })),
  async (req, res) => {
  try {
    const { marketId, outcomeTokenId, outcomeLabel, question, payoutPerShare } = req.body;

    if (!marketId || !outcomeTokenId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: marketId, outcomeTokenId',
      });
    }

    const result = await settlementService.resolveMarket({
      marketId,
      outcomeTokenId,
      outcomeLabel: outcomeLabel || 'Winner',
      question: question || '',
      payoutPerShare: payoutPerShare || 1.0,
    });

    res.json({
      success: true,
      data: {
        marketId,
        outcomeTokenId,
        settled: result.settled,
        totalPayout: result.totalPayout,
        details: result.details,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 触发自动结算检测（管理员）
router.post('/admin/settle/auto-check', requireAdmin, async (req, res) => {
  try {
    const result = await settlementService.autoCheckAndSettle();
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取所有已结算市场
router.get('/admin/settlements/markets', requireAdmin, async (req, res) => {
  try {
    const { page, limit } = req.query;
    const data = await settlementService.getResolvedMarkets({ page, limit });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取所有结算记录
router.get('/admin/settlements', requireAdmin, async (req, res) => {
  try {
    const { page, limit } = req.query;
    const data = await settlementService.getSettlementHistory({ page, limit });
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取结算统计（管理端）
router.get('/admin/settlements/stats', requireAdmin, async (req, res) => {
  try {
    const prisma = require('../lib/prisma');

    const [totalResolved, totalSettlements, totalPayout, openPositions] = await Promise.all([
      prisma.marketResolution.count(),
      prisma.settlement.count({ where: { status: 'completed' } }),
      prisma.settlement.aggregate({
        _sum: { totalPayout: true, profit: true },
        where: { status: 'completed' },
      }),
      prisma.position.count({ where: { status: 'open', size: { gt: 0 } } }),
    ]);

    res.json({
      success: true,
      data: {
        totalResolvedMarkets: totalResolved,
        totalSettlements,
        totalPayout: totalPayout._sum.totalPayout || 0,
        totalUserProfit: totalPayout._sum.profit || 0,
        openPositions,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
