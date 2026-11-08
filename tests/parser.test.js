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
  it('riconosce le migliaia con il punto', () => {
    expect(extractAmount('stipendio 1.200€')).toBe(1200);
    expect(extractAmount('1.234,56€')).toBe(1234.56);
    expect(extractAmount('ho speso 1.234,56 euro')).toBe(1234.56);
  });
  it('non interpreta una data come importo', () => {
    expect(extractAmount('spesa 12/03')).toBeNull();
  });
  it('preferisce il numero con simbolo €', () => {
    expect(extractAmount('iPhone 15 899€')).toBe(899);
    expect(extractAmount('2 biglietti 20€')).toBe(20);
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
  it('usa la data del client per "ieri l\'altro"', () => {
    const today = new Date(2026, 10, 3);
    const r = tryDictionary("pizza 10€ ieri l'altro", [], today);
    expect(r?.date).toBe('01/11/2026');
  });
  it('non trasforma una data in importo', () => {
    expect(tryDictionary('spesa 12/03')).toBeNull();
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
