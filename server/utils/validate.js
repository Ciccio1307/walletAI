// Shared validation helpers.
// Dates are stored as DD/MM/YYYY strings (legacy schema), but inputs may be
// DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY or YYYY-MM-DD.

export const EXPENSE_CATEGORIES = [
  'cibo', 'trasporti', 'salute', 'svago', 'regali',
  'casa', 'shopping', 'lavoro', 'altro',
];

export const INCOME_CATEGORY = 'entrata';
export const CATEGORIES = [...EXPENSE_CATEGORIES, INCOME_CATEGORY];

const pad = (n) => String(n).padStart(2, '0');

export function normalizeCategory(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CATEGORIES.includes(v) ? v : 'altro';
}

export function normalizeSource(value) {
  return ['ai', 'dictionary', 'manual'].includes(value) ? value : 'manual';
}

export function normalizeConfidence(value) {
  return ['high', 'medium', 'low'].includes(value) ? value : 'low';
}

export function normalizeType(value, fallback = 'out') {
  return value === 'in' || value === 'out' ? value : fallback;
}

/**
 * Accepts common date formats and returns a valid DD/MM/YYYY string,
 * or null when the value is not a real calendar date.
 */
export function normalizeDate(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();

  let y;
  let mo;
  let d;

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const eu = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (!eu) return null;
    d = Number(eu[1]);
    mo = Number(eu[2]);
    y = Number(eu[3]);
    if (eu[3].length === 2) y += y > 69 ? 1900 : 2000;
  }

  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }

  return `${pad(d)}/${pad(mo)}/${y}`;
}

/** Accepts YYYY-MM and returns it, or null if invalid. */
export function normalizeMonth(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12) return null;
  return `${m[1]}-${m[2]}`;
}

export function dateToDDMMYYYY(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function ddmmyyyyToDate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return null;
  const [d, m, y] = normalized.split('/').map(Number);
  return new Date(y, m - 1, d);
}

/** Converts a value to YYYY-MM-DD (useful for <input type="date">). */
export function normalizeISODate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return null;
  const [d, m, y] = normalized.split('/');
  return `${y}-${m}-${d}`;
}

export function isValidAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1e12;
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Builds the LIKE pattern used by the legacy DD/MM/YYYY date column. */
export function monthPattern(year, month) {
  return `%/${pad(month)}/${year}`;
}

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidUsername(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]{3,32}$/.test(value.trim());
}
