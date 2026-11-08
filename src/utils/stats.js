const pad = (n) => String(n).padStart(2, '0');

function monthKeyOf(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('/');
  if (parts.length !== 3) return null;
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
  return `${year}-${pad(month)}`;
}

function monthKeyOfDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/**
 * Applies an optimistic +1/-1 to the aggregate stats returned by
 * /api/transactions/stats. Used by delete/undo so the wallet card updates
 * immediately, before the delayed server delete.
 */
export function applyStatsDelta(stats, tx, sign = 1) {
  if (!stats || !tx) return stats;

  const amount = Number(tx.amount) || 0;
  const type = tx.type === 'in' ? 'in' : 'out';
  const now = new Date();
  const currentKey = monthKeyOfDate(now);
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = monthKeyOfDate(lastDate);
  const txKey = monthKeyOf(tx.date);

  const next = {
    ...stats,
    counts: { ...stats.counts },
    totals: { ...stats.totals },
    currentMonth: {
      ...stats.currentMonth,
      categories: { ...(stats.currentMonth?.categories || {}) },
    },
    lastMonth: { ...stats.lastMonth },
    months: (stats.months || []).map((month) => ({ ...month })),
  };

  const delta = amount * sign;

  next.counts.all = Math.max(0, (next.counts.all || 0) + sign);
  next.counts[type] = Math.max(0, (next.counts[type] || 0) + sign);
  if (tx.recurring) {
    next.counts.recurring = Math.max(0, (next.counts.recurring || 0) + sign);
  }
  next.totals[type] = Math.max(0, (next.totals[type] || 0) + delta);

  if (txKey === currentKey) {
    next.currentMonth[type] = Math.max(0, (next.currentMonth[type] || 0) + delta);
    if (type === 'out') {
      const category = tx.category || 'altro';
      const value = (next.currentMonth.categories[category] || 0) + delta;
      if (value > 0.000001) next.currentMonth.categories[category] = value;
      else delete next.currentMonth.categories[category];
    }
  }

  if (txKey === lastKey) {
    next.lastMonth[type] = Math.max(0, (next.lastMonth[type] || 0) + delta);
  }

  const parts = String(tx.date || '').split('/');
  const txYear = Number(parts[2]);
  const txMonth = Number(parts[1]);
  const monthEntry = next.months.find(
    (entry) => entry.year === txYear && entry.month === txMonth
  );
  if (monthEntry) {
    monthEntry[type] = Math.max(0, (monthEntry[type] || 0) + delta);
  }

  return next;
}
