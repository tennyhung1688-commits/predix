'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatVolume, truncateAddress, timeAgo } from '@/lib/utils';
import { useTranslation } from '@/i18n/I18nProvider';

interface InvitedUser {
  id: string;
  walletAddress: string;
  tradeVolume: number;
  createdAt: string;
}

interface Earning {
  id: string;
  referrerId: string;
  referredId: string;
  tradeId?: string;
  tradeFee: number;
  commission: number;
  rate: number;
  status: string;
  createdAt: string;
}

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalEarnings: number;
  pendingEarnings: number;
  invitedCount: number;
  invitedUsers: InvitedUser[];
  earnings: Earning[];
}

export default function ReferralPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invited' | 'earnings'>('invited');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getReferral()
      .then((res: any) => {
        if (!cancelled) setData(res?.data || null);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Failed to load referral data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCopy = useCallback((text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (!data) return;
    const shareData = {
      title: 'PrediX 预测市场',
      text: t('referral.shareText'),
      url: data.referralLink,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      handleCopy(data.referralLink, 'link');
    }
  }, [data, t, handleCopy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-muted)]">{error || t('leaderboard.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            🎁 {t('referral.title')}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{t('referral.subtitle')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-[var(--accent)] tabular-nums">
              ${data.totalEarnings.toFixed(2)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">
              {t('referral.totalEarnings')}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-[var(--yellow)] tabular-nums">
              ${data.pendingEarnings.toFixed(2)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">
              {t('referral.pendingEarnings')}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
              {data.invitedCount}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">
              {t('referral.invitedCount')}
            </div>
          </div>
        </div>

        {/* Referral Code & Link */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
          {/* Code */}
          <div className="mb-4">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">
              {t('referral.yourCode')}
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-lg font-mono font-bold text-[var(--accent)] tracking-widest text-center select-all">
                {data.referralCode}
              </code>
              <button
                onClick={() => handleCopy(data.referralCode, 'code')}
                className="px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-light)] transition-all"
              >
                {copied === 'code' ? '✅ ' + t('referral.copied') : t('referral.copyCode')}
              </button>
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block">
              {t('referral.yourLink')}
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-xs font-mono text-[var(--text-muted)] truncate select-all">
                {data.referralLink}
              </code>
              <button
                onClick={() => handleCopy(data.referralLink, 'link')}
                className="px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-light)] transition-all shrink-0"
              >
                {copied === 'link' ? '✅ ' + t('referral.copied') : t('referral.copyLink')}
              </button>
            </div>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="w-full mt-4 py-2.5 bg-[var(--accent)] text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            📤 {t('referral.shareText').slice(0, 30)}...
          </button>
        </div>

        {/* How It Works */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            💡 {t('referral.howItWorks')}
          </h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
              <span className="text-[var(--accent)] font-bold shrink-0">1.</span>
              {t('referral.rule1')}
            </li>
            <li className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
              <span className="text-[var(--accent)] font-bold shrink-0">2.</span>
              {t('referral.rule2')}
            </li>
            <li className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
              <span className="text-[var(--accent)] font-bold shrink-0">3.</span>
              {t('referral.rule3')}
            </li>
          </ul>
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">{t('referral.commissionRate')}</span>
            <span className="text-[var(--accent)] font-bold text-lg">20%</span>
          </div>
        </div>

        {/* Tabs: Invited Users / Earnings */}
        <div className="flex bg-[var(--bg-secondary)] rounded-lg p-1 mb-4">
          <button
            onClick={() => setActiveTab('invited')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'invited'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {t('referral.invitedUsers')} ({data.invitedCount})
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'earnings'
                ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {t('referral.earningsHistory')}
          </button>
        </div>

        {/* Invited Users List */}
        {activeTab === 'invited' && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            {data.invitedUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-3xl mb-3">👥</div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                  {t('referral.noInvitedUsers')}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('referral.noInvitedHint')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                <div className="grid grid-cols-[1fr_80px_100px] gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)]">
                  <span>{t('referral.user') || 'User'}</span>
                  <span className="text-right">{t('leaderboard.volume')}</span>
                  <span className="text-right">Joined</span>
                </div>
                {data.invitedUsers.map((u) => (
                  <div key={u.id} className="grid grid-cols-[1fr_80px_100px] gap-3 px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors">
                    <span className="font-mono text-[var(--text-primary)] truncate">
                      {truncateAddress(u.walletAddress)}
                    </span>
                    <span className="text-right tabular-nums text-[var(--text-muted)] text-xs">
                      {formatVolume(u.tradeVolume)}
                    </span>
                    <span className="text-right tabular-nums text-[var(--text-muted)] text-xs">
                      {timeAgo(u.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Earnings History */}
        {activeTab === 'earnings' && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            {data.earnings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-3xl mb-3">💰</div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                  {t('referral.noEarnings')}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('referral.noInvitedHint')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                <div className="grid grid-cols-[1fr_80px_70px] gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)]">
                  <span>{t('leaderboard.fee')}</span>
                  <span className="text-right">{t('leaderboard.volume')}</span>
                  <span className="text-right">Status</span>
                </div>
                {data.earnings.map((e) => (
                  <div key={e.id} className="grid grid-cols-[1fr_80px_70px] gap-3 px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs text-[var(--text-muted)] truncate">
                        {t('referral.earnFrom')}: {formatVolume(e.tradeFee)}
                      </span>
                      <span className="text-xs text-[var(--accent)] font-medium">
                        +${e.commission.toFixed(4)}
                      </span>
                    </div>
                    <span className="text-right tabular-nums text-[var(--text-muted)] text-xs self-center">
                      {e.rate * 100}%
                    </span>
                    <span className={`text-right text-xs self-center font-medium ${
                      e.status === 'credited' ? 'text-[var(--green)]' :
                      e.status === 'pending' ? 'text-[var(--yellow)]' :
                      'text-[var(--text-muted)]'
                    }`}>
                      {e.status === 'credited' ? '✓' : e.status === 'pending' ? '⏳' : e.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
