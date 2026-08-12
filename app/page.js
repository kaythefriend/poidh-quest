'use client';

import { useEffect, useMemo, useState } from 'react';

const chainNames = {
  1: 'mainnet',
  42161: 'arbitrum',
  8453: 'base',
  666666666: 'degen',
};

const fallbackImage = (title, id) =>
  `https://loremflickr.com/900/520/${encodeURIComponent((title || 'creative challenge').split(/\\s+/).slice(0, 5).join(','))}?lock=${id}`;

const money = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))}`;
};

export default function Home() {
  const [q, setQ] = useState('');
  const [chain, setChain] = useState('all');
  const [sort, setSort] = useState('newest');
  const [data, setData] = useState([]);
  const [details, setDetails] = useState({});
  const [visible, setVisible] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/bounties')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Unable to load quests');
        return json;
      })
      .then((items) => setData(items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data.length) return;
    let cancelled = false;

    const load = async () => {
      for (let i = 0; i < data.length; i += 8) {
        const batch = data.slice(i, i + 8);
        const results = await Promise.all(
          batch.map(async (bounty) => {
            try {
              const slug = chainNames[bounty.chainId];
              const r = await fetch(`https://poidh.xyz/${slug}/bounty/${bounty.id}/data`, { cache: 'no-store' });
              if (!r.ok) return null;
              const d = await r.json();
              return [bounty.id + '-' + bounty.chainId, {
                priceUsd: d.priceUsd,
                submissions: Array.isArray(d.claims) ? d.claims.length : null,
                image: d.claims?.find((c) => c.imageUrl)?.imageUrl || null,
                title: d.title,
                description: d.description,
              }];
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;
        setDetails((prev) => {
          const next = { ...prev };
          results.filter(Boolean).forEach(([key, value]) => { next[key] = value; });
          return next;
        });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data
      .filter((b) => {
        const slug = chainNames[b.chainId] || '';
        const d = details[b.id + '-' + b.chainId] || {};
        return (chain === 'all' || slug === chain) &&
          (!needle || `${d.title || b.title || ''} ${d.description || b.description || ''}`.toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const da = details[a.id + '-' + a.chainId] || {};
        const db = details[b.id + '-' + b.chainId] || {};
        if (sort === 'reward') return Number(db.priceUsd ?? db.amountSort ?? b.priceUsd ?? 0) - Number(da.priceUsd ?? da.amountSort ?? a.priceUsd ?? 0);
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });
  }, [data, details, q, chain, sort]);

  const shown = rows.slice(0, visible);

  return (
    <main>
      <header className="hero">
        <div className="brand"><span>POIDH</span> Quest</div>
        <p>Real onchain bounties. Real quests. Go make it happen.</p>
        <div className="stats">
          <b>{data.length || '—'} <small>active quests</small></b>
          <b>4 <small>networks</small></b>
          <b>100% <small>POIDH data</small></b>
        </div>
        <div className="controls">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quests..." />
          <select value={chain} onChange={(e) => { setChain(e.target.value); setVisible(60); }}>
            <option value="all">All chains</option>
            <option value="mainnet">Ethereum</option>
            <option value="arbitrum">Arbitrum</option>
            <option value="base">Base</option>
            <option value="degen">Degen</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="reward">Highest reward</option>
          </select>
        </div>
      </header>

      {loading && <div className="status">Loading live POIDH quests…</div>}
      {error && <div className="status error">{error}</div>}

      <section className="grid">
        {shown.map((b) => {
          const key = b.id + '-' + b.chainId;
          const d = details[key] || {};
          const slug = chainNames[b.chainId];
          const title = d.title || b.title || 'Untitled Quest';
          const description = d.description || b.description || 'Complete this POIDH quest and submit proof.';
          const image = d.image || fallbackImage(title, b.id);
          const price = d.priceUsd ?? b.priceUsd;
          return (
            <article className="card" key={key}>
              <div className="image" style={{ backgroundImage: `url(${image})` }} />
              <div className="body">
                <div className="topline"><span className="tag">QUEST</span><span className="chain">{slug}</span></div>
                <h2>{title}</h2>
                <p>{description}</p>
                <div className="meta">
                  <strong>{money(price)}</strong>
                  <span>{d.submissions === null || d.submissions === undefined ? 'Loading submissions…' : `${d.submissions} submission${d.submissions === 1 ? '' : 's'}`}</span>
                </div>
                <a href={`https://poidh.xyz/${slug}/bounty/${b.id}`} target="_blank" rel="noreferrer">View Quest →</a>
              </div>
            </article>
          );
        })}
      </section>

      {!loading && !error && !shown.length && <div className="status">No quests match your search.</div>}
      {!loading && shown.length < rows.length && (
        <button className="loadmore" onClick={() => setVisible((v) => v + 60)}>Load more quests</button>
      )}
    </main>
  );
}
