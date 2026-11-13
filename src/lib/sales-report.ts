// Sales Reports helpers, as on the Seller Panel (src/lib/date-range.ts and
// store-operations/reports-tab.tsx).
import type { BadgeTone } from '../components/ui/Badge';
import { monthShort } from './date';
import type { DateRange, SalesGroup, TrendInterval } from '../services/store-operations-service';
import i18n from '../i18n';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDay(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(day: string) {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function lastNDays(days: number, today: Date): DateRange {
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  return { from: toDay(from), to: toDay(today) };
}

export interface RangePreset {
  key: string;
  label: string;
  /** How the KPI cards describe the comparison period. */
  compareLabel: string;
  range: (today: Date) => DateRange;
}

export const RANGE_PRESETS: RangePreset[] = [
  { key: 'today', get label() { return i18n.t('common.today'); }, get compareLabel() { return i18n.t('common.vsYesterday'); }, range: t => lastNDays(1, t) },
  { key: '7d', get label() { return i18n.t('reports.last7Days'); }, get compareLabel() { return i18n.t('reports.vsPreviousDays', { count: 7 }); }, range: t => lastNDays(7, t) },
  { key: '30d', get label() { return i18n.t('reports.last30Days'); }, get compareLabel() { return i18n.t('reports.vsPreviousDays', { count: 30 }); }, range: t => lastNDays(30, t) },
  {
    key: 'this-month',
    get label() { return i18n.t('common.thisMonth'); },
    get compareLabel() { return i18n.t('common.vsLastMonth'); },
    range: t => ({ from: toDay(new Date(t.getFullYear(), t.getMonth(), 1)), to: toDay(new Date(t.getFullYear(), t.getMonth() + 1, 0)) }),
  },
  {
    key: 'last-month',
    get label() { return i18n.t('common.lastMonth'); },
    get compareLabel() { return i18n.t('reports.vsMonthBefore'); },
    range: t => ({ from: toDay(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: toDay(new Date(t.getFullYear(), t.getMonth(), 0)) }),
  },
  { key: '90d', get label() { return i18n.t('reports.last90Days'); }, get compareLabel() { return i18n.t('reports.vsPreviousDays', { count: 90 }); }, range: t => lastNDays(90, t) },
];

export const DEFAULT_PRESET = RANGE_PRESETS[3];

export function rangeDays(range: DateRange) {
  return Math.round((parseDay(range.to).getTime() - parseDay(range.from).getTime()) / 86400000) + 1;
}

/** Long ranges are grouped by week or month so the chart stays readable. */
export function autoInterval(range: DateRange): TrendInterval {
  const days = rangeDays(range);
  return days > 120 ? 'month' : days > 45 ? 'week' : 'day';
}

/** "01 Sep", or "01 Sep 2026". */
export function formatReportDay(day: string, withYear = true) {
  const date = parseDay(day);
  const label = `${pad(date.getDate())} ${monthShort(date.getMonth())}`;
  return withYear ? `${label} ${date.getFullYear()}` : label;
}

/** Axis labels and full labels (for the selected bar) for trend buckets. */
export function bucketLabels(dates: string[], interval: TrendInterval) {
  const month = (d: string, long = false) => {
    const date = parseDay(d);
    return long ? `${monthShort(date.getMonth())} ${date.getFullYear()}` : `${monthShort(date.getMonth())} ${String(date.getFullYear()).slice(2)}`;
  };
  return {
    labels: dates.map(d => (interval === 'month' ? month(d) : formatReportDay(d, false))),
    full: dates.map(d => (interval === 'week' ? i18n.t('reports.weekOfD', { d: formatReportDay(d) }) : interval === 'month' ? month(d, true) : formatReportDay(d))),
  };
}

/** Percent change from the previous period; null when there's nothing to compare. */
export function change(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** ₹1.24 L, ₹12.5K: chart axes and tight spaces. */
export function shortRupees(value: number | null | undefined) {
  if (value == null) return '—';
  const n = Number(value) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const cut = (x: number) => {
    const t = Math.floor(x * 100 + 1e-6) / 100;
    return Number.isInteger(t) ? String(t) : t.toFixed(2);
  };
  if (abs >= 1e7) return i18n.t('reports.signRsCutCr', { sign, cut: cut(abs / 1e7) });
  if (abs >= 1e5) return `${sign}₹${cut(abs / 1e5)} L`;
  if (abs >= 1e3) return `${sign}₹${cut(abs / 1e3)}K`;
  return `${sign}₹${cut(abs)}`;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  get CASH() { return i18n.t('common.cash'); },
  UPI: 'UPI',
  get CARD() { return i18n.t('common.card'); },
  get BANK_TRANSFER() { return i18n.t('common.bankTransfer'); },
  get NET_BANKING() { return i18n.t('reports.netBanking'); },
  get WALLET() { return i18n.t('reports.wallet'); },
  get COD() { return i18n.t('common.cashOnDelivery'); },
  get CREDIT() { return i18n.t('common.customerCredit'); },
  get SPLIT() { return i18n.t('reports.splitPayment'); },
  get OTHER() { return i18n.t('common.other'); },
};

export function paymentLabel(method: string) {
  return PAYMENT_METHOD_LABEL[method] ?? method.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

const SALE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  DELIVERED: { get label() { return i18n.t('common.completed'); }, tone: 'green' },
  SHIPPED: { get label() { return i18n.t('common.shipped'); }, tone: 'blue' },
  OUT_FOR_DELIVERY: { get label() { return i18n.t('reports.outForDelivery'); }, tone: 'blue' },
  RETURN_REQUESTED: { get label() { return i18n.t('reports.returnRequested'); }, tone: 'amber' },
  REPLACED: { get label() { return i18n.t('reports.replaced'); }, tone: 'violet' },
};

export function saleStatus(status: string) {
  return SALE_STATUS[status] ?? { label: i18n.t('common.processing'), tone: 'orange' as BadgeTone };
}

export const SALES_TABS: { value: SalesGroup; label: string }[] = [
  { value: 'none', get label() { return i18n.t('common.all'); } },
  { value: 'date', get label() { return i18n.t('reports.byDate'); } },
  { value: 'category', get label() { return i18n.t('common.byCategory'); } },
  { value: 'product', get label() { return i18n.t('reports.byProduct'); } },
  { value: 'payment', get label() { return i18n.t('reports.byPaymentMode'); } },
  { value: 'customer', get label() { return i18n.t('reports.byCustomer'); } },
  { value: 'staff', get label() { return i18n.t('reports.byStaff'); } },
];

/** A grouped row's label: dates and payment modes are shown readably. */
export function groupLabel(group: SalesGroup, label: string) {
  if (group === 'date') return formatReportDay(label);
  if (group === 'payment') return paymentLabel(label);
  return label;
}

// Chart marks only (the Seller Panel's validated categorical palette).
export const CHART_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const SALES_COLOR = CHART_COLORS[1];
export const PROFIT_COLOR = CHART_COLORS[2];
export const ORDERS_COLOR = CHART_COLORS[0];
export const CHART_INK = { muted: '#898781', grid: '#e1e0d9', baseline: '#c3c2b7', surface: '#fcfcfb' };
