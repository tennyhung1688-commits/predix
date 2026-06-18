# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for prisma generate)
RUN npm ci --omit=dev && npm install prisma @prisma/client

# Copy source code and prisma
COPY . .

# Generate Prisma client
# DATABASE_URL is only needed for schema parsing, not a real DB connection
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate

# ---- Production Stage ----
FROM node:22-alpine

# 安装 PostgreSQL 客户端（备份脚本需要 pg_dump）
RUN apk add --no-cache postgresql16-client

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/package.json ./

# 修改文件所有权
RUN chown -R nodejs:nodejs /app

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# 切换到非 root 用户
USER nodejs

# 尝试同步数据库 schema，失败不阻塞启动（数据库表已存在的情况下可继续运行）
CMD (npx prisma db push --accept-data-loss || echo "⚠️  prisma db push failed, starting app anyway...") && node src/index.js
