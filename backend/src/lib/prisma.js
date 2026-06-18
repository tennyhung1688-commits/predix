const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// 强制使用 IPv4，Render 不支持 IPv6 出站
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  family: 4, // 仅 IPv4
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
