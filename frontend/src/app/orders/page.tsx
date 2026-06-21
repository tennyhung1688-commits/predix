'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { formatPrice, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import { useApp } from '@/components/Providers';
import { useGameStats } from '@/hooks/useGameStats';
import { useTranslation } from '@/i18n/I18nProvider';
import type { Achievement } from '@/types';

// 订单状态样式
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    case 'live': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'matched': return 'bg-green-500/10 text-green-400 border border-green-500/20';
    case 'filled': return 'bg-green-500/10 text-green-400 border border-green-500/20';
    case 'cancelled': return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
    case 'failed': return 'bg-red-500/10 text-red-400 border border-red-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
  }
}

function getStatusLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case 'pending': return t('orders.statusPending');
    case 'live': return t('orders.statusLive');
    case 'matched': return t('orders.statusMatched');
    case 'filled': return t('orders.statusFilled');
    case 'cancelled': return t('orders.statusCancelled');
    case 'failed': return t('orders.statusFailed');
    default: return status;
  }
}

// 稀有度样式
const RARITY_STYLES: Record<string, { border: string; glow: string; badge: string; labelZh: string; labelEn: string }> = {
  common:    { border: 'border-gray-500/30', glow: 'rgba(156,163,175,0.3)', badge: 'bg-gray-500/15 text-gray-400', labelZh: '普通', labelEn: 'Common' },
  rare:      { border: 'border-blue-400/40',  glow: 'rgba(96,165,250,0.4)',  badge: 'bg-blue-500/15 text-blue-400',   labelZh: '稀有', labelEn: 'Rare' },
  epic:      { border: 'border-purple-400/50', glow: 'rgba(167,139,250,0.5)', badge: 'bg-purple-500/15 text-purple-400', labelZh: '史诗', labelEn: 'Epic' },
  legendary: { border: 'border-yellow-400/60', glow: 'rgba(251,191,36,0.6)',  badge: 'bg-yellow-500/15 text-yellow-400', labelZh: '传说', labelEn: 'Legendary' },
};

function AchievementCard({ ach, locale }: { ach: Achievement; locale: string }) {
  const rarity = RARITY_STYLES[ach.rarity] || RARITY_STYLES.common;
  return (
    <div
      className={`relative bg-[var(--bg-card)] border ${rarity.border} rounded-xl p-3 ${
        ach.unlocked ? 'hover:scale-[1.02]' : 'opacity-40 saturate-[0.3]'
      } transition-all duration-300`}
      style={ach.unlocked ? { boxShadow: `0 0 12px ${rarity.glow}` } : undefined}
    >
      {ach.unlocked && (
        <span className={`absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${rarity.badge}`}>
          {locale === 'en' ? rarity.labelEn : rarity.labelZh}
        </span>
      )}
      <div className="text-xl mb-1.5">{ach.icon}</div>
      <div className="text-[11px] font-semibold text-[var(--text-primary)] mb-0.5">{ach.name}</div>
      <div className="w-full h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden mt-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${ach.unlocked ? 'bg-[var(--gradient-brand)]' : 'bg-[var(--bg-hover)]'}`}
          style={{ width: `${ach.progress}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, trend }: {
  icon: string; label: string; value: string | number; color?: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 animate-stat-pop">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs">{icon}</span>
        <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
        {trend && (
          <span className={`text-[9px] ml-auto ${trend === 'up' ? 'text-[var(--green)]' : trend === 'down' ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'}`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
          </span>
        )}
      </div>
      <div className={`text-base font-bold tabular-nums ${color || 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  );
}

export default function OrdersPage() {
  const { user } = useApp();
  const { t, locale } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'positions'>('orders');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 订单状态筛选
  const statusOptions = [
    { value: 'all', label: t('orders.statusAll') },
    { value: 'pending', label: t('orders.statusPending') },
    { value: 'filled', label: t('orders.statusFilled') },
    { value: 'cancelled', label: t('orders.statusCancelled') },
    { value: 'failed', label: t('orders.statusFailed') },
  ];

  // 过滤订单
  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'all') return orders;
    return orders.filter((o: any) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fetcher = activeSubTab === 'orders'
      ? api.getOrders().then((res: any) => setOrders(res.data || []))
      : api.getPositions().then((res: any) => setPositions(Array.isArray(res.data) ? res.data : []));
    fetcher.catch(() => {}).finally(() => setLoading(false));
  }, [user, activeSubTab]);

  // 游戏化数据
  const gameStats = useGameStats(user ? {
    tradeVolume: user.tradeVolume,
    feePaid: user.feePaid,
    orders,
    positions,
  } : null);

  // 持仓盈亏汇总
  const positionsSummary = useMemo(() => {
    if (positions.length === 0) return { totalPnl: 0, profitable: 0, losing: 0, best: 0, worst: 0, winRate: 0 };
    let total = 0, prof = 0, loss = 0, best = -Infinity, worst = Infinity;
    positions.forEach((p: any) => {
      const s = parseFloat(p.size || '0');
      const avg = parseFloat(p.avgPrice || p.price || '0');
      const cur = parseFloat(p.curPrice || avg);
      const pnl = (cur - avg) * s;
      total += pnl;
      if (pnl > 0) { prof++; best = Math.max(best, pnl); }
      else if (pnl < 0) { loss++; worst = Math.min(worst, pnl); }
    });
    return {
      totalPnl: total,
      profitable: prof,
      losing: loss,
      best: best === -Infinity ? 0 : best,
      worst: worst === Infinity ? 0 : worst,
      winRate: positions.length > 0 ? prof / positions.length : 0,
    };
  }, [positions]);

  // 接近完成的成就
  const nearAchievements = useMemo(
    () => (gameStats?.achievements || []).filter(a => !a.unlocked && a.progress >= 50).slice(0, 4),
    [gameStats]
  );

  // 已解锁成就
  const unlockedAchievements = useMemo(
    () => (gameStats?.achievements || []).filter(a => a.unlocked),
    [gameStats]
  );

  const handleCancel = async (orderId: string) => {
    try {
      await api.cancelOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err: any) {
      alert(t('orders.cancelFailed') + ': ' + (err.message || ''));
    }
  };

  if (!user) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4">🔐</div>
        <h1 className="text-xl font-bold mb-2">{t('orders.connectFirst')}</h1>
        <p className="text-sm text-[var(--text-muted)]">{t('orders.connectHint')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📋 {t('orders.title')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('orders.subtitle')}</p>
        </div>
        <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          {t('orders.backToMarkets')}
        </Link>
      </div>

      {/* 游戏化等级条（紧凑版） */}
      {gameStats && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 mb-4 animate-fade-in">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xl flex-shrink-0">{gameStats.level.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold truncate" style={{ color: gameStats.level.color }}>
                    {gameStats.level.title}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                    Lv.{gameStats.level.level}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full animate-xp-shine transition-all duration-700"
                    style={{
                      width: gameStats.level.xpToNext > 0
                        ? `${Math.min(100, (gameStats.level.xp / (gameStats.level.xp + gameStats.level.xpToNext)) * 100)}%`
                        : '100%',
                      background: `linear-gradient(90deg, ${gameStats.level.color} 0%, ${gameStats.level.color}88 50%, ${gameStats.level.color} 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>
            {gameStats.streak > 1 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/20 flex-shrink-0">
                <span className="animate-streak-flame text-xs">🔥</span>
                <span className="text-xs font-bold text-[var(--accent-amber)] tabular-nums">{gameStats.streak}</span>
                <span className="text-[9px] text-[var(--text-muted)]">{t('game.streak')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      {gameStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
          <StatCard
            icon="📈"
            label={t('game.totalPnl')}
            value={`${gameStats.totalPnl >= 0 ? '+' : ''}$${gameStats.totalPnl.toFixed(2)}`}
            color={gameStats.totalPnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}
            trend={gameStats.totalPnl >= 0 ? 'up' : 'down'}
          />
          <StatCard
            icon="🎯"
            label={t('game.winRate')}
            value={`${(gameStats.winRate * 100).toFixed(0)}%`}
            color={gameStats.winRate >= 0.6 ? 'text-[var(--green)]' : gameStats.winRate >= 0.4 ? 'text-[var(--accent-amber)]' : 'text-[var(--red)]'}
            trend={gameStats.winRate >= 0.6 ? 'up' : gameStats.winRate >= 0.4 ? 'neutral' : 'down'}
          />
          <StatCard
            icon="💎"
            label={t('game.profitableTrades')}
            value={`${gameStats.profitableTrades}/${gameStats.totalTrades}`}
          />
          <StatCard
            icon="💰"
            label={t('game.totalVolume')}
            value={`$${(gameStats.totalVolume || 0).toLocaleString()}`}
          />
        </div>
      )}

      {/* 持仓盈亏汇总 */}
      {gameStats && activeSubTab === 'positions' && positions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-2.5 text-center">
            <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
              {t('orders.profitableLabel', { n: positionsSummary.profitable })}
            </div>
            <div className="text-sm font-bold text-[var(--green)] tabular-nums mt-0.5">
              {positionsSummary.profitable > 0 ? `+$${positionsSummary.best.toFixed(2)}` : '—'}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-2.5 text-center">
            <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
              {t('orders.losingLabel', { n: positionsSummary.losing })}
            </div>
            <div className="text-sm font-bold text-[var(--red)] tabular-nums mt-0.5">
              {positionsSummary.losing > 0 ? `-$${Math.abs(positionsSummary.worst).toFixed(2)}` : '—'}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-2.5 text-center col-span-2">
            <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
              {t('orders.bestWorstPnl')}
            </div>
            <div className="flex items-center justify-center gap-3 mt-0.5">
              <span className="text-sm font-bold text-[var(--green)] tabular-nums">${positionsSummary.best.toFixed(2)}</span>
              <span className="text-[var(--text-muted)]">|</span>
              <span className="text-sm font-bold text-[var(--red)] tabular-nums">-${Math.abs(positionsSummary.worst).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 成就进度提示 */}
      {gameStats && nearAchievements.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[var(--text-secondary)]">🏆 {t('game.progress')}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {nearAchievements.map(ach => (
              <AchievementCard key={ach.id} ach={ach} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {/* 已解锁成就 */}
      {gameStats && unlockedAchievements.length > 0 && nearAchievements.length === 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
              🏆 {t('game.unlockedAchievements')}
              <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-full">
                {unlockedAchievements.length}/{gameStats.achievements.length}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {unlockedAchievements.slice(0, 6).map(ach => (
              <AchievementCard key={ach.id} ach={ach} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {/* 标签切换 */}
      <div className="flex flex-wrap gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 mb-6 w-fit">
        {[
          { id: 'orders', label: `📝 ${t('orders.tabOrders')}` },
          { id: 'positions', label: `💎 ${t('orders.tabPositions')}` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as 'orders' | 'positions')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeSubTab === tab.id
                ? 'bg-[var(--accent-blue)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 订单状态筛选 */}
      {activeSubTab === 'orders' && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setOrderStatusFilter(opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                orderStatusFilter === opt.value
                  ? 'bg-[var(--bg-card)] border border-[var(--accent-blue)]/30 text-[var(--accent-blue)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {opt.label}
              {opt.value !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({orders.filter((o: any) => o.status === opt.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 内容区域 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 animate-pulse-slow">
              <div className="h-4 bg-[var(--bg-hover)] rounded w-1/3 mb-2" />
              <div className="h-3 bg-[var(--bg-hover)] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {activeSubTab === 'orders' && (
            <>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-medium mb-2">
                    {orderStatusFilter === 'all' ? t('orders.noOrders') : t('orders.noOrdersWithFilter')}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    {orderStatusFilter === 'all' ? t('orders.noOrdersHint') : t('orders.noOrdersWithFilterHint')}
                  </p>
                </div>
              ) : (
                <>
                  {/* 桌面端：表格 */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                          <th className="pb-3 font-medium">{t('dashboard.colMarket')}</th>
                          <th className="pb-3 font-medium text-right">{t('dashboard.colDirection')}</th>
                          <th className="pb-3 font-medium text-right">{t('dashboard.colSize')}</th>
                          <th className="pb-3 font-medium text-right">{t('dashboard.colPrice')}</th>
                          <th className="pb-3 font-medium text-right">{t('orders.colStatus')}</th>
                          <th className="pb-3 font-medium text-right">{t('dashboard.colTime')}</th>
                          <th className="pb-3 font-medium text-right">{t('orders.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order: any) => {
                          const canCancel = order.status === 'pending' || order.status === 'live';
                          return (
                            <tr key={order.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)]">
                              <td className="py-3 max-w-[200px] truncate">{order.title || order.market || order.id}</td>
                              <td className="py-3 text-right">
                                <span className={`text-xs ${order.side === 'BUY' ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                                  {order.side === 'BUY' ? t('dashboard.buy') : t('dashboard.sell')}
                                </span>
                              </td>
                              <td className="py-3 text-right tabular-nums">{parseFloat(order.size || '0').toLocaleString()}</td>
                              <td className="py-3 text-right tabular-nums">{formatPrice(order.price || order.originalPrice || '0')}</td>
                              <td className="py-3 text-right">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeClass(order.status)}`}>
                                  {getStatusLabel(order.status, t)}
                                </span>
                              </td>
                              <td className="py-3 text-right text-xs text-[var(--text-muted)]">
                                {timeAgo(order.created_at || order.timestamp || order.createdAt, locale === 'en' ? 'en' : 'zh')}
                              </td>
                              <td className="py-3 text-right">
                                {canCancel ? (
                                  <button
                                    onClick={() => handleCancel(order.id)}
                                    className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                  >
                                    {t('orders.cancel')}
                                  </button>
                                ) : (
                                  <span className="text-xs text-[var(--text-muted)]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 移动端：卡片布局 */}
                  <div className="md:hidden space-y-2">
                    {filteredOrders.map((order: any) => {
                      const canCancel = order.status === 'pending' || order.status === 'live';
                      return (
                        <div key={order.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 active:bg-[var(--bg-hover)] transition-colors">
                          {/* 第一行：市场名 + 方向 */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[65%]">
                              {order.title || order.market || order.id}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${order.side === 'BUY' ? 'bg-green-500/10 text-[var(--green)]' : 'bg-red-500/10 text-[var(--red)]'}`}>
                              {order.side === 'BUY' ? t('dashboard.buy') : t('dashboard.sell')}
                            </span>
                          </div>
                          {/* 第二行：数量 / 价格 / 状态 */}
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-2">
                            <span>{t('dashboard.colSize')}: <span className="text-[var(--text-secondary)] tabular-nums">{parseFloat(order.size || '0').toLocaleString()}</span></span>
                            <span>{t('dashboard.colPrice')}: <span className="text-[var(--text-secondary)] tabular-nums">{formatPrice(order.price || order.originalPrice || '0')}</span></span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${getStatusBadgeClass(order.status)}`}>
                              {getStatusLabel(order.status, t)}
                            </span>
                          </div>
                          {/* 第三行：时间 + 取消按钮 */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {timeAgo(order.created_at || order.timestamp || order.createdAt, locale === 'en' ? 'en' : 'zh')}
                            </span>
                            {canCancel ? (
                              <button
                                onClick={() => handleCancel(order.id)}
                                className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                              >
                                {t('orders.cancel')}
                              </button>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)]">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {activeSubTab === 'positions' && (
            <>
              {positions.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-4xl mb-4">💎</div>
                  <h3 className="text-lg font-medium mb-2">{t('orders.noPositions')}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{t('orders.noPositionsHint')}</p>
                  <Link
                    href="/"
                    className="inline-block mt-4 px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm hover:bg-[var(--accent-blue-hover)] transition-colors"
                  >
                    {t('orders.browseMarket')}
                  </Link>
                </div>
              ) : (
                <>
                  {/* 桌面端：表格 */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                          <th className="pb-3 font-medium">{t('dashboard.colMarket')}</th>
                          <th className="pb-3 font-medium text-right">{t('orders.colOutcome')}</th>
                          <th className="pb-3 font-medium text-right">{t('orders.colQuantity')}</th>
                          <th className="pb-3 font-medium text-right">{t('orders.colAvgPrice')}</th>
                          <th className="pb-3 font-medium text-right">{t('orders.colCurPrice')}</th>
                          <th className="pb-3 font-medium text-right">{t('orders.colPnl')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((pos: any, i: number) => {
                          const size = parseFloat(pos.size || '0');
                          const avgPrice = parseFloat(pos.avgPrice || pos.price || '0');
                          const curPrice = parseFloat(pos.curPrice || avgPrice);
                          const pnl = (curPrice - avgPrice) * size;
                          const pnlPct = avgPrice > 0 ? ((curPrice - avgPrice) / avgPrice * 100) : 0;
                          return (
                            <tr key={pos.id || i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)] transition-colors">
                              <td className="py-3 max-w-[200px] truncate">{pos.title || pos.market || pos.question || pos.id}</td>
                              <td className="py-3 text-right">{pos.outcome || 'Yes'}</td>
                              <td className="py-3 text-right tabular-nums">{size.toLocaleString()}</td>
                              <td className="py-3 text-right tabular-nums">{formatPrice(avgPrice)}</td>
                              <td className="py-3 text-right tabular-nums">{formatPrice(curPrice)}</td>
                              <td className={`py-3 text-right tabular-nums font-medium ${pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                                <span>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</span>
                                <span className="text-[10px] ml-1 opacity-60">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 移动端：卡片布局 */}
                  <div className="md:hidden space-y-2">
                    {positions.map((pos: any, i: number) => {
                      const size = parseFloat(pos.size || '0');
                      const avgPrice = parseFloat(pos.avgPrice || pos.price || '0');
                      const curPrice = parseFloat(pos.curPrice || avgPrice);
                      const pnl = (curPrice - avgPrice) * size;
                      const pnlPct = avgPrice > 0 ? ((curPrice - avgPrice) / avgPrice * 100) : 0;
                      return (
                        <div key={pos.id || i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 active:bg-[var(--bg-hover)] transition-colors">
                          {/* 第一行：市场名 + 结果 */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[70%]">
                              {pos.title || pos.market || pos.question || pos.id}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full">
                              {pos.outcome || 'Yes'}
                            </span>
                          </div>
                          {/* 第二行：持仓量 / 均价 → 现价 */}
                          <div className="flex items-center gap-3 text-xs mb-2">
                            <span className="text-[var(--text-muted)]">
                              {t('orders.colQuantity')}: <span className="text-[var(--text-secondary)] tabular-nums">{size.toLocaleString()}</span>
                            </span>
                            <span className="text-[var(--text-muted)]">
                              {t('orders.colAvgPrice')}: <span className="text-[var(--text-secondary)] tabular-nums">{formatPrice(avgPrice)}</span>
                            </span>
                            <span className="text-[var(--text-muted)] ml-auto">
                              → <span className="text-[var(--text-secondary)] tabular-nums">{formatPrice(curPrice)}</span>
                            </span>
                          </div>
                          {/* 第三行：盈亏 */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--text-muted)]">{t('orders.colPnl')}</span>
                            <span className={`text-sm font-bold tabular-nums ${pnl >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                              <span className="text-[10px] ml-1 opacity-60">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
