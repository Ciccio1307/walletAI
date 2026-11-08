import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseTransaction } from '../utils/parser.js';
import { saveBackup } from '../utils/backup.js';
import { sanitize } from '../utils/sanitize.js';
import {
  ddmmyyyyToDate,
  isValidAmount,
  monthPattern,
  normalizeCategory,
  normalizeConfidence,
  normalizeDate,
  normalizeMonth,
  normalizeSource,
} from '../utils/validate.js';

const router = Router();
router.use(requireAuth);

const parseLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => String(req.userId),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe analisi, riprova tra un minuto' },
});

const pad = (n) => String(n).padStart(2, '0');

function parseAmount(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function validateTransactionInput(input) {
  // Import rows can be anything (null, strings…): treat them as empty objects.
  const body = input && typeof input === 'object' ? input : {};
  const amount = parseAmount(body.amount);
  if (!isValidAmount(amount)) {
    return { error: 'amount deve essere un numero maggiore di 0' };
  }

  const type = body.type;
  if (type !== 'in' && type !== 'out') {
    return { error: "type deve essere 'in' o 'out'" };
  }

  const date = normalizeDate(body.date);
  if (!date) {
    return { error: 'date non valida (formato richiesto: GG/MM/AAAA)' };
  }

  return {
    value: {
      amount,
      type,
      date,
      description: sanitize(String(body.description ?? ''), 100) || '',
      category: normalizeCategory(body.category),
      raw_input: sanitize(String(body.raw_input ?? ''), 500) || '',
      source: normalizeSource(body.source),
      confidence: normalizeConfidence(body.confidence),
    },
  };
}

function buildWhere(req) {
  let where = 'WHERE user_id = ?';
  const params = [req.userId];

  const { type, recurring, search } = req.query;

  if (type === 'in' || type === 'out') {
    where += ' AND type = ?';
    params.push(type);
  }

  if (recurring === '1' || recurring === 'true') {
    where += ' AND recurring = 1';
  }

  if (req.query.month) {
    const month = normalizeMonth(req.query.month);
    if (!month) return { error: 'month non valido (formato: YYYY-MM)' };
    const [year, monthNumber] = month.split('-').map(Number);
    where += ' AND date LIKE ?';
    params.push(monthPattern(year, monthNumber));
  }

  const query = typeof search === 'string' ? search.trim() : '';
  if (query) {
    const escaped = query.replace(/[\\%_]/g, '\\$&');
    where += " AND (description LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')";
    params.push(`%${escaped}%`, `%${escaped}%`);
  }

  return { where, params };
}

router.post('/parse', parseLimiter, asyncHandler(async (req, res) => {
  const rawText = typeof req.body.raw_text === 'string' ? req.body.raw_text.trim() : '';
  if (!rawText) {
    return res.status(400).json({ error: 'Testo mancante' });
  }
  if (rawText.length > 500) {
    return res.status(400).json({ error: 'Testo troppo lungo (massimo 500 caratteri)' });
  }

  // The client can send its own date, so "oggi" and "ieri" are correct even
  // when the server runs in a different timezone (e.g. Render = UTC).
  const today = ddmmyyyyToDate(req.body.today) || new Date();

  const userKeywords = db.prepare('SELECT * FROM user_keywords WHERE user_id = ?').all(req.userId);
  const result = await parseTransaction(rawText, userKeywords, today);
  res.json(result);
}));

router.post('/', (req, res) => {
  const parsed = validateTransactionInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const { amount, type, description, category, date, raw_input, source, confidence } = parsed.value;

  const result = db.prepare(
    `INSERT INTO transactions (user_id, amount, type, description, category, date, raw_input, source, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.userId, amount, type, description, category, date, raw_input, source, confidence);

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  saveBackup();
  res.status(201).json(tx);
});

router.get('/', (req, res) => {
  const built = buildWhere(req);
  if (built.error) return res.status(400).json({ error: built.error });

  const { where, params } = built;
  const base = `SELECT * FROM transactions ${where} ORDER BY created_at DESC, id DESC`;

  let limitNum = 0;
  if (req.query.limit !== undefined) {
    const parsed = Number.parseInt(req.query.limit, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'limit non valido' });
    }
    limitNum = Math.min(parsed, 200);
  }

  if (limitNum > 0) {
    const pageNum = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const total = db.prepare(`SELECT COUNT(*) as n FROM transactions ${where}`).get(...params).n;
    const offset = (pageNum - 1) * limitNum;
    const data = db.prepare(`${base} LIMIT ? OFFSET ?`).all(...params, limitNum, offset);
    return res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    });
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
    let imported = 0;
    let skipped = 0;

    for (const row of list) {
      const parsed = validateTransactionInput(row);
      if (parsed.error) {
        skipped++;
        continue;
      }
      const { amount, type, description, category, date, raw_input, source, confidence } = parsed.value;
      stmt.run(req.userId, amount, type, description, category, date, raw_input, source, confidence);
      imported++;
    }

    return { imported, skipped };
  });

  const result = importMany(rows);
  saveBackup();
  res.json(result);
});

router.put('/:id', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: 'Transazione non trovata' });

  const parsed = validateTransactionInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const { amount, type, description, category, date } = parsed.value;

  db.prepare(
    'UPDATE transactions SET amount=?, type=?, description=?, category=?, date=? WHERE id=? AND user_id=?'
  ).run(amount, type, description, category, date, req.params.id, req.userId);

  const updated = db.prepare('SELECT * FROM transactions WHERE id=? AND user_id=?').get(req.params.id, req.userId);
  saveBackup();
  res.json(updated);
});

router.patch('/:id/recurring', (req, res) => {
  const tx = db.prepare('SELECT id, recurring FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: 'Transazione non trovata' });

  const newVal = tx.recurring ? 0 : 1;
  db.prepare('UPDATE transactions SET recurring = ? WHERE id = ? AND user_id = ?')
    .run(newVal, req.params.id, req.userId);
  saveBackup();
  res.json({ id: tx.id, recurring: newVal });
});

router.delete('/:id', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: 'Transazione non trovata' });

  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  saveBackup();
  res.json({ ok: true });
});

function totalsFor(userId, year, monthNumber) {
  const pattern = monthPattern(year, monthNumber);

  const totals = db.prepare(
    `SELECT type, SUM(amount) AS total
     FROM transactions
     WHERE user_id = ? AND date LIKE ?
     GROUP BY type`
  ).all(userId, pattern);

  const categories = db.prepare(
    `SELECT category, SUM(amount) AS total
     FROM transactions
     WHERE user_id = ? AND date LIKE ? AND type = 'out'
     GROUP BY category`
  ).all(userId, pattern);

  const result = { in: 0, out: 0, categories: {} };
  for (const row of totals) result[row.type] = Number(row.total) || 0;
  for (const row of categories) {
    const category = normalizeCategory(row.category);
    result.categories[category] = (result.categories[category] || 0) + (Number(row.total) || 0);
  }
  return result;
}

router.get('/summary', (req, res) => {
  let monthKeyValue;

  if (req.query.month) {
    monthKeyValue = normalizeMonth(req.query.month);
    if (!monthKeyValue) {
      return res.status(400).json({ error: 'month non valido (formato: YYYY-MM)' });
    }
  } else {
    const today = ddmmyyyyToDate(req.query.today) || new Date();
    monthKeyValue = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  }

  const [year, monthNumber] = monthKeyValue.split('-').map(Number);
  const totals = totalsFor(req.userId, year, monthNumber);

  res.json({
    month: monthKeyValue,
    year,
    monthNumber,
    in: totals.in,
    out: totals.out,
    net: totals.in - totals.out,
    categories: totals.categories,
  });
});

router.get('/stats', (req, res) => {
  const today = ddmmyyyyToDate(req.query.today) || new Date();
  const year = today.getFullYear();
  const monthNumber = today.getMonth() + 1;

  const current = totalsFor(req.userId, year, monthNumber);
  const lastDate = new Date(year, monthNumber - 2, 1);
  const last = totalsFor(req.userId, lastDate.getFullYear(), lastDate.getMonth() + 1);

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, monthNumber - 1 - (5 - index), 1);
    const totals = totalsFor(req.userId, date.getFullYear(), date.getMonth() + 1);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      in: totals.in,
      out: totals.out,
    };
  });

  const typeCounts = db.prepare(
    'SELECT type, COUNT(*) AS n FROM transactions WHERE user_id = ? GROUP BY type'
  ).all(req.userId);

  const typeTotals = db.prepare(
    'SELECT type, SUM(amount) AS total FROM transactions WHERE user_id = ? GROUP BY type'
  ).all(req.userId);

  const counts = { all: 0, in: 0, out: 0 };
  for (const row of typeCounts) counts[row.type] = Number(row.n) || 0;
  counts.all = counts.in + counts.out;
  counts.recurring = db.prepare(
    'SELECT COUNT(*) AS n FROM transactions WHERE user_id = ? AND recurring = 1'
  ).get(req.userId).n;

  const totals = { in: 0, out: 0 };
  for (const row of typeTotals) totals[row.type] = Number(row.total) || 0;

  res.json({
    counts,
    totals,
    currentMonth: {
      year,
      month: monthNumber,
      in: current.in,
      out: current.out,
      categories: current.categories,
    },
    lastMonth: {
      year: lastDate.getFullYear(),
      month: lastDate.getMonth() + 1,
      in: last.in,
      out: last.out,
    },
    months,
  });
});

export default router;
