import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
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
  const token = signToken(user.id);

  res.status(201).json({ token, user });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password obbligatori' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const { password_hash, ...safeUser } = user;
  const token = signToken(user.id);
  res.json({ token, user: safeUser });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, full_name, initial_budget, created_at FROM users WHERE id = ?'
  ).get(req.userId);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json({ user });
});

export default router;
