'use client';

import { useMemo } from 'react';
import type { LevelInfo, LevelTier, Achievement, GameStats, PlatformTrade, PositionType } from '@/types';

// 等级配置
const LEVEL_CONFIG: Record<LevelTier, { minXp: number; title: { zh: string; en: string }; icon: string; color: string; bgColor: string }> = {
  novice:     { minXp: 0,     title: { zh: '新手', en: 'Novice' },         icon: '🌱', color: '#9ca3af', bgColor: 'rgba(156,163,175,0.12)' },
  apprentice: { minXp: 100,   title: { zh: '学徒', en: 'Apprentice' },     icon: '📘', color: '#60a5fa', bgColor: 'rgba(96,165,250,0.12)' },
  trader:     { minXp: 500,   title: { zh: '交易员', en: 'Trader' },       icon: '💼', color: '#34d399', bgColor: 'rgba(52,211,153,0.12)' },
  pro:        { minXp: 2000,  title: { zh: '专业交易者', en: 'Pro' },      icon: '⚡', color: '#a78bfa', bgColor: 'rgba(167,139,250,0.12)' },
  whale:      { minXp: 8000,  title: { zh: '鲸鱼', en: 'Whale' },          icon: '🐋', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.12)' },
  legend:     { minXp: 25000, title: { zh: '传奇', en: 'Legend' },         icon: '👑', color: '#fbbf24', bgColor: 'rgba(251,191,36,0.12)' },
};

const TIER_ORDER: LevelTier[] = ['novice', 'apprentice', 'trader', 'pro', 'whale', 'legend'];

// 每级所需经验
const XP_PER_LEVEL: Record<LevelTier, number> = {
  novice: 100,
  apprentice: 200,
  trader: 400,
  pro: 800,
  whale: 2000,
  legend: 5000,
};

export function calcLevel(totalXp: number): LevelInfo {
  let tier: LevelTier = 'novice';
  let remainingXp = totalXp;

  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const t = TIER_ORDER[i];
    if (totalXp >= LEVEL_CONFIG[t].minXp) {
      tier = t;
      remainingXp = totalXp - LEVEL_CONFIG[t].minXp;
      break;
    }
  }

  const xpPerLevel = XP_PER_LEVEL[tier];
  const levelInTier = Math.floor(remainingXp / xpPerLevel);
  const xpInLevel = remainingXp % xpPerLevel;
  const nextTier = TIER_ORDER[Math.min(TIER_ORDER.indexOf(tier) + 1, TIER_ORDER.length - 1)];

  // 如果已达到最高段位
  const isMaxTier = tier === 'legend' && levelInTier >= 10;
  const displayXpToNext = isMaxTier ? 0 : XP_PER_LEVEL[tier] - xpInLevel;

  const config = LEVEL_CONFIG[tier];

  return {
    tier,
    level: levelInTier + 1,
    xp: xpInLevel,
    xpToNext: displayXpToNext,
    totalXp,
    title: config.title.zh,
    icon: config.icon,
    color: config.color,
    bgColor: config.bgColor,
  };
}

// 预定义成就列表
const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked' | 'progress' | 'current' | 'unlockedAt'>[] = [
  {
    id: 'first_trade',
    name: '初次交易',
    description: '完成你的第一次预测交易',
    icon: '🎯',
    target: 1,
    rarity: 'common',
  },
  {
    id: 'ten_trades',
    name: '交易新星',
    description: '累计完成10笔交易',
    icon: '⭐',
    target: 10,
    rarity: 'common',
  },
  {
    id: 'fifty_trades',
    name: '交易达人',
    description: '累计完成50笔交易',
    icon: '🌟',
    target: 50,
    rarity: 'rare',
  },
  {
    id: 'hundred_trades',
    name: '百笔交易',
    description: '累计完成100笔交易',
    icon: '💫',
    target: 100,
    rarity: 'epic',
  },
  {
    id: 'volume_1k',
    name: '小试牛刀',
    description: '累计交易量达到$1,000',
    icon: '💵',
    target: 1000,
    rarity: 'common',
  },
  {
    id: 'volume_10k',
    name: '交易大户',
    description: '累计交易量达到$10,000',
    icon: '💰',
    target: 10000,
    rarity: 'rare',
  },
  {
    id: 'volume_100k',
    name: '市场鲸鱼',
    description: '累计交易量达到$100,000',
    icon: '🐋',
    target: 100000,
    rarity: 'epic',
  },
  {
    id: 'volume_1m',
    name: '传奇巨鲸',
    description: '累计交易量达到$1,000,000',
    icon: '👑',
    target: 1000000,
    rarity: 'legendary',
  },
  {
    id: 'profit_100',
    name: '盈利初体验',
    description: '累计盈利$100',
    icon: '📈',
    target: 100,
    rarity: 'common',
  },
  {
    id: 'profit_1k',
    name: '利润收割者',
    description: '累计盈利$1,000',
    icon: '🚀',
    target: 1000,
    rarity: 'rare',
  },
  {
    id: 'profit_10k',
    name: '印钞机',
    description: '累计盈利$10,000',
    icon: '🏆',
    target: 10000,
    rarity: 'epic',
  },
  {
    id: 'streak_3',
    name: '三连胜',
    description: '连续盈利3笔交易',
    icon: '🔥',
    target: 3,
    rarity: 'common',
  },
  {
    id: 'streak_7',
    name: '七连胜',
    description: '连续盈利7笔交易',
    icon: '💎',
    target: 7,
    rarity: 'rare',
  },
  {
    id: 'streak_14',
    name: '不败神话',
    description: '连续盈利14笔交易',
    icon: '⚡',
    target: 14,
    rarity: 'legendary',
  },
  {
    id: 'markets_3',
    name: '市场探索者',
    description: '在3个不同市场交易',
    icon: '🗺️',
    target: 3,
    rarity: 'common',
  },
  {
    id: 'markets_10',
    name: '市场征服者',
    description: '在10个不同市场交易',
    icon: '🌍',
    target: 10,
    rarity: 'rare',
  },
  {
    id: 'winrate_60',
    name: '稳中求胜',
    description: '胜率保持在60%以上(至少10笔交易)',
    icon: '📊',
    target: 60,
    rarity: 'rare',
  },
  {
    id: 'winrate_80',
    name: '预测大师',
    description: '胜率保持在80%以上(至少20笔交易)',
    icon: '🎓',
    target: 80,
    rarity: 'epic',
  },
];

export function calcAchievements(stats: {
  totalTrades: number;
  totalVolume: number;
  totalPnl: number;
  streak: number;
  longestStreak: number;
  marketsExplored: number;
  winRate: number;
  profitableTrades: number;
}): Achievement[] {
  return ACHIEVEMENT_DEFS.map(def => {
    let current = 0;
    switch (def.id) {
      case 'first_trade':    current = stats.totalTrades; break;
      case 'ten_trades':     current = stats.totalTrades; break;
      case 'fifty_trades':   current = stats.totalTrades; break;
      case 'hundred_trades': current = stats.totalTrades; break;
      case 'volume_1k':      current = stats.totalVolume; break;
      case 'volume_10k':     current = stats.totalVolume; break;
      case 'volume_100k':    current = stats.totalVolume; break;
      case 'volume_1m':      current = stats.totalVolume; break;
      case 'profit_100':     current = Math.max(0, stats.totalPnl); break;
      case 'profit_1k':      current = Math.max(0, stats.totalPnl); break;
      case 'profit_10k':     current = Math.max(0, stats.totalPnl); break;
      case 'streak_3':       current = Math.max(stats.streak, stats.longestStreak); break;
      case 'streak_7':       current = Math.max(stats.streak, stats.longestStreak); break;
      case 'streak_14':      current = Math.max(stats.streak, stats.longestStreak); break;
      case 'markets_3':      current = stats.marketsExplored; break;
      case 'markets_10':     current = stats.marketsExplored; break;
      case 'winrate_60':     current = Math.round(stats.winRate * 100); break;
      case 'winrate_80':     current = Math.round(stats.winRate * 100); break;
      default:               current = 0;
    }

    const progress = Math.min(100, Math.round((current / def.target) * 100));
    const unlocked = current >= def.target;

    return {
      ...def,
      current,
      progress,
      unlocked,
    } as Achievement;
  });
}

// 计算经验值
export function calcXp(data: { tradeVolume: number; feePaid: number; totalTrades: number }): number {
  // 交易量经验 (1 USDC = 0.1 XP)
  const volumeXp = Math.floor(data.tradeVolume * 0.1);
  // 手续费经验 (1 USDC fee = 2 XP)
  const feeXp = Math.floor(data.feePaid * 2);
  // 交易笔数经验 (每笔 5 XP)
  const tradeXp = data.totalTrades * 5;
  return volumeXp + feeXp + tradeXp;
}

// 主 Hook
export function useGameStats(userData: {
  tradeVolume?: number;
  feePaid?: number;
  orders?: PlatformTrade[];
  positions?: PositionType[];
} | null): GameStats | null {
  return useMemo(() => {
    if (!userData) return null;

    const tradeVolume = userData.tradeVolume || 0;
    const feePaid = userData.feePaid || 0;
    const orders = userData.orders || [];
    const positions = userData.positions || [];

    const totalTrades = orders.length;
    const xp = calcXp({ tradeVolume, feePaid, totalTrades });
    const level = calcLevel(xp);

    // 计算盈亏
    let totalPnl = 0;
    let profitableTrades = 0;
    positions.forEach((p: PositionType) => {
      const size = Number(p.size || 0);
      const avgPrice = Number(p.avgPrice || 0);
      const curPrice = Number(p.currentPrice || avgPrice);
      const pnl = (curPrice - avgPrice) * size;
      totalPnl += pnl;
      if (pnl > 0) profitableTrades++;
    });

    const winRate = totalTrades > 0 ? profitableTrades / Math.max(1, totalTrades) : 0;

    // 简单连胜模拟（基于持仓盈利比例）
    const streak = profitableTrades;
    const longestStreak = Math.max(streak, Math.floor(totalTrades * 0.4)); // 模拟历史最高连胜

    // 模拟探索市场数
    const marketsExplored = Math.min(20, Math.floor(totalTrades * 0.6));

    const achievements = calcAchievements({
      totalTrades,
      totalVolume: tradeVolume,
      totalPnl,
      streak,
      longestStreak,
      marketsExplored,
      winRate,
      profitableTrades,
    });

    return {
      xp,
      level,
      streak,
      longestStreak,
      totalTrades,
      totalVolume: tradeVolume,
      totalPnl,
      winRate,
      profitableTrades,
      marketsExplored,
      achievements,
    };
  }, [userData]);
}
