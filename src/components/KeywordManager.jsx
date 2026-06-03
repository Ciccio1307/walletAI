import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';

const CATEGORIES = ['cibo','trasporti','salute','svago','regali','casa','shopping','lavoro','entrata','altro'];

export default function KeywordManager() {
  const [keywords, setKeywords] = useState([]);
  const [form, setForm]   = useState({ keyword: '', category: 'cibo', type: 'out' });
  const [error, setError] = useState('');

  useEffect(() => { loadKeywords(); }, []);

  async function loadKeywords() {
    const res = await apiFetch('/api/user/keywords');
    const data = await res.json();
    setKeywords(Array.isArray(data) ? data : []);
  }

  async function addKeyword(e) {
    e.preventDefault();
    setError('');
    if (!form.keyword.trim()) { setError('Inserisci una parola chiave'); return; }

    const res = await apiFetch('/api/user/keywords', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ keyword: '', category: 'cibo', type: 'out' });
      loadKeywords();
    } else {
      const d = await res.json();
      setError(d.error || 'Errore');
    }
  }

  async function deleteKeyword(id) {
    await apiFetch(`/api/user/keywords/${id}`, { method: 'DELETE' });
    setKeywords(k => k.filter(x => x.id !== id));
  }

  return (
    <div className="keywords-section card">
      <h3 className="section-title">Le mie parole chiave</h3>

      {keywords.length > 0 && (
        <div className="keywords-list">
          {keywords.map(kw => (
            <div key={kw.id} className="keyword-row">
              <span className="keyword-badge">{kw.keyword}</span>
              <span className={`badge badge-${kw.category}`}>{kw.category}</span>
              <span className={`badge ${kw.type === 'in' ? 'badge-entrata' : 'badge-altro'}`}>
                {kw.type === 'in' ? 'entrata' : 'uscita'}
              </span>
              <button className="keyword-delete" onClick={() => deleteKeyword(kw.id)} title="Elimina">×</button>
            </div>
          ))}
        </div>
      )}

      <form className="keyword-add-form" onSubmit={addKeyword}>
        <div className="keyword-add-row">
          <input
            className="input"
            placeholder="Es: tabacchi, affittacamere…"
            value={form.keyword}
            onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
          />
        </div>
        <div className="keyword-add-row">
          <select
            className="select"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="select"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          >
            <option value="out">uscita</option>
            <option value="in">entrata</option>
          </select>
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            Aggiungi
          </button>
        </div>
        {error && <p className="error-msg">{error}</p>}
      </form>

      <div className="keyword-hint" style={{ marginTop: 12 }}>
        Aggiungi parole che WalletAI non riconosce automaticamente.<br />
        Es: &quot;tabacchi&quot; → svago, &quot;affittacamere&quot; → entrata
      </div>
    </div>
  );
}
