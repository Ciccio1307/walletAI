import { useState, useEffect, useRef } from 'react';

function useCountUp(target, duration = 650) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current === null ? 0 : prevRef.current;
    prevRef.current = target;
    const diff = target - from;
    if (Math.abs(diff) < 0.005) { setValue(target); return; }

    const startTime = performance.now();
    cancelAnimationFrame(rafRef.current);

    function tick(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(from + diff * ease);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(target);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export default function WalletCard({ user, stats }) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const current = stats?.currentMonth || { in: 0, out: 0, categories: {} };
  const totals = stats?.totals || { in: 0, out: 0 };

  const totalIn = current.in || 0;
  const totalOut = current.out || 0;

  // "Saldo attuale" is now all-time: initial budget + all income - all expenses.
  const balance = (user?.initial_budget || 0) + (totals.in || 0) - (totals.out || 0);
  const isNeg = balance < 0;

  const available = (user?.initial_budget || 0) + (totals.in || 0);
  const pct = available > 0 ? Math.min(((totals.out || 0) / available) * 100, 100) : 0;

  const EMOJI = {
    cibo: '🍽️', trasporti: '🚗', salute: '💊', svago: '🎮', regali: '🎁',
    casa: '🏠', shopping: '🛍️', lavoro: '💼', entrata: '💰', altro: '📦',
  };

  const topCategory = Object.entries(current.categories || {})
    .sort((a, b) => b[1] - a[1])[0];

  const daysPassed = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const dailyRate = daysPassed > 0 ? totalOut / daysPassed : 0;
  const projected = dailyRate * daysInMonth;

  const animBalance = useCountUp(balance);
  const animTotalIn = useCountUp(totalIn, 500);
  const animTotalOut = useCountUp(totalOut, 500);
  const animPct = useCountUp(pct, 800);

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
          <div className="wallet-stat-value">{stats?.counts?.all ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
