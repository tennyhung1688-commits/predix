# PrediX 部署指南

## 方案对比

| 方案 | 前端 | 后端 | 数据库 | 域名 | 费用 |
|------|------|------|--------|------|------|
| **🌩️ 免费方案** | Vercel | Render | Supabase | DNSBEE 二级域名 | ¥0 |
| **🖥️ 自建服务器** | VPS + Docker | VPS + Docker | Docker 容器 | 自有域名 | 约 ¥50/月 |

---

# 🌩️ 免费方案部署步骤

## 📋 前置条件

- GitHub 仓库（存放代码）
- DNSBEE 域名 `predix.apay.eu.cc`（已申请）
- Supabase 数据库（已配置）
- Render 账号（需绑信用卡验证，不扣费）
- Vercel 账号（用 GitHub 登录）

---

## 🚀 第 1 步：推送代码到 GitHub

```bash
cd /Users/jrhung/CodeBuddy/20260616014326
git init
git add .
git commit -m "init: predix"
git remote add origin https://github.com/你的用户名/predix.git
git push -u origin main
```

---

## 🚀 第 2 步：部署后端到 Render

### 2.1 创建 Render 账号并绑卡

1. 打开 [render.com](https://render.com) → 用 GitHub 登录
2. **必须绑信用卡**（免费计划需要验证身份，不开服务就不扣钱）

### 2.2 一键部署

1. Render Dashboard → **Blueprints** → **New Blueprint Instance**
2. 选择你的 `predix` 仓库 → 系统自动识别 `render.yaml`
3. 点击 **Apply**

### 2.3 配置环境变量

在 Render Dashboard → predix-backend → Environment 中填入以下变量：

```
# 数据库（从 backend/.env 复制）
DATABASE_URL = postgresql://postgres:你的密码@db.xxxxx.supabase.co:5432/postgres?sslmode=no-verify

# JWT 密钥（从 backend/.env 复制）
JWT_SECRET = 你现有的JWT密钥

# CORS（前端域名）
CORS_ORIGIN = https://predix.apay.eu.cc

# 平台钱包（从 backend/.env 复制）
PLATFORM_WALLET_ADDRESS = 0x...
PLATFORM_WALLET_PRIVATE_KEY = 0x...

# Polymarket API（从 backend/.env 复制）
PLATFORM_POLY_API_KEY = ...
PLATFORM_POLY_API_SECRET = ...
PLATFORM_POLY_PASSPHRASE = ...
```

### 2.4 等待部署完成

部署完成后你会得到后端地址：`https://predix-backend.onrender.com`

验证：`curl https://predix-backend.onrender.com/api/health`

> ⚠️ Render 免费计划 15 分钟无请求会自动休眠，唤醒需 30 秒。可用 [cron-job.org](https://cron-job.org) 每 10 分钟 ping 一次保持唤醒。

---

## 🚀 第 3 步：部署前端到 Vercel

### 3.1 导入项目

1. 打开 [vercel.com](https://vercel.com) → 用 GitHub 登录
2. **New Project** → 选择 `predix` 仓库
3. **Root Directory** 设为 `frontend`
4. 框架自动识别为 Next.js

### 3.2 设置环境变量

在 **Environment Variables** 中添加：

```
NEXT_PUBLIC_API_URL = https://predix-backend.onrender.com/api
```

### 3.3 绑定域名

部署完成后：
1. 项目设置 → **Domains** → 添加 `predix.apay.eu.cc`
2. Vercel 会提示在 DNSBEE 添加一条 CNAME 记录：

```
类型: CNAME
名称: predix
值:   cname.vercel-dns.com
```

然后去 [DNSBEE](https://dns.qiip.cc) 后台添加这条记录。

---

## 🚀 第 4 步：URL 规划

部署完成后的最终架构：

```
predix.apay.eu.cc        → Vercel（前端 Next.js）
predix-backend.onrender.com → Render（后端 Express）
                             ↑ 该地址仅供前端调用，用户不直接访问
```

---

# 🖥️ 自建服务器部署（传统方案）

## 📋 前置条件

- 一台带公网 IP 的 Linux 服务器（推荐 Ubuntu 22.04 / CentOS 8+）
- 域名已 DNS 解析到服务器 IP
- 服务器已安装：Docker + Docker Compose
- 防火墙开放 80 (HTTP) 和 443 (HTTPS) 端口

---

## 🚀 部署步骤

### 1. 克隆项目 & 配置环境变量

```bash
cd /opt/predix

# 复制环境变量模板
cp backend/.env.example backend/.env

# 编辑 .env，填入真实的数据库密码、JWT 密钥、钱包私钥等
vim backend/.env
```

**必填变量：**

| 变量 | 说明 |
|------|------|
| `POSTGRES_PASSWORD` | 数据库密码 |
| `JWT_SECRET` | JWT 签名密钥（`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` 生成） |
| `PLATFORM_WALLET_ADDRESS` | Polymarket 代理钱包地址 |
| `PLATFORM_WALLET_PRIVATE_KEY` | 钱包私钥 |
| `CORS_ORIGIN` | 生产域名，如 `https://你的域名.com` |

### 2. 配置 Nginx 域名

```bash
# 替换 nginx/nginx.conf 中的「你的域名.com」为实际域名
sed -i 's/你的域名.com/example.com/g' nginx/nginx.conf
```

### 3. 申请 SSL 证书

```bash
# 必须先替换域名后再执行
./nginx/init-letsencrypt.sh 你的域名.com 你的邮箱@example.com
```

### 4. 构建并启动

```bash
# 生产环境启动（包含 Nginx + HTTPS）
docker compose -f docker-compose.prod.yml up -d --build
```

### 5. 验证

```bash
# 检查所有容器状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f

# 测试 API
curl https://你的域名.com/api/health
```

---

## 🔧 数据库方案

### 方案 A：Docker 内置 PostgreSQL（默认）

项目自带 PostgreSQL 容器，适用于小规模部署。数据库数据存储在 Docker Volume 中。

### 方案 B：云数据库（推荐生产环境）

如果使用外部数据库（Supabase / CloudBase / AWS RDS 等）：

1. 在 `backend/.env` 中设置 `DATABASE_URL` 指向云数据库
2. 在 `docker-compose.prod.yml` 中：
   - 注释掉 `postgres` 服务
   - 取消 `DATABASE_URL=${DATABASE_URL}` 注释
   - 注释掉 `DATABASE_URL=postgresql://...` 行
   - 移除 `backend` 服务对 `postgres` 的 `depends_on`

---

## 📁 项目文件说明

| 文件 | 用途 |
|------|------|
| `docker-compose.yml` | 本地开发环境（仅容器，无 HTTPS） |
| `docker-compose.prod.yml` | 生产环境（Nginx + HTTPS + 自动续期） |
| `nginx/nginx.conf` | Nginx 反向代理配置 |
| `nginx/init-letsencrypt.sh` | SSL 证书申请脚本 |
| `backend/.env.example` | 环境变量模板 |
| `backend/Dockerfile` | 后端镜像（prisma db push 自动建表） |
| `Makefile` | 常用命令快捷方式 |

---

## 🔄 更新部署

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📊 监控 & 维护

```bash
# 查看各容器状态
docker compose -f docker-compose.prod.yml ps

# 实时日志
docker compose -f docker-compose.prod.yml logs -f backend

# 数据库备份（每天凌晨 3 点自动执行，存储于 backend-backups 卷）
# 如需手动备份：
docker exec predix-postgres pg_dump -U predix predix_db > backup.sql

# SSL 证书自动续期（certbot 容器每 12 小时检查一次）
```

---

## ⚠️ 安全提醒

- `.env` 文件包含私钥和密码，**切勿提交到 Git**
- 生产环境务必更换所有默认密钥和密码
- 建议配置防火墙只开放 80/443 端口
- `PREDIX_VS_POLYMARKET.html` 为项目对比文档，不涉及敏感信息
