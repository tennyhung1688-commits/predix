/**
 * 生成 Polymarket CLOB API 凭证 (secret + passphrase)
 *
 * 用法: node scripts/generate-api-creds.js
 *
 * 使用 @polymarket/clob-client-v2 SDK 内置的 createOrDeriveApiKey 方法
 */
const path = require('path');

// 加载 .env
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;

if (!privateKey) {
  console.error('❌ 请在 backend/.env 中设置 PLATFORM_WALLET_PRIVATE_KEY');
  process.exit(1);
}

async function main() {
  const { createWalletClient, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { polygon } = await import('viem/chains');
  const { ClobClient } = await import('@polymarket/clob-client-v2');

  const rawKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(rawKey);
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(),
  });

  console.log(`🔑 钱包地址: ${account.address}`);

  const client = new ClobClient({
    host: 'https://clob.polymarket.com',
    chain: 137,
    signer: walletClient,
  });

  console.log(`📡 正在通过 SDK createOrDeriveApiKey() 获取凭证...\n`);

  try {
    const creds = await client.createOrDeriveApiKey();

    if (!creds || !creds.key) {
      console.error('❌ SDK 返回的凭证为空');
      process.exit(1);
    }

    console.log('✅ 凭证获取成功！请将以下值填入 backend/.env：\n');
    console.log('='.repeat(72));
    console.log(`PLATFORM_POLY_API_KEY=${creds.key}`);
    console.log(`PLATFORM_POLY_API_SECRET=${creds.secret}`);
    console.log(`PLATFORM_POLY_PASSPHRASE=${creds.passphrase}`);
    console.log('='.repeat(72));
    console.log('\n⚠️  secret 和 passphrase 只生成一次，请立即保存。');
  } catch (err) {
    console.error('❌ SDK 调用失败:', err.message || err);
    if (err.response) {
      console.error('   HTTP 状态:', err.response.status);
      console.error('   响应内容:', err.response.data);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ 脚本执行失败:', err);
  process.exit(1);
});
