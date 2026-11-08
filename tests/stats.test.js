import { describe, it, expect } from 'vitest';
import { applyStatsDelta } from '../src/utils/stats.js';

const pad = (n) => String(n).padStart(2, '0');

function currentTx(overrides = {}) {
  const now = new Date();
  return {
    amount: 22,
    type: 'out',
    category: 'cibo',
    date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    recurring: 0,
    ...overrides,
  };
}

function baseStats(tx) {
  const now = new Date();
  return {
    counts: { all: 2, in: 0, out: 2, recurring: 0 },
    totals: { in: 0, out: 32 },
    currentMonth: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      in: 0,
      out: 32,
      categories: { cibo: 22, altro: 10 },
    },
    lastMonth: { year: now.getFullYear(), month: now.getMonth(), in: 0, out: 0 },
    months: [{
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      in: 0,
      out: 32,
    }],
  };
}

describe('applyStatsDelta', () => {
  it('rimuove una transazione da tutti gli aggregati', () => {
    const tx = currentTx();
    const next = applyStatsDelta(baseStats(tx), tx, -1);

    expect(next.counts.all).toBe(1);
    expect(next.counts.out).toBe(1);
    expect(next.totals.out).toBe(10);
    expect(next.currentMonth.out).toBe(10);
    expect(next.currentMonth.categories.cibo).toBeUndefined();
    expect(next.currentMonth.categories.altro).toBe(10);
    expect(next.months[0].out).toBe(10);
  });

  it('è reversibile (undo)', () => {
    const tx = currentTx();
    const stats = baseStats(tx);
    const next = applyStatsDelta(applyStatsDelta(stats, tx, -1), tx, 1);

    expect(next.counts.all).toBe(stats.counts.all);
    expect(next.totals.out).toBe(stats.totals.out);
    expect(next.currentMonth.categories.cibo).toBe(22);
  });

  it('aggiorna il contatore dei ricorrenti', () => {
    const tx = currentTx({ recurring: 1 });
    const next = applyStatsDelta(baseStats(tx), tx, -1);
    expect(next.counts.recurring).toBe(0);
  });

  it('non va sotto zero', () => {
    const tx = currentTx();
    const stats = baseStats(tx);
    stats.counts.all = 0;
    stats.counts.out = 0;
    const next = applyStatsDelta(stats, tx, -1);
    expect(next.counts.all).toBe(0);
    expect(next.counts.out).toBe(0);
  });
});
