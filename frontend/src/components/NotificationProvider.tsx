'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  requestBrowserNotification: () => void;
  browserNotificationEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  toasts: [],
  showToast: () => {},
  removeToast: () => {},
  requestBrowserNotification: () => {},
  browserNotificationEnabled: false,
});

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [browserNotificationEnabled, setBrowserNotificationEnabled] = useState(false);

  const showToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    // 浏览器原生通知
    if (browserNotificationEnabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try { new Notification('PrediX', { body: message, icon: '/favicon.ico' }); } catch {}
      }
    }
  }, [browserNotificationEnabled]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const requestBrowserNotification = useCallback(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setBrowserNotificationEnabled(permission === 'granted');
        });
      } else {
        setBrowserNotificationEnabled(Notification.permission === 'granted');
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserNotificationEnabled(Notification.permission === 'granted');
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ toasts, showToast, removeToast, requestBrowserNotification, browserNotificationEnabled }}>
      {children}
      {/* 全局 Toast 容器 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-[360px] pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const colorMap: Record<ToastType, string> = {
    success: 'bg-emerald-500/95 border-emerald-400',
    error: 'bg-red-500/95 border-red-400',
    info: 'bg-blue-500/95 border-blue-400',
    warning: 'bg-amber-500/95 border-amber-400',
  };
  const iconMap: Record<ToastType, string> = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  return (
    <div className={`pointer-events-auto px-4 py-3 rounded-xl text-white text-sm shadow-2xl border backdrop-blur-sm animate-slide-in-right ${colorMap[toast.type]}`}>
      <div className="flex items-center gap-2">
        <span>{iconMap[toast.type]}</span>
        <span className="flex-1">{toast.message}</span>
        <button onClick={() => onRemove(toast.id)} className="opacity-70 hover:opacity-100 ml-2 text-lg leading-none">✕</button>
      </div>
    </div>
  );
}
