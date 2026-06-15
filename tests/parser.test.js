import { describe, it, expect } from 'vitest';
import { extractAmount, buildDescription, tryDictionary } from '../server/utils/parser.js';

describe('extractAmount', () => {
  it('riconosce importo con simbolo €', () => {
    expect(extractAmount('sushi 22€ ieri')).toBe(22);
  });
  it('riconosce decimale con virgola', () => {
    expect(extractAmount('caffè 1,50€')).toBe(1.5);
  });
  it('riconosce € prima del numero', () => {
    expect(extractAmount('€ 45.00 benzina')).toBe(45);
  });
  it('ritorna null se non c\'è nessun numero', () => {
    expect(extractAmount('nessun numero qui')).toBeNull();
  });
  it('riconosce numero senza simbolo', () => {
    expect(extractAmount('spesa 30 euro')).toBe(30);
  });
});

describe('tryDictionary', () => {
  it('riconosce keyword cibo', () => {
    const r = tryDictionary('sushi 22€');
    expect(r).not.toBeNull();
    expect(r.category).toBe('cibo');
    expect(r.type).toBe('out');
    expect(r.amount).toBe(22);
    expect(r.source).toBe('dictionary');
  });
  it('riconosce keyword entrate (salario)', () => {
    const r = tryDictionary('salario 1200€');
    expect(r).not.toBeNull();
    expect(r.category).toBe('entrata');
    expect(r.type).toBe('in');
    expect(r.amount).toBe(1200);
  });
  it('riconosce keyword trasporti (benzina)', () => {
    const r = tryDictionary('benzina 45€');
    expect(r).not.toBeNull();
    expect(r.category).toBe('trasporti');
  });
  it('ritorna null per testo sconosciuto', () => {
    expect(tryDictionary('xyzabc foo 50€')).toBeNull();
  });
  it('ritorna null se manca l\'importo', () => {
    expect(tryDictionary('sushi senza prezzo')).toBeNull();
  });
  it('prioritizza le keyword utente', () => {
    const userKws = [{ keyword: 'pilates', category: 'salute', type: 'out' }];
    const r = tryDictionary('pilates 30€', userKws);
    expect(r?.category).toBe('salute');
    expect(r?.source).toBe('dictionary');
  });
});

describe('buildDescription', () => {
  it('rimuove stopword e importi', () => {
    const d = buildDescription('ho speso 22€ per sushi ieri');
    expect(d.toLowerCase()).toContain('sushi');
    expect(d).not.toContain('22');
    expect(d).not.toMatch(/\bho\b/);
  });
  it('non ritorna una stringa vuota per input con solo importo', () => {
    expect(buildDescription('22€')).toBeTruthy();
  });
  it('tronca a 35 caratteri', () => {
    const long = 'questa è una descrizione davvero molto molto molto lunga 100€';
    expect(buildDescription(long).length).toBeLessThanOrEqual(35);
  });
});
