/**
 * 结算服务
 * 管理市场结算与赢家自动入账
 *
 * 流程：
 * 1. 管理员手动或定时任务检测市场结算
 * 2. 创建 MarketResolution 记录（标记哪个市场已结算、赢的 token 是什么）
 * 3. 调用 settlePositions 对持有赢家 token 的用户自动入账
 */

const prisma = require('../lib/prisma');
const config = require('../config');
const logger = require('../lib/logger');

class SettlementService {
  /**
   * 手动结算一个市场
   * @param {string} marketId - Polymarket condition ID
   * @param {string} outcomeTokenId - 获胜的 token ID
   * @param {string} outcomeLabel - 获胜选项标签（Yes/No 等）
   * @param {string} question - 市场问题（可选）
   * @param {number} payoutPerShare - 每份赔付款，默认 1.0 USDC
   */
  async resolveMarket({ marketId, outcomeTokenId, outcomeLabel, question, payoutPerShare = 1.0 }) {
    // 1. 创建或更新 MarketResolution 记录
    const resolution = await prisma.marketResolution.upsert({
      where: { marketId },
      create: {
        marketId,
        outcomeTokenId,
        outcomeLabel,
        question,
        status: 'resolved',
        resolvedAt: new Date(),
      },
      update: {
        outcomeTokenId,
        outcomeLabel,
        question,
        status: 'resolved',
        resolvedAt: new Date(),
      },
    });

    // 2. 自动结算持仓
    const result = await this.settlePositions(resolution.id);

    return {
      resolution,
      ...result,
    };
  }

  /**
   * 对已结算市场的所有赢家持仓进行结算
   * @param {string} resolutionId - MarketResolution ID
   */
  async settlePositions(resolutionId) {
    const resolution = await prisma.marketResolution.findUnique({
      where: { id: resolutionId },
    });

    if (!resolution) {
      throw new Error('结算记录不存在');
    }

    const winningTokenId = resolution.outcomeTokenId;
    if (!winningTokenId) {
      throw new Error('未指定获胜 tokenId');
    }

    // 查找所有持有赢家 token 的未结算持仓
    const positions = await prisma.position.findMany({
      where: {
        tokenId: winningTokenId,
        status: 'open',
        size: { gt: 0 },
      },
      include: { user: true },
    });

    if (positions.length === 0) {
      logger.info({ marketId: resolution.marketId }, '市场无赢家持仓，跳过结算');
      return { settled: 0, totalPayout: 0, details: [] };
    }

    const payoutPerShare = 1.0; // 每份赢家 token 兑付 1 USDC
    let totalPayout = 0;
    const details = [];

    for (const position of positions) {
      const shares = position.size;
      const payout = shares * payoutPerShare;
      const profit = payout - position.totalCost;
      totalPayout += payout;

      // 事务：更新用户余额 + 持仓状态 + 创建结算记录 + 流水
      await prisma.$transaction([
        // 用户余额增加
        prisma.user.update({
          where: { id: position.userId },
          data: { balance: { increment: payout } },
        }),
        // 标记持仓为已结算
        prisma.position.update({
          where: { id: position.id },
          data: { status: 'settled', updatedAt: new Date() },
        }),
        // 创建结算记录
        prisma.settlement.create({
          data: {
            userId: position.userId,
            resolutionId,
            tokenId: winningTokenId,
            marketId: resolution.marketId,
            shares,
            payoutPerShare,
            totalPayout: payout,
            totalCost: position.totalCost,
            profit,
            status: 'completed',
            settledAt: new Date(),
          },
        }),
        // 交易流水
        prisma.transaction.create({
          data: {
            userId: position.userId,
            type: 'SETTLEMENT',
            amount: payout,
            balance: position.user.balance + payout,
            desc: `🎉 市场结算: "${resolution.question || resolution.marketId}" 获胜 → +${payout.toFixed(2)} USDC (${shares.toFixed(4)} 份 × ${payoutPerShare}) | 成本 ${position.totalCost.toFixed(2)} | 盈利 ${profit.toFixed(2)}`,
          },
        }),
      ]);

      details.push({
        userId: position.userId,
        wallet: position.user.walletAddress,
        shares,
        totalCost: position.totalCost,
        payout,
        profit,
      });

      logger.info({ wallet: position.user.walletAddress, payout: payout.toFixed(2), shares: shares.toFixed(4), profit: profit.toFixed(2) }, '持仓结算完成');
    }

    logger.info({ marketId: resolution.marketId, winners: details.length, totalPayout: totalPayout.toFixed(2) }, '市场结算完成');

    return {
      settled: details.length,
      totalPayout: Math.round(totalPayout * 100) / 100,
      details,
    };
  }

  /**
   * 从 Polymarket 检测已结算的市场并自动处理
   * 通过查询 Polymarket Gamma API 获取已结算的市场
   */
  async autoCheckAndSettle() {
    try {
      const axios = require('axios');

      // 查找本地 open 持仓所涉及的市场，避免全量查询
      const openPositions = await prisma.position.findMany({
        where: { status: 'open', size: { gt: 0 } },
        select: { marketId: true, tokenId: true },
        distinct: ['tokenId'],
      });

      if (openPositions.length === 0) {
        logger.debug('无未结算持仓，跳过自动检测');
        return { checked: 0, newlyResolved: [] };
      }

      const newlyResolved = [];

      // 逐个检查 token 对应的事件是否已结算
      for (const pos of openPositions) {
        try {
          const { data } = await axios.get(
            `${config.polymarket.clobApi}/markets/${pos.marketId || pos.tokenId}`,
            { timeout: 5000 }
          );

          // Polymarket 的 market 如果已结算，通常有 resolved 或 closed 字段
          const isResolved =
            data?.closed ||
            data?.resolved ||
            data?.status === 'resolved' ||
            data?.status === 'closed';

          if (isResolved && data?.outcomeTokenId) {
            // 检查是否已经结算过
            const existing = await prisma.marketResolution.findUnique({
              where: { marketId: pos.marketId || pos.tokenId },
            });

            if (!existing) {
              const result = await this.resolveMarket({
                marketId: pos.marketId || pos.tokenId,
                outcomeTokenId: data.outcomeTokenId,
                outcomeLabel: data.outcomeLabel || data.outcome || 'Winner',
                question: data.question || data.title || '',
              });
              newlyResolved.push({ marketId: pos.marketId, ...result });
            }
          }
        } catch (err) {
          // 单个市场查询失败不影响整体
          logger.warn({ marketId: pos.marketId || pos.tokenId, err: err.message }, '查询市场状态失败');
        }
      }

      logger.info({ checked: openPositions.length, newlySettled: newlyResolved.length }, '自动结算检测完成');
      return { checked: openPositions.length, newlyResolved };
    } catch (err) {
      logger.error({ err: err.message }, '自动检测结算失败');
      throw err;
    }
  }

  /**
   * 获取结算历史
   */
  async getSettlementHistory({ page = 1, limit = 20, userId }) {
    const where = {};
    if (userId) where.userId = userId;

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        include: {
          user: { select: { walletAddress: true } },
        },
        orderBy: { settledAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.settlement.count({ where }),
    ]);

    return { settlements, total, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * 获取用户结算汇总
   */
  async getUserSettlementSummary(userId) {
    const [summary] = await prisma.$queryRaw`
      SELECT
        COUNT(*) as totalSettlements,
        SUM(totalPayout) as totalPayout,
        SUM(totalCost) as totalCost,
        SUM(profit) as totalProfit
      FROM Settlement
      WHERE userId = ${userId} AND status = 'completed'
    `;

    const wins = await prisma.settlement.count({
      where: { userId, status: 'completed', profit: { gt: 0 } },
    });
    const losses = await prisma.settlement.count({
      where: { userId, status: 'completed', profit: { lte: 0 } },
    });

    return {
      totalSettlements: summary?.totalSettlements || 0,
      totalPayout: summary?.totalPayout || 0,
      totalCost: summary?.totalCost || 0,
      totalProfit: summary?.totalProfit || 0,
      wins,
      losses,
      winRate: (summary?.totalSettlements || 0) > 0
        ? Math.round((wins / summary.totalSettlements) * 100)
        : 0,
    };
  }

  /**
   * 获取市场结算状态列表
   */
  async getResolvedMarkets({ page = 1, limit = 20 }) {
    const [markets, total] = await Promise.all([
      prisma.marketResolution.findMany({
        orderBy: { resolvedAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.marketResolution.count(),
    ]);

    return { markets, total, page: parseInt(page), limit: parseInt(limit) };
  }
}

module.exports = new SettlementService();
