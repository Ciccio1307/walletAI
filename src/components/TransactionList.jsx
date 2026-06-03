const EMOJI = { cibo:'🍽️',trasporti:'🚗',salute:'💊',svago:'🎮',regali:'🎁',casa:'🏠',shopping:'🛍️',lavoro:'💼',entrata:'💰',altro:'📦' };
const SOURCE_LABEL = { ai: 'AI', dictionary: 'Auto', manual: 'Manuale' };

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const [d, m, y] = dateStr.split('/');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Oggi';
  if (date.getTime() === yesterday.getTime()) return 'Ieri';

  const dayNames = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  const monthNames = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
    'luglio','agosto','settembre','ottobre','novembre','dicembre'];

  return `${dayNames[date.getDay()]} ${d} ${monthNames[date.getMonth()]}`;
}

export default function TransactionList({ transactions, onDelete }) {
  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💸</div>
        <h3>Nessuna transazione</h3>
        <p>Aggiungi la tua prima transazione usando il campo qui sopra!</p>
      </div>
    );
  }

  // Group by date
  const groups = {};
  for (const tx of transactions) {
    const key = tx.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }

  const sortedDates = Object.keys(groups).sort((a, b) => {
    const parse = s => { const [d, m, y] = s.split('/'); return new Date(y, m - 1, d); };
    return parse(b) - parse(a);
  });

  const fmt = (n) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="transactions-section">
      {sortedDates.map(date => (
        <div key={date}>
          <div className="date-separator">{formatDateLabel(date)}</div>
          {groups[date].map(tx => (
            <div key={tx.id} className="tx-row">
              <span className="tx-emoji">{EMOJI[tx.category] || '📦'}</span>
              <div className="tx-info">
                <div className="tx-desc">{tx.description || tx.category}</div>
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
              <button className="tx-delete" onClick={() => onDelete(tx.id)} title="Elimina">×</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
