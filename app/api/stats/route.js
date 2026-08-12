import { NextResponse } from 'next/server';

export const revalidate = 300;

async function fetchStatus(status) {
  const url = `https://poidh.xyz/api/trpc/bounties.fetchAll?input=${encodeURIComponent(JSON.stringify({ json: { status, sortType: 'date', limit: 100 } }))}`;
  const response = await fetch(url, { next: { revalidate: 300 }, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`POIDH stats returned ${response.status}`);
  const payload = await response.json();
  return payload?.result?.data?.json?.items || payload?.result?.data?.items || [];
}

export async function GET() {
  try {
    const [open, progress] = await Promise.all([fetchStatus('open'), fetchStatus('progress')]);
    const active = new Map([...open, ...progress].map(item => [`${item.id}-${item.chainId}`, item]));
    const totalUsd = [...active.values()].reduce((sum, item) => sum + (Number(item.amountSort) || 0), 0);
    return NextResponse.json({
      activeQuests: active.size,
      totalQuests: active.size,
      totalUsd,
      currency: 'USD',
      updatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('POIDH stats error:', error);
    return NextResponse.json({ error: 'Unable to load POIDH totals right now.' }, { status: 502 });
  }
}
