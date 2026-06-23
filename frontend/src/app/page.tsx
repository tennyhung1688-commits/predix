'use client';

import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMarkets } from '@/hooks/useMarkets';
import { MarketRow, useImagePool } from '@/components/MarketRow';
import { HeroSection } from '@/components/HeroSection';
import { CategoryFilter } from '@/components/CategoryFilter';
import { api } from '@/lib/api';
import { formatVolume } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

interface Category {
  id: string;
  label: string;
  slug: string;
}

type SortMode = 'volume' | 'latest' | 'trending';

export default function Home() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { markets, loading, loadingMore, error, hasMore, isRefreshing, loadMore, pendingScrollRestore } = useMarkets();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('volume');
  const [trendingTags, setTrendingTags] = useState<{ id: number; label: string }[]>([]);
  const [stats, setStats] = useState({ totalVolume: 0, marketsCount: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [popularOnly, setPopularOnly] = useState(false);
  const [speedOnly, setSpeedOnly] = useState(false);
  const POPULAR_VOLUME_THRESHOLD = 0;

  // Shared image pool for row thumbnails
  const imagePool = useImagePool();

  // Sync activeTab with URL ?tab= param
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  };

  // When Navbar link changes URL (e.g. /?tab=politics), sync activeTab
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    } else {
      setActiveTab('all');
    }
  }, [tabParam]);

  const isSpeedMarket = (m: any) => {
    const q = (m.question || m.title || '').toLowerCase();
    return q.includes('up or down') || q.includes('up/down');
  };

  const [speedMarkets, setSpeedMarkets] = useState<any[]>([]);
  const [speedLoading, setSpeedLoading] = useState(false);
  const [categoryMarkets, setCategoryMarkets] = useState<Record<string, any[]>>({});
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Load categories and trending tags
  useEffect(() => {
    api.getCategories()
      .then((res: any) => setCategories(res.data || []))
      .catch(() => {});
    api.getTrendingTags()
      .then((res: any) => {
        const tags = res.data || [];
        setTrendingTags(tags.map((t: any) =>
          typeof t === 'string' ? { id: 0, label: t } : t
        ));
      })
      .catch(() => {});
  }, []);

  // Preload speed markets
  useEffect(() => {
    if (speedMarkets.length > 0) return;
    setSpeedLoading(true);
    api.getMarkets({ tag: 'crypto', limit: '200', order: 'createdAt' })
      .then((res: any) => {
        const all = res.data || [];
        setSpeedMarkets(all.filter((m: any) => isSpeedMarket(m)));
      })
      .catch(() => {})
      .finally(() => setSpeedLoading(false));
  }, []);

  // Fetch category markets when tab changes
  useEffect(() => {
    if (activeTab === 'all') return;
    if (categoryMarkets[activeTab]) return;
    setCategoryLoading(true);
    api.getMarkets({ tag: activeTab, limit: '50', order: 'volume24hr' })
      .then((res: any) => {
        setCategoryMarkets(prev => ({ ...prev, [activeTab]: res.data || [] }));
      })
      .catch(() => {})
      .finally(() => setCategoryLoading(false));
  }, [activeTab, categoryMarkets]);

  // Update stats
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

  // Filter and sort markets
  const filteredMarkets = useMemo(() => {
    let result = activeTab === 'all' ? markets : (categoryMarkets[activeTab] || []);

    // 过滤掉已结束的盘口
    result = result.filter((m: any) => !m.closed);

    if (popularOnly) {
      result = result.filter((m: any) =>
        parseFloat(m.volume24hr || m.volume || '0') >= POPULAR_VOLUME_THRESHOLD
      );
    }

    if (speedOnly) {
      if (activeTab === 'all' && speedMarkets.length > 0) {
        result = speedMarkets;
      } else {
        result = result.filter((m: any) => isSpeedMarket(m));
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m: any) =>
        (m.question_zh || m.title_zh || m.question || m.title || '').toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortMode) {
      case 'volume':
        return [...result].sort((a, b) =>
          parseFloat(b.volume24hr || b.volume || '0') - parseFloat(a.volume24hr || a.volume || '0')
        );
      case 'latest':
        return [...result].sort((a, b) =>
          new Date(b.createdAt || b.endDate || 0).getTime() - new Date(a.createdAt || a.endDate || 0).getTime()
        );
      case 'trending':
        return [...result]; // Keep API order (already volume-sorted)
      default:
        return result;
    }
  }, [markets, categoryMarkets, activeTab, searchQuery, popularOnly, speedOnly, sortMode]);

  const isLoading = loading || categoryLoading;

  useLayoutEffect(() => {
    if (pendingScrollRestore.current > 0) {
      const y = pendingScrollRestore.current;
      pendingScrollRestore.current = 0;
      window.scrollTo(0, y);
    }
  }, [markets]);

  const sortOptions: { key: SortMode; label: string; icon: string }[] = [
    { key: 'volume', label: t('home.sortVolume'), icon: '📊' },
    { key: 'latest', label: t('home.sortLatest'), icon: '🆕' },
    { key: 'trending', label: t('home.sortTrending'), icon: '🔥' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* === Hero Carousel === */}
      {!loading && markets.length > 0 && (
        <div className="-mx-3 sm:-mx-4 -mt-4 sm:-mt-6 mb-6">
          <HeroSection markets={markets} />
        </div>
      )}

      {/* === Stats Bar === */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="group relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 sm:p-4 card-hover overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-cyan)] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            <span className="text-xs text-[var(--text-muted)]">{t('home.24hVolume')}</span>
          </div>
          <div className="text-lg sm:text-xl font-bold tabular-nums animate-count-up text-[var(--text-bright)] font-display">
            {formatVolume(stats.totalVolume)}
          </div>
        </div>
        <div className="group relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 sm:p-4 card-hover overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--accent-purple)] to-[var(--accent-amber)] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <span className="text-xs text-[var(--text-muted)]">{t('home.activeMarkets')}</span>
          </div>
          <div className="text-lg sm:text-xl font-bold tabular-nums animate-count-up font-display">
            {stats.marketsCount}
          </div>
        </div>
      </div>

      {/* === Search & Sort & Filters === */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Row 1: Search + Quick Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="w-full sm:w-56 relative group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--accent-blue)] transition-colors z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              aria-label={t('home.searchPlaceholder')}
              placeholder={t('home.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:shadow-[0_0_15px_rgba(79,143,255,0.10)] transition-colors transition-shadow duration-300"
            />
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)]">
            {sortOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortMode(opt.key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                  sortMode === opt.key
                    ? 'bg-[var(--gradient-brand)] text-white shadow-[0_2px_8px_rgba(79,143,255,0.25)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Popular toggle */}
          <button
            onClick={() => setPopularOnly(!popularOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap transition-all duration-300 shrink-0 ${
              popularOnly
                ? 'bg-[var(--accent-amber)]/10 border-[var(--accent-amber)]/30 text-[var(--accent-amber)] shadow-[0_0_12px_rgba(251,191,36,0.10)]'
                : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border)]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            {popularOnly ? t('home.popularOnly') : t('home.showAll')}
          </button>

          {/* Speed toggle */}
          <button
            onClick={() => setSpeedOnly(!speedOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium whitespace-nowrap transition-all duration-300 shrink-0 ${
              speedOnly
                ? 'bg-[var(--accent-emerald)]/10 border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)] shadow-[0_0_12px_rgba(16,185,129,0.10)]'
                : 'bg-[var(--bg-card)] border-[var(--border-light)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border)]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
            </svg>
            {speedOnly ? t('home.speedActive') : t('home.speed')}
          </button>
        </div>

        {/* Row 2: Category Pills */}
        <CategoryFilter
          categories={categories}
          activeTab={activeTab}
          onSelect={handleTabChange}
        />
      </div>

      {/* === Trending Tags === */}
      {trendingTags.length > 0 && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-xs text-[var(--text-muted)] shrink-0 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            {t('home.trending')}:
          </span>
          {trendingTags.map((tag, i) => {
            const matchCategory = (tagLabel: string): string | null => {
              const labelLower = tagLabel.toLowerCase();
              for (const cat of categories) {
                const catLabel = cat.label.replace(/[^\w\s]/g, '').toLowerCase();
                if (cat.slug === labelLower || catLabel === labelLower || labelLower.includes(cat.slug) || catLabel.includes(labelLower)) {
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

      {/* === Market Grid === */}
      <div>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[44px,1fr,100px,85px,95px,95px,64px] md:grid-cols-[52px,1fr,110px,90px,100px,100px,72px] gap-2 md:gap-3 items-center px-3 py-2.5 border-b border-[var(--border)]">
                  <div className="skeleton w-11 h-8 md:w-[52px] md:h-10 rounded" />
                  <div><div className="skeleton h-3 w-3/4 mb-1" /><div className="skeleton h-2 w-1/4" /></div>
                  <div className="text-right"><div className="skeleton h-5 w-12 ml-auto" /></div>
                  <div className="text-right hidden md:block"><div className="skeleton h-3 w-10 ml-auto" /></div>
                  <div className="text-right hidden md:block"><div className="skeleton h-3 w-12 ml-auto" /></div>
                  <div className="text-right"><div className="skeleton h-3 w-8 ml-auto" /></div>
                  <div className="text-right"><div className="skeleton w-7 h-7 rounded ml-auto" /></div>
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
              {/* Column headers (desktop) */}
              <div className="hidden md:grid grid-cols-[48px,1fr,100px,80px,90px,90px,64px] gap-3 items-center px-3 py-1 text-[9px] uppercase font-medium text-white/18 tracking-wider border-b border-white/[0.04]">
                <span />
                <span>盘口</span>
                <span className="text-right">概率</span>
                <span className="text-right">{t('home.24hVolume')}</span>
                <span className="text-right">买卖价</span>
                <span className="text-right">倒计时</span>
                <span className="text-right" />
              </div>

              <div>
                {filteredMarkets.map((market: any, idx: number) => (
                  <MarketRow
                    key={market.id || market.conditionId}
                    market={market}
                    index={idx}
                    pool={imagePool}
                  />
                ))}
              </div>

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
      </div>
    </div>
  );
}
