const crypto = require('crypto');
require('dotenv').config();
const logger = require('../lib/logger');

// 生产环境强制要求设置 JWT_SECRET，开发/测试环境自动生成随机密钥
function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET 环境变量未设置，生产环境必须配置强密钥');
  }
  // 非生产环境自动生成，但每次重启会变化（用户需重新登录）
  const randomSecret = crypto.randomBytes(64).toString('hex');
  logger.warn('[安全警告] JWT_SECRET 未设置，已自动生成临时密钥。生产环境请务必通过环境变量设置 JWT_SECRET。');
  return randomSecret;
}

module.exports = {
  port: process.env.PORT || 3001,
  jwtSecret: getJwtSecret(),
  polymarket: {
    gammaApi: process.env.POLYMARKET_GAMMA_API || 'https://gamma-api.polymarket.com',
    clobApi: process.env.POLYMARKET_CLOB_API || 'https://clob.polymarket.com',
    dataApi: process.env.POLYMARKET_DATA_API || 'https://data-api.polymarket.com',
    wsUrl: process.env.POLYMARKET_WS || 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
  },
  // ---------------------------------------------------------------
  // 分档手续费率（按 Polymarket 市场类型匹配实际 taker 费 + 利润）
  // Polymarket 公式: fee = C × feeRate × p × (1-p)
  // 各市场在 p=0.5 时的 Polymarket 有效费率：
  //   Geopolitics 0% | Sports 1.5% | Finance/Politics/Tech 2.0%
  //   Economics/Culture/Weather 2.5% | Crypto 3.5%
  // 平台净利 = 平台收费 - Polymarket taker 费（留 1.0% 含 0.4% 返佣预算）
  // ---------------------------------------------------------------
  feeRate: parseFloat(process.env.FEE_RATE) || 0.04,   // 兜底默认 4%
  categoryFeeRates: {
    geopolitics:  0.015,  // 1.5% - 0% cost = 1.5% profit
    sports:       0.025,  // 2.5% - 1.5% cost = 1.0% profit
    politics:     0.03,   // 3.0% - 2.0% cost = 1.0% profit
    finance:      0.03,
    business:     0.03,
    economy:      0.035,  // 3.5% - 2.5% cost = 1.0% profit
    culture:      0.035,
    crypto:       0.045,  // 4.5% - 3.5% cost = 1.0% profit
    default:      0.04,   // 4.0% 兜底
  },
  // Polymarket taker 费率（按市场类型，p=0.5 时的有效费率）
  polymarketCost: {
    geopolitics:  0,
    sports:       0.015,
    politics:     0.02,
    finance:      0.02,
    business:     0.02,
    economy:      0.025,
    culture:      0.025,
    crypto:       0.035,
    default:      0.035,
  },
  // 根据 PrediX 费率反向匹配 Polymarket 成本
  getPolyCostByFeeRate(prediXFeeRate) {
    for (const [key, rate] of Object.entries(this.categoryFeeRates)) {
      if (Math.abs(rate - prediXFeeRate) < 0.001) {
        return this.polymarketCost[key] || this.polymarketCost.default;
      }
    }
    return this.polymarketCost.default;
  },
  // 分类标签 → 费率 key 映射（从 Polymarket 标签匹配）
  getCategoryFeeRate(tags = []) {
    const allTags = (Array.isArray(tags) ? tags : []).map(t =>
      (typeof t === 'string' ? t : (t.label || t.slug || '')).toLowerCase()
    );
    const text = allTags.join(' ');

    // 地缘政治
    if (/geopolit|war|conflict|military|nato|ukraine|russia|china|taiwan|iran|north.?korea/i.test(text))
      return this.categoryFeeRates.geopolitics;

    // 体育（最常用，先匹配）
    if (/sport|football|soccer|basketball|nfl|nba|mlb|nhl|ufc|mma|boxing|tennis|f1|formula|olympic|world.?cup|cricket|rugby|golf|esport/i.test(text))
      return this.categoryFeeRates.sports;

    // 加密货币
    if (/crypto|bitcoin|btc|eth|token|defi|nft|blockchain|web3/i.test(text))
      return this.categoryFeeRates.crypto;

    // 政治 & 选举
    if (/politic|election|vote|congress|senat|president|governor|democrat|republican/i.test(text))
      return this.categoryFeeRates.politics;

    // 金融
    if (/financ|stock|market|spx|nasdaq|dow|interest.?rate|fed|treasury|bond|inflation|cpi|gdp/i.test(text))
      return this.categoryFeeRates.finance;

    // 商业
    if (/business|compan|startup|ipo|revenue|earnings|acquisition|merger/i.test(text))
      return this.categoryFeeRates.business;

    // 经济
    if (/econom|unemployment|recession|tariff|trade.?war|commodity|oil|gold|energy/i.test(text))
      return this.categoryFeeRates.economy;

    // 文化/娱乐
    if (/culture|music|movie|film|tv|award|oscar|grammy|celebrity|entertainment/i.test(text))
      return this.categoryFeeRates.culture;

    return this.categoryFeeRates.default;
  },
  corsOrigin: (() => {
    const origin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
    // 生产环境未设置 CORS_ORIGIN 时警告（仅警告，允许 localhost fallback 用于内网部署）
    if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
      logger.warn('[安全警告] CORS_ORIGIN 未设置，生产环境建议明确配置允许的前端域名');
    }
    return origin || 'http://localhost:3000';
  })(),

  // 平台钱包配置
  platform: {
    walletAddress: process.env.PLATFORM_WALLET_ADDRESS || '',
    privateKey: process.env.PLATFORM_WALLET_PRIVATE_KEY || '',
    polyApiKey: process.env.PLATFORM_POLY_API_KEY || '',
    polyApiSecret: process.env.PLATFORM_POLY_API_SECRET || '',
    polyPassphrase: process.env.PLATFORM_POLY_PASSPHRASE || '',
    signatureType: parseInt(process.env.PLATFORM_SIGNATURE_TYPE) || 0, // 0=EOA, 3=POLY_1271
    funderAddress: process.env.PLATFORM_FUNDER_ADDRESS || '',
    feeMode: process.env.PLATFORM_FEE_MODE || 'spread',
    minWithdrawAmount: parseFloat(process.env.MIN_WITHDRAW_AMOUNT) || 10,
    newUserBonus: parseFloat(process.env.NEW_USER_BONUS) || 100,
    depositAddress: process.env.PLATFORM_WALLET_ADDRESS || '',
  },
  polygonscanApiKey: process.env.POLYGONSCAN_API_KEY || '',
};
