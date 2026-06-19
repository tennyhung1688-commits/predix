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

# 运行 Prisma 数据库迁移（带重试机制：最多 3 次，间隔 10 秒）
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "🔄 运行数据库迁移 (prisma db push) — 尝试 $((RETRY_COUNT + 1))/$MAX_RETRIES..."
  npx prisma db push --accept-data-loss
  PUSH_EXIT=$?

  if [ $PUSH_EXIT -eq 0 ]; then
    echo "✅ 数据库迁移完成"
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "⚠️ 数据库迁移失败 (exit=$PUSH_EXIT)，10 秒后重试..."
    sleep 10
  else
    echo "❌ 数据库迁移失败，已重试 $MAX_RETRIES 次"
    echo "   继续启动服务（健康检查会报告 DB 状态）"
    # 不退出，让服务启动，健康检查会反映 DB 状态
  fi
done

# 启动服务
echo "✅ 启动服务..."
exec node src/index.js"
