/**
 * 平台钱包服务 (v2 — 使用 @polymarket/clob-client-v2 SDK)
 *
 * 管理平台的 Polymarket 代理钱包：
 * - L1 钱包签名（viem）
 * - L2 API 凭证 HMAC 签名（SDK 内置）
 * - 订单创建/提交/取消
 */

const config = require('../config');
const prisma = require('../lib/prisma');

class PlatformWalletService {
  constructor() {
    this.address = config.platform.walletAddress;
    this.privateKey = config.platform.privateKey;
    this.apiKey = config.platform.polyApiKey;
    this.apiSecret = config.platform.polyApiSecret;
    this.passphrase = config.platform.polyPassphrase;
    this.signatureType = config.platform.signatureType;      // 0=EOA, 3=POLY_1271
    this.funderAddress = config.platform.funderAddress;      // 用于 POLY_1271 签名模式
    this._clobClient = null;
    this._Side = null;
    this._OrderType = null;
    this._initialized = false;
  }

  /**
   * 初始化：将平台钱包写入数据库
   */
  async init() {
    if (!this.address) {
      console.warn('⚠️  PLATFORM_WALLET_ADDRESS 未配置，平台钱包代理模式不会生效');
      return null;
    }

    const wallet = await prisma.platformWallet.upsert({
      where: { address: this.address.toLowerCase() },
      update: { isActive: true },
      create: {
        address: this.address.toLowerCase(),
        label: 'main',
        isActive: true,
      },
    });

    this._initialized = true;
    console.log(`✅ 平台钱包已就绪: ${this.address.toLowerCase()}`);
    return wallet;
  }

  /**
   * 懒加载 ClobClient（动态 import ESM-only SDK）
   */
  async _getClient() {
    if (this._clobClient) return this._clobClient;

    const [{ ClobClient, Side, OrderType }, { createWalletClient, http }, { privateKeyToAccount }, { polygon }] =
      await Promise.all([
        import('@polymarket/clob-client-v2'),
        import('viem'),
        import('viem/accounts'),
        import('viem/chains'),
      ]);

    this._Side = Side;
    this._OrderType = OrderType;

    const rawKey = this.privateKey.startsWith('0x') ? this.privateKey : `0x${this.privateKey}`;
    const account = privateKeyToAccount(rawKey);
    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(),
    });

    const clientOpts = {
      host: config.polymarket.clobApi,
      chain: 137,
      signer: walletClient,
      creds: {
        key: this.apiKey,
        secret: this.apiSecret,
        passphrase: this.passphrase,
      },
    };

    // POLY_1271 签名模式 (signatureType=3)：需要 funderAddress
    if (this.signatureType === 3) {
      clientOpts.signatureType = 3;
      if (this.funderAddress) {
        clientOpts.funder = this.funderAddress;
      }
      console.log('🔐 使用 POLY_1271 签名模式');
    }

    this._clobClient = new ClobClient(clientOpts);

    console.log('✅ ClobClient v2 已初始化');
    return this._clobClient;
  }

  /**
   * 获取 Side / OrderType 枚举（供交易路由使用）
   */
  async getEnums() {
    if (!this._Side || !this._OrderType) {
      await this._getClient();
    }
    return { Side: this._Side, OrderType: this._OrderType };
  }

  /**
   * 创建并提交限价单 (GTC / IOC / FOK / Post-Only)
   */
  async createOrder({ tokenId, price, size, side, orderType = 'GTC', tickSize = '0.01' }) {
    const client = await this._getClient();
    const { Side, OrderType } = this;

    const sideEnum = side === 'BUY' ? Side.BUY : Side.SELL;

    // 映射订单类型
    const typeMap = {
      GTC: OrderType.GTC,
      IOC: OrderType.IOC,
      FOK: OrderType.FOK,
      'Post-Only': OrderType.PostOnly,
    };
    const ot = typeMap[orderType] || OrderType.GTC;

    return client.createAndPostOrder(
      {
        tokenID: tokenId,
        price,
        size,
        side: sideEnum,
      },
      { tickSize },
      ot,
    );
  }

  /**
   * 创建并提交市价单
   */
  async createMarketOrder({ tokenId, amount, side, orderType = 'FAK', tickSize = '0.01' }) {
    const client = await this._getClient();
    const { Side, OrderType } = this;

    const ot = orderType === 'FOK' ? OrderType.FOK : OrderType.FAK;
    return client.createAndPostMarketOrder(
      {
        tokenID: tokenId,
        amount,
        side: side === 'BUY' ? Side.BUY : Side.SELL,
        orderType: ot,
      },
      { tickSize },
      ot,
    );
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId) {
    const client = await this._getClient();
    try {
      return await client.cancelOrder(orderId);
    } catch (e) {
      console.warn(`⚠️  Polymarket 取消失败 (${orderId}):`, e.message);
      throw e;
    }
  }

  /**
   * 取消所有未成交订单
   */
  async cancelAll() {
    const client = await this._getClient();
    return client.cancelAll();
  }

  /**
   * 获取订单簿（通过 SDK）
   */
  async getOrderBook(tokenId) {
    const client = await this._getClient();
    return client.getOrderBook(tokenId);
  }

  /**
   * 检查平台钱包是否已完整配置（私钥 + API 凭证）
   */
  isConfigured() {
    return !!(
      this.address &&
      this.privateKey &&
      this.apiKey &&
      this.apiSecret
    );
  }

  /**
   * 获取活跃的平台钱包信息
   */
  async getActiveWallet() {
    return prisma.platformWallet.findFirst({
      where: { isActive: true },
    });
  }
}

module.exports = new PlatformWalletService();
