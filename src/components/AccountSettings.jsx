import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';
import { useToast } from './Toast.jsx';

export default function AccountSettings() {
  const navigate  = useNavigate();
  const showToast = useToast();
  const [section, setSection] = useState(null); // null | 'password' | 'delete'
  const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' });
  const [delPw, setDelPw]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  function toggle(s) { setSection(prev => prev === s ? null : s); setError(''); }

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setError('Le password non coincidono'); return; }
    if (pwForm.next.length < 8) { setError('Minimo 8 caratteri'); return; }
    setSaving(true);
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    });
    setSaving(false);
    if (res.ok) {
      showToast('Password aggiornata');
      setSection(null);
      setPwForm({ current: '', next: '', confirm: '' });
    } else {
      const d = await res.json();
      setError(d.error || 'Errore');
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setSaving(true);
    const res = await apiFetch('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password: delPw }),
    });
    setSaving(false);
    if (res.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
    } else {
      const d = await res.json();
      setError(d.error || 'Errore');
    }
  }

  return (
    <div className="account-settings card">
      <h3 className="section-title">Impostazioni account</h3>
      <div className="account-actions">
        <button
          className={`account-action-btn${section === 'password' ? ' active' : ''}`}
          onClick={() => toggle('password')}
        >
          🔑 Cambia password
        </button>
        <button
          className={`account-action-btn danger${section === 'delete' ? ' active' : ''}`}
          onClick={() => toggle('delete')}
        >
          🗑 Elimina account
        </button>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: '12px' }}>{error}</div>}

      {section === 'password' && (
        <form className="account-form fade-in" onSubmit={changePassword}>
          <div className="form-group">
            <label>Password attuale</label>
            <input className="input" type="password" required
              value={pwForm.current}
              onChange={e => { setError(''); setPwForm(f => ({ ...f, current: e.target.value })); }} />
          </div>
          <div className="form-group">
            <label>Nuova password (min. 8 caratteri)</label>
            <input className="input" type="password" required minLength={8}
              value={pwForm.next}
              onChange={e => { setError(''); setPwForm(f => ({ ...f, next: e.target.value })); }} />
          </div>
          <div className="form-group">
            <label>Conferma nuova password</label>
            <input className="input" type="password" required
              value={pwForm.confirm}
              onChange={e => { setError(''); setPwForm(f => ({ ...f, confirm: e.target.value })); }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : 'Salva'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setSection(null)}>Annulla</button>
          </div>
        </form>
      )}

      {section === 'delete' && (
        <form className="account-form fade-in" onSubmit={deleteAccount}>
          <div className="account-delete-warning">
            ⚠️ Questa azione è irreversibile. Tutti i tuoi dati (transazioni, obiettivi, keyword) verranno eliminati permanentemente.
          </div>
          <div className="form-group">
            <label>Conferma con la tua password</label>
            <input className="input" type="password" required
              value={delPw}
              onChange={e => { setError(''); setDelPw(e.target.value); }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-danger" disabled={saving}>{saving ? '…' : 'Elimina definitivamente'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setSection(null)}>Annulla</button>
          </div>
        </form>
      )}
    </div>
  );
}
