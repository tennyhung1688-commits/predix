const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const { sendError } = require('../lib/errors');

const router = express.Router();

/**
 * 创建价格提醒
 * POST /api/alerts
 * Body: { tokenId, marketId, question?, targetPrice, direction }
 */
router.post('/alerts', requireAuth,
  auditMiddleware(AUDIT_EVENTS.ALERT_CREATE, (req) => ({
    tokenId: req.body.tokenId,
    targetPrice: parseFloat(req.body.targetPrice),
    direction: req.body.direction,
  })),
  async (req, res) => {
  try {
    const { tokenId, marketId, question, targetPrice, direction } = req.body;

    if (!tokenId || !marketId || !targetPrice || !direction) {
      return res.status(400).json({ success: false, error: '缺少必要参数: tokenId, marketId, targetPrice, direction' });
    }

    const parsedPrice = parseFloat(targetPrice);
    if (parsedPrice <= 0 || parsedPrice >= 1 || isNaN(parsedPrice)) {
      return res.status(400).json({ success: false, error: '目标价格必须在 0.01 到 0.99 之间' });
    }

    if (!['above', 'below'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'direction 必须为 above 或 below' });
    }

    // 检查是否已存在相同提醒
    const existing = await prisma.priceAlert.findFirst({
      where: {
        userId: req.user.id,
        tokenId,
        targetPrice: parsedPrice,
        direction,
        triggered: false,
      },
    });

    if (existing) {
      return res.status(400).json({ success: false, error: '该提醒已存在' });
    }

    // 限制每个用户最多 50 个活跃提醒
    const count = await prisma.priceAlert.count({
      where: { userId: req.user.id, triggered: false },
    });

    if (count >= 50) {
      return res.status(400).json({ success: false, error: '活跃提醒已达上限（50个），请先删除部分提醒' });
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId: req.user.id,
        tokenId,
        marketId,
        question: question || null,
        targetPrice: parsedPrice,
        direction,
      },
    });

    res.json({ success: true, data: alert });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 获取用户的提醒列表
 * GET /api/alerts
 */
router.get('/alerts', requireAuth, async (req, res) => {
  try {
    const { status } = req.query; // "active" | "triggered" | "all"

    const where = { userId: req.user.id };
    if (status === 'active') {
      where.triggered = false;
    } else if (status === 'triggered') {
      where.triggered = true;
    }

    const alerts = await prisma.priceAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: alerts });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 删除提醒
 * DELETE /api/alerts/:id
 */
router.delete('/alerts/:id', requireAuth, async (req, res) => {
  try {
    const alert = await prisma.priceAlert.findUnique({ where: { id: req.params.id } });

    if (!alert) {
      return res.status(404).json({ success: false, error: '提醒不存在' });
    }

    if (alert.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权操作' });
    }

    await prisma.priceAlert.delete({ where: { id: req.params.id } });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 标记提醒为已读（清除触发状态）
 * POST /api/alerts/:id/dismiss
 */
router.post('/alerts/:id/dismiss', requireAuth, async (req, res) => {
  try {
    const alert = await prisma.priceAlert.findUnique({ where: { id: req.params.id } });

    if (!alert) {
      return res.status(404).json({ success: false, error: '提醒不存在' });
    }

    if (alert.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权操作' });
    }

    // 简单方案：删除已触发的提醒
    await prisma.priceAlert.delete({ where: { id: req.params.id } });

    res.json({ success: true, data: { dismissed: true } });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
