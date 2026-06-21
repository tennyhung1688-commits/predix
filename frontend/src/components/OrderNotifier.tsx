'use client';

import { useEffect, useRef } from 'react';
import { useApp } from './Providers';
import { useNotification } from './NotificationProvider';
import { api } from '@/lib/api';
import type { PlatformTrade } from '@/types';

/**
 * 后台轮询用户订单状态，状态变化时通过全局 Toast 通知用户。
 * 必须放在 AppContext + NotificationProvider 内部。
 */
export function OrderNotifier() {
  const { user } = useApp();
  const { showToast } = useNotification();
  const prevStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      prevStatusRef.current = {};
      return;
    }

    let stopped = false;

    const check = async () => {
      if (stopped) return;
      try {
        const res: any = await api.getOrders();
        const orders: PlatformTrade[] = res.data || [];
        const prev = prevStatusRef.current;

        for (const order of orders) {
          const key = String(order.id);
          const newStatus = (order.status || '').toLowerCase();
          const oldStatus = prev[key];

          if (oldStatus && oldStatus !== newStatus) {
            const title = order.title || order.market || '#' + key.slice(0, 6);
            if (newStatus === 'filled' || newStatus === 'matched') {
              showToast('success', `✅ 订单已成交 — ${title}`);
            } else if (newStatus === 'cancelled') {
              showToast('warning', `⚠️ 订单已取消 — ${title}`);
            } else if (newStatus === 'failed') {
              showToast('error', `❌ 订单失败 — ${title}`);
            }
          }

          prev[key] = newStatus;
        }

        // 清理已不存在的订单
        const currentKeys = new Set(orders.map(o => String(o.id)));
        for (const k of Object.keys(prev)) {
          if (!currentKeys.has(k)) delete prev[k];
        }
      } catch {}
    };

    check();
    const timer = setInterval(check, 30000);
    return () => { stopped = true; clearInterval(timer); };
  }, [user, showToast]);

  return null;
}
