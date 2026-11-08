import { describe, it, expect } from 'vitest';
import {
  monthPattern,
  normalizeCategory,
  normalizeConfidence,
  normalizeDate,
  normalizeISODate,
  normalizeMonth,
  normalizeSource,
} from '../server/utils/validate.js';

describe('normalizeDate', () => {
  it('accetta GG/MM/AAAA', () => {
    expect(normalizeDate('3/11/2026')).toBe('03/11/2026');
    expect(normalizeDate('03/11/2026')).toBe('03/11/2026');
  });

  it('accetta YYYY-MM-DD', () => {
    expect(normalizeDate('2026-11-03')).toBe('03/11/2026');
  });

  it('accetta anni a due cifre', () => {
    expect(normalizeDate('03/11/26')).toBe('03/11/2026');
  });

  it('rifiuta date impossibili', () => {
    expect(normalizeDate('31/02/2026')).toBeNull();
    expect(normalizeDate('00/01/2026')).toBeNull();
    expect(normalizeDate('01/13/2026')).toBeNull();
    expect(normalizeDate('banana')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });

  it('converte in ISO per input type=date', () => {
    expect(normalizeISODate('03/11/2026')).toBe('2026-11-03');
    expect(normalizeISODate('nope')).toBeNull();
  });
});

describe('normalizeMonth', () => {
  it('accetta YYYY-MM', () => {
    expect(normalizeMonth('2026-11')).toBe('2026-11');
  });

  it('rifiuta mesi non validi', () => {
    expect(normalizeMonth('2026-13')).toBeNull();
    expect(normalizeMonth('11/2026')).toBeNull();
    expect(normalizeMonth(undefined)).toBeNull();
  });
});

describe('enums', () => {
  it('normalizza categorie, source e confidence', () => {
    expect(normalizeCategory('CIBO')).toBe('cibo');
    expect(normalizeCategory('non-esiste')).toBe('altro');
    expect(normalizeSource('ai')).toBe('ai');
    expect(normalizeSource('hacker')).toBe('manual');
    expect(normalizeConfidence('high')).toBe('high');
    expect(normalizeConfidence('ultra')).toBe('low');
  });

  it('costruisce il pattern LIKE per le date legacy', () => {
    expect(monthPattern(2026, 11)).toBe('%/11/2026');
    expect(monthPattern(2026, 3)).toBe('%/03/2026');
  });
});
