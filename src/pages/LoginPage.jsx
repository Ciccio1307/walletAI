import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicFetch } from '../utils/api.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab]     = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({
    full_name: '', username: '', email: '', password: '', confirm_password: '',
  });

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await publicFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Errore di accesso'); return; }
      localStorage.setItem('token', data.token);
      if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken);
      navigate('/profile');
    } catch {
      setError('Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    if (regForm.password !== regForm.confirm_password) {
      setError('Le password non coincidono');
      return;
    }
    if (regForm.password.length < 8) {
      setError('La password deve avere almeno 8 caratteri');
      return;
    }

    setLoading(true);
    try {
      const { confirm_password, ...payload } = regForm;
      const res = await publicFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Errore di registrazione'); return; }
      localStorage.setItem('token', data.token);
      if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken);
      navigate('/profile');
    } catch {
      setError('Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img src="/walletAI_logo.png" alt="WalletAI" />
          </div>
          <p className="login-subtitle">Gestisci le tue finanze con l'AI locale</p>
        </div>

        <div className="login-tabs">
          <button className={`login-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>
            Accedi
          </button>
          <button className={`login-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>
            Registrati
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username</label>
              <input className="input" type="text" required autoComplete="username"
                value={loginForm.username}
                onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="input" type="password" required autoComplete="current-password"
                value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
              {loading ? 'Accesso in corso…' : 'Accedi'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Nome completo</label>
              <input className="input" type="text" required
                value={regForm.full_name}
                onChange={e => setRegForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Username</label>
              <input className="input" type="text" required autoComplete="username"
                value={regForm.username}
                onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" required
                value={regForm.email}
                onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Password (min. 8 caratteri)</label>
              <input className="input" type="password" required autoComplete="new-password"
                value={regForm.password}
                onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Conferma password</label>
              <input className="input" type="password" required
                value={regForm.confirm_password}
                onChange={e => setRegForm(f => ({ ...f, confirm_password: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
              {loading ? 'Registrazione in corso…' : 'Crea account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
