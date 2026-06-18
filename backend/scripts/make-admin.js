/**
 * 将指定钱包地址的用户提升为管理员
 * 用法:
 *   node scripts/make-admin.js <walletAddress>
 *   node scripts/make-admin.js 0xabc123...def789
 *
 * 不传参数则列出所有用户
 *   node scripts/make-admin.js
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://predix:predix_password@localhost:5432/predix_db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const targetAddress = process.argv[2];

  if (!targetAddress) {
    // 无参数：列出所有用户
    const users = await prisma.user.findMany({
      select: { id: true, walletAddress: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (users.length === 0) {
      console.log('📭 数据库中没有任何用户。请先连接钱包注册。');
    } else {
      console.log(`📋 共 ${users.length} 个用户:\n`);
      users.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.walletAddress}  [${u.role}]  ${u.createdAt.toISOString()}`);
      });
      console.log('\n💡 用法: node scripts/make-admin.js <钱包地址>');
    }
    await prisma.$disconnect();
    return;
  }

  const addr = targetAddress.toLowerCase();
  const user = await prisma.user.findUnique({ where: { walletAddress: addr } });

  if (!user) {
    console.log(`❌ 未找到钱包地址为 "${targetAddress}" 的用户。`);
    console.log('   请先在前端连接钱包完成注册。');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (user.role === 'admin') {
    console.log(`✅ ${addr} 已经是管理员，无需操作。`);
    await prisma.$disconnect();
    return;
  }

  await prisma.user.update({
    where: { walletAddress: addr },
    data: { role: 'admin' },
  });

  console.log(`🎉 已将 ${addr} 提升为管理员！`);
  console.log('   请刷新页面或重新连接钱包以使权限生效。');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ 执行失败:', err);
  process.exit(1);
});
