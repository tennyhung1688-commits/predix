'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/components/Providers';
import type { PositionType, SettlementSummary, SettlementRecord } from '@/types';

export default function PositionsPage() {
  const { user } = useApp();
  const [positions, setPositions] = useState<PositionType[]>([]);
  const [allPositions, setAllPositions] = useState<PositionType[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [posRes, allPosRes, summaryRes, settRes] = await Promise.all([
        api.getPositions().catch(() => null),
        api.getAllPositions().catch(() => null),
        api.getSettlementSummary().catch(() => null),
        api.getSettlements(1, 50).catch(() => null),
      ]);

      const posData = (posRes as any)?.data || [];
      const allPosData = (allPosRes as any)?.data || [];
      const summaryData = (summaryRes as any)?.data;
      const settData = (settRes as any)?.data?.settlements || [];

      setPositions(posData);
      setAllPositions(allPosData);
      if (summaryData) setSummary(summaryData);
      setSettlements(settData);
    } catch (err) {
      console.error('Failed to load positions:', err);
    } finally {
      setLoading(false);
    }
  }

  // 计算浮动盈亏
  const totalOpenValue = positions.reduce((sum, p) => {
    const estimatedValue = p.currentPrice ? p.size * p.currentPrice : p.totalCost;
    return sum + estimatedValue;
  }, 0);

  const totalOpenCost = positions.reduce((sum, p) => sum + p.totalCost, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-[var(--text-secondary)] mb-4">请先连接钱包</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">📊 我的持仓</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">追踪你的预测市场持仓与结算历史</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            🔄 刷新
          </button>
        </div>

        {/* 结算汇总 */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="总结算次数" value={summary.totalSettlements} icon="📋" />
            <StatCard label="总兑付" value={`${Number(summary.totalPayout).toFixed(2)} USDC`} icon="💰" highlight />
            <StatCard label="总成本" value={`${Number(summary.totalCost).toFixed(2)} USDC`} icon="💸" />
            <StatCard label="总盈利" value={`${Number(summary.totalProfit) >= 0 ? '+' : ''}${Number(summary.totalProfit).toFixed(2)} USDC`} icon="📈" highlight={Number(summary.totalProfit) >= 0} />
            <StatCard label="胜率" value={`${summary.winRate}%`} icon="🎯" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-lg p-1 w-fit">
          {(['open', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {{ open: '📦 当前持仓', history: '📜 结算历史' }[tab]}
            </button>
          ))}
        </div>

        {/* 当前持仓 */}
        {activeTab === 'open' && (
          <div className="space-y-6">
            {/* 汇总条 */}
            {positions.length > 0 && (
              <div className="flex items-center gap-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-5 py-3">
                <div className="text-sm text-[var(--text-muted)]">
                  持有 <span className="text-[var(--text-primary)] font-medium">{positions.length}</span> 个市场
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  总成本 <span className="text-[var(--text-primary)] font-medium">{totalOpenCost.toFixed(2)} USDC</span>
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  预估价值 <span className="text-[var(--text-primary)] font-medium">{totalOpenValue.toFixed(2)} USDC</span>
                </div>
              </div>
            )}

            {positions.length === 0 ? (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-12 text-center">
                <div className="text-4xl mb-4">📦</div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">暂无持仓</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  去市场上交易，你的持仓将自动显示在这里
                </p>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                        <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Token ID</th>
                        <th className="px-4 py-3 text-center text-[var(--text-muted)] font-medium">方向</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">数量</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">均价</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">成本</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">当前价值</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">浮动盈亏</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">更新时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => {
                        const estimatedValue = pos.currentPrice ? pos.size * pos.currentPrice : pos.totalCost;
                        const unrealizedPnl = estimatedValue - pos.totalCost;
                        const pnlPercent = pos.totalCost > 0 ? (unrealizedPnl / pos.totalCost) * 100 : 0;

                        return (
                          <tr key={pos.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]" title={pos.tokenId}>
                              {pos.tokenId?.slice(0, 14)}...
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                pos.side === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {pos.side === 'BUY' ? '看涨' : '看跌'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--text-primary)]">{Number(pos.size).toFixed(4)}</td>
                            <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                              {Number(pos.avgPrice).toFixed(4)} USDC
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                              {Number(pos.totalCost).toFixed(2)} USDC
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--text-primary)]">
                              {pos.currentPrice ? `${estimatedValue.toFixed(2)} USDC` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-medium ${unrealizedPnl >= 0 ? 'text-[var(--accent-green)]' : 'text-red-400'}`}>
                                {pos.currentPrice ? (
                                  `${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%)`
                                ) : '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--text-muted)] whitespace-nowrap">
                              {new Date(pos.updatedAt).toLocaleString('zh-CN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 结算历史 */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* 胜率统计 */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="总结算" value={summary.totalSettlements} icon="📋" />
                <StatCard label="获胜" value={summary.wins} icon="🏆" />
                <StatCard label="失败" value={summary.losses} icon="💔" />
                <StatCard label="胜率" value={`${summary.winRate}%`} icon="🎯" />
                <StatCard label="总盈利" value={`${Number(summary.totalProfit) >= 0 ? '+' : ''}${Number(summary.totalProfit).toFixed(2)} USDC`} icon="📈" highlight={Number(summary.totalProfit) >= 0} />
              </div>
            )}

            {settlements.length === 0 ? (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-12 text-center">
                <div className="text-4xl mb-4">📜</div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">暂无结算记录</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  当你持有的市场结算后，记录将出现在这里
                </p>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                        <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">结算时间</th>
                        <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">市场</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">持有份数</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">购入成本</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">兑付金额</th>
                        <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">盈利</th>
                        <th className="px-4 py-3 text-center text-[var(--text-muted)] font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.map((s: any) => {
                        const profit = Number(s.profit);
                        return (
                          <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                            <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                              {new Date(s.settledAt).toLocaleString('zh-CN')}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)] max-w-[200px] truncate" title={s.marketId}>
                              {s.marketId?.slice(0, 16)}...
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--text-primary)]">{Number(s.shares).toFixed(4)}</td>
                            <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{Number(s.totalCost).toFixed(4)} USDC</td>
                            <td className="px-4 py-3 text-right text-[var(--accent-green)] font-medium">
                              {Number(s.totalPayout).toFixed(2)} USDC
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-medium ${profit >= 0 ? 'text-[var(--accent-green)]' : 'text-red-400'}`}>
                                {profit >= 0 ? '+' : ''}{profit.toFixed(2)} USDC
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                profit > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {profit > 0 ? '🎉 盈利' : profit < 0 ? '😔 亏损' : '➖ 持平'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
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
