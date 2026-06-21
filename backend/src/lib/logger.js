/**
 * 结构化日志模块（基于 pino）
 * 提供 traceId 贯穿请求生命周期、日志级别、生产环境 JSON 输出
 */
const pino = require('pino');

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = pino({
  level,
  // 生产环境输出 JSON，开发环境可读输出
  transport: process.env.NODE_ENV === 'production'
    ? undefined
    : { target: 'pino/file', options: { destination: 1 } },
  // 基础字段
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'unknown',
  },
  // 时间格式化
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
