'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatPrice, formatPercent, getProbabilityColor } from '@/lib/utils';
import { useApp } from './Providers';
import { useRealtimePrice } from '@/hooks/useRealtimePrice';
import { useTranslation } from '@/i18n/I18nProvider';

// ---- 过期时间选项 ----
const EXPIRY_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'GTC', labelKey: 'trade.expiryGTC' },
  { value: '24h', labelKey: 'trade.expiry24h' },
  { value: '1h', labelKey: 'trade.expiry1h' },
  { value: '15m', labelKey: 'trade.expiry15m' },
];

interface TradingPanelProps {
  market: any;
}

export function TradingPanel({ market }: TradingPanelProps) {
  const { user } = useApp();
  const { t, locale } = useTranslation();

  // ---- 核心状态 ----
  const [selectedOutcome, setSelectedOutcome] = useState<number>(0); // 0=Yes, 1=No
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderMode, setOrderMode] = useState<'limit' | 'market'>('limit');
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [expiry, setExpiry] = useState('GTC');
  const [loading, setLoading] = useState(false);
  const [feeInfo, setFeeInfo] = useState<any>(null);
  const [tickSize, setTickSize] = useState<number>(0.01);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ---- 数据解析 ----
  const safeJson = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
    return [];
  };

  const outcomes = safeJson(
    locale === 'zh'
      ? (market.outcomes_zh || market.outcomes)
      : (market.outcomes || market.outcomes_zh)
  );
  const prices = safeJson(market.outcomePrices).map((p: any) => parseFloat(p));
  const clobTokens = safeJson(market.clobTokenIds);
  const tokenId = clobTokens[selectedOutcome] || clobTokens[0];

  const marketTags = (market.tags || [])
    .map((t: any) => typeof t === 'string' ? t : (t.label || t.slug || ''))
    .filter(Boolean);

  // ---- 实时价格 ----
  const { price: realtimePrice } = useRealtimePrice(tokenId);

  // ---- 获取费用/配置 ----
  useEffect(() => {
    api.getFeeInfo(marketTags.length > 0 ? marketTags.join(',') : undefined)
      .then((res: any) => setFeeInfo(res.data)).catch(() => {});
    if (tokenId) {
      api.getMarketConfig(tokenId)
        .then((res: any) => {
          if (res.data?.tickSize) {
            const ts = parseFloat(res.data.tickSize);
            if (!isNaN(ts) && ts > 0) setTickSize(ts);
          }
        }).catch(() => {});
    }
  }, [tokenId]);

  // ---- 当前选中结果的价格 ----
  const currentPrice = prices[selectedOutcome] || 0;
  const currentOutcomeLabel = outcomes[selectedOutcome] || (selectedOutcome === 0 ? t('trade.yes') : t('trade.no'));

  // ---- 费用计算 ----
  const feeRate = feeInfo?.feeRate ?? 0.005;
  const isMarket = orderMode === 'market';
  const numPrice = parseFloat(price || '0');
  const numShares = parseInt(shares || '0', 10);

  // 市价单：用成交量乘价格；限价单：份额乘价格
  const calcFee = useCallback((): number => {
    if (isMarket) return numShares * currentPrice * feeRate;
    return numShares * numPrice * feeRate;
  }, [isMarket, numShares, numPrice, currentPrice, feeRate]);

  const estimatedFee = calcFee();

  const total = useMemo(() => {
    if (isMarket) return numShares * currentPrice;
    return numShares * numPrice;
  }, [isMarket, numShares, numPrice, currentPrice]);

  const avgPriceDisplay = useMemo(() => {
    return isMarket ? currentPrice : numPrice;
  }, [isMarket, currentPrice, numPrice]);

  const potentialPayout = useMemo(() => {
    if (side === 'BUY') {
      // 买入：赢取 = 份额 × $1 - 总花费
      return numShares - total;
    } else {
      // 卖出：回报 = 总花费（卖出份额所得）- 若对则要付 $1/股
      const maxLiability = numShares * (1 - avgPriceDisplay);
      return total - maxLiability;
    }
  }, [side, numShares, total, avgPriceDisplay]);

  const canSubmit = useMemo(() => {
    if (!user || loading) return false;
    if (isMarket) return !!(tokenId && numShares > 0);
    return !!(tokenId && numShares > 0 && numPrice > 0 && numPrice < 1);
  }, [user, loading, isMarket, tokenId, numShares, numPrice]);

  // ---- Toast ----
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ---- 价格步进 ----
  const adjustPrice = (delta: number) => {
    const current = parseFloat(price || String(currentPrice)) || 0;
    const newVal = Math.max(tickSize, Math.min(0.99, current + delta));
    setPrice(newVal.toFixed(4));
  };

  // ---- 份额快捷调整 ----
  const adjustShares = (delta: number) => {
    const current = parseInt(shares || '0', 10);
    setShares(String(Math.max(1, current + delta)));
  };

  // ---- 下单 ----
  const handleTrade = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const gtcMap: Record<string, string> = { GTC: 'GTC', '24h': 'GTC', '1h': 'IOC', '15m': 'IOC' };
      const payload: any = {
        tokenId,
        side,
        outcomeIndex: selectedOutcome,
        tags: marketTags,
        idempotencyKey: crypto.randomUUID(),
      };
      if (isMarket) {
        payload.amount = numShares;
        payload.orderType = 'MARKET_FAK';
      } else {
        payload.size = numShares;
        payload.price = numPrice;
        payload.orderType = gtcMap[expiry] || 'GTC';
      }
      const result: any = await api.placeOrder(payload);
      setShares('');
      if (!isMarket) setPrice('');
      const demoTag = result.data?.demo ? ` [${t('home.demo')}]` : '';
      showToast('success', `${side === 'BUY' ? t('market.buy') : t('market.sell')} ${t('trade.success')}!${demoTag}`);
    } catch (err: any) {
      showToast('error', err.message || t('trade.tradeFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!market) return null;

  const showSummary = (isMarket && numShares > 0) || (!isMarket && numShares > 0 && numPrice > 0);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className={`absolute top-2 left-2 right-2 z-10 px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green)]/20'
            : 'bg-[var(--red-bg)] text-[var(--red)] border border-[var(--red)]/20'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 演示模式提示 */}
      {feeInfo?.demo && (
        <div className="px-4 py-1.5 text-[10px] text-center bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] border-b border-[var(--accent-amber)]/20 flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)] animate-pulse" />
          {t('trade.demoWarning')}
        </div>
      )}

      {/* ---- 面板标题 ---- */}
      <div className="p-4 border-b border-[var(--border)] bg-gradient-to-b from-[var(--accent-blue)]/3 to-transparent">
        <h3 className="text-sm font-bold leading-snug text-[var(--text-bright)] line-clamp-2">
          {locale === 'zh' ? (market.question_zh || market.question) : (market.question || market.question_zh)}
        </h3>
      </div>

      {/* ---- 结果选择 Yes / No ---- */}
      <div className="p-4 border-b border-[var(--border)]">
        <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-semibold">
          {t('trade.outcome')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((idx) => {
            const label = outcomes[idx] || (idx === 0 ? t('trade.yes') : t('trade.no'));
            const prob = prices[idx] || 0;
            const isSelected = selectedOutcome === idx;
            const color = getProbabilityColor(prob);
            return (
              <button
                key={idx}
                onClick={() => setSelectedOutcome(idx)}
                className={`relative py-3 px-3 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                  isSelected
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--text-bright)] shadow-[0_0_12px_var(--accent-blue)/20]'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/5'
                }`}
              >
                <div className="text-xs mb-0.5">{label}</div>
                <div className="text-lg tabular-nums font-bold" style={{ color: isSelected ? 'var(--accent-blue)' : color }}>
                  {formatPrice(prob)}
                </div>
              </button>
            );
          })}
        </div>
        {/* 概率条 */}
        <div className="mt-3 h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden flex">
          <div
            className="h-full transition-all duration-500 rounded-l-full"
            style={{
              width: `${Math.max((prices[0] || 0) * 100, 2)}%`,
              background: 'linear-gradient(90deg, #22c55e, #22c55ecc)',
            }}
          />
          <div
            className="h-full transition-all duration-500 rounded-r-full"
            style={{
              width: `${Math.max((prices[1] || 0) * 100, 2)}%`,
              background: 'linear-gradient(90deg, #ef4444cc, #ef4444)',
            }}
          />
        </div>
      </div>

      {/* ---- 买入 / 卖出 切换 ---- */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setSide('BUY')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-300 relative ${
            side === 'BUY'
              ? 'bg-[var(--green-bg)] text-[var(--green)] shadow-[inset_0_-2px_0_var(--green)]'
              : 'text-[var(--text-muted)] hover:text-[var(--green)] hover:bg-[var(--green-bg)]/50'
          }`}
        >
          {t('trade.buyTab')} {outcomes[selectedOutcome] || (selectedOutcome === 0 ? t('trade.yes') : t('trade.no'))}
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-300 relative ${
            side === 'SELL'
              ? 'bg-[var(--red-bg)] text-[var(--red)] shadow-[inset_0_-2px_0_var(--red)]'
              : 'text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--red-bg)]/50'
          }`}
        >
          {t('trade.sellTab')} {outcomes[selectedOutcome] || (selectedOutcome === 0 ? t('trade.yes') : t('trade.no'))}
        </button>
      </div>

      {/* ---- 限价单 / 市价单 ---- */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)]/30">
        {(['limit', 'market'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => { setOrderMode(mode); setPrice(''); }}
            className={`flex-1 py-2 text-xs font-medium transition-all duration-200 ${
              orderMode === mode
                ? 'text-[var(--accent-blue)] border-b-2 border-[var(--accent-blue)] bg-[var(--accent-blue)]/5'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {mode === 'limit' ? t('trade.limitOrder') : t('trade.marketOrder')}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* ---- 过期时间（限价单） ---- */}
        {orderMode === 'limit' && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block font-semibold">
              {t('trade.expiration')}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {EXPIRY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExpiry(opt.value)}
                  className={`py-1.5 text-[10px] font-medium rounded-md transition-all duration-200 ${
                    expiry === opt.value
                      ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--accent-blue)]/30'
                  }`}
                >
                  {t(opt.labelKey as any)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---- 市价单说明 ---- */}
        {orderMode === 'market' && (
          <div className="bg-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/15 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)]">
            💡 {t('trade.marketOrderDesc')}
          </div>
        )}

        {/* ---- 价格输入（限价单） ---- */}
        {orderMode === 'limit' && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block font-semibold">
              {t('trade.pricePerShare')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => adjustPrice(-tickSize)}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/50 hover:text-[var(--accent-blue)] transition-all active:scale-95 text-sm font-mono"
              >
                −
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step={String(tickSize)}
                  min={String(tickSize)}
                  max="0.99"
                  placeholder={currentPrice.toFixed(4)}
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-center font-mono focus:outline-none focus:border-[var(--accent-blue)] focus:shadow-[0_0_10px_rgba(79,143,255,0.1)] transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
                  USDC
                </span>
              </div>
              <button
                onClick={() => adjustPrice(tickSize)}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/50 hover:text-[var(--accent-blue)] transition-all active:scale-95 text-sm font-mono"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* ---- 份额输入 ---- */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block font-semibold">
            {isMarket ? t('trade.marketAmount') : t('trade.shareAmount')}
          </label>
          <div className="relative">
            <input
              type="number"
              step="1"
              min="1"
              placeholder="10"
              value={shares}
              onChange={e => setShares(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-center font-mono focus:outline-none focus:border-[var(--accent-blue)] focus:shadow-[0_0_10px_rgba(79,143,255,0.1)] transition-all"
            />
          </div>
          {/* 快捷调整按钮 */}
          <div className="flex gap-1 mt-2">
            {[-100, -10, 10, 100].map(delta => (
              <button
                key={delta}
                onClick={() => adjustShares(delta)}
                className={`flex-1 py-1 text-[10px] font-medium rounded-md border transition-all active:scale-95 ${
                  delta > 0
                    ? 'border-[var(--green)]/40 text-[var(--green)] bg-[var(--green-bg)]/50 hover:bg-[var(--green-bg)]'
                    : 'border-[var(--red)]/40 text-[var(--red)] bg-[var(--red-bg)]/50 hover:bg-[var(--red-bg)]'
                }`}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        {/* ---- 费用明细 ---- */}
        {showSummary && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-2 text-xs border border-[var(--border)]">
            {/* 总计 */}
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('trade.total')}</span>
              <span className="tabular-nums font-mono font-semibold text-[var(--text-bright)]">
                ${total.toFixed(2)}
              </span>
            </div>
            {/* 均价 */}
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('trade.avgPrice')}</span>
              <span className="tabular-nums font-mono" style={{ color: getProbabilityColor(avgPriceDisplay) }}>
                {formatPrice(avgPriceDisplay)}
              </span>
            </div>
            {/* 手续费 */}
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">{t('trade.fee')} ({(feeRate * 100).toFixed(1)}%)</span>
              <span className="tabular-nums font-mono text-[var(--text-muted)]">${estimatedFee.toFixed(4)}</span>
            </div>
            {/* 预估回报 */}
            <div className="flex justify-between pt-2 border-t border-[var(--border)]">
              <span className="text-[var(--text-muted)]">{t('trade.potentialPayout')}</span>
              <span className={`tabular-nums font-mono font-bold ${
                potentialPayout > 0 ? 'text-[var(--green)]' : potentialPayout < 0 ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'
              }`}>
                {potentialPayout > 0 ? '+' : ''}{potentialPayout.toFixed(2)} USDC
              </span>
            </div>
          </div>
        )}

        {/* ---- 下单按钮 ---- */}
        <button
          onClick={handleTrade}
          disabled={!canSubmit}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all duration-300 active:scale-[0.97] ${
            side === 'BUY'
              ? 'bg-[var(--gradient-buy)] hover:shadow-[var(--shadow-glow-green)] text-white'
              : 'bg-[var(--gradient-sell)] hover:shadow-[var(--shadow-glow-red)] text-white'
          } disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-none`}
        >
          {!user ? t('trade.connectFirst') : loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" className="opacity-30" />
                <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              {t('trade.processing')}
            </span>
          ) : side === 'BUY' ? t('trade.placeBuyOrder') : t('trade.placeSellOrder')}
        </button>

        {!user && (
          <p className="text-xs text-center text-[var(--text-muted)]">
            {t('trade.connectHint')}
          </p>
        )}
      </div>

      {/* ---- 订单簿 ---- */}
      {realtimePrice && (
        <div className="border-t border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {t('trade.orderBook')}
            </h4>
          </div>
          <div className="space-y-0.5 text-[10px] font-mono">
            {(realtimePrice.asks || []).slice(0, 5).reverse().map((ask: any, i: number) => (
              <div key={`ask-${i}`} className="flex justify-between text-[var(--red)]/80">
                <span>{formatPrice(String(ask.price))}</span>
                <span className="tabular-nums">{Number(ask.size).toFixed(0)}</span>
              </div>
            ))}
            <div className="flex justify-between py-1.5 text-[var(--text-primary)] font-bold border-y border-[var(--border)]/50 my-1">
              <span className="text-[var(--text-muted)] text-[9px]">{t('trade.spread')}</span>
              <span className="tabular-nums text-[var(--accent-cyan)]">
                {realtimePrice.asks?.[0] && realtimePrice.bids?.[0]
                  ? ((Number(realtimePrice.asks[0].price) - Number(realtimePrice.bids[0].price)) * 100).toFixed(1) + '¢'
                  : '—'}
              </span>
            </div>
            {(realtimePrice.bids || []).slice(0, 5).map((bid: any, i: number) => (
              <div key={`bid-${i}`} className="flex justify-between text-[var(--green)]/80">
                <span>{formatPrice(String(bid.price))}</span>
                <span className="tabular-nums">{Number(bid.size).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
