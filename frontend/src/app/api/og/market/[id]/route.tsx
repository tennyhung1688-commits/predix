import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

function formatVolume(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toFixed(0);
}

// Fetch from Render backend
const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'https://predix-backend-0faz.onrender.com/api';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const resp = await fetch(`${BACKEND}/markets/${id}`, {
      signal: AbortSignal.timeout(5000),
    });
    const json = await resp.json();
    const m = json?.data;

    if (!m) {
      return new ImageResponse(
        (
          <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
            <span style={{ color: '#666', fontSize: 32 }}>PrediX</span>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const question = (m.question_zh || m.question || m.title || '').slice(0, 100);
    const outcomes = Array.isArray(m.outcomes) ? m.outcomes : (() => { try { return JSON.parse(m.outcomes || '[]'); } catch { return []; } })();
    const prices = Array.isArray(m.outcomePrices) ? m.outcomePrices.map((p: string) => parseFloat(p)) : [];
    const isBinary = outcomes.length === 2;
    const vol = formatVolume(parseFloat(m.volume24hr || m.volume || '0'));
    const tags = Array.isArray(m.tags) ? m.tags : [];
    const cat = tags[0]?.label || '';

    const yesPct = isBinary && prices[0] ? Math.round(prices[0] * 100) : 0;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1030 50%, #0f1729 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: 64,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient glow */}
          <div style={{ position: 'absolute', top: -120, right: -120, width: 500, height: 500, borderRadius: '50%', background: 'rgba(79,143,255,0.06)', filter: 'blur(80px)' }} />
          <div style={{ position: 'absolute', bottom: -80, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(168,85,247,0.05)', filter: 'blur(80px)' }} />

          {/* Category badge */}
          {cat && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                  fontSize: 18,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {cat}
              </div>
            </div>
          )}

          {/* Probability — big centered number */}
          {isBinary ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <span
                style={{
                  fontSize: 128,
                  fontWeight: 900,
                  color: yesPct >= 50 ? '#22c55e' : '#ef4444',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                {yesPct}
              </span>
              <span style={{ fontSize: 40, color: yesPct >= 50 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)', fontWeight: 700 }}>
                %
              </span>
              <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.4)', marginLeft: 8, fontWeight: 500 }}>
                {outcomes[0]}
              </span>
            </div>
          ) : null}

          {/* Market question */}
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#f1f5f9',
              lineHeight: 1.3,
              maxWidth: '90%',
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            {question}
          </div>

          {/* Volume */}
          {vol !== '0' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
              <span style={{ fontSize: 20, color: '#64748b', fontWeight: 600 }}>{vol} vol 24h</span>
            </div>
          )}

          {/* Bottom bar — PrediX branding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Logo */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #4f8fff, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  color: 'white',
                }}
              >
                P
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                  Predi<span style={{ background: 'linear-gradient(135deg, #4f8fff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span>
                </div>
                <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>预测市场交易平台</div>
              </div>
            </div>
            <div style={{ fontSize: 16, color: '#475569' }}>
              predix.eu.cc
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #4f8fff, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: 'white' }}>P</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9' }}>
              Predi<span style={{ background: 'linear-gradient(135deg, #4f8fff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
