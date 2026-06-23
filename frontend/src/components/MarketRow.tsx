'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatVolume, countdown } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';
import { api } from '@/lib/api';

// Shared image pool — fetched once, shared across all rows
let sharedPool: Array<{ url: string; thumb: string; id: number }> | null = null;
let poolLoading = false;
const poolListeners: Array<() => void> = [];

export function useImagePool() {
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

interface MarketRowProps {
  market: any;
  index: number;
  pool?: Array<{ url: string; thumb: string; id: number }> | null;
}

function safeParseJson(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

export function MarketRow({ market, index, pool }: MarketRowProps) {
  const { t, locale } = useTranslation();

  const outcomes = safeParseJson(
    locale === 'zh' ? (market.outcomes_zh || market.outcomes) : (market.outcomes || market.outcomes_zh)
  );
  const prices = safeParseJson(market.outcomePrices).map((p: any) => parseFloat(p));
  const volume24h = parseFloat(market.volume24hr || market.volume || '0');
  const isBinary = outcomes.length === 2;
  const yesPct = isBinary && prices[0] >= 0 ? Math.round(prices[0] * 100) : 0;

  const question = locale === 'zh'
    ? (market.question_zh || market.title_zh || market.question || market.title)
    : (market.question || market.title || market.question_zh || market.title_zh);

  const tags = Array.isArray(market.tags) ? market.tags : [];
  const cat = tags[0]?.label || '';

  const cd = countdown(market.endDate, locale);
  const isUrgent = (() => {
    if (!market.endDate) return false;
    return new Date(market.endDate).getTime() - Date.now() < 7200000;
  })();

  const bid = market.bestBid ? parseFloat(market.bestBid) : null;
  const ask = market.bestAsk ? parseFloat(market.bestAsk) : null;

  const img = (() => {
    if (pool?.length) return pool[index % pool.length]?.url ?? '';
    const seed = (market.id || index + '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'fallback';
    return `https://loremflickr.com/96/72?lock=${seed}`;
  })();

  return (
    <Link
      href={`/market/${market.id}`}
      className={`grid grid-cols-[44px,1fr,100px,85px,95px,95px,64px] md:grid-cols-[52px,1fr,110px,90px,100px,100px,72px] gap-2 md:gap-3 items-center px-3 py-2.5 border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer group ${market.closed ? 'opacity-40' : ''}`}
    >
      {/* Thumb — our advantage: real photos */}
      <img
        src={img}
        className="w-11 h-8 md:w-[52px] md:h-10 rounded-[4px] object-cover bg-[var(--bg-secondary)] shrink-0"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
        alt=""
      />

      {/* Title + tags */}
      <div className="min-w-0">
        <div className="text-[12px] md:text-[13px] font-semibold leading-snug line-clamp-2 text-[var(--text-primary)] group-hover:text-white transition-colors">
          {question || '—'}
        </div>
        <div className="flex gap-1 mt-0.5 flex-wrap">
          {cat && <span className="text-[9px] px-1.5 py-px rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{cat}</span>}
          {isUrgent && <span className="text-[9px] px-1.5 py-px rounded bg-red-500/10 text-red-400 font-medium">⏱</span>}
          {market.closed && <span className="text-[9px] px-1.5 py-px rounded bg-white/5 text-white/40">{t('time.ended')}</span>}
        </div>
      </div>

      {/* Probability — our advantage: big number focus */}
      <div className="text-right">
        {isBinary ? (
          <>
            <div className="text-lg md:text-xl font-black tabular-nums leading-none" style={{ color: yesPct >= 50 ? '#22c55e' : '#ef4444' }}>
              {yesPct}<span className="text-[10px] opacity-50">%</span>
            </div>
            <div className="h-1 mt-0.5 rounded-full bg-[var(--bg-hover)] overflow-hidden hidden md:block">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${yesPct}%`, backgroundColor: yesPct >= 50 ? '#22c55e' : '#ef4444' }} />
            </div>
          </>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)]">{outcomes.length} 选项</span>
        )}
      </div>

      {/* Volume */}
      <div className="text-right text-[11px] font-medium tabular-nums text-[var(--text-secondary)] hidden md:block">
        {volume24h > 0 ? formatVolume(volume24h) : '—'}
      </div>

      {/* Spread — new: buy/sell prices */}
      <div className="text-right text-[11px] tabular-nums hidden md:block">
        {bid != null ? <span className="text-[var(--green)] font-semibold">{(bid*100).toFixed(1)}¢</span> : <span className="text-[var(--text-muted)]">—</span>}
        {bid != null && ask != null && <span className="text-[var(--text-muted)] mx-0.5">/</span>}
        {ask != null ? <span className="text-[var(--red)] font-semibold">{(ask*100).toFixed(1)}¢</span> : null}
      </div>

      {/* Countdown — our advantage: urgency color */}
      <div className="text-right">
        <span className={`text-[11px] font-semibold tabular-nums ${isUrgent ? 'text-red-400' : 'text-[var(--accent-amber)]'}`}>
          {cd}
        </span>
      </div>

      {/* Action */}
      <div className="text-right">
        <span className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg border border-[var(--accent-blue)]/40 text-[var(--accent-blue)] group-hover:bg-[var(--accent-blue)] group-hover:text-white transition-all shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </span>
      </div>
    </Link>
  );
}
