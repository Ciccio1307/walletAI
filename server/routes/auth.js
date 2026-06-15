import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function signAccessToken(userId) {
  return jwt.sign({ userId, type: 'access' }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

router.post('/register', async (req, res) => {
  const { username, email, password, full_name } = req.body;

  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La password deve essere di almeno 8 caratteri' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username o email già in uso' });
  }

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
  ).run(username, email, hash, full_name);

  const user = db.prepare('SELECT id, username, email, full_name, initial_budget, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ token: signAccessToken(user.id), refreshToken: signRefreshToken(user.id), user });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password obbligatori' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Credenziali non valide' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenziali non valide' });

  const { password_hash, ...safeUser } = user;
  res.json({ token: signAccessToken(user.id), refreshToken: signRefreshToken(user.id), user: safeUser });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken mancante' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Token non valido' });
    res.json({ token: signAccessToken(payload.userId) });
  } catch {
    res.status(401).json({ error: 'Token scaduto o non valido' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, full_name, initial_budget, created_at FROM users WHERE id = ?'
  ).get(req.userId);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json({ user });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Entrambe le password sono richieste' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nuova password deve avere almeno 8 caratteri' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: 'Password corrente non corretta' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(await bcrypt.hash(newPassword, 12), req.userId);
  res.json({ ok: true });
});

router.delete('/account', requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password richiesta per conferma' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Password non corretta' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
  res.json({ ok: true });
});

export default router;
