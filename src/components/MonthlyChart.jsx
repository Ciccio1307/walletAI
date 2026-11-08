import { useState, useEffect, useRef } from 'react';

const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function MonthlyChart({ months = [] }) {
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

  const data = months.map((entry) => ({
    label: MONTHS_IT[entry.month - 1] || '',
    net: (entry.in || 0) - (entry.out || 0),
  }));

  const maxAbs = Math.max(...data.map((entry) => Math.abs(entry.net)), 1);

  return (
    <div className="monthly-chart card" ref={containerRef}>
      <h3 className="section-title">Andamento mensile</h3>
      <div className="monthly-bars">
        {data.map((entry, index) => {
          const pct = (Math.abs(entry.net) / maxAbs) * 100;
          return (
            <div key={index} className="monthly-bar-col">
              <div
                className={`monthly-bar ${entry.net >= 0 ? 'positive' : 'negative'}`}
                style={{ height: mounted ? `${pct}%` : '0%' }}
                title={`${entry.label}: ${entry.net >= 0 ? '+' : ''}${new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entry.net)} €`}
              />
            </div>
          );
        })}
      </div>
      <div className="monthly-bar-labels">
        {data.map((entry, index) => (
          <div key={index} className="monthly-bar-label">{entry.label}</div>
        ))}
      </div>
    </div>
  );
}
