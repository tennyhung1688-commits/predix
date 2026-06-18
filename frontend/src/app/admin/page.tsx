'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/components/Providers';
import type { AdminOverview, RevenueRecord, PlatformTrade, Withdraw, SettlementStats, MarketResolution, SettlementRecord, SettleResult, AutoCheckResult } from '@/types';

const ADMIN_TABS = ['overview', 'trades', 'withdraws', 'settlements'] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

const TAB_LABELS: Record<AdminTab, string> = {
  overview: '📊 总览',
  trades: '📋 交易',
  withdraws: '💸 提现',
  settlements: '🏆 结算',
};

export default function AdminPage() {
  const { user } = useApp();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [revenue, setRevenue] = useState<{ records: RevenueRecord[]; daily: { date: string; amount: number }[] } | null>(null);
  const [trades, setTrades] = useState<PlatformTrade[]>([]);
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // 结算相关状态
  const [settlementStats, setSettlementStats] = useState<SettlementStats | null>(null);
  const [resolvedMarkets, setResolvedMarkets] = useState<MarketResolution[]>([]);
  const [adminSettlements, setAdminSettlements] = useState<SettlementRecord[]>([]);
  const [settleForm, setSettleForm] = useState({ marketId: '', outcomeTokenId: '', outcomeLabel: '', question: '' });
  const [settleResult, setSettleResult] = useState<SettleResult | null>(null);
  const [autoCheckResult, setAutoCheckResult] = useState<AutoCheckResult | null>(null);
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [ov, rev, tr, wd, sts, stMkts, stRecs] = await Promise.all([
        api.getAdminOverview().catch(() => null),
        api.getAdminRevenue(30).catch(() => null),
        api.getAdminTrades(1, 50).catch(() => []),
        api.getAdminWithdraws('pending').catch(() => []),
        api.getAdminSettlementStats().catch(() => null),
        api.getAdminSettlementMarkets(1, 50).catch(() => null),
        api.getAdminSettlements(1, 50).catch(() => null),
      ]);

      const ovData = (ov as any)?.data;
      const revData = (rev as any)?.data;
      const trData = (tr as any)?.data?.trades || [];
      const wdData = (wd as any)?.data || [];
      const stsData = (sts as any)?.data;
      const stMktsData = (stMkts as any)?.data?.markets || [];
      const stRecsData = (stRecs as any)?.data?.settlements || [];

      if (ovData) setOverview(ovData);
      if (revData) setRevenue(revData);
      setTrades(trData);
      setWithdraws(wdData);
      if (stsData) setSettlementStats(stsData);
      setResolvedMarkets(stMktsData);
      setAdminSettlements(stRecsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettlementData() {
    try {
      const [sts, stMkts, stRecs] = await Promise.all([
        api.getAdminSettlementStats().catch(() => null),
        api.getAdminSettlementMarkets(1, 50).catch(() => null),
        api.getAdminSettlements(1, 50).catch(() => null),
      ]);
      const stsData = (sts as any)?.data;
      const stMktsData = (stMkts as any)?.data?.markets || [];
      const stRecsData = (stRecs as any)?.data?.settlements || [];
      if (stsData) setSettlementStats(stsData);
      setResolvedMarkets(stMktsData);
      setAdminSettlements(stRecsData);
    } catch (err) {
      console.error('Failed to load settlement data:', err);
    }
  }

  async function handleManualSettle() {
    if (!settleForm.marketId || !settleForm.outcomeTokenId) {
      alert('请输入 Market ID 和 Outcome Token ID');
      return;
    }
    setSettleSubmitting(true);
    try {
      const res: any = await api.adminSettle(settleForm);
      setSettleResult(res.data);
      setSettleForm({ marketId: '', outcomeTokenId: '', outcomeLabel: '', question: '' });
      await loadSettlementData();
    } catch (err) {
      alert('结算失败: ' + (err as Error).message);
    } finally {
      setSettleSubmitting(false);
    }
  }

  async function handleAutoCheck() {
    setAutoChecking(true);
    try {
      const res: any = await api.adminAutoCheckSettle();
      setAutoCheckResult(res.data);
      await loadSettlementData();
    } catch (err) {
      alert('自动检测失败: ' + (err as Error).message);
    } finally {
      setAutoChecking(false);
    }
  }

  // 未登录或非管理员
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">需要登录</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            管理后台需要管理员权限，请先点击右上角「连接钱包」登录后再访问。
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            ← 返回首页
          </a>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-6">🚫</div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">无管理员权限</h1>
          <p className="text-[var(--text-secondary)] mb-2">
            当前账户 <code className="bg-[var(--bg-secondary)] px-2 py-0.5 rounded text-sm">{user.walletAddress}</code>
          </p>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            角色为 <strong>{user.role}</strong>，需要 <strong>admin</strong> 角色。请联系管理员提升权限。
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            ← 返回首页
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">⚙️ 管理后台</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">平台收益、交易记录、提现审核</p>
          </div>
          <button
            onClick={loadAll}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            🔄 刷新
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-lg p-1 w-fit">
          {ADMIN_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* 总览 */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="总用户" value={overview.totalUsers} icon="👥" />
                  <StatCard label="今日活跃" value={overview.activeUsersToday} icon="🟢" />
                  <StatCard label="总交易" value={overview.totalTrades} icon="📈" />
                  <StatCard label="总收益" value={`${overview.totalRevenue.toFixed(4)} USDC`} icon="💰" highlight />
                  <StatCard label="今日收益" value={`${overview.revenueToday.toFixed(4)} USDC`} icon="📊" highlight />
                  <StatCard label="总充值" value={`${overview.totalDeposits.toFixed(2)} USDC`} icon="⬇️" />
                  <StatCard label="待审核提现" value={overview.pendingWithdraws} icon="⏳" />
                  <StatCard label="当前钱包" value={user?.walletAddress?.slice(0, 10) + '...' || '-'} icon="👛" />
                </div>

                {/* 最近 30 天收益趋势 */}
                {revenue && revenue.daily.length > 0 && (
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">📈 最近 30 天收益趋势</h3>
                    <div className="h-40 flex items-end gap-1">
                      {revenue.daily.map((d, i) => {
                        const maxAmount = Math.max(...revenue.daily.map(x => x.amount), 1);
                        const height = Math.max(4, (d.amount / maxAmount) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                            <div
                              className="w-full rounded-t-sm bg-gradient-to-t from-[var(--accent-green)] to-[var(--accent-cyan)] transition-all hover:opacity-80"
                              style={{ height: `${height}%` }}
                              title={`${d.date}: ${d.amount} USDC`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-[var(--text-muted)]">
                      <span>{revenue.daily[0]?.date}</span>
                      <span>{revenue.daily[revenue.daily.length - 1]?.date}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 交易记录 */}
            {activeTab === 'trades' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                        <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">时间</th>
                        <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">用户</th>
                        <th className="px-4 py-3 text-center text-[var(--text-muted)] font-medium">方向</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">数量</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">原价</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">执行价</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">价差收入</th>
                        <th className="px-4 py-3 text-center text-[var(--text-muted)] font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无交易记录</td>
                        </tr>
                      ) : (
                        trades.map((trade: any) => (
                          <tr key={trade.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                            <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                              {new Date(trade.createdAt).toLocaleString('zh-CN')}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                              {trade.user?.walletAddress?.slice(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                trade.side === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {trade.side}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--text-primary)]">{trade.size}</td>
                            <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{trade.originalPrice?.toFixed(4)}</td>
                            <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{trade.executePrice?.toFixed(4)}</td>
                            <td className="px-4 py-3 text-right text-[var(--accent-green)] font-medium">
                              {trade.spreadFee?.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                trade.status === 'filled' ? 'bg-green-500/10 text-green-400' :
                                trade.status === 'cancelled' ? 'bg-gray-500/10 text-gray-400' :
                                trade.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                                'bg-yellow-500/10 text-yellow-400'
                              }`}>
                                {({ pending: '待成交', filled: '已成交', cancelled: '已取消', failed: '失败' } as Record<string, string>)[trade.status]}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 提现审核 */}
            {activeTab === 'withdraws' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                        <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">时间</th>
                        <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">用户</th>
                        <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">目标地址</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">金额</th>
                        <th className="px-4 py-3 text-center text-[var(--text-muted)] font-medium">状态</th>
                        <th className="px-4 py-3 text-center text-[var(--text-muted)] font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdraws.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无提现申请</td>
                        </tr>
                      ) : (
                        withdraws.map((wd: any) => (
                          <tr key={wd.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                            <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                              {new Date(wd.createdAt).toLocaleString('zh-CN')}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                              {wd.user?.walletAddress?.slice(0, 8)}...
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                              {wd.toAddress.slice(0, 10)}...
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--text-primary)] font-medium">
                              {wd.amount} USDC
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                wd.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                wd.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                'bg-red-500/10 text-red-400'
                              }`}>
                                {({ pending: '待审核', processing: '处理中', completed: '已完成', failed: '已拒绝' } as Record<string, string>)[wd.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {wd.status === 'pending' ? (
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.processWithdraw(wd.id, 'complete');
                                        loadAll();
                                      } catch (err) {
                                        alert('操作失败: ' + (err as Error).message);
                                      }
                                    }}
                                    className="px-3 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all"
                                  >
                                    ✅ 通过
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await api.processWithdraw(wd.id, 'reject');
                                        loadAll();
                                      } catch (err) {
                                        alert('操作失败: ' + (err as Error).message);
                                      }
                                    }}
                                    className="px-3 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                                  >
                                    ❌ 拒绝
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-[var(--text-muted)]">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 结算管理 */}
            {activeTab === 'settlements' && (
              <div className="space-y-6">
                {/* 结算概览 */}
                {settlementStats && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <StatCard label="已结算市场" value={settlementStats.totalResolvedMarkets} icon="🎯" />
                    <StatCard label="结算人次" value={settlementStats.totalSettlements} icon="👥" />
                    <StatCard label="总兑付金额" value={`${Number(settlementStats.totalPayout).toFixed(2)} USDC`} icon="💰" highlight />
                    <StatCard label="用户总盈利" value={`${Number(settlementStats.totalUserProfit).toFixed(2)} USDC`} icon="📈" highlight />
                    <StatCard label="未结算持仓" value={settlementStats.openPositions} icon="📦" />
                  </div>
                )}

                {/* 操作区 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 手动结算 */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">🔧 手动结算市场</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Market ID *</label>
                        <input
                          type="text"
                          value={settleForm.marketId}
                          onChange={e => setSettleForm({ ...settleForm, marketId: e.target.value })}
                          placeholder="Polymarket condition ID"
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Outcome Token ID (获胜方) *</label>
                        <input
                          type="text"
                          value={settleForm.outcomeTokenId}
                          onChange={e => setSettleForm({ ...settleForm, outcomeTokenId: e.target.value })}
                          placeholder="赢家 token ID"
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">获胜选项标签</label>
                        <input
                          type="text"
                          value={settleForm.outcomeLabel}
                          onChange={e => setSettleForm({ ...settleForm, outcomeLabel: e.target.value })}
                          placeholder="如 Yes / No / 选项名"
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">市场问题 (可选)</label>
                        <input
                          type="text"
                          value={settleForm.question}
                          onChange={e => setSettleForm({ ...settleForm, question: e.target.value })}
                          placeholder="如 Will BTC reach 100k?"
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                        />
                      </div>
                      <button
                        onClick={handleManualSettle}
                        disabled={settleSubmitting}
                        className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent-green)] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {settleSubmitting ? '⏳ 结算中...' : '✅ 执行结算'}
                      </button>
                    </div>

                    {/* 结算结果 */}
                    {settleResult && (
                      <div className="mt-4 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                        <p className="text-sm font-medium text-green-400 mb-2">✅ 结算成功</p>
                        <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                          <p>市场: {settleResult.marketId}</p>
                          <p>获胜 Token: {settleResult.outcomeTokenId}</p>
                          <p>结算人数: {settleResult.settled} 人</p>
                          <p>总兑付: {settleResult.totalPayout?.toFixed(2)} USDC</p>
                        </div>
                        {settleResult.details?.length > 0 && (
                          <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                            {settleResult.details.map((d, i) => (
                              <div key={i} className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded px-2 py-1">
                                {d.wallet?.slice(0, 8)}... → +{d.payout?.toFixed(2)} USDC ({d.shares?.toFixed(4)} 份, 盈利 {d.profit?.toFixed(2)})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 自动检测 */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">🤖 自动检测结算</h3>
                    <p className="text-xs text-[var(--text-muted)] mb-4">
                      自动扫描 Polymarket 上已结算的市场，对持有相关持仓的用户自动入账。
                      后台每 5 分钟自动执行一次。
                    </p>

                    <button
                      onClick={handleAutoCheck}
                      disabled={autoChecking}
                      className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 mb-4"
                    >
                      {autoChecking ? '🔍 检测中...' : '🔄 立即自动检测'}
                    </button>

                    {autoCheckResult && (
                      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <p className="text-sm font-medium text-blue-400 mb-2">
                          📋 检测完成 ({autoCheckResult.checked} 个市场)
                        </p>
                        {autoCheckResult.newlyResolved?.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs text-[var(--text-muted)]">新结算 {autoCheckResult.newlyResolved.length} 个市场：</p>
                            {autoCheckResult.newlyResolved.map((r, i) => (
                              <div key={i} className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded px-2 py-1">
                                {r.marketId?.slice(0, 20)}... → {r.settled} 人, 兑付 {r.totalPayout?.toFixed(2)} USDC
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[var(--text-muted)]">没有新的已结算市场</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 已结算市场列表 */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--border)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">📋 已结算市场</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                          <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">市场 ID</th>
                          <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">问题</th>
                          <th className="px-4 py-3 text-center text-[var(--text-muted)] font-medium">获胜方</th>
                          <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">结算时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resolvedMarkets.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无已结算市场</td>
                          </tr>
                        ) : (
                          resolvedMarkets.map((mkt: any) => (
                            <tr key={mkt.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]" title={mkt.marketId}>
                                {mkt.marketId?.slice(0, 20)}...
                              </td>
                              <td className="px-4 py-3 text-[var(--text-primary)] text-xs max-w-xs truncate" title={mkt.question}>
                                {mkt.question || '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-green)]/10 text-[var(--accent-green)]">
                                  {mkt.outcomeLabel || 'Winner'} 🏆
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-[var(--text-muted)] whitespace-nowrap">
                                {mkt.resolvedAt ? new Date(mkt.resolvedAt).toLocaleString('zh-CN') : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 结算记录 */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[var(--border)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">💰 结算记录</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                          <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">时间</th>
                          <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">用户</th>
                          <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">份数</th>
                          <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">成本</th>
                          <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">兑付</th>
                          <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">盈利</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminSettlements.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无结算记录</td>
                          </tr>
                        ) : (
                          adminSettlements.map((s: any) => (
                            <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                              <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                                {new Date(s.settledAt).toLocaleString('zh-CN')}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                                {s.user?.walletAddress?.slice(0, 8)}...
                              </td>
                              <td className="px-4 py-3 text-right text-[var(--text-primary)]">{Number(s.shares).toFixed(4)}</td>
                              <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{Number(s.totalCost).toFixed(4)}</td>
                              <td className="px-4 py-3 text-right text-[var(--accent-green)] font-medium">{Number(s.totalPayout).toFixed(2)} USDC</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-medium ${Number(s.profit) >= 0 ? 'text-[var(--accent-green)]' : 'text-red-400'}`}>
                                  {Number(s.profit) >= 0 ? '+' : ''}{Number(s.profit).toFixed(2)} USDC
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: {
  label: string;
  value: string | number;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent-blue)]/30 transition-all">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-[var(--accent-green)]' : 'text-[var(--text-primary)]'}`}>
        {value}
      </div>
      <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
    </div>
  );
}
