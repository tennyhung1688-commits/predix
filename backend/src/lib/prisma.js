const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// 解析 DATABASE_URL，拆成单独参数传入 Pool
// 这样 family: 4 才能正确生效（connectionString 模式下 family 会被忽略）
const dbUrl = new URL(process.env.DATABASE_URL);

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
  // 连接池配置
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('❌ 数据库连接池异常:', err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
