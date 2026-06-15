import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar.jsx';
import WalletCard from '../components/WalletCard.jsx';
import AIInput from '../components/AIInput.jsx';
import TransactionList from '../components/TransactionList.jsx';
import MonthlySummary from '../components/MonthlySummary.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import { apiFetch } from '../utils/api.js';
import { useToast } from '../components/Toast.jsx';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

const PAGE_SIZE = 30;

export default function TransactionsPage() {
  const navigate  = useNavigate();
  const showToast = useToast();

  const [user, setUser]             = useState(null);
  const [transactions, setTx]       = useState([]);
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [visibleCount, setVisible]  = useState(PAGE_SIZE);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverResults, setServerResults] = useState(null);
  const [serverTotal, setServerTotal]     = useState(0);
  const [serverPage, setServerPage]       = useState(1);

  const searchTimer     = useRef(null);
  const pullStartY      = useRef(0);
  const pendingDeleteRef = useRef(null);
  const [pullProgress, setPullProgress] = useState(0);

  // Press / to focus the AI input
  useKeyboardShortcuts([
    { key: '/', action: () => document.querySelector('.ai-input')?.focus() },
  ]);

  const load = useCallback(async (silent = false) => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    if (!silent) setLoading(true);

    const [uRes, tRes] = await Promise.all([
      apiFetch('/api/auth/me'),
      apiFetch('/api/transactions'),
    ]);

    if (uRes.status === 401) { localStorage.removeItem('token'); navigate('/login'); return; }

    const [uData, tData] = await Promise.all([uRes.json(), tRes.json()]);
    setUser(uData.user);
    setTx(Array.isArray(tData) ? tData : []);
    setLoading(false);
    setRefreshing(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setVisible(PAGE_SIZE); }, [filter, search]);

  // Debounced server-side search with AbortController
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!search.trim()) { setServerResults(null); setServerTotal(0); setServerPage(1); return; }

    let abortController;
    searchTimer.current = setTimeout(async () => {
      abortController = new AbortController();
      try {
        const res = await apiFetch(
          `/api/transactions?search=${encodeURIComponent(search.trim())}&limit=${PAGE_SIZE}&page=1`,
          { signal: abortController.signal }
        );
        if (res.ok) {
          const body = await res.json();
          if (body.data) { setServerResults(body.data); setServerTotal(body.total); setServerPage(1); }
        }
      } catch (e) {
        if (e?.name !== 'AbortError') console.error(e);
      }
    }, 300);

    return () => { clearTimeout(searchTimer.current); abortController?.abort(); };
  }, [search]);

  // Pull-to-refresh
  useEffect(() => {
    const THRESHOLD = 70;
    function onStart(e) { if (window.scrollY > 10) return; pullStartY.current = e.touches[0].clientY; }
    function onMove(e) {
      if (!pullStartY.current || window.scrollY > 10) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta > 0) setPullProgress(Math.min(delta / THRESHOLD, 1));
    }
    function onEnd() {
      if (pullProgress >= 1) { setRefreshing(true); navigator.vibrate?.(20); load(true); }
      setPullProgress(0); pullStartY.current = 0;
    }
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove',  onMove,  { passive: true });
    window.addEventListener('touchend',   onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove',  onMove);
      window.removeEventListener('touchend',   onEnd);
    };
  }, [pullProgress, load]);

  // Optimistic UI: prepend new tx without full reload
  function handleSaved(newTx) {
    if (newTx?.id) setTx(prev => [newTx, ...prev]);
    else load(true);
  }

  // Undo-delete: hide immediately, actually delete after 4.5s
  async function deleteTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    // Flush any previously pending delete
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer);
      await apiFetch(`/api/transactions/${pendingDeleteRef.current.id}`, { method: 'DELETE' });
      pendingDeleteRef.current = null;
    }

    setTx(prev => prev.filter(t => t.id !== id));
    if (serverResults) setServerResults(prev => prev.filter(t => t.id !== id));

    const timer = setTimeout(async () => {
      await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
      pendingDeleteRef.current = null;
    }, 4500);

    pendingDeleteRef.current = { id, timer };

    showToast('Transazione eliminata', 'success', {
      label: 'Annulla',
      fn: () => {
        clearTimeout(timer);
        pendingDeleteRef.current = null;
        setTx(prev => [tx, ...prev].sort((a, b) => b.id - a.id));
      },
    });
  }

  async function editTransaction(id, data) {
    const res = await apiFetch(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (res.ok) {
      const updated = await res.json();
      setTx(prev => prev.map(t => t.id === id ? updated : t));
      if (serverResults) setServerResults(prev => prev.map(t => t.id === id ? updated : t));
    }
  }

  async function toggleRecurring(id) {
    const res = await apiFetch(`/api/transactions/${id}/recurring`, { method: 'PATCH' });
    if (res.ok) {
      const { recurring } = await res.json();
      setTx(prev => prev.map(t => t.id === id ? { ...t, recurring } : t));
    }
  }

  async function loadMoreServerResults() {
    const nextPage = serverPage + 1;
    const res = await apiFetch(
      `/api/transactions?search=${encodeURIComponent(search.trim())}&limit=${PAGE_SIZE}&page=${nextPage}`
    );
    if (res.ok) {
      const body = await res.json();
      if (body.data) { setServerResults(prev => [...prev, ...body.data]); setServerPage(nextPage); }
    }
  }

  const activeList = serverResults ?? transactions;

  const filtered = activeList.filter(t => {
    if (filter === 'in')        return t.type === 'in';
    if (filter === 'out')       return t.type === 'out';
    if (filter === 'recurring') return t.recurring;
    return true;
  });

  const visible = serverResults !== null ? filtered : filtered.slice(0, visibleCount);
  const hasMore = serverResults !== null
    ? serverResults.length < serverTotal
    : filtered.length > visibleCount;

  const countIn        = transactions.filter(t => t.type === 'in').length;
  const countOut       = transactions.filter(t => t.type === 'out').length;
  const countRecurring = transactions.filter(t => t.recurring).length;

  if (loading) {
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

        <WalletCard user={user} transactions={transactions} />
        <AIInput onTransactionSaved={handleSaved} />

        <div className="search-bar">
          <input
            className="input search-input"
            type="search"
            placeholder="Cerca… (/ per focalizzare)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'all'       ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Tutte ({transactions.length})
          </button>
          <button className={`filter-tab ${filter === 'out'       ? 'active' : ''}`} onClick={() => setFilter('out')}>
            Uscite ({countOut})
          </button>
          <button className={`filter-tab ${filter === 'in'        ? 'active' : ''}`} onClick={() => setFilter('in')}>
            Entrate ({countIn})
          </button>
          {countRecurring > 0 && (
            <button className={`filter-tab ${filter === 'recurring' ? 'active' : ''}`} onClick={() => setFilter('recurring')}>
              🔁 ({countRecurring})
            </button>
          )}
        </div>

        <TransactionList
          transactions={visible}
          onDelete={deleteTransaction}
          onEdit={editTransaction}
          onToggleRecurring={toggleRecurring}
        />

        {hasMore && (
          <button className="load-more-btn"
            onClick={serverResults ? loadMoreServerResults : () => setVisible(v => v + PAGE_SIZE)}>
            Carica altri
          </button>
        )}

        <MonthlySummary transactions={transactions} />

      </div>
    </>
  );
}
