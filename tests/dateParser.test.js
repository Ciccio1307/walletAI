import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseItalianDate } from '../server/utils/dateParser.js';

const TODAY = new Date(2026, 10, 3); // 3 November 2026 (Tuesday)

describe('parseItalianDate', () => {
  it('riconosce "ieri l\'altro" (bug storico: veniva letto come ieri)', () => {
    expect(parseItalianDate("pizza 10€ ieri l'altro", TODAY)).toBe('01/11/2026');
  });

  it('riconosce "l\'altro ieri"', () => {
    expect(parseItalianDate("l'altro ieri spesa", TODAY)).toBe('01/11/2026');
  });

  it('riconosce ieri', () => {
    expect(parseItalianDate('sushi 22€ ieri', TODAY)).toBe('02/11/2026');
  });

  it('riconosce oggi e stamattina', () => {
    expect(parseItalianDate('caffè oggi', TODAY)).toBe('03/11/2026');
    expect(parseItalianDate('caffè stamattina', TODAY)).toBe('03/11/2026');
  });

  it('riconosce una data completa', () => {
    expect(parseItalianDate('spesa 12/03/2025', TODAY)).toBe('12/03/2025');
  });

  it('normalizza una data completa con trattini', () => {
    expect(parseItalianDate('spesa 12-03-2025', TODAY)).toBe('12/03/2025');
  });

  it('riconosce una data ISO nel testo', () => {
    expect(parseItalianDate('spesa 2026-11-03', TODAY)).toBe('03/11/2026');
  });

  it('accetta una data parziale e usa l\'anno corrente', () => {
    expect(parseItalianDate('spesa 12/03', TODAY)).toBe('12/03/2026');
  });

  it('scarta date impossibili e torna a oggi', () => {
    expect(parseItalianDate('spesa 31/02/2025', TODAY)).toBe('03/11/2026');
  });

  it('riconosce il giorno della settimana', () => {
    expect(parseItalianDate('lunedì spesa', TODAY)).toBe('02/11/2026');
    expect(parseItalianDate('domenica spesa', TODAY)).toBe('01/11/2026');
  });

  it('usa la data del client invece del timezone del server', () => {
    const clientToday = new Date(2026, 0, 1); // 1 January 2026
    expect(parseItalianDate('ieri', clientToday)).toBe('31/12/2025');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gestisce input non validi senza crash', () => {
    expect(parseItalianDate(null, TODAY)).toBe('03/11/2026');
    expect(parseItalianDate('', TODAY)).toBe('03/11/2026');
    // An invalid base date falls back to the real clock: pin it so the test
    // does not depend on the day it runs.
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    expect(parseItalianDate('testo', new Date('invalid'))).toBe('03/11/2026');
  });

  it('non scambia un importo con il punto per una data', () => {
    expect(parseItalianDate('benzina 20.10€', TODAY)).toBe('03/11/2026');
    expect(parseItalianDate('pizza 12.5 euro', TODAY)).toBe('03/11/2026');
  });
});
