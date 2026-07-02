'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatVolume, formatPercent, countdown, getProbabilityColor } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';
import { api } from '@/lib/api';

// Shared image pool — fetched once, shared across all cards on the page
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

interface MarketCardProps {
  market: any;
  href?: string;
  onClick?: () => void;
}

function safeParseJson(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

const CATEGORY_EMOJI: Record<string, string> = {
  sports: '⚽',
  politics: '🏛️',
  crypto: '₿',
  science: '🔬',
  technology: '🔬',
  world: '🌍',
  entertainment: '🎬',
  business: '💼',
  economics: '💼',
};

export function MarketCard({ market, href, onClick }: MarketCardProps) {
  const { t, locale } = useTranslation();

  const rawOutcomes = safeParseJson(
    locale === 'zh'
      ? (market.outcomes_zh || market.outcomes)
      : (market.outcomes || market.outcomes_zh)
  );
  const outcomes = Array.isArray(rawOutcomes) ? rawOutcomes : safeParseJson(market.outcomes);
  const prices = safeParseJson(market.outcomePrices).map((p: any) => parseFloat(p));
  const volume24h = parseFloat(market.volume24hr || market.volume || '0');
  const isBinary = outcomes.length === 2;

  const question = locale === 'zh'
    ? (market.question_zh || market.title_zh || market.question || market.title)
    : (market.question || market.title || market.question_zh || market.title_zh);

  const tags = Array.isArray(market.tags) ? market.tags : [];
  const category = tags[0]?.label || '';
  const categorySlug = (tags[0]?.slug || '').toLowerCase();

  // Image pool — pick by market.id index, never repeats within the page
  const pool = useImagePool();
  const imageUrl = (() => {
    if (pool && pool.length > 0) {
      const idx = parseInt(market.id || '0', 10) % pool.length;
      return pool[idx].url;
    }
    // Fallback while pool loads — uses category keyword
    const seed = market.id?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'fallback';
    const catSlug = (tags[0]?.slug || tags[0]?.label || '').toLowerCase();
    return catSlug
      ? `https://loremflickr.com/800/450/${catSlug}?lock=${seed}`
      : `https://loremflickr.com/800/450?lock=${seed}`;
  })();

  const cardContent = (
    <>
      {/* Cover — Pixabay real photo from shared pool */}
      <div className="relative w-full h-36 sm:h-40 overflow-hidden bg-[var(--bg-secondary)]">
        <img
          src={imageUrl}
          alt={question}
          width={800}
          height={450}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Polymarket-style: big percentage on the cover */}
        {isBinary && prices[0] > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-end gap-0.5">
            <span className="text-4xl sm:text-5xl font-black tabular-nums leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] font-display">
              {Math.round(prices[0] * 100)}<span className="text-lg opacity-60">%</span>
            </span>
            <span className="text-[10px] text-white/60 truncate max-w-[120px] text-right leading-tight">
              {outcomes[0]}
            </span>
          </div>
        )}

        {/* Bottom fade for title */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

        {/* 已结束遮罩 */}
        {market.closed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <span className="px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm text-white/90 text-sm font-semibold tracking-wide border border-white/20">
              {t('time.ended')}
            </span>
          </div>
        )}

        {/* Category badge */}
        {category && (
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-gray-900 font-semibold shadow-sm">
              {CATEGORY_EMOJI[categorySlug] || '📊'} {category}
            </span>
          </div>
        )}

        {/* Volume badge */}
        {volume24h > 0 && (
          <div className="absolute top-3 right-3 z-10">
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white font-semibold tabular-nums shadow-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
              {formatVolume(volume24h)}
            </span>
          </div>
        )}

        {/* Title on cover */}
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] group-hover:text-white/90 transition-colors duration-200 font-display">
            {question}
          </h3>
        </div>
      </div>

      {/* Card body — simplified, key data on cover */}
      <div className="p-3 sm:p-3.5 space-y-2">
        {/* Countdown & tags */}
        <div className="flex items-center justify-between gap-2">
          {market.endDate && (
            <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
              </svg>
              {countdown(market.endDate, locale)}
            </span>
          )}
          {volume24h > 0 && (
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
              {formatVolume(volume24h)} vol
            </span>
          )}
        </div>

        {/* Probability bar (binary) */}
        {isBinary && (
          <div className="relative h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-white/70 rounded-l-full transition-all duration-700"
              style={{ width: `${Math.max(prices[0] * 100, 3)}%` }}
            />
          </div>
        )}

        {/* Multi-outcome labels */}
        {!isBinary && outcomes.length > 0 && (
          <div className="space-y-0.5">
            {outcomes.slice(0, 3).map((outcome: string, i: number) => (
              <div key={i} className="flex justify-between items-center text-[10px]">
                <span className="text-[var(--text-muted)] truncate flex-1 mr-2">{outcome}</span>
                <span className="tabular-nums font-medium" style={{ color: getProbabilityColor(prices[i] || 0) }}>
                  {formatPercent(prices[i] || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hover shimmer */}
      <div className="absolute inset-0 rounded-xl bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </>
  );

  // Navigate to detail page when href is provided
  if (href) {
    return (
      <Link
        href={href}
        className="group block relative w-full text-left bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden cursor-pointer hover:border-white/10 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:outline-none animate-fade-in transition-all duration-300"
      >
        {cardContent}
      </Link>
    );
  }

  // Fallback to button for backward compatibility
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden cursor-pointer hover:border-white/10 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:outline-none animate-fade-in transition-all duration-300"
    >
      {cardContent}
    </button>
  );
}
