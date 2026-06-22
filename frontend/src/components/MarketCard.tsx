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

  // ── Generative cover art (no images) ──
  // Each card gets a unique abstract composition from market.id
  const sid = parseInt(market.id || '0', 10);
  const comp = sid % 5; // 0=stripes, 1=blocks, 2=concentric, 3=diagonal, 4=grid
  const h = sid % 360;  // hue shift within category band

  // Category color bands in OKLCH — each gets a range to vary within
  const catBand: Record<string, [number, number]> = {
    sports: [140, 170], politics: [210, 250], crypto: [30, 60],
    technology: [260, 300], entertainment: [320, 350], world: [190, 220],
    economy: [80, 110], business: [80, 110], science: [180, 210],
  };
  const [hMin, hMax] = catBand[categorySlug] || [0, 360];
  const hue = hMin + (h % (hMax - hMin));
  const hue2 = hue + 20 + (h % 30);

  // OKLCH colors — low chroma for dark backgrounds, high chroma for accents
  const bg = `oklch(18% 0.02 ${hue})`;
  const bg2 = `oklch(22% 0.03 ${hue2})`;
  const accent = `oklch(55% 0.15 ${hue})`;
  const accentDim = `oklch(35% 0.06 ${hue})`;
  const line = `oklch(45% 0.04 ${hue})`;

  const cardContent = (
    <>
      {/* Cover — generative abstract composition */}
      <div className="relative w-full h-36 sm:h-40 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id={`bg-${market.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={bg} /><stop offset="100%" stopColor={bg2} />
            </linearGradient>
            {/* Noise filter */}
            <filter id={`n-${market.id}`}><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          </defs>
          {/* Base */}
          <rect width="800" height="450" fill={`url(#bg-${market.id})`} />
          {/* Noise texture overlay */}
          <rect width="800" height="450" filter={`url(#n-${market.id})`} opacity="0.03" />
          {/* Grid lines — terminal feel */}
          {Array.from({length:6}).map((_,i) => (
            <line key={`v${i}`} x1={120+i*130} y1="0" x2={120+i*130} y2="450" stroke={line} strokeWidth="0.5" opacity="0.08" />
          ))}
          {Array.from({length:4}).map((_,i) => (
            <line key={`h${i}`} x1="0" y1={100+i*110} x2="800" y2={100+i*110} stroke={line} strokeWidth="0.5" opacity="0.08" />
          ))}
          {/* Composition elements */}
          {comp === 0 && ( // Stripes — asymmetric vertical bands
            <>
              {[40, 180, 520, 660].map((x, i) => (
                <rect key={i} x={x} y="0" width="60" height="450" fill={accentDim} opacity={0.12 - i*0.02} />
              ))}
              <rect x="0" y={320+(h%80)} width="800" height="4" fill={accent} opacity="0.15" />
            </>
          )}
          {comp === 1 && ( // Blocks — abstract Mondrian-esque
            <>
              <rect x="0" y="0" width={180+(h%200)} height={200+(h%100)} fill={accentDim} opacity="0.1" />
              <rect x={500-(h%100)} y={250-(h%80)} width={200+(h%120)} height="0" stroke={accent} strokeWidth="3" opacity="0.12" /><rect x={500-(h%100)} y={250-(h%80)} width={200+(h%120)} height={100+(h%80)} fill={accentDim} opacity="0.06" />
              <rect x={100+(h%300)} y="20" width="3" height="130" fill={accent} opacity="0.1" />
            </>
          )}
          {comp === 2 && ( // Concentric
            <>
              {[0,1,2,3].map(i => (
                <circle key={i} cx={400+(h%200)-100} cy={220+(h%100)-50} r={60+i*50} fill="none" stroke={i===0?accent:accentDim} strokeWidth={i===0?2:1} opacity={0.1-i*0.02} />
              ))}
            </>
          )}
          {comp === 3 && ( // Diagonal slash
            <>
              <polygon points={`0,0 ${120+(h%200)},0 0,${300+(h%150)}`} fill={accentDim} opacity="0.08" />
              <polygon points={`800,450 ${680-(h%200)},450 800,${150-(h%150)}`} fill={accentDim} opacity="0.06" />
              <line x1="0" y1={350+(h%100)} x2="800" y2={100+(h%100)} stroke={accent} strokeWidth="1.5" opacity="0.1" />
            </>
          )}
          {comp === 4 && ( // Grid spotlight
            <>
              <rect x={(h%300)} y={(h%200)} width="160" height="160" fill="none" stroke={accent} strokeWidth="1" opacity="0.08" />
              <rect x={(h%300)+40} y={(h%200)+40} width="80" height="80" fill="none" stroke={accent} strokeWidth="2" opacity="0.12" />
              <circle cx={(h%300)+80} cy={(h%200)+80} r="20" fill={accent} opacity="0.12" />
            </>
          )}
          {/* Thin top accent line */}
          <rect x="0" y="0" width="800" height="2" fill={accent} opacity="0.2" />
        </svg>

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
