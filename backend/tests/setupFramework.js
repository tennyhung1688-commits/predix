/**
 * setupFilesAfterFramework — 测试框架初始化后运行（可使用 Jest 全局）
 *
 * - 创建测试专用 Prisma 实例
 * - 提供数据库清理辅助函数
 * - 测试结束后断开 Prisma 连接
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// 创建测试专用 Prisma 实例
const testPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

global.__TEST_PRISMA__ = testPrisma;

// 辅助函数：清理所有测试数据（按依赖顺序）
async function cleanDatabase() {
  const tx = [];
  for (const table of [
    'PlatformRevenue',
    'Transaction',
    'Trade',
    'Position',
    'Settlement',
    'ComboLeg',
    'ComboBet',
    'Withdraw',
    'Deposit',
    'CommentReport',
    'CommentLike',
    'Comment',
    'PriceAlert',
    'MarketResolution',
    'ReferralEarning',
    'User',
  ]) {
    tx.push(testPrisma[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany());
  }
  await testPrisma.$transaction(tx);
}

global.__cleanDatabase__ = cleanDatabase;

// 测试结束后断开 Prisma 连接
afterAll(async () => {
  await testPrisma.$disconnect();
});
