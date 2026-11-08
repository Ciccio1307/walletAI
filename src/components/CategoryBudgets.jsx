import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';
import { useToast } from './Toast.jsx';

const CATEGORIES = ['cibo', 'trasporti', 'salute', 'svago', 'regali', 'casa', 'shopping', 'lavoro', 'altro'];
const EMOJI = { cibo: '🍽️', trasporti: '🚗', salute: '💊', svago: '🎮', regali: '🎁', casa: '🏠', shopping: '🛍️', lavoro: '💼', altro: '📦' };

export default function CategoryBudgets({ spending = {} }) {
  const showToast = useToast();
  const [budgets, setBudgets] = useState({});
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/user/category-budgets');
      if (res.ok) {
        const rows = await res.json();
        const map = {};
        rows.forEach((row) => { map[row.category] = row.budget_amount; });
        setBudgets(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveBudget(category) {
    const value = parseFloat(editVal);
    const res = await apiFetch(`/api/user/category-budgets/${category}`, {
      method: 'PUT',
      body: JSON.stringify({ budget_amount: Number.isFinite(value) ? value : 0 }),
    });

    if (res.ok) {
      setEditing(null);
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || 'Errore durante il salvataggio', 'error');
    }
  }

  const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  if (loading) return null;

  // Show every category so a budget can be created before the first expense.
  const ordered = [...CATEGORIES].sort((a, b) => {
    const scoreA = (spending[a] || 0) + (budgets[a] ? 1 : 0);
    const scoreB = (spending[b] || 0) + (budgets[b] ? 1 : 0);
    return scoreB - scoreA;
  });

  return (
    <div className="category-budgets card">
      <h3 className="section-title">Budget per categoria</h3>
      {ordered.map((cat) => {
        const spent = spending[cat] || 0;
        const budget = budgets[cat];
        const pct = budget ? Math.min((spent / budget) * 100, 100) : null;
        const over = budget && spent > budget;
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
                    onChange={(e) => setEditVal(e.target.value)}
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
