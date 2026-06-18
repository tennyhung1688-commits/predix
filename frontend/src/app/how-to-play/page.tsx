'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n/I18nProvider';

const STEPS = [
  { icon: 'wallet', key: 'step1' },
  { icon: 'deposit', key: 'step2' },
  { icon: 'market', key: 'step3' },
  { icon: 'trade', key: 'step4' },
  { icon: 'monitor', key: 'step5' },
  { icon: 'settle', key: 'step6' },
] as const;

const CONCEPTS = [
  { icon: 'binary', key: 'concept1' },
  { icon: 'price', key: 'concept2' },
  { icon: 'orderbook', key: 'concept3' },
  { icon: 'settlement', key: 'concept4' },
] as const;

const FAQ_ITEMS = [
  { key: 'faq1' },
  { key: 'faq2' },
  { key: 'faq3' },
  { key: 'faq4' },
  { key: 'faq5' },
  { key: 'faq6' },
] as const;

function StepIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'wallet':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="3"/><path d="M16 12a2 2 0 0 1 2-2h2v4h-2a2 2 0 0 1-2-2z"/><path d="M6 12h4"/>
        </svg>
      );
    case 'deposit':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
        </svg>
      );
    case 'market':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/>
        </svg>
      );
    case 'trade':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 7h4l3 9h6l3-6H7"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>
        </svg>
      );
    case 'monitor':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      );
    case 'settle':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      );
    case 'binary':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4"/>
        </svg>
      );
    case 'price':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>
        </svg>
      );
    case 'orderbook':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>
        </svg>
      );
    case 'settlement':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
        </svg>
      );
    default:
      return null;
  }
}

export default function HowToPlayPage() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="absolute inset-0 bg-[var(--gradient-hero)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-4">
            <Link href="/" className="hover:text-[var(--accent-blue)] transition-colors">PrediX</Link>
            <span>/</span>
            <span className="text-[var(--text-secondary)]">{t('howtoplay.breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--accent-purple)]/20 border border-[var(--accent-blue)]/20 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t('howtoplay.title')}</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{t('howtoplay.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-16">
        {/* Step-by-step Guide */}
        <section>
          <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center text-[var(--accent-blue)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </span>
            {t('howtoplay.stepsTitle')}
          </h2>
          <div className="space-y-6">
            {STEPS.map((step, idx) => (
              <div
                key={step.key}
                className="group relative flex gap-4 p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent-blue)]/30 hover:bg-[var(--bg-card-alt)] transition-all duration-300"
              >
                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div className="absolute left-[2.15rem] top-20 bottom-0 w-px bg-[var(--border)] group-hover:bg-[var(--accent-blue)]/20" />
                )}
                <div className="relative z-10 w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-blue)]/10 to-[var(--accent-purple)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center text-[var(--accent-blue)] shrink-0 group-hover:shadow-[var(--shadow-glow-blue)] transition-all">
                  <StepIcon icon={step.icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base mb-1.5">
                    {t(`howtoplay.${step.key}.title` as any)}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t(`howtoplay.${step.key}.desc` as any)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Key Concepts */}
        <section>
          <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent-purple)]/10 border border-[var(--accent-purple)]/20 flex items-center justify-center text-[var(--accent-purple)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 8-8 8"/><path d="m8 8 8 8"/></svg>
            </span>
            {t('howtoplay.conceptsTitle')}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {CONCEPTS.map(concept => (
              <div
                key={concept.key}
                className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent-purple)]/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-purple)]/10 border border-[var(--accent-purple)]/20 flex items-center justify-center text-[var(--accent-purple)] shrink-0">
                    <StepIcon icon={concept.icon} />
                  </div>
                  <h3 className="font-semibold text-sm">{t(`howtoplay.${concept.key}.title` as any)}</h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {t(`howtoplay.${concept.key}.desc` as any)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Price = Probability Visual */}
        <section>
          <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/20 flex items-center justify-center text-[var(--accent-amber)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg>
            </span>
            {t('howtoplay.priceTitle')}
          </h2>
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <p className="text-sm text-[var(--text-secondary)] mb-6">{t('howtoplay.priceDesc')}</p>
            <div className="space-y-3">
              {[
                { price: '0.01', prob: '1%', desc: 'howtoplay.priceLvl1' },
                { price: '0.10', prob: '10%', desc: 'howtoplay.priceLvl2' },
                { price: '0.25', prob: '25%', desc: 'howtoplay.priceLvl3' },
                { price: '0.50', prob: '50%', desc: 'howtoplay.priceLvl4' },
                { price: '0.75', prob: '75%', desc: 'howtoplay.priceLvl5' },
                { price: '0.99', prob: '99%', desc: 'howtoplay.priceLvl6' },
              ].map(item => (
                <div key={item.price} className="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-card-alt)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-12 text-xs font-mono text-[var(--text-muted)] shrink-0">${item.price}</span>
                    <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--green)] to-[var(--accent-emerald)] transition-all duration-700"
                        style={{ width: `${parseFloat(item.price) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-xs font-mono font-semibold text-[var(--text-primary)] shrink-0 text-right">{item.prob}</span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] hidden sm:block">{t(item.desc as any)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Settlement Flow */}
        <section>
          <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[var(--green)]/10 border border-[var(--green)]/20 flex items-center justify-center text-[var(--green)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
            </span>
            {t('howtoplay.settlementTitle')}
          </h2>
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-0">
              {[
                { label: 'howtoplay.settlementStep1', icon: 'A', color: 'var(--accent-blue)' },
                { label: 'howtoplay.settlementStep2', icon: 'B', color: 'var(--accent-amber)' },
                { label: 'howtoplay.settlementStep3', icon: 'C', color: 'var(--accent-purple)' },
                { label: 'howtoplay.settlementStep4', icon: '✓', color: 'var(--green)' },
              ].map((item, idx) => (
                <div key={item.icon} className="flex items-center gap-3 md:flex-1">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div
                      className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-bold shrink-0"
                      style={{ borderColor: item.color, color: item.color, backgroundColor: `${item.color}10` }}
                    >
                      {item.icon}
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] max-w-[120px] leading-relaxed">
                      {t(item.label as any)}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className="hidden md:flex items-center flex-1">
                      <div className="flex-1 h-0.5 bg-gradient-to-r from-[var(--border)] to-[var(--border)]" />
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent-cyan)]/10 border border-[var(--accent-cyan)]/20 flex items-center justify-center text-[var(--accent-cyan)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            {t('howtoplay.faqTitle')}
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq, idx) => (
              <div
                key={faq.key}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <span className="text-sm font-medium pr-4">{t(`howtoplay.${faq.key}.q` as any)}</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`}
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === idx ? 'max-h-96 pb-4 px-4' : 'max-h-0'
                  }`}
                >
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t(`howtoplay.${faq.key}.a` as any)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center pb-10">
          <p className="text-sm text-[var(--text-muted)] mb-4">{t('howtoplay.ready')}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] hover:from-[var(--accent-blue-hover)] hover:to-[var(--accent-purple)] text-white text-sm font-semibold transition-all duration-300 shadow-[0_2px_8px_rgba(79,143,255,0.25)] hover:shadow-[0_2px_20px_rgba(79,143,255,0.4)] active:scale-95"
          >
            {t('howtoplay.cta')}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
