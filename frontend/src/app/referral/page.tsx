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
  level: number;
  status: string;
  createdAt: string;
}

interface TierInfo {
  tier: string;
  label: string;
  l1Rate: number;
  l2Rate: number;
}

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  totalCommission: number;
  referralCount: number;
}

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalEarnings: number;
  pendingEarnings: number;
  l1Earnings: number;
  l2Earnings: number;
  invitedCount: number;
  tier: TierInfo;
  invitedUsers: InvitedUser[];
  l2Users: InvitedUser[];
  earnings: Earning[];
}

const TIER_GRADIENTS: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-slate-400 to-slate-300',
  gold: 'from-yellow-500 to-yellow-300',
  diamond: 'from-cyan-400 to-blue-400',
};

const TIER_NEXT: Record<string, { label: string; need: number } | null> = {
  bronze: { label: '🥈 白银', need: 5 },
  silver: { label: '🥇 黄金', need: 20 },
  gold: { label: '💎 钻石', need: 50 },
  diamond: null,
};

export default function ReferralPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invited' | 'l2' | 'earnings'>('invited');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbPeriod, setLbPeriod] = useState<'all' | 'month'>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getReferral(),
      api.getReferralLeaderboard(lbPeriod),
    ])
      .then(([refRes, lbRes]: any[]) => {
        if (!cancelled) {
          setData(refRes?.data || null);
          setLeaderboard(lbRes?.data || []);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lbPeriod]);

  const handleCopy = useCallback((text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (!data) return;
    const shareData = { title: 'PrediX', text: '来 PrediX 一起预测未来！', url: data.referralLink };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      handleCopy(data.referralLink, 'link');
    }
  }, [data, handleCopy]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent-blue)] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">{error || 'No data'}</p>
      </div>
    );
  }

  const nextTier = TIER_NEXT[data.tier.tier];

  return (
    <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1">🎁 邀请好友，赚取返佣</h1>
        <p className="text-sm text-[var(--text-muted)]">邀请好友交易，获取手续费分佣。邀请越多，等级越高！</p>
      </div>

      {/* Tier Card */}
      <div className={`bg-gradient-to-r ${TIER_GRADIENTS[data.tier.tier] || 'from-slate-600 to-slate-500'} rounded-2xl p-5 mb-6 text-white relative overflow-hidden`}>
        <div className="absolute top-2 right-3 text-4xl opacity-20">
          {data.tier.tier === 'diamond' ? '💎' : data.tier.tier === 'gold' ? '👑' : data.tier.tier === 'silver' ? '🥈' : '🥉'}
        </div>
        <div className="relative z-10">
          <div className="text-xs font-medium opacity-80 mb-1">当前等级</div>
          <div className="text-2xl font-bold mb-4">{data.tier.label}</div>
          <div className="flex gap-6 mb-4">
            <div>
              <div className="text-2xl font-bold tabular-nums">{(data.tier.l1Rate * 100).toFixed(0)}%</div>
              <div className="text-[10px] opacity-70">直接邀请返佣</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{data.tier.l2Rate > 0 ? (data.tier.l2Rate * 100).toFixed(0) + '%' : '—'}</div>
              <div className="text-[10px] opacity-70">间接邀请返佣</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{data.invitedCount}</div>
              <div className="text-[10px] opacity-70">已邀请</div>
            </div>
          </div>
          {nextTier && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="flex justify-between text-xs mb-1">
                <span className="opacity-70">距离 {nextTier.label}</span>
                <span className="font-medium">{data.invitedCount}/{nextTier.need} 人</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, (data.invitedCount / nextTier.need) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {[
          { label: '累计收入', value: `$${data.totalEarnings.toFixed(2)}`, color: 'text-[var(--accent-green)]' },
          { label: '待领取', value: `$${data.pendingEarnings.toFixed(2)}`, color: 'text-[var(--accent-amber)]' },
          { label: '直接返佣', value: `$${data.l1Earnings.toFixed(2)}`, color: 'text-[var(--accent-blue)]' },
          { label: '间接返佣', value: `$${data.l2Earnings.toFixed(2)}`, color: 'text-[var(--accent-purple)]' },
        ].map(s => (
          <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-2.5 text-center">
            <div className={`text-sm font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral Link */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
        <div className="mb-3">
          <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">推荐码</div>
          <div className="flex gap-2">
            <code className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-lg font-mono font-bold text-[var(--accent-blue)] text-center select-all">{data.referralCode}</code>
            <button onClick={() => handleCopy(data.referralCode, 'code')}
              className="px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--bg-hover)] transition-colors">
              {copied === 'code' ? '✅' : '📋'}
            </button>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1">推荐链接</div>
          <div className="flex gap-2">
            <code className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-xs font-mono text-[var(--text-muted)] truncate select-all">{data.referralLink}</code>
            <button onClick={() => handleCopy(data.referralLink, 'link')}
              className="px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--bg-hover)] transition-colors shrink-0">
              {copied === 'link' ? '✅' : '📋'}
            </button>
          </div>
        </div>
        <button onClick={handleShare}
          className="w-full mt-4 py-2.5 bg-[var(--accent-blue)] text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity">
          📤 分享给好友
        </button>
      </div>

      {/* How It Works */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold mb-3">💡 玩法说明</h3>
        <div className="grid grid-cols-2 gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex gap-2">
            <span className="text-[var(--accent-blue)] font-bold">1.</span>
            <span>分享推荐码或链接给好友</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[var(--accent-blue)] font-bold">2.</span>
            <span>好友注册时填写你的推荐码</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[var(--accent-blue)] font-bold">3.</span>
            <span>好友交易 → 你获得手续费 20%-35% 返佣</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[var(--accent-blue)] font-bold">4.</span>
            <span>好友再邀请 → 你额外获得 5%-15% 间接返佣</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--bg-secondary)] rounded-lg p-1 mb-4">
        {[
          { key: 'invited' as const, label: `直接 (${data.invitedCount})` },
          { key: 'l2' as const, label: `间接 (${data.l2Users.length})` },
          { key: 'earnings' as const, label: '佣金记录' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.key ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-muted)]'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lists */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden mb-6">
        {activeTab === 'invited' && (
          data.invitedUsers.length === 0 ? (
            <div className="text-center py-12"><div className="text-3xl mb-2">👥</div><p className="text-sm text-[var(--text-muted)]">还没有邀请好友</p></div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              <div className="grid grid-cols-[1fr_70px_90px] px-4 py-2.5 text-[10px] text-[var(--text-muted)] bg-[var(--bg-secondary)]">
                <span>用户</span><span className="text-right">交易量</span><span className="text-right">加入时间</span>
              </div>
              {data.invitedUsers.map(u => (
                <div key={u.id} className="grid grid-cols-[1fr_70px_90px] px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)]">
                  <span className="font-mono text-[var(--text-primary)] truncate">{truncateAddress(u.walletAddress)}</span>
                  <span className="text-right text-xs text-[var(--text-muted)]">{formatVolume(u.tradeVolume)}</span>
                  <span className="text-right text-xs text-[var(--text-muted)]">{timeAgo(u.createdAt)}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'l2' && (
          data.l2Users.length === 0 ? (
            <div className="text-center py-12"><div className="text-3xl mb-2">🔄</div><p className="text-sm text-[var(--text-muted)]">还没有间接邀请</p></div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              <div className="grid grid-cols-[1fr_70px_90px] px-4 py-2.5 text-[10px] text-[var(--text-muted)] bg-[var(--bg-secondary)]">
                <span>用户</span><span className="text-right">交易量</span><span className="text-right">加入时间</span>
              </div>
              {data.l2Users.map(u => (
                <div key={u.id} className="grid grid-cols-[1fr_70px_90px] px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)]">
                  <span className="font-mono text-[var(--text-primary)] truncate">{truncateAddress(u.walletAddress)}</span>
                  <span className="text-right text-xs text-[var(--text-muted)]">{formatVolume(u.tradeVolume)}</span>
                  <span className="text-right text-xs text-[var(--text-muted)]">{timeAgo(u.createdAt)}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'earnings' && (
          data.earnings.length === 0 ? (
            <div className="text-center py-12"><div className="text-3xl mb-2">💰</div><p className="text-sm text-[var(--text-muted)]">还没有佣金收入</p></div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              <div className="grid grid-cols-[1fr_70px_60px_50px] px-4 py-2.5 text-[10px] text-[var(--text-muted)] bg-[var(--bg-secondary)]">
                <span>来源</span><span className="text-right">手续费</span><span className="text-right">佣金</span><span className="text-right">层级</span>
              </div>
              {data.earnings.map(e => (
                <div key={e.id} className="grid grid-cols-[1fr_70px_60px_50px] px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)]">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-[var(--text-muted)] truncate">{formatVolume(e.tradeFee)}</span>
                    <span className={`text-xs font-medium ${e.status === 'credited' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-amber)]'}`}>
                      {e.status === 'credited' ? '+$' : '⏳ $'}{e.commission.toFixed(4)}
                    </span>
                  </div>
                  <span className="text-right text-xs text-[var(--text-muted)] self-center">{e.rate * 100}%</span>
                  <span className="text-right text-xs text-[var(--text-muted)] self-center">{timeAgo(e.createdAt)}</span>
                  <span className={`text-right text-xs font-bold self-center ${e.level === 1 ? 'text-[var(--accent-blue)]' : 'text-[var(--accent-purple)]'}`}>
                    L{e.level}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Leaderboard */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">🏆 返佣排行榜</h3>
          <div className="flex bg-[var(--bg-secondary)] rounded-md p-0.5 text-xs">
            {(['all', 'month'] as const).map(p => (
              <button key={p} onClick={() => setLbPeriod(p)}
                className={`px-3 py-1 rounded transition-all ${lbPeriod === p ? 'bg-[var(--bg-card)] text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                {p === 'all' ? '总榜' : '本月'}
              </button>
            ))}
          </div>
        </div>
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">暂无数据</div>
        ) : (
          <div className="space-y-1">
            {leaderboard.slice(0, 20).map(entry => (
              <div key={entry.rank} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
                <span className={`w-6 text-center text-sm font-bold ${
                  entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-slate-300' : entry.rank === 3 ? 'text-amber-600' : 'text-[var(--text-muted)]'
                }`}>
                  {entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </span>
                <span className="font-mono text-xs text-[var(--text-primary)] flex-1 truncate">{truncateAddress(entry.walletAddress)}</span>
                <span className="text-xs text-[var(--accent-green)] font-medium tabular-nums">${entry.totalCommission.toFixed(2)}</span>
                <span className="text-[10px] text-[var(--text-muted)] w-8 text-right">{entry.referralCount}人</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
