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
      className={`grid grid-cols-[40px,1fr,90px,56px] md:grid-cols-[52px,1fr,110px,90px,100px,100px,72px] gap-2 md:gap-3 items-center px-3 py-2.5 border-b border-[var(--border-light)] hover:bg-white/[0.03] active:scale-[0.995] transition-all duration-150 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-blue)]/50 ${market.closed ? 'opacity-40 pointer-events-none' : ''} ${index % 2 === 1 ? 'bg-white/[0.01]' : ''}`}
    >
      {/* Thumbnail */}
      <img
        src={img}
        className="w-11 h-8 md:w-[52px] md:h-10 rounded-[4px] object-cover bg-[var(--bg-secondary)] shrink-0 shadow-sm"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        alt={question || ''}
      />

      {/* Title + tags */}
      <div className="min-w-0">
        <div className="text-[12px] md:text-[13px] font-semibold leading-snug line-clamp-2 text-white/90 group-hover:text-white transition-colors">
          {question || '—'}
        </div>
        <div className="flex gap-1 mt-0.5 flex-wrap">
          {cat && (
            <span className="text-[9px] px-1.5 py-px rounded-sm border border-white/5 bg-white/[0.03] text-white/40 tracking-wide uppercase">
              {cat}
            </span>
          )}
          {isUrgent && (
            <span className="text-[9px] px-1.5 py-px rounded-sm bg-red-500/10 text-red-400/80 font-medium inline-flex items-center gap-0.5">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
              即将到期
            </span>
          )}
          {market.closed && (
            <span className="text-[9px] px-1.5 py-px rounded-sm bg-white/[0.03] text-white/25">{t('time.ended')}</span>
          )}
        </div>
      </div>

      {/* Probability — signature: bold number with subtle glow */}
      <div className="text-right">
        {isBinary ? (
          <>
            <div
              className="text-lg md:text-xl font-black tabular-nums leading-none"
              style={{ color: yesPct >= 50 ? '#22c55e' : '#ef4444' }}
            >
              <span className="drop-shadow-[0_0_6px_rgba(34,197,94,0.15)]" style={yesPct < 50 ? { filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.15))' } : undefined}>
                {yesPct}
              </span>
              <span className="text-[10px] opacity-40">%</span>
            </div>
            <div className="h-1 mt-0.5 rounded-full bg-white/[0.06] overflow-hidden hidden md:block">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(yesPct, 2)}%`,
                  background: yesPct >= 50
                    ? 'linear-gradient(90deg, #166534, #22c55e)'
                    : 'linear-gradient(90deg, #7f1d1d, #ef4444)',
                }}
              />
            </div>
          </>
        ) : (
          <span className="text-[10px] text-white/30 font-medium">{outcomes.length} 选项</span>
        )}
      </div>

      {/* Volume — hidden on mobile */}
      <div className="text-right text-[11px] font-medium tabular-nums text-white/50 hidden md:block">
        {volume24h > 0 ? formatVolume(volume24h) : '—'}
      </div>

      {/* Spread */}
      <div className="text-right text-[11px] tabular-nums hidden md:block">
        {bid != null ? <span className="text-[var(--green)] font-semibold">{(bid*100).toFixed(1)}¢</span> : <span className="text-white/20">—</span>}
        {bid != null && ask != null && <span className="text-white/15 mx-0.5">/</span>}
        {ask != null ? <span className="text-[var(--red)] font-semibold">{(ask*100).toFixed(1)}¢</span> : null}
      </div>

      {/* Countdown */}
      <div className="text-right">
        <span className={`text-[11px] font-semibold tabular-nums ${isUrgent ? 'text-red-400' : 'text-white/45'}`}>
          {cd}
        </span>
      </div>

      {/* Action — hidden on mobile (whole row is tappable) */}
      <div className="hidden md:flex justify-end">
        <span className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg border border-white/10 text-white/30 group-hover:border-[var(--accent-blue)]/50 group-hover:text-[var(--accent-blue)] group-hover:bg-[var(--accent-blue)]/5 active:scale-90 transition-all duration-200 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
        </span>
      </div>
    </Link>
  );
}
