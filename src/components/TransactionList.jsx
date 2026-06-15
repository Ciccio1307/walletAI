import { useState, useRef } from 'react';

const EMOJI = { cibo:'🍽️',trasporti:'🚗',salute:'💊',svago:'🎮',regali:'🎁',casa:'🏠',shopping:'🛍️',lavoro:'💼',entrata:'💰',altro:'📦' };
const SOURCE_LABEL = { ai: 'AI', dictionary: 'Auto', manual: 'Manuale' };
const CATEGORIES = ['cibo','trasporti','salute','svago','regali','casa','shopping','lavoro','entrata','altro'];
const SWIPE_THRESHOLD = -75;

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const [d, m, y] = dateStr.split('/');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (date.getTime() === today.getTime()) return 'Oggi';
  if (date.getTime() === yesterday.getTime()) return 'Ieri';
  const days   = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  return `${days[date.getDay()]} ${d} ${months[date.getMonth()]}`;
}

export default function TransactionList({ transactions, onDelete, onEdit, onToggleRecurring }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState({});
  const swipeRef = useRef({ id: null, startX: 0 });
  const [swipeState, setSwipeState] = useState({ id: null, x: 0 });

  function startEdit(tx) {
    setEditingId(tx.id);
    setEditForm({ amount: tx.amount, type: tx.type, description: tx.description || '', category: tx.category || 'altro', date: tx.date || '' });
  }

  async function saveEdit(id) {
    await onEdit?.(id, { ...editForm, amount: parseFloat(editForm.amount) });
    setEditingId(null);
  }

  // ── Swipe to delete ──
  function onTouchStart(e, id) {
    if (editingId) return;
    swipeRef.current = { id, startX: e.touches[0].clientX };
  }

  function onTouchMove(e, id) {
    if (swipeRef.current.id !== id) return;
    const delta = e.touches[0].clientX - swipeRef.current.startX;
    if (delta < 0) setSwipeState({ id, x: Math.max(delta, -110) });
  }

  function onTouchEnd(id) {
    if (swipeRef.current.id !== id) return;
    if (swipeState.x < SWIPE_THRESHOLD) {
      navigator.vibrate?.(30);
      onDelete(id);
    }
    setSwipeState({ id: null, x: 0 });
    swipeRef.current = { id: null, startX: 0 };
  }

  const fmt = (n) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💸</div>
        <h3>Nessuna transazione</h3>
        <p>Aggiungi la tua prima transazione usando il campo qui sopra!</p>
      </div>
    );
  }

  const groups = {};
  for (const tx of transactions) {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  }
  const sortedDates = Object.keys(groups).sort((a, b) => {
    const parse = s => { const [d, m, y] = s.split('/'); return new Date(y, m-1, d); };
    return parse(b) - parse(a);
  });

  return (
    <div className="transactions-section">
      {sortedDates.map(date => (
        <div key={date}>
          <div className="date-separator">{formatDateLabel(date)}</div>
          {groups[date].map(tx => (
            editingId === tx.id ? (
              <div key={tx.id} className="tx-edit-row">
                <input className="input tx-edit-input wide" placeholder="Descrizione"
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                <input className="input tx-edit-input" type="number" inputMode="decimal" step="0.01" placeholder="Importo"
                  value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                <input className="input tx-edit-input" placeholder="GG/MM/AAAA"
                  value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                <select className="select tx-edit-select" value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="select tx-edit-select" value={editForm.type}
                  onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="out">uscita</option>
                  <option value="in">entrata</option>
                </select>
                <button className="btn btn-primary tx-edit-save" onClick={() => saveEdit(tx.id)}>✓</button>
                <button className="btn btn-ghost tx-edit-cancel" onClick={() => setEditingId(null)}>✕</button>
              </div>
            ) : (
              <div key={tx.id} className="tx-row-wrapper">
                <div className="tx-swipe-bg">🗑️</div>
                <div
                  className={`tx-row tx-${tx.type}`}
                  style={{
                    transform: swipeState.id === tx.id ? `translateX(${swipeState.x}px)` : 'none',
                    transition: swipeState.id === tx.id ? 'none' : 'transform 0.25s ease',
                  }}
                  onTouchStart={e => onTouchStart(e, tx.id)}
                  onTouchMove={e => onTouchMove(e, tx.id)}
                  onTouchEnd={() => onTouchEnd(tx.id)}
                >
                  <span className="tx-emoji">{EMOJI[tx.category] || '📦'}</span>
                  <div className="tx-info">
                    <div className="tx-desc">
                      {tx.description || tx.category}
                      {tx.recurring ? <span className="tx-recurring-badge">🔁</span> : null}
                    </div>
                    <div className="tx-meta">
                      <span className={`badge badge-${tx.category}`}>{tx.category}</span>
                      {tx.source && (
                        <span className={`badge badge-${tx.source}`} style={{ fontSize: '11px', padding: '2px 7px' }}>
                          {SOURCE_LABEL[tx.source] || tx.source}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`tx-amount ${tx.type}`}>
                    {tx.type === 'out' ? '-' : '+'}{fmt(tx.amount)} €
                  </span>
                  <div className="tx-actions">
                    <button
                      className={`tx-recurring-btn ${tx.recurring ? 'active' : ''}`}
                      onClick={() => onToggleRecurring?.(tx.id)}
                      title={tx.recurring ? 'Rimuovi dai ricorrenti' : 'Segna come ricorrente'}
                    >🔁</button>
                    <button className="tx-edit-btn" onClick={() => startEdit(tx)} title="Modifica">✏️</button>
                    <button className="tx-delete" onClick={() => onDelete(tx.id)} title="Elimina">×</button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      ))}
    </div>
  );
}
