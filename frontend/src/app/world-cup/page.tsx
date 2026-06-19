'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MarketCard } from '@/components/MarketCard';
import { TradingPanel } from '@/components/TradingPanel';
import { api } from '@/lib/api';
import { formatVolume } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

// 玩法 (Props) 子分类过滤器
const PROP_CATEGORIES = [
  { key: 'all',           labelKey: 'worldcup.categoryAll' as const,           filter: '' },
  { key: 'awards',        labelKey: 'worldcup.categoryAwards' as const,        filter: 'award|奖项|MVP' },
  { key: 'player-duels',  labelKey: 'worldcup.categoryPlayerDuels' as const,   filter: 'vs|对决|heads?\\s?up|matchups?' },
  { key: 'groups',        labelKey: 'worldcup.categoryGroups' as const,        filter: 'group|小组|table' },
  { key: 'knockout',      labelKey: 'worldcup.categoryKnockout' as const,      filter: 'knockout|淘汰|round of|quarter|semi|final' },
  { key: 'team-props',    labelKey: 'worldcup.categoryTeamProps' as const,     filter: 'team|球队|nation|country' },
  { key: 'player-future', labelKey: 'worldcup.categoryPlayerFuture' as const,  filter: 'player|球员|golden boot|ballon' },
  { key: 'continental',   labelKey: 'worldcup.categoryContinental' as const,   filter: 'continent|洲际|region|as？ia|africa|europe' },
  { key: 'tournament',    labelKey: 'worldcup.categoryTournament' as const,    filter: 'tournament|赛事|winner|champion' },
  { key: 'records',       labelKey: 'worldcup.categoryRecords' as const,       filter: 'record|纪录|most|most goals' },
  { key: 'culture',       labelKey: 'worldcup.categoryCulture' as const,       filter: 'culture|文化|anthem|mascot|cere？mony' },
];

// 子 Tab 定义
const SUB_TABS = [
  { key: 'matches', labelKey: 'worldcup.tabMatches' as const },
  { key: 'props',   labelKey: 'worldcup.tabProps' as const },
  { key: 'bracket', labelKey: 'worldcup.tabBracket' as const },
  { key: 'map',     labelKey: 'worldcup.tabMap' as const },
];

// 国家队 → 国旗 Emoji 映射
const COUNTRY_FLAGS: Record<string, string> = {
  'Mexico': '🇲🇽', 'Canada': '🇨🇦', 'Egypt': '🇪🇬', 'New Zealand': '🇳🇿',
  'Argentina': '🇦🇷', 'Uruguay': '🇺🇾', 'Iran': '🇮🇷', 'Panama': '🇵🇦',
  'France': '🇫🇷', 'Senegal': '🇸🇳', 'Saudi Arabia': '🇸🇦', 'Jamaica': '🇯🇲',
  'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Japan': '🇯🇵', 'Costa Rica': '🇨🇷',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Nigeria': '🇳🇬', 'South Korea': '🇰🇷', 'Norway': '🇳🇴',
  'Portugal': '🇵🇹', 'Colombia': '🇨🇴', 'Poland': '🇵🇱', 'Iraq': '🇮🇶',
  'Germany': '🇩🇪', 'Ecuador': '🇪🇨', 'Chile': '🇨🇱', 'South Africa': '🇿🇦',
  'Spain': '🇪🇸', 'Peru': '🇵🇪', 'Ivory Coast': '🇨🇮', 'UAE': '🇦🇪',
  'Italy': '🇮🇹', 'Serbia': '🇷🇸', 'Qatar': '🇶🇦', 'Honduras': '🇭🇳',
  'Netherlands': '🇳🇱', 'Paraguay': '🇵🇾', 'Cameroon': '🇨🇲', 'China': '🇨🇳',
  'USA': '🇺🇸', 'Turkey': '🇹🇷', 'Sweden': '🇸🇪', 'Algeria': '🇩🇿',
  'Belgium': '🇧🇪', 'Australia': '🇦🇺', 'Ghana': '🇬🇭',
};

const getFlag = (teamName: string): string => COUNTRY_FLAGS[teamName] || teamName?.charAt(0) || '?';

// 小组赛分组数据（12组 × 4队）
const GROUPS: Record<string, string[]> = {
  'A': ['Mexico', 'Canada', 'Egypt', 'New Zealand'],
  'B': ['Argentina', 'Uruguay', 'Iran', 'Panama'],
  'C': ['France', 'Senegal', 'Saudi Arabia', 'Jamaica'],
  'D': ['Brazil', 'Morocco', 'Japan', 'Costa Rica'],
  'E': ['England', 'Nigeria', 'South Korea', 'Norway'],
  'F': ['Portugal', 'Colombia', 'Poland', 'Iraq'],
  'G': ['Germany', 'Ecuador', 'Chile', 'South Africa'],
  'H': ['Spain', 'Peru', 'Ivory Coast', 'UAE'],
  'I': ['Italy', 'Serbia', 'Qatar', 'Honduras'],
  'J': ['Netherlands', 'Paraguay', 'Cameroon', 'China'],
  'K': ['USA', 'Turkey', 'Sweden', 'Algeria'],
  'L': ['Belgium', 'Australia', 'Egypt', 'Ghana'],
};

// 淘汰赛轮次名称映射
const KNOCKOUT_ROUNDS = [
  { key: 'r32', labelKey: 'worldcup.bracketR32' as const, slots: 32 },
  { key: 'r16', labelKey: 'worldcup.bracketR16' as const, slots: 16 },
  { key: 'qf', labelKey: 'worldcup.bracketQF' as const, slots: 8 },
  { key: 'sf', labelKey: 'worldcup.bracketSF' as const, slots: 4 },
  { key: 'f', labelKey: 'worldcup.bracketFinal' as const, slots: 2 },
];

// 主办城市信息
const HOST_CITIES = [
  { city: 'Mexico City', country: 'Mexico', flag: '🇲🇽', stadium: 'Estadio Azteca', capacity: '87,523', note: '开幕战 / 多场比赛' },
  { city: 'Guadalajara', country: 'Mexico', flag: '🇲🇽', stadium: 'Estadio Akron', capacity: '48,071', note: '' },
  { city: 'Monterrey', country: 'Mexico', flag: '🇲🇽', stadium: 'Estadio BBVA', capacity: '53,500', note: '' },
  { city: 'Toronto', country: 'Canada', flag: '🇨🇦', stadium: 'BMO Field', capacity: '45,500', note: '加拿大首场世界杯' },
  { city: 'Vancouver', country: 'Canada', flag: '🇨🇦', stadium: 'BC Place', capacity: '54,500', note: '' },
  { city: 'New York / New Jersey', country: 'USA', flag: '🇺🇸', stadium: 'MetLife Stadium', capacity: '82,500', note: '🏆 决赛场地' },
  { city: 'Los Angeles', country: 'USA', flag: '🇺🇸', stadium: 'SoFi Stadium', capacity: '70,240', note: '揭幕战（美国）' },
  { city: 'Dallas', country: 'USA', flag: '🇺🇸', stadium: 'AT&T Stadium', capacity: '80,000', note: '半决赛' },
  { city: 'Atlanta', country: 'USA', flag: '🇺🇸', stadium: 'Mercedes-Benz Stadium', capacity: '71,000', note: '半决赛' },
  { city: 'Kansas City', country: 'USA', flag: '🇺🇸', stadium: 'Arrowhead Stadium', capacity: '76,416', note: '四分之一决赛' },
  { city: 'Houston', country: 'USA', flag: '🇺🇸', stadium: 'NRG Stadium', capacity: '72,220', note: '四分之一决赛' },
  { city: 'Boston', country: 'USA', flag: '🇺🇸', stadium: 'Gillette Stadium', capacity: '65,878', note: '四分之一决赛' },
  { city: 'Philadelphia', country: 'USA', flag: '🇺🇸', stadium: 'Lincoln Financial Field', capacity: '69,176', note: '四分之一决赛' },
  { city: 'Miami', country: 'USA', flag: '🇺🇸', stadium: 'Hard Rock Stadium', capacity: '64,767', note: '三四名决赛' },
  { city: 'San Francisco', country: 'USA', flag: '🇺🇸', stadium: "Levi's Stadium", capacity: '68,500', note: '多场比赛' },
  { city: 'Seattle', country: 'USA', flag: '🇺🇸', stadium: 'Lumen Field', capacity: '68,740', note: '多场比赛' },
];

export default function WorldCupPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('props');
  const [propCategory, setPropCategory] = useState('all');
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [stats, setStats] = useState({ totalVolume: 0, marketsCount: 0, feeRate: 0.035 });
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchFilter, setMatchFilter] = useState<{ homeTeam: string; awayTeam: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingScrollRestore = useRef(0); // 静默刷新后待恢复的滚动位置

  // 加载市场价格数据（支持静默刷新）
  const fetchMarketsRaw = useCallback((silent = false) => {
    // 静默刷新前保存当前滚动位置（在读 scrollY 的同一帧内）
    if (silent) {
      pendingScrollRestore.current = window.scrollY;
      setIsRefreshing(true);
    } else {
      setLoading(true);
      setError(null);
    }

    api.getWorldCupMarkets({ limit: '100', order: 'volume24hr' })
      .then((res: any) => {
        const data = res.data || [];
        const totalVol = data.reduce((sum: number, m: any) =>
          sum + parseFloat(m.volume24hr || m.volume || '0'), 0
        );

        setMarkets(data);
        setStats({ totalVolume: totalVol, marketsCount: data.length });
        setLastUpdated(Date.now());
        if (silent) setIsRefreshing(false);
      })
      .catch((err: any) => {
        if (!silent) setError(err.message);
        if (silent) setIsRefreshing(false);
      })
      .finally(() => {
        if (!silent) {
          setLoading(false);
          setIsRefreshing(false);
        }
      });
  }, []);

  const fetchMarkets = useCallback(() => fetchMarketsRaw(false), [fetchMarketsRaw]);

  // 加载比赛日程（支持静默刷新）
  const fetchScheduleRaw = useCallback((silent = false) => {
    // 静默刷新前保存当前滚动位置（在读 scrollY 的同一帧内）
    if (silent) {
      pendingScrollRestore.current = window.scrollY;
    } else {
      setMatchesLoading(true);
    }

    api.getWorldCupSchedule()
      .then((res: any) => {
        setMatches(res.data || []);
        setLastUpdated(Date.now());
      })
      .catch(() => {
        if (!silent) setMatches([]);
      })
      .finally(() => {
        setMatchesLoading(false);
      });
  }, []);

  const fetchSchedule = useCallback(() => fetchScheduleRaw(false), [fetchScheduleRaw]);

  // 页面挂载时立即拉取市场数据（统计栏常驻，不随 Tab 切换清空）
  useEffect(() => {
    fetchMarkets();
    api.getFeeInfo()
      .then((res: any) => setStats(prev => ({ ...prev, feeRate: res.data?.feeRate || 0.035 })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'props') {
      fetchMarkets();
    } else if (activeTab === 'matches') {
      fetchSchedule();
    } else {
      // 切换到 bracket/map 时不清空 markets/matches，统计栏数据保持不变
      setLoading(false);
      setMatchesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 15 秒自动轮询 — 根据当前 Tab 静默刷新数据，无需整页刷新
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      if (activeTab === 'props') {
        fetchMarketsRaw(true);
      } else if (activeTab === 'matches') {
        fetchScheduleRaw(true);
      } else {
        // bracket / map 下仍然刷新统计数据
        fetchMarketsRaw(true);
      }
    }, 15000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeTab, fetchMarketsRaw, fetchScheduleRaw]);

  // 静默刷新后恢复滚动位置 — useLayoutEffect 在 DOM commit 后、浏览器 paint 前同步执行
  useLayoutEffect(() => {
    if (pendingScrollRestore.current > 0) {
      const y = pendingScrollRestore.current;
      pendingScrollRestore.current = 0;
      window.scrollTo(0, y);
    }
  }, [markets, matches]);

  // 按玩法分类 + 比赛队伍过滤
  const filteredMarkets = useMemo(() => {
    let result = markets;

    // 1. 先按比赛队伍筛选（从比赛卡片点击跳转）
    if (matchFilter) {
      const { homeTeam, awayTeam } = matchFilter;
      result = result.filter((m: any) => {
        const title = (m.question_zh || m.title_zh || m.question || m.title || m.eventTitle || '').toLowerCase();
        const outcomes = Array.isArray(m.outcomes_zh || m.outcomes)
          ? (m.outcomes_zh || m.outcomes).join(' ').toLowerCase()
          : '';
        const searchText = title + ' ' + outcomes;
        return searchText.includes(homeTeam.toLowerCase()) || searchText.includes(awayTeam.toLowerCase());
      });
    }

    // 2. 再按玩法分类过滤
    if (propCategory !== 'all') {
      const cat = PROP_CATEGORIES.find(c => c.key === propCategory);
      if (cat?.filter) {
        const regex = new RegExp(cat.filter, 'i');
        result = result.filter((m: any) => {
          const title = m.question_zh || m.title_zh || m.question || m.title || m.eventTitle || '';
          const outcomes = Array.isArray(m.outcomes_zh || m.outcomes)
            ? (m.outcomes_zh || m.outcomes).join(' ')
            : '';
          return regex.test(title) || regex.test(outcomes);
        });
      }
    }

    return result;
  }, [markets, propCategory, matchFilter]);

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-4">
        <Link href="/" className="hover:text-[var(--accent-cyan)] transition-colors">
          PrediX
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[var(--text-secondary)]">{t('nav.sports')}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-[var(--text-primary)] font-medium">{t('worldcup.breadcrumb')}</span>
      </div>

      {/* 页面标题 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="text-4xl">🏆</div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-bright)]">
            {t('worldcup.title')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {t('worldcup.subtitle')}
          </p>
        </div>
      </div>

      {/* 子 Tab 导航 */}
      <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-1 mb-6 w-fit overflow-x-auto scrollbar-hide">
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-300 ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white shadow-[0_2px_8px_rgba(79,143,255,0.25)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* 统计栏 + 实时状态 */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-xs text-[var(--text-muted)] mb-1">{t('home.24hVolume')}</div>
            <div className="text-lg font-bold tabular-nums text-[var(--text-bright)]">
              {formatVolume(stats.totalVolume)}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-xs text-[var(--text-muted)] mb-1">{t('home.activeMarkets')}</div>
            <div className="text-lg font-bold tabular-nums">{stats.marketsCount}</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-xs text-[var(--text-muted)] mb-1">{t('home.feeRate')}</div>
            <div className="text-lg font-bold text-[var(--accent-emerald)]">{(stats.feeRate * 100).toFixed(1)}%</div>
          </div>
        </div>
        {/* 实时更新指示器 */}
        <div className="flex items-center justify-end gap-2 mt-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-[var(--accent-cyan)] animate-pulse' : 'bg-[var(--accent-emerald)]'}`} />
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            {isRefreshing
              ? t('worldcup.updating')
              : lastUpdated
                ? `${t('worldcup.lastUpdated')} ${new Date(lastUpdated).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
                : t('worldcup.liveData')}
          </span>
          <span className="text-[11px] font-medium text-[var(--accent-emerald)] tracking-wide">
            ● {t('worldcup.live')}
          </span>
        </div>
      </div>

      {/* === 玩法 (Props) Tab 内容 === */}
      {activeTab === 'props' && (
        <>
          {/* 比赛筛选提示条 */}
          {matchFilter && (
            <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 rounded-xl">
              <span className="text-sm text-[var(--text-secondary)]">
                {t('worldcup.filteredBy')}:
              </span>
              <span className="text-sm font-semibold text-[var(--accent-blue)]">
                {matchFilter.homeTeam} vs {matchFilter.awayTeam}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                ({filteredMarkets.length} {t('worldcup.marketsFound')})
              </span>
              <button
                onClick={() => setMatchFilter(null)}
                className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--red)] transition-colors flex items-center gap-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
                {t('worldcup.clearFilter')}
              </button>
            </div>
          )}

          {/* 分类筛选 */}
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            {PROP_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setPropCategory(cat.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                  propCategory === cat.key
                    ? 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 shadow-[0_0_12px_rgba(34,211,238,0.10)]'
                    : 'bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-cyan)]/20'
                }`}
              >
                {t(cat.labelKey)}
              </button>
            ))}
          </div>

          {/* 主内容 */}
          <div className="flex gap-4 md:gap-6">
            <div className="flex-1 min-w-0">
              {loading ? (
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
                  <div className="w-16 h-16 rounded-2xl bg-[var(--red-bg)] border border-[var(--red-border)] flex items-center justify-center mb-5">
                    <svg className="w-7 h-7 text-[var(--red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold mb-1.5">{t('worldcup.loadError')}</h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-xs mb-4">{error}</p>
                  <button
                    onClick={fetchMarkets}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    {t('worldcup.retry')}
                  </button>
                </div>
              ) : filteredMarkets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center mb-5">
                    <svg className="w-7 h-7 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold mb-1.5">{t('worldcup.noData')}</h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-xs">{t('worldcup.noDataHint')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                  {filteredMarkets.map((market: any) => (
                    <MarketCard
                      key={market.id || market.conditionId}
                      market={market}
                      onClick={() => setSelectedMarket(market)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 交易面板侧边栏 */}
            <div className="hidden lg:block w-80 shrink-0">
              <div className="sticky top-20">
                {selectedMarket ? (
                  <TradingPanel market={selectedMarket} />
                ) : (
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
                    <div className="text-4xl mb-4">🏆</div>
                    <h3 className="text-sm font-medium mb-2">{t('worldcup.selectMarket')}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{t('worldcup.selectMarketHint')}</p>
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
        </>
      )}

      {/* === 比赛 (Matches) Tab === */}
      {activeTab === 'matches' && (
        <>
          {matchesLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-12 h-12 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin mb-5" />
              <p className="text-sm text-[var(--text-muted)]">{t('worldcup.matchesLoading')}</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center mb-6">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('worldcup.matchesNoData')}</h3>
              <p className="text-sm text-[var(--text-muted)] max-w-md">{t('worldcup.matchesNoDataHint')}</p>
              <button
                onClick={() => setActiveTab('props')}
                className="mt-6 px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white text-sm font-medium shadow-[0_2px_8px_rgba(79,143,255,0.25)] hover:shadow-[0_2px_20px_rgba(79,143,255,0.4)] transition-all duration-300"
              >
                {t('worldcup.goToProps')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {matches.map((match: any) => {
                // 判断比赛状态
                const now = new Date();
                const startTime = match.startTime ? new Date(match.startTime) : null;
                const endTime = match.endTime ? new Date(match.endTime) : null;
                const isLive = startTime && endTime && now >= startTime && now <= endTime;
                const isEnded = endTime && now > endTime;
                const isUpcoming = startTime && now < startTime;

                // 格式化时间
                const formatMatchTime = (date: Date) => {
                  return date.toLocaleDateString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  }) + ' ' + date.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                };

                return (
                  <div
                    key={match.id || match.eventId}
                    onClick={() => {
                      setMatchFilter({ homeTeam: match.homeTeam, awayTeam: match.awayTeam });
                      setPropCategory('all');
                      setActiveTab('props');
                    }}
                    className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent-blue)]/30 transition-all duration-300 group cursor-pointer"
                  >
                    {/* 状态标签 */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isLive
                          ? 'bg-[var(--red-bg)] text-[var(--red)] border border-[var(--red-border)]'
                          : isEnded
                          ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border)]'
                          : 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20'
                      }`}>
                        {isLive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] animate-pulse" />
                        )}
                        {isLive
                          ? t('worldcup.matchLive')
                          : isEnded
                          ? t('worldcup.matchEnded')
                          : t('worldcup.matchUpcoming')}
                      </span>
                      {match.volume24hr && parseFloat(match.volume24hr) > 0 && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatVolume(parseFloat(match.volume24hr))}
                        </span>
                      )}
                    </div>

                    {/* 对阵双方 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-center text-lg shrink-0">
                          {getFlag(match.homeTeam)}
                        </div>
                        <span className="font-semibold text-sm truncate">{match.homeTeam || 'TBD'}</span>
                      </div>
                      <div className="px-3 text-center shrink-0">
                        <span className="text-xs font-bold text-[var(--text-muted)]">VS</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        <span className="font-semibold text-sm truncate">{match.awayTeam || 'TBD'}</span>
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-center text-lg shrink-0">
                          {getFlag(match.awayTeam)}
                        </div>
                      </div>
                    </div>

                    {/* 比赛时间 */}
                    {(startTime || endTime) && (
                      <div className="flex items-center gap-2 mb-3 text-xs text-[var(--text-muted)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                        <span>{t('worldcup.matchTime')}:</span>
                        <span className="font-medium text-[var(--text-secondary)]">
                          {startTime ? formatMatchTime(startTime) : endTime ? formatMatchTime(endTime) : '-'}
                        </span>
                      </div>
                    )}

                    {/* 底部：市场数和操作 */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                      <span className="text-xs text-[var(--text-muted)]">
                        {t('worldcup.matchMarkets', { n: match.markets?.length || 0 })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMatchFilter({ homeTeam: match.homeTeam, awayTeam: match.awayTeam });
                          setPropCategory('all');
                          setActiveTab('props');
                        }}
                        className="text-xs font-medium text-[var(--accent-blue)] hover:text-[var(--accent-cyan)] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {t('worldcup.matchViewMarkets')} →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* === 对阵图 (Bracket) Tab === */}
      {activeTab === 'bracket' && (
        <div className="space-y-8">
          {/* 小组赛 */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-bright)] mb-4 flex items-center gap-2">
              <span className="text-xl">📋</span>
              {t('worldcup.bracketGroupStage')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {Object.entries(GROUPS).map(([group, teams]) => (
                <div key={group} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] px-3 py-2 text-white text-sm font-bold text-center">
                    {t('worldcup.bracketGroup', { name: group })}
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {teams.map((team, idx) => (
                      <div key={team} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                        <span className="text-xs text-[var(--text-muted)] w-4">{idx + 1}</span>
                        <span className="text-base">{getFlag(team)}</span>
                        <span className="text-[var(--text-secondary)] truncate">{team}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 淘汰赛路线图 */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-bright)] mb-4 flex items-center gap-2">
              <span className="text-xl">🏆</span>
              {t('worldcup.bracketKnockout')}
            </h3>
            <div className="overflow-x-auto">
              <div className="flex gap-4 md:gap-6 min-w-[900px] pb-4">
                {KNOCKOUT_ROUNDS.map((round, ri) => (
                  <div key={round.key} className="flex-1 min-w-[140px]">
                    <div className="text-xs font-semibold text-[var(--text-muted)] mb-3 text-center uppercase tracking-wider">
                      {t(round.labelKey)}
                    </div>
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: round.slots / 2 }).map((_, i) => (
                        <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-2">
                          <div className="flex items-center gap-1.5 py-1 border-b border-dashed border-[var(--border)]">
                            <span className="text-sm">{ri === 0 ? getFlag('TBD') : '🤍'}</span>
                            <span className="text-xs text-[var(--text-muted)] truncate flex-1">TBD</span>
                          </div>
                          <div className="flex items-center gap-1.5 py-1">
                            <span className="text-sm">{ri === 0 ? getFlag('TBD') : '🤍'}</span>
                            <span className="text-xs text-[var(--text-muted)] truncate flex-1">TBD</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] text-center mt-4">
              {t('worldcup.bracketKnockoutHint')}
            </p>
          </div>
        </div>
      )}

      {/* === 地图 (Map) Tab === */}
      {activeTab === 'map' && (
        <div className="space-y-6">
          {/* 主办国概览 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['🇲🇽', '🇨🇦', '🇺🇸'].map((flag) => {
              const countryName = flag === '🇲🇽' ? 'Mexico' : flag === '🇨🇦' ? 'Canada' : 'USA';
              const cityCount = HOST_CITIES.filter(c => c.country === countryName).length;
              return (
                <div key={countryName} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 text-center hover:border-[var(--accent-blue)]/30 transition-all duration-300">
                  <div className="text-4xl mb-2">{flag}</div>
                  <div className="font-bold text-[var(--text-bright)]">
                    {t(`worldcup.host${countryName}` as any)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    {cityCount} {t('worldcup.hostCities')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 场馆列表 */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-bright)] mb-4 flex items-center gap-2">
              <span className="text-xl">🏟️</span>
              {t('worldcup.mapStadiums')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {HOST_CITIES.map((venue) => (
                <div key={venue.stadium} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent-blue)]/30 transition-all duration-300 group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{venue.flag}</span>
                    <div>
                      <div className="font-semibold text-sm text-[var(--text-bright)]">{venue.city}</div>
                      <div className="text-xs text-[var(--text-muted)]">{venue.stadium}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      <span>{venue.capacity}</span>
                    </div>
                    {venue.note && (
                      <span className="text-xs text-[var(--accent-cyan)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {venue.note}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] text-center">
            {t('worldcup.mapHostInfo')}
          </p>
        </div>
      )}
    </div>
  );
}
