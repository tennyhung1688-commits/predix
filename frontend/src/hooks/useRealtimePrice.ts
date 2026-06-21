'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { OrderBook, OrderBookEntry } from '@/types';
import { api } from '@/lib/api';

interface RealtimePrice {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread: number;
  midPrice: number;
  lastUpdate: number;
}

/** 从原始订单簿数据中解析出 bid/ask */
function parseOrderBook(data: OrderBook): RealtimePrice {
  const bids = (data.bids || []).map((b: OrderBookEntry) => ({
    price: parseFloat(b.price || '0'),
    size: parseFloat(b.size || '0'),
  }));
  const asks = (data.asks || []).map((a: OrderBookEntry) => ({
    price: parseFloat(a.price || '0'),
    size: parseFloat(a.size || '0'),
  }));

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;

  return {
    bids: bids.slice(0, 10),
    asks: asks.slice(0, 10),
    spread: bestAsk - bestBid,
    midPrice: (bestBid + bestAsk) / 2 || bestBid || bestAsk,
    lastUpdate: Date.now(),
  };
}

// WebSocket 重连配置
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 秒
const MAX_RECONNECT_DELAY = 30_000;   // 30 秒上限

export function useRealtimePrice(tokenId: string | null) {
  const [price, setPrice] = useState<RealtimePrice | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Determine WebSocket URL for current environment
  const getWsUrl = () => {
    if (typeof window === 'undefined') return null;
    if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
    if (!window.location.hostname.includes('localhost')) return null; // production: use polling
    return 'ws://localhost:3001';
  };
  const wsUrl = getWsUrl();

  const fetchPrice = useCallback(async () => {
    if (!tokenId) return;
    try {
      const res = await api.getOrderBook(tokenId);
      const data = res.data || res;
      setPrice(parseOrderBook(data));
    } catch {
      // silent fail for polling
    }
  }, [tokenId]);

  // WebSocket 连接
  useEffect(() => {
    if (!tokenId) return;

    // Polling fallback (production without WS)
    if (!wsUrl) {
      fetchPrice();
      pollRef.current = setInterval(fetchPrice, 5000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }

    let ws: WebSocket;

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          // 连接成功后重置重连计数器
          reconnectAttemptsRef.current = 0;
          // 订阅该 token 的订单簿更新
          ws.send(JSON.stringify({ type: 'subscribe', channel: `book.${tokenId}` }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.channel === `book.${tokenId}` && msg.data) {
              setPrice(parseOrderBook(msg.data));
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          setConnected(false);

          // 指数退避重连，有最大重试次数上限
          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[WS] Max reconnect attempts reached, falling back to polling');
            // 降级到轮询
            fetchPrice();
            pollRef.current = setInterval(fetchPrice, 5000);
            return;
          }

          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttemptsRef.current++;

          console.log(`[WS] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current})`);
          reconnectRef.current = setTimeout(connectWs, delay);
        };

        ws.onerror = () => {
          // 不强制 close，让 onclose 处理重连逻辑
        };
      } catch {
        // WebSocket 不可用时降级到轮询
        setConnected(false);
        fetchPrice();
        pollRef.current = setInterval(fetchPrice, 5000);
      }
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [tokenId, fetchPrice]);

  return { price, connected };
}
