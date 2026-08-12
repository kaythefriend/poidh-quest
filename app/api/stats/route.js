import { NextResponse } from 'next/server';

// Short server-side cache so new POIDH quests are reflected without a redeploy.
export const revalidate = 60;

async function fetchStatus(status) {
  let cursor = null;
  const items = [];
  for (let page = 0; page < 100; page += 1) {
    const input = { json: { status, sortType: 'date', limit: 100, cursor } };
    const url = `https://poidh.xyz/api/trpc/bounties.fetchAll?input=${encodeURIComponent(JSON.stringify(input))}`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`POIDH stats returned ${response.status}`);
    const payload = await response.json();
    const result = payload?.result?.data?.json ?? payload?.result?.data;
    const batch = result?.items || [];
    items.push(...batch);
    if (!result?.nextCursor || !batch.length) break;
    cursor = result.nextCursor;
  }
  return items;
}

export async function GET() {
  try {
    const [open, progress, past] = await Promise.all([
      fetchStatus('open'),
      fetchStatus('progress'),
      fetchStatus('past'),
    ]);

    const all = [...open, ...progress, ...past];
    const unique = new Map();
    for (const item of all) unique.set(`${item.id}-${item.chainId}`, item);

    const active = new Map([...open, ...progress].map(item => [`${item.id}-${item.chainId}`, item]));
    const ended = new Map(past.map(item => [`${item.id}-${item.chainId}`, item]));
    const totalUsd = [...unique.values()].reduce((sum, item) => sum + Number(item.amountSort || 0), 0);

    return NextResponse.json({
      totalQuests: unique.size,
      activeQuests: active.size,
      endedQuests: ended.size,
      totalUsd,
      currency: 'USD',
      updatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('POIDH stats error:', error);
    return NextResponse.json({ error: 'Unable to load POIDH totals right now.' }, { status: 502 });
  }
}
