'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Market } from '@/types';
import { api } from '@/lib/api';

export function useMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);

  // 静默刷新前保存滚动位置，供页面通过 useLayoutEffect 恢复
  const pendingScrollRestore = useRef(0);

  const fetchMarkets = useCallback(async (append = false, silent = false) => {
    // 静默刷新：保存滚动位置，不触发 loading 状态
    if (silent) {
      pendingScrollRestore.current = window.scrollY;
      setIsRefreshing(true);
    } else if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params: Record<string, string> = { limit: '100', order: 'volume24hr' };
      if (append && cursorRef.current) {
        params.nextCursor = cursorRef.current;
      }

      const res = await api.getMarkets(params);
      const newData = res.data || [];

      if (append) {
        setMarkets(prev => [...prev, ...newData]);
      } else {
        setMarkets(newData);
      }

      // Track pagination state
      cursorRef.current = res.nextCursor || undefined;
      setHasMore(!!res.hasMore);

      setError(null);
    } catch (err: unknown) {
      // 静默刷新时不显示错误（保留旧数据）
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    fetchMarkets(true, false);
  }, [hasMore, loadingMore, fetchMarkets]);

  const refetch = useCallback(() => fetchMarkets(false, false), [fetchMarkets]);

  useEffect(() => {
    fetchMarkets(false, false);
    // 15 秒静默轮询 — 不触发 loading 骨架屏，不丢失滚动位置
    const interval = setInterval(() => fetchMarkets(false, true), 15000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  return { markets, loading, loadingMore, error, hasMore, isRefreshing, refetch, loadMore, pendingScrollRestore };
}

export function useMarket(marketId: string | null) {
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!marketId) return;

    let cancelled = false;
    setLoading(true);

    api.getMarket(marketId)
      .then((res) => {
        if (!cancelled) setMarket(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [marketId]);

  return { market, loading };
}
