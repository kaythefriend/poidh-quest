import { NextResponse } from 'next/server';

export const revalidate = 60;

function normalizeImageUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const url = value.trim();
  if (url.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${url.slice(7)}`;
  if (url.startsWith('ipfs/')) return `https://ipfs.io/ipfs/${url.slice(5)}`;
  return url;
}

export async function GET(request, { params }) {
  const { chain, id } = await params;
  if (!chain || !id) return NextResponse.json({ error: 'Missing bounty' }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://poidh.xyz/${encodeURIComponent(chain)}/bounty/${encodeURIComponent(id)}/data`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`POIDH returned ${response.status}`);
    const d = await response.json();
    const claims = Array.isArray(d.claims) ? d.claims : [];
    const rawImage = claims.find(c => c?.imageUrl)?.imageUrl || claims.find(c => c?.image)?.image || null;
    const image = normalizeImageUrl(rawImage);
    return NextResponse.json({
      priceUsd: d.priceUsd ?? null,
      submissions: claims.length,
      image,
      title: d.title ?? null,
      description: d.description ?? null,
    }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to load bounty details', unavailable: true }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
