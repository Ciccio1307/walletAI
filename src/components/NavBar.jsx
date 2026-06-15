import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 12); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  }

  const isProfile      = location.pathname === '/profile';
  const isTransactions = location.pathname === '/transactions';

  return (
    <>
      {/* ── Top bar ── */}
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-inner">
          <div className="navbar-logo">
            <img src="/walletAI_logo.png" alt="WalletAI" />
          </div>

          {/* Desktop-only tabs */}
          <div className="navbar-tabs">
            <button
              className={`navbar-tab ${isProfile ? 'active' : ''}`}
              onClick={() => navigate('/profile')}
            >
              Profilo
            </button>
            <button
              className={`navbar-tab ${isTransactions ? 'active' : ''}`}
              onClick={() => navigate('/transactions')}
            >
              Transazioni
            </button>
          </div>

          <button className="navbar-logout" onClick={logout}>Esci</button>
        </div>
      </nav>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${isProfile ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <span className="bottom-nav-icon">👤</span>
          <span className="bottom-nav-label">Profilo</span>
        </button>
        <button
          className={`bottom-nav-item ${isTransactions ? 'active' : ''}`}
          onClick={() => navigate('/transactions')}
        >
          <span className="bottom-nav-icon">💳</span>
          <span className="bottom-nav-label">Transazioni</span>
        </button>
        <button className="bottom-nav-item" onClick={logout}>
          <span className="bottom-nav-icon">🚪</span>
          <span className="bottom-nav-label">Esci</span>
        </button>
      </nav>
    </>
  );
}
