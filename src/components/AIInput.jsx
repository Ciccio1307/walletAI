import { useState } from 'react';
import { apiFetch } from '../utils/api.js';

export default function AIInput({ onTransactionSaved }) {
  const [text, setText]     = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [parsed, setParsed] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({});
  const [manual, setManual]   = useState(false);
  const [manualForm, setManualForm] = useState({ amount: '', description: '', category: 'altro', type: 'out', date: '' });
  const [saving, setSaving]   = useState(false);

  const CATEGORIES = ['cibo','trasporti','salute','svago','regali','casa','shopping','lavoro','entrata','altro'];

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setStatus('Chiedendo a Ollama…');
    setParsed(null);
    setManual(false);
    setShowEdit(false);

    try {
      const res = await apiFetch('/api/transactions/parse', {
        method: 'POST',
        body: JSON.stringify({ raw_text: text }),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      const data = await res.json();

      if (data.source === 'dictionary') setStatus('Usando dizionario locale…');

      if (data.needsManualInput) {
        setManual(true);
        setManualForm({
          amount: data.partialAmount || '',
          description: data.description || '',
          category: 'altro',
          type: 'out',
          date: data.date || today(),
        });
      } else {
        setParsed(data);
        setEditData({
          amount: data.amount,
          type: data.type,
          description: data.description,
          category: data.category,
          date: data.date,
        });
      }
    } catch (err) {
      setStatus('Errore di connessione. Inserisci manualmente.');
      setManual(true);
      setManualForm({ amount: '', description: '', category: 'altro', type: 'out', date: today() });
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  async function confirmSave() {
    setSaving(true);
    const payload = showEdit ? editData : {
      amount: parsed.amount,
      type: parsed.type,
      description: parsed.description,
      category: parsed.category,
      date: parsed.date,
    };

    const res = await apiFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        raw_input: text,
        source: parsed.source,
        confidence: parsed.confidence,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setText('');
      setParsed(null);
      setShowEdit(false);
      onTransactionSaved?.();
    }
  }

  async function saveManual(e) {
    e.preventDefault();
    setSaving(true);
    const res = await apiFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        ...manualForm,
        amount: parseFloat(manualForm.amount),
        raw_input: text,
        source: 'manual',
        confidence: 'low',
      }),
    });
    setSaving(false);
    if (res.ok) {
      setText('');
      setManual(false);
      setManualForm({ amount: '', description: '', category: 'altro', type: 'out', date: today() });
      onTransactionSaved?.();
    }
  }

  function cancel() {
    setParsed(null);
    setManual(false);
    setShowEdit(false);
  }

  function today() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  const EMOJI = { cibo:'🍽️',trasporti:'🚗',salute:'💊',svago:'🎮',regali:'🎁',casa:'🏠',shopping:'🛍️',lavoro:'💼',entrata:'💰',altro:'📦' };
  const SOURCE_LABEL = { ai: 'AI', dictionary: 'Auto', manual: 'Manuale' };

  return (
    <div className="ai-input-section card">
      <span className="ai-input-label">Nuova transazione</span>
      <form className="ai-input-row" onSubmit={handleSubmit}>
        <input
          className="ai-input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Es: speso 22€ sushi ieri · ricevuto stipendio 1200 · benzina 45€"
          disabled={loading}
        />
        <button type="submit" className="ai-submit-btn" disabled={loading || !text.trim()}>
          {loading ? '…' : 'Analizza'}
        </button>
      </form>

      {loading && (
        <div className="ai-status">
          <div className="spinner" />
          <span>{status} <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span>
        </div>
      )}

      {parsed && !manual && (
        <div className="preview-card fade-in">
          <div className="preview-header">
            <span className="preview-emoji">{EMOJI[showEdit ? editData.category : parsed.category] || '📦'}</span>
            <span className="preview-desc">
              {showEdit ? editData.description : parsed.description}
            </span>
            <span className={`preview-amount ${(showEdit ? editData.type : parsed.type)}`}>
              {(showEdit ? editData.type : parsed.type) === 'out' ? '-' : '+'}
              {parseFloat(showEdit ? editData.amount : parsed.amount).toFixed(2)} €
            </span>
          </div>

          <div className="preview-meta">
            <span className={`badge badge-${showEdit ? editData.category : parsed.category}`}>
              {showEdit ? editData.category : parsed.category}
            </span>
            <span className={`badge badge-${parsed.source}`}>
              {SOURCE_LABEL[parsed.source]}
            </span>
            <span className="preview-date">
              📅 {showEdit ? editData.date : parsed.date}
            </span>
          </div>

          {showEdit && (
            <div className="preview-edit-form">
              <div className="form-group">
                <label>Importo (€)</label>
                <input className="input" type="number" step="0.01" value={editData.amount}
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
            <button className="preview-confirm" onClick={confirmSave} disabled={saving}>
              {saving ? '…' : '✓ Conferma'}
            </button>
            <button className="preview-cancel" onClick={cancel}>✗ Annulla</button>
            <button className="preview-edit-link" onClick={() => setShowEdit(v => !v)}>
              {showEdit ? 'Nascondi' : 'Modifica'}
            </button>
          </div>
        </div>
      )}

      {manual && (
        <form className="manual-form fade-in" onSubmit={saveManual}>
          <div className="manual-form-title">
            <span className={`badge badge-manual`}>Manuale</span>
            <span>Inserisci i dettagli</span>
          </div>
          <div className="manual-form-grid">
            <div className="form-group">
              <label>Importo (€)</label>
              <input className="input" type="number" step="0.01" required
                value={manualForm.amount}
                onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Data (GG/MM/AAAA)</label>
              <input className="input" required
                value={manualForm.date}
                onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} />
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '…' : '✓ Salva'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancel}>Annulla</button>
          </div>
        </form>
      )}
    </div>
  );
}
