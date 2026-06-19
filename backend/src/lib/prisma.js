const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// 解析 DATABASE_URL，拆成单独参数传入 Pool
// 这样 family: 4 才能正确生效（connectionString 模式下 family 会被忽略）
const dbUrl = new URL(process.env.DATABASE_URL);

console.log(`🗄️  数据库连接目标: ${dbUrl.hostname}:${dbUrl.port}`);

const pool = new Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port) || 5432,
  database: dbUrl.pathname.slice(1), // 去掉开头的 /
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  family: 4, // 强制 IPv4，Render 免费实例不支持 IPv6 出站
  ssl: dbUrl.searchParams.get('sslmode') !== 'disable'
    ? { rejectUnauthorized: false }
    : false,
  // 连接池配置 — 使用 PgBouncer（Supabase Session Pooler）时减小连接数
  max: 3,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('❌ 数据库连接池异常:', err.message);
});

pool.on('connect', () => {
  console.log('✅ 数据库连接池新连接已建立');
});

// 启动时自检：尝试查询看 DB 是否可达
pool.query('SELECT 1')
  .then(() => console.log('✅ 数据库连接验证成功'))
  .catch((err) => console.error('❌ 数据库初始连接失败:', err.message));

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

module.exports = prisma;
