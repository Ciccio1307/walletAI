import { useState } from 'react';

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const EMOJI = { cibo:'🍽️',trasporti:'🚗',salute:'💊',svago:'🎮',regali:'🎁',casa:'🏠',shopping:'🛍️',lavoro:'💼',entrata:'💰',altro:'📦' };

export default function MonthlySummary({ transactions }) {
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(true);

  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();

  const monthTx = transactions.filter(tx => {
    const parts = tx.date.split('/');
    return parseInt(parts[1]) === month && parseInt(parts[2]) === year;
  });

  const totalIn  = monthTx.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const totalOut = monthTx.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const net = totalIn - totalOut;

  const byCategory = {};
  for (const tx of monthTx.filter(t => t.type === 'out')) {
    byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
  }
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCat = sorted[0]?.[1] || 1;

  const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <div className="summary-section card">
      <div className="summary-header" onClick={() => setOpen(v => !v)}>
        <h3 className="section-title" style={{ margin: 0 }}>Riepilogo mensile</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="summary-month-nav" onClick={e => e.stopPropagation()}>
            <button className="month-nav-btn" onClick={() => setOffset(o => o + 1)}>‹</button>
            <span className="month-label">{MONTHS_IT[d.getMonth()]} {year}</span>
            <button className="month-nav-btn" onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0}>›</button>
          </div>
          <span className={`summary-collapse-icon ${open ? 'open' : ''}`}>▼</span>
        </div>
      </div>

      {open && (
        <>
          {sorted.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {sorted.map(([cat, amount]) => (
                <div key={cat} className="category-bar-row">
                  <div className="category-bar-label">
                    <span>{EMOJI[cat] || '📦'}</span>
                    <span>{cat}</span>
                  </div>
                  <div className="category-bar-track">
                    <div className="category-bar-fill" style={{ width: `${(amount / maxCat) * 100}%` }} />
                  </div>
                  <div className="category-bar-amount">{fmt(amount)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="summary-totals">
            <div className="summary-total-item">
              <div className="summary-total-label">Entrate</div>
              <div className="summary-total-value" style={{ color: 'var(--teal)' }}>{fmt(totalIn)}</div>
            </div>
            <div className="summary-total-item">
              <div className="summary-total-label">Uscite</div>
              <div className="summary-total-value" style={{ color: 'var(--red)' }}>{fmt(totalOut)}</div>
            </div>
            <div className="summary-total-item">
              <div className="summary-total-label">Bilancio</div>
              <div className="summary-total-value" style={{ color: net >= 0 ? 'var(--teal)' : 'var(--red)' }}>
                {net >= 0 ? '+' : ''}{fmt(net)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
