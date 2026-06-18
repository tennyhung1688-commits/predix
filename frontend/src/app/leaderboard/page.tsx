'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatVolume, truncateAddress } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  tradeVolume: number;
  feePaid: number;
  balance: number;
}

const PERIODS = [
  { key: 'weekly', labelKey: 'leaderboard.weekly' },
  { key: 'monthly', labelKey: 'leaderboard.monthly' },
  { key: 'all', labelKey: 'leaderboard.allTime' },
] as const;

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<string>('all');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.getLeaderboard(period)
      .then((res: any) => {
        if (!cancelled) {
          setData(res?.data || []);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Failed to load leaderboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [period]);

  // 排名奖牌图标
  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            {t('leaderboard.title')}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {t('leaderboard.subtitle')}
          </p>
        </div>

        {/* Period Tabs */}
        <div className="flex justify-center gap-1 mb-6 p-1 bg-[var(--bg-secondary)] rounded-lg w-fit mx-auto">
          {PERIODS.map(({ key, labelKey }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-4 py-2 text-sm rounded-md font-medium transition-all duration-200 ${
                period === key
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-[var(--text-muted)]">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-lg font-medium text-[var(--text-primary)] mb-1">
              {t('leaderboard.noData')}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {t('leaderboard.noDataHint')}
            </p>
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[48px_1fr_repeat(3,minmax(100px,1fr))] gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)] border-b border-[var(--border)]">
              <span className="text-center">#</span>
              <span>{t('leaderboard.user')}</span>
              <span className="text-right">{t('leaderboard.volume')}</span>
              <span className="text-right">{t('leaderboard.fee')}</span>
              <span className="text-right">{t('leaderboard.balance')}</span>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-[var(--border)]">
              {data.map((entry) => {
                const badge = getRankBadge(entry.rank);
                const isTop3 = entry.rank <= 3;

                return (
                  <div
                    key={entry.walletAddress}
                    className={`grid grid-cols-[48px_1fr_repeat(3,minmax(100px,1fr))] gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--bg-hover)] ${
                      isTop3 ? 'bg-[var(--accent)]/5' : ''
                    }`}
                  >
                    {/* Rank */}
                    <span className={`text-center font-bold tabular-nums ${
                      isTop3 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                    }`}>
                      {badge ? (
                        <span className="text-lg">{badge}</span>
                      ) : (
                        entry.rank
                      )}
                    </span>

                    {/* Wallet */}
                    <span className="font-mono text-[var(--text-primary)] truncate">
                      {truncateAddress(entry.walletAddress)}
                    </span>

                    {/* Volume */}
                    <span className="text-right tabular-nums text-[var(--text-primary)] font-medium">
                      {formatVolume(entry.tradeVolume)}
                    </span>

                    {/* Fees */}
                    <span className="text-right tabular-nums text-[var(--text-muted)]">
                      {formatVolume(entry.feePaid)}
                    </span>

                    {/* Balance */}
                    <span className="text-right tabular-nums text-[var(--text-muted)]">
                      ${entry.balance.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        {data.length > 0 && (
          <p className="text-center text-[10px] text-[var(--text-muted)] mt-4">
            {data.length} {t('leaderboard.topTraders').toLowerCase()}
          </p>
        )}
      </div>
    </div>
  );
}
