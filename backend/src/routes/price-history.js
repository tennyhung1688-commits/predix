const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { sendError } = require('../lib/errors');

const router = express.Router();

/**
 * GET /api/price-history/:tokenId/ohlc
 * 返回 K 线/OHLC 数据
 * Query: interval=1m|5m|15m|30m|1h|4h|1d, limit=100
 *
 * 数据来源：从 PlatformTrade 表中按时间窗口聚合成交数据
 */
router.get('/price-history/:tokenId/ohlc', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const interval = req.query.interval || '1h';
    const limit = parseInt(req.query.limit) || 100;

    // 将 interval 转换为分钟数
    const intervalMinutes = parseInterval(interval);
    if (!intervalMinutes) {
      return res.status(400).json({
        success: false,
        error: '无效的时间间隔。支持: 1m, 5m, 15m, 30m, 1h, 4h, 1d',
      });
    }

    // 计算时间范围
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - intervalMinutes * 60 * 1000 * limit);

    // 从数据库获取该 token 的成交数据
    const trades = await prisma.trade.findMany({
      where: {
        tokenId,
        status: 'filled',
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        executePrice: true,
        size: true,
        createdAt: true,
      },
    });

    // 如果没有成交数据，返回空数组
    if (trades.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 聚合为 OHLC 数据
    const ohlcData = aggregateToOHLC(trades, intervalMinutes, startTime, endTime);

    res.json({ success: true, data: ohlcData });
  } catch (err) {
    console.error('[OHLC] 获取K线数据失败:', err.message);
    sendError(res, err);
  }
});

/**
 * GET /api/price-history/:tokenId/recent
 * 返回最近价格点（用于简单折线图）
 */
router.get('/price-history/:tokenId/recent', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const limit = parseInt(req.query.limit) || 200;

    const trades = await prisma.trade.findMany({
      where: {
        tokenId,
        status: 'filled',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        executePrice: true,
        createdAt: true,
      },
    });

    // 反转顺序为时间升序
    const prices = trades.reverse().map(t => ({
      ts: t.createdAt.toISOString(),
      price: parseFloat(t.executePrice),
    }));

    res.json({ success: true, data: prices });
  } catch (err) {
    console.error('[PriceHistory] 获取价格历史失败:', err.message);
    sendError(res, err);
  }
});

/**
 * 将 interval 字符串转换为分钟数
 */
function parseInterval(interval) {
  const map = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
  };
  return map[interval] || null;
}

/**
 * 将成交记录聚合为 OHLC 蜡烛图数据
 */
function aggregateToOHLC(trades, intervalMinutes, startTime, endTime) {
  const intervalMs = intervalMinutes * 60 * 1000;
  const buckets = new Map();

  // 按时间窗口分组
  for (const trade of trades) {
    const timestamp = new Date(trade.createdAt).getTime();
    const bucketStart = Math.floor(timestamp / intervalMs) * intervalMs;

    if (!buckets.has(bucketStart)) {
      buckets.set(bucketStart, {
        prices: [],
        volume: 0,
      });
    }

    const bucket = buckets.get(bucketStart);
    const price = parseFloat(trade.executePrice);
    bucket.prices.push(price);
    bucket.volume += parseFloat(trade.size);
  }

  // 转换为 OHLC 数组
  const result = [];
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

  for (const bucketStart of sortedKeys) {
    const bucket = buckets.get(bucketStart);
    const prices = bucket.prices;

    result.push({
      time: Math.floor(bucketStart / 1000), // Unix timestamp (seconds)
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      volume: Math.round(bucket.volume * 100) / 100,
    });
  }

  // 填充没有成交的时间窗口（前值填充）
  const filled = [];
  for (let i = 0; i < result.length; i++) {
    if (i > 0 && result[i].time - result[i - 1].time > intervalMinutes * 60) {
      // 有空隙，用前一根的收盘价填充
      const gapCount = Math.floor((result[i].time - result[i - 1].time) / (intervalMinutes * 60)) - 1;
      for (let j = 1; j <= gapCount; j++) {
        const prevClose = result[i - 1].close;
        filled.push({
          time: result[i - 1].time + j * intervalMinutes * 60,
          open: prevClose,
          high: prevClose,
          low: prevClose,
          close: prevClose,
          volume: 0,
        });
      }
    }
    filled.push(result[i]);
  }

  return filled;
}

module.exports = router;
