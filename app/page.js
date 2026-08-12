'use client';
import { useEffect, useMemo, useState } from 'react';

const chainNames = { 1: 'mainnet', 42161: 'arbitrum', 8453: 'base', 666666666: 'degen' };
const chainLogos = { mainnet: '/chain-logos/ethereum.svg', base: '/chain-logos/base.svg', arbitrum: '/chain-logos/arbitrum.svg', degen: '/chain-logos/degen.svg' };
const money = (v) => v == null || Number.isNaN(Number(v)) ? '—' : `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))}`;

function imageUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const valueTrimmed = value.trim();
  if (!valueTrimmed) return null;
  if (valueTrimmed.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${valueTrimmed.slice(7)}`;
  if (valueTrimmed.startsWith('/ipfs/')) return `https://ipfs.io${valueTrimmed}`;
  if (valueTrimmed.startsWith('//')) return `https:${valueTrimmed}`;
  if (/^https?:\/\//i.test(valueTrimmed) || valueTrimmed.startsWith('/')) return valueTrimmed;
  return `https://${valueTrimmed}`;
}

export default function Home() {
  const [q, setQ] = useState(''), [chain, setChain] = useState('all'), [sort, setSort] = useState('newest');
  const [data, setData] = useState([]), [details, setDetails] = useState({}), [stats, setStats] = useState(null);
  const [visible, setVisible] = useState(60), [loading, setLoading] = useState(true), [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/bounties', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw Error(j.error || 'Unable to load quests'); return j; })
      .then(j => alive && setData(j)).catch(e => alive && setError(e.message)).finally(() => alive && setLoading(false));
    fetch('/api/stats', { cache: 'no-store' }).then(r => r.json()).then(j => alive && !j.error && setStats(j)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!data.length) return;
    let cancelled = false;
    const load = async (b) => {
      const slug = chainNames[b.chainId];
      if (!slug) return [b.id + '-' + b.chainId, { unavailable: true }];
      try {
        const r = await fetch(`/api/bounty/${encodeURIComponent(slug)}/${encodeURIComponent(b.id)}`, { cache: 'force-cache' });
        if (!r.ok) return [b.id + '-' + b.chainId, { unavailable: true }];
        return [b.id + '-' + b.chainId, await r.json()];
      } catch { return [b.id + '-' + b.chainId, { unavailable: true }]; }
    };
    (async () => {
      for (let i = 0; i < data.length; i += 12) {
        const rs = await Promise.all(data.slice(i, i + 12).map(load));
        if (cancelled) return;
        setDetails(prev => ({ ...prev, ...Object.fromEntries(rs) }));
      }
    })();
    return () => { cancelled = true; };
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter(b => {
      const slug = chainNames[b.chainId] || '', d = details[b.id + '-' + b.chainId] || {};
      return (chain === 'all' || slug === chain) && (!needle || `${d.title || b.title || ''} ${d.description || b.description || ''}`.toLowerCase().includes(needle));
    }).sort((a, b) => {
      const da = details[a.id + '-' + a.chainId] || {}, db = details[b.id + '-' + b.chainId] || {};
      return sort === 'reward' ? Number(db.priceUsd ?? b.priceUsd ?? 0) - Number(da.priceUsd ?? a.priceUsd ?? 0) : Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
  }, [data, details, q, chain, sort]);

  const shown = rows.slice(0, visible);
  return <main>
    <header className="hero"><div className="brand"><span>POIDH</span> Quest</div><p>Real onchain bounties. Real quests. Go make it happen.</p>
      <div className="stats"><b>{stats ? stats.activeQuests.toLocaleString() : (data.length || '—')} <small>active quests</small></b><b>{stats ? stats.totalQuests.toLocaleString() : '—'} <small>total quests</small></b><b>{stats ? money(stats.totalUsd) : '—'} <small>total bounty value</small></b><b>4 <small>networks</small></b></div>
      <div className="controls"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search quests..."/><select value={chain} onChange={e => { setChain(e.target.value); setVisible(60); }}><option value="all">All chains</option><option value="mainnet">Ethereum</option><option value="arbitrum">Arbitrum</option><option value="base">Base</option><option value="degen">Degen</option></select><select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="reward">Highest reward</option></select></div>
    </header>
    {loading && <div className="status">Loading live POIDH quests…</div>}{error && <div className="status error">{error}</div>}
    <section className="grid">{shown.map(b => { const key = b.id + '-' + b.chainId, d = details[key] || {}, slug = chainNames[b.chainId]; const title = d.title || b.title || 'Untitled Quest', description = d.description || b.description || 'Complete this POIDH quest and submit proof.'; const submissionImage = imageUrl(d.image); const logo = chainLogos[slug]; const image = submissionImage || logo; return <article className="card" key={key}>
      <div className="image">{image ? <img src={image} alt={submissionImage ? 'Quest submission' : `${slug || 'chain'} logo`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={e => {
        const el = e.currentTarget;
        if (submissionImage && !el.dataset.retry) {
          el.dataset.retry = '1';
          const raw = d.image;
          if (typeof raw === 'string' && raw.includes('/ipfs/')) {
            const match = raw.match(/(?:https?:\/\/[^/]+)?(\/ipfs\/[^?#]+)/i);
            if (match) { el.src = `https://ipfs.io${match[1]}`; return; }
          }
        }
        if (logo) {
          el.src = logo;
          el.alt = `${slug || 'chain'} logo`;
          el.dataset.retry = 'fallback';
          return;
        }
        el.style.display = 'none';
      }} /> : <div className="image-placeholder" aria-hidden="true" />}</div>
      <div className="body"><div className="topline"><span className="tag">QUEST</span><span className="chain">{slug}</span></div><h2>{title}</h2><p>{description}</p><div className="meta"><strong>{money(d.priceUsd ?? b.priceUsd)}</strong><span>{d.unavailable ? '—' : d.submissions == null ? 'Loading…' : `${d.submissions} submission${d.submissions === 1 ? '' : 's'}`}</span></div><a href={`https://poidh.xyz/${slug}/bounty/${b.id}`} target="_blank" rel="noreferrer">View Quest →</a></div>
    </article>; })}</section>
    {!loading && !error && !shown.length && <div className="status">No quests match your search.</div>}{!loading && shown.length < rows.length && <button className="loadmore" onClick={() => setVisible(v => v + 60)}>Load more quests</button>}
  </main>;
}
