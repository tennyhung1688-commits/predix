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
  feeRate: parseFloat(process.env.FEE_RATE) || 0.005,
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
  },
};
