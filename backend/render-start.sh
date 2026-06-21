#!/usr/bin/env bash
set -e

echo "=== PrediX Backend Render Start ==="

# Prisma 数据库同步
echo "[1/2] Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

# 启动 Express 服务
echo "[2/2] Starting Express server on port ${PORT:-10000}..."
exec node src/index.js
