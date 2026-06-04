import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { saveBackup } from '../utils/backup.js';

const router = Router();
router.use(requireAuth);

router.post('/budget', (req, res) => {
  const { initial_budget } = req.body;
  if (initial_budget === undefined || isNaN(Number(initial_budget))) {
    return res.status(400).json({ error: 'Budget non valido' });
  }

  db.prepare('UPDATE users SET initial_budget = ? WHERE id = ?').run(Number(initial_budget), req.userId);
  const user = db.prepare('SELECT id, username, email, full_name, initial_budget, created_at FROM users WHERE id = ?').get(req.userId);
  saveBackup();
  res.json({ user });
});

router.get('/keywords', (req, res) => {
  const rows = db.prepare('SELECT * FROM user_keywords WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(rows);
});

router.post('/keywords', (req, res) => {
  const { keyword, category, type } = req.body;
  if (!keyword?.trim() || !category || !type) {
    return res.status(400).json({ error: 'keyword, category e type sono obbligatori' });
  }

  const result = db.prepare(
    'INSERT INTO user_keywords (user_id, keyword, category, type) VALUES (?, ?, ?, ?)'
  ).run(req.userId, keyword.trim().toLowerCase(), category, type);

  const kw = db.prepare('SELECT * FROM user_keywords WHERE id = ?').get(result.lastInsertRowid);
  saveBackup();
  res.status(201).json(kw);
});

router.delete('/keywords/:id', (req, res) => {
  const kw = db.prepare('SELECT id FROM user_keywords WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!kw) return res.status(404).json({ error: 'Keyword non trovata' });

  db.prepare('DELETE FROM user_keywords WHERE id = ?').run(req.params.id);
  saveBackup();
  res.json({ ok: true });
});

export default router;
