'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatPrice, formatPercent, formatVolume, getProbabilityColor } from '@/lib/utils';
import { useApp } from './Providers';
import { useRealtimePrice } from '@/hooks/useRealtimePrice';
import { useTranslation } from '@/i18n/I18nProvider';

// ---- 订单模式 & 类型 ----
type OrderMode = 'limit' | 'market';
type LimitOrderType = 'GTC' | 'IOC' | 'FOK' | 'Post-Only';
const LIMIT_ORDER_OPTIONS: { value: LimitOrderType; labelKey: string }[] = [
  { value: 'GTC', labelKey: 'trade.orderTypeGTC' },
  { value: 'IOC', labelKey: 'trade.orderTypeIOC' },
  { value: 'FOK', labelKey: 'trade.orderTypeFOK' },
  { value: 'Post-Only', labelKey: 'trade.orderTypePostOnly' },
];

interface TradingPanelProps {
  market: any;
}

export function TradingPanel({ market }: TradingPanelProps) {
  const { user } = useApp();
  const { t } = useTranslation();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [feeInfo, setFeeInfo] = useState<any>(null);
  const [tickSize, setTickSize] = useState<number>(0.01);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // 新增状态
  const [orderMode, setOrderMode] = useState<OrderMode>('limit');
  const [orderType, setOrderType] = useState<LimitOrderType>('GTC');

  const safeJson = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };
  const outcomes = safeJson(market.outcomes_zh || market.outcomes);
  const prices = safeJson(market.outcomePrices).map((p: any) => parseFloat(p));
  const clobTokens = safeJson(market.clobTokenIds);
  const tokenId = clobTokens[0];

  // 使用实时价格 hook（WebSocket + 降级轮询）
  const { price: realtimePrice, connected: wsConnected } = useRealtimePrice(tokenId);

  // 合并实时价格到订单簿展示
  const orderBook = useMemo(() => {
    if (realtimePrice) {
      return {
        bids: realtimePrice.bids,
        asks: realtimePrice.asks,
        spread: realtimePrice.spread,
        midPrice: realtimePrice.midPrice,
      };
    }
    return null;
  }, [realtimePrice]);

  useEffect(() => {
    api.getFeeInfo().then((res: any) => setFeeInfo(res.data)).catch(() => {});

    // 获取市场配置，尤其是 tickSize
    if (tokenId) {
      api.getMarketConfig(tokenId)
        .then((res: any) => {
          if (res.data?.tickSize) {
            const ts = parseFloat(res.data.tickSize);
            if (!isNaN(ts) && ts > 0) setTickSize(ts);
          }
        })
        .catch(() => {});
    }
  }, [tokenId]);

  // ---- 费用计算（与后端 calcSpread 对齐） ----
  const feeRate = feeInfo?.feeRate ?? 0.005;
  const isMarket = orderMode === 'market';
  const numAmount = parseFloat(amount || '0');
  const numPrice = parseFloat(price || '0');

  const calcFee = useCallback((): number => {
    if (isMarket) return numAmount * feeRate;
    return numAmount * numPrice * feeRate;
  }, [isMarket, numAmount, numPrice, feeRate]);

  const estimatedFee = calcFee();

  // 实际支付/收入：limit&market BUY 价格上浮，SELL 价格下浮
  const actualPay = useMemo(() => {
    if (isMarket) return side === 'BUY' ? numAmount + estimatedFee : numAmount - estimatedFee;
    return side === 'BUY'
      ? numAmount * numPrice * (1 + feeRate)
      : numAmount * numPrice * (1 - feeRate);
  }, [isMarket, side, numAmount, numPrice, estimatedFee, feeRate]);

  const canSubmit = useMemo(() => {
    if (!user || loading) return false;
    if (isMarket) return !!(tokenId && numAmount > 0);
    return !!(tokenId && numAmount > 0 && numPrice > 0 && numPrice < 1);
  }, [user, loading, isMarket, tokenId, numAmount, numPrice]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleTrade = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const payload: any = { tokenId, side };
      if (isMarket) {
        payload.amount = numAmount;
        payload.orderType = 'MARKET_FAK';
      } else {
        payload.size = numAmount;
        payload.price = numPrice;
        payload.orderType = orderType;
      }
      const result: any = await api.placeOrder(payload);
      setAmount('');
      if (!isMarket) setPrice('');
      const demoTag = result.data?.demo ? ' [演示]' : '';
      const desc = isMarket
        ? `${t('trade.marketOrder')}${demoTag}`
        : `${numAmount} 份 @ ${numPrice.toFixed(4)} USDC${demoTag}`;
      showToast('success', `${side === 'BUY' ? '买入' : '卖出'}成功！${desc}`);
    } catch (err: any) {
      showToast('error', err.message || '交易失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!market) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden animate-fade-in relative">
      {/* Toast 通知 */}
      {toast && (
        <div className={`absolute top-2 left-2 right-2 z-10 px-3 py-2.5 rounded-lg text-xs font-medium animate-slide-down flex items-center gap-2 ${
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
          ⚠️ 演示模式 — 交易为模拟执行，不会上链
        </div>
      )}

      {/* 交易面板头部 */}
      <div className="p-4 border-b border-[var(--border)] bg-gradient-to-b from-[var(--accent-blue)]/3 to-transparent">
        <h3 className="text-sm font-bold mb-3 leading-snug text-[var(--text-bright)]">{market.question_zh || market.question}</h3>

        {/* 结果选项 */}
        <div className="space-y-2">
          {outcomes.map((outcome: string, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm group/item">
              <span className="text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)] transition-colors">{outcome}</span>
              <span className="tabular-nums font-bold" style={{ color: getProbabilityColor(prices[i]) }}>
                {formatPercent(prices[i])}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 买入/卖出切换 */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setSide('BUY')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-300 relative ${
            side === 'BUY'
              ? 'bg-[var(--green-bg)] text-[var(--green)] shadow-[inset_0_-2px_0_var(--green)]'
              : 'text-[var(--text-muted)] hover:text-[var(--green)] hover:bg-[var(--green-bg)]/50'
          }`}
        >
          {t('trade.buyYes')}
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-all duration-300 relative ${
            side === 'SELL'
              ? 'bg-[var(--red-bg)] text-[var(--red)] shadow-[inset_0_-2px_0_var(--red)]'
              : 'text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--red-bg)]/50'
          }`}
        >
          {t('trade.sellYes')}
        </button>
      </div>

      {/* 订单模式切换：限价单 / 市价单 */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
        <button
          onClick={() => { setOrderMode('limit'); setPrice(''); }}
          className={`flex-1 py-2 text-xs font-medium transition-all duration-200 ${
            orderMode === 'limit'
              ? 'text-[var(--accent-blue)] border-b-2 border-[var(--accent-blue)] bg-[var(--accent-blue)]/5'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {t('trade.limitOrder')}
        </button>
        <button
          onClick={() => { setOrderMode('market'); setPrice(''); }}
          className={`flex-1 py-2 text-xs font-medium transition-all duration-200 ${
            orderMode === 'market'
              ? 'text-[var(--accent-blue)] border-b-2 border-[var(--accent-blue)] bg-[var(--accent-blue)]/5'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {t('trade.marketOrder')}
        </button>
      </div>

      {/* 下单表单 */}
      <div className="p-4 space-y-3">
        {/* 限价单类型选择器 */}
        {orderMode === 'limit' && (
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1.5 block font-medium">{t('trade.orderType')}</label>
            <div className="grid grid-cols-4 gap-1">
              {LIMIT_ORDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setOrderType(opt.value)}
                  className={`py-1.5 text-[10px] font-medium rounded-md transition-all duration-200 ${
                    orderType === opt.value
                      ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--accent-blue)]/30'
                  }`}
                >
                  {opt.value}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 市价单说明 */}
        {orderMode === 'market' && (
          <div className="bg-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/15 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)]">
            💡 {t('trade.marketOrderDesc')}
          </div>
        )}

        {/* 价格输入（仅限价单） */}
        {orderMode === 'limit' && (
          <div>
            <label htmlFor="trade-price" className="text-xs text-[var(--text-muted)] mb-1.5 block font-medium">{t('trade.price')}</label>
            <div className="relative">
              <input
                id="trade-price"
                type="number"
                step={String(tickSize)}
                min={String(tickSize)}
                max="0.99"
                placeholder="0.50"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent-blue)] focus:shadow-[0_0_12px_rgba(79,143,255,0.12)] transition-all duration-200 pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] font-mono">
                USDC
              </span>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="trade-quantity" className="text-xs text-[var(--text-muted)] mb-1.5 block font-medium">
            {isMarket ? t('trade.marketAmount') : t('trade.quantity')}
          </label>
          <div className="relative">
            <input
              id="trade-quantity"
              type="number"
              step={isMarket ? '0.01' : '1'}
              min={isMarket ? '0.01' : '1'}
              placeholder={isMarket ? '100' : '10'}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent-blue)] focus:shadow-[0_0_12px_rgba(79,143,255,0.12)] transition-all duration-200 pr-14"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
              {isMarket ? 'USDC' : t('trade.shares')}
            </span>
          </div>
        </div>

        {/* 费用明细 */}
        {((isMarket && numAmount > 0) || (!isMarket && numAmount > 0 && numPrice > 0)) && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-1.5 text-xs border border-[var(--border)] animate-fade-in-scale">
            {isMarket && (
              <div className="text-[10px] text-[var(--accent-amber)] bg-[var(--accent-amber)]/10 rounded px-2 py-1">
                {t('trade.marketFeeHint', { rate: `${(feeRate * 100).toFixed(1)}%` })}
              </div>
            )}
            {!isMarket && (
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>{t('trade.estTotal')}</span>
                <span className="tabular-nums">${(numAmount * numPrice).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>{t('trade.fee')} ({(feeRate * 100).toFixed(1)}%)</span>
              <span className="tabular-nums">${estimatedFee.toFixed(4)}</span>
            </div>
            <div className="flex justify-between font-semibold text-[var(--text-primary)] pt-1.5 border-t border-[var(--border)]">
              <span>{side === 'BUY' ? t('trade.actualPay') : t('trade.actualReceive')}</span>
              <span className="tabular-nums">${actualPay.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 下单按钮 */}
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
          ) : side === 'BUY' ? t('trade.buy') : t('trade.sell')}
        </button>

        {!user && (
          <p className="text-xs text-center text-[var(--text-muted)]">
            {t('trade.connectHint')}
          </p>
        )}
      </div>

      {/* 订单簿 */}
      {orderBook && (
        <div className="border-t border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('trade.orderBook')}</h4>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[var(--green)] shadow-[0_0_6px_var(--green)]' : 'bg-[var(--accent-amber)] shadow-[0_0_6px_var(--accent-amber)] animate-pulse-slow'}`} />
              <span className="text-[10px] text-[var(--text-muted)]">
                {wsConnected ? t('trade.realtime') : t('trade.polling')}
              </span>
            </div>
          </div>
          <div className="space-y-0.5 text-[10px] font-mono">
            {/* 卖单 */}
            {(orderBook.asks || []).slice(0, 5).reverse().map((ask: any, i: number) => (
              <div key={`ask-${i}`} className="flex justify-between text-[var(--red)]/80 hover:text-[var(--red)] hover:bg-[var(--red-bg)]/50 rounded px-1 py-0.5 transition-all duration-150">
                <span>{formatPrice(String(ask.price))}</span>
                <span className="tabular-nums">{Number(ask.size).toFixed(0)}</span>
              </div>
            ))}
            {/* 中间价 */}
            <div className="flex justify-between py-1.5 text-[var(--text-primary)] font-bold border-y border-[var(--border)]/50 my-1">
              <span className="text-[var(--text-muted)] text-[9px] uppercase tracking-wider">{t('trade.spread')}</span>
              <span className="tabular-nums text-[var(--accent-cyan)]">
                {orderBook.asks?.[0] && orderBook.bids?.[0]
                  ? ((Number(orderBook.asks[0].price) - Number(orderBook.bids[0].price)) * 100).toFixed(1) + '¢'
                  : '—'}
              </span>
            </div>
            {/* 买单 */}
            {(orderBook.bids || []).slice(0, 5).map((bid: any, i: number) => (
              <div key={`bid-${i}`} className="flex justify-between text-[var(--green)]/80 hover:text-[var(--green)] hover:bg-[var(--green-bg)] rounded px-1 py-0.5 transition-all duration-150">
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
