import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { saveBackup } from '../utils/backup.js';
import { sanitize } from '../utils/sanitize.js';
import { CATEGORIES, EXPENSE_CATEGORIES } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

router.post('/budget', (req, res) => {
  const value = typeof req.body.initial_budget === 'number'
    ? req.body.initial_budget
    : Number(req.body.initial_budget);

  if (!Number.isFinite(value) || value < 0 || value > 1e12) {
    return res.status(400).json({ error: 'Budget non valido' });
  }

  db.prepare('UPDATE users SET initial_budget = ? WHERE id = ?').run(value, req.userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  const { password_hash, token_version, ...safeUser } = user;
  saveBackup();
  res.json({ user: safeUser });
});

router.get('/keywords', (req, res) => {
  const rows = db.prepare('SELECT * FROM user_keywords WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(rows);
});

router.post('/keywords', (req, res) => {
  const cleanKeyword = sanitize(String(req.body.keyword || '').trim(), 100).toLowerCase();
  const category = String(req.body.category || '').trim().toLowerCase();
  const type = req.body.type;

  if (!cleanKeyword || !category || !type) {
    return res.status(400).json({ error: 'keyword, category e type sono obbligatori' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Categoria non valida' });
  }
  if (type !== 'in' && type !== 'out') {
    return res.status(400).json({ error: "type deve essere 'in' o 'out'" });
  }

  const duplicate = db.prepare(
    'SELECT id FROM user_keywords WHERE user_id = ? AND keyword = ? COLLATE NOCASE'
  ).get(req.userId, cleanKeyword);
  if (duplicate) {
    return res.status(409).json({ error: 'Questa parola chiave esiste già' });
  }

  const result = db.prepare(
    'INSERT INTO user_keywords (user_id, keyword, category, type) VALUES (?, ?, ?, ?)'
  ).run(req.userId, cleanKeyword, category, type);

  const kw = db.prepare('SELECT * FROM user_keywords WHERE id = ?').get(result.lastInsertRowid);
  saveBackup();
  res.status(201).json(kw);
});

router.delete('/keywords/:id', (req, res) => {
  const kw = db.prepare('SELECT id FROM user_keywords WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!kw) return res.status(404).json({ error: 'Keyword non trovata' });

  db.prepare('DELETE FROM user_keywords WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  saveBackup();
  res.json({ ok: true });
});

router.get('/category-budgets', (req, res) => {
  const rows = db.prepare('SELECT * FROM category_budgets WHERE user_id = ?').all(req.userId);
  res.json(rows);
});

router.put('/category-budgets/:category', (req, res) => {
  const category = sanitize(String(req.params.category || '').trim().toLowerCase(), 50);
  const budget = Number(req.body.budget_amount);

  if (!EXPENSE_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Categoria non valida' });
  }
  if (!Number.isFinite(budget) || budget < 0 || budget > 1e12) {
    return res.status(400).json({ error: 'budget_amount non valido' });
  }

  if (budget === 0) {
    db.prepare('DELETE FROM category_budgets WHERE user_id = ? AND category = ?').run(req.userId, category);
    saveBackup();
    return res.json({ deleted: true });
  }

  db.prepare(
    `INSERT INTO category_budgets (user_id, category, budget_amount) VALUES (?, ?, ?)
     ON CONFLICT(user_id, category) DO UPDATE SET budget_amount = excluded.budget_amount`
  ).run(req.userId, category, budget);

  saveBackup();
  res.json({ category, budget_amount: budget });
});

export default router;
