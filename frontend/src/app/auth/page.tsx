'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/Providers';
import { useTranslation } from '@/i18n/I18nProvider';

type AuthMode = 'login' | 'signup';

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
}

export default function AuthPage() {
  const router = useRouter();
  const { login, user } = useApp();
  const { t } = useTranslation();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Wallet manual input — aligned with WalletModal mock-connect pattern
  const [address, setAddress] = useState('');
  const [showWalletInput, setShowWalletInput] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const walletInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Redirect if already logged in
  if (user) {
    router.replace('/');
    return null;
  }

  // Escape 键关闭 + 焦点陷阱
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { router.back(); return; }
      if (e.key === 'Tab') {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
        else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const prevFocus = document.activeElement as HTMLElement;
    return () => { document.removeEventListener('keydown', handleKeyDown); prevFocus?.focus(); };
  }, []);

  // Auto-focus wallet address input when shown
  useEffect(() => {
    if (showWalletInput) walletInputRef.current?.focus();
  }, [showWalletInput]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!email.trim()) {
      newErrors.email = t('auth.invalidEmail');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.invalidEmail');
    }

    if (!password || password.length < 6) {
      newErrors.password = t('auth.passwordMinLength');
    }

    if (mode === 'signup') {
      if (!username.trim()) {
        newErrors.username = t('auth.usernameRequired');
      }
      if (password && confirmPassword && password !== confirmPassword) {
        newErrors.confirmPassword = t('auth.passwordMismatch');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Simulate API call — replace with real endpoint when backend supports email/password auth
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (mode === 'login') {
        setMessage({ type: 'success', text: t('auth.loginSuccess') });
      } else {
        setMessage({ type: 'success', text: t('auth.signupSuccess') });
      }
    } catch {
      if (mode === 'login') {
        setMessage({ type: 'error', text: t('auth.loginFailed') });
      } else {
        setMessage({ type: 'error', text: t('auth.signupFailed') });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWalletConnect = () => {
    setWalletError('');
    setMessage(null);
    // 直接打开手动输入，让用户粘贴真实地址
    setAddress('');
    setShowWalletInput(true);
  };

  const handleWalletSubmit = async () => {
    const trimmed = address.trim();
    if (!trimmed) {
      setWalletError(t('wallet.enterAddress'));
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setWalletError(t('wallet.invalidAddress'));
      return;
    }

    setWalletLoading(true);
    setWalletError('');
    try {
      await login(trimmed);
      router.replace('/');
    } catch (err: unknown) {
      setWalletError(
        err instanceof Error ? err.message : t('wallet.connectFailed')
      );
    } finally {
      setWalletLoading(false);
    }
  };

  const switchMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setErrors({});
    setMessage(null);
  };

  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Modal Container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby={message ? 'auth-message' : undefined}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center px-6 pt-6 pb-2">
          <h2 id="auth-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
            {mode === 'login' ? t('auth.login') : t('auth.signup')}
          </h2>
          <button
            onClick={() => router.back()}
            className="absolute right-4 top-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus-ring rounded-lg p-1"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 mx-6 mt-2 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'login'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t('auth.login')}
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'signup'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t('auth.signup')}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pt-5 pb-6 space-y-4">
          {/* Username — signup only */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                {t('auth.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearFieldError('username');
                }}
                placeholder={t('auth.usernamePlaceholder')}
                className={`w-full px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors ${
                  errors.username
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-[var(--border)] focus:border-[var(--accent-blue)]'
                }`}
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-400">{errors.username}</p>
              )}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              className={`w-full px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors ${
                errors.email
                  ? 'border-red-500/50 focus:border-red-500'
                  : 'border-[var(--border)] focus:border-[var(--accent-blue)]'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={`w-full px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors ${
                errors.password
                  ? 'border-red-500/50 focus:border-red-500'
                  : 'border-[var(--border)] focus:border-[var(--accent-blue)]'
              }`}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password — signup only */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearFieldError('confirmPassword');
                }}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                autoComplete="new-password"
                className={`w-full px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors ${
                  errors.confirmPassword
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-[var(--border)] focus:border-[var(--accent-blue)]'
                }`}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* Message */}
          {message && (
            <div
              id="auth-message"
              className={`text-xs rounded-lg px-3 py-2 ${
                message.type === 'success'
                  ? 'text-green-400 bg-green-500/5 border border-green-500/20'
                  : 'text-red-400 bg-red-500/5 border border-red-500/20'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors focus-ring"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {mode === 'login' ? t('auth.loginBtn') : t('auth.signupBtn')}
              </span>
            ) : mode === 'login' ? (
              t('auth.loginBtn')
            ) : (
              t('auth.signupBtn')
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
              {t('auth.orContinueWith')}
            </span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {/* Wallet Connect */}
          {!showWalletInput ? (
            <button
              type="button"
              onClick={handleWalletConnect}
              className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent-blue)] text-sm font-medium text-[var(--text-primary)] transition-all duration-200 focus-ring flex items-center justify-center gap-2"
            >
              {/* Wallet Icon SVG */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M16 12h4" />
                <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
              </svg>
              {t('auth.connectWallet')}
            </button>
          ) : (
            <div className="space-y-3 animate-fade-in">
              <label htmlFor="auth-wallet-input" className="sr-only">
                {t('wallet.addressLabel') || 'Wallet address'}
              </label>
              <div className="flex gap-2">
                <input
                  ref={walletInputRef}
                  id="auth-wallet-input"
                  type="text"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  aria-describedby={walletError ? 'auth-wallet-error' : undefined}
                  aria-invalid={!!walletError}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:shadow-[0_0_12px_rgba(79,143,255,0.12)] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowWalletInput(false);
                    setWalletError('');
                    setAddress('');
                  }}
                  className="px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--accent-blue)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all duration-200 focus-ring shrink-0"
                >
                  {t('wallet.backToWallets')}
                </button>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] text-center">
                {t('wallet.copyAddressHint')}
              </p>

              {walletError && (
                <div
                  id="auth-wallet-error"
                  role="alert"
                  className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2"
                >
                  {walletError}
                </div>
              )}

              <button
                type="button"
                onClick={handleWalletSubmit}
                disabled={walletLoading}
                className="w-full py-2.5 rounded-xl bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors focus-ring"
              >
                {walletLoading
                  ? t('wallet.connecting')
                  : t('wallet.connect')}
              </button>
            </div>
          )}

          {/* Footer Link */}
          <p className="text-center text-xs text-[var(--text-muted)]">
            {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
            <button
              type="button"
              onClick={switchMode}
              className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] font-medium transition-colors focus-ring rounded"
            >
              {mode === 'login' ? t('auth.signup') : t('auth.login')}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
