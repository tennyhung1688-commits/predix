const express = require('express');
const prisma = require('../lib/prisma');
const walletService = require('../services/wallet');
const balanceService = require('../services/balance');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const { sendError } = require('../lib/errors');

const router = express.Router();

/**
 * 创建组合押注
 * POST /api/combo
 * Body: { name?, legs: [{ tokenId, marketId, question, outcome, odds, price }], stake }
 *
 * 流程：
 * 1. 验证所有腿有效
 * 2. 计算综合赔率和预期回报
 * 3. 锁定用户余额
 * 4. 逐腿提交订单到 Polymarket
 * 5. 原子记录组合押注
 */
router.post('/combo', requireAuth,
  auditMiddleware(AUDIT_EVENTS.COMBO_CREATE, (req) => ({
    legs: (req.body.legs || []).length,
    stake: parseFloat(req.body.stake || '0'),
  })),
  async (req, res) => {
  try {
    const { name, legs, stake } = req.body;

    if (!legs || !Array.isArray(legs) || legs.length < 2) {
      return res.status(400).json({ success: false, error: '组合押注至少需要 2 个市场' });
    }

    if (legs.length > 10) {
      return res.status(400).json({ success: false, error: '组合押注最多支持 10 个市场' });
    }

    const parsedStake = parseFloat(stake);
    if (!parsedStake || parsedStake <= 0) {
      return res.status(400).json({ success: false, error: '投注金额必须大于 0' });
    }

    // 验证每个腿
    for (const leg of legs) {
      if (!leg.tokenId || !leg.marketId || !leg.outcome || !leg.price) {
        return res.status(400).json({ success: false, error: '每条腿必须包含 tokenId, marketId, outcome, price' });
      }
      if (!['Yes', 'No'].includes(leg.outcome)) {
        return res.status(400).json({ success: false, error: `outcome 必须为 Yes 或 No: ${leg.outcome}` });
      }
      if (parseFloat(leg.price) <= 0 || parseFloat(leg.price) >= 1) {
        return res.status(400).json({ success: false, error: '价格必须在 0.01 到 0.99 之间' });
      }
    }

    // 检查余额
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const availableBalance = user.balance - user.lockedBalance;
    if (availableBalance < parsedStake) {
      return res.status(400).json({
        success: false,
        error: `余额不足。需要 ${parsedStake.toFixed(2)} USDC，可用 ${availableBalance.toFixed(2)} USDC`,
      });
    }

    // 计算综合赔率（各腿 odds 乘积）
    const totalOdds = legs.reduce((acc, leg) => acc * parseFloat(leg.odds || leg.price), 1);
    const potentialPayout = parsedStake * totalOdds;

    // 锁定余额
    await balanceService.lockBalance(user.id, parsedStake);

    const isDemoMode = !walletService.isConfigured();

    // 创建组合押注记录
    const comboBet = await prisma.comboBet.create({
      data: {
        userId: user.id,
        name: name || `${legs.length}腿组合`,
        status: 'pending',
        totalOdds,
        totalStake: parsedStake,
        potentialPayout,
        legs: {
          create: legs.map(leg => ({
            tokenId: leg.tokenId,
            marketId: leg.marketId,
            question: leg.question || '',
            outcome: leg.outcome,
            odds: parseFloat(leg.odds || leg.price),
            price: parseFloat(leg.price),
            size: parsedStake,
            status: 'pending',
          })),
        },
      },
      include: { legs: true },
    });

    try {
      // 逐腿执行订单
      let allFilled = true;
      let filledLegs = 0;
      const totalWithFee = parsedStake * (1 + config.feeRate);

      for (const leg of comboBet.legs) {
        try {
          let polymarketOrderId;

          if (isDemoMode) {
            polymarketOrderId = `demo_combo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          } else {
            const response = await walletService.createOrder({
              tokenId: leg.tokenId,
              price: leg.price,
              size: parsedStake,
              side: 'BUY',
              orderType: 'GTC',
            });
            polymarketOrderId = response?.orderID || response?.id;
          }

          // 记录交易
          const trade = await prisma.trade.create({
            data: {
              userId: user.id,
              tokenId: leg.tokenId,
              side: 'BUY',
              size: parsedStake,
              originalPrice: leg.price,
              executePrice: leg.price,
              spreadFee: parsedStake * leg.price * config.feeRate,
              polymarketOrderId,
              status: 'filled',
            },
          });

          await prisma.comboLeg.update({
            where: { id: leg.id },
            data: {
              status: 'filled',
              polymarketOrderId,
              tradeId: trade.id,
              filledAt: new Date(),
            },
          });

          filledLegs++;
        } catch (legErr) {
          console.error(`组合押注腿执行失败 [${leg.tokenId}]:`, legErr.message);
          allFilled = false;

          await prisma.comboLeg.update({
            where: { id: leg.id },
            data: { status: 'failed' },
          });
        }
      }

      const finalStatus = allFilled ? 'filled' : (filledLegs > 0 ? 'partial' : 'failed');

      // 更新用户余额和流水
      const newBalance = user.balance - totalWithFee;
      await prisma.$transaction([
        prisma.comboBet.update({
          where: { id: comboBet.id },
          data: {
            status: finalStatus,
            actualPayout: finalStatus === 'filled' ? potentialPayout : 0,
            ...(finalStatus === 'filled' ? { filledAt: new Date() } : {}),
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            balance: { decrement: totalWithFee },
            lockedBalance: { decrement: parsedStake },
            tradeVolume: { increment: parsedStake * legs.length },
            feePaid: { increment: parsedStake * config.feeRate * legs.length },
          },
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            type: 'COMBO_BET',
            amount: -totalWithFee,
            balance: newBalance,
            desc: `组合押注 ${comboBet.name}: ${filledLegs}/${legs.length} 腿成交`,
          },
        }),
        prisma.platformRevenue.create({
          data: {
            source: 'SPREAD',
            amount: parsedStake * config.feeRate * legs.length,
            userId: user.id,
          },
        }),
      ]);

      // 失败时需要解锁余额
      if (finalStatus === 'failed') {
        await balanceService.unlockBalance(user.id, parsedStake);
      }

      const updatedCombo = await prisma.comboBet.findUnique({
        where: { id: comboBet.id },
        include: { legs: true },
      });

      res.json({
        success: true,
        data: {
          combo: updatedCombo,
          demo: isDemoMode,
          summary: {
            totalLegs: legs.length,
            filledLegs,
            status: finalStatus,
            stake: parsedStake,
            potentialPayout,
          },
        },
      });
    } catch (err) {
      // 解锁余额
      await balanceService.unlockBalance(user.id, parsedStake);

      await prisma.comboBet.update({
        where: { id: comboBet.id },
        data: { status: 'failed', cancelledAt: new Date() },
      });

      sendError(res, err);
    }
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 获取用户的组合押注列表
 * GET /api/combo/mine
 */
router.get('/combo/mine', requireAuth, async (req, res) => {
  try {
    const combos = await prisma.comboBet.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { legs: true },
      take: 50,
    });

    res.json({ success: true, data: combos });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 获取热门组合模板
 * GET /api/combo/templates
 */
router.get('/combo/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'template_same_sport',
        name: '同赛事组合',
        description: '选择同一体育赛事的不同预测组合',
        minLegs: 2,
        maxLegs: 5,
      },
      {
        id: 'template_parlay',
        name: '多重彩（Parlay）',
        description: '多场独立赛事组合串关，所有预测全中获胜',
        minLegs: 2,
        maxLegs: 8,
      },
      {
        id: 'template_same_event',
        name: '同事件联动',
        description: '同一事件多个关联结果的组合（如：A队赢 + 总比分>2.5）',
        minLegs: 2,
        maxLegs: 3,
      },
    ];

    res.json({ success: true, data: templates });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
