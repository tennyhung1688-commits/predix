/**
 * setupFiles — 在测试框架初始化前运行
 *
 * - 设置 NODE_ENV=test（防止 index.js 自动启动服务器）
 * - 设置测试数据库连接
 * - 全局 mock（walletService 模拟 demo 模式）
 */
const path = require('path');

// 加载测试环境变量（在 app 被 require 之前）
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://predix:predix_password@localhost:5432/predix_test';
process.env.JWT_SECRET = 'test-jwt-secret-9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d';

// Mock 钱包服务：强制 Demo 模式（避免真实 Polymarket API 调用）
jest.mock('../src/services/wallet', () => ({
  isConfigured: jest.fn(() => false), // 返回 false → 触发 demo 模式
  init: jest.fn().mockResolvedValue(),
  createOrder: jest.fn().mockResolvedValue({ orderID: 'mock-order-123' }),
  createMarketOrder: jest.fn().mockResolvedValue({ orderID: 'mock-market-order-456' }),
  cancelOrder: jest.fn().mockResolvedValue({}),
  getBalance: jest.fn().mockResolvedValue({ balance: '10000.00' }),
  signOrder: jest.fn().mockResolvedValue('0xmocksignature'),
}));

// Mock WebSocket 服务（测试环境不需要 WebSocket 连接）
jest.mock('../src/services/websocket', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  getMarketData: jest.fn(() => new Map()),
}));

jest.mock('../src/services/ws-relay', () => ({
  attach: jest.fn(),
  close: jest.fn(),
}));

// Mock uuid（ESM only 包，CJS 环境下需要 mock）
jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-0000-0000-000000000000'),
}));
