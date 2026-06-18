const express = require('express');
const axios = require('axios');
const config = require('../config');
const { sendError } = require('../lib/errors');

const router = express.Router();

// 获取鲸鱼交易（大额交易追踪）
router.get('/smart-money/whales', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { data } = await axios.get(`${config.polymarket.dataApi}/trades`, {
      params: { limit: 1000 },
    });

    const trades = Array.isArray(data) ? data : [];
    
    // 筛选大额交易（金额 > $500）
    const whales = trades
      .filter((t) => {
        const amount = parseFloat(t.size || '0') * parseFloat(t.price || '0');
        return amount > 500;
      })
      .sort((a, b) => {
        const aVal = parseFloat(a.size || '0') * parseFloat(a.price || '0');
        const bVal = parseFloat(b.size || '0') * parseFloat(b.price || '0');
        return bVal - aVal;
      })
      .slice(0, limit)
      .map((t) => ({
        wallet: t.proxyWallet || '0xUnknown',
        market: t.title || 'Unknown Market',
        side: t.side || 'BUY',
        size: parseFloat(t.size || '0').toFixed(2),
        price: parseFloat(t.price || '0').toFixed(4),
        value: (parseFloat(t.size || '0') * parseFloat(t.price || '0')).toFixed(2),
        timestamp: t.timestamp ? new Date(t.timestamp * 1000).toISOString() : new Date().toISOString(),
        tokenId: t.conditionId || t.asset || '',
        outcome: t.outcome || '',
      }));

    res.json({ success: true, data: whales });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取聪明钱钱包排行
router.get('/smart-money/wallets', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { data } = await axios.get(`${config.polymarket.dataApi}/trades`, {
      params: { limit: 2000 },
    });

    const trades = Array.isArray(data) ? data : [];
    const walletMap = {};

    trades.forEach((t) => {
      const addr = t.proxyWallet || '0xUnknown';
      if (!walletMap[addr]) {
        walletMap[addr] = {
          wallet: addr,
          tradeCount: 0,
          totalVolume: 0,
          buyCount: 0,
          sellCount: 0,
          markets: new Set(),
          lastActive: '',
        };
      }
      const value = parseFloat(t.size || '0') * parseFloat(t.price || '0');
      walletMap[addr].tradeCount++;
      walletMap[addr].totalVolume += value;
      walletMap[addr].markets.add(t.title || '');
      if (t.side === 'BUY') walletMap[addr].buyCount++;
      else walletMap[addr].sellCount++;
      const ts = t.timestamp ? new Date(t.timestamp * 1000).toISOString() : '';
      if (ts > walletMap[addr].lastActive) {
        walletMap[addr].lastActive = ts;
      }
    });

    const wallets = Object.values(walletMap)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit)
      .map((w) => ({
        ...w,
        markets: w.markets.size,
        totalVolume: w.totalVolume.toFixed(2),
        winRate: w.tradeCount > 0 ? ((w.buyCount / w.tradeCount) * 100).toFixed(1) : '0',
      }));

    res.json({ success: true, data: wallets });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取交易信号（基于大额交易的市场异动）
router.get('/smart-money/signals', async (req, res) => {
  try {
    const { data } = await axios.get(`${config.polymarket.dataApi}/trades`, {
      params: { limit: 1000 },
    });

    const trades = Array.isArray(data) ? data : [];
    const marketSignals = {};

    trades.forEach((t) => {
      const marketId = t.conditionId || t.asset || '';
      if (!marketId) return;
      
      const value = parseFloat(t.size || '0') * parseFloat(t.price || '0');
      if (value < 300) return;

      if (!marketSignals[marketId]) {
        marketSignals[marketId] = {
          tokenId: marketId,
          market: t.title || 'Unknown',
          buyVolume: 0,
          sellVolume: 0,
          whaleCount: 0,
          trades: [],
        };
      }

      if (t.side === 'BUY') {
        marketSignals[marketId].buyVolume += value;
      } else {
        marketSignals[marketId].sellVolume += value;
      }
      marketSignals[marketId].whaleCount++;
      marketSignals[marketId].trades.push({
        side: t.side,
        value: value.toFixed(2),
        timestamp: t.timestamp ? new Date(t.timestamp * 1000).toISOString() : '',
      });
    });

    const signals = Object.values(marketSignals)
      .filter((s) => s.whaleCount >= 2)
      .map((s) => {
        const total = s.buyVolume + s.sellVolume;
        const buyRatio = total > 0 ? s.buyVolume / total : 0.5;
        let signal;
        if (buyRatio > 0.7) signal = 'bullish';
        else if (buyRatio < 0.3) signal = 'bearish';
        else signal = 'neutral';

        return {
          tokenId: s.tokenId,
          market: s.market,
          signal,
          buyVolume: s.buyVolume.toFixed(2),
          sellVolume: s.sellVolume.toFixed(2),
          whaleCount: s.whaleCount,
          buyRatio: (buyRatio * 100).toFixed(1),
          latestTrades: s.trades.slice(0, 5),
        };
      })
      .sort((a, b) => b.whaleCount - a.whaleCount)
      .slice(0, 20);

    res.json({ success: true, data: signals });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取市场情绪概览
router.get('/smart-money/sentiment', async (req, res) => {
  try {
    const { data: markets } = await axios.get(`${config.polymarket.gammaApi}/markets`, {
      params: { limit: 100, order: 'volume24hr', ascending: false },
    });

    const marketList = Array.isArray(markets) ? markets : [];
    
    let bullish = 0, bearish = 0, neutral = 0;
    
    marketList.forEach((m) => {
      let outcomes = m.outcomes;
      let prices = m.outcomePrices;
      
      if (typeof outcomes === 'string') {
        try { outcomes = JSON.parse(outcomes); } catch { outcomes = []; }
      }
      if (typeof prices === 'string') {
        try { prices = JSON.parse(prices); } catch { prices = []; }
      }
      
      if (!Array.isArray(prices) || prices.length === 0) return;
      
      const firstPrice = parseFloat(prices[0]);
      if (firstPrice > 0.6) bullish++;
      else if (firstPrice < 0.4) bearish++;
      else neutral++;
    });

    const total = bullish + bearish + neutral || 1;

    res.json({
      success: true,
      data: {
        bullish: ((bullish / total) * 100).toFixed(1),
        bearish: ((bearish / total) * 100).toFixed(1),
        neutral: ((neutral / total) * 100).toFixed(1),
        totalMarkets: total,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
