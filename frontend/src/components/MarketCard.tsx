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

  // Deterministic random from market ID (0-99)
  // Category-based color scheme
  const categoryColors: Record<string, { bg: string; accent: string; emoji: string }> = {
    sports: { bg: '#064e3b', accent: '#34d399', emoji: '⚽' },
    politics: { bg: '#1e3a5f', accent: '#60a5fa', emoji: '🏛️' },
    crypto: { bg: '#78350f', accent: '#f59e0b', emoji: '₿' },
    technology: { bg: '#3b0764', accent: '#a78bfa', emoji: '🔬' },
    science: { bg: '#0c4a6e', accent: '#22d3ee', emoji: '🔭' },
    entertainment: { bg: '#4c0519', accent: '#f43f5e', emoji: '🎬' },
    world: { bg: '#172554', accent: '#38bdf8', emoji: '🌍' },
    economy: { bg: '#1c1917', accent: '#a8a29e', emoji: '📊' },
    business: { bg: '#1c1917', accent: '#a8a29e', emoji: '💼' },
  };
  const colors = categoryColors[categorySlug] || categoryColors.sports;
  const seedNum = parseInt(market.id || '0', 10) % 100;
  const patternType = seedNum % 4; // 0=stripes, 1=dots, 2=rings, 3=waves
  const r1 = (seedNum * 17) % 360;
  const r2 = (seedNum * 41) % 360;
  const cx1 = 100 + (seedNum * 7) % 300;
  const cy1 = 80 + (seedNum * 11) % 200;
  const cx2 = 400 + (seedNum * 13) % 250;
  const cy2 = 250 + (seedNum * 19) % 150;
  const emojiX = 140 + (seedNum * 23) % 520;
  const emojiY = 170 + (seedNum * 31) % 150;
  const emojiRot = (seedNum * 13) % 30 - 15;

  // Build SVG pattern — 4 distinct styles for variety
  const svgPattern = (() => {
    switch (patternType) {
      case 0: // Diagonal stripes
        return (
          <pattern id={`p-${market.id}`} patternUnits="userSpaceOnUse" width="80" height="80" patternTransform={`rotate(${r1})`}>
            <rect width="30" height="80" fill={colors.accent} opacity="0.07" />
          </pattern>
        );
      case 1: // Dot grid
        return (
          <pattern id={`p-${market.id}`} patternUnits="userSpaceOnUse" width="50" height="50" patternTransform={`rotate(${r1 % 45})`}>
            <circle cx="25" cy="25" r={6 + (seedNum % 5)} fill={colors.accent} opacity="0.08" />
          </pattern>
        );
      case 2: // Concentric rings
        return null; // handled inline
      default: // Diagonal crosshatch (waves feel)
        return (
          <pattern id={`p-${market.id}`} patternUnits="userSpaceOnUse" width="100" height="60" patternTransform={`rotate(${r1})`}>
            <path d="M0,30 Q50,0 100,30" fill="none" stroke={colors.accent} strokeWidth="2" opacity="0.06" />
          </pattern>
        );
    }
  })();

  // SVG body
  const svgBody = patternType === 2 ? (
    // Concentric rings
    <>
      {[0, 1, 2, 3].map(i => (
        <circle key={i} cx={400 + (i % 2 ? 100 : -100)} cy={225 + (i > 1 ? 80 : -80)} r={120 + i * 40} fill="none" stroke={colors.accent} strokeWidth={1 + i} opacity={0.06 - i * 0.01} />
      ))}
    </>
  ) : (
    <>
      <rect width="800" height="450" fill={`url(#p-${market.id})`} />
      {/* Decorative blobs */}
      <circle cx={cx1} cy={cy1} r={50 + (seedNum % 60)} fill={colors.accent} opacity="0.05" />
      <circle cx={cx2} cy={cy2} r={30 + (seedNum % 50)} fill={colors.accent} opacity="0.07" />
    </>
  );

  // Premium gradient fallback per category
  const fallbackGradients: Record<string, string> = {
    sports: 'from-emerald-900/80 via-emerald-800/40 to-[var(--bg-secondary)]',
    politics: 'from-blue-900/80 via-indigo-800/40 to-[var(--bg-secondary)]',
    crypto: 'from-amber-900/80 via-orange-800/40 to-[var(--bg-secondary)]',
    technology: 'from-purple-900/80 via-violet-800/40 to-[var(--bg-secondary)]',
    science: 'from-cyan-900/80 via-teal-800/40 to-[var(--bg-secondary)]',
    entertainment: 'from-pink-900/80 via-rose-800/40 to-[var(--bg-secondary)]',
    world: 'from-sky-900/80 via-blue-800/40 to-[var(--bg-secondary)]',
    business: 'from-slate-900/80 via-zinc-800/40 to-[var(--bg-secondary)]',
  };
  const fallbackGradient = fallbackGradients[categorySlug] || 'from-[var(--accent-blue)]/20 via-[var(--accent-purple)]/10 to-[var(--bg-secondary)]';

  const cardContent = (
    <>
      {/* Cover image — SVG generated, zero external dependency */}
      <div className="relative w-full h-36 sm:h-40 overflow-hidden" style={{ backgroundColor: colors.bg }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
          <defs>
            {svgPattern}
            <linearGradient id={`grad-${market.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colors.accent} stopOpacity="0.12" />
              <stop offset="100%" stopColor={colors.accent} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {svgBody}
          <rect width="800" height="450" fill={`url(#grad-${market.id})`} />
          {/* Emoji at randomized position */}
          <text x={emojiX} y={emojiY} textAnchor="middle" fontSize="72" opacity="0.35" transform={`rotate(${emojiRot} ${emojiX} ${emojiY})`}>
            {CATEGORY_EMOJI[categorySlug] || '📊'}
          </text>
        </svg>

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
