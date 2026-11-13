// Store Operations helpers, as on the Seller Panel (store-operations/ops-ui.tsx
// and expenses/expense-ui.tsx): date ranges, labels and the expense rules.
import type { BadgeTone } from '../components/ui/Badge';
import { monthShort } from './date';
import type { AttachmentKind, ExpenseStatus, PaymentMode, RecurringFrequency, ReturnStatus } from '../services/expenses-service';
import { formatReportDay, shortRupees } from './sales-report';
import i18n from '../i18n';

const pad = (n: number) => String(n).padStart(2, '0');
const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today on the phone's calendar, YYYY-MM-DD. */
export const todayDay = () => toDay(new Date());

export function shiftDay(day: string, days: number) {
  const [y, m, d] = day.split('-').map(Number);
  return toDay(new Date(y, m - 1, d + days));
}

/** ₹1.24 L, as the panel's money(). */
export const money = (n: number | null | undefined) => shortRupees(n);
export const count = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'));
export const day = (value: string | null | undefined) => (value ? formatReportDay(String(value).slice(0, 10)) : '—');

/** 02 Nov, 3:05 PM */
export function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())} ${monthShort(d.getMonth())}, ${time(value)}`;
}
/** 3:05 PM */
export function time(value: string) {
  const d = new Date(value);
  return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export interface OpsRange {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** Today · Yesterday · This Week · This Month · Last Month · Last 3 Months. */
export function rangePresets(today: string): OpsRange[] {
  const [y, m, d] = today.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return [
    { key: 'today', label: i18n.t('common.today'), from: today, to: today },
    { key: 'yesterday', label: i18n.t('common.yesterday'), from: shiftDay(today, -1), to: shiftDay(today, -1) },
    { key: 'week', label: i18n.t('operations.thisWeek'), from: shiftDay(today, -((weekday + 6) % 7)), to: today },
    { key: 'month', label: i18n.t('common.thisMonth'), from: toDay(new Date(y, m - 1, 1)), to: today },
    { key: 'last-month', label: i18n.t('common.lastMonth'), from: toDay(new Date(y, m - 2, 1)), to: toDay(new Date(y, m - 1, 0)) },
    { key: '3m', label: i18n.t('operations.last3Months'), from: toDay(new Date(y, m - 3, 1)), to: today },
  ];
}

export const presetRange = (today: string, key: string) => rangePresets(today).find(r => r.key === key)!;

export function rangeLabel(range: { from: string; to: string }) {
  return range.from === range.to ? day(range.from) : `${day(range.from)} – ${day(range.to)}`;
}

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'CASH', get label() { return i18n.t('common.cash'); } },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', get label() { return i18n.t('common.bankTransfer'); } },
  { value: 'CARD', get label() { return i18n.t('common.card'); } },
  { value: 'OTHER', get label() { return i18n.t('common.other'); } },
];
export const paymentModeLabel = (v: string) => PAYMENT_MODES.find(m => m.value === v)?.label ?? v;

export const EXPENSE_STATUS: Record<ExpenseStatus, { label: string; tone: BadgeTone }> = {
  PAID: { get label() { return i18n.t('common.paid'); }, tone: 'green' },
  UNPAID: { get label() { return i18n.t('operations.unpaid'); }, tone: 'amber' },
  PARTIALLY_PAID: { get label() { return i18n.t('operations.partiallyPaid'); }, tone: 'blue' },
  OVERDUE: { get label() { return i18n.t('common.overdue'); }, tone: 'red' },
  PARTIALLY_RETURNED: { get label() { return i18n.t('operations.partiallyReturned'); }, tone: 'violet' },
  RETURNED: { get label() { return i18n.t('operations.returned'); }, tone: 'slate' },
  CANCELLED: { get label() { return i18n.t('common.cancelled'); }, tone: 'slate' },
};
export const expenseStatus = (s: string) => EXPENSE_STATUS[s as ExpenseStatus] ?? { label: s, tone: 'slate' as BadgeTone };

export const RETURN_STATUS: Record<ReturnStatus, { label: string; tone: BadgeTone }> = {
  APPROVED: { get label() { return i18n.t('common.approved'); }, tone: 'green' },
  PENDING: { get label() { return i18n.t('operations.awaitingSupplier'); }, tone: 'amber' },
  CANCELLED: { get label() { return i18n.t('common.cancelled'); }, tone: 'slate' },
};

export const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  get WEEKLY() { return i18n.t('operations.everyWeek'); },
  get MONTHLY() { return i18n.t('operations.everyMonth'); },
  get QUARTERLY() { return i18n.t('operations.every3Months'); },
  get YEARLY() { return i18n.t('operations.everyYear'); },
};

export const CREDIT_TERMS = [7, 15, 30, 45, 60];
export const GST_RATES = ['0', '5', '12', '18', '28'];

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  get BILL() { return i18n.t('common.bill'); },
  get INVOICE() { return i18n.t('operations.invoice'); },
  get RECEIPT() { return i18n.t('common.receipt'); },
  get CREDIT_NOTE() { return i18n.t('operations.creditNote'); },
  get OTHER() { return i18n.t('common.other'); },
};

/** "Due in 3 days · 05 Nov" / "Due today" / "5 days overdue". */
export function dueText(dueInDays: number | null, dueDate: string | null): string | null {
  if (dueInDays === null || !dueDate) return null;
  if (dueInDays < 0) return i18n.t('common.daysOverdue', { count: -dueInDays });
  if (dueInDays === 0) return i18n.t('common.dueToday');
  return `${i18n.t('common.dueInDays', { count: dueInDays })} · ${day(dueDate)}`;
}

/** Rupees typed into a field, rounded to the paisa (NaN when empty). */
export const toAmount = (v: string) => (v.trim() === '' ? NaN : Math.round(Number(v) * 100) / 100);

/** A fresh key per form, so a double tap records one payment / return. */
export const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const GSTIN = /^[0-9A-Z]{15}$/;

/** % change against the previous period; null when there's nothing to compare. */
export function change(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export interface ExpenseTotals {
  base: number;
  discount: number;
  tax: number;
  amount: number;
  paid: number;
  outstanding: number;
}

/** Totals as the server works them out (paise, rounded once). */
export function expenseTotals(input: {
  baseAmount: string;
  discountAmount: string;
  gst: string;
  taxAmount: string;
  initialPaid: string;
  isCredit: boolean;
}): ExpenseTotals {
  const base = Math.round((toAmount(input.baseAmount) || 0) * 100);
  const discount = Math.round((toAmount(input.discountAmount) || 0) * 100);
  const taxable = Math.max(base - discount, 0);
  const tax =
    input.gst === 'custom' ? Math.round((toAmount(input.taxAmount) || 0) * 100) : input.gst ? Math.round((taxable * Number(input.gst)) / 100) : 0;
  const amount = taxable + tax;
  const paid = input.isCredit ? Math.round((toAmount(input.initialPaid) || 0) * 100) : amount;
  return { base: base / 100, discount: discount / 100, tax: tax / 100, amount: amount / 100, paid: paid / 100, outstanding: Math.max(amount - paid, 0) / 100 };
}

/** The panel's expense form checks, in its order; null when it can be saved. */
export function expenseProblem(
  form: {
    categoryId: string;
    expenseDate: string;
    baseAmount: string;
    isCredit: boolean;
    newSupplier: boolean;
    supplierName: string;
    supplierGst: string;
    creditDate: string;
    dueDate: string;
  },
  totals: ExpenseTotals,
  editing: { settled: number } | null,
  formatMoney: (n: number) => string,
): string | null {
  if (!form.categoryId) return i18n.t('common.pickACategory');
  if (!form.expenseDate) return i18n.t('operations.pickTheExpenseDate');
  if (!(toAmount(form.baseAmount) > 0)) return i18n.t('operations.enterTheBaseAmount');
  if (totals.discount > totals.base) return i18n.t('operations.theDiscountCanTBeMore');
  if (!(totals.amount > 0)) return i18n.t('operations.theFinalAmountMustBeAbove');
  if (editing && totals.amount < editing.settled) {
    return i18n.t('operations.paymentsAndReturnsAlreadyComeTo', { settled: formatMoney(editing.settled) });
  }
  if (form.isCredit) {
    if (form.newSupplier && !form.supplierName.trim()) return i18n.t('common.enterTheSuppliersName');
    if (form.newSupplier && form.supplierGst && !GSTIN.test(form.supplierGst.trim().toUpperCase())) return i18n.t('common.theGstNumberHas15Letters');
    if (form.dueDate && form.dueDate < (form.creditDate || form.expenseDate)) return i18n.t('operations.theDueDateCanTBe');
    if (!editing && totals.paid >= totals.amount && totals.amount > 0) return i18n.t('operations.thatPaysTheWholeAmountRecord');
  }
  return null;
}
