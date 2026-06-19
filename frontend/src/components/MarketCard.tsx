'use client';

import { formatVolume, formatPercent, countdown, getProbabilityColor } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

interface MarketCardProps {
  market: any;
  onClick?: () => void;
}

function safeParseJson(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

export function MarketCard({ market, onClick }: MarketCardProps) {
  const { t, locale } = useTranslation();
  // 优先使用翻译后的中文内容
  const rawOutcomes = safeParseJson(market.outcomes_zh || market.outcomes);
  const outcomes = Array.isArray(rawOutcomes) ? rawOutcomes : safeParseJson(market.outcomes);
  const prices = safeParseJson(market.outcomePrices).map((p: any) => parseFloat(p));
  const volume24h = parseFloat(market.volume24hr || market.volume || '0');
  const isBinary = outcomes.length === 2;

  // 获取标签
  const tags = Array.isArray(market.tags) ? market.tags.slice(0, 2) : [];
  const category = tags[0]?.label || t('general.general');

  return (
    <div
      onClick={onClick}
      className="group relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 cursor-pointer hover:border-[var(--accent-cyan)]/30 hover:ring-1 hover:ring-[var(--accent-cyan)]/20 card-hover animate-fade-in overflow-hidden"
    >
      {/* 分类标签 */}
      <div className="flex items-center gap-2 mb-3 relative">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[var(--accent-blue)]/15 to-[var(--accent-purple)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 font-semibold uppercase tracking-wider">
          {category}
        </span>
        {market.endDate && (
          <span className="text-[10px] text-[var(--text-muted)]">
            {countdown(market.endDate, locale)}
          </span>
        )}
      </div>

      {/* 标题 */}
      <h3 className="text-sm font-medium leading-snug mb-3 line-clamp-2 group-hover:text-[var(--accent-cyan)] transition-colors duration-200 relative">
        {market.question_zh || market.title_zh || market.question || market.title}
      </h3>

      {/* 二元结果概率进度条 */}
      {isBinary ? (
        <div className="mb-3">
          {/* 标签行：标签 + 百分比 */}
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_6px_rgba(34,197,94,0.5)] shrink-0" />
              <span className="text-xs text-[var(--text-secondary)] truncate">{outcomes[0]}</span>
              <span className="text-xs font-bold text-[var(--green)] tabular-nums shrink-0">{formatPercent(prices[0])}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0 ml-2">
              <span className="text-xs font-bold text-[var(--red)] tabular-nums shrink-0">{formatPercent(prices[1])}</span>
              <span className="text-xs text-[var(--text-secondary)] truncate">{outcomes[1]}</span>
              <span className="w-2 h-2 rounded-full bg-[var(--red)] shadow-[0_0_6px_rgba(239,68,68,0.5)] shrink-0" />
            </div>
          </div>
          {/* 分段进度条 */}
          <div className="relative h-4 bg-[var(--bg-secondary)] rounded-full overflow-hidden shadow-inner">
            <div
              className="absolute inset-y-0 left-0 rounded-l-full animate-fill-bar"
              style={{
                width: `${Math.max(prices[0] * 100, 2)}%`,
                background: 'linear-gradient(90deg, #22c55e, #16a34a)',
              }}
            />
            <div
              className="absolute inset-y-0 right-0 rounded-r-full"
              style={{
                width: `${Math.max((1 - prices[0]) * 100, 2)}%`,
                background: 'linear-gradient(90deg, #dc2626, #ef4444)',
              }}
            />
          </div>
        </div>
      ) : (
        // 多选项市场
        <div className="space-y-1.5 mb-3 relative">
          {outcomes.slice(0, 4).map((outcome: string, i: number) => (
            <div key={i} className="flex justify-between items-center text-xs group/item">
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

      {/* 底部信息 */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)] group-hover:border-[var(--border-light)] transition-colors relative">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span className="font-semibold text-[var(--text-secondary)]">{formatVolume(volume24h)}</span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--accent-cyan)]/60 transition-colors">
          {t('card.24hVolume')}
        </div>
      </div>
    </div>
  );
}
