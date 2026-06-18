'use client';

import { useTranslation } from '@/i18n/I18nProvider';
import Link from 'next/link';

const SECTIONS = [
  'overview', 'eligibility', 'account', 'trading',
  'fees', 'risk', 'ip', 'liability', 'privacy', 'changes', 'contact',
] as const;

function SectionIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    doc: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
      </svg>
    ),
    user: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    lock: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    trade: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/>
      </svg>
    ),
    coin: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>
      </svg>
    ),
    warn: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
      </svg>
    ),
    bulb: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
      </svg>
    ),
    shield: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    eye: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    refresh: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    ),
    mail: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m22 6-10 7L2 6"/>
      </svg>
    ),
  };
  return icons[icon] || null;
}

const SECTION_ICONS: Record<string, string> = {
  overview: 'doc',
  eligibility: 'user',
  account: 'lock',
  trading: 'trade',
  fees: 'coin',
  risk: 'warn',
  ip: 'bulb',
  liability: 'shield',
  privacy: 'eye',
  changes: 'refresh',
  contact: 'mail',
};

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="absolute inset-0 bg-[var(--gradient-hero)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-4">
            <Link href="/" className="hover:text-[var(--accent-blue)] transition-colors">PrediX</Link>
            <span>/</span>
            <span className="text-[var(--text-secondary)]">{t('terms.breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-purple)]/20 to-[var(--accent-amber)]/20 border border-[var(--accent-purple)]/20 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t('terms.title')}</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{t('terms.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Last Updated */}
        <p className="text-xs text-[var(--text-muted)] mb-8">{t('terms.lastUpdated')}</p>

        {/* Table of Contents */}
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] mb-10">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-blue)]">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h2"/><path d="M8 17h6"/><path d="M8 9h2"/>
            </svg>
            {t('terms.tocTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {SECTIONS.map((section, idx) => (
              <a
                key={section}
                href={`#${section}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/5 transition-all duration-200"
              >
                <span className="w-5 h-5 rounded-md bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center text-[10px] font-mono text-[var(--accent-blue)] shrink-0">
                  {idx + 1}
                </span>
                {t(`terms.${section}.title` as any)}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((section, idx) => (
            <section
              key={section}
              id={section}
              className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] scroll-mt-20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-blue)] shrink-0">
                  <SectionIcon icon={SECTION_ICONS[section]} />
                </div>
                <h2 className="text-base font-bold">
                  <span className="text-[var(--text-muted)] font-mono text-xs mr-2">{idx + 1}.</span>
                  {t(`terms.${section}.title` as any)}
                </h2>
              </div>
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed space-y-3 whitespace-pre-line">
                {(t(`terms.${section}.content` as any) as string)?.split('\n\n').map((paragraph: string, pIdx: number) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer acknowledgment */}
        <div className="mt-10 p-5 rounded-xl border border-[var(--accent-amber)]/20 bg-[var(--accent-amber)]/5">
          <p className="text-xs text-[var(--text-muted)] text-center leading-relaxed">
            {t('terms.acknowledgment')}
          </p>
        </div>
      </div>
    </div>
  );
}
