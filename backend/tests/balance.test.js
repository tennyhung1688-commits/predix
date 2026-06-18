/**
 * 余额管理流程测试
 *
 * 覆盖：
 * - GET  /api/balance                   查询余额
 * - POST /api/balance/deposit           充值
 * - POST /api/balance/withdraw          提现
 * - GET  /api/balance/transactions      交易流水
 * - 异常场景：负数金额、超额提现、未认证
 */
const request = require('supertest');
const { app } = require('../src/index');

const TEST_WALLET = '0xBBBB22223333444455556666777788889999AAAA';
let authToken;
let userId;

describe('Balance API', () => {
  beforeAll(async () => {
    await global.__cleanDatabase__();
    // 创建测试用户
    const res = await request(app)
      .post('/api/auth/login')
      .send({ walletAddress: TEST_WALLET });
    authToken = res.body.data.token;
    userId = res.body.data.user.id;
  });

  afterAll(async () => {
    await global.__cleanDatabase__();
  });

  // ==================== GET /api/balance ====================

  describe('GET /api/balance', () => {
    it('已认证用户：应返回余额信息', async () => {
      const res = await request(app)
        .get('/api/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balance).toBeDefined();
      expect(res.body.data.lockedBalance).toBeDefined();
      expect(res.body.data.available).toBeDefined();
    });

    it('未认证：应返回 401', async () => {
      const res = await request(app).get('/api/balance');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== POST /api/balance/deposit ====================

  describe('POST /api/balance/deposit', () => {
    it('正常充值：余额应增加', async () => {
      const res = await request(app)
        .post('/api/balance/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          txHash: '0x' + 'a'.repeat(64),
          amount: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(100);
      expect(res.body.data.status).toBe('confirmed');

      // 验证余额已更新
      const balanceRes = await request(app)
        .get('/api/balance')
        .set('Authorization', `Bearer ${authToken}`);
      expect(balanceRes.body.data.balance).toBe(100);
    });

    it('重复 txHash 充值：应失败', async () => {
      const res = await request(app)
        .post('/api/balance/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          txHash: '0x' + 'a'.repeat(64), // 与上一条相同
          amount: 50,
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('负数金额充值：应返回 400', async () => {
      const res = await request(app)
        .post('/api/balance/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ txHash: '0x' + 'b'.repeat(64), amount: -10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('零金额充值：应返回 400', async () => {
      const res = await request(app)
        .post('/api/balance/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ txHash: '0x' + 'c'.repeat(64), amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('缺少 amount：应返回 400', async () => {
      const res = await request(app)
        .post('/api/balance/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ txHash: '0x' + 'd'.repeat(64) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('未认证：应返回 401', async () => {
      const res = await request(app)
        .post('/api/balance/deposit')
        .send({ txHash: '0xnone', amount: 10 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== POST /api/balance/withdraw ====================

  describe('POST /api/balance/withdraw', () => {
    it('正常提现（金额 ≤ 余额）：应成功', async () => {
      const res = await request(app)
        .post('/api/balance/withdraw')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toAddress: '0x' + '1'.repeat(40),
          amount: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(30);

      // 验证余额已锁定（提现锁定余额，不直接扣减 balance）
      const balanceRes = await request(app)
        .get('/api/balance')
        .set('Authorization', `Bearer ${authToken}`);
      expect(balanceRes.body.data.available).toBe(70);
      expect(balanceRes.body.data.lockedBalance).toBe(30);
    });

    it('超额提现：应返回错误', async () => {
      const res = await request(app)
        .post('/api/balance/withdraw')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toAddress: '0x' + '2'.repeat(40),
          amount: 99999,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('负数金额提现：应返回 400', async () => {
      const res = await request(app)
        .post('/api/balance/withdraw')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ toAddress: '0x' + '3'.repeat(40), amount: -5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('缺少 toAddress：应返回 400', async () => {
      const res = await request(app)
        .post('/api/balance/withdraw')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== GET /api/balance/transactions ====================

  describe('GET /api/balance/transactions', () => {
    it('应返回交易流水（包含充值、提现记录）', async () => {
      const res = await request(app)
        .get('/api/balance/transactions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // 至少包含 1 条充值 + 1 条提现
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // 验证记录类型
      const types = res.body.data.map(tx => tx.type);
      expect(types).toContain('DEPOSIT');
      expect(types).toContain('WITHDRAW');
    });

    it('支持 limit 参数', async () => {
      const res = await request(app)
        .get('/api/balance/transactions?limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('未认证：应返回 401', async () => {
      const res = await request(app).get('/api/balance/transactions');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
