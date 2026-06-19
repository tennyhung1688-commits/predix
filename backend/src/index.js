const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const logger = require('./lib/logger');
const wsService = require('./services/websocket');
const wsRelay = require('./services/ws-relay');
const walletService = require('./services/wallet');
const { extractUser, requireAdmin } = require('./middleware/auth');
const { globalLimiter } = require('./middleware/rateLimiter');
const csrfProtection = require('./middleware/csrf');
const { sendError, globalErrorHandler } = require('./lib/errors');

const authRoutes = require('./routes/auth');
const marketRoutes = require('./routes/markets');
const tradingRoutes = require('./routes/trading');
const smartmoneyRoutes = require('./routes/smartmoney');
const balanceRoutes = require('./routes/balance');
const adminRoutes = require('./routes/admin');
const settlementRoutes = require('./routes/settlement');
const comboRoutes = require('./routes/combo');
const commentRoutes = require('./routes/comments');

const alertRoutes = require('./routes/alerts');
const priceHistoryRoutes = require('./routes/price-history');
const leaderboardRoutes = require('./routes/leaderboard');
const referralRoutes = require('./routes/referral');

const app = express();

// ---- 安全中间件 ----

// 信任代理（Docker/反向代理环境下需要，需在 Helmet 之前设置）
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Helmet：自动设置安全响应头（CSP, X-Frame-Options, HSTS 等）
app.use(helmet({
  // 生产环境 CSP：允许前端、WebSocket、Polymarket API、图表和图片源
  contentSecurityPolicy: process.env.NODE_ENV === 'production'
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // 管理面板内联脚本
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: [
            "'self'",
            'wss://ws-subscriptions-clob.polymarket.com',
            'https://gamma-api.polymarket.com',
            'https://clob.polymarket.com',
            'https://data-api.polymarket.com',
          ],
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      }
    : false, // 开发环境禁用 CSP 方便调试
  crossOriginEmbedderPolicy: false,
  // 生产环境开启 HSTS（180天）
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: false }
    : false,
}));

// Cookie 解析（CSRF 中间件需要）
app.use(cookieParser());

// CSRF 保护：对所有 /api 路径的写操作验证 token
app.use('/api', csrfProtection);

// ---- 可观测性中间件 ----

// TraceId：贯穿请求生命周期
app.use((req, res, next) => {
  req.traceId = req.headers['x-trace-id'] || uuidv4();
  res.setHeader('X-Trace-Id', req.traceId);
  next();
});

// 结构化 HTTP 日志（pino-http）
app.use(pinoHttp({
  logger,
  // 自定义日志格式
  customProps: (req) => ({ traceId: req.traceId }),
  // 忽略健康检查端点的日志噪音
  autoLogging: {
    ignore: (req) => req.url === '/api/health' || req.url === '/',
  },
}));

// ---- 业务中间件 ----

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' })); // 限制请求体大小，防止大 payload 攻击

// 全局速率限制（所有 API 路由）
app.use('/api', globalLimiter);

// 全局 JWT 解析中间件（为所有路由设置 req.user）
app.use(extractUser);

// 路由
app.use('/api/auth', authRoutes);
app.use('/api', marketRoutes);
app.use('/api', tradingRoutes);
app.use('/api', balanceRoutes);
app.use('/api', adminRoutes);
app.use('/api', smartmoneyRoutes);
app.use('/api', settlementRoutes);
app.use('/api', comboRoutes);
app.use('/api', commentRoutes);

app.use('/api', alertRoutes);
app.use('/api', priceHistoryRoutes);
app.use('/api', leaderboardRoutes);
app.use('/api', referralRoutes);

// ==================== 管理面板 ====================

const path = require('path');

app.get('/api/dashboard/stats', requireAdmin, (req, res) => {
  const os = require('os');
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  res.json({
    status: 'running',
    pid: process.pid,
    uptime: Math.floor(uptime),
    uptimeDisplay: formatUptime(uptime),
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memory: {
      usedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      totalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      percent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    freeMemGB: Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10,
    totalMemGB: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10,
    loadAvg: os.loadavg().map(v => Math.round(v * 100) / 100)
  });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}天`);
  if (h > 0) parts.push(`${h}时`);
  if (m > 0) parts.push(`${m}分`);
  parts.push(`${s}秒`);
  return parts.join(' ');
}

app.get('/', requireAdmin, (req, res) => {
  const htmlPath = path.join(__dirname, 'dashboard.html');
  res.sendFile(htmlPath);
});

// 健康检查
// 始终返回 200，避免 Render 健康检查因 DB 慢响应而判定部署失败
app.get('/api/health', async (_req, res) => {
  const result = { status: 'ok', db: 'unknown', uptime: process.uptime(), timestamp: new Date().toISOString() };
  try {
    const prisma = require('./lib/prisma');
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB query timeout')), 5000))
    ]);
    result.db = 'connected';
  } catch (err) {
    result.db = 'disconnected';
    result.dbError = err.message;
  }
  res.json(result);
});

// 启动后异步预热数据库连接（不阻塞启动）
let dbWarm = false;
(async function warmupDB() {
  try {
    const prisma = require('./lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    dbWarm = true;
    logger.info('✅ 数据库连接已预热');
  } catch (err) {
    logger.warn({ err: err.message }, '⚠️ 数据库预热失败，将重试');
    // 30 秒后重试一次
    setTimeout(async () => {
      try {
        const prisma = require('./lib/prisma');
        await prisma.$queryRaw`SELECT 1`;
        dbWarm = true;
        logger.info('✅ 数据库连接已预热（重试成功）');
      } catch (e) {
        logger.error({ err: e.message }, '❌ 数据库预热再次失败');
      }
    }, 30000);
  }
})();

// WebSocket 实时数据代理端点（给前端轮询降级用）
app.get('/api/realtime/price/:tokenId', async (req, res) => {
  try {
    const { getOrderBook } = require('./services/polymarket');
    const data = await getOrderBook(req.params.tokenId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

// ---- 全局错误处理（必须放在所有路由之后） ----
app.use(globalErrorHandler);

// 创建 HTTP 服务器（以便同时挂载 Express 和 WebSocket）
const server = http.createServer(app);

// ---- 优雅关闭 ----
function gracefulShutdown(signal) {
  logger.info({ signal }, '收到关闭信号，开始优雅关闭...');

  // 30 秒强制超时
  const forceExit = setTimeout(() => {
    logger.error('优雅关闭超时，强制退出');
    process.exit(1);
  }, 30000);

  server.close(async () => {
    clearTimeout(forceExit);
    logger.info('HTTP 服务器已关闭');

    // 关闭 WebSocket 连接
    try {
      wsService.disconnect();
      wsRelay.close();
    } catch (e) { /* ignore */ }

    // 断开 Prisma
    try {
      const prisma = require('./lib/prisma');
      await prisma.$disconnect();
    } catch (e) { /* ignore */ }

    logger.info('所有连接已关闭，进程退出');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 启动服务器（测试环境下跳过自动启动）
if (process.env.NODE_ENV !== 'test') {
  server.listen(config.port, () => {
    logger.info({ port: config.port, nodeEnv: process.env.NODE_ENV || 'development' }, '🚀 Backend started');

    // 异步初始化，失败不阻塞服务
    (async () => {
      try {
        // 初始化平台钱包
        await walletService.init();

        // 连接 Polymarket WebSocket
        wsService.connect();

        // 启动 WebSocket 中继（前端 <-> 后端 <-> Polymarket）
        wsRelay.attach(server);

        // 启动自动结算定时检测（每 5 分钟）
        const settlementService = require('./services/settlement');
        const AUTO_SETTLE_INTERVAL = parseInt(process.env.AUTO_SETTLE_INTERVAL) || 5 * 60 * 1000;

        if (process.env.DISABLE_AUTO_SETTLE !== 'true') {
          logger.info({ intervalSec: AUTO_SETTLE_INTERVAL / 1000 }, '🔄 自动结算检测已启动');
          setInterval(async () => {
            try {
              await settlementService.autoCheckAndSettle();
            } catch (err) {
              logger.error({ err: err.message }, '[定时结算] 执行失败');
            }
          }, AUTO_SETTLE_INTERVAL);

          setTimeout(async () => {
            try {
              await settlementService.autoCheckAndSettle();
            } catch (err) {
              logger.error({ err: err.message }, '[定时结算-启动] 执行失败');
            }
          }, 10000);
        }
      } catch (err) {
        logger.error({ err: err.message }, '⚠️ 后台服务初始化失败（HTTP 服务不受影响）');
      }
    })();
  });
}

module.exports = { app, server };
