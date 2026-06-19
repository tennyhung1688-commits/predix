#!/bin/bash
# ============================================================
# Render 启动脚本
# 自动运行数据库迁移，然后启动服务
# ============================================================

set -e  # 任何命令失败立即退出

echo "🚀 PrediX Backend 启动中..."
echo "📦 Node 版本: $(node --version)"
echo "📦 NPM 版本: $(npm --version)"
echo "📊 DATABASE_URL: ${DATABASE_URL:0:40}..."

# 生成 Prisma Client（确保是最新的）
echo "🔧 生成 Prisma Client..."
npx prisma generate || { echo "❌ Prisma Client 生成失败"; exit 1; }

# 运行 Prisma 数据库迁移
echo "🔄 运行数据库迁移 (prisma db push)..."
npx prisma db push --accept-data-loss 2>&1 || {
  echo "❌ 数据库迁移失败，这通常意味着数据库无法连接"
  echo "   请检查 Supabase 数据库是否在线、DATABASE_URL 是否正确"
  exit 1
}
echo "✅ 数据库迁移完成"

# 测试数据库连接
echo "🔍 测试数据库连接..."
node -e "
const { Pool } = require('pg');
const dbUrl = new URL(process.env.DATABASE_URL);
const pool = new Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 5432,
  database: dbUrl.pathname.slice(1),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  family: 4,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
pool.query('SELECT 1', (err, result) => {
  if (err) {
    console.error('❌ 数据库连接测试失败:', err.message);
    pool.end();
    process.exit(1);
  }
  console.log('✅ 数据库连接测试成功');
  pool.end();
  process.exit(0);
});
" 2>&1 || { echo "❌ 数据库连接不可用，退出"; exit 1; }

# 启动服务
echo "✅ 启动服务..."
exec node src/index.js
