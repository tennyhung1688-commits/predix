'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useApp } from './Providers';
import { WalletModal } from './WalletModal';
import { truncateAddress } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

export function Navbar() {
  const { user, logout } = useApp();
  const { t, locale, setLocale } = useTranslation();
  const [showWallet, setShowWallet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  const toggleLang = () => {
    setLocale(locale === 'zh' ? 'en' : 'zh');
  };

  const closeMobileNav = () => setShowMobileNav(false);

  const navLinks = [
    { href: '/', label: t('nav.markets'), highlight: false },
    { href: '/world-cup', label: t('nav.sports'), highlight: false },
    { href: '/?tab=politics', label: t('nav.politics'), highlight: false },
    { href: '/?tab=crypto', label: t('nav.crypto'), highlight: false },
    { href: '/dashboard', label: t('nav.smartMoney'), highlight: true },
    { href: '/how-to-play', label: t('nav.howToPlay'), highlight: false },
    { href: '/terms', label: t('nav.terms'), highlight: false },

    { href: '/leaderboard', label: t('nav.leaderboard'), highlight: false },
    { href: '/referral', label: t('nav.referral'), highlight: false },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="max-w-[1440px] mx-auto px-4 h-14 flex items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <Image
                src="/logo-icon.svg"
                alt="PrediX"
                width={30}
                height={30}
                className="shrink-0 transition-transform duration-200 group-hover:scale-105"
                priority
              />
              <span className="font-bold text-lg tracking-tight font-display">
                Predi<span className="text-gradient-brand">X</span>
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200 relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-0.5 after:bg-[var(--accent-blue)] after:rounded-full after:transition-all hover:after:w-3/4"
              >
                {t('nav.markets')}
              </Link>
              <Link
                href="/world-cup"
                className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
              >
                {t('nav.sports')}
              </Link>
              <Link
                href="/?tab=politics"
                className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
              >
                {t('nav.politics')}
              </Link>
              <Link
                href="/?tab=crypto"
                className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
              >
                {t('nav.crypto')}
              </Link>
              <Link
                href="/?tab=weather"
                className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
              >
                🌤️ {t('nav.weather')}
              </Link>
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-md text-sm font-semibold text-[var(--accent-amber)] hover:text-[var(--accent-amber)] hover:bg-[var(--accent-amber)]/10 transition-all duration-200 flex items-center gap-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M12 4c-2 0-5 1.5-6 5-1 3.5 1 9 6 9s7-5.5 6-9c-1-3.5-4-5-6-5z"/><circle cx="10" cy="9" r="1.5"/><path d="M5 8.5C3 7.5 2 9 2 11s2 3 3 2"/><path d="M19 7c2-2 4-1 4 1"/></svg> {t('nav.smartMoney')}
              </Link>
              <Link
                href="/how-to-play"
                className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
              >
                {t('nav.howToPlay')}
              </Link>
              <Link
                href="/terms"
                className="px-3 py-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
              >
                {t('nav.terms')}
              </Link>
              <Link
                href="/referral"
                className="px-3 py-1.5 rounded-md text-sm text-[var(--accent-amber)] hover:text-[var(--accent-amber)] hover:bg-[var(--accent-amber)]/10 transition-all duration-200 font-semibold"
              >
                🎁 {t('nav.referral')}
              </Link>

            </div>
          </div>

          {/* Right: Lang + Wallet + Hamburger */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Language Switch - hide on very small screens */}
            <button
              onClick={toggleLang}
              className="hidden sm:block px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] hover:border-[var(--accent-cyan)]/30 hover:shadow-[0_0_12px_rgba(34,211,238,0.10)] hover:bg-[var(--accent-cyan)]/5 transition-all duration-300"
            >
              {t('lang.switch')}
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/5 transition-all duration-200 text-sm group"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] flex items-center justify-center text-[10px] text-white font-bold">
                    {user.walletAddress ? user.walletAddress.slice(2, 4).toUpperCase() : (user.username?.[0] || user.email?.[0] || '?').toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {user.walletAddress ? truncateAddress(user.walletAddress) : (user.username || user.email?.split('@')[0] || 'User')}
                  </span>
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-elevated)] z-20 py-1 animate-fade-in-scale origin-top-right">
                      <div className="px-3 py-2 border-b border-[var(--border)]">
                        <div className="text-xs text-[var(--text-muted)]">{t('nav.tradeVolume')}</div>
                        <div className="text-sm font-semibold bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-cyan)] bg-clip-text text-transparent">${user.tradeVolume?.toFixed(2) || '0.00'}</div>
                        {user.balance !== undefined && (
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            余额: <span className="text-[var(--text-primary)] font-medium">{user.balance.toFixed(2)} USDC</span>
                            {user.lockedBalance > 0 && (
                              <span className="text-[var(--text-muted)]"> (已锁 {user.lockedBalance.toFixed(2)})</span>
                            )}
                          </div>
                        )}
                      </div>
                      <Link
                        href="/orders"
                        onClick={() => setShowMenu(false)}
                        className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><path d="M9 14h6"/><path d="M9 18h6"/><path d="M9 10h6"/></svg> {t('nav.myOrders')}
                      </Link>
                      <Link
                        href="/positions"
                        onClick={() => setShowMenu(false)}
                        className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg> 我的持仓
                      </Link>
                      <Link
                        href="/balance"
                        onClick={() => setShowMenu(false)}
                        className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8"/><path d="M12 18V6"/></svg> 余额与充值
                      </Link>
                      <hr className="my-1 border-[var(--border)]" />
                      <Link
                        href="/admin"
                        onClick={() => setShowMenu(false)}
                        className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> 管理后台
                      </Link>
                      <button
                        onClick={() => { logout(); setShowMenu(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--red-bg)] hover:text-[var(--red)] transition-all duration-150"
                      >
                        {t('nav.disconnect')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth"
                  className="px-3 md:px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:from-[var(--accent-blue-hover)] hover:to-[var(--accent-purple)] text-white text-xs md:text-sm font-semibold transition-all duration-300 shadow-[0_2px_8px_rgba(79,143,255,0.25)] hover:shadow-[0_2px_20px_rgba(79,143,255,0.4)] active:scale-95"
                >
                  {t('nav.login')}
                </Link>
              </div>
            )}

            {/* Hamburger Button - Mobile only */}
            <button
              onClick={() => setShowMobileNav(true)}
              className="md:hidden p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all"
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Drawer */}
      {showMobileNav && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden animate-fade-in"
            onClick={closeMobileNav}
          />
          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 w-64 bg-[var(--bg-secondary)] border-r border-[var(--border)] z-50 md:hidden animate-fade-in shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
              <Link href="/" onClick={closeMobileNav} className="flex items-center gap-2">
                <Image
                  src="/logo-icon.svg"
                  alt="PrediX"
                  width={26}
                  height={26}
                  className="shrink-0"
                />
                <span className="font-bold text-base font-display">
                  Predi<span className="text-gradient-brand">X</span>
                </span>
              </Link>
              <button
                onClick={closeMobileNav}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="关闭菜单"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Language Switch - inside drawer on smallest screens */}
            <div className="sm:hidden px-4 py-3 border-b border-[var(--border)]">
              <button
                onClick={toggleLang}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent-cyan)]/30 hover:text-[var(--accent-cyan)] transition-all"
              >
                {t('lang.switch')}
              </button>
            </div>

            {/* Nav Links */}
            <div className="flex-1 py-3 px-2 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileNav}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                    link.highlight
                      ? 'font-semibold text-[var(--accent-amber)] hover:bg-[var(--accent-amber)]/10'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {link.highlight && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="M12 4c-2 0-5 1.5-6 5-1 3.5 1 9 6 9s7-5.5 6-9c-1-3.5-4-5-6-5z"/><circle cx="10" cy="9" r="1.5"/><path d="M5 8.5C3 7.5 2 9 2 11s2 3 3 2"/><path d="M19 7c2-2 4-1 4 1"/></svg>
                  )}
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Drawer Footer */}
            <div className="px-4 py-3 border-t border-[var(--border)]">
              {user ? (
                <div className="space-y-2">
                  <div className="text-[10px] text-[var(--text-muted)]">{t('nav.tradeVolume')}</div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    ${user.tradeVolume?.toFixed(2) || '0.00'}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { closeMobileNav(); setShowWallet(true); }}
                  className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white text-sm font-semibold transition-all duration-300"
                >
                  {t('nav.connectWallet')}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {showWallet && <WalletModal onClose={() => setShowWallet(false)} />}
    </>
  );
}
