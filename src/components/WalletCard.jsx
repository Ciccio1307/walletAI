import { useState, useEffect, useRef } from 'react';

function useCountUp(target, duration = 650) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(null);
  const rafRef  = useRef(null);

  useEffect(() => {
    const from = prevRef.current === null ? 0 : prevRef.current;
    prevRef.current = target;
    const diff = target - from;
    if (Math.abs(diff) < 0.005) { setValue(target); return; }

    const startTime = performance.now();
    cancelAnimationFrame(rafRef.current);

    function tick(now) {
      const t    = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(from + diff * ease);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else        setValue(target);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export default function WalletCard({ user, transactions }) {
  const now          = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();

  const monthTx = transactions.filter(tx => {
    if (!tx.date) return false;
    const [, m, y] = tx.date.split('/');
    return parseInt(m) - 1 === currentMonth && parseInt(y) === currentYear;
  });

  const totalIn  = monthTx.filter(t => t.type === 'in').reduce((s, t)  => s + t.amount, 0);
  const totalOut = monthTx.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const balance  = (user?.initial_budget || 0) + totalIn - totalOut;
  const isNeg    = balance < 0;

  const available = (user?.initial_budget || 0) + totalIn;
  const pct       = available > 0 ? Math.min((totalOut / available) * 100, 100) : 0;

  const EMOJI = { cibo:'🍽️',trasporti:'🚗',salute:'💊',svago:'🎮',regali:'🎁',casa:'🏠',shopping:'🛍️',lavoro:'💼',entrata:'💰',altro:'📦' };
  const categoryTotals = monthTx.filter(t => t.type === 'out').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount; return acc;
  }, {});
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  const daysPassed  = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const dailyRate   = daysPassed > 0 ? totalOut / daysPassed : 0;
  const projected   = dailyRate * daysInMonth;

  const animBalance  = useCountUp(balance);
  const animTotalIn  = useCountUp(totalIn,  500);
  const animTotalOut = useCountUp(totalOut, 500);
  const animPct      = useCountUp(pct, 800);

  const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <div className="wallet-card card">
      <div className={`wallet-balance ${isNeg ? 'negative' : 'positive'}`}>
        {fmt(animBalance)}
      </div>
      <div className="wallet-budget-line">
        Budget iniziale: {fmt(user?.initial_budget || 0)}
      </div>
      {topCategory && (
        <div className="wallet-top-category">
          Spendi di più in: {EMOJI[topCategory[0]] || '📦'} {topCategory[0]} ({Math.round(topCategory[1] / (totalOut || 1) * 100)}%)
        </div>
      )}
      <div className="wallet-progress">
        <div className="wallet-progress-bar">
          <div
            className={`wallet-progress-fill${pct > 90 ? ' danger' : pct > 70 ? ' warn' : ''}`}
            style={{ width: `${animPct}%` }}
          />
        </div>
        <span className="wallet-progress-label">{Math.round(animPct)}% del budget usato</span>
      </div>
      {dailyRate > 0 && (
        <div className="wallet-forecast">
          <span>📊 {fmt(dailyRate)}/giorno</span>
          <span>Proiezione fine mese: {fmt(projected)}</span>
        </div>
      )}
      <div className="wallet-stats-row">
        <div className="wallet-stat-item">
          <div className="wallet-stat-label">Entrate</div>
          <div className="wallet-stat-value in">+{fmt(animTotalIn)}</div>
        </div>
        <div className="wallet-stat-item">
          <div className="wallet-stat-label">Uscite</div>
          <div className="wallet-stat-value out">-{fmt(animTotalOut)}</div>
        </div>
        <div className="wallet-stat-item">
          <div className="wallet-stat-label">Transazioni</div>
          <div className="wallet-stat-value">{transactions.length}</div>
        </div>
      </div>
    </div>
  );
}
