import { NextResponse } from 'next/server';

export const revalidate = 300;

async function fetchAll(status) {
  const items = [];
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const input = { json: { status, sortType: 'date', limit: 100, ...(cursor ? { cursor } : {}) } };
    const url = `https://poidh.xyz/api/trpc/bounties.fetchAll?input=${encodeURIComponent(JSON.stringify(input))}`;
    const response = await fetch(url, { next: { revalidate: 300 }, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`POIDH returned ${response.status}`);
    const payload = await response.json();
    const result = payload?.result?.data?.json || payload?.result?.data || {};
    const batch = Array.isArray(result.items) ? result.items : [];
    items.push(...batch);
    if (!result.nextCursor || batch.length === 0) break;
    cursor = result.nextCursor;
  }
  return items;
}

export async function GET() {
  try {
    const [open, progress, past] = await Promise.all([
      fetchAll('open'),
      fetchAll('progress'),
      fetchAll('past'),
    ]);

    const all = new Map();
    for (const item of [...open, ...progress, ...past]) {
      all.set(`${item.id}-${item.chainId}`, item);
    }

    const active = new Map();
    for (const item of [...open, ...progress]) {
      active.set(`${item.id}-${item.chainId}`, item);
    }

    const totalUsd = [...all.values()].reduce((sum, item) => sum + (Number(item.amountSort) || 0), 0);

    return NextResponse.json({
      activeQuests: active.size,
      totalQuests: all.size,
      totalUsd,
      currency: 'USD',
      updatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('POIDH stats error:', error);
    return NextResponse.json({ error: 'Unable to load POIDH totals right now.' }, { status: 502 });
  }
}
