'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { translations, Locale, TranslationKey } from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'zh',
  setLocale: () => {},
  t: (key: string) => key,
});

export function useTranslation() {
  return useContext(I18nContext);
}

const LOCALE_KEY = 'predix-locale';

// 始终返回默认语言，避免服务端/客户端水合不一致
// 客户端挂载后 useEffect 会从 localStorage 恢复用户选择
function getDefaultLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  // 在浏览器中检测偏好语言作为默认值（不依赖 localStorage 以避免水合问题）
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) return 'zh';
  return 'zh'; // 默认中文
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getDefaultLocale);
  const [mounted, setMounted] = useState(false);

  // 客户端挂载后，从 localStorage 恢复用户之前的语言选择
  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === 'en' || stored === 'zh') {
      setLocaleState(stored);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_KEY, newLocale);
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : 'en';
  }, []);

  // 同步 html lang
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text: string = translations[locale]?.[key] ?? '';
    if (!text) {
      // fallback to Chinese
      text = translations.zh[key] ?? key;
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
