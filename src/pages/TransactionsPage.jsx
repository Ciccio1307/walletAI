import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar.jsx';
import WalletCard from '../components/WalletCard.jsx';
import AIInput from '../components/AIInput.jsx';
import TransactionList from '../components/TransactionList.jsx';
import MonthlySummary from '../components/MonthlySummary.jsx';
import { apiFetch } from '../utils/api.js';

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [user, setUser]       = useState(null);
  const [transactions, setTx] = useState([]);
  const [filter, setFilter]   = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    const [uRes, tRes] = await Promise.all([
      apiFetch('/api/auth/me'),
      apiFetch('/api/transactions'),
    ]);

    if (uRes.status === 401) { localStorage.removeItem('token'); navigate('/login'); return; }

    const uData = await uRes.json();
    const tData = await tRes.json();

    setUser(uData.user);
    setTx(Array.isArray(tData) ? tData : []);
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  async function deleteTransaction(id) {
    await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
    setTx(prev => prev.filter(t => t.id !== id));
  }

  const filtered = transactions.filter(t => {
    if (filter === 'in')  return t.type === 'in';
    if (filter === 'out') return t.type === 'out';
    return true;
  });

  const countIn  = transactions.filter(t => t.type === 'in').length;
  const countOut = transactions.filter(t => t.type === 'out').length;

  if (loading) {
    return (
      <>
        <NavBar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner" />
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <div className="page-content">

        <WalletCard user={user} transactions={transactions} />

        <AIInput onTransactionSaved={load} />

        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'all'  ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Tutte ({transactions.length})
          </button>
          <button className={`filter-tab ${filter === 'out'  ? 'active' : ''}`} onClick={() => setFilter('out')}>
            Uscite ({countOut})
          </button>
          <button className={`filter-tab ${filter === 'in'   ? 'active' : ''}`} onClick={() => setFilter('in')}>
            Entrate ({countIn})
          </button>
        </div>

        <TransactionList transactions={filtered} onDelete={deleteTransaction} />

        <MonthlySummary transactions={transactions} />

      </div>
    </>
  );
}
