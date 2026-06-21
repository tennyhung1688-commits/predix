'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { useApp } from './Providers';
import { useTranslation } from '@/i18n/I18nProvider';
import type { TranslationKey } from '@/i18n/translations';

// ---------- 钱包图标 ----------

function IconMetaMask() {
  return (
    <svg width="24" height="22" viewBox="0 0 35 33" fill="none" aria-hidden="true">
      <path d="M32.958 1l-13.134 9.718 2.443-5.726L32.958 1z" fill="#E17726" stroke="#E17726" strokeWidth="0.25"/>
      <path d="M2.063 1l13.017 9.78-2.326-5.789L2.063 1z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M28.23 23.494l-3.49 5.338 7.455 2.058 2.136-7.23-6.102-.166z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M.79 23.66l2.128 7.23 7.447-2.058-3.482-5.338-6.093.166z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M10.158 14.29l-2.074 3.134 7.38.336-.245-7.935-5.061 4.465z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M24.854 14.29l-5.112-4.525-.163 7.995 7.38-.336-2.105-3.134z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M10.854 28.832l4.45-2.153-3.84-2.992-.61 5.145z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M19.708 26.679l4.441 2.153-.601-5.145-3.84 2.992z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M24.15 28.832l-4.442-2.153.36 2.886-.036 1.219 4.117-1.952z" fill="#D5BFB2" stroke="#D5BFB2" strokeWidth="0.25"/>
      <path d="M10.854 28.832l4.118 1.952-.027-1.22.352-2.885-4.443 2.153z" fill="#D5BFB2" stroke="#D5BFB2" strokeWidth="0.25"/>
      <path d="M15.014 21.268l-3.698-1.085 2.613-1.187 1.085 2.272z" fill="#233447" stroke="#233447" strokeWidth="0.25"/>
      <path d="M19.998 21.268l1.085-2.272 2.622 1.187-3.707 1.085z" fill="#233447" stroke="#233447" strokeWidth="0.25"/>
      <path d="M10.854 28.832l.637-5.338-4.026.116 3.389 5.222z" fill="#CC6228" stroke="#CC6228" strokeWidth="0.25"/>
      <path d="M23.521 23.494l.628 5.338 3.397-5.222-4.025-.116z" fill="#CC6228" stroke="#CC6228" strokeWidth="0.25"/>
      <path d="M27.09 17.424l-7.38.336.687 3.815 1.085-2.272 2.622 1.187 2.986-3.066z" fill="#CC6228" stroke="#CC6228" strokeWidth="0.25"/>
      <path d="M8.084 14.832l2.074 3.134 2.613-1.187 1.077 2.272.695-3.815-7.38-.336-.08-.068z" fill="#E27525" stroke="#E27525" strokeWidth="0.25"/>
      <path d="M7.91 17.424l3.09 6.07-.103-3.004-2.986-3.066z" fill="#E27525" stroke="#E27525" strokeWidth="0.25"/>
      <path d="M24.008 20.49l-.111 3.004 3.098-6.07-2.987 3.066z" fill="#F5841B" stroke="#F5841B" strokeWidth="0.25"/>
      <path d="M27.451 16.787l-6.775 1.98.687 3.815 3.09-6.07.112-3.004 2.886 3.279z" fill="#C0AC9D" stroke="#C0AC9D" strokeWidth="0.25"/>
      <path d="M8.084 14.832l-.079.068 2.894 3.279.103 3.004 3.098 6.07.687-3.815-6.775-1.98.072-.626z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M17.513 10.465l1.88-3.653-.854-2.609-1.026 5.56v.702z" fill="#763D16" stroke="#763D16" strokeWidth="0.25"/>
      <path d="M16.826 11.966l-.36 2.387.188 5.868.86-4.44-.688-3.815z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M18.186 11.966l-.687 3.815.86 4.44.195-5.86-.368-2.395z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M17.487 10.465l-1.035-5.56-.846 2.609 1.88 3.653v-.702z" fill="#763D16" stroke="#763D16" strokeWidth="0.25"/>
    </svg>
  );
}

function IconCoinbase() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="20" fill="#0052FF"/>
      <path d="M20 28c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm-2.8-5.2h5.6v-5.6h-5.6v5.6z" fill="#fff"/>
    </svg>
  );
}

function IconWalletConnect() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#3B99FC"/>
      <path d="M15.522 18.396c4.683-4.527 12.274-4.527 16.957 0l.564.546c.233.226.233.593 0 .818l-1.928 1.864a.298.298 0 01-.41 0l-.776-.75c-3.268-3.158-8.562-3.158-11.83 0l-.83.803a.298.298 0 01-.41 0l-1.928-1.864a.563.563 0 010-.818l.591-.599zm20.943 3.85l1.716 1.66a.563.563 0 010 .818l-7.738 7.481a.597.597 0 01-.83 0l-5.491-5.309a.149.149 0 00-.206 0l-5.49 5.31a.597.597 0 01-.83 0l-7.74-7.482a.563.563 0 010-.818l1.717-1.66a.597.597 0 01.829 0l5.49 5.308a.149.149 0 00.206 0l5.49-5.308a.597.597 0 01.83 0l5.49 5.308a.149.149 0 00.207 0l5.49-5.308a.597.597 0 01.83 0z" fill="#fff"/>
    </svg>
  );
}

function IconTrustWallet() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#3375BB"/>
      <path d="M20 8l-8 4v8c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12v-8l-8-4zm-1.5 17.5l-4-4 1.41-1.42 2.59 2.58 5.59-5.58 1.41 1.42-7 7z" fill="#fff"/>
    </svg>
  );
}

function IconPhantom() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#AB9FF2"/>
      <path d="M29.19 11.93c-1.91-1.91-4.95-1.91-6.86 0l-.56.56c-.12.12-.12.31 0 .43l2.3 2.3c.12.12.31.12.43 0l.5-.5c1.19-1.19 3.08-1.19 4.28 0 .58.58.91 1.37.92 2.19h-.01c0 .41-.08.82-.24 1.21-.01.05-.02.11-.05.16-.16.43-.4.84-.7 1.2l-.03.03c-.03.03-.05.06-.08.09l-.03.03c-.03.03-.06.05-.09.08-.1.09-.2.17-.31.25-1.66 1.14-3.91.91-5.33-.53l-.55-.55c-.06-.06-.06-.16 0-.22.69-.69.69-1.08 0-1.77-.69-.69-1.08-.69-1.77 0-.69.69-.69 1.08 0 1.77l.55.55c.06.06.06.16 0 .22l-2.29 2.29c-.01.01-.03.03-.05.03-.56.55-1.31.86-2.1.86h-.61c-.01-.95-.33-1.9-.93-2.63l-3.2-4.27v-.01l-.02-.03c-.42-.7-.85-1.42-1.1-2.17-.02-.07-.05-.14-.07-.21-.12-.37-.2-.76-.22-1.14-.01-.29 0-.57.04-.85.02-.14.04-.27.07-.4.06-.23.13-.45.22-.68.04-.1.07-.2.12-.29.07-.16.15-.33.24-.49.05-.1.11-.19.17-.28.12-.2.26-.39.41-.57.07-.08.14-.17.22-.25.27-.28.57-.53.89-.74.1-.07.2-.13.31-.19.53-.29 1.08-.48 1.64-.57.1-.02.2-.03.3-.04.26-.02.53-.02.79.01.11.01.22.03.33.05.34.07.68.18 1.02.34 1.71.8 3.2 2.15 4.72 3.67l.49.49c.12.12.31.12.43 0l3.15-3.15c.12-.12.12-.31 0-.43l-.5-.5zm-10.63 8.03c.05.58.39.12.53.09-.03.21-.08.42-.15.63-.01.04-.03.09-.05.16h.01c-.34.06-.67.06-.98-.02-.01-.04-.03-.1-.05-.17.1-.1.19-.2.27-.3.13-.13.27-.26.42-.39z" fill="#fff"/>
    </svg>
  );
}

function IconOKX() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#121212"/>
      <path d="M13 13h5v5h-5v-5zm9 0h5v5h-5v-5zm-9 9h5v5h-5v-5zm9 0h5v5h-5v-5z" fill="#fff"/>
    </svg>
  );
}

function IconRainbow() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="rb-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF4000"/><stop offset="0.33" stopColor="#FFD000"/>
          <stop offset="0.66" stopColor="#00C0FF"/><stop offset="1" stopColor="#7B00FF"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#rb-grad)"/>
      <path d="M20 10c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4-4-1.79-4-4z" fill="#fff"/>
    </svg>
  );
}

function IconRabby() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#8791FF"/>
      <path d="M12 14.5L20 10l8 4.5v11L20 30l-8-4.5v-11z" fill="none" stroke="#fff" strokeWidth="1.5"/>
      <circle cx="20" cy="20" r="3.5" fill="none" stroke="#fff" strokeWidth="1.5"/>
    </svg>
  );
}

function IconImToken() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#11C3FF"/>
      <path d="M20 8c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 3.6a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm-4.8 4.8h9.6v2.4h-9.6v-2.4zm1.2 4.8h7.2v2.4h-7.2v-2.4zm-1.2 4.8h9.6v1.2a4.8 4.8 0 01-9.6 0V26z" fill="#fff"/>
    </svg>
  );
}

// ---------- 钱包配置 ----------

interface WalletOption {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  icon: ReactNode;
  bgClass: string;
  iconClass: string;
  isMobile?: boolean;
}

const BROWSER_WALLETS: WalletOption[] = [
  { id: 'metamask', nameKey: 'wallet.metamask', descKey: 'wallet.metamaskDesc', icon: <IconMetaMask />, bgClass: 'bg-[var(--accent-amber)]/10', iconClass: 'text-[var(--accent-amber)]' },
  { id: 'coinbase', nameKey: 'wallet.coinbase', descKey: 'wallet.coinbaseDesc', icon: <IconCoinbase />, bgClass: 'bg-blue-500/10', iconClass: 'text-blue-500' },
  { id: 'rabby', nameKey: 'wallet.rabby', descKey: 'wallet.rabbyDesc', icon: <IconRabby />, bgClass: 'bg-indigo-400/10', iconClass: 'text-indigo-400' },
];

const MOBILE_WALLETS: WalletOption[] = [
  { id: 'walletconnect', nameKey: 'wallet.walletconnect', descKey: 'wallet.walletconnectDesc', icon: <IconWalletConnect />, bgClass: 'bg-sky-400/10', iconClass: 'text-sky-400' },
  { id: 'trustwallet', nameKey: 'wallet.trustwallet', descKey: 'wallet.trustwalletDesc', icon: <IconTrustWallet />, bgClass: 'bg-blue-600/10', iconClass: 'text-blue-600' },
  { id: 'phantom', nameKey: 'wallet.phantom', descKey: 'wallet.phantomDesc', icon: <IconPhantom />, bgClass: 'bg-[var(--accent-purple)]/10', iconClass: 'text-[var(--accent-purple)]' },
  { id: 'okx', nameKey: 'wallet.okx', descKey: 'wallet.okxDesc', icon: <IconOKX />, bgClass: 'bg-gray-700/10', iconClass: 'text-gray-700 dark:text-gray-300' },
  { id: 'rainbow', nameKey: 'wallet.rainbow', descKey: 'wallet.rainbowDesc', icon: <IconRainbow />, bgClass: 'bg-gradient-to-br from-orange-400/10 via-yellow-400/10 to-purple-500/10', iconClass: 'text-purple-500' },
  { id: 'imtoken', nameKey: 'wallet.imtoken', descKey: 'wallet.imtokenDesc', icon: <IconImToken />, bgClass: 'bg-cyan-400/10', iconClass: 'text-cyan-400' },
];

// ---------- 组件 ----------

export function WalletModal({ onClose, mode = 'login' }: { onClose: () => void; mode?: 'login' | 'bind' }) {
  const { login, bindWallet } = useApp();
  const { t } = useTranslation();
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 焦点陷阱 + 键盘处理
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusableElements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
        else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const prevFocus = document.activeElement as HTMLElement;
    return () => { document.removeEventListener('keydown', handleKeyDown); prevFocus?.focus(); };
  }, [onClose]);

  useEffect(() => {
    if (showManual) inputRef.current?.focus();
  }, [showManual]);

  const handleConnect = async () => {
    if (!address.trim()) { setError(t('wallet.enterAddress')); return; }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) { setError(t('wallet.invalidAddress')); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'bind') {
        await bindWallet(address.trim());
      } else {
        await login(address.trim());
      }
      onClose();
    } catch (err: any) {
      setError(err.message || t('wallet.connectFailed'));
    } finally { setLoading(false); }
  };

  const handleMockConnect = () => {
    setAddress('');
    setShowManual(true);
  };

  const renderWalletButton = (w: WalletOption) => (
    <button
      key={w.id}
      onClick={handleMockConnect}
      className="group w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/5 transition-all duration-200 focus-ring"
    >
      <div className={`w-10 h-10 rounded-full ${w.bgClass} flex items-center justify-center shrink-0`} aria-hidden="true">
        <div className={w.iconClass}>{w.icon}</div>
      </div>
      <div className="text-left min-w-0">
        <div className="text-sm font-medium">{t(w.nameKey)}</div>
        <div className="text-xs text-[var(--text-muted)] truncate">{t(w.descKey)}</div>
      </div>
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        aria-describedby={error ? 'wallet-error' : undefined}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 animate-fade-in shadow-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h2 id="wallet-modal-title" className="text-lg font-bold">{mode === 'bind' ? t('wallet.bindTitle') : t('wallet.title')}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t('wallet.close') || 'Close'}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus-ring rounded-lg p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* 可滚动区域 */}
        <div className="overflow-y-auto -mx-1 px-1 space-y-4">
          {/* 浏览器扩展 */}
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">{t('wallet.sectionBrowser')}</p>
            <div className="space-y-2">
              {BROWSER_WALLETS.map(renderWalletButton)}
            </div>
          </div>

          {/* 移动端钱包 */}
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">{t('wallet.sectionMobile')}</p>
            <div className="space-y-2">
              {MOBILE_WALLETS.map(renderWalletButton)}
            </div>
          </div>

          {/* 手动输入 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <button
                onClick={() => setShowManual(!showManual)}
                className="text-xs text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] transition-colors whitespace-nowrap"
              >
                {showManual ? t('wallet.backToWallets') : t('wallet.orManual')}
              </button>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {showManual && (
              <div className="space-y-3 animate-fade-in">
                <label htmlFor="wallet-address-input" className="sr-only">{t('wallet.addressLabel') || 'Wallet address'}</label>
                <input
                  ref={inputRef}
                  id="wallet-address-input"
                  type="text"
                  placeholder="0x..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  aria-describedby={error ? 'wallet-error' : undefined}
                  aria-invalid={!!error}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:shadow-[0_0_12px_rgba(79,143,255,0.12)] transition-all duration-200"
                />

                <p className="text-[11px] text-[var(--text-muted)] text-center">
                  {t('wallet.copyAddressHint')}
                </p>

                {error && (
                  <div id="wallet-error" role="alert" className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors focus-ring"
                >
                  {loading ? t('wallet.connecting') : t('wallet.connect')}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-4 pt-3 border-t border-[var(--border)] text-center shrink-0">
          {t('wallet.terms')}
        </p>
      </div>
    </div>
  );
}
