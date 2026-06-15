import { useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useToast } from './Toast.jsx';

const CATEGORIES  = ['cibo','trasporti','salute','svago','regali','casa','shopping','lavoro','entrata','altro'];
const EMOJI       = { cibo:'🍽️',trasporti:'🚗',salute:'💊',svago:'🎮',regali:'🎁',casa:'🏠',shopping:'🛍️',lavoro:'💼',entrata:'💰',altro:'📦' };
const SOURCE_LABEL = { ai:'AI', dictionary:'Auto', manual:'Manuale' };

function today() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function detectMultiple(t) {
  const amounts = t.match(/\d+([.,]\d{1,2})?\s*€|€\s*\d+([.,]\d{1,2})?/gi);
  return amounts && amounts.length >= 2;
}

function splitText(t) {
  return t.split(/[,;]+/).map(s => s.trim()).filter(s => s.length > 1 && /\d/.test(s));
}

export default function AIInput({ onTransactionSaved }) {
  const showToast = useToast();

  const [text, setText]                   = useState('');
  const [loading, setLoading]             = useState(false);
  const [status, setStatus]               = useState('');
  const [parsed, setParsed]               = useState(null);
  const [multipleParsed, setMultipleParsed] = useState(null);
  const [showEdit, setShowEdit]           = useState(false);
  const [editData, setEditData]           = useState({});
  const [manual, setManual]               = useState(false);
  const [manualForm, setManualForm]       = useState({ amount:'', description:'', category:'altro', type:'out', date:'' });
  const [saving, setSaving]               = useState(false);
  const [success, setSuccess]             = useState(false);
  const [templates, setTemplates]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('wai_templates') || '[]'); } catch { return []; }
  });

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setParsed(null); setMultipleParsed(null); setManual(false); setShowEdit(false); setSuccess(false);

    // Detect multiple amounts separated by commas/semicolons
    const parts = detectMultiple(text) ? splitText(text) : null;
    if (parts && parts.length >= 2) {
      setStatus('Analizzando più transazioni…');
      try {
        const results = await Promise.all(
          parts.map(p =>
            apiFetch('/api/transactions/parse', { method:'POST', body: JSON.stringify({ raw_text: p }) })
              .then(r => r.json()).then(d => ({ ...d, rawText: p }))
          )
        );
        const valid = results.filter(r => !r.needsManualInput && r.amount > 0);
        if (valid.length >= 2) {
          setMultipleParsed(valid);
          setLoading(false); setStatus('');
          return;
        }
      } catch {}
    }

    setStatus('Analizzando…');
    try {
      const res  = await apiFetch('/api/transactions/parse', { method:'POST', body: JSON.stringify({ raw_text: text }) });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      const data = await res.json();
      if (data.source === 'dictionary') setStatus('Usando dizionario locale…');
      if (data.needsManualInput) {
        setManual(true);
        setManualForm({ amount: data.partialAmount || '', description: data.description || '', category:'altro', type:'out', date: data.date || today() });
      } else {
        setParsed(data);
        setEditData({ amount: data.amount, type: data.type, description: data.description, category: data.category, date: data.date });
      }
    } catch {
      setStatus('Errore di connessione. Inserisci manualmente.');
      setManual(true);
      setManualForm({ amount:'', description:'', category:'altro', type:'out', date: today() });
    } finally {
      setLoading(false); setStatus('');
    }
  }

  async function confirmSave() {
    setSaving(true);
    const payload = showEdit ? editData : { amount: parsed.amount, type: parsed.type, description: parsed.description, category: parsed.category, date: parsed.date };
    const res = await apiFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ ...payload, raw_input: text, source: parsed.source, confidence: parsed.confidence }),
    });
    setSaving(false);
    if (res.ok) {
      const newTx = await res.json();
      setSuccess(true);
      showToast('Transazione salvata');
      onTransactionSaved?.(newTx);
      setTimeout(() => { setSuccess(false); setText(''); setParsed(null); setShowEdit(false); }, 950);
    }
  }

  async function saveMultiple() {
    setSaving(true);
    let count = 0;
    for (const p of multipleParsed) {
      const res = await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          amount: p.amount, type: p.type, description: p.description,
          category: p.category, date: p.date,
          raw_input: p.rawText || text, source: p.source, confidence: p.confidence,
        }),
      });
      if (res.ok) { const tx = await res.json(); onTransactionSaved?.(tx); count++; }
    }
    setSaving(false);
    setSuccess(true);
    showToast(`${count} transazioni salvate`);
    setTimeout(() => { setSuccess(false); setText(''); setMultipleParsed(null); }, 950);
  }

  async function saveManual(e) {
    e.preventDefault();
    setSaving(true);
    const res = await apiFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ ...manualForm, amount: parseFloat(manualForm.amount), raw_input: text, source:'manual', confidence:'low' }),
    });
    setSaving(false);
    if (res.ok) {
      const newTx = await res.json();
      setSuccess(true);
      showToast('Transazione salvata');
      onTransactionSaved?.(newTx);
      setTimeout(() => {
        setSuccess(false); setText(''); setManual(false);
        setManualForm({ amount:'', description:'', category:'altro', type:'out', date: today() });
      }, 950);
    }
  }

  function cancel() { setParsed(null); setMultipleParsed(null); setManual(false); setShowEdit(false); setSuccess(false); }

  function saveTemplate() {
    const t = text.trim();
    if (!t || templates.includes(t)) return;
    const updated = [t, ...templates].slice(0, 8);
    setTemplates(updated);
    localStorage.setItem('wai_templates', JSON.stringify(updated));
    showToast('Template salvato');
  }

  function removeTemplate(t) {
    const updated = templates.filter(x => x !== t);
    setTemplates(updated);
    localStorage.setItem('wai_templates', JSON.stringify(updated));
  }

  return (
    <div className="ai-input-section card">
      <span className="ai-input-label">Nuova transazione</span>
      <form className="ai-input-row" onSubmit={handleSubmit}>
        <input
          className="ai-input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Es: sushi 22€ · pizza 12€, taxi 8€ · stipendio 1200"
          disabled={loading}
        />
        <button type="submit" className="ai-submit-btn" disabled={loading || !text.trim()}>
          {loading ? '…' : 'Analizza'}
        </button>
      </form>

      {/* Saved templates */}
      {templates.length > 0 && !text.trim() && !parsed && !multipleParsed && !manual && !success && (
        <div className="template-chips">
          {templates.map((t, i) => (
            <div key={i} className="template-chip">
              <button className="template-chip-text" onClick={() => setText(t)}>{t}</button>
              <button className="template-chip-del" onClick={() => removeTemplate(t)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="ai-status">
          <div className="spinner" />
          <span>{status} <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span>
        </div>
      )}

      {success && (
        <div className="save-success fade-in">
          <svg className="checkmark-svg" viewBox="0 0 52 52">
            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path   className="checkmark-check"  fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
          <span>Salvato!</span>
        </div>
      )}

      {/* Multi-transaction preview */}
      {multipleParsed && !success && (
        <div className="multi-preview fade-in">
          <div className="multi-preview-title">
            <span className="badge badge-ai">Multi</span>
            <span>{multipleParsed.length} transazioni rilevate</span>
          </div>
          {multipleParsed.map((p, i) => (
            <div key={i} className="multi-preview-item">
              <span className="multi-emoji">{EMOJI[p.category] || '📦'}</span>
              <span className="multi-desc">{p.description}</span>
              <span className={`multi-amount ${p.type}`}>
                {p.type === 'out' ? '-' : '+'}{parseFloat(p.amount).toFixed(2)} €
              </span>
            </div>
          ))}
          <div className="preview-actions" style={{ marginTop: '12px' }}>
            <button className="preview-confirm" onClick={saveMultiple} disabled={saving}>
              {saving ? '…' : `✓ Salva tutti (${multipleParsed.length})`}
            </button>
            <button className="preview-cancel" onClick={cancel}>✗ Annulla</button>
          </div>
        </div>
      )}

      {/* Single transaction preview */}
      {parsed && !multipleParsed && !manual && !success && (
        <div className="preview-card fade-in">
          <div className="preview-header">
            <span className="preview-emoji">{EMOJI[showEdit ? editData.category : parsed.category] || '📦'}</span>
            <span className="preview-desc">{showEdit ? editData.description : parsed.description}</span>
            <span className={`preview-amount ${showEdit ? editData.type : parsed.type}`}>
              {(showEdit ? editData.type : parsed.type) === 'out' ? '-' : '+'}
              {parseFloat(showEdit ? editData.amount : parsed.amount).toFixed(2)} €
            </span>
          </div>
          <div className="preview-meta">
            <span className={`badge badge-${showEdit ? editData.category : parsed.category}`}>{showEdit ? editData.category : parsed.category}</span>
            <span className={`badge badge-${parsed.source}`}>{SOURCE_LABEL[parsed.source]}</span>
            <span className="preview-date">📅 {showEdit ? editData.date : parsed.date}</span>
          </div>
          {showEdit && (
            <div className="preview-edit-form">
              <div className="form-group">
                <label>Importo (€)</label>
                <input className="input" type="number" inputMode="decimal" step="0.01" value={editData.amount}
                  onChange={e => setEditData(d => ({ ...d, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Data (GG/MM/AAAA)</label>
                <input className="input" value={editData.date}
                  onChange={e => setEditData(d => ({ ...d, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Categoria</label>
                <select className="select" value={editData.category}
                  onChange={e => setEditData(d => ({ ...d, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select className="select" value={editData.type}
                  onChange={e => setEditData(d => ({ ...d, type: e.target.value }))}>
                  <option value="out">uscita</option>
                  <option value="in">entrata</option>
                </select>
              </div>
              <div className="form-group manual-form-full">
                <label>Descrizione</label>
                <input className="input" value={editData.description}
                  onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="preview-actions">
            <button className="preview-confirm" onClick={confirmSave} disabled={saving}>{saving ? '…' : '✓ Conferma'}</button>
            <button className="preview-cancel" onClick={cancel}>✗ Annulla</button>
            <button className="preview-edit-link" onClick={() => setShowEdit(v => !v)}>{showEdit ? 'Nascondi' : 'Modifica'}</button>
            <button className="template-save-btn" onClick={saveTemplate} title="Salva come template">⭐</button>
          </div>
        </div>
      )}

      {manual && !success && (
        <form className="manual-form fade-in" onSubmit={saveManual}>
          <div className="manual-form-title">
            <span className="badge badge-manual">Manuale</span>
            <span>Inserisci i dettagli</span>
          </div>
          <div className="manual-form-grid">
            <div className="form-group">
              <label>Importo (€)</label>
              <input className="input" type="number" inputMode="decimal" step="0.01" required
                value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Data (GG/MM/AAAA)</label>
              <input className="input" required
                value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Categoria</label>
              <select className="select" value={manualForm.category}
                onChange={e => setManualForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select className="select" value={manualForm.type}
                onChange={e => setManualForm(f => ({ ...f, type: e.target.value }))}>
                <option value="out">uscita</option>
                <option value="in">entrata</option>
              </select>
            </div>
            <div className="form-group manual-form-full">
              <label>Descrizione</label>
              <input className="input" value={manualForm.description}
                onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : '✓ Salva'}</button>
            <button type="button" className="btn btn-ghost" onClick={cancel}>Annulla</button>
          </div>
        </form>
      )}
    </div>
  );
}
