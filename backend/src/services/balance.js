/**
 * 用户余额服务
 * 管理用户在平台内的虚拟 USDC 余额、充值、提现
 */
const prisma = require('../lib/prisma');
const config = require('../config');
const { AppError } = require('../lib/errors');

class BalanceService {
  /**
   * 获取或创建用户
   */
  async getOrCreateUser(walletAddress) {
    let user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
    if (!user) {
      const initialBalance = 0;

      user = await prisma.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
          balance: initialBalance,
        },
      });

      console.log(`👤 新用户注册: ${walletAddress.toLowerCase()}`);
    }
    return user;
  }

  /**
   * 获取用户余额
   */
  async getBalance(walletAddress) {
    const user = await this.getOrCreateUser(walletAddress);
    return {
      balance: user.balance,
      lockedBalance: user.lockedBalance,
      available: user.balance - user.lockedBalance,
      totalDeposited: user.totalDeposited,
      totalWithdrawn: user.totalWithdrawn,
    };
  }

  /**
   * 充值（模拟：记录链上充值交易）
   * 实际生产环境需监听链上 USDC 转账事件
   */
  async deposit(walletAddress, txHash, amount) {
    const user = await this.getOrCreateUser(walletAddress);

    // 检查 txHash 是否已处理
    const existing = await prisma.deposit.findUnique({ where: { txHash } });
    if (existing) {
      throw new Error('该交易已处理');
    }

    // 创建充值记录
    const deposit = await prisma.deposit.create({
      data: {
        userId: user.id,
        txHash,
        amount,
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    });

    // 更新用户余额
    await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: amount },
        totalDeposited: { increment: amount },
      },
    });

    // 记录流水
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'DEPOSIT',
        amount,
        balance: user.balance + amount,
        desc: `充值 ${amount} USDC (tx: ${txHash.slice(0, 10)}...)`,
      },
    });

    return deposit;
  }

  /**
   * 提现安全校验
   */
  async _validateWithdrawSafety(user, amount) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600000);

    // 1. 每日提现次数限制
    const dailyCount = await prisma.withdraw.count({
      where: {
        userId: user.id,
        createdAt: { gte: yesterday },
        status: { not: 'rejected' },
      },
    });
    const maxDailyCount = parseInt(process.env.MAX_WITHDRAW_COUNT) || 3;
    if (dailyCount >= maxDailyCount) {
      throw new AppError(`每日最多提现 ${maxDailyCount} 次`, 400);
    }

    // 2. 每日提现金额限制
    const dailyTotal = await prisma.withdraw.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: yesterday },
        status: { not: 'rejected' },
      },
      _sum: { amount: true },
    });
    const maxDailyAmount = parseFloat(process.env.MAX_DAILY_WITHDRAW) || 1000;
    if ((dailyTotal._sum.amount || 0) + amount > maxDailyAmount) {
      throw new AppError(`每日提现上限 ${maxDailyAmount} USDC`, 400);
    }

    // 3. 账户年龄检查（注册 24 小时后才能提现）
    const accountAge = now.getTime() - new Date(user.createdAt).getTime();
    if (accountAge < 24 * 3600000) {
      const hoursLeft = Math.ceil((24 * 3600000 - accountAge) / 3600000);
      throw new AppError(`新账户需等待 24 小时才能提现，还需 ${hoursLeft} 小时`, 400);
    }
  }

  /**
   * 提现申请
   */
  async withdraw(walletAddress, toAddress, amount) {
    const user = await this.getOrCreateUser(walletAddress);
    const minAmount = parseFloat(process.env.MIN_WITHDRAW_AMOUNT) || 10;

    if (amount < minAmount) {
      throw new AppError(`最低提现金额为 ${minAmount} USDC`, 400);
    }

    if (user.balance - user.lockedBalance < amount) {
      throw new AppError('可用余额不足', 400);
    }

    // 安全检查
    await this._validateWithdrawSafety(user, amount);

    // 检测新地址（首次提现到该地址需确认）
    const existingWithdraw = await prisma.withdraw.findFirst({
      where: {
        userId: user.id,
        toAddress: toAddress.toLowerCase(),
        status: 'completed',
      },
    });
    const isNewAddress = !existingWithdraw;

    // 创建提现记录
    const withdraw = await prisma.withdraw.create({
      data: {
        userId: user.id,
        toAddress: toAddress.toLowerCase(),
        amount,
        status: 'pending',
        fee: 0,
        note: isNewAddress ? '新地址' : null,
      },
    });

    // 锁定余额
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lockedBalance: { increment: amount },
      },
    });

    // 记录流水
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'WITHDRAW',
        amount: -amount,
        balance: user.balance - amount,
        desc: `提现申请 ${amount} USDC → ${toAddress.slice(0, 10)}...`,
      },
    });

    return withdraw;
  }

  /**
   * 处理提现（确认或拒绝）
   */
  async processWithdraw(withdrawId, action, txHash = null) {
    const withdraw = await prisma.withdraw.findUnique({
      where: { id: withdrawId },
      include: { user: true },
    });

    if (!withdraw) throw new Error('提现记录不存在');
    if (withdraw.status !== 'pending') throw new Error('该提现已处理');

    if (action === 'complete') {
      // 完成提现
      await prisma.$transaction([
        prisma.withdraw.update({
          where: { id: withdrawId },
          data: {
            status: 'completed',
            txHash,
            processedAt: new Date(),
          },
        }),
        prisma.user.update({
          where: { id: withdraw.userId },
          data: {
            balance: { decrement: withdraw.amount },
            lockedBalance: { decrement: withdraw.amount },
            totalWithdrawn: { increment: withdraw.amount },
          },
        }),
      ]);

      await prisma.transaction.create({
        data: {
          userId: withdraw.userId,
          type: 'WITHDRAW',
          amount: -withdraw.amount,
          balance: withdraw.user.balance - withdraw.amount,
          desc: `提现完成 ${withdraw.amount} USDC (tx: ${txHash?.slice(0, 10)}...)`,
        },
      });
    } else if (action === 'reject') {
      // 拒绝提现，解锁余额
      await prisma.$transaction([
        prisma.withdraw.update({
          where: { id: withdrawId },
          data: { status: 'failed' },
        }),
        prisma.user.update({
          where: { id: withdraw.userId },
          data: {
            lockedBalance: { decrement: withdraw.amount },
          },
        }),
      ]);
    }

    return prisma.withdraw.findUnique({ where: { id: withdrawId } });
  }

  /**
   * 锁定余额（下单时）
   */
  async lockBalance(userId, amount) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.balance - user.lockedBalance < amount) {
      throw new AppError('可用余额不足', 400);
    }
    return prisma.user.update({
      where: { id: userId },
      data: { lockedBalance: { increment: amount } },
    });
  }

  /**
   * 解锁余额（取消订单或成交后退还）
   */
  async unlockBalance(userId, amount) {
    return prisma.user.update({
      where: { id: userId },
      data: { lockedBalance: { decrement: Math.min(amount, 999999) } },
    });
  }

  /**
   * 扣减余额（成交时）
   */
  async deductBalance(userId, amount, type, desc) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.balance < amount) {
      throw new AppError('余额不足', 400);
    }

    const newBalance = user.balance - amount;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          lockedBalance: { decrement: Math.min(amount, user.lockedBalance) },
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type,
          amount: -amount,
          balance: newBalance,
          desc,
        },
      }),
    ]);

    return newBalance;
  }

  /**
   * 获取用户交易记录
   */
  async getTransactions(walletAddress, limit = 50) {
    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });
    if (!user) return [];

    return prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

module.exports = new BalanceService();
