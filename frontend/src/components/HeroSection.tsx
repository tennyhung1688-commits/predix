'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { formatVolume, formatPercent, countdown } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

interface HeroSectionProps {
  markets: any[];
}

export function HeroSection({ markets }: HeroSectionProps) {
  const { t, locale } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const featured = markets.slice(0, 5);

  // Infinite loop navigation
  const prev = useCallback(() => setCurrent(c => (c === 0 ? featured.length - 1 : c - 1)), [featured.length]);
  const next = useCallback(() => setCurrent(c => (c + 1) % featured.length), [featured.length]);

  // Autoplay — loop continuously
  useEffect(() => {
    if (featured.length <= 1 || isPaused) return;
    const timer = setInterval(() => next(), 4000);
    return () => clearInterval(timer);
  }, [featured.length, isPaused, next]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prev();
        setIsPaused(true);
        setTimeout(() => setIsPaused(false), 6000);
      } else if (e.key === 'ArrowRight') {
        next();
        setIsPaused(true);
        setTimeout(() => setIsPaused(false), 6000);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 60) {
      if (diff > 0) {
        next();
      } else {
        prev();
      }
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), 6000);
    }
  };

  // Pause on hover if user is interacting
  const pausePlay = () => { setIsPaused(true); };
  const resumePlay = () => { setIsPaused(false); };

  if (featured.length === 0) {
    return (
      <section className="relative bg-[var(--gradient-hero)] border-b border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse-slow text-[var(--text-muted)] text-sm">
              {t('home.loading')}...
            </div>
          </div>
        </div>
      </section>
    );
  }

  const total = featured.length;

  return (
    <section className="relative bg-gradient-to-b from-[var(--accent-blue)]/5 via-[var(--accent-purple)]/3 to-[var(--bg-primary)] border-b border-[var(--border)] overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[var(--accent-blue)]/[0.04] blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-[var(--accent-purple)]/[0.04] blur-3xl" />
      </div>

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Section header with counter */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-sm">✨</span>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-display">
              {t('home.featured')}
            </h2>
            {total > 1 && (
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {current + 1} / {total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Play/Pause indicator */}
            {total > 1 && (
              <button
                onClick={() => setIsPaused(p => !p)}
                className="h-7 w-7 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-bright)] hover:border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/10 transition-all duration-200"
                aria-label={isPaused ? t('home.play') : t('home.pause')}
                title={isPaused ? t('home.play') : t('home.pause')}
              >
                {isPaused ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="4" width="5" height="16" rx="1"/>
                    <rect x="14" y="4" width="5" height="16" rx="1"/>
                  </svg>
                )}
              </button>
            )}

            {/* Prev / Next arrows */}
            <button
              onClick={prev}
              className="h-7 w-7 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-bright)] hover:border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/10 transition-all duration-200"
              aria-label={t('home.previous')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button
              onClick={next}
              className="h-7 w-7 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-bright)] hover:border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/10 transition-all duration-200"
              aria-label={t('home.next')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Carousel track — touch enabled */}
        <div
          className="relative overflow-hidden rounded-2xl"
          onMouseEnter={pausePlay}
          onMouseLeave={resumePlay}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          ref={trackRef}
        >
          <div
            className="flex transition-transform duration-600 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {featured.map((m) => {
              const mTitle = locale === 'zh'
                ? (m.question_zh || m.title_zh || m.question || m.title)
                : (m.question || m.title || m.question_zh || m.title_zh);
              const mPrices = Array.isArray(m.outcomePrices) ? m.outcomePrices.map((p: any) => parseFloat(p)) : [];
              const mOutcomes = Array.isArray(m.outcomes) ? m.outcomes : [];
              const mIsBinary = mOutcomes.length === 2;
              const mTags = Array.isArray(m.tags) ? m.tags : [];
              const mCategory = mTags[0]?.label || '';
              const mVolume = parseFloat(m.volume24hr || m.volume || '0');
              const mImageSeed = m.id?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'hero';
              const mImageUrl = `https://loremflickr.com/1200/630?random=${mImageSeed}`;

              return (
                <div key={m.id || m.conditionId} className="w-full flex-shrink-0">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
                    {/* Featured card with image */}
                    <Link
                      href={`/market/${m.id || m.conditionId}`}
                      className="lg:col-span-2 group/card relative overflow-hidden rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-white/10 transition-all duration-300 min-h-[320px]"
                    >
                      <img
                        src={mImageUrl}
                        alt={mTitle}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Content overlay */}
                      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                        {mCategory && (
                          <span className="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-white/90 text-[var(--bg-primary)] font-semibold mb-3">
                            {mCategory}
                          </span>
                        )}
                        <h3 className="text-lg sm:text-xl font-bold text-white leading-tight mb-4 line-clamp-3 font-display drop-shadow-lg">
                          {mTitle}
                        </h3>

                        {/* Binary outcomes bar */}
                        {mIsBinary && (
                          <div className="mb-3">
                            <div className="flex justify-between mb-1.5 text-xs text-white/70">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
                                {mOutcomes[0]} {formatPercent(mPrices[0])}
                              </span>
                              <span className="flex items-center gap-1.5">
                                {formatPercent(mPrices[1])} {mOutcomes[1]}
                                <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
                              </span>
                            </div>
                            <div className="relative h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                              <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-400 rounded-l-full transition-all duration-700"
                                style={{ width: `${Math.max(mPrices[0] * 100, 2)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Volume */}
                        {mVolume > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-white/60">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                            </svg>
                            <span className="font-semibold">{formatVolume(mVolume)}</span>
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Side info panel */}
                    <div className="lg:col-span-3 flex flex-col justify-center gap-4 p-4 sm:p-6">
                      {m.description_zh || m.description ? (
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {m.description_zh || m.description}
                        </p>
                      ) : (
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                          {t('home.featuredDescription')}
                        </p>
                      )}

                      {/* Outcome pills */}
                      <div className="flex flex-wrap gap-2">
                        {mOutcomes.slice(0, 5).map((outcome: string, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/30 hover:text-[var(--text-primary)] transition-colors">
                            {outcome}
                            <span className="font-semibold tabular-nums text-[var(--text-bright)]">
                              {formatPercent(mPrices[i] || 0)}
                            </span>
                          </span>
                        ))}
                      </div>

                      {m.endDate && (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                          </svg>
                          {countdown(m.endDate, locale)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dot indicators + slide counter */}
        {total > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            {featured.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrent(i);
                  setIsPaused(true);
                  setTimeout(() => setIsPaused(false), 6000);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-6 bg-[var(--gradient-brand)] shadow-[0_0_6px_rgba(79,143,255,0.4)]'
                    : 'w-2 bg-[var(--border)] hover:bg-[var(--text-muted)]'
                }`}
                aria-label={`${t('home.slide')} ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
