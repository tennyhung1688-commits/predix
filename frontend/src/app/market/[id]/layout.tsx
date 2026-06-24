import type { Metadata } from 'next';
import { translations } from '@/i18n/translations';

function getMarketData(id: string): Promise<any> {
  const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://predix-backend-0faz.onrender.com/api';
  return fetch(`${BACKEND}/markets/${id}`, {
    signal: AbortSignal.timeout(4000),
  })
    .then((r) => r.json())
    .then((j) => j?.data)
    .catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = 'https://predix.eu.cc';
  const ogImageUrl = `${baseUrl}/api/og/market/${id}`;

  try {
    const m = await getMarketData(id);
    if (!m) return fallbackMeta(ogImageUrl);

    const question = (m.question_zh || m.question || m.title || '').slice(0, 120);
    const outcomes = Array.isArray(m.outcomes)
      ? m.outcomes
      : (() => { try { return JSON.parse(m.outcomes || '[]'); } catch { return []; } })();
    const prices = Array.isArray(m.outcomePrices)
      ? m.outcomePrices.map((p: string) => parseFloat(p))
      : [];
    const isBinary = outcomes.length === 2;
    const yesPct = isBinary && prices[0] ? Math.round(prices[0] * 100) : null;

    let desc: string = translations.zh['app.description'];
    if (yesPct !== null) {
      desc = `当前概率 ${yesPct}% — ${question}`;
    } else {
      desc = question;
    }

    return {
      title: `${question} — PrediX`,
      description: desc,
      metadataBase: new URL(baseUrl),
      openGraph: {
        title: question,
        description: desc,
        url: `${baseUrl}/market/${id}`,
        siteName: 'PrediX',
        locale: 'zh_CN',
        type: 'article',
        images: [{
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: question,
        }],
      },
      twitter: {
        card: 'summary_large_image',
        title: question,
        description: desc,
        images: [ogImageUrl],
      },
      alternates: {
        canonical: `${baseUrl}/market/${id}`,
      },
    };
  } catch {
    return fallbackMeta(ogImageUrl);
  }
}

function fallbackMeta(ogImageUrl: string): Metadata {
  return {
    title: 'PrediX — 预测市场',
    description: translations.zh['app.description'],
    openGraph: {
      title: 'PrediX — 全球预测市场交易平台',
      description: translations.zh['app.description'],
      url: 'https://predix.eu.cc',
      siteName: 'PrediX',
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'PrediX — 全球预测市场交易平台',
      description: translations.zh['app.description'],
      images: [ogImageUrl],
    },
  };
}

// Client layout must be minimal — actual page is client-side
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
