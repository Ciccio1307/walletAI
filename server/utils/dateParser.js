import { normalizeDate } from './validate.js';

const DAY_MAP = {
  domenica: 0,
  lunedì: 1,
  lunedi: 1,
  martedì: 2,
  martedi: 2,
  mercoledì: 3,
  mercoledi: 3,
  giovedì: 4,
  giovedi: 4,
  venerdì: 5,
  venerdi: 5,
  sabato: 6,
};

const pad = (n) => String(n).padStart(2, '0');

function fmt(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Parses Italian natural dates into DD/MM/YYYY.
 * `today` can be provided by the client so the server timezone (usually UTC)
 * does not shift "today"/"yesterday" for the user.
 */
export function parseItalianDate(text, today = new Date()) {
  const base = today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();
  const input = typeof text === 'string' ? text : '';
  const lower = input.toLowerCase();

  // Explicit ISO date always wins.
  const isoMatch = input.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) {
    const normalized = normalizeDate(isoMatch[0]);
    if (normalized) return normalized;
  }

  // Explicit full date always wins.
  const fullMatch = input.match(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/);
  if (fullMatch) {
    const normalized = normalizeDate(fullMatch[0]);
    if (normalized) return normalized;
  }

  // Important: "l'altro ieri" must be checked before "ieri".
  if (/l['’]altro\s+ieri|ieri\s+l['’]altro|altroieri/.test(lower)) {
    const d = new Date(base);
    d.setDate(d.getDate() - 2);
    return fmt(d);
  }

  if (/\bieri\b/.test(lower)) {
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    return fmt(d);
  }

  if (/\boggi\b|stamani|stamattina/.test(lower)) {
    return fmt(base);
  }

  // Explicit partial date (DD/MM) wins over weekday names.
  // Dots are excluded: "benzina 20.10€" is a price, not 20 October.
  const partialMatch = input.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (partialMatch) {
    const normalized = normalizeDate(
      `${partialMatch[1]}/${partialMatch[2]}/${base.getFullYear()}`
    );
    if (normalized) return normalized;
  }

  for (const [name, weekday] of Object.entries(DAY_MAP)) {
    if (lower.includes(name)) {
      const d = new Date(base);
      const diff = (d.getDay() - weekday + 7) % 7;
      d.setDate(d.getDate() - (diff === 0 ? 7 : diff));
      return fmt(d);
    }
  }

  return fmt(base);
}
