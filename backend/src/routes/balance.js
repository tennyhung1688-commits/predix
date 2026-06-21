const express = require('express');
const balanceService = require('../services/balance');
const config = require('../config');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { withdrawLimiter } = require('../middleware/rateLimiter');
const { depositRules, withdrawRules, handleValidation } = require('../middleware/validate');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const { sendError } = require('../lib/errors');

const router = express.Router();

// 获取余额
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const balance = await balanceService.getBalance({ userId: req.user.id });
    res.json({ success: true, data: balance });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取充值信息（平台钱包地址 + 新用户奖励）
router.get('/balance/deposit-info', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const hasWallet = !!user?.walletAddress;
    res.json({
      success: true,
      data: {
        platformAddress: config.platform.depositAddress,
        newUserBonus: config.platform.newUserBonus,
        hasWallet,
        note: hasWallet
          ? `转账 USDC (Polygon) 到平台地址，到账后联系客服确认。首次注册赠送 ${config.platform.newUserBonus} USDC。`
          : '请先绑定 Polygon 钱包后再进行充值。',
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 自动验证充值 — 通过 txHash 查询 Polygonscan 确认到账
router.post('/balance/deposit/verify', requireAuth, async (req, res) => {
  try {
    const { txHash } = req.body;
    if (!txHash) {
      return res.status(400).json({ success: false, error: '缺少 txHash' });
    }

    const apiKey = config.polygonscanApiKey;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'Polygonscan API Key 未配置' });
    }

    // 1. 查询 Polygonscan 交易详情
    const resp = await require('axios').get('https://api.polygonscan.com/api', {
      params: {
        module: 'proxy',
        action: 'eth_getTransactionReceipt',
        txhash: txHash,
        apikey: apiKey,
      },
      timeout: 10000,
    });

    const receipt = resp.data?.result;
    if (!receipt) {
      return res.json({ success: false, error: '未找到该交易，请确认 txHash 正确（Polygon 网络）' });
    }
    if (receipt.status !== '0x1') {
      return res.json({ success: false, error: '交易失败或未确认，请等待链上确认' });
    }

    // 2. 验证收款地址是否正确
    const platformAddr = config.platform.depositAddress.toLowerCase();
    const toAddr = (receipt.to || '').toLowerCase();
    if (toAddr !== platformAddr) {
      return res.json({ success: false, error: `收款地址不匹配。请转账到: ${config.platform.depositAddress}` });
    }

    // 3. 查询交易详情获取金额
    const txResp = await require('axios').get('https://api.polygonscan.com/api', {
      params: {
        module: 'proxy',
        action: 'eth_getTransactionByHash',
        txhash: txHash,
        apikey: apiKey,
      },
      timeout: 10000,
    });

    const tx = txResp.data?.result;
    if (!tx) {
      return res.json({ success: false, error: '无法获取交易详情' });
    }

    const fromAddr = tx.from.toLowerCase();

    // 4. USDC 金额 = value（Polygon 上 USDC 是 ERC20，value 在 logs 的 data 里）
    // USDC 精度 6，通过 Transfer event log 提取
    let amount = 0;
    if (receipt.logs) {
      for (const log of receipt.logs) {
        if (log.topics &&
            // Transfer(address,address,uint256) = 0xddf252ad...
            log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
            log.topics.length >= 3) {
          // topics[1] = from (indexed), topics[2] = to (indexed)
          // data = amount (uint256, padded to 64 chars hex)
          const logFrom = '0x' + log.topics[1].slice(26);
          const logTo = '0x' + log.topics[2].slice(26);
          if (logTo.toLowerCase() === platformAddr) {
            const rawAmount = parseInt(log.data, 16);
            amount = rawAmount / 1e6; // USDC 6 decimals
            break;
          }
        }
      }
    }

    if (amount <= 0) {
      return res.json({ success: false, error: '未检测到 USDC 转账' });
    }

    // 5. 防重复：检查 txHash 是否已处理
    const existing = await prisma.transaction.findFirst({
      where: { desc: { contains: txHash } },
    });
    if (existing) {
      return res.json({ success: false, error: '该交易已确认到账，不可重复提交' });
    }

    // 6. 已确认到账，自动充值
    const deposit = await balanceService.depositByUserId(req.user.id, txHash, amount);

    res.json({
      success: true,
      data: {
        txHash,
        amount,
        from: fromAddr,
        message: `✅ 自动确认到账 ${amount} USDC`,
        deposit,
      },
    });
  } catch (err) {
    console.error('[deposit/verify] 验证失败:', err.message || err);
    sendError(res, err);
  }
});

// 手动充值（保留备用）
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

    const deposit = await balanceService.depositByUserId(
      req.user.id,
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

    const withdraw = await balanceService.withdrawById(
      req.user.id,
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
      { userId: req.user.id },
      limit
    );
    res.json({ success: true, data: transactions });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
