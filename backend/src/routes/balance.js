const express = require('express');
const balanceService = require('../services/balance');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { withdrawLimiter } = require('../middleware/rateLimiter');
const { depositRules, withdrawRules, handleValidation } = require('../middleware/validate');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const { sendError } = require('../lib/errors');

const router = express.Router();

// 获取余额
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const balance = await balanceService.getBalance(req.user.walletAddress);
    res.json({ success: true, data: balance });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取充值信息（平台钱包地址 + 新用户奖励）
router.get('/balance/deposit-info', requireAuth, async (req, res) => {
  try {
    const user = await balanceService.getOrCreateUser(req.user.walletAddress);
    res.json({
      success: true,
      data: {
        platformAddress: config.platform.depositAddress,
        newUserBonus: config.platform.newUserBonus,
        note: `转账 USDC (Polygon) 到平台地址，到账后联系客服确认。首次注册赠送 ${config.platform.newUserBonus} USDC。`,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 充值 — 校验 + 审计
router.post('/balance/deposit', requireAuth,
  depositRules,
  handleValidation,
  auditMiddleware(AUDIT_EVENTS.DEPOSIT, (req) => ({
    txHash: req.body.txHash,
    amount: parseFloat(req.body.amount),
  })),
  async (req, res) => {
  try {
    const { txHash, amount } = req.body;

    if (!txHash || !amount) {
      return res.status(400).json({ success: false, error: '缺少 txHash 或 amount' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: '充值金额必须大于 0' });
    }

    const deposit = await balanceService.deposit(
      req.user.walletAddress,
      txHash,
      parseFloat(amount)
    );

    res.json({ success: true, data: deposit });
  } catch (err) {
    sendError(res, err);
  }
});

// 提现申请 — 限流 + 校验 + 审计
router.post('/balance/withdraw', requireAuth,
  withdrawLimiter,
  withdrawRules,
  handleValidation,
  auditMiddleware(AUDIT_EVENTS.WITHDRAW, (req) => ({
    toAddress: req.body.toAddress,
    amount: parseFloat(req.body.amount),
  })),
  async (req, res) => {
  try {
    const { toAddress, amount } = req.body;

    if (!toAddress || !amount) {
      return res.status(400).json({ success: false, error: '缺少 toAddress 或 amount' });
    }

    const withdraw = await balanceService.withdraw(
      req.user.walletAddress,
      toAddress,
      parseFloat(amount)
    );

    res.json({ success: true, data: withdraw });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取交易流水
router.get('/balance/transactions', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const transactions = await balanceService.getTransactions(
      req.user.walletAddress,
      limit
    );
    res.json({ success: true, data: transactions });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
