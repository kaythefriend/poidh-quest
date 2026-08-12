import { NextResponse } from 'next/server';

export const revalidate = 30;

export async function GET() {
  const items = [];
  let cursor = null;

  try {
    for (let page = 0; page < 20; page += 1) {
      const url = new URL('https://poidh.xyz/bounties/data');
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', String(cursor));

      const response = await fetch(url, {
        next: { revalidate: 30 },
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`POIDH returned ${response.status}`);

      const data = await response.json();
      items.push(...(data.items || []));
      if (!data.nextCursor || !data.items?.length) break;
      cursor = data.nextCursor;
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error('POIDH bounty index error:', error);
    return NextResponse.json(
      { error: 'Unable to load POIDH quests right now.' },
      { status: 502 }
    );
  }
}
