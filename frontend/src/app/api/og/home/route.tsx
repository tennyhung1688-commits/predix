import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1030 50%, #0f1729 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          gap: 40,
        }}
      >
        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: -200, right: -200, width: 700, height: 700, borderRadius: '50%', background: 'rgba(79,143,255,0.05)', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: 'rgba(168,85,247,0.04)', filter: 'blur(100px)' }} />

        {/* Logo */}
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #4f8fff, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 52,
            fontWeight: 900,
            color: 'white',
            boxShadow: '0 0 60px rgba(79,143,255,0.3)',
          }}
        >
          P
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.04em', display: 'flex' }}>
            Predi
            <span style={{ background: 'linear-gradient(135deg, #4f8fff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>X</span>
          </div>
          <div style={{ fontSize: 28, color: '#64748b', fontWeight: 500 }}>
            全球预测市场交易平台
          </div>
        </div>

        {/* Features row */}
        <div style={{ display: 'flex', gap: 40, marginTop: 8 }}>
          {[
            { label: '实时概率', icon: '📊' },
            { label: '真实赔率', icon: '💰' },
            { label: '零滑点', icon: '⚡' },
            { label: '全天候', icon: '🌍' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <span style={{ fontSize: 20, color: '#94a3b8', fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 18,
            color: '#475569',
            fontWeight: 600,
          }}
        >
          predix.eu.cc
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
