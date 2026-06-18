# PrediX — 预测市场，智者先行

中文预测市场交易平台，整合游戏化激励体系与聪明钱追踪，聚焦华人预测交易社区。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 16 + React 19 + TypeScript |
| 后端 | Express 5 + Node.js |
| 数据库 | PostgreSQL 16 + Prisma ORM |
| 实时通信 | WebSocket (ws) |
| 容器化 | Docker + Docker Compose |

## 快速开始

### 1. 克隆项目

```bash
git clone <repo-url>
cd predix
```

### 2. 配置环境变量

```bash
# 后端（参考模板填写真实值）
cp backend/.env.example backend/.env

# 前端（开发环境一般无需修改）
cp frontend/.env.local.example frontend/.env.local
```

**必须配置的变量**（`backend/.env`）：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接地址 |
| `JWT_SECRET` | JWT 签名密钥（`openssl rand -hex 64`） |
| `PLATFORM_WALLET_ADDRESS` | 平台钱包地址 |
| `PLATFORM_WALLET_PRIVATE_KEY` | 平台钱包私钥 |
| `PLATFORM_POLY_API_KEY` | Polymarket API Key |
| `PLATFORM_POLY_API_SECRET` | Polymarket API Secret |
| `PLATFORM_POLY_PASSPHRASE` | Polymarket API Passphrase |

### 3. 本地开发

```bash
# 安装依赖
make install

# 初始化数据库
make db-setup

# 启动开发服务器（前后端并行）
make dev
```

- 前端：`http://localhost:3000`
- 后端：`http://localhost:3001/api`
- Prisma Studio：`make db-studio`

### 4. Docker 部署

```bash
# 构建镜像
make docker-build

# 启动服务
make docker-up

# 查看日志
make docker-logs

# 停止服务
make docker-down
```

Docker Compose 会启动 4 个服务：

| 服务 | 端口 | 说明 |
|------|------|------|
| `postgres` | 内部 | PostgreSQL 16 数据库 |
| `backend` | 3001 | API 服务 |
| `frontend` | 3000 | Next.js 前端 |
| `backup` | - | 每天 UTC 3:00 自动备份数据库 |

## 项目结构

```
├── frontend/                # Next.js 前端
│   └── src/
│       ├── app/             # 页面路由（App Router）
│       │   ├── admin/       # 管理后台
│       │   ├── auth/        # 登录/注册
│       │   ├── balance/     # 充提管理
│       │   ├── dashboard/   # 个人仪表盘
│       │   ├── leaderboard/ # 排行榜
│       │   ├── market/      # 市场详情（动态路由）
│       │   ├── orders/      # 订单管理
│       │   ├── positions/   # 持仓管理
│       │   ├── referral/    # 推荐奖励
│       │   ├── world-cup/   # 世界杯专题
│       │   └── how-to-play/ # 玩法说明
│       ├── components/      # 共享组件
│       ├── lib/             # 工具库/API 客户端
│       └── i18n/            # 国际化翻译
│
├── backend/                 # Express 后端
│   ├── src/
│   │   ├── routes/          # API 路由
│   │   ├── middleware/      # 中间件（认证、限流等）
│   │   ├── services/        # 业务逻辑
│   │   └── scripts/         # 脚本（备份等）
│   ├── prisma/
│   │   └── schema.prisma    # 数据模型定义
│   └── tests/               # API 集成测试
│
├── docker-compose.yml       # Docker 编排
├── Makefile                 # 开发命令
└── PRODUCT.md               # 产品定义文档
```

## Makefile 命令

| 命令 | 说明 |
|------|------|
| `make dev` | 启动前后端开发服务器 |
| `make install` | 安装所有依赖 |
| `make db-setup` | 初始化数据库 |
| `make db-reset` | 重置数据库（⚠️ 清空所有数据） |
| `make db-migrate-dev name=xxx` | 创建数据库迁移 |
| `make db-studio` | 启动 Prisma Studio |
| `make docker-build` | 构建 Docker 镜像 |
| `make docker-up` | 启动 Docker 容器 |
| `make docker-down` | 停止 Docker 容器 |
| `make docker-logs` | 查看容器日志 |
| `make docker-clean` | 清理镜像和卷 |
| `make clean` | 清理 node_modules 和构建产物 |

## 测试

```bash
# 后端 API 测试
cd backend && npm test

# 监听模式
cd backend && npm run test:watch
```

测试覆盖：认证、余额充值/提现、交易下单/撤单。

## 安全

- `.env` 文件已在 `.gitignore` 中排除，不会被提交
- 生产环境请通过 Docker secrets 或环境变量注入密钥，**不要**在镜像中硬编码
- 如密钥泄露，请立即在 Polymarket 后台轮换所有 API 凭证
- 后端已配置 Helmet CSP、CORS、Rate Limiting、JWT 认证
- Docker 镜像以非 root 用户运行
- 数据库每天自动备份（保留 30 天或最多 50 份）

## 许可证

[MIT](LICENSE)
