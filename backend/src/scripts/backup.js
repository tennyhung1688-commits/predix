/**
 * 数据库自动备份脚本（PostgreSQL）
 * 用法：
 *   - Docker cron 定时调用：node src/scripts/backup.js
 *   - 手动备份：node src/scripts/backup.js --manual
 *
 * 使用 pg_dump 导出数据库，然后压缩为 .zip 归档
 * 自动清理超过 RETENTION_DAYS 天的旧备份
 * 保留最近 MAX_BACKUPS 个备份（即使未过期）
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
const MAX_BACKUPS = parseInt(process.env.BACKUP_MAX_COUNT) || 50;

// 从 DATABASE_URL 解析连接参数
function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname || 'localhost',
    port: u.port || '5432',
    database: u.pathname.replace('/', '') || 'predix_db',
    user: u.username || 'predix',
    password: u.password || '',
  };
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [BACKUP] ${msg}`);
}

async function createBackup() {
  // 确保备份目录存在
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log('❌ DATABASE_URL 环境变量未设置');
    process.exit(1);
  }

  const db = parseDbUrl(dbUrl);
  const timestamp = formatTimestamp(new Date());
  const backupName = `backup_${timestamp}.zip`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  const sqlDumpPath = path.join(BACKUP_DIR, `dump_${timestamp}.sql`);

  try {
    // 1. 使用 pg_dump 导出数据库
    log(`正在导出数据库 ${db.database}@${db.host}:${db.port} ...`);
    const env = { ...process.env, PGPASSWORD: db.password };
    execSync(
      `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -F p --no-owner --no-acl > "${sqlDumpPath}"`,
      { env, stdio: 'pipe', timeout: 60000 }
    );
    log('数据库导出完成');

    // 2. 创建压缩归档
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        log(`✅ 备份完成: ${backupName} (${sizeMB} MB)`);
        resolve();
      });

      archive.on('error', reject);
      archive.pipe(output);
      archive.file(sqlDumpPath, { name: path.basename(sqlDumpPath) });
      archive.finalize();
    });

    // 3. 清理临时 SQL 文件
    fs.unlinkSync(sqlDumpPath);

  } catch (err) {
    log(`❌ 备份失败: ${err.message}`);
    // 清理可能产生的临时文件
    if (fs.existsSync(sqlDumpPath)) fs.unlinkSync(sqlDumpPath);
    process.exit(1);
  }

  // 4. 清理旧备份
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.zip'))
      .sort()
      .reverse(); // 从新到旧

    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    files.forEach((file, index) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      const shouldDelete =
        index >= MAX_BACKUPS || // 超过最大数量
        now - stat.mtimeMs > retentionMs; // 超过保留天数

      if (shouldDelete) {
        fs.unlinkSync(filePath);
        log(`🗑️  清理旧备份: ${file}`);
      }
    });

    const remaining = files.filter((f) => fs.existsSync(path.join(BACKUP_DIR, f))).length;
    log(`当前保留 ${remaining} 个备份`);
  } catch (cleanErr) {
    log(`⚠️  清理旧备份失败: ${cleanErr.message}`);
  }
}

createBackup().catch((err) => {
  log(`❌ 未预期的错误: ${err.message}`);
  process.exit(1);
});
