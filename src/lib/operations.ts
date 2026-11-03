// Store Operations helpers, as on the Seller Panel (store-operations/ops-ui.tsx
// and expenses/expense-ui.tsx): date ranges, labels and the expense rules.
import type { BadgeTone } from '../components/ui/Badge';
import type { AttachmentKind, ExpenseStatus, PaymentMode, RecurringFrequency, ReturnStatus } from '../services/expenses-service';
import { formatReportDay, shortRupees } from './sales-report';

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 02 Nov, 3:05 PM */
export function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}, ${time(value)}`;
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
    { key: 'today', label: 'Today', from: today, to: today },
    { key: 'yesterday', label: 'Yesterday', from: shiftDay(today, -1), to: shiftDay(today, -1) },
    { key: 'week', label: 'This Week', from: shiftDay(today, -((weekday + 6) % 7)), to: today },
    { key: 'month', label: 'This Month', from: toDay(new Date(y, m - 1, 1)), to: today },
    { key: 'last-month', label: 'Last Month', from: toDay(new Date(y, m - 2, 1)), to: toDay(new Date(y, m - 1, 0)) },
    { key: '3m', label: 'Last 3 Months', from: toDay(new Date(y, m - 3, 1)), to: today },
  ];
}

export const presetRange = (today: string, key: string) => rangePresets(today).find(r => r.key === key)!;

export function rangeLabel(range: { from: string; to: string }) {
  return range.from === range.to ? day(range.from) : `${day(range.from)} – ${day(range.to)}`;
}

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
];
export const paymentModeLabel = (v: string) => PAYMENT_MODES.find(m => m.value === v)?.label ?? v;

export const EXPENSE_STATUS: Record<ExpenseStatus, { label: string; tone: BadgeTone }> = {
  PAID: { label: 'Paid', tone: 'green' },
  UNPAID: { label: 'Unpaid', tone: 'amber' },
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'blue' },
  OVERDUE: { label: 'Overdue', tone: 'red' },
  PARTIALLY_RETURNED: { label: 'Partially returned', tone: 'violet' },
  RETURNED: { label: 'Returned', tone: 'slate' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
};
export const expenseStatus = (s: string) => EXPENSE_STATUS[s as ExpenseStatus] ?? { label: s, tone: 'slate' as BadgeTone };

export const RETURN_STATUS: Record<ReturnStatus, { label: string; tone: BadgeTone }> = {
  APPROVED: { label: 'Approved', tone: 'green' },
  PENDING: { label: 'Awaiting supplier', tone: 'amber' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
};

export const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  WEEKLY: 'Every week',
  MONTHLY: 'Every month',
  QUARTERLY: 'Every 3 months',
  YEARLY: 'Every year',
};

export const CREDIT_TERMS = [7, 15, 30, 45, 60];
export const GST_RATES = ['0', '5', '12', '18', '28'];

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  BILL: 'Bill',
  INVOICE: 'Invoice',
  RECEIPT: 'Receipt',
  CREDIT_NOTE: 'Credit note',
  OTHER: 'Other',
};

/** "Due in 3 days · 05 Nov" / "Due today" / "5 days overdue". */
export function dueText(dueInDays: number | null, dueDate: string | null): string | null {
  if (dueInDays === null || !dueDate) return null;
  if (dueInDays < 0) return `${-dueInDays} day${dueInDays === -1 ? '' : 's'} overdue`;
  if (dueInDays === 0) return 'Due today';
  return `Due in ${dueInDays} day${dueInDays === 1 ? '' : 's'} · ${day(dueDate)}`;
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
  if (!form.categoryId) return 'Pick a category';
  if (!form.expenseDate) return 'Pick the expense date';
  if (!(toAmount(form.baseAmount) > 0)) return 'Enter the base amount';
  if (totals.discount > totals.base) return "The discount can't be more than the base amount";
  if (!(totals.amount > 0)) return 'The final amount must be above ₹0';
  if (editing && totals.amount < editing.settled) {
    return `Payments and returns already come to ${formatMoney(editing.settled)}; the amount can't be lower`;
  }
  if (form.isCredit) {
    if (form.newSupplier && !form.supplierName.trim()) return "Enter the supplier's name";
    if (form.newSupplier && form.supplierGst && !GSTIN.test(form.supplierGst.trim().toUpperCase())) return 'The GST number has 15 letters and digits';
    if (form.dueDate && form.dueDate < (form.creditDate || form.expenseDate)) return "The due date can't be before the credit date";
    if (!editing && totals.paid >= totals.amount && totals.amount > 0) return 'That pays the whole amount — record it as Paid instead';
  }
  return null;
}
