const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const { commentRules, handleValidation } = require('../middleware/validate');
const { commentLimiter } = require('../middleware/rateLimiter');
const { sendError } = require('../lib/errors');

/**
 * XSS 防护：严格转义所有 HTML 特殊字符
 * 采用白名单策略——只允许纯文本，不解析任何 Markdown/HTML 标签
 * 确保存储型 XSS 在服务端就被彻底阻断
 */
function sanitize(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

const router = express.Router();

/**
 * 获取指定市场的评论列表（过滤已删除评论）
 * GET /api/comments/:marketId
 */
router.get('/comments/:marketId', async (req, res) => {
  try {
    const { page, limit, sort } = req.query;
    const p = parseInt(page) || 1;
    const l = Math.min(parseInt(limit) || 20, 100);

    // 排序: latest (默认), oldest, popular (按点赞数)
    let orderBy;
    switch (sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'popular':
        orderBy = { likes: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const comments = await prisma.comment.findMany({
      where: {
        marketId: req.params.marketId,
        parentId: null, // 只取顶级评论
        isDeleted: false,
      },
      include: {
        user: { select: { id: true, walletAddress: true } },
        replies: {
          where: { isDeleted: false },
          include: {
            user: { select: { id: true, walletAddress: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 10,
        },
      },
      orderBy,
      skip: (p - 1) * l,
      take: l,
    });

    const total = await prisma.comment.count({
      where: { marketId: req.params.marketId, isDeleted: false },
    });

    res.json({
      success: true,
      data: {
        comments,
        pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) },
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 发表评论 — XSS 防护 + 审计 + 限流
 * POST /api/comments
 * Body: { marketId, content, parentId? }
 */
router.post('/comments',
  requireAuth,
  commentLimiter,
  commentRules,
  handleValidation,
  auditMiddleware(AUDIT_EVENTS.COMMENT_CREATE, (req) => ({
    marketId: req.body.marketId,
    contentLength: (req.body.content || '').length,
    isReply: !!req.body.parentId,
  })),
  async (req, res) => {
  try {
    const { marketId, content, parentId } = req.body;

    // 如果是回复，检查父评论是否存在
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent) {
        return res.status(404).json({ success: false, error: '父评论不存在' });
      }
      // 防止嵌套过深（最多2层）
      if (parent.parentId) {
        return res.status(400).json({ success: false, error: '不支持对回复再回复，请直接回复原评论' });
      }
    }

    // XSS 防护：转义 HTML 特殊字符后再存储
    const sanitizedContent = sanitize(content.trim());

    const comment = await prisma.comment.create({
      data: {
        userId: req.user.id,
        marketId,
        content: sanitizedContent,
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, walletAddress: true } },
      },
    });

    res.json({ success: true, data: comment });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 删除评论（仅本人或管理员可删）— 软删除 + 审计
 * DELETE /api/comments/:id
 */
router.delete('/comments/:id',
  requireAuth,
  commentLimiter,
  auditMiddleware('comment.delete', (req) => ({
    commentId: req.params.id,
  })),
  async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });

    if (!comment) {
      return res.status(404).json({ success: false, error: '评论不存在' });
    }

    if (comment.isDeleted) {
      return res.status(410).json({ success: false, error: '评论已被删除' });
    }

    if (comment.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '无权删除此评论' });
    }

    // 软删除：标记主评论及所有回复
    const updatedCount = await prisma.comment.updateMany({
      where: { OR: [{ id: req.params.id }, { parentId: req.params.id }] },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    res.json({ success: true, data: { deleted: true, affected: updatedCount.count } });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 点赞评论 — 防重复 + 审计 + 限流
 * POST /api/comments/:id/like
 */
router.post('/comments/:id/like',
  requireAuth,
  commentLimiter,
  auditMiddleware('comment.like', (req) => ({
    commentId: req.params.id,
  })),
  async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });

    if (!comment) {
      return res.status(404).json({ success: false, error: '评论不存在' });
    }

    if (comment.isDeleted) {
      return res.status(410).json({ success: false, error: '评论已被删除' });
    }

    // 防止刷赞：检查是否已点赞
    const existing = await prisma.commentLike.findUnique({
      where: { userId_commentId: { userId: req.user.id, commentId: req.params.id } },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: '你已经点过赞了', data: { likes: comment.likes } });
    }

    // 使用事务确保点赞记录和计数同步更新
    const result = await prisma.$transaction(async (tx) => {
      await tx.commentLike.create({
        data: { userId: req.user.id, commentId: req.params.id },
      });
      const updated = await tx.comment.update({
        where: { id: req.params.id },
        data: { likes: { increment: 1 } },
      });
      return updated;
    });

    res.json({ success: true, data: { likes: result.likes } });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 获取市场评论统计（排除已删除）
 * GET /api/comments/:marketId/stats
 */
router.get('/comments/:marketId/stats', async (req, res) => {
  try {
    const total = await prisma.comment.count({
      where: { marketId: req.params.marketId, isDeleted: false },
    });

    res.json({ success: true, data: { total, marketId: req.params.marketId } });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 举报评论 — 防重复举报
 * POST /api/comments/:id/report
 */
router.post('/comments/:id/report',
  requireAuth,
  async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) {
      return res.status(404).json({ success: false, error: '评论不存在' });
    }
    if (comment.isDeleted) {
      return res.status(410).json({ success: false, error: '评论已被删除' });
    }

    const existing = await prisma.commentReport.findUnique({
      where: { userId_commentId: { userId: req.user.id, commentId: req.params.id } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: '你已经举报过这条评论了' });
    }

    const report = await prisma.commentReport.create({
      data: {
        userId: req.user.id,
        commentId: req.params.id,
        reason: req.body.reason || null,
      },
    });

    res.json({ success: true, data: report });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
