'use client';

import { useState } from 'react';
import { useApp } from '@/components/Providers';
import { api } from '@/lib/api';

export default function AdminClaimPage() {
  const { user } = useApp();
  const [status, setStatus] = useState('');

  async function claim() {
    if (!user?.walletAddress) return;
    setStatus('loading');
    try {
      const res: any = await api.post('/admin/claim', { wallet: user.walletAddress });
      if (res?.data?.success) {
        setStatus('done');
        window.location.href = '/admin';
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-6">👑</div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">开通管理员权限</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          {user?.walletAddress
            ? `当前钱包: ${user.walletAddress.slice(0, 10)}...`
            : '请先在首页点击「连接钱包」登录'}
        </p>
        {status === 'done' ? (
          <p className="text-green-400">✅ 已开通，跳转中...</p>
        ) : status === 'error' ? (
          <p className="text-red-400">❌ 开通失败，请重试</p>
        ) : (
          <button
            onClick={claim}
            disabled={!user?.walletAddress}
            className="px-6 py-3 rounded-xl bg-[var(--accent-blue)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            🚀 一键开通
          </button>
        )}
      </div>
    </div>
  );
}
