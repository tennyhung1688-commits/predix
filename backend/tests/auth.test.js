/**
 * 认证流程测试
 *
 * 覆盖：
 * - POST /api/auth/login    注册/登录
 * - GET  /api/auth/me       获取当前用户信息
 * - 异常场景：缺失参数、无效 token、无 token
 */
const request = require('supertest');
const { app } = require('../src/index');

const TEST_WALLET = '0x1234567890abcdef1234567890abcdef12345678';

describe('Auth API', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    await global.__cleanDatabase__();
  });

  afterAll(async () => {
    await global.__cleanDatabase__();
  });

  // ==================== POST /api/auth/login ====================

  describe('POST /api/auth/login', () => {
    it('新用户注册：应返回 token 和用户数据', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: TEST_WALLET });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.token).toMatch(/^eyJ/); // JWT 格式
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.walletAddress).toBe(TEST_WALLET);
      expect(res.body.data.user.balance).toBe(0);
      expect(res.body.data.user.lockedBalance).toBe(0);
      expect(res.body.data.user.createdAt).toBeDefined();

      // 保存 token 和 userId 供后续测试使用
      authToken = res.body.data.token;
      userId = res.body.data.user.id;
    });

    it('已有用户登录：应返回相同用户信息', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: TEST_WALLET });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // 应返回相同用户
      expect(res.body.data.user.id).toBe(userId);
      expect(res.body.data.user.walletAddress).toBe(TEST_WALLET);
    });

    it('缺少 walletAddress：应返回 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('空字符串 walletAddress：应返回 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ walletAddress: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== GET /api/auth/me ====================

  describe('GET /api/auth/me', () => {
    it('使用有效 token：应返回当前用户信息', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.walletAddress).toBe(TEST_WALLET);
      expect(res.body.data.balance).toBeDefined();
      expect(res.body.data.lockedBalance).toBeDefined();
      expect(res.body.data.available).toBeDefined();
      // available = balance - lockedBalance
      expect(res.body.data.available).toBe(
        res.body.data.balance - res.body.data.lockedBalance
      );
    });

    it('无 token：应返回 401', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('无效 token：应返回 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('篡改的 token：应返回 401', async () => {
      // 截取有效 token 前半部分 + 随机填充
      const tampered = authToken.slice(0, 30) + 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tampered}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
