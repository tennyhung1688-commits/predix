const express = require('express');
const axios = require('axios');
const config = require('../config');
const prisma = require('../lib/prisma');
const walletService = require('../services/wallet');
const balanceService = require('../services/balance');
const { requireAuth } = require('../middleware/auth');
const { tradingLimiter } = require('../middleware/rateLimiter');
const { orderRules, handleValidation } = require('../middleware/validate');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const logger = require('../lib/logger');
const { sendError } = require('../lib/errors');

const router = express.Router();
const { recordReferralEarnings } = require('./referral');

/**
 * 计算价差手续费（接受动态费率，支持分档收费）
 */
function calcSpread(price, size, side, feeRate) {
  const spreadFee = price * size * feeRate;

  if (side === 'BUY') {
    return {
      userPrice: price * (1 + feeRate),
      executePrice: price,
      spreadFee,
      userCost: price * size * (1 + feeRate),
      platformCost: price * size,
    };
  } else {
    return {
      userPrice: price * (1 - feeRate),
      executePrice: price,
      spreadFee,
      userProceeds: price * size * (1 - feeRate),
      platformProceeds: price * size,
    };
  }
}

/**
 * 下单（平台钱包代理到 Polymarket CLOB）
 *
 * 流程：
 * 1. 用户余额检查（扣除锁定金额）
 * 2. 平台钱包签名并提交订单到 Polymarket
 * 3. 记录交易（含价差）、流水、平台收益
 * 4. 更新用户余额
 */
// Polymarket 错误码 → 用户友好信息
function classifyPolyError(err) {
  const data = err?.response?.data || err?.body || {};
  const msg = (data.error || err.message || '').toLowerCase();
  const status = err?.response?.status;

  if (status === 429) return { code: 'rate_limit', httpStatus: 429, message: '请求过于频繁，请稍后再试' };
  if (msg.includes('insufficient_balance') || msg.includes('insufficient balance') || msg.includes('not enough'))
    return { code: 'insufficient_balance', httpStatus: 400, message: '平台钱包余额不足，请联系管理员' };
  if (msg.includes('invalid_token') || msg.includes('token not found'))
    return { code: 'invalid_token_id', httpStatus: 400, message: '市场无效或已关闭' };
  if (msg.includes('post_only') || msg.includes('would match'))
    return { code: 'post_only_mode', httpStatus: 400, message: 'Post-Only 订单会立即成交，请使用其他订单类型' };
  if (msg.includes('not found') || msg.includes('order not found'))
    return { code: 'order_not_found', httpStatus: 404, message: '订单未找到' };
  if (msg.includes('delayed'))
    return { code: 'delayed_order', httpStatus: 400, message: '该市场存在下单延迟，请稍后重试' };
  if (msg.includes('unauthorized') || msg.includes('signature') || msg.includes('authentication'))
    return { code: 'auth_error', httpStatus: 401, message: '平台钱包认证失效，请联系管理员' };

  return { code: 'unknown', httpStatus: 502, message: `Polymarket 返回: ${data.error || err.message}` };
}

router.post('/order', requireAuth,
  tradingLimiter,
  orderRules,
  handleValidation,
  auditMiddleware(AUDIT_EVENTS.ORDER_CREATE, (req) => ({
    tokenId: req.body.tokenId,
    side: req.body.side,
    size: parseFloat(req.body.size || '0'),
    price: parseFloat(req.body.price || '0'),
    amount: parseFloat(req.body.amount || '0'),
    orderType: req.body.orderType,
  })),
  async (req, res) => {
  try {
    const { tokenId, side, size, price, amount, orderType, tags } = req.body;

    if (!tokenId || !side) {
      return res.status(400).json({ success: false, error: '缺少必要参数: tokenId, side' });
    }

    if (!['BUY', 'SELL'].includes(side)) {
      return res.status(400).json({ success: false, error: 'side 必须为 BUY 或 SELL' });
    }

    // 根据市场标签匹配分档费率
    const feeRate = config.getCategoryFeeRate(tags);

    // 判断是否为市价单
    const isMarketOrder = typeof orderType === 'string' && orderType.startsWith('MARKET_');
    const limitOrderType = isMarketOrder ? null : (orderType || 'GTC');

    if (isMarketOrder) {
      // 市价单：需要 amount (总花费) 而非 price + size
      if (!amount) {
        return res.status(400).json({ success: false, error: '市价单需要 amount 参数（总花费 USDC）' });
      }
      const parsedAmount = parseFloat(amount);
      if (parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: 'amount 必须大于 0' });
      }
    } else {
      // 限价单：需要 size 和 price
      if (!size) {
        return res.status(400).json({ success: false, error: '限价单需要 size 参数' });
      }
      const parsedSize = parseFloat(size);
      const parsedPrice = parseFloat(price);
      if (parsedSize <= 0 || parsedPrice <= 0 || isNaN(parsedPrice)) {
        return res.status(400).json({ success: false, error: 'size 和 price 必须大于 0' });
      }
    }

    const parsedSize = parseFloat(size || '0');
    const parsedPrice = parseFloat(price || '0');
    const parsedAmount = parseFloat(amount || '0');

    // 检查平台钱包配置
    const isDemoMode = !walletService.isConfigured();

    if (isDemoMode) {
      const desc = isMarketOrder
        ? `${side} 市价 ${parsedAmount} USDC`
        : `${side} ${parsedSize} 份 @ ${parsedPrice}`;
      logger.info({ demo: true, side, size: parsedSize, price: parsedPrice }, `[DEMO] 模拟交易模式：${desc}`);
    }

    // 计算价差（市价单使用金额反算）
    const spread = isMarketOrder
      ? calcSpread(1, side === 'BUY' ? parsedAmount : parsedAmount / (1 - feeRate), side, feeRate)
      : calcSpread(parsedPrice, parsedSize, side, feeRate);

    // 用户实际花费
    const userCost = isMarketOrder
      ? (side === 'BUY' ? parsedAmount * (1 + feeRate) : parsedAmount)
      : (side === 'BUY' ? spread.userCost : (spread.userProceeds || parsedSize * parsedPrice));

    // 检查用户余额
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const availableBalance = user.balance - user.lockedBalance;
    if (availableBalance < userCost) {
      return res.status(400).json({
        success: false,
        error: `余额不足。需要 ${userCost.toFixed(2)} USDC，可用 ${availableBalance.toFixed(2)} USDC`,
      });
    }

    // 锁定用户余额
    await balanceService.lockBalance(user.id, userCost);

    // 记录交易（pending 状态）
    const trade = await prisma.trade.create({
      data: {
        userId: user.id,
        tokenId,
        side,
        size: isMarketOrder ? parsedAmount : parsedSize,
        originalPrice: isMarketOrder ? 0 : parsedPrice,
        executePrice: isMarketOrder ? 0 : spread.executePrice,
        spreadFee: spread.spreadFee || (isMarketOrder ? parsedAmount * feeRate : 0),
        status: 'pending',
      },
    });

    try {
      let polymarketOrderId;

      if (isDemoMode) {
        polymarketOrderId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        logger.info({ demo: true, polymarketOrderId }, `[DEMO] 模拟订单成交: ${polymarketOrderId}`);
      } else if (isMarketOrder) {
        // 市价单：通过 SDK 的 createMarketOrder
        const marketType = orderType === 'MARKET_FOK' ? 'FOK' : 'FAK';
        const response = await walletService.createMarketOrder({
          tokenId,
          amount: parsedAmount,
          side,
          orderType: marketType,
        });
        polymarketOrderId = response?.orderID || response?.id;
      } else {
        // 限价单
        const response = await walletService.createOrder({
          tokenId,
          price: spread.executePrice,
          size: parsedSize,
          side,
          orderType: limitOrderType,
        });
        polymarketOrderId = response?.orderID || response?.id;
      }

      const newBalance = user.balance - userCost;
      const tradeSize = isMarketOrder ? parsedAmount : parsedSize;

      // 构建持仓 upsert 操作
      const positionOps = [];
      const existingPosition = await prisma.position.findUnique({
        where: { userId_tokenId: { userId: user.id, tokenId } },
      });

      if (side === 'BUY') {
        // 买入：增加持仓
        const newSize = (existingPosition?.size || 0) + tradeSize;
        const newTotalCost = (existingPosition?.totalCost || 0) + userCost;
        const newAvgPrice = newTotalCost / newSize;
        positionOps.push(
          prisma.position.upsert({
            where: { userId_tokenId: { userId: user.id, tokenId } },
            create: {
              userId: user.id,
              tokenId,
              marketId: tokenId, // 暂时用 tokenId 作为 marketId
              side,
              size: tradeSize,
              avgPrice: userCost / tradeSize,
              totalCost: userCost,
              status: 'open',
            },
            update: {
              size: newSize,
              avgPrice: newAvgPrice,
              totalCost: newTotalCost,
              updatedAt: new Date(),
            },
          })
        );
      } else {
        // 卖出：减少持仓
        if (!existingPosition || existingPosition.size < tradeSize) {
          // 解锁余额（因为后续会事务失败）
          await balanceService.unlockBalance(user.id, userCost);
          return res.status(400).json({
            success: false,
            error: `持仓不足。当前持有 ${existingPosition?.size || 0} 份，试图卖出 ${tradeSize} 份`,
          });
        }
        const newSize = existingPosition.size - tradeSize;
        const newTotalCost = existingPosition.totalCost * (newSize / existingPosition.size);
        const status = newSize < 0.0001 ? 'closed' : 'open';
        positionOps.push(
          prisma.position.update({
            where: { userId_tokenId: { userId: user.id, tokenId } },
            data: {
              size: newSize,
              totalCost: newTotalCost,
              avgPrice: newSize > 0 ? newTotalCost / newSize : existingPosition.avgPrice,
              status,
              updatedAt: new Date(),
            },
          })
        );
      }

      const txOps = [
        prisma.trade.update({
          where: { id: trade.id },
          data: { status: 'filled', polymarketOrderId, updatedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            balance: { decrement: userCost },
            lockedBalance: { decrement: userCost },
            tradeVolume: { increment: tradeSize },
            feePaid: { increment: spread.spreadFee || 0 },
          },
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            type: `TRADE_${side}`,
            amount: -userCost,
            balance: newBalance,
            tradeId: trade.id,
            desc: isMarketOrder
              ? `${side === 'BUY' ? '市价买入' : '市价卖出'} ${parsedAmount.toFixed(2)} USDC`
              : `${side === 'BUY' ? '买入' : '卖出'} ${parsedSize} 份 @ ${parsedPrice.toFixed(4)}（含手续费 ${spread.spreadFee.toFixed(4)} USDC）`,
          },
        }),
        prisma.platformRevenue.create({
          data: { source: 'SPREAD', amount: spread.spreadFee || (parsedAmount * feeRate), tradeId: trade.id, userId: user.id },
        }),
        ...positionOps,
      ];
      await prisma.$transaction(txOps);

      // 记录推荐返佣（异步，不影响响应）
      recordReferralEarnings(user.id, trade.id, spread.spreadFee || 0, feeRate).catch(err => {
        logger.warn({ err }, '记录推荐返佣失败');
      });

      res.json({
        success: true,
        data: {
          demo: isDemoMode,
          trade: {
            id: trade.id,
            side,
            size: isMarketOrder ? parsedAmount : parsedSize,
            originalPrice: isMarketOrder ? null : parsedPrice,
            executePrice: isMarketOrder ? null : spread.executePrice,
            spreadFee: spread.spreadFee || 0,
            polymarketOrderId,
            orderType: isMarketOrder ? orderType : limitOrderType,
            status: 'filled',
          },
          balance: { previous: user.balance, after: newBalance, deducted: userCost },
        },
      });
    } catch (polymarketErr) {
      await prisma.$transaction([
        prisma.trade.update({ where: { id: trade.id }, data: { status: 'failed' } }),
        prisma.user.update({ where: { id: user.id }, data: { lockedBalance: { decrement: userCost } } }),
      ]);

      const classified = classifyPolyError(polymarketErr);
      res.status(classified.httpStatus).json({
        success: false,
        error: classified.message,
        errorCode: classified.code,
        tradeId: trade.id,
      });
    }
  } catch (err) {
    sendError(res, err);
  }
});

// 取消订单 — 审计
router.delete('/order/:orderId', requireAuth,
  tradingLimiter,
  auditMiddleware(AUDIT_EVENTS.ORDER_CANCEL, (req) => ({ orderId: req.params.orderId })),
  async (req, res) => {
  try {
    // 查找交易记录
    const trade = await prisma.trade.findUnique({
      where: { id: req.params.orderId },
    });

    if (!trade || trade.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }

    if (trade.status !== 'pending' && trade.status !== 'filled') {
      return res.status(400).json({ success: false, error: '订单不可取消' });
    }

    // 取消 Polymarket 订单（通过 v2 SDK）
    if (trade.polymarketOrderId && walletService.isConfigured()) {
      await walletService.cancelOrder(trade.polymarketOrderId).catch(() => {
        // Polymarket 取消失败不影响本地状态
        logger.warn({ polymarketOrderId: trade.polymarketOrderId }, `Polymarket cancel failed`);
      });
    }

    // 退款：使用 Trade 记录中的 spreadFee 反推实际花费
    const feeRate = trade.spreadFee / (trade.originalPrice * trade.size) || config.feeRate;
    const refundAmount = trade.side === 'BUY'
      ? trade.originalPrice * trade.size * (1 + feeRate)
      : trade.originalPrice * trade.size * (1 - feeRate);

    // 先读取当前余额，在事务中原子更新
    const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });

    await prisma.$transaction([
      prisma.trade.update({
        where: { id: trade.id },
        data: { status: 'cancelled', updatedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          balance: { increment: refundAmount },
          lockedBalance: { decrement: refundAmount },
        },
      }),
      prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: 'TRADE_CANCEL',
          amount: refundAmount,
          balance: (currentUser?.balance || 0) + refundAmount,
          tradeId: trade.id,
          desc: `取消订单退款 ${refundAmount.toFixed(4)} USDC`,
        },
      }),
    ]);

    res.json({ success: true, data: { orderId: trade.id, status: 'cancelled' } });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取用户订单列表（本地 + Polymarket）
router.get('/orders', requireAuth, async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: trades });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取手续费信息（可选 ?tags=tag1,tag2 按市场类型返回分档费率）
router.get('/fee-info', (req, res) => {
  const isDemoMode = !walletService.isConfigured();
  const tags = req.query.tags ? req.query.tags.split(',').map(t => t.trim()) : [];
  const feeRate = tags.length > 0 ? config.getCategoryFeeRate(tags) : config.feeRate;

  res.json({
    success: true,
    data: {
      mode: config.platform.feeMode,
      feeRate,
      feePercent: (feeRate * 100).toFixed(1) + '%',
      category: tags.length > 0 ? tags.join(',') : null,
      demo: isDemoMode,
      description: isDemoMode
        ? '⚠️ 演示模式：平台钱包未配置，交易为模拟执行，不提交到 Polymarket 链上'
        : config.platform.feeMode === 'spread'
          ? `价差模式：买入价格上浮、卖出价格下调，差价归平台（费率 ${(feeRate * 100).toFixed(1)}%）`
          : '固定费率模式',
      categories: Object.entries(config.categoryFeeRates).reduce((acc, [k, v]) => {
        acc[k] = { feeRate: v, percent: (v * 100).toFixed(1) + '%' };
        return acc;
      }, {}),
    },
  });
});

module.exports = router;
