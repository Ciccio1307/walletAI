import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseTransaction } from '../utils/parser.js';

const router = Router();
router.use(requireAuth);

router.post('/parse', async (req, res) => {
  const { raw_text } = req.body;
  if (!raw_text?.trim()) {
    return res.status(400).json({ error: 'Testo mancante' });
  }

  const userKeywords = db.prepare('SELECT * FROM user_keywords WHERE user_id = ?').all(req.userId);
  const result = await parseTransaction(raw_text.trim(), userKeywords);
  res.json(result);
});

router.post('/', (req, res) => {
  const { amount, type, description, category, date, raw_input, source, confidence } = req.body;
  if (!amount || !type || !date) {
    return res.status(400).json({ error: 'Campi obbligatori: amount, type, date' });
  }

  const result = db.prepare(
    `INSERT INTO transactions (user_id, amount, type, description, category, date, raw_input, source, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.userId, amount, type, description || '', category || 'altro', date, raw_input || '', source || 'manual', confidence || 'low');

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tx);
});

router.get('/', (req, res) => {
  const { type, month } = req.query;
  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [req.userId];

  if (type === 'in' || type === 'out') {
    query += ' AND type = ?';
    params.push(type);
  }

  if (month) {
    // month format: YYYY-MM, date stored as DD/MM/YYYY
    const [year, mon] = month.split('-');
    query += ' AND date LIKE ?';
    params.push(`%/${mon}/${year}`);
  }

  query += ' ORDER BY created_at DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

router.delete('/:id', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: 'Transazione non trovata' });

  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/summary', (req, res) => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const pattern = `%/${month}/${year}`;

  const rows = db.prepare(
    `SELECT category, type, SUM(amount) as total
     FROM transactions
     WHERE user_id = ? AND date LIKE ?
     GROUP BY category, type`
  ).all(req.userId, pattern);

  res.json(rows);
});

export default router;
