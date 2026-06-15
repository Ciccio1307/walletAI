import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseTransaction } from '../utils/parser.js';
import { saveBackup } from '../utils/backup.js';
import { sanitize } from '../utils/sanitize.js';

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
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount deve essere un numero maggiore di 0' });
  }
  if (type !== 'in' && type !== 'out') {
    return res.status(400).json({ error: "type deve essere 'in' o 'out'" });
  }

  const result = db.prepare(
    `INSERT INTO transactions (user_id, amount, type, description, category, date, raw_input, source, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.userId, amount, type,
    sanitize(description, 100) || '',
    sanitize(category, 50)     || 'altro',
    date,
    sanitize(raw_input, 500)   || '',
    source || 'manual',
    confidence || 'low'
  );

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  saveBackup();
  res.status(201).json(tx);
});

router.get('/', (req, res) => {
  const { type, month, search, page, limit: limitParam } = req.query;
  const limitNum = Math.min(200, parseInt(limitParam) || 0);
  const pageNum  = Math.max(1, parseInt(page) || 1);

  let where = 'WHERE user_id = ?';
  const params = [req.userId];

  if (type === 'in' || type === 'out') { where += ' AND type = ?'; params.push(type); }
  if (month) {
    const [year, mon] = month.split('-');
    where += ' AND date LIKE ?';
    params.push(`%/${mon}/${year}`);
  }
  if (search?.trim()) {
    where += ' AND (description LIKE ? OR category LIKE ?)';
    const q = `%${search.trim()}%`;
    params.push(q, q);
  }

  const base = `SELECT * FROM transactions ${where} ORDER BY created_at DESC`;

  if (limitNum > 0) {
    const total  = db.prepare(`SELECT COUNT(*) as n FROM transactions ${where}`).get(...params).n;
    const offset = (pageNum - 1) * limitNum;
    const data   = db.prepare(`${base} LIMIT ? OFFSET ?`).all(...params, limitNum, offset);
    return res.json({ data, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
  }

  res.json(db.prepare(base).all(...params));
});

router.post('/import', (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Array di transazioni richiesto' });
  }
  if (rows.length > 5000) {
    return res.status(400).json({ error: 'Massimo 5000 transazioni per importazione' });
  }

  const stmt = db.prepare(
    `INSERT INTO transactions (user_id, amount, type, description, category, date, raw_input, source, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const importMany = db.transaction((list) => {
    let count = 0;
    for (const row of list) {
      const amt = parseFloat(row.amount);
      if (!amt || !Number.isFinite(amt) || amt <= 0) continue;
      if (row.type !== 'in' && row.type !== 'out') continue;
      if (!row.date) continue;
      stmt.run(
        req.userId, amt, row.type,
        sanitize(row.description, 100) || '',
        sanitize(row.category, 50)     || 'altro',
        row.date,
        sanitize(row.raw_input, 500)   || '',
        row.source    || 'manual',
        row.confidence || 'low'
      );
      count++;
    }
    return count;
  });

  const imported = importMany(rows);
  saveBackup();
  res.json({ imported });
});

router.put('/:id', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: 'Transazione non trovata' });

  const { amount, type, description, category, date } = req.body;
  if (!amount || !type || !date) {
    return res.status(400).json({ error: 'Campi obbligatori: amount, type, date' });
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount deve essere un numero maggiore di 0' });
  }
  if (type !== 'in' && type !== 'out') {
    return res.status(400).json({ error: "type deve essere 'in' o 'out'" });
  }

  db.prepare(
    'UPDATE transactions SET amount=?, type=?, description=?, category=?, date=? WHERE id=?'
  ).run(amount, type, sanitize(description, 100) || '', sanitize(category, 50) || 'altro', date, req.params.id);

  const updated = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
  saveBackup();
  res.json(updated);
});

router.patch('/:id/recurring', (req, res) => {
  const tx = db.prepare('SELECT id, recurring FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: 'Transazione non trovata' });

  const newVal = tx.recurring ? 0 : 1;
  db.prepare('UPDATE transactions SET recurring = ? WHERE id = ?').run(newVal, req.params.id);
  res.json({ id: tx.id, recurring: newVal });
});

router.delete('/:id', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: 'Transazione non trovata' });

  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  saveBackup();
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
