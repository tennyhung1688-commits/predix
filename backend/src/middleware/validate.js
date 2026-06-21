/**
 * 输入校验中间件（基于 express-validator）
 * 为关键接口提供白名单式参数校验，防止注入和非法输入
 */
const { body, query, param, validationResult } = require('express-validator');

// 统一校验结果处理
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: '参数校验失败',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// --- 认证相关校验 ---

const loginRules = [
  body('walletAddress')
    .isString().withMessage('钱包地址必须是字符串')
    .trim()
    .isLength({ min: 42, max: 42 }).withMessage('钱包地址格式不正确（应为 42 位十六进制地址）')
    .matches(/^0x[a-fA-F0-9]{40}$/).withMessage('钱包地址格式不正确'),
];

const emailLoginRules = [
  body('email')
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
  body('password')
    .isString().withMessage('密码必须是字符串')
    .isLength({ min: 6, max: 128 }).withMessage('密码长度必须在 6~128 之间'),
];

const registerRules = [
  body('email')
    .isEmail().withMessage('邮箱格式不正确')
    .normalizeEmail(),
  body('password')
    .isString().withMessage('密码必须是字符串')
    .isLength({ min: 6, max: 128 }).withMessage('密码长度必须在 6~128 之间'),
  body('username')
    .optional()
    .isString().withMessage('用户名必须是字符串')
    .trim()
    .isLength({ min: 1, max: 30 }).withMessage('用户名长度必须在 1~30 之间'),
];

// --- 余额相关校验 ---

const depositRules = [
  body('txHash')
    .isString().withMessage('交易哈希必须是字符串')
    .trim()
    .isLength({ min: 66, max: 66 }).withMessage('交易哈希格式不正确')
    .matches(/^0x[a-fA-F0-9]{64}$/).withMessage('交易哈希格式不正确'),
  body('amount')
    .isFloat({ gt: 0 }).withMessage('充值金额必须大于 0')
    .custom((val) => parseFloat(val) <= 1000000).withMessage('单次充值金额不能超过 1,000,000 USDC'),
];

const withdrawRules = [
  body('toAddress')
    .isString().withMessage('提现地址必须是字符串')
    .trim()
    .isLength({ min: 42, max: 42 }).withMessage('提现地址格式不正确（应为 42 位十六进制地址）')
    .matches(/^0x[a-fA-F0-9]{40}$/).withMessage('提现地址格式不正确'),
  body('amount')
    .isFloat({ gt: 0 }).withMessage('提现金额必须大于 0')
    .custom((val) => {
      const minWithdraw = parseFloat(process.env.MIN_WITHDRAW_AMOUNT) || 10;
      if (parseFloat(val) < minWithdraw) {
        throw new Error(`提现金额不能低于 ${minWithdraw} USDC`);
      }
      return true;
    }),
];

// --- 交易相关校验 ---

const orderRules = [
  body('tokenId')
    .isString().withMessage('tokenId 必须是字符串')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('tokenId 长度不正确')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('tokenId 格式不正确'),
  body('side')
    .isIn(['BUY', 'SELL']).withMessage('side 必须是 BUY 或 SELL'),
  body('size')
    .optional()
    .isFloat({ gt: 0 }).withMessage('size 必须大于 0')
    .custom((val) => parseFloat(val) <= 100000).withMessage('size 不能超过 100,000'),
  body('price')
    .optional()
    .isFloat({ gt: 0, lt: 1 }).withMessage('price 必须在 0~1 之间'),
  body('amount')
    .optional()
    .isFloat({ gt: 0 }).withMessage('amount 必须大于 0')
    .custom((val) => parseFloat(val) <= 100000).withMessage('amount 不能超过 100,000'),
  body('orderType')
    .optional()
    .isString().withMessage('orderType 必须是字符串'),
];

// --- 管理相关校验 ---

const withdrawProcessRules = [
  param('id')
    .isString().withMessage('提现 ID 格式不正确'),
  body('action')
    .isIn(['complete', 'reject']).withMessage('action 必须是 complete 或 reject'),
  body('txHash')
    .optional()
    .isString().withMessage('交易哈希格式不正确'),
];

// --- 评论相关校验 ---

const commentRules = [
  body('marketId')
    .isString().withMessage('marketId 必须是字符串')
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('marketId 长度不正确'),
  body('content')
    .isString().withMessage('content 必须是字符串')
    .trim()
    .isLength({ min: 1, max: 2000 }).withMessage('评论内容长度必须在 1~2000 字之间'),
  body('parentId')
    .optional()
    .isString().withMessage('parentId 必须是字符串'),
];

module.exports = {
  handleValidation,
  loginRules,
  emailLoginRules,
  registerRules,
  depositRules,
  withdrawRules,
  orderRules,
  withdrawProcessRules,
  commentRules,
};
