'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/types';
import { I18nProvider } from '@/i18n/I18nProvider';
import { NotificationProvider } from './NotificationProvider';
import { OrderNotifier } from './OrderNotifier';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (walletAddress: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  bindWallet: (walletAddress: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType>({
  user: null,
  setUser: () => {},
  login: async () => {},
  loginWithEmail: async () => {},
  bindWallet: async () => {},
  logout: () => {},
  loading: true,
});

export function useApp() {
  return useContext(AppContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getMe()
        .then((res: any) => {
          if (res.success) setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (walletAddress: string) => {
    const res: any = await api.login(walletAddress);
    if (res.success) {
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    const res: any = await api.loginWithEmail(email, password);
    if (res.success) {
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const bindWallet = async (walletAddress: string) => {
    const res: any = await api.bindWallet(walletAddress);
    if (res.success) {
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    }
  };

  return (
    <I18nProvider>
      <NotificationProvider>
        <AppContext.Provider value={{ user, setUser, login, loginWithEmail, bindWallet, logout, loading }}>
          <OrderNotifier />
          {children}
        </AppContext.Provider>
      </NotificationProvider>
    </I18nProvider>
  );
}
