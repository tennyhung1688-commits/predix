'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TradingPanel } from '@/components/TradingPanel';
import { formatPrice, formatVolume, formatPercent, timeAgo, countdown } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

function safeJsonArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

export default function MarketDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { t, locale } = useTranslation();
  const [market, setMarket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);

    // 先获取市场数据，再用 CLOB token ID 获取交易和价格历史
    api.getMarket(id)
      .then(async (marketRes: any) => {
        if (cancelled) return;
        const m = marketRes.data;
        setMarket(m);

        // 从市场数据中提取第一个 CLOB token ID
        const clobTokens = safeJsonArray(m?.clobTokenIds);
        const tokenId = clobTokens[0];

        if (tokenId) {
          const [tradesRes, historyRes] = await Promise.all([
            api.getTrades(tokenId).catch(() => ({ data: [] })),
            api.getPriceHistory(tokenId, '1h').catch(() => ({ data: [] })),
          ]);
          if (!cancelled) {
            setTrades(((tradesRes as any).data || []).slice(0, 30));
            setPriceHistory((historyRes as any).data || []);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="animate-pulse-slow space-y-4">
          <div className="h-8 bg-[var(--bg-card)] rounded w-1/3" />
          <div className="h-4 bg-[var(--bg-card)] rounded w-2/3" />
          <div className="h-64 bg-[var(--bg-card)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h3 className="text-lg font-medium mb-2">{t('market.notFound')}</h3>
        <Link href="/" className="text-sm text-blue-400 hover:underline">{t('market.backHome')}</Link>
      </div>
    );
  }

  const outcomes = locale === 'zh'
    ? (safeJsonArray(market.outcomes_zh).length > 0 ? safeJsonArray(market.outcomes_zh) : safeJsonArray(market.outcomes))
    : (safeJsonArray(market.outcomes).length > 0 ? safeJsonArray(market.outcomes) : safeJsonArray(market.outcomes_zh));
  const prices = safeJsonArray(market.outcomePrices).map((p: any) => parseFloat(p));
  const volume24h = parseFloat(market.volume24hr || market.volume || '0');

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-4">
        <Link href="/" className="hover:text-[var(--text-primary)]">{t('market.breadcrumb')}</Link>
        <span>/</span>
        <span className="text-[var(--text-primary)]">
          {(market.tags || [])[0]?.label || t('general.general')}
        </span>
      </div>

      <div className="flex gap-6">
        {/* 主要内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h1 className="text-xl font-bold mb-4">
            {locale === 'zh' ? (market.question_zh || market.question) : (market.question || market.question_zh)}
          </h1>

          {/* 统计信息 */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2">
              <div className="text-[10px] text-[var(--text-muted)]">{t('market.24hVolume')}</div>
              <div className="text-sm font-bold tabular-nums">{formatVolume(volume24h)}</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2">
              <div className="text-[10px] text-[var(--text-muted)]">{t('market.totalVolume')}</div>
              <div className="text-sm font-bold tabular-nums">{formatVolume(market.volume)}</div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2">
              <div className="text-[10px] text-[var(--text-muted)]">{t('market.liquidity')}</div>
              <div className="text-sm font-bold tabular-nums">{formatVolume(market.liquidity)}</div>
            </div>
            {market.endDate && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2">
                <div className="text-[10px] text-[var(--text-muted)]">{t('market.endTime')}</div>
                <div className="text-sm font-bold">{countdown(market.endDate, locale)}</div>
              </div>
            )}
          </div>

          {/* 结果概率 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">{t('market.probability')}</h3>
            <div className="space-y-3">
              {outcomes.map((outcome: string, i: number) => {
                const prob = prices[i] || 0;
                const barColor = prob > 0.5 ? '#22c55e' : prob > 0.3 ? '#f59e0b' : '#ef4444';
                return (
                <div key={i}>
                  <div className="flex justify-between items-center text-sm mb-1.5">
                    <span className="text-[var(--text-secondary)]">{outcome}</span>
                    <span className="tabular-nums font-bold" style={{ color: barColor }}>{formatPercent(prob)}</span>
                  </div>
                  <div className="relative h-4 bg-[var(--bg-secondary)] rounded-full overflow-hidden shadow-inner">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(prob * 100, 2)}%`,
                        background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                        boxShadow: `0 0 8px ${barColor}44`,
                      }}
                    />
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* 最近交易 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-medium">{t('market.recentTrades')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="text-left px-4 py-2 font-normal">{t('market.direction')}</th>
                    <th className="text-right px-4 py-2 font-normal">{t('market.price')}</th>
                    <th className="text-right px-4 py-2 font-normal">{t('market.quantity')}</th>
                    <th className="text-right px-4 py-2 font-normal">{t('market.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-hover)]">
                      <td className={`px-4 py-2 font-medium ${trade.side === 'BUY' ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                        {trade.side === 'BUY' ? t('market.buy') : t('market.sell')}
                      </td>
                      <td className="text-right px-4 py-2 tabular-nums">{formatPrice(trade.price)}</td>
                      <td className="text-right px-4 py-2 tabular-nums text-[var(--text-secondary)]">
                        {parseFloat(trade.size).toFixed(0)}
                      </td>
                      <td className="text-right px-4 py-2 text-[var(--text-muted)]">
                        {trade.createdAt ? timeAgo(trade.createdAt, locale) : '—'}
                      </td>
                    </tr>
                  ))}
                  {trades.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[var(--text-muted)]">
                        {t('market.noTrades')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 交易面板 */}
        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-20">
            <TradingPanel market={market} />
          </div>
        </div>
      </div>

      {/* 移动端底部交易按钮 */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
        <Link
          href={`/?market=${id}`}
          className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2 shadow-lg"
        >
          {t('market.startTrading')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </Link>
      </div>
    </div>
  );
}
