import { NextResponse } from 'next/server';

// Vercel Cron 定时调用 — 每5分钟 ping Render 后端防止冷启动
export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://predix-backend-0faz.onrender.com/api';

  try {
    const start = Date.now();
    const resp = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(8000),
    });
    const elapsed = Date.now() - start;

    return NextResponse.json({
      ok: resp.ok,
      status: resp.status,
      elapsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    }, { status: 502 });
  }
}

// 标记为 cron 路由
export const preferredRegion = 'sin1'; // 新加坡，离 Render 后端最近
