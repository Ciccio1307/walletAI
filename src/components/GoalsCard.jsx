import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api.js';

export default function GoalsCard({ monthlySavings = 0 }) {
  const [goals, setGoals]           = useState([]);
  const [showAdd, setShowAdd]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [editVal, setEditVal]       = useState('');
  const [form, setForm]             = useState({ name: '', target_amount: '', current_amount: '', deadline: '' });

  const load = useCallback(async () => {
    const res = await apiFetch('/api/goals');
    if (res.ok) setGoals(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  async function addGoal(e) {
    e.preventDefault();
    setSaving(true);
    const res = await apiFetch('/api/goals', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        deadline: form.deadline || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowAdd(false);
      setForm({ name: '', target_amount: '', current_amount: '', deadline: '' });
      load();
    }
  }

  async function saveUpdate(id) {
    const val = parseFloat(editVal);
    if (isNaN(val) || val < 0) return;
    const res = await apiFetch(`/api/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ current_amount: val }),
    });
    if (res.ok) { setEditingId(null); load(); }
  }

  async function deleteGoal(id) {
    await apiFetch(`/api/goals/${id}`, { method: 'DELETE' });
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  return (
    <div className="goals-card card">
      <div className="goals-header">
        <h3 className="section-title">Obiettivi di risparmio</h3>
        <button className="goals-add-btn" onClick={() => setShowAdd(v => !v)}>
          {showAdd ? '✕ Chiudi' : '+ Nuovo'}
        </button>
      </div>

      {showAdd && (
        <form className="goals-form fade-in" onSubmit={addGoal}>
          <div className="goals-form-grid">
            <div className="form-group">
              <label>Nome obiettivo</label>
              <input className="input" required placeholder="Es. Vacanza, MacBook…"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Target (€)</label>
              <input className="input" type="number" step="0.01" required inputMode="decimal"
                value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Già risparmiato (€)</label>
              <input className="input" type="number" step="0.01" inputMode="decimal"
                value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Scadenza (opz.)</label>
              <input className="input" type="date" value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : '+ Aggiungi'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Annulla</button>
          </div>
        </form>
      )}

      {goals.length === 0 && !showAdd && (
        <p className="goals-empty">Nessun obiettivo. Aggiungine uno per iniziare!</p>
      )}

      {goals.map(g => {
        const pct  = Math.min((g.current_amount / g.target_amount) * 100, 100);
        const done = pct >= 100;
        return (
          <div key={g.id} className={`goal-row${done ? ' done' : ''}`}>
            <div className="goal-info">
              <span className="goal-name">{done ? '✅' : '🎯'} {g.name}</span>
              <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                {!done && monthlySavings > 0 && g.current_amount < g.target_amount && (
                  <span className="goal-projection">
                    ~{Math.ceil((g.target_amount - g.current_amount) / monthlySavings)} mesi
                  </span>
                )}
                {g.deadline && (
                  <span className="goal-deadline">
                    entro {new Date(g.deadline).toLocaleDateString('it-IT')}
                  </span>
                )}
              </div>
            </div>
            <div className="goal-amounts">
              <span className="goal-current">{fmt(g.current_amount)}</span>
              <span className="goal-sep"> / </span>
              <span className="goal-target">{fmt(g.target_amount)}</span>
            </div>
            <div className="goal-bar-track">
              <div className={`goal-bar-fill${done ? ' done' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="goal-actions">
              <span className="goal-pct">{Math.round(pct)}%</span>
              {editingId === g.id ? (
                <>
                  <input
                    className="input goal-update-input"
                    type="number" step="0.01" inputMode="decimal"
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    autoFocus
                  />
                  <button className="btn btn-primary goal-action-btn" onClick={() => saveUpdate(g.id)}>✓</button>
                  <button className="btn btn-ghost goal-action-btn" onClick={() => setEditingId(null)}>✕</button>
                </>
              ) : (
                <button className="goal-update-btn" onClick={() => { setEditingId(g.id); setEditVal(g.current_amount); }}>
                  ✏️ Aggiorna
                </button>
              )}
              <button className="goal-delete-btn" onClick={() => deleteGoal(g.id)}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
