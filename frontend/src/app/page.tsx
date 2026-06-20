'use client';

import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useMarkets } from '@/hooks/useMarkets';
import { MarketCard } from '@/components/MarketCard';
import { TradingPanel } from '@/components/TradingPanel';
import { api } from '@/lib/api';
import { formatVolume } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

interface Category {
  id: string;
  label: string;
  slug: string;
}

export default function Home() {
  const { t } = useTranslation();
  const { markets, loading, loadingMore, error, hasMore, isRefreshing, loadMore, pendingScrollRestore } = useMarkets();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingTags, setTrendingTags] = useState<{ id: number; label: string }[]>([]);
  const [stats, setStats] = useState({ totalVolume: 0, marketsCount: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [popularOnly, setPopularOnly] = useState(true); // 默认仅显示热门（24h交易量 >= $100）
  const POPULAR_VOLUME_THRESHOLD = 100; // 24h 最低交易量门槛（美元）

  // 分类市场数据（从 API 按 tag 拉取）
  const [categoryMarkets, setCategoryMarkets] = useState<Record<string, any[]>>({});
  const [categoryLoading, setCategoryLoading] = useState(false);

  // 加载分类列表
  useEffect(() => {
    api.getCategories()
      .then((res: any) => setCategories(res.data || []))
      .catch(() => {});
    api.getTrendingTags()
      .then((res: any) => {
        const tags = res.data || [];
        // 兼容旧格式（纯字符串数组）和新格式（对象数组）
        setTrendingTags(tags.map((t: any) =>
          typeof t === 'string' ? { id: 0, label: t } : t
        ));
      })
      .catch(() => {});
  }, []);

  // 当切换 tab 时，按需从 API 拉取对应分类
  useEffect(() => {
    if (activeTab === 'all') return;
    if (categoryMarkets[activeTab]) return; // 已缓存

    setCategoryLoading(true);
    api.getMarkets({ tag: activeTab, limit: '50', order: 'volume24hr' })
      .then((res: any) => {
        setCategoryMarkets(prev => ({ ...prev, [activeTab]: res.data || [] }));
      })
      .catch(() => {})
      .finally(() => setCategoryLoading(false));
  }, [activeTab, categoryMarkets]);

  // 更新统计（与当前过滤条件保持一致）
  useEffect(() => {
    let source = activeTab === 'all' ? markets : (categoryMarkets[activeTab] || []);
    if (popularOnly) {
      source = source.filter((m: any) =>
        parseFloat(m.volume24hr || m.volume || '0') >= POPULAR_VOLUME_THRESHOLD
      );
    }
    if (source.length > 0) {
      const totalVol = source.reduce((sum: number, m: any) =>
        sum + parseFloat(m.volume24hr || m.volume || '0'), 0
      );
      setStats(prev => ({ ...prev, totalVolume: totalVol, marketsCount: source.length }));
    }
  }, [markets, categoryMarkets, activeTab, popularOnly]);

  // 过滤市场（搜索 + 热门筛选，分类由 API 保证）
  const filteredMarkets = useMemo(() => {
    let result = activeTab === 'all' ? markets : (categoryMarkets[activeTab] || []);

    // 仅显示热门：过滤掉 24h 交易量低于门槛的市场
    if (popularOnly) {
      result = result.filter((m: any) =>
        parseFloat(m.volume24hr || m.volume || '0') >= POPULAR_VOLUME_THRESHOLD
      );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m: any) =>
        (m.question_zh || m.title_zh || m.question || m.title || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [markets, categoryMarkets, activeTab, searchQuery, popularOnly]);

  const isLoading = loading || categoryLoading;

  // 静默刷新后恢复滚动位置 — useLayoutEffect 在 DOM commit 后、浏览器 paint 前同步执行
  useLayoutEffect(() => {
    if (pendingScrollRestore.current > 0) {
      const y = pendingScrollRestore.current;
      pendingScrollRestore.current = 0;
      window.scrollTo(0, y);
    }
  }, [markets]);

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* 顶部统计栏 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="group relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 card-hover overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-cyan)] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            <span className="text-xs text-[var(--text-muted)]">{t('home.24hVolume')}</span>
          </div>
          <div className="text-xl font-bold tabular-nums animate-count-up text-[var(--text-bright)] font-display">
            {formatVolume(stats.totalVolume)}
          </div>
        </div>
        <div className="group relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 card-hover overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-amber)] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <span className="text-xs text-[var(--text-muted)]">{t('home.activeMarkets')}</span>
          </div>
          <div className="text-xl font-bold tabular-nums animate-count-up font-display">
            {stats.marketsCount}
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="w-full sm:w-64 relative group">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--accent-blue)] transition-colors z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            aria-label={t('home.searchPlaceholder')}
            placeholder={t('home.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:shadow-[0_0_15px_rgba(79,143,255,0.10)] transition-colors transition-shadow duration-300"
          />
        </div>

        {/* 热门切换 */}
        <button
          onClick={() => setPopularOnly(!popularOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap transition-colors transition-shadow duration-300 ${
            popularOnly
              ? 'bg-[var(--accent-amber)]/10 border-[var(--accent-amber)]/30 text-[var(--accent-amber)] shadow-[0_0_12px_rgba(251,191,36,0.10)]'
              : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border)]'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
          </svg>
          {popularOnly ? '仅热门' : '显示全部'}
        </button>

          {/* 分类 Tab */}
        <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-1 overflow-x-auto snap-x snap-mandatory items-center flex-1 min-w-0">
          {/* "全部" tab */}
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-300 ${
              activeTab === 'all'
                ? 'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white shadow-[0_2px_8px_rgba(79,143,255,0.25)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {t('home.all')}
          </button>

          {/* 所有分类直接平铺 */}
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                activeTab === cat.id
                  ? 'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white shadow-[0_2px_8px_rgba(79,143,255,0.25)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 趋势标签 */}
      {trendingTags.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <span className="text-xs text-[var(--text-muted)] shrink-0 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            {t('home.trending')}:
          </span>
          {trendingTags.map((tag, i) => {
            // 尝试匹配已知分类
            const matchCategory = (tagLabel: string): string | null => {
              const labelLower = tagLabel.toLowerCase();
              for (const cat of categories) {
                const catLabel = cat.label.replace(/[^\w\s]/g, '').toLowerCase(); // 去掉 emoji
                if (
                  cat.slug === labelLower ||
                  catLabel === labelLower ||
                  labelLower.includes(cat.slug) ||
                  catLabel.includes(labelLower)
                ) {
                  return cat.slug;
                }
              }
              return null;
            };
            
            const matchedSlug = matchCategory(tag.label);
            
            return (
            <button
              key={i}
              onClick={() => {
                setSearchQuery('');
                if (matchedSlug) {
                  setActiveTab(matchedSlug);
                } else {
                  // 未匹配到已知分类，用标签 ID 拉取对应市场
                  setActiveTab(String(tag.id));
                }
              }}
              className={`px-2.5 py-1 rounded-full border text-xs transition-all duration-300 whitespace-nowrap ${
                (activeTab !== 'all' && matchedSlug === activeTab) || activeTab === String(tag.id)
                  ? 'bg-[var(--accent-cyan)]/10 border-[var(--accent-cyan)]/30 text-[var(--accent-cyan)]'
                  : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] hover:border-[var(--accent-cyan)]/30 hover:shadow-[0_0_12px_rgba(34,211,238,0.10)]'
              }`}
            >
              {tag.label}
            </button>
            );
          })}
        </div>
      )}

      {/* 主内容区域 */}
      <div className="flex gap-4 md:gap-6">
        {/* 市场列表 */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                  <div className="skeleton h-3 w-16 mb-3" />
                  <div className="skeleton h-4 w-full mb-2" />
                  <div className="skeleton h-4 w-3/4 mb-3" />
                  <div className="skeleton h-1.5 w-full rounded-full mb-3" />
                  <div className="skeleton h-3 w-24" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--red-bg)] border border-[var(--red-border)] flex items-center justify-center mb-5 animate-pulse-slow">
                <svg className="w-7 h-7 text-[var(--red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1.5">{t('home.loadError')}</h3>
              <p className="text-sm text-[var(--text-muted)] max-w-xs">{error}</p>
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1.5">{t('home.noMarkets')}</h3>
              <p className="text-sm text-[var(--text-muted)] max-w-xs">{t('home.noMarketsHint')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                {filteredMarkets.map((market: any) => (
                  <MarketCard
                    key={market.id || market.conditionId}
                    market={market}
                    onClick={() => setSelectedMarket(market)}
                  />
                ))}
              </div>

              {/* Load More 按钮 */}
              {activeTab === 'all' && hasMore && (
                <div className="flex justify-center mt-8 mb-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-8 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:border-[var(--accent-blue)]/40 hover:shadow-[0_0_20px_rgba(79,143,255,0.10)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" className="opacity-30" />
                          <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        {t('home.loadingMore')}
                      </span>
                    ) : (
                      t('home.loadMore')
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 交易面板侧边栏 */}
        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-20">
            {selectedMarket ? (
              <TradingPanel market={selectedMarket} />
            ) : (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-sm font-medium mb-2">{t('home.selectMarket')}</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('home.selectMarketHint')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 移动端底部交易抽屉 */}
      {selectedMarket && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 animate-fade-in">
          <div className="bg-[var(--bg-card)] border-t border-[var(--border)] rounded-t-2xl max-h-[70vh] overflow-y-auto shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
              <span className="text-sm font-medium">{t('home.trade')}</span>
              <button
                onClick={() => setSelectedMarket(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <TradingPanel market={selectedMarket} />
          </div>
        </div>
      )}
    </div>
  );
}
