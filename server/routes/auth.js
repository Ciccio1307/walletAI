import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { saveBackup } from '../utils/backup.js';
import { sanitize } from '../utils/sanitize.js';
import { isValidEmail, isValidUsername } from '../utils/validate.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi, riprova tra un minuto' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi, riprova tra un minuto' },
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste, riprova tra un minuto' },
});

function signAccessToken(userId, version) {
  return jwt.sign({ userId, type: 'access', ver: version }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function signRefreshToken(userId, version) {
  return jwt.sign({ userId, type: 'refresh', ver: version }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(user) {
  const { password_hash, token_version, ...safe } = user;
  return safe;
}

function tokensFor(user) {
  const version = Number(user.token_version ?? 0);
  return {
    token: signAccessToken(user.id, version),
    refreshToken: signRefreshToken(user.id, version),
  };
}

router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
  const username = sanitize(String(req.body.username || '').trim(), 32);
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const fullName = sanitize(String(req.body.full_name || '').trim(), 100);

  if (!username || !email || !password || !fullName) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Username: 3-32 caratteri (lettere, numeri, . _ -)' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email non valida' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La password deve essere di almeno 8 caratteri' });
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'La password non può superare 72 byte' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE')
    .get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username o email già in uso' });
  }

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
  ).run(username, email, hash, fullName);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  saveBackup();
  res.status(201).json({ ...tokensFor(user), user: publicUser(user) });
}));

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const username = sanitize(String(req.body.username || '').trim(), 32);
  const password = String(req.body.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password obbligatori' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (!user) return res.status(401).json({ error: 'Credenziali non valide' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenziali non valide' });

  res.json({ ...tokensFor(user), user: publicUser(user) });
}));

router.post('/refresh', refreshLimiter, (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken mancante' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Token non valido' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Token non valido' });

    if (Number(payload.ver ?? 0) !== Number(user.token_version ?? 0)) {
      return res.status(401).json({ error: 'Sessione scaduta' });
    }

    res.json({ token: signAccessToken(user.id, user.token_version), refreshToken: signRefreshToken(user.id, user.token_version) });
  } catch {
    res.status(401).json({ error: 'Token scaduto o non valido' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json({ user: publicUser(user) });
});

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Entrambe le password sono richieste' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'La nuova password deve avere almeno 8 caratteri' });
  }
  if (Buffer.byteLength(String(newPassword), 'utf8') > 72) {
    return res.status(400).json({ error: 'La password non può superare 72 byte' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(401).json({ error: 'Utente non trovato' });
  if (!(await bcrypt.compare(String(currentPassword), user.password_hash))) {
    return res.status(403).json({ error: 'Password corrente non corretta' });
  }

  const hash = await bcrypt.hash(String(newPassword), 12);
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?')
    .run(hash, req.userId);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  saveBackup();
  res.json({ ok: true, ...tokensFor(updated) });
}));

router.post('/logout', requireAuth, (req, res) => {
  // Revokes every token issued for this account (all devices).
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.userId);
  saveBackup();
  res.json({ ok: true });
});

router.delete('/account', requireAuth, asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password richiesta per conferma' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(401).json({ error: 'Utente non trovato' });
  if (!(await bcrypt.compare(String(password), user.password_hash))) {
    return res.status(403).json({ error: 'Password non corretta' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
  saveBackup();
  res.json({ ok: true });
}));

export default router;
