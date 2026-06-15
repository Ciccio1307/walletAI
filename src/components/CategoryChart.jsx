import { useState, useEffect, useRef } from 'react';

const CATEGORY_EMOJI = {
  cibo: '🍽️', trasporti: '🚗', salute: '💊', svago: '🎮',
  regali: '🎁', casa: '🏠', shopping: '🛍️', lavoro: '💼',
  entrata: '💰', altro: '📦',
};

export default function CategoryChart({ transactions }) {
  const containerRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setMounted(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const outTx = transactions.filter(t => t.type === 'out');
  const byCategory = {};
  for (const tx of outTx) {
    byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
  }

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;
  const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  if (sorted.length === 0) {
    return (
      <div className="category-chart card" ref={containerRef}>
        <h3 className="section-title">Uscite per categoria</h3>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Nessuna uscita questo mese.</p>
      </div>
    );
  }

  return (
    <div className="category-chart card" ref={containerRef}>
      <h3 className="section-title">Uscite per categoria</h3>
      {sorted.map(([cat, amount]) => (
        <div key={cat} className="category-bar-row">
          <div className="category-bar-label">
            <span>{CATEGORY_EMOJI[cat] || '📦'}</span>
            <span>{cat}</span>
          </div>
          <div className="category-bar-track">
            <div
              className="category-bar-fill"
              style={{ width: mounted ? `${(amount / max) * 100}%` : '0%' }}
            />
          </div>
          <div className="category-bar-amount">{fmt(amount)}</div>
        </div>
      ))}
    </div>
  );
}
