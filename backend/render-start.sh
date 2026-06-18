#!/bin/bash
# ============================================================
# Render 启动脚本
# 自动运行数据库迁移，然后启动服务
# ============================================================
set -e

echo "🚀 PrediX Backend 启动中..."
echo "📦 Node 版本: $(node --version)"
echo "📦 NPM 版本: $(npm --version)"

# 运行 Prisma 数据库迁移（如果失败不阻塞启动）
echo "🔄 运行数据库迁移..."
npx prisma db push --accept-data-loss 2>/dev/null || echo "⚠️  数据库迁移跳过（可能数据库还未就绪）"

# 生成 Prisma Client（确保是最新的）
echo "🔧 生成 Prisma Client..."
npx prisma generate

# 启动服务
echo "✅ 启动服务..."
exec node src/index.js
