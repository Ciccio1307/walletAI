import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { saveBackup } from '../utils/backup.js';
import { sanitize } from '../utils/sanitize.js';
import { normalizeISODate } from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

function toMoney(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function validMoney(value, { allowZero = false } = {}) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && (allowZero ? value >= 0 : value > 0)
    && value <= 1e12;
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC').all(req.userId));
});

router.post('/', (req, res) => {
  const name = sanitize(String(req.body.name || '').trim(), 100);
  const targetAmount = toMoney(req.body.target_amount);
  const currentAmount = req.body.current_amount === undefined || req.body.current_amount === ''
    ? 0
    : toMoney(req.body.current_amount);
  const rawDeadline = req.body.deadline;

  if (!name) {
    return res.status(400).json({ error: 'Il nome è obbligatorio' });
  }
  if (!validMoney(targetAmount)) {
    return res.status(400).json({ error: 'target_amount deve essere un numero maggiore di 0' });
  }
  if (!validMoney(currentAmount, { allowZero: true })) {
    return res.status(400).json({ error: 'current_amount non valido' });
  }

  let deadline = null;
  if (rawDeadline) {
    deadline = normalizeISODate(rawDeadline);
    if (!deadline) {
      return res.status(400).json({ error: 'deadline non valida' });
    }
  }

  const result = db.prepare(
    'INSERT INTO goals (user_id, name, target_amount, current_amount, deadline) VALUES (?,?,?,?,?)'
  ).run(req.userId, name, targetAmount, currentAmount, deadline);

  saveBackup();
  res.status(201).json(db.prepare('SELECT * FROM goals WHERE id=?').get(result.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const goal = db.prepare('SELECT id FROM goals WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!goal) return res.status(404).json({ error: 'Obiettivo non trovato' });

  const currentAmount = toMoney(req.body.current_amount);
  if (!validMoney(currentAmount, { allowZero: true })) {
    return res.status(400).json({ error: 'current_amount non valido' });
  }

  db.prepare('UPDATE goals SET current_amount=? WHERE id=? AND user_id=?')
    .run(currentAmount, req.params.id, req.userId);

  saveBackup();
  res.json(db.prepare('SELECT * FROM goals WHERE id=? AND user_id=?').get(req.params.id, req.userId));
});

router.delete('/:id', (req, res) => {
  const goal = db.prepare('SELECT id FROM goals WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  if (!goal) return res.status(404).json({ error: 'Obiettivo non trovato' });

  db.prepare('DELETE FROM goals WHERE id=? AND user_id=?').run(req.params.id, req.userId);
  saveBackup();
  res.json({ ok: true });
});

export default router;
