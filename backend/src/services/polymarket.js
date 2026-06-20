const axios = require('axios');
const config = require('../config');

// 指数退避重试（应对 Polymarket 限流 429）
function withRetry(client, maxRetries = 3) {
  client.interceptors.response.use(
    res => res,
    async (err) => {
      const { config: reqConfig, response } = err;
      if (!reqConfig || (response && response.status !== 429)) return Promise.reject(err);

      reqConfig._retryCount = reqConfig._retryCount || 0;
      if (reqConfig._retryCount >= maxRetries) return Promise.reject(err);

      reqConfig._retryCount++;
      const delay = Math.pow(2, reqConfig._retryCount) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
      return client.request(reqConfig);
    }
  );
  return client;
}

const gammaClient = withRetry(axios.create({
  baseURL: config.polymarket.gammaApi,
  timeout: 15000,
}));

const clobClient = withRetry(axios.create({
  baseURL: config.polymarket.clobApi,
  timeout: 15000,
}));

const dataClient = withRetry(axios.create({
  baseURL: config.polymarket.dataApi,
  timeout: 15000,
}));

// ===== Gamma API (市场数据，无需认证) =====

const polymarketService = {
  // 获取市场列表
  // Gamma API 返回 { data: Market[], next_cursor: string|null }
  // 这里做归一化，返回 { markets, nextCursor, hasMore }
  async getMarkets(params = {}) {
    const limit = parseInt(params.limit) || 50;
    const { data } = await gammaClient.get('/markets', {
      params: {
        limit,
        offset: params.offset || 0,
        order: params.order || 'volume24hr',
        ascending: params.ascending || false,
        closed: params.closed || false,
        tag: params.tag || undefined,
        next_cursor: params.nextCursor || undefined,
        ...params,
      },
    });

    // 归一化：Gamma API 返回 { data: [...], next_cursor }
    // 但也兼容直接返回数组的情况
    const marketsArray = Array.isArray(data) ? data : (data?.data || data || []);
    const nextCursor = data?.next_cursor || null;

    return {
      markets: marketsArray,
      nextCursor,
      hasMore: nextCursor != null && marketsArray.length >= limit,
    };
  },

  // 获取单个市场详情
  async getMarket(marketId) {
    const { data } = await gammaClient.get(`/markets/${marketId}`);
    return data;
  },

  // 获取事件列表
  async getEvents(params = {}) {
    const limit = parseInt(params.limit) || 50;
    const { data } = await gammaClient.get('/events', {
      params: {
        limit,
        offset: params.offset || 0,
        active: params.active !== false,
        closed: params.closed || false,
        tag: params.tag || undefined,
        ...params,
      },
    });

    // 归一化
    const eventsArray = Array.isArray(data) ? data : (data?.data || data || []);
    const nextCursor = data?.next_cursor || null;

    return {
      markets: eventsArray,
      nextCursor,
      hasMore: nextCursor != null && eventsArray.length >= limit,
    };
  },

  // 获取单个事件
  async getEvent(eventId) {
    const { data } = await gammaClient.get(`/events/${eventId}`);
    return data;
  },

  // 搜索
  async search(query) {
    const { data } = await gammaClient.get('/markets', {
      params: { search: query, limit: 20 },
    });
    return data;
  },

  // 获取订单簿
  async getOrderBook(tokenId) {
    const { data } = await clobClient.get(`/book`, {
      params: { token_id: tokenId },
    });
    return data;
  },

  // 获取价格历史
  async getPriceHistory(tokenId, params = {}) {
    const { data } = await clobClient.get('/prices-history', {
      params: {
        market: tokenId,
        interval: params.interval || '1h',
        ...params,
      },
    });
    return data;
  },

  // 获取交易历史
  async getTrades(tokenId, params = {}) {
    const { data } = await clobClient.get('/data/trades', {
      params: {
        token_id: tokenId,
        limit: params.limit || 50,
        ...params,
      },
    });
    return data;
  },

  // 获取 CLOB 市场配置（tickSize、最小订单量等）
  async getMarketConfig(tokenId) {
    const { data } = await clobClient.get(`/markets/${tokenId}`);
    return data;
  },

  // 获取市场统计
  async getMarketStats() {
    try {
      const { data } = await gammaClient.get('/markets', {
        params: {
          limit: 1,
          order: 'volume24hr',
          ascending: false,
        },
      });
      return {
        totalVolume: data?.[0]?.volume || 0,
      };
    } catch {
      return { totalVolume: 0 };
    }
  },

  // 所有可用分类（与 Polymarket 官方标签对应）
  CATEGORIES: {
    sports:      { id: 1,     label: '⚽ 体育',        slug: 'sports' },
    politics:    { id: 2,     label: '🏛️ 政治',       slug: 'politics' },
    crypto:      { id: 21,    label: '₿ 加密货币',     slug: 'crypto' },
    geopolitics: { id: 100265, label: '🌍 地缘政治',   slug: 'geopolitics' },
    economy:     { id: 100328, label: '📊 经济',       slug: 'economy' },
    esports:     { id: 64,    label: '🎮 电竞',        slug: 'esports' },
    elections:   { id: 144,   label: '🗳️ 选举',       slug: 'elections' },
    world:       { id: 101970, label: '🌐 全球',       slug: 'world' },
    culture:     { id: 596,   label: '🎬 文化',        slug: 'pop-culture' },
    business:    { id: 107,   label: '💼 商业',        slug: 'business' },
    finance:     { id: 120,   label: '💰 金融',        slug: 'finance' },
    commodities: { id: 101031, label: '🛢️ 大宗商品',  slug: 'commodities' },
    tennis:      { id: 864,   label: '🎾 网球',        slug: 'tennis' },
    ufc:         { id: 279,   label: '🥊 UFC',         slug: 'ufc' },
    mlb:         { id: 100381, label: '⚾ MLB',         slug: 'mlb' },
    nhl:         { id: 899,   label: '🏒 NHL',         slug: 'nhl' },
    f1:          { id: 435,   label: '🏎️ F1',          slug: 'formula1' },
  },

  // 按标签获取市场（通过 events 端点，events 有完整的 tags）
  async getMarketsByTag(tag, params = {}) {
    const limit = parseInt(params.limit) || 50;
    const cat = this.CATEGORIES[tag];
    const tagId = cat ? cat.id : tag;
    const tagSlug = cat ? cat.slug : tag;
    
    // 同时拉取：事件端点（大交易量市场）+ 直接市场端点（含 5 分钟极速市场）
    const [eventsResult, directResult] = await Promise.all([
      this.getEvents({
        limit: Math.ceil(limit / 3),
        offset: params.offset || 0,
        active: true,
        closed: false,
        order: 'volume24hr',
        ascending: false,
        tag_id: tagId,
        tag: tagSlug,
      }).catch(() => ({ markets: [] })),
      this.getMarkets({
        limit: Math.ceil(limit / 2),
        offset: 0,
        closed: false,
        order: 'createdAt',
        ascending: false,
        tag: tagSlug,
      }).catch(() => ({ markets: [] })),
    ]);
    
    // 合并去重
    const seen = new Set();
    const allMarkets = [];
    
    // 事件中的市场（有完整事件信息）
    const events = eventsResult.markets || eventsResult;
    const eventArray = Array.isArray(events) ? events : [];
    for (const event of eventArray) {
      if (event.markets) {
        for (const m of event.markets) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            allMarkets.push(m);
          }
        }
      }
    }
    
    // 直接 API 的市场（独立的极速市场等）
    const directs = directResult.markets || [];
    for (const m of directs) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        allMarkets.push(m);
      }
    }
    
    return {
      markets: allMarkets.slice(0, limit),
      nextCursor: null,
      hasMore: allMarkets.length > limit,
    };
  },

  // 获取世界杯相关市场（获取体育事件后本地过滤）
  async getWorldCupMarkets(params = {}) {
    const limit = parseInt(params.limit) || 50;
    const offset = parseInt(params.offset) || 0;

    try {
      // Gamma API 的 /events 端点不支持 title 搜索参数，
      // 因此先拉取体育标签下的活跃事件，再本地用关键词过滤
      const { data } = await gammaClient.get('/events', {
        params: {
          // 拉取足够多的事件以确保过滤后有足够结果
          limit: Math.max(200, (limit + offset) * 2),
          offset: 0,
          active: true,
          closed: false,
          order: 'volume24hr',
          ascending: false,
          tag_id: 1,  // sports tag (数字)
          tag: 'sports',  // sports slug (字符串) — 兼容不同 API 版本
        },
      });

      const wcKeyword = /world\s*cup|世界杯/i;

      // 过滤出世界杯相关事件
      const wcEvents = (data || []).filter(e =>
        wcKeyword.test(e.title || '') || wcKeyword.test(e.slug || '')
      );

      // 提取所有市场，附上事件元信息
      const markets = [];
      for (const event of wcEvents) {
        if (event.markets) {
          for (const m of event.markets) {
            markets.push({
              ...m,
              eventTitle: event.title,
              eventSlug: event.slug,
              eventTags: event.tags || [],
            });
          }
        }
      }

      return markets.slice(offset, offset + limit);
    } catch (err) {
      throw new Error(`Failed to fetch World Cup markets: ${err.message}`);
    }
  },

  // 2026 世界杯静态赛程数据
  _worldCupFixtures: [
    // 小组赛 — 第1轮
    { id: 'wc-f-001', homeTeam: 'Mexico', awayTeam: 'Canada', startTime: '2026-06-11T17:00:00Z', group: 'A' },
    { id: 'wc-f-002', homeTeam: 'Egypt', awayTeam: 'New Zealand', startTime: '2026-06-12T17:00:00Z', group: 'A' },
    { id: 'wc-f-003', homeTeam: 'Argentina', awayTeam: 'Uruguay', startTime: '2026-06-12T20:00:00Z', group: 'B' },
    { id: 'wc-f-004', homeTeam: 'Iran', awayTeam: 'Panama', startTime: '2026-06-13T17:00:00Z', group: 'B' },
    { id: 'wc-f-005', homeTeam: 'France', awayTeam: 'Senegal', startTime: '2026-06-13T20:00:00Z', group: 'C' },
    { id: 'wc-f-006', homeTeam: 'Saudi Arabia', awayTeam: 'Jamaica', startTime: '2026-06-14T17:00:00Z', group: 'C' },
    { id: 'wc-f-007', homeTeam: 'Brazil', awayTeam: 'Morocco', startTime: '2026-06-14T20:00:00Z', group: 'D' },
    { id: 'wc-f-008', homeTeam: 'Japan', awayTeam: 'Costa Rica', startTime: '2026-06-15T17:00:00Z', group: 'D' },
    { id: 'wc-f-009', homeTeam: 'England', awayTeam: 'Nigeria', startTime: '2026-06-15T20:00:00Z', group: 'E' },
    { id: 'wc-f-010', homeTeam: 'South Korea', awayTeam: 'Norway', startTime: '2026-06-16T17:00:00Z', group: 'E' },
    { id: 'wc-f-011', homeTeam: 'Portugal', awayTeam: 'Colombia', startTime: '2026-06-16T20:00:00Z', group: 'F' },
    { id: 'wc-f-012', homeTeam: 'Poland', awayTeam: 'Iraq', startTime: '2026-06-17T17:00:00Z', group: 'F' },
    { id: 'wc-f-013', homeTeam: 'Germany', awayTeam: 'Ecuador', startTime: '2026-06-17T20:00:00Z', group: 'G' },
    { id: 'wc-f-014', homeTeam: 'Chile', awayTeam: 'South Africa', startTime: '2026-06-18T17:00:00Z', group: 'G' },
    { id: 'wc-f-015', homeTeam: 'Spain', awayTeam: 'Peru', startTime: '2026-06-18T20:00:00Z', group: 'H' },
    { id: 'wc-f-016', homeTeam: 'Ivory Coast', awayTeam: 'UAE', startTime: '2026-06-19T17:00:00Z', group: 'H' },
    { id: 'wc-f-017', homeTeam: 'Italy', awayTeam: 'Serbia', startTime: '2026-06-19T20:00:00Z', group: 'I' },
    { id: 'wc-f-018', homeTeam: 'Qatar', awayTeam: 'Honduras', startTime: '2026-06-20T17:00:00Z', group: 'I' },
    { id: 'wc-f-019', homeTeam: 'Netherlands', awayTeam: 'Paraguay', startTime: '2026-06-20T20:00:00Z', group: 'J' },
    { id: 'wc-f-020', homeTeam: 'Cameroon', awayTeam: 'China', startTime: '2026-06-21T17:00:00Z', group: 'J' },
    { id: 'wc-f-021', homeTeam: 'USA', awayTeam: 'Turkey', startTime: '2026-06-21T20:00:00Z', group: 'K' },
    { id: 'wc-f-022', homeTeam: 'Sweden', awayTeam: 'Algeria', startTime: '2026-06-22T17:00:00Z', group: 'K' },
    { id: 'wc-f-023', homeTeam: 'Belgium', awayTeam: 'Egypt', startTime: '2026-06-22T20:00:00Z', group: 'L' },
    { id: 'wc-f-024', homeTeam: 'Australia', awayTeam: 'Ghana', startTime: '2026-06-23T17:00:00Z', group: 'L' },
    // 小组赛 — 第2轮 (selected key matches)
    { id: 'wc-f-025', homeTeam: 'Mexico', awayTeam: 'New Zealand', startTime: '2026-06-16T20:00:00Z', group: 'A' },
    { id: 'wc-f-026', homeTeam: 'Argentina', awayTeam: 'Panama', startTime: '2026-06-17T20:00:00Z', group: 'B' },
    { id: 'wc-f-027', homeTeam: 'France', awayTeam: 'Jamaica', startTime: '2026-06-18T20:00:00Z', group: 'C' },
    { id: 'wc-f-028', homeTeam: 'Brazil', awayTeam: 'Costa Rica', startTime: '2026-06-19T20:00:00Z', group: 'D' },
    { id: 'wc-f-029', homeTeam: 'England', awayTeam: 'Norway', startTime: '2026-06-20T20:00:00Z', group: 'E' },
    { id: 'wc-f-030', homeTeam: 'Portugal', awayTeam: 'Iraq', startTime: '2026-06-21T20:00:00Z', group: 'F' },
    { id: 'wc-f-031', homeTeam: 'Germany', awayTeam: 'South Africa', startTime: '2026-06-22T20:00:00Z', group: 'G' },
    { id: 'wc-f-032', homeTeam: 'Spain', awayTeam: 'UAE', startTime: '2026-06-23T20:00:00Z', group: 'H' },
  ],

  // 获取世界杯比赛日程（静态赛程 + Polymarket 动态市场数据）
  async getWorldCupSchedule() {
    try {
      // 1. 从 Polymarket API 获取有市场的世界杯比赛
      const { data } = await gammaClient.get('/events', {
        params: {
          limit: 500,
          offset: 0,
          active: true,
          closed: false,
          order: 'volume24hr',
          ascending: false,
        },
      });

      const wcKeyword = /fifa world cup|world\s*cup|世界杯/i;
      const matchPattern = /(.+?)\s+vs\.?\s+(.+)/i;

      // 过滤出世界杯相关且有 vs 对阵的比赛事件
      // 需要排除的子市场关键词（不是比赛对阵本身）
      const subMarketKeywords = /\b(exact score|correct score|score line|player props|over\/?under|handicap|total goals|both teams to score|half time|full time|1x2|asian handicap|shots|cards|corners|fouls|offsides|passes|tackles|saves|clean sheet)\b/i;

      const apiMatches = [];
      const seenApiKeys = new Set(); // 按对阵去重，保留成交量最高的
      for (const event of (data || [])) {
        const title = event.title || '';
        const slug = event.slug || '';
        const tags = (event.tags || []).map(t => t.label || '');
        const allTags = tags.join(' ');

        // 必须有 FIFA World Cup 标签或世界杯关键词
        const isWorldCup = allTags.includes('FIFA World Cup')
          || wcKeyword.test(title)
          || wcKeyword.test(slug);

        if (!isWorldCup) continue;

        // 排除子市场（Exact Score 等）
        if (subMarketKeywords.test(title) || subMarketKeywords.test(slug)) continue;

        const matchMatch = title.match(matchPattern);

        if (matchMatch) {
          const homeTeam = matchMatch[1].trim().replace(/\s*-\s*More Markets$/i, '');
          const awayTeam = matchMatch[2].trim().replace(/\s*-\s*More Markets$/i, '');

          // 去重：同对阵只保留一个（取成交量高的）
          const key = `${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}`;
          if (seenApiKeys.has(key)) {
            const existing = apiMatches.find(m =>
              m.homeTeam.toLowerCase() === homeTeam.toLowerCase()
              && m.awayTeam.toLowerCase() === awayTeam.toLowerCase()
            );
            if (existing && parseFloat(event.volume24hr || 0) > parseFloat(existing.volume24hr || 0)) {
              // 替换为成交量更高的版本
              Object.assign(existing, {
                id: event.id || event.ticker,
                eventId: event.id,
                volume24hr: event.volume24hr || event.volume || '0',
                liquidity: event.liquidity || '0',
                markets: (event.markets || []).map(m => ({
                  id: m.id || m.conditionId,
                  conditionId: m.conditionId,
                  question: m.question || m.title,
                  outcomes: m.outcomes || [],
                  volume24hr: m.volume24hr || m.volume || '0',
                  tokenIds: m.tokenIds || m.clobTokenIds || [],
                })),
              });
            }
            continue;
          }
          seenApiKeys.add(key);

          const matchMarkets = (event.markets || []).map(m => ({
            id: m.id || m.conditionId,
            conditionId: m.conditionId,
            question: m.question || m.title,
            outcomes: m.outcomes || [],
            volume24hr: m.volume24hr || m.volume || '0',
            tokenIds: m.tokenIds || m.clobTokenIds || [],
          }));

          apiMatches.push({
            id: event.id || event.ticker,
            eventId: event.id,
            homeTeam,
            awayTeam,
            title: `${homeTeam} vs ${awayTeam}`,
            startTime: event.startDate || event.activeDate || null,
            endTime: event.endDate || event.closeDate || null,
            volume24hr: event.volume24hr || event.volume || '0',
            liquidity: event.liquidity || '0',
            tags: event.tags || [],
            markets: matchMarkets,
            source: 'polymarket',
          });
        }
      }

      // 2. 将 Polymarket 数据与静态赛程合并（按队名匹配日期）
      const fixtures = this._worldCupFixtures.map(f => ({
        id: f.id,
        eventId: f.id,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        title: `${f.homeTeam} vs ${f.awayTeam}`,
        startTime: f.startTime,
        endTime: null,
        volume24hr: '0',
        liquidity: '0',
        tags: [],
        markets: [],
        source: 'fixture',
        _key: `${f.homeTeam.toLowerCase()}|${f.awayTeam.toLowerCase()}`,
      }));

      // 匹配函数：主客队相同（允许顺序互换）
      const teamKey = (h, a) => `${h.toLowerCase()}|${a.toLowerCase()}`;

      const merged = [];
      const usedFixtures = new Set();

      for (const pm of apiMatches) {
        const pmKey = teamKey(pm.homeTeam, pm.awayTeam);
        const pmKeyRev = teamKey(pm.awayTeam, pm.homeTeam);

        // 尝试匹配静态赛程
        const fixture = fixtures.find(
          f => !usedFixtures.has(f._key)
            && (f._key === pmKey || f._key === pmKeyRev)
        );

        if (fixture) {
          // 用静态赛程的日期，Polymarket 的市场数据
          usedFixtures.add(fixture._key);
          merged.push({
            ...fixture,
            id: pm.eventId || fixture.id,
            eventId: pm.eventId || fixture.id,
            startTime: fixture.startTime, // 使用真实比赛日期
            volume24hr: pm.volume24hr || '0',
            liquidity: pm.liquidity || '0',
            markets: pm.markets,
            tags: pm.tags || [],
            source: 'merged',
            _key: fixture._key,
          });
        } else {
          // 未匹配到赛程，清空日期（Polymarket 的 startDate 是市场创建日，非比赛日）
          merged.push({ ...pm, startTime: null, _key: pmKey });
        }
      }

      // 添加剩余的静态赛程（Polymarket 没覆盖的）
      for (const f of fixtures) {
        if (!usedFixtures.has(f._key)) {
          merged.push(f);
        }
      }

      // 3. 排序：有比赛日期的在前（升序），无日期的排最后；同日期有市场的优先
      merged.sort((a, b) => {
        const aTime = a.startTime;
        const bTime = b.startTime;
        if (!aTime && !bTime) {
          // 都无日期：有市场的排前
          const aHasMarkets = (a.markets || []).length > 0 ? 0 : 1;
          const bHasMarkets = (b.markets || []).length > 0 ? 0 : 1;
          return aHasMarkets - bHasMarkets;
        }
        if (!aTime) return 1;
        if (!bTime) return -1;
        const timeSort = new Date(aTime).getTime() - new Date(bTime).getTime();
        if (timeSort !== 0) return timeSort;
        // 同日期：有市场的优先
        return ((b.markets || []).length > 0 ? 1 : 0) - ((a.markets || []).length > 0 ? 1 : 0);
      });

      // 移除内部 _key
      return merged.map(({ _key, ...rest }) => rest);
    } catch (err) {
      // 如果 API 失败，至少返回静态赛程
      return this._worldCupFixtures.map(f => ({
        id: f.id,
        eventId: f.id,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        title: `${f.homeTeam} vs ${f.awayTeam}`,
        startTime: f.startTime,
        endTime: null,
        volume24hr: '0',
        liquidity: '0',
        tags: [],
        markets: [],
        source: 'fixture',
      }));
    }
  },

  // 获取趋势话题/标签
  async getTrendingTags() {
    try {
      const { data } = await gammaClient.get('/events', {
        params: { limit: 20, active: true, order: 'volume24hr', ascending: false },
      });
      // 提取标签（去重，保留 id）
      const seen = new Map();
      (data || []).forEach(event => {
        (event.tags || []).forEach(tag => {
          if (tag && tag.label && !seen.has(tag.label)) {
            seen.set(tag.label, { id: tag.id, label: tag.label });
          }
        });
      });
      return Array.from(seen.values()).slice(0, 15);
    } catch {
      return [];
    }
  },
};

module.exports = polymarketService;
