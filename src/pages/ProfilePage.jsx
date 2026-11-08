import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar.jsx';
import CategoryChart from '../components/CategoryChart.jsx';
import MonthlyChart from '../components/MonthlyChart.jsx';
import KeywordManager from '../components/KeywordManager.jsx';
import GoalsCard from '../components/GoalsCard.jsx';
import AccountSettings from '../components/AccountSettings.jsx';
import CategoryBudgets from '../components/CategoryBudgets.jsx';
import { apiFetch, clearSession } from '../utils/api.js';
import SkeletonCard from '../components/SkeletonCard.jsx';
import { useToast } from '../components/Toast.jsx';

function initials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(value) {
  if (!value) return '';
  // SQLite returns "YYYY-MM-DD HH:MM:SS"; Safari needs the ISO "T".
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT', { year: 'numeric', month: 'long' });
}

function todayParam() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const importRef = useRef(null);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [userRes, statsRes] = await Promise.all([
        apiFetch('/api/auth/me'),
        apiFetch(`/api/transactions/stats?today=${encodeURIComponent(todayParam())}`),
      ]);

      if (!userRes.ok) {
        // Only drop the session when it is really invalid; otherwise LoginPage
        // would see the token and bounce back here in an endless loop.
        if (userRes.status === 401 || userRes.status === 404) {
          clearSession();
          navigate('/login', { replace: true });
        } else {
          showToast('Errore nel caricamento del profilo', 'error');
        }
        return;
      }

      const userData = await userRes.json();
      const statsData = statsRes.ok ? await statsRes.json() : null;

      setUser(userData.user);
      setBudgetInput(userData.user.initial_budget || 0);
      setStats(statsData);
    } catch {
      showToast('Errore di connessione', 'error');
    } finally {
      setLoading(false);
    }
  }, [navigate, showToast]);

  useEffect(() => { load(); }, [load]);

  const current = stats?.currentMonth || { in: 0, out: 0, categories: {} };
  const totalIn = current.in || 0;
  const totalOut = current.out || 0;
  const lastMonthOut = stats?.lastMonth?.out || 0;
  const balance = (user?.initial_budget || 0) + (stats?.totals?.in || 0) - (stats?.totals?.out || 0);
  const isNeg = balance < 0;
  const outDelta = lastMonthOut > 0 ? ((totalOut - lastMonthOut) / lastMonthOut * 100) : null;

  const fmt = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  async function saveBudget() {
    const value = parseFloat(budgetInput);
    if (!Number.isFinite(value) || value < 0) {
      showToast('Budget non valido', 'error');
      return;
    }
    const res = await apiFetch('/api/user/budget', {
      method: 'POST',
      body: JSON.stringify({ initial_budget: value }),
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      setEditingBudget(false);
      showToast('Budget aggiornato');
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || 'Errore', 'error');
    }
  }

  async function exportCSV() {
    if (!user) return;

    const res = await apiFetch('/api/transactions');
    if (!res.ok) {
      showToast('Errore durante l\'esportazione', 'error');
      return;
    }
    const body = await res.json();
    const all = Array.isArray(body) ? body : (body.data || []);

    const meta = `#BACKUP,${csvEscape(user.username)},${csvEscape(user.email)},${csvEscape(user.full_name)},${user.initial_budget || 0}`;
    const header = 'data,descrizione,categoria,tipo,importo,source,confidence,raw_input';
    const rows = all.map((t) => [
      t.date,
      csvEscape(t.description || ''),
      t.category,
      t.type,
      t.amount,
      t.source || 'manual',
      t.confidence || 'low',
      csvEscape(t.raw_input || ''),
    ].join(','));

    const csv = `\uFEFF${[meta, header, ...rows].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'walletai_backup.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const rows = [];

    for (const line of lines) {
      if (!line.trim() || line.startsWith('#') || line.startsWith('data,')) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 5) continue;

      const amount = parseFloat(cols[4]);
      if (!Number.isFinite(amount) || amount <= 0 || !['in', 'out'].includes(cols[3])) continue;

      rows.push({
        date: cols[0],
        description: cols[1],
        category: cols[2],
        type: cols[3],
        amount,
        source: cols[5] || 'manual',
        confidence: cols[6] || 'low',
        raw_input: cols[7] || '',
      });
    }

    if (rows.length === 0) {
      showToast('Nessuna transazione valida nel file', 'error');
      if (importRef.current) importRef.current.value = '';
      return;
    }

    const res = await apiFetch('/api/transactions/import', {
      method: 'POST',
      body: JSON.stringify(rows),
    });

    if (res.ok) {
      const { imported, skipped } = await res.json();
      showToast(
        skipped
          ? `${imported} importate, ${skipped} scartate`
          : `${imported} transazioni importate`
      );
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      showToast(body.error || 'Errore durante l\'importazione', 'error');
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
                  onChange={(e) => setBudgetInput(e.target.value)} autoFocus />
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
            <div className="stat-value">{stats?.counts?.all ?? 0}</div>
          </div>
        </div>

        <CategoryChart categories={current.categories} />
        <CategoryBudgets spending={current.categories} />
        <MonthlyChart months={stats?.months} />
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
