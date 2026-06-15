import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';

const CATEGORIES = ['cibo','trasporti','salute','svago','regali','casa','shopping','lavoro','altro'];
const EMOJI = { cibo:'🍽️',trasporti:'🚗',salute:'💊',svago:'🎮',regali:'🎁',casa:'🏠',shopping:'🛍️',lavoro:'💼',altro:'📦' };

export default function CategoryBudgets({ monthTx }) {
  const [budgets, setBudgets] = useState({});
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiFetch('/api/user/category-budgets');
    if (res.ok) {
      const rows = await res.json();
      const map = {};
      rows.forEach(r => { map[r.category] = r.budget_amount; });
      setBudgets(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveBudget(category) {
    const val = parseFloat(editVal);
    await apiFetch(`/api/user/category-budgets/${category}`, {
      method: 'PUT',
      body: JSON.stringify({ budget_amount: isNaN(val) ? 0 : val }),
    });
    setEditing(null);
    load();
  }

  const fmt = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  const spending = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = monthTx.filter(t => t.type === 'out' && t.category === cat).reduce((s, t) => s + t.amount, 0);
    return acc;
  }, {});

  const activeCats = CATEGORIES.filter(cat => spending[cat] > 0 || budgets[cat]);

  if (loading || activeCats.length === 0) return null;

  return (
    <div className="category-budgets card">
      <h3 className="section-title">Budget per categoria</h3>
      {activeCats.map(cat => {
        const spent  = spending[cat] || 0;
        const budget = budgets[cat];
        const pct    = budget ? Math.min((spent / budget) * 100, 100) : null;
        const over   = budget && spent > budget;
        return (
          <div key={cat} className="cb-row">
            <div className="cb-header">
              <span className="cb-label">{EMOJI[cat]} {cat}</span>
              <span className={`cb-spent${over ? ' over' : ''}`}>{fmt(spent)}</span>
              {editing === cat ? (
                <div className="cb-edit">
                  <input
                    type="number" step="0.01" inputMode="decimal"
                    className="input cb-input"
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    placeholder="Limite €"
                    autoFocus
                  />
                  <button className="btn btn-primary cb-save-btn" onClick={() => saveBudget(cat)}>✓</button>
                  <button className="btn btn-ghost cb-save-btn" onClick={() => setEditing(null)}>✕</button>
                </div>
              ) : (
                <button className="cb-set-btn"
                  onClick={() => { setEditing(cat); setEditVal(budget || ''); }}>
                  {budget ? fmt(budget) : '+ Limite'}
                </button>
              )}
            </div>
            {pct !== null && (
              <div className="cb-bar-track">
                <div className={`cb-bar-fill${over ? ' over' : pct > 80 ? ' warn' : ''}`}
                  style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
