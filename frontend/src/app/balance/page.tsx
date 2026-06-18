'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/components/Providers';
import type { BalanceInfo, Transaction } from '@/types';

export default function BalancePage() {
  const { user } = useApp();
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // 充值表单
  const [showDeposit, setShowDeposit] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 提现表单
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [toAddress, setToAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    loadData();
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
    } catch (err) {
      console.error('Failed to load balance:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeposit() {
    if (!txHash || !depositAmount) return;
    setSubmitting(true);
    try {
      await api.deposit(txHash, parseFloat(depositAmount));
      setShowDeposit(false);
      setTxHash('');
      setDepositAmount('');
      loadData();
    } catch (err) {
      alert('充值失败: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (!toAddress || !withdrawAmount) return;
    setSubmitting(true);
    try {
      await api.withdraw(toAddress, parseFloat(withdrawAmount));
      setShowWithdraw(false);
      setToAddress('');
      setWithdrawAmount('');
      loadData();
    } catch (err) {
      alert('提现失败: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">💰 余额管理</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">管理你的平台余额、充值、提现</p>

        {/* 余额卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
            <div className="text-sm text-[var(--text-muted)] mb-1">可用余额</div>
            <div className="text-2xl font-bold text-[var(--accent-green)]">
              {balance?.available?.toFixed(2) || '0.00'} USDC
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
            <div className="text-sm text-[var(--text-muted)] mb-1">锁定余额</div>
            <div className="text-2xl font-bold text-[var(--text-secondary)]">
              {balance?.lockedBalance?.toFixed(2) || '0.00'} USDC
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
            <div className="text-sm text-[var(--text-muted)] mb-1">总余额</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {balance?.balance?.toFixed(2) || '0.00'} USDC
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setShowDeposit(true)}
            className="px-6 py-2.5 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 transition-all"
          >
            ⬇️ 充值
          </button>
          <button
            onClick={() => setShowWithdraw(true)}
            className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-hover)] transition-all"
          >
            ⬆️ 提现
          </button>
        </div>

        {/* 充值弹窗 */}
        {showDeposit && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowDeposit(false)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">⬇️ 充值 USDC</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                请向平台钱包地址 <code className="text-[var(--accent-blue)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-xs">0x_YOUR_PLATFORM_WALLET_ADDRESS</code> 转入 USDC，然后填写交易哈希确认充值。
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">交易哈希 (Tx Hash)</label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={e => setTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">充值金额 (USDC)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="100"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeposit(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeposit}
                    disabled={submitting || !txHash || !depositAmount}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {submitting ? '处理中...' : '确认充值'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 提现弹窗 */}
        {showWithdraw && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowWithdraw(false)}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">⬆️ 提现 USDC</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">接收地址</label>
                  <input
                    type="text"
                    value={toAddress}
                    onChange={e => setToAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">提现金额 (USDC)</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="10"
                    min="10"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">最低提现金额: 10 USDC</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowWithdraw(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={submitting || !toAddress || !withdrawAmount}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {submitting ? '处理中...' : '确认提现'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 交易流水 */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">📋 交易流水</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="px-4 py-2.5 text-left text-[var(--text-muted)] font-medium">时间</th>
                  <th className="px-4 py-2.5 text-left text-[var(--text-muted)] font-medium">类型</th>
                  <th className="px-4 py-2.5 text-right text-[var(--text-muted)] font-medium">金额</th>
                  <th className="px-4 py-2.5 text-right text-[var(--text-muted)] font-medium">余额</th>
                  <th className="px-4 py-2.5 text-left text-[var(--text-muted)] font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无交易记录</td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="px-4 py-2.5 text-[var(--text-muted)] whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          tx.type === 'DEPOSIT' ? 'bg-[var(--green)]/10 text-[var(--green)]' :
                          tx.type === 'WITHDRAW' ? 'bg-[var(--red)]/10 text-[var(--red)]' :
                          tx.type === 'TRADE_BUY' ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' :
                          tx.type === 'TRADE_SELL' ? 'bg-[var(--accent-purple)]/10 text-[var(--accent-purple)]' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {{
                            DEPOSIT: '充值',
                            WITHDRAW: '提现',
                            TRADE_BUY: '买入',
                            TRADE_SELL: '卖出',
                            FEE: '手续费',
                          }[tx.type] || tx.type}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${
                        tx.amount > 0 ? 'text-[var(--accent-green)]' : 'text-[var(--red)]'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(4)} USDC
                      </td>
                      <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">
                        {tx.balance.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)] text-xs max-w-[200px] truncate">
                        {tx.desc || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
