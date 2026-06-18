/**
 * 交易流程测试（Demo 模式）
 *
 * 覆盖：
 * - POST   /api/order           下单（BUY / SELL，限价单 / 市价单）
 * - GET    /api/orders           查询订单列表
 * - DELETE /api/order/:orderId   取消订单
 * - GET    /api/fee-info         查询手续费配置
 * - 异常场景：余额不足、参数缺失、无效 side、取消他人订单
 */
const request = require('supertest');
const { app } = require('../src/index');

const TEST_WALLET = '0xCCCC3333444455556666777788889999AAAABBBB';
let authToken;
let userId;
let orderId;

describe('Trading API', () => {
  beforeAll(async () => {
    await global.__cleanDatabase__();

    // 创建测试用户并充值
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ walletAddress: TEST_WALLET });
    authToken = loginRes.body.data.token;
    userId = loginRes.body.data.user.id;

    // 充值 500 USDC 用于交易
    await request(app)
      .post('/api/balance/deposit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ txHash: '0x' + 'e'.repeat(64), amount: 500 });
  });

  afterAll(async () => {
    await global.__cleanDatabase__();
  });

  // ==================== GET /api/fee-info ====================

  describe('GET /api/fee-info', () => {
    it('应返回手续费配置（Demo 模式）', async () => {
      const res = await request(app).get('/api/fee-info');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.demo).toBe(true);
      expect(res.body.data.feeRate).toBe(0.005);
      expect(res.body.data.feePercent).toBe('0.5%');
    });
  });

  // ==================== POST /api/order (限价单) ====================

  describe('POST /api/order — 限价单', () => {
    it('BUY 限价单：应成功创建并成交', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenId: 'token_btc_yes_001',
          side: 'BUY',
          size: 10,
          price: 0.55,
          orderType: 'GTC',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.demo).toBe(true);
      expect(res.body.data.trade.side).toBe('BUY');
      expect(res.body.data.trade.size).toBe(10);
      expect(res.body.data.trade.originalPrice).toBe(0.55);
      expect(res.body.data.trade.status).toBe('filled');
      expect(res.body.data.trade.spreadFee).toBeGreaterThan(0);
      expect(res.body.data.balance.deducted).toBeGreaterThan(0);

      // 保存订单 ID
      orderId = res.body.data.trade.id;
    });

    it('SELL 限价单：应成功创建并成交', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenId: 'token_btc_yes_001',
          side: 'SELL',
          size: 3,
          price: 0.60,
          orderType: 'GTC',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trade.side).toBe('SELL');
      expect(res.body.data.trade.status).toBe('filled');
    });

    it('余额不足：应返回 400', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenId: 'token_btc_yes_001',
          side: 'BUY',
          size: 99999,
          price: 0.99,
          orderType: 'GTC',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/余额不足/);
    });

    it('无效 side：应返回 400', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenId: 'token_btc_yes_001',
          side: 'INVALID',
          size: 5,
          price: 0.5,
          orderType: 'GTC',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('缺少 tokenId：应返回 400', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ side: 'BUY', size: 5, price: 0.5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('size 为零：应返回 400', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tokenId: 'token_btc_yes_001', side: 'BUY', size: 0, price: 0.5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('price 为负数：应返回 400', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tokenId: 'token_btc_yes_001', side: 'BUY', size: 5, price: -0.1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('未认证：应返回 401', async () => {
      const res = await request(app)
        .post('/api/order')
        .send({ tokenId: 'token_btc_yes_001', side: 'BUY', size: 5, price: 0.5 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== POST /api/order (市价单) ====================

  describe('POST /api/order — 市价单', () => {
    it('MARKET_FAK 市价买单：应成功', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenId: 'token_eth_no_002',
          side: 'BUY',
          amount: 20,
          orderType: 'MARKET_FAK',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trade.status).toBe('filled');
    });

    it('市价单缺少 amount：应返回 400', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenId: 'token_eth_no_002',
          side: 'BUY',
          orderType: 'MARKET_FAK',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/amount/);
    });

    it('市价单 amount 为零：应返回 400', async () => {
      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenId: 'token_eth_no_002',
          side: 'BUY',
          amount: 0,
          orderType: 'MARKET_FAK',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== GET /api/orders ====================

  describe('GET /api/orders', () => {
    it('应返回订单列表', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // 至少包含之前创建的几个订单
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('未认证：应返回 401', async () => {
      const res = await request(app).get('/api/orders');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== DELETE /api/order/:orderId ====================

  describe('DELETE /api/order/:orderId', () => {
    it('应取消已成交订单（本地取消 + 退款）', async () => {
      const res = await request(app)
        .delete(`/api/order/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(orderId);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('重复取消：应返回 400', async () => {
      const res = await request(app)
        .delete(`/api/order/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('不存在的订单：应返回 404', async () => {
      const res = await request(app)
        .delete('/api/order/non-existent-order-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('未认证：应返回 401', async () => {
      const res = await request(app).delete(`/api/order/${orderId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
