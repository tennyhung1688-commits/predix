'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { formatVolume, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import { useApp } from '@/components/Providers';
import { useGameStats } from '@/hooks/useGameStats';
import { useTranslation } from '@/i18n/I18nProvider';
import type { Achievement } from '@/types';

// 稀有度样式
const RARITY_STYLES: Record<string, { border: string; glow: string; badge: string; labelZh: string; labelEn: string }> = {
  common:    { border: 'border-gray-500/30', glow: 'rgba(156,163,175,0.3)', badge: 'bg-gray-500/15 text-gray-400', labelZh: '普通', labelEn: 'Common' },
  rare:      { border: 'border-blue-400/40',  glow: 'rgba(96,165,250,0.4)',  badge: 'bg-blue-500/15 text-blue-400',   labelZh: '稀有', labelEn: 'Rare' },
  epic:      { border: 'border-purple-400/50', glow: 'rgba(167,139,250,0.5)', badge: 'bg-purple-500/15 text-purple-400', labelZh: '史诗', labelEn: 'Epic' },
  legendary: { border: 'border-yellow-400/60', glow: 'rgba(251,191,36,0.6)',  badge: 'bg-yellow-500/15 text-yellow-400', labelZh: '传说', labelEn: 'Legendary' },
};

function AchievementCard({ ach, locale }: { ach: Achievement; locale: string }) {
  const rarity = RARITY_STYLES[ach.rarity] || RARITY_STYLES.common;
  const label = locale === 'en' ? rarity.labelEn : rarity.labelZh;

  return (
    <div
      className={`relative bg-[var(--bg-card)] border ${rarity.border} rounded-xl p-3 transition-all duration-300 ${
        ach.unlocked
          ? 'hover:scale-[1.02]'
          : 'opacity-40 saturate-[0.3]'
      }`}
      style={ach.unlocked ? { boxShadow: `0 0 12px ${rarity.glow}` } : undefined}
    >
      {/* 稀有度标签 */}
      <span className={`absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${rarity.badge}`}>
        {label}
      </span>

      <div className="text-2xl mb-2">{ach.icon}</div>
      <div className="text-xs font-semibold text-[var(--text-primary)] mb-0.5">
        {ach.name}
      </div>
      <div className="text-[10px] text-[var(--text-muted)] leading-tight mb-2">
        {ach.description}
      </div>

      {/* 进度条 */}
      <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            ach.unlocked ? 'bg-[var(--gradient-brand)]' : 'bg-[var(--bg-hover)]'
          }`}
          style={{ width: `${ach.progress}%` }}
        />
      </div>
      <div className="text-[9px] text-[var(--text-muted)] mt-1 text-right tabular-nums">
        {ach.current}/{ach.target}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, suffix, trend }: {
  icon: string; label: string; value: string | number; color?: string; suffix?: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 animate-stat-pop hover:border-[var(--border-light)] transition-colors">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
        {trend && (
          <span className={`text-[10px] ml-auto ${trend === 'up' ? 'text-[var(--green)]' : trend === 'down' ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'}`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
          </span>
        )}
      </div>
      <div className={`text-lg font-bold tabular-nums ${color || 'text-[var(--text-primary)]'}`}>
        {value}{suffix && <span className="text-xs font-normal text-[var(--text-muted)] ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useApp();
  const { t, locale } = useTranslation();
  const [whales, setWhales] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [sentiment, setSentiment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('signals');

  // 游戏化数据
  const gameStats = useGameStats(user ? {
    tradeVolume: user.tradeVolume,
    feePaid: user.feePaid,
    orders: [],
    positions: [],
  } : null);

  const unlockedAchievements = useMemo(
    () => (gameStats?.achievements || []).filter(a => a.unlocked),
    [gameStats]
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getSmartMoneyWhales(30),
      api.getSmartMoneyWallets(20),
      api.getSmartMoneySignals(),
      api.getSentiment(),
    ])
      .then(([whalesRes, walletsRes, signalsRes, sentimentRes]: any[]) => {
        setWhales(whalesRes.data || []);
        setWallets(walletsRes.data || []);
        setSignals(signalsRes.data || []);
        setSentiment(sentimentRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getSignalBadge = (signal: string) => {
    switch (signal) {
      case 'bullish': return { label: t('dashboard.bullish'), className: 'bg-green-500/10 text-green-400' };
      case 'bearish': return { label: t('dashboard.bearish'), className: 'bg-red-500/10 text-red-400' };
      default: return { label: t('dashboard.neutral'), className: 'bg-yellow-500/10 text-yellow-400' };
    }
  };

  const getSideLabel = (side: string) => {
    return side === 'BUY'
      ? <span className="text-[var(--green)] text-xs">{t('dashboard.buy')}</span>
      : <span className="text-[var(--red)] text-xs">{t('dashboard.sell')}</span>;
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 py-6">
      {/* ========== 页头 ========== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🐋 {t('dashboard.title')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <Link
          href="/"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {t('dashboard.backToMarkets')}
        </Link>
      </div>

      {/* ========== 游戏化等级条 ========== */}
      {gameStats && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{gameStats.level.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: gameStats.level.color }}>
                    {gameStats.level.title}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
                    Lv.{gameStats.level.level}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {t('game.xp')}: {gameStats.xp.toLocaleString()} / {gameStats.level.totalXp.toLocaleString()} XP
                </span>
              </div>
            </div>
            {gameStats.streak > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/20">
                <span className="animate-streak-flame text-sm">🔥</span>
                <span className="text-xs font-bold text-[var(--accent-amber)] tabular-nums">{gameStats.streak}</span>
                <span className="text-[9px] text-[var(--text-muted)]">{t('game.streak')}</span>
              </div>
            )}
          </div>

          {/* 经验进度条 */}
          <div className="relative w-full h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
            {/* 段位分隔线 */}
            {['apprentice', 'trader', 'pro', 'whale'].map((tier, i) => {
              const pct = ((i + 1) * 20) + '%';
              return (
                <div
                  key={tier}
                  className="absolute top-0 bottom-0 w-px bg-[var(--border-light)] z-10"
                  style={{ left: pct }}
                />
              );
            })}
            {/* 当前进度 */}
            <div
              className="absolute inset-y-0 left-0 rounded-full animate-xp-shine transition-all duration-700"
              style={{
                width: gameStats.level.xpToNext > 0
                  ? `${Math.min(100, (gameStats.level.xp / (gameStats.level.xp + (gameStats.level.xpToNext || 1))) * 100)}%`
                  : '100%',
                background: `linear-gradient(90deg, ${gameStats.level.color} 0%, ${gameStats.level.color}88 50%, ${gameStats.level.color} 100%)`,
              }}
            />
          </div>

          {/* 段位标签 */}
          <div className="flex justify-between mt-2">
            {['novice', 'apprentice', 'trader', 'pro', 'whale', 'legend'].map(tier => {
              const isCurrent = tier === gameStats.level.tier;
              return (
                <span
                  key={tier}
                  className={`text-[9px] transition-colors ${
                    isCurrent ? 'font-bold' : 'text-[var(--text-muted)]'
                  }`}
                  style={{ color: isCurrent ? gameStats.level.color : undefined }}
                >
                  {['🌱', '📘', '💼', '⚡', '🐋', '👑'][['novice', 'apprentice', 'trader', 'pro', 'whale', 'legend'].indexOf(tier)]}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== 统计卡片 ========== */}
      {gameStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon="📊"
            label={t('game.totalTrades')}
            value={gameStats.totalTrades}
          />
          <StatCard
            icon="💰"
            label={t('game.totalVolume')}
            value={`$${(gameStats.totalVolume || 0).toLocaleString()}`}
          />
          <StatCard
            icon="🎯"
            label={t('game.winRate')}
            value={`${(gameStats.winRate * 100).toFixed(0)}%`}
            color={gameStats.winRate >= 0.6 ? 'text-[var(--green)]' : gameStats.winRate >= 0.4 ? 'text-[var(--accent-amber)]' : 'text-[var(--red)]'}
            trend={gameStats.winRate >= 0.6 ? 'up' : gameStats.winRate >= 0.4 ? 'neutral' : 'down'}
          />
          <StatCard
            icon={gameStats.totalPnl >= 0 ? '📈' : '📉'}
            label={t('game.totalPnl')}
            value={`${gameStats.totalPnl >= 0 ? '+' : ''}$${gameStats.totalPnl.toFixed(2)}`}
            color={gameStats.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}
            trend={gameStats.totalPnl >= 0 ? 'up' : 'down'}
          />
        </div>
      )}

      {/* ========== 成就展示 ========== */}
      {gameStats && unlockedAchievements.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[var(--text-secondary)] flex items-center gap-2">
              🏆 {t('game.unlockedAchievements')}
              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">
                {unlockedAchievements.length}/{gameStats.achievements.length}
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {unlockedAchievements.slice(0, 6).map(ach => (
              <AchievementCard key={ach.id} ach={ach} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {/* ========== 市场情绪概览 ========== */}
      {sentiment && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center card-hover">
            <div className="text-2xl mb-1">🐂</div>
            <div className="text-xl font-bold text-[var(--green)]">{sentiment.bullish}%</div>
            <div className="text-xs text-[var(--text-muted)]">{t('dashboard.bullishMarket')}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center card-hover">
            <div className="text-2xl mb-1">🐻</div>
            <div className="text-xl font-bold text-[var(--red)]">{sentiment.bearish}%</div>
            <div className="text-xs text-[var(--text-muted)]">{t('dashboard.bearishMarket')}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center card-hover">
            <div className="text-2xl mb-1">⚖️</div>
            <div className="text-xl font-bold text-yellow-400">{sentiment.neutral}%</div>
            <div className="text-xs text-[var(--text-muted)]">{t('dashboard.neutralMarket')}</div>
          </div>
        </div>
      )}

      {/* ========== 标签切换 ========== */}
      <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 mb-6 w-fit">
        {[
          { id: 'signals', label: t('dashboard.tabSignals'), icon: 'chart' },
          { id: 'whales', label: t('dashboard.tabWhales'), icon: 'whale' },
          { id: 'wallets', label: t('dashboard.tabWallets'), icon: 'wallet' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-[var(--accent-blue)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {tab.icon === 'chart' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            )}
            {tab.icon === 'whale' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M12 4c-2 0-5 1.5-6 5-1 3.5 1 9 6 9s7-5.5 6-9c-1-3.5-4-5-6-5z"/><circle cx="10" cy="9" r="1.5"/><path d="M5 8.5C3 7.5 2 9 2 11s2 3 3 2"/><path d="M19 7c2-2 4-1 4 1"/></svg>
            )}
            {tab.icon === 'wallet' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 animate-pulse-slow">
              <div className="h-4 bg-[var(--bg-hover)] rounded w-1/3 mb-2" />
              <div className="h-3 bg-[var(--bg-hover)] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* 交易信号 */}
          {activeTab === 'signals' && (
            <div className="space-y-3">
              {signals.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-4xl mb-4">📡</div>
                  <p className="text-sm text-[var(--text-muted)]">{t('dashboard.noSignals')}</p>
                </div>
              ) : (
                signals.map((signal, i) => {
                  const badge = getSignalBadge(signal.signal);
                  return (
                    <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-blue-500/20 transition-colors card-hover">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {signal.whaleCount} {t('dashboard.whaleTrades')}
                            </span>
                          </div>
                          <h3 className="text-sm font-medium leading-snug mb-3">{signal.market}</h3>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-[var(--green)]">{t('dashboard.buy')} ${parseFloat(signal.buyVolume).toLocaleString()}</span>
                            <span className="text-[var(--red)]">{t('dashboard.sell')} ${parseFloat(signal.sellVolume).toLocaleString()}</span>
                            <span className="text-[var(--text-muted)]">{t('dashboard.buyRatio')} {signal.buyRatio}%</span>
                          </div>
                          {signal.latestTrades && signal.latestTrades.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-3">
                              {signal.latestTrades.map((t: any, j: number) => (
                                <span
                                  key={j}
                                  className={`w-2 h-2 rounded-full ${t.side === 'BUY' ? 'bg-[var(--green)]' : 'bg-[var(--red)]'}`}
                                  title={`${t.side} $${parseFloat(t.value).toLocaleString()}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 鲸鱼交易 */}
          {activeTab === 'whales' && (
            <>
              {/* 桌面端：表格 */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="pb-3 font-medium">{t('dashboard.colWallet')}</th>
                      <th className="pb-3 font-medium">{t('dashboard.colMarket')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colDirection')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colSize')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colPrice')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colValue')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colTime')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whales.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-20 text-[var(--text-muted)]">
                          {t('dashboard.noWhaleData')}
                        </td>
                      </tr>
                    ) : (
                      whales.map((w, i) => (
                        <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="py-3 font-mono text-xs text-[var(--text-secondary)]">
                            {w.wallet.slice(0, 6)}...{w.wallet.slice(-4)}
                          </td>
                          <td className="py-3 max-w-[200px] truncate">{w.market}</td>
                          <td className="py-3 text-right">{getSideLabel(w.side)}</td>
                          <td className="py-3 text-right tabular-nums">{parseFloat(w.size).toLocaleString()}</td>
                          <td className="py-3 text-right tabular-nums">${parseFloat(w.price).toFixed(4)}</td>
                          <td className="py-3 text-right tabular-nums font-medium">
                            ${parseFloat(w.value).toLocaleString()}
                          </td>
                          <td className="py-3 text-right text-xs text-[var(--text-muted)]">
                            {timeAgo(w.timestamp, locale === 'en' ? 'en' : 'zh')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 移动端：卡片布局 */}
              <div className="md:hidden space-y-2">
                {whales.length === 0 ? (
                  <div className="text-center py-20 text-[var(--text-muted)] text-sm">
                    {t('dashboard.noWhaleData')}
                  </div>
                ) : (
                  whales.map((w, i) => (
                    <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 active:bg-[var(--bg-hover)] transition-colors">
                      {/* 第一行：市场名 + 方向 */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[70%]">
                          {w.market}
                        </span>
                        {getSideLabel(w.side)}
                      </div>
                      {/* 第二行：数量 / 价格 / 价值 */}
                      <div className="flex items-center gap-3 text-xs mb-2">
                        <span className="text-[var(--text-muted)]">
                          {t('dashboard.colSize')}: <span className="text-[var(--text-secondary)] tabular-nums">{parseFloat(w.size).toLocaleString()}</span>
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {t('dashboard.colPrice')}: <span className="text-[var(--text-secondary)] tabular-nums">${parseFloat(w.price).toFixed(4)}</span>
                        </span>
                        <span className="text-[var(--text-muted)] ml-auto">
                          {t('dashboard.colValue')}: <span className="text-[var(--text-primary)] font-medium tabular-nums">${parseFloat(w.value).toLocaleString()}</span>
                        </span>
                      </div>
                      {/* 第三行：钱包 + 时间 */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono text-[var(--text-muted)]">
                          {w.wallet.slice(0, 6)}...{w.wallet.slice(-4)}
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {timeAgo(w.timestamp, locale === 'en' ? 'en' : 'zh')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* 聪明钱包排行 */}
          {activeTab === 'wallets' && (
            <>
              {/* 桌面端：表格 */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="pb-3 font-medium">{t('dashboard.colRank')}</th>
                      <th className="pb-3 font-medium">{t('dashboard.colAddress')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colTradeCount')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colTotalVolume')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colBuySell')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colMarkets')}</th>
                      <th className="pb-3 font-medium text-right">{t('dashboard.colLastActive')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-20 text-[var(--text-muted)]">
                          {t('dashboard.noWalletData')}
                        </td>
                      </tr>
                    ) : (
                      wallets.map((w, i) => (
                        <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] transition-colors">
                          <td className="py-3 text-[var(--text-muted)]">
                            {i + 1 <= 3 ? <span className="text-yellow-400">⭐</span> : i + 1}
                          </td>
                          <td className="py-3 font-mono text-xs text-[var(--accent-blue)]">
                            {w.wallet.slice(0, 6)}...{w.wallet.slice(-4)}
                          </td>
                          <td className="py-3 text-right tabular-nums">{w.tradeCount}</td>
                          <td className="py-3 text-right tabular-nums font-medium">
                            ${parseFloat(w.totalVolume).toLocaleString()}
                          </td>
                          <td className="py-3 text-right text-xs">
                            <span className="text-[var(--green)]">{w.buyCount}</span>
                            {' / '}
                            <span className="text-[var(--red)]">{w.sellCount}</span>
                          </td>
                          <td className="py-3 text-right tabular-nums">{w.markets}</td>
                          <td className="py-3 text-right text-xs text-[var(--text-muted)]">
                            {timeAgo(w.lastActive, locale === 'en' ? 'en' : 'zh')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 移动端：卡片布局 */}
              <div className="md:hidden space-y-2">
                {wallets.length === 0 ? (
                  <div className="text-center py-20 text-[var(--text-muted)] text-sm">
                    {t('dashboard.noWalletData')}
                  </div>
                ) : (
                  wallets.map((w, i) => (
                    <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 active:bg-[var(--bg-hover)] transition-colors">
                      {/* 第一行：排名 + 钱包地址 */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm w-6 text-center text-[var(--text-muted)] tabular-nums shrink-0">
                          {i + 1 <= 3 ? <span className="text-yellow-400">⭐</span> : i + 1}
                        </span>
                        <span className="font-mono text-xs text-[var(--accent-blue)] truncate">
                          {w.wallet.slice(0, 6)}...{w.wallet.slice(-4)}
                        </span>
                      </div>
                      {/* 第二行：总交易量 + 买入/卖出 */}
                      <div className="flex items-center gap-3 text-xs mb-2">
                        <span className="text-[var(--text-muted)]">
                          {t('dashboard.colTotalVolume')}: <span className="text-[var(--text-primary)] font-medium tabular-nums">${parseFloat(w.totalVolume).toLocaleString()}</span>
                        </span>
                        <span className="text-[var(--text-muted)] ml-auto">
                          {t('dashboard.colBuySell')}: <span className="text-[var(--green)] tabular-nums">{w.buyCount}</span>/<span className="text-[var(--red)] tabular-nums">{w.sellCount}</span>
                        </span>
                      </div>
                      {/* 第三行：交易次数 / 涉及市场 / 最后活跃 */}
                      <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                        <span>{t('dashboard.colTradeCount')}: <span className="text-[var(--text-secondary)] tabular-nums">{w.tradeCount}</span></span>
                        <span>{t('dashboard.colMarkets')}: <span className="text-[var(--text-secondary)] tabular-nums">{w.markets}</span></span>
                        <span className="ml-auto">{timeAgo(w.lastActive, locale === 'en' ? 'en' : 'zh')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
