import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar.jsx';
import WalletCard from '../components/WalletCard.jsx';
import AIInput from '../components/AIInput.jsx';
import TransactionList from '../components/TransactionList.jsx';
import MonthlySummary from '../components/MonthlySummary.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import { apiFetch, getToken } from '../utils/api.js';
import { applyStatsDelta } from '../utils/stats.js';
import { useToast } from '../components/Toast.jsx';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

const PAGE_SIZE = 30;

function todayParam() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const showToast = useToast();

  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);

  const pullStartY = useRef(0);
  const pullProgressRef = useRef(0);
  const pendingDeleteRef = useRef(null);
  const requestRef = useRef(0);

  useKeyboardShortcuts([
    { key: '/', action: () => document.querySelector('.ai-input')?.focus() },
  ]);

  const loadUser = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      // Offline: keep whatever is cached/rendered.
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/transactions/stats?today=${encodeURIComponent(todayParam())}`
      );
      if (res.ok) setStats(await res.json());
    } catch {
      // Offline: keep previous stats.
    }
  }, []);

  const buildQuery = useCallback((pageNumber) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(pageNumber),
      today: todayParam(),
    });
    if (filter === 'in' || filter === 'out') params.set('type', filter);
    if (filter === 'recurring') params.set('recurring', '1');
    if (debouncedSearch) params.set('search', debouncedSearch);
    return params.toString();
  }, [filter, debouncedSearch]);

  const loadPage = useCallback(async (pageNumber, { append = false, silent = false } = {}) => {
    const requestId = ++requestRef.current;
    if (append) setLoadingMore(true);
    else if (!silent) setLoading(true);

    try {
      const res = await apiFetch(`/api/transactions?${buildQuery(pageNumber)}`);
      if (requestId !== requestRef.current) return;

      if (!res.ok) {
        showToast('Errore nel caricamento delle transazioni', 'error');
        return;
      }

      const body = await res.json();
      const data = Array.isArray(body) ? body : (body.data || []);
      const count = Array.isArray(body) ? data.length : (body.total || 0);

      setItems((prev) => (append ? [...prev, ...data] : data));
      setTotal(count);
      setPage(pageNumber);
    } catch {
      showToast('Errore di connessione', 'error');
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [buildQuery, showToast]);

  const refresh = useCallback(async (silent = true) => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadPage(1, { silent })]);
  }, [loadStats, loadPage]);

  // Initial load.
  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    loadUser();
    loadStats();
  }, [loadUser, loadStats, navigate]);

  // Reload page 1 whenever filter or debounced search changes.
  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // Debounce search.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Pull-to-refresh (mobile).
  useEffect(() => {
    const THRESHOLD = 70;

    function onStart(e) {
      if (window.scrollY > 10) return;
      pullStartY.current = e.touches[0].clientY;
    }

    function onMove(e) {
      if (!pullStartY.current || window.scrollY > 10) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta > 0) {
        const progress = Math.min(delta / THRESHOLD, 1);
        pullProgressRef.current = progress;
        setPullProgress(progress);
      }
    }

    function onEnd() {
      if (pullProgressRef.current >= 1) {
        navigator.vibrate?.(20);
        refresh(true);
      }
      pullProgressRef.current = 0;
      setPullProgress(0);
      pullStartY.current = 0;
    }

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [refresh]);

  // A new transaction: reload the first page so filters/search stay correct.
  function handleSaved() {
    loadStats();
    loadPage(1, { silent: true });
  }

  // Undo-delete: hide immediately, actually delete after 4.5s.
  async function deleteTransaction(id) {
    const tx = items.find((item) => item.id === id);
    if (!tx) return;

    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer);
      try {
        await apiFetch(`/api/transactions/${pendingDeleteRef.current.id}`, { method: 'DELETE' });
      } catch {
        // Ignore: the transaction will be retried on the next refresh.
      }
      pendingDeleteRef.current = null;
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
    setTotal((value) => Math.max(0, value - 1));
    setStats((prev) => applyStatsDelta(prev, tx, -1));

    const timer = setTimeout(async () => {
      try {
        await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      } catch {
        // Offline: the optimistic removal stays until the next reload.
      } finally {
        pendingDeleteRef.current = null;
        loadStats();
      }
    }, 4500);

    pendingDeleteRef.current = { id, timer };

    showToast('Transazione eliminata', 'success', {
      label: 'Annulla',
      fn: () => {
        clearTimeout(timer);
        pendingDeleteRef.current = null;
        setItems((prev) => [tx, ...prev].sort((a, b) => b.id - a.id));
        setTotal((value) => value + 1);
        setStats((prev) => applyStatsDelta(prev, tx, 1));
      },
    });
  }

  async function editTransaction(id, data) {
    const res = await apiFetch(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      loadStats();
      return true;
    }

    const body = await res.json().catch(() => ({}));
    showToast(body.error || 'Errore durante la modifica', 'error');
    return false;
  }

  async function toggleRecurring(id) {
    const res = await apiFetch(`/api/transactions/${id}/recurring`, { method: 'PATCH' });
    if (res.ok) {
      const { recurring } = await res.json();
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, recurring } : item)));
      loadStats();
    }
  }

  function loadMore() {
    if (loadingMore) return;
    loadPage(page + 1, { append: true });
  }

  const counts = stats?.counts || { all: 0, in: 0, out: 0, recurring: 0 };
  const hasMore = items.length < total;

  if (loading && !stats) {
    return (
      <>
        <NavBar />
        <div className="page-content">
          <SkeletonCard tall />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <div className="page-content">

        {(pullProgress > 0 || refreshing) && (
          <div className="pull-indicator" style={{ opacity: refreshing ? 1 : pullProgress }}>
            <div className="spinner" />
            <span>{refreshing ? 'Aggiornamento…' : pullProgress >= 1 ? 'Rilascia per aggiornare' : 'Tira per aggiornare'}</span>
          </div>
        )}

        <WalletCard user={user} stats={stats} />
        <AIInput onTransactionSaved={handleSaved} />

        <div className="search-bar">
          <input
            className="input search-input"
            type="search"
            placeholder="Cerca… (/ per focalizzare)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Tutte ({counts.all})
          </button>
          <button className={`filter-tab ${filter === 'out' ? 'active' : ''}`} onClick={() => setFilter('out')}>
            Uscite ({counts.out})
          </button>
          <button className={`filter-tab ${filter === 'in' ? 'active' : ''}`} onClick={() => setFilter('in')}>
            Entrate ({counts.in})
          </button>
          {counts.recurring > 0 && (
            <button className={`filter-tab ${filter === 'recurring' ? 'active' : ''}`} onClick={() => setFilter('recurring')}>
              🔁 ({counts.recurring})
            </button>
          )}
        </div>

        <TransactionList
          transactions={items}
          onDelete={deleteTransaction}
          onEdit={editTransaction}
          onToggleRecurring={toggleRecurring}
        />

        {hasMore && (
          <button className="load-more-btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Caricamento…' : 'Carica altri'}
          </button>
        )}

        <MonthlySummary initialSummary={stats?.currentMonth} />

      </div>
    </>
  );
}
