import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

function formatVolume(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toFixed(0);
}

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://predix-backend-0faz.onrender.com/api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const resp = await fetch(`${BACKEND}/markets/${id}`, {
      signal: AbortSignal.timeout(5000),
    });
    const json = await resp.json();
    const m = json?.data;

    if (!m) return fallbackCard();

    const question = (m.question_zh || m.question || m.title || '').slice(0, 100);
    const outcomes = Array.isArray(m.outcomes) ? m.outcomes : (() => { try { return JSON.parse(m.outcomes || '[]'); } catch { return []; } })();
    const prices = Array.isArray(m.outcomePrices) ? m.outcomePrices.map((p: string) => parseFloat(p)) : [];
    const isBinary = outcomes.length === 2;
    const vol = formatVolume(parseFloat(m.volume24hr || m.volume || '0'));
    const tags = Array.isArray(m.tags) ? m.tags : [];
    const cat = tags[0]?.label || '';

    const yesPct = isBinary && prices[0] ? Math.round(prices[0] * 100) : null;
    const noPct = isBinary && prices[1] ? Math.round(prices[1] * 100) : null;
    const yesPrice = isBinary && prices[0] ? (prices[0] * 100).toFixed(1) : null;
    const noPrice = isBinary && prices[1] ? (prices[1] * 100).toFixed(1) : null;

    // Use market id as seed for deterministic cover image
    const seed = (m.id || id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'predix';
    const coverImg = `https://loremflickr.com/600/630?lock=${seed}`;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            background: '#0f0f1a',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Left: Cover image */}
          <div style={{ width: '50%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden' }}>
            <img
              src={coverImg}
              width={600}
              height={630}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Gradient overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,15,26,0) 70%, #0f0f1a 100%)' }} />
          </div>

          {/* Right: Market info card */}
          <div
            style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '48px 56px 48px 20px',
              background: '#0f0f1a',
            }}
          >
            {/* Category badge */}
            {cat && (
              <div
                style={{
                  display: 'flex',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    background: 'rgba(79,143,255,0.12)',
                    color: '#4f8fff',
                    fontSize: 14,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {cat}
                </div>
              </div>
            )}

            {/* Question */}
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#f1f5f9',
                lineHeight: 1.3,
                marginBottom: 28,
                letterSpacing: '-0.01em',
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {question}
            </div>

            {/* "Probability" label */}
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Probability
            </div>

            {/* Yes/No row */}
            {isBinary ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {/* Yes bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#22c55e' }}>Yes</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{yesPct}%</span>
                    <span style={{ fontSize: 13, color: 'rgba(34,197,94,0.5)' }}>{yesPrice}¢</span>
                  </div>
                </div>

                {/* No bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.15)',
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#ef4444' }}>No</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{noPct}%</span>
                    <span style={{ fontSize: 13, color: 'rgba(239,68,68,0.5)' }}>{noPrice}¢</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {outcomes.slice(0, 4).map((outcome: string, i: number) => (
                  <div key={i} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: 14 }}>
                    {outcome.slice(0, 15)}
                    {prices[i] != null && (
                      <span style={{ color: '#f1f5f9', fontWeight: 700, marginLeft: 6 }}>{Math.round(prices[i] * 100)}%</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Volume */}
            {vol !== '0' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                  <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
                <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>{vol} vol 24h</span>
              </div>
            )}

            {/* Bottom branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: 16,
                marginTop: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: 'linear-gradient(135deg, #4f8fff, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 900,
                    color: 'white',
                  }}
                >
                  P
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>
                  Predi<span style={{ background: 'linear-gradient(135deg, #4f8fff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span>
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#475569' }}>predix.eu.cc</span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch {
    return fallbackCard();
  }
}

function fallbackCard() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f0f1a',
          gap: 16,
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #4f8fff, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: 'white' }}>P</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9' }}>
          Predi<span style={{ background: 'linear-gradient(135deg, #4f8fff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
