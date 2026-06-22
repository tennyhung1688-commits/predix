const express = require('express');
const axios = require('axios');
const polymarketService = require('../services/polymarket');
const { translateMarkets } = require('../services/translate');
const { sendError } = require('../lib/errors');
const logger = require('../lib/logger');
const config = require('../config');

const router = express.Router();

// 获取可用分类列表
router.get('/categories', (req, res) => {
  const categories = Object.entries(polymarketService.CATEGORIES).map(([key, val]) => ({
    id: key,
    tagId: val.id,
    label: val.label,
    slug: val.slug,
  }));
  res.json({ success: true, data: categories });
});

// 获取市场列表
router.get('/markets', async (req, res) => {
  try {
    // 如果有 tag 参数，使用按标签获取市场的方法
    if (req.query.tag) {
      const tag = req.query.tag;
      const data = await polymarketService.getMarketsByTag(tag, req.query);
      const translated = await translateMarkets(data.markets);
      return res.json({
        success: true,
        data: translated,
        nextCursor: data.nextCursor,
        hasMore: data.hasMore,
      });
    }
    const data = await polymarketService.getMarkets(req.query);
    const translated = await translateMarkets(data.markets);
    res.json({
      success: true,
      data: translated,
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取单个市场详情
router.get('/markets/:id', async (req, res) => {
  try {
    const data = await polymarketService.getMarket(req.params.id);
    const [translated] = await translateMarkets([data]);
    res.json({ success: true, data: translated });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取事件列表
router.get('/events', async (req, res) => {
  try {
    const data = await polymarketService.getEvents(req.query);
    const translated = await translateMarkets(data.markets);
    res.json({
      success: true,
      data: translated,
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取单个事件
router.get('/events/:id', async (req, res) => {
  try {
    const data = await polymarketService.getEvent(req.params.id);
    const [translated] = await translateMarkets([data]);
    res.json({ success: true, data: translated });
  } catch (err) {
    sendError(res, err);
  }
});

// 搜索
router.get('/search', async (req, res) => {
  try {
    const data = await polymarketService.search(req.query.q);
    // 搜索结果可能是数组或对象，如果是数组则翻译
    const translated = Array.isArray(data) ? await translateMarkets(data) : data;
    res.json({ success: true, data: translated });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取订单簿
router.get('/orderbook/:tokenId', async (req, res) => {
  try {
    const data = await polymarketService.getOrderBook(req.params.tokenId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取价格历史
router.get('/price-history/:tokenId', async (req, res) => {
  try {
    const data = await polymarketService.getPriceHistory(req.params.tokenId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取交易记录
router.get('/trades/:tokenId', async (req, res) => {
  try {
    const data = await polymarketService.getTrades(req.params.tokenId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取世界杯市场数据
router.get('/world-cup/markets', async (req, res) => {
  try {
    const data = await polymarketService.getWorldCupMarkets(req.query);
    const translated = Array.isArray(data) ? await translateMarkets(data) : data;
    res.json({ success: true, data: translated });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取世界杯比赛日程
router.get('/world-cup/schedule', async (req, res) => {
  try {
    const data = await polymarketService.getWorldCupSchedule();
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取趋势标签
router.get('/trending-tags', async (req, res) => {
  try {
    const data = await polymarketService.getTrendingTags();
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取 CLOB 市场配置（tickSize、最小订单量等）
router.get('/markets/:tokenId/config', async (req, res) => {
  try {
    const config = await polymarketService.getMarketConfig(req.params.tokenId);
    res.json({ success: true, data: config });
  } catch (err) {
    sendError(res, err);
  }
});

// -------- 图片搜索（Pixabay + 降级） --------

// 简单内存缓存（24h）；空结果也缓存（5min 防 429 重试）
const imageCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const EMPTY_CACHE_TTL = 5 * 60 * 1000;

// 请求队列防并发同 key
const pendingFetches = new Map();

async function fetchFromPixabay(query) {
  const { data } = await axios.get('https://pixabay.com/api/', {
    params: {
      key: config.pixabayApiKey,
      q: query,
      image_type: 'photo',
      per_page: 5,
      safesearch: 'true',
    },
    timeout: 8000,
    validateStatus: s => s < 500, // 429 不进 catch
  });

  if (data.totalHits > 0 && data.hits?.length > 0) {
    return data.hits.map(h => ({
      url: h.webformatURL.replace('_640', '_340'),
      thumbnail: h.previewURL,
      width: h.webformatWidth,
      height: h.webformatHeight,
      source: 'pixabay',
      tags: h.tags,
    }));
  }
  return [];
}

router.get('/images', async (req, res) => {
  try {
    const raw = (req.query.q || '').trim().slice(0, 100);
    if (!raw) return res.json({ success: false, error: 'Missing query' });

    // 支持批量：?q=world cup,soccer,election
    const queries = raw.split(',').map(q => q.trim()).filter(Boolean);
    if (queries.length === 0) return res.json({ success: false, error: 'Empty query' });

    const results = {};

    for (const query of queries) {
      // 检查缓存
      const cached = imageCache.get(query);
      if (cached && Date.now() - cached.ts < (cached.data.length ? CACHE_TTL : EMPTY_CACHE_TTL)) {
        results[query] = cached.data;
        continue;
      }

      // 合并并发请求
      if (pendingFetches.has(query)) {
        results[query] = await pendingFetches.get(query);
        continue;
      }

      // 请求 Pixabay
      const promise = config.pixabayApiKey
        ? fetchFromPixabay(query).catch(e => {
            logger.warn(`[Pixabay] 搜索失败: ${query}`, e.message);
            return [];
          })
        : Promise.resolve([]);

      pendingFetches.set(query, promise);
      try {
        const images = await promise;
        imageCache.set(query, { ts: Date.now(), data: images });
        results[query] = images;
      } finally {
        pendingFetches.delete(query);
      }
    }

    // 单查询直接返回数组，批量返回映射
    if (queries.length === 1) {
      const data = results[queries[0]];
      return res.json({ success: true, data, fallback: data.length === 0 });
    }
    res.json({ success: true, data: results });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
