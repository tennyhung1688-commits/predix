#!/bin/bash
# ============================================================
# Render 启动脚本
# 自动运行数据库迁移，然后启动服务
# ============================================================

echo "🚀 PrediX Backend 启动中..."
echo "📦 Node 版本: $(node --version)"
echo "📦 NPM 版本: $(npm --version)"
echo "📊 DATABASE_URL: ${DATABASE_URL:0:30}..."

# 生成 Prisma Client（确保是最新的）
echo "🔧 生成 Prisma Client..."
npx prisma generate || { echo "❌ Prisma Client 生成失败"; exit 1; }

# 运行 Prisma 数据库迁移（如果失败不阻塞启动）
echo "🔄 运行数据库迁移..."
npx prisma db push --accept-data-loss 2>&1 || echo "⚠️  数据库迁移跳过（可能数据库还未就绪）"

# 启动服务
echo "✅ 启动服务..."
exec node src/index.js
