'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function TwitterCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect') || '/';

    if (token) {
      localStorage.setItem('token', token);
      router.replace(redirect);
    } else {
      setStatus('error');
      setErrorMsg('Twitter 登录失败，未获取到认证令牌');
    }
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">正在通过 X 登录...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-400">
            <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
        </div>
        <p className="text-sm text-red-400">{errorMsg}</p>
        <button
          onClick={() => router.replace('/auth')}
          className="mt-2 px-4 py-2 rounded-xl bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-[var(--accent-blue-hover)] transition-colors"
        >
          返回登录
        </button>
      </div>
    </div>
  );
}

export default function TwitterCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
        <div className="h-8 w-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TwitterCallbackInner />
    </Suspense>
  );
}
