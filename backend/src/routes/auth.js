const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../lib/prisma');
const { authLimiter } = require('../middleware/rateLimiter');
const { loginRules, emailLoginRules, registerRules, handleValidation } = require('../middleware/validate');
const { auditMiddleware, AUDIT_EVENTS } = require('../middleware/auditLog');
const logger = require('../lib/logger');
const { sendError } = require('../lib/errors');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

/** 生成随机推荐码（8位十六进制） */
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex');
}

/** 签发 JWT */
function signToken(user) {
  return jwt.sign(
    { id: user.id, walletAddress: user.walletAddress, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
}

/** 序列化用户返回 */
function serializeUser(user) {
  return {
    id: user.id,
    walletAddress: user.walletAddress,
    email: user.email,
    username: user.username,
    role: user.role,
    balance: user.balance,
    lockedBalance: user.lockedBalance,
    totalDeposited: user.totalDeposited,
    totalWithdrawn: user.totalWithdrawn,
    tradeVolume: user.tradeVolume,
    feePaid: user.feePaid,
    referralCode: user.referralCode,
    referralEarnings: user.referralEarnings,
    createdAt: user.createdAt.toISOString(),
  };
}

// 钱包地址登录
router.post('/login',
  authLimiter,
  loginRules,
  handleValidation,
  auditMiddleware(AUDIT_EVENTS.LOGIN, (req) => ({ walletAddress: req.body.walletAddress?.toLowerCase() })),
  async (req, res) => {
  try {
    const { walletAddress, referralCode } = req.body;
    const addr = walletAddress.toLowerCase();

    let user = await prisma.user.findUnique({ where: { walletAddress: addr } });
    if (!user) {
      let referredBy = null;
      if (referralCode) {
        const inviter = await prisma.user.findUnique({ where: { referralCode } });
        if (inviter?.id) referredBy = inviter.id;
      }
      for (let i = 0; i < 5; i++) {
        try {
          const code = generateReferralCode();
          user = await prisma.user.create({
            data: {
              walletAddress: addr,
              referralCode: code,
              ...(referredBy ? { referredBy } : {}),
            },
          });
          break;
        } catch (err) {
          if (err.code !== 'P2002') throw err;
          if (i === 4) throw new Error('推荐码生成冲突，请重试');
        }
      }
    }

    const token = signToken(user);
    res.json({ success: true, data: { token, user: serializeUser(user) } });
  } catch (err) {
    console.error('[auth/login] 捕获错误:', { message: err.message, code: err.code, meta: err.meta, stack: err.stack });
    sendError(res, err);
  }
});

// 邮箱注册
router.post('/register',
  authLimiter,
  registerRules,
  handleValidation,
  async (req, res) => {
    try {
      const { email, password, username } = req.body;

      // 查重
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ success: false, error: '该邮箱已被注册' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      let user = null;
      for (let i = 0; i < 5; i++) {
        try {
          const code = generateReferralCode();
          user = await prisma.user.create({
            data: {
              email,
              passwordHash,
              username: username?.trim() || null,
              referralCode: code,
            },
          });
          break;
        } catch (err) {
          if (err.code !== 'P2002') throw err;
          if (i === 4) throw new Error('推荐码生成冲突，请重试');
        }
      }

      const token = signToken(user);
      logger.info({ userId: user.id, email }, '用户注册成功');
      res.status(201).json({ success: true, data: { token, user: serializeUser(user) } });
    } catch (err) {
      console.error('[auth/register] 捕获错误:', { message: err.message, code: err.code, stack: err.stack });
      sendError(res, err);
    }
  }
);

// 邮箱密码登录
router.post('/login/email',
  authLimiter,
  emailLoginRules,
  handleValidation,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ success: false, error: '邮箱或密码错误' });
      }
      if (!user.passwordHash) {
        return res.status(401).json({ success: false, error: '该账号未设置密码，请使用钱包登录' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ success: false, error: '邮箱或密码错误' });
      }

      const token = signToken(user);
      logger.info({ userId: user.id, email }, '邮箱登录成功');
      res.json({ success: true, data: { token, user: serializeUser(user) } });
    } catch (err) {
      console.error('[auth/login/email] 捕获错误:', { message: err.message, stack: err.stack });
      sendError(res, err);
    }
  }
);

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    // 兼容 wallet / email / twitter 等方式
    const where = decoded.walletAddress
      ? { walletAddress: decoded.walletAddress }
      : decoded.email
      ? { email: decoded.email }
      : decoded.id
      ? { id: decoded.id }
      : null;
    if (!where) return res.status(401).json({ success: false, error: 'Token 无效' });

    const user = await prisma.user.findUnique({ where });

    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    res.json({
      success: true,
      data: serializeUser(user),
    });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Token 无效' });
  }
});

// ────────────────────────────────────────
// X (Twitter) OAuth 2.0
// ────────────────────────────────────────

const TWITTER_AUTH_URL = 'https://x.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const TWITTER_USER_URL = 'https://api.x.com/2/users/me';

/** 生成随机状态值（防 CSRF） */
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

/** 存储 OAuth state（内存 Map，生产可用 Redis） */
const oauthStates = new Map();

// 发起 Twitter 授权
router.get('/twitter', (req, res) => {
  if (!config.twitter.clientId) {
    return res.status(500).json({ success: false, error: 'Twitter OAuth 未配置' });
  }

  const state = generateState();
  const redirectTo = req.query.redirect || '/';

  oauthStates.set(state, { redirectTo, createdAt: Date.now() });

  // 过期清理（5 分钟）
  setTimeout(() => oauthStates.delete(state), 5 * 60 * 1000);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.twitter.clientId,
    redirect_uri: config.twitter.callbackUrl,
    scope: 'users.read',
    state,
    code_challenge: 'challenge', // PKCE plain mode for simplicity
    code_challenge_method: 'plain',
  });

  res.redirect(`${TWITTER_AUTH_URL}?${params.toString()}`);
});

// Twitter 回调处理
router.get('/twitter/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    const frontendUrl = config.corsOrigin || 'http://localhost:3000';

    if (oauthError) {
      logger.warn({ oauthError, error_description }, 'Twitter OAuth 错误');
      return res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent(error_description || oauthError)}`);
    }

    const stored = oauthStates.get(state);
    oauthStates.delete(state);

    if (!stored) {
      return res.status(400).json({ success: false, error: 'OAuth state 无效或已过期' });
    }

    // 交换 code 获取 access token
    const tokenParams = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: config.twitter.clientId,
      client_secret: config.twitter.clientSecret,
      redirect_uri: config.twitter.callbackUrl,
      code_verifier: 'challenge',
    });

    const tokenRes = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      logger.error({ status: tokenRes.status, body: err }, 'Twitter token exchange 失败');
      return res.redirect(`${frontendUrl}/auth?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const { access_token } = tokenData;

    // 获取 Twitter 用户信息
    const userRes = await fetch(`${TWITTER_USER_URL}?user.fields=profile_image_url,username`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      return res.redirect(`${frontendUrl}/auth?error=fetch_user_failed`);
    }

    const { data: twitterUser } = await userRes.json();
    const twitterId = twitterUser.id;
    const twitterUsername = twitterUser.username;
    const avatarUrl = twitterUser.profile_image_url?.replace('_normal', '_400x400') || null;

    // 查找或创建用户
    let user = await prisma.user.findUnique({ where: { twitterId } });

    if (!user) {
      // 创建新用户
      let referralCode = null;
      for (let i = 0; i < 5; i++) {
        try {
          referralCode = generateReferralCode();
          user = await prisma.user.create({
            data: {
              twitterId,
              twitterUsername,
              username: twitterUsername,
              avatarUrl,
              provider: 'twitter',
              referralCode,
            },
          });
          break;
        } catch (err) {
          if (err.code !== 'P2002') throw err;
          if (i === 4) throw new Error('推荐码生成冲突，请重试');
        }
      }
      logger.info({ userId: user.id, twitterUsername }, 'Twitter 新用户注册成功');
    } else {
      // 更新用户资料
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          twitterUsername,
          username: user.username || twitterUsername,
          ...(avatarUrl ? { avatarUrl } : {}),
        },
      });
      logger.info({ userId: user.id, twitterUsername }, 'Twitter 用户登录成功');
    }

    // 签发 JWT
    const token = signToken(user);

    // 重定向到前端，携带 token
    const redirectTo = stored.redirectTo || '/';
    const callbackParams = new URLSearchParams({ token, redirect: redirectTo });
    res.redirect(`${frontendUrl}/auth/twitter-callback?${callbackParams.toString()}`);
  } catch (err) {
    logger.error({ message: err.message, stack: err.stack }, 'Twitter callback 错误');
    const frontendUrl = config.corsOrigin || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth?error=oauth_error`);
  }
});

module.exports = router;
