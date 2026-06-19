#!/bin/bash
# ============================================================
# Render 启动脚本
# 自动运行数据库迁移，然后启动服务
# ============================================================

echo "🚀 PrediX Backend 启动中..."
echo "📦 Node 版本: $(node --version)"
echo "📦 NPM 版本: $(npm --version)"
echo "📊 DATABASE_URL: ${DATABASE_URL:0:40}..."

# 生成 Prisma Client（确保是最新的）
echo "🔧 生成 Prisma Client..."
npx prisma generate || { echo "❌ Prisma Client 生成失败"; exit 1; }

# 运行 Prisma 数据库迁移（db push 失败则退出）
echo "🔄 运行数据库迁移 (prisma db push)..."
npx prisma db push --accept-data-loss
PUSH_EXIT=$?
if [ $PUSH_EXIT -ne 0 ]; then
  echo "❌ 数据库迁移失败 (exit=$PUSH_EXIT)，数据库可能无法连接"
  echo "   DATABASE_URL: ${DATABASE_URL:0:50}..."
  exit 1
fi
echo "✅ 数据库迁移完成"

# 启动服务
echo "✅ 启动服务..."
exec node src/index.js
