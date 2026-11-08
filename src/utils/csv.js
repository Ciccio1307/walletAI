// CSV helpers for the backup export/import (RFC 4180 style).

// Excel/Sheets execute cells starting with these characters as formulas
// (CSV injection). Such values are prefixed with a quote on export and the
// prefix is removed again on import.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvEscape(value) {
  let s = String(value ?? '');
  if (FORMULA_START.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvUnescapeFormula(value) {
  const s = String(value ?? '');
  return s.startsWith("'") && FORMULA_START.test(s.slice(1)) ? s.slice(1) : s;
}

/**
 * Parses a whole CSV text into rows of cells. Quoted cells may contain commas,
 * escaped quotes ("") and line breaks.
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuote = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuote) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; } else { inQuote = false; }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
