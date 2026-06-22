'use client';

import Link from 'next/link';
import { formatVolume, formatPercent, countdown, getProbabilityColor } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

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

  // ── Gradient Cover 2.0 ──
  // Each market gets a unique dual-tone gradient from its ID hash
  const hash = [...(market.id || '0')].reduce((s, c) => s + c.charCodeAt(0), 0);
  const categoryHueBase: Record<string, number> = {
    sports: 150, politics: 210, crypto: 40, technology: 270,
    science: 190, entertainment: 330, world: 200, economy: 30, business: 30,
  };
  const hueBase = categoryHueBase[categorySlug] || (hash * 7) % 360;
  const hue1 = hueBase + (hash % 40) - 20;
  const hue2 = hue1 + (hash % 60) - 30;
  const sat = 60 + (hash % 30);
  const light = 16 + (hash % 10);
  const color1 = `hsl(${hue1},${sat}%,${light}%)`;
  const color2 = `hsl(${hue2},${sat - 10}%,${light + 6}%)`;
  const accent = `hsl(${hue1},${sat + 20}%,${light + 25}%)`;

  const pattern = hash % 4; // 0=stripes, 1=dots, 2=waves, 3=rings
  const angle = (hash * 37) % 360;
  const emoji = CATEGORY_EMOJI[categorySlug] || '📊';

  const cardContent = (
    <>
      {/* Cover — dual-tone gradient with per-card geometry */}
      <div className="relative w-full h-36 sm:h-40 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id={`g-${market.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
            {pattern === 0 && (
              <pattern id={`p-${market.id}`} patternUnits="userSpaceOnUse" width="60" height="60" patternTransform={`rotate(${angle})`}>
                <rect width="24" height="60" fill="white" opacity="0.04" />
              </pattern>
            )}
            {pattern === 1 && (
              <pattern id={`p-${market.id}`} patternUnits="userSpaceOnUse" width="44" height="44">
                <circle cx="22" cy="22" r={5 + (hash % 4)} fill="white" opacity="0.05" />
              </pattern>
            )}
            {pattern === 3 && (
              <pattern id={`p-${market.id}`} patternUnits="userSpaceOnUse" width="90" height="50" patternTransform={`rotate(${angle % 30})`}>
                <path d="M0,25 Q45,-10 90,25" fill="none" stroke="white" strokeWidth="1.5" opacity="0.05" />
              </pattern>
            )}
          </defs>
          <rect width="800" height="450" fill={`url(#g-${market.id})`} />
          {pattern !== 2 && <rect width="800" height="450" fill={`url(#p-${market.id})`} />}
          {pattern === 2 && (
            <>
              <circle cx={200 + (hash % 200)} cy={180 + (hash % 100)} r={100} fill="none" stroke="white" strokeWidth="2" opacity="0.05" />
              <circle cx={550 - (hash % 200)} cy={280 - (hash % 100)} r={70} fill="none" stroke="white" strokeWidth="1" opacity="0.04" />
            </>
          )}
          {/* Emoji watermark */}
          <text x={400 + (hash % 200) - 100} y={240 + (hash % 80) - 40} textAnchor="middle" fontSize="80" opacity="0.18" fill={accent}>
            {emoji}
          </text>
        </svg>

        {/* Gradient overlay - bottom fade for title readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />

        {/* Gradient overlay - bottom fade for title readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {/* Top fade for badges */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />

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

      {/* Card body */}
      <div className="p-3.5 sm:p-4 space-y-3">
        {/* Countdown & info */}
        {market.endDate && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
              </svg>
              {countdown(market.endDate, locale)}
            </span>
            {market.outcomeCount > 2 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/20">
                {market.outcomeCount} {t('card.moreOptions')}
              </span>
            )}
          </div>
        )}

        {/* Outcomes */}
        {isBinary ? (
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_6px_rgba(16,185,129,0.5)] shrink-0" />
                <span className="text-[11px] text-[var(--text-secondary)] truncate">{outcomes[0]}</span>
                <span className="text-[11px] font-bold text-[var(--green)] tabular-nums shrink-0 ml-auto">{formatPercent(prices[0])}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 ml-3">
                <span className="text-[11px] font-bold text-[var(--red)] tabular-nums shrink-0">{formatPercent(prices[1])}</span>
                <span className="text-[11px] text-[var(--text-secondary)] truncate">{outcomes[1]}</span>
                <span className="w-2 h-2 rounded-full bg-[var(--red)] shadow-[0_0_6px_rgba(239,68,68,0.5)] shrink-0" />
              </div>
            </div>
            <div className="relative h-3 bg-[var(--bg-hover)] rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#22c55e] to-[#16a34a] rounded-l-full transition-all duration-700"
                style={{ width: `${Math.max(prices[0] * 100, 2)}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-gradient-to-r from-[#dc2626] to-[#ef4444] rounded-r-full transition-all duration-700"
                style={{ width: `${Math.max((1 - prices[0]) * 100, 2)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {outcomes.slice(0, 4).map((outcome: string, i: number) => (
              <div key={i} className="flex justify-between items-center text-[11px] group/item">
                <span className="text-[var(--text-secondary)] truncate flex-1 mr-2 group-hover/item:text-[var(--text-primary)] transition-colors">{outcome}</span>
                <span className="tabular-nums font-semibold" style={{ color: getProbabilityColor(prices[i] || 0) }}>
                  {formatPercent(prices[i] || 0)}
                </span>
              </div>
            ))}
            {outcomes.length > 4 && (
              <div className="text-[10px] text-[var(--text-muted)] pt-0.5">
                +{outcomes.length - 4} {t('card.moreOptions')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hover shimmer */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
