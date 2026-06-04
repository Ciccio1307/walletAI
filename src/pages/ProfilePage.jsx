import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar.jsx';
import CategoryChart from '../components/CategoryChart.jsx';
import MonthlyChart from '../components/MonthlyChart.jsx';
import KeywordManager from '../components/KeywordManager.jsx';
import { apiFetch } from '../utils/api.js';

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('it-IT', { year: 'numeric', month: 'long' });
}

export default function ProfilePage() {
  const navigate  = useNavigate();
  const [user, setUser]           = useState(null);
  const [transactions, setTx]     = useState([]);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [loading, setLoading]     = useState(true);

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
    setBudgetInput(uData.user.initial_budget || 0);
    setTx(Array.isArray(tData) ? tData : []);
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();

  const monthTx = transactions.filter(tx => {
    if (!tx.date) return false;
    const [, m, y] = tx.date.split('/');
    return parseInt(m) - 1 === currentMonth && parseInt(y) === currentYear;
  });

  const totalIn  = monthTx.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const totalOut = monthTx.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const balance  = (user?.initial_budget || 0) + totalIn - totalOut;
  const isNeg    = balance < 0;

  const fmt  = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  async function saveBudget() {
    const val = parseFloat(budgetInput);
    if (isNaN(val)) return;
    const res = await apiFetch('/api/user/budget', {
      method: 'POST',
      body: JSON.stringify({ initial_budget: val }),
    });
    if (res.ok) {
      const d = await res.json();
      setUser(d.user);
      setEditingBudget(false);
    }
  }

  function exportCSV() {
    const meta = `#BACKUP,"${(user.username||'').replace(/"/g,'""')}","${(user.email||'').replace(/"/g,'""')}","${(user.full_name||'').replace(/"/g,'""')}",${user.initial_budget||0}`;
    const header = 'data,descrizione,categoria,tipo,importo,source,confidence,raw_input';
    const rows = transactions.map(t =>
      `${t.date},"${(t.description||'').replace(/"/g,'""')}",${t.category},${t.type},${t.amount},${t.source||'manual'},${t.confidence||'low'},"${(t.raw_input||'').replace(/"/g,'""')}"`
    );
    const csv = [meta, header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'walletai_backup.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

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

        {/* User card */}
        <div className="user-card card">
          <div className="avatar">{initials(user?.full_name)}</div>
          <div className="user-info">
            <h2>{user?.full_name}</h2>
            <div className="username">@{user?.username}</div>
            <div className="member-since">Membro da {formatDate(user?.created_at)}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Saldo attuale</div>
            <div className={`stat-value ${isNeg ? 'negative' : 'positive'}`}>{fmt(balance)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Budget iniziale</div>
            {!editingBudget ? (
              <>
                <div className="stat-value">{fmt(user?.initial_budget || 0)}</div>
                <div className="stat-edit-row">
                  <button className="stat-edit-btn" onClick={() => setEditingBudget(true)}>✏️ Modifica</button>
                </div>
              </>
            ) : (
              <div className="budget-edit-form">
                <input
                  type="number"
                  step="0.01"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={saveBudget}>
                  Salva
                </button>
                <button className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: '13px' }} onClick={() => setEditingBudget(false)}>
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-label">Uscite questo mese</div>
            <div className="stat-value negative">{fmt(totalOut)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Totale transazioni</div>
            <div className="stat-value">{transactions.length}</div>
          </div>
        </div>

        {/* Category chart */}
        <CategoryChart transactions={monthTx} />

        {/* Monthly trend */}
        <MonthlyChart transactions={transactions} />

        {/* Keywords */}
        <KeywordManager />

        {/* Export */}
        <button className="export-btn" onClick={exportCSV}>
          📥 Esporta CSV
        </button>

      </div>
    </>
  );
}
