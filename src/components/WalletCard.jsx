export default function WalletCard({ user, transactions }) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthTx = transactions.filter(tx => {
    const [d, m, y] = tx.date.split('/');
    return parseInt(m) - 1 === currentMonth && parseInt(y) === currentYear;
  });

  const totalIn  = monthTx.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const totalOut = monthTx.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const balance  = (user?.initial_budget || 0) + totalIn - totalOut;
  const isNeg = balance < 0;

  const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <div className="wallet-card card">
      <div className={`wallet-balance ${isNeg ? 'negative' : 'positive'}`}>
        {fmt(balance)}
      </div>
      <div className="wallet-budget-line">
        Budget iniziale: {fmt(user?.initial_budget || 0)}
      </div>
      <div className="wallet-stats-row">
        <div className="wallet-stat-item">
          <div className="wallet-stat-label">Entrate</div>
          <div className="wallet-stat-value in">+{fmt(totalIn)}</div>
        </div>
        <div className="wallet-stat-item">
          <div className="wallet-stat-label">Uscite</div>
          <div className="wallet-stat-value out">-{fmt(totalOut)}</div>
        </div>
        <div className="wallet-stat-item">
          <div className="wallet-stat-label">Transazioni</div>
          <div className="wallet-stat-value">{transactions.length}</div>
        </div>
      </div>
    </div>
  );
}
