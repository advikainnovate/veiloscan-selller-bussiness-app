// Indian digit grouping (12,34,567), written out rather than relying on the
// JS engine's Intl data.
export function formatNumber(value: number) {
  const [whole, fraction] = Math.abs(Math.round(value * 100) / 100)
    .toFixed(2)
    .split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  const sign = value < 0 ? '-' : '';
  return fraction === '00' ? `${sign}${grouped}` : `${sign}${grouped}.${fraction}`;
}

/** ₹28,450 — paise only when there are some. */
export function formatRupees(value: number) {
  return `₹${formatNumber(value)}`;
}

export type Trend = { direction: 'up' | 'down' | 'flat'; label: string };

/** "+20%" against the previous period, or a plain phrase when there's nothing to compare. */
export function trend(value: number, previous: number): Trend {
  if (value === previous) return { direction: 'flat', label: 'Same as' };
  if (previous === 0) return { direction: 'up', label: 'Up from 0' };
  const pct = ((value - previous) / previous) * 100;
  const rounded = Math.abs(pct) < 10 ? Math.round(pct * 10) / 10 : Math.round(pct);
  return { direction: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : '−'}${Math.abs(rounded)}%` };
}
