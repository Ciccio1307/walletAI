import { useState, useEffect, useRef } from 'react';

const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export default function MonthlyChart({ transactions }) {
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

  const now = new Date();

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS_IT[d.getMonth()] };
  });

  const data = months.map(({ month, year, label }) => {
    const txs = transactions.filter(tx => {
      const parts = tx.date?.split('/');
      return parts && parseInt(parts[1]) === month && parseInt(parts[2]) === year;
    });
    const totalIn  = txs.filter(t => t.type === 'in').reduce((s, t)  => s + t.amount, 0);
    const totalOut = txs.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
    return { label, net: totalIn - totalOut };
  });

  const maxAbs = Math.max(...data.map(d => Math.abs(d.net)), 1);

  return (
    <div className="monthly-chart card" ref={containerRef}>
      <h3 className="section-title">Andamento mensile</h3>
      <div className="monthly-bars">
        {data.map((d, i) => {
          const pct = (Math.abs(d.net) / maxAbs) * 100;
          return (
            <div key={i} className="monthly-bar-col">
              <div
                className={`monthly-bar ${d.net >= 0 ? 'positive' : 'negative'}`}
                style={{ height: mounted ? `${pct}%` : '0%' }}
                title={`${d.label}: ${d.net >= 0 ? '+' : ''}${d.net.toFixed(2)} €`}
              />
            </div>
          );
        })}
      </div>
      <div className="monthly-bar-labels">
        {data.map((d, i) => (
          <div key={i} className="monthly-bar-label">{d.label}</div>
        ))}
      </div>
    </div>
  );
}
