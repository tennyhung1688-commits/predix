'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatVolume, countdown, getProbabilityColor } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

// Shared image pool (same module as MarketCard)
let sharedPool: Array<{ url: string; thumb: string; id: number }> | null = null;
let poolLoading = false;
const poolListeners: Array<() => void> = [];

function useImagePool() {
  const [pool, setPool] = useState<typeof sharedPool>(sharedPool);
  useEffect(() => {
    if (sharedPool) { setPool(sharedPool); return; }
    if (poolLoading) {
      const listener = () => setPool(sharedPool);
      poolListeners.push(listener);
      return () => { const i = poolListeners.indexOf(listener); if (i >= 0) poolListeners.splice(i, 1); };
    }
    poolLoading = true;
    api.getImagePool().then((res: any) => {
      sharedPool = res?.data || [];
      setPool(sharedPool);
      poolListeners.forEach(fn => fn());
      poolListeners.length = 0;
    }).catch(() => {
      sharedPool = [];
      setPool(sharedPool);
      poolListeners.forEach(fn => fn());
      poolListeners.length = 0;
    });
  }, []);
  return pool;
}

function getImage(pool: any[], idx: number) {
  if (pool?.length) return pool[idx % pool.length]?.url ?? '';
  return `https://loremflickr.com/96/72?lock=${idx}`;
}

interface MarketRow {
  id: string;
  question: string;
  outcomes: string[];
  prices: number[];
  volume24hr: string;
  volume: string;
  endDate: string;
  tags: Array<{ label?: string; slug?: string }>;
  bestAsk: string;
  bestBid: string;
  closed: boolean;
}

export default function ExperimentalPage() {
  const { t, locale } = useTranslation();
  const pool = useImagePool();
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await api.getMarkets({ limit: '50', sort: 'volume' });
        setMarkets((res?.data || []) as MarketRow[]);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              {t('app.title')} <span className="text-[10px] font-normal text-[var(--text-muted)] ml-2 bg-[var(--bg-secondary)] px-2 py-0.5 rounded">
                实验 · 密集布局
              </span>
            </h1>
          </div>
          <Link href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors">
            ← 切回卡片视图
          </Link>
        </div>

        {/* Column headers */}
        <div className="hidden md:grid grid-cols-[48px_1fr_110px_90px_100px_100px_72px] gap-3 items-center px-3 py-2 text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider border-b border-[var(--border)]">
          <span />
          <span>盘口</span>
          <span className="text-right">概率</span>
          <span className="text-right">24h 成交</span>
          <span className="text-right">买卖价</span>
          <span className="text-right">倒计时</span>
          <span className="text-right" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            {markets.map((m, i) => {
              const outcomes = (() => {
                try { const o = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes as any) : m.outcomes; return Array.isArray(o) ? o : []; }
                catch { return []; }
              })();
              const prices = (() => {
                try { const p = typeof (m as any).outcomePrices === 'string' ? JSON.parse((m as any).outcomePrices) : (m as any).outcomePrices; return Array.isArray(p) ? p.map(parseFloat) : []; }
                catch { return []; }
              })();
              const isBinary = outcomes.length === 2;
              const yesPct = isBinary && prices[0] ? Math.round(prices[0] * 100) : 0;
              const vol = formatVolume(parseFloat(m.volume24hr || m.volume || '0'));
              const cd = countdown(m.endDate, locale);
              const tags = Array.isArray(m.tags) ? m.tags : [];
              const cat = tags[0]?.label || '';
              const bestBid = m.bestBid ? parseFloat(m.bestBid) : null;
              const bestAsk = m.bestAsk ? parseFloat(m.bestAsk) : null;
              const isUrgent = (() => {
                if (!m.endDate) return false;
                const ms = new Date(m.endDate).getTime() - Date.now();
                return ms > 0 && ms < 7200000; // < 2 hours
              })();

              return (
                <Link
                  key={m.id}
                  href={`/market/${m.id}`}
                  className={`grid grid-cols-[48px_1fr_110px_90px_100px_100px_72px] gap-3 items-center px-3 py-2.5 border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${m.closed ? 'opacity-50' : ''}`}
                >
                  {/* Thumb */}
                  <img
                    src={getImage(pool || [], i)}
                    className="w-12 h-9 rounded object-cover bg-[var(--bg-secondary)] shrink-0"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    alt=""
                  />

                  {/* Title + tags */}
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-snug line-clamp-2 text-[var(--text-primary)]">
                      {m.question || '—'}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {cat && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">
                          {cat}
                        </span>
                      )}
                      {tags.slice(1, 3).map((t: any, j: number) => (
                        <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">
                          {t.label || t}
                        </span>
                      ))}
                      {isUrgent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                          即将到期
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Probability */}
                  <div className="text-right">
                    {isBinary ? (
                      <>
                        <div className="text-xl font-black tabular-nums" style={{ color: yesPct >= 50 ? '#22c55e' : '#ef4444' }}>
                          {yesPct}<span className="text-xs opacity-60">%</span>
                        </div>
                        <div className="h-1 mt-0.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${yesPct}%`, backgroundColor: yesPct >= 50 ? '#22c55e' : '#ef4444' }}
                          />
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)]">多选项</span>
                    )}
                  </div>

                  {/* Volume */}
                  <div className="text-right text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                    {vol || '—'}
                  </div>

                  {/* Spread */}
                  <div className="text-right text-xs tabular-nums">
                    {bestBid != null ? (
                      <span className="text-[var(--green)] font-semibold">{(bestBid * 100).toFixed(1)}¢</span>
                    ) : <span className="text-[var(--text-muted)]">—</span>}
                    {bestBid != null && bestAsk != null && (
                      <span className="text-[var(--text-muted)] mx-1">/</span>
                    )}
                    {bestAsk != null ? (
                      <span className="text-[var(--red)] font-semibold">{(bestAsk * 100).toFixed(1)}¢</span>
                    ) : null}
                  </div>

                  {/* Countdown */}
                  <div className="text-right">
                    <span className={`text-xs font-semibold tabular-nums ${isUrgent ? 'text-red-400' : 'text-[var(--accent-amber)]'}`}>
                      {cd}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded border border-[var(--accent-blue)] text-[10px] font-semibold text-[var(--accent-blue)] hover:bg-[var(--accent-blue)] hover:text-white transition-all">
                      交易
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
