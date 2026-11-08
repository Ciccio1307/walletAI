import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';

const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const EMOJI = { cibo: '🍽️', trasporti: '🚗', salute: '💊', svago: '🎮', regali: '🎁', casa: '🏠', shopping: '🛍️', lavoro: '💼', entrata: '💰', altro: '📦' };

const pad = (n) => String(n).padStart(2, '0');

export default function MonthlySummary({ initialSummary }) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(true);
  const [summary, setSummary] = useState(initialSummary || null);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const monthKey = `${year}-${pad(month)}`;

  useEffect(() => {
    if (offset === 0 && initialSummary) {
      setSummary(initialSummary);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch(`/api/transactions/summary?month=${monthKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [offset, initialSummary, monthKey]);

  const totalIn = summary?.in || 0;
  const totalOut = summary?.out || 0;
  const net = totalIn - totalOut;

  const sorted = Object.entries(summary?.categories || {})
    .filter(([, amount]) => Number(amount) > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxCat = sorted[0]?.[1] || 1;

  const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  function toggle() { setOpen((value) => !value); }

  return (
    <div className="summary-section card">
      <div
        className="summary-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <h3 className="section-title" style={{ margin: 0 }}>Riepilogo mensile</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="summary-month-nav" onClick={(event) => event.stopPropagation()}>
            <button className="month-nav-btn" onClick={() => setOffset((value) => value + 1)}>‹</button>
            <span className="month-label">{MONTHS_IT[month - 1]} {year}</span>
            <button className="month-nav-btn" onClick={() => setOffset((value) => Math.max(0, value - 1))} disabled={offset === 0}>›</button>
          </div>
          <span className={`summary-collapse-icon ${open ? 'open' : ''}`}>▼</span>
        </div>
      </div>

      {open && (
        <>
          {loading && <p className="summary-loading">Caricamento…</p>}

          {!loading && sorted.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {sorted.map(([category, amount]) => (
                <div key={category} className="category-bar-row">
                  <div className="category-bar-label">
                    <span>{EMOJI[category] || '📦'}</span>
                    <span>{category}</span>
                  </div>
                  <div className="category-bar-track">
                    <div className="category-bar-fill" style={{ width: `${(amount / maxCat) * 100}%` }} />
                  </div>
                  <div className="category-bar-amount">{fmt(amount)}</div>
                </div>
              ))}
            </div>
          )}

          {!loading && sorted.length === 0 && (
            <p className="summary-loading">Nessuna uscita in questo mese.</p>
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
