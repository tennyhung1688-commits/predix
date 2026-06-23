'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Fire a lightweight beacon on each page view
export function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef('');

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    const referrer = document.referrer || '';
    const screen = `${window.innerWidth}x${window.innerHeight}`;

    // Use sendBeacon for non-blocking fire-and-forget
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'https://predix-backend-0faz.onrender.com/api';
      const url = `${base}/analytics/pageview?p=${encodeURIComponent(pathname)}&r=${encodeURIComponent(referrer)}&w=${screen}`;
      navigator.sendBeacon(url);
    } catch {
      // Silently ignore — analytics must never break the app
    }
  }, [pathname]);

  return null; // invisible
}
