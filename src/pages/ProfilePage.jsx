import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar.jsx';
import CategoryChart from '../components/CategoryChart.jsx';
import MonthlyChart from '../components/MonthlyChart.jsx';
import KeywordManager from '../components/KeywordManager.jsx';
import GoalsCard from '../components/GoalsCard.jsx';
import AccountSettings from '../components/AccountSettings.jsx';
import CategoryBudgets from '../components/CategoryBudgets.jsx';
import { apiFetch } from '../utils/api.js';
import SkeletonCard from '../components/SkeletonCard.jsx';
import { useToast } from '../components/Toast.jsx';

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('it-IT', { year: 'numeric', month: 'long' });
}

function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { cols.push(current); current = ''; }
    else { current += ch; }
  }
  cols.push(current);
  return cols;
}

export default function ProfilePage() {
  const navigate  = useNavigate();
  const showToast = useToast();
  const importRef = useRef(null);
  const [user, setUser]                   = useState(null);
  const [transactions, setTx]             = useState([]);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput]     = useState('');
  const [loading, setLoading]             = useState(true);

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

  const now          = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();

  const monthTx = transactions.filter(tx => {
    if (!tx.date) return false;
    const [, m, y] = tx.date.split('/');
    return parseInt(m) - 1 === currentMonth && parseInt(y) === currentYear;
  });

  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthTx   = transactions.filter(tx => {
    if (!tx.date) return false;
    const [, m, y] = tx.date.split('/');
    return parseInt(m) - 1 === lastMonthDate.getMonth() && parseInt(y) === lastMonthDate.getFullYear();
  });

  const totalIn      = monthTx.filter(t => t.type === 'in').reduce((s, t)  => s + t.amount, 0);
  const totalOut     = monthTx.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const lastMonthOut = lastMonthTx.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const balance      = (user?.initial_budget || 0) + totalIn - totalOut;
  const isNeg        = balance < 0;
  const outDelta     = lastMonthOut > 0 ? ((totalOut - lastMonthOut) / lastMonthOut * 100) : null;

  const fmt = n => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  async function saveBudget() {
    const val = parseFloat(budgetInput);
    if (isNaN(val)) return;
    const res = await apiFetch('/api/user/budget', {
      method: 'POST',
      body: JSON.stringify({ initial_budget: val }),
    });
    if (res.ok) { const d = await res.json(); setUser(d.user); setEditingBudget(false); }
  }

  function exportCSV() {
    const meta   = `#BACKUP,"${(user.username||'').replace(/"/g,'""')}","${(user.email||'').replace(/"/g,'""')}","${(user.full_name||'').replace(/"/g,'""')}",${user.initial_budget||0}`;
    const header = 'data,descrizione,categoria,tipo,importo,source,confidence,raw_input';
    const rows   = transactions.map(t =>
      `${t.date},"${(t.description||'').replace(/"/g,'""')}",${t.category},${t.type},${t.amount},${t.source||'manual'},${t.confidence||'low'},"${(t.raw_input||'').replace(/"/g,'""')}"`
    );
    const csv  = [meta, header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'walletai_backup.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text  = await file.text();
    const lines = text.trim().split('\n');
    const rows  = [];
    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('data,')) continue;
      const cols   = parseCSVLine(line);
      if (cols.length < 5) continue;
      const amount = parseFloat(cols[4]);
      if (!amount || !['in','out'].includes(cols[3])) continue;
      rows.push({
        date: cols[0], description: cols[1], category: cols[2],
        type: cols[3], amount,
        source: cols[5] || 'manual', confidence: cols[6] || 'low', raw_input: cols[7] || '',
      });
    }
    if (rows.length === 0) { showToast('Nessuna transazione valida nel file', 'error'); return; }
    const res = await apiFetch('/api/transactions/import', { method: 'POST', body: JSON.stringify(rows) });
    if (res.ok) {
      const { imported } = await res.json();
      showToast(`${imported} transazioni importate`);
      load();
    } else {
      showToast('Errore durante l\'importazione', 'error');
    }
    if (importRef.current) importRef.current.value = '';
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="page-content">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
          <SkeletonCard tall />
          <SkeletonCard lines={3} />
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

        {/* Budget notifications */}
        {balance < 0 && (
          <div className="budget-alert">
            ⚠️ Saldo negativo: hai speso {fmt(Math.abs(balance))} più di quanto disponibile
          </div>
        )}
        {balance >= 0 && totalIn > 0 && totalOut > totalIn * 0.8 && (
          <div className="budget-warning">
            ⚠️ Questo mese hai speso l'{Math.round(totalOut / totalIn * 100)}% delle tue entrate
          </div>
        )}

        {/* Stats grid */}
        <div className="stats-grid">
          <div className={`stat-card ${isNeg ? 'accent-red' : 'accent-teal'}`}>
            <div className="stat-label">Saldo attuale</div>
            <div className={`stat-value ${isNeg ? 'negative' : 'positive'}`}>{fmt(balance)}</div>
          </div>

          <div className="stat-card accent-teal">
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
                <input type="number" step="0.01" value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)} autoFocus />
                <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={saveBudget}>Salva</button>
                <button className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: '13px' }} onClick={() => setEditingBudget(false)}>✕</button>
              </div>
            )}
          </div>

          <div className="stat-card accent-red">
            <div className="stat-label">Uscite questo mese</div>
            <div className="stat-value negative">{fmt(totalOut)}</div>
            {outDelta !== null && (
              <div className={`delta-badge ${outDelta >= 0 ? 'up' : 'down'}`}>
                {outDelta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(outDelta))}% vs mese scorso
              </div>
            )}
          </div>

          <div className="stat-card accent-ink">
            <div className="stat-label">Totale transazioni</div>
            <div className="stat-value">{transactions.length}</div>
          </div>
        </div>

        <CategoryChart transactions={monthTx} />
        <CategoryBudgets monthTx={monthTx} />
        <MonthlyChart transactions={transactions} />
        <GoalsCard monthlySavings={totalIn - totalOut} />
        <KeywordManager />
        <AccountSettings />

        {/* Export / Import */}
        <div className="export-row">
          <button className="export-btn" onClick={exportCSV}>📥 Esporta CSV</button>
          <label className="export-btn import-label">
            📤 Importa CSV
            <input ref={importRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importCSV} />
          </label>
        </div>

      </div>
    </>
  );
}
