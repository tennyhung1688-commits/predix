'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/components/Providers';
import { truncateAddress } from '@/lib/utils';
import type { BalanceInfo, Transaction } from '@/types';

export default function BalancePage() {
  const { user } = useApp();
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositInfo, setDepositInfo] = useState<{ platformAddress: string; newUserBonus: number; note: string } | null>(null);

  // 提现表单
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [toAddress, setToAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
    api.get('/balance/deposit-info')
      .then((res: any) => setDepositInfo(res?.data || null))
      .catch(() => {});
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [bal, txs] = await Promise.all([
        api.getBalance().catch(() => null),
        api.getTransactions(50).catch(() => []),
      ]);
      const balData = (bal as any)?.data;
      const txsData = (txs as any)?.data || [];
      if (balData) setBalance(balData);
      setTransactions(txsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  async function handleWithdraw() {
    if (!toAddress || !withdrawAmount) return;
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setToast({ type: 'error', message: '请输入有效金额' });
      return;
    }
    setSubmitting(true);
    try {
      await api.withdraw(toAddress, amt);
      setToast({ type: 'success', message: '提现申请已提交' });
      setShowWithdraw(false);
      setToAddress('');
      setWithdrawAmount('');
      loadData();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || '提现失败' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent-blue)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6 font-display">💰 余额与充值</h1>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in ${
          toast.type === 'success' ? 'bg-[var(--green-bg)] border border-[var(--green-border)] text-[var(--green)]' : 'bg-[var(--red-bg)] border border-[var(--red-border)] text-[var(--red)]'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Balance Overview */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-[var(--text-bright)] tabular-nums font-display">
            {balance?.balance?.toFixed(2) || '0.00'}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">总余额</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-[var(--accent-blue)] tabular-nums font-display">
            {balance?.available?.toFixed(2) || '0.00'}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">可用</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-[var(--accent-amber)] tabular-nums font-display">
            {balance?.lockedBalance?.toFixed(2) || '0.00'}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">挂单锁定</div>
        </div>
      </div>

      {/* Deposit Section */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          📥 充值 USDC
        </h2>
        {depositInfo && (
          <>
            <div className="mb-3 p-3 rounded-lg bg-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/10 text-xs text-[var(--text-secondary)]">
              🎁 新用户自动赠送 <span className="text-[var(--accent-blue)] font-bold">{depositInfo.newUserBonus} USDC</span>，注册即到账无需充值
            </div>

            <div className="text-[10px] uppercase text-[var(--text-muted)] mb-1.5">平台钱包地址 (Polygon)</div>
            <div className="flex gap-2 mb-2">
              <code className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--text-secondary)] break-all select-all">
                {depositInfo.platformAddress}
              </code>
              <button
                onClick={() => handleCopy(depositInfo.platformAddress)}
                className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs font-medium hover:bg-[var(--bg-hover)] transition-colors shrink-0"
              >
                {copied ? '✅ 已复制' : '📋 复制'}
              </button>
            </div>
            <div className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              从你的钱包/交易所转账 USDC (Polygon 网络)，到账后在 <span className="text-[var(--accent-amber)]">Discord/微信群</span> 发 txHash 确认。
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowWithdraw(true)}
          className="flex-1 py-2.5 rounded-xl border border-[var(--red-border)] text-[var(--red)] text-sm font-semibold hover:bg-[var(--red-bg)] transition-colors"
        >
          提现
        </button>
      </div>

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowWithdraw(false)} />
          <div className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm shadow-[var(--shadow-elevated)]">
            <h3 className="text-sm font-semibold mb-4">提现 USDC</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">收款地址</label>
                <input
                  type="text"
                  value={toAddress}
                  onChange={e => setToAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] block mb-1">金额 (USDC)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder={`最低 ${balance ? '10' : '...'} USDC`}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <button
                onClick={handleWithdraw}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-[var(--red)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认提现'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">交易记录</h3>
          <span className="text-[10px] text-[var(--text-muted)]">{transactions.length} 条</span>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-10 text-sm text-[var(--text-muted)]">暂无交易记录</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {transactions.map(tx => (
              <div key={(tx as any).id} className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--text-primary)] truncate">{(tx as any).desc || (tx as any).type}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{new Date((tx as any).createdAt).toLocaleString()}</div>
                </div>
                <span className={`text-xs font-medium tabular-nums ${(tx as any).amount > 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                  {(tx as any).amount > 0 ? '+' : ''}{(tx as any).amount?.toFixed(2)} USDC
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
