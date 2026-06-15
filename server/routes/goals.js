import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sanitize } from '../utils/sanitize.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC').all(req.userId));
});

router.post('/', (req, res) => {
  const { name, target_amount, current_amount = 0, deadline } = req.body;
  if (!name?.trim() || typeof target_amount !== 'number' || target_amount <= 0) {
    return res.status(400).json({ error: 'name e target_amount (> 0) richiesti' });
  }
  const r = db.prepare(
    'INSERT INTO goals (user_id, name, target_amount, current_amount, deadline) VALUES (?,?,?,?,?)'
  ).run(req.userId, sanitize(name.trim(), 100), target_amount, current_amount || 0, deadline || null);
  res.status(201).json(db.prepare('SELECT * FROM goals WHERE id=?').get(r.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const g = db.prepare('SELECT id FROM goals WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!g) return res.status(404).json({ error: 'Obiettivo non trovato' });
  const { current_amount } = req.body;
  if (typeof current_amount !== 'number' || current_amount < 0) {
    return res.status(400).json({ error: 'current_amount non valido' });
  }
  db.prepare('UPDATE goals SET current_amount=? WHERE id=?').run(current_amount, req.params.id);
  res.json(db.prepare('SELECT * FROM goals WHERE id=?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const g = db.prepare('SELECT id FROM goals WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!g) return res.status(404).json({ error: 'Obiettivo non trovato' });
  db.prepare('DELETE FROM goals WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
