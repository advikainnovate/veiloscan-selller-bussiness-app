// Customer Credit labels and rules, as on the Seller Panel
// (src/lib/customer-credit.ts).
import type { BadgeTone } from '../components/ui/Badge';
import { REMINDER_TYPES } from './orders';

export type CreditStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type CreditFilter = 'all' | 'pending' | 'partial' | 'due_soon' | 'overdue' | 'paid';

export const CREDIT_STATUS: Record<CreditStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'amber' },
  PARTIAL: { label: 'Partial', tone: 'blue' },
  PAID: { label: 'Paid', tone: 'green' },
  OVERDUE: { label: 'Overdue', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
};

export const creditStatus = (status: unknown) => CREDIT_STATUS[status as CreditStatus] ?? CREDIT_STATUS.PENDING;

export const CREDIT_FILTERS: { value: CreditFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'due_soon', label: 'Due Soon' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

export const REMINDER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'amber' },
  SENT: { label: 'Sent', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
};

// Order payment statuses (after Customer Credit).
export const ORDER_PAYMENT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Not paid yet', tone: 'amber' },
  PARTIAL: { label: 'Partly paid', tone: 'blue' },
  PAID: { label: 'Paid', tone: 'green' },
  CREDIT: { label: 'On credit', tone: 'violet' },
  OVERDUE: { label: 'Credit overdue', tone: 'red' },
  FAILED: { label: 'Payment failed', tone: 'red' },
  REFUNDED: { label: 'Refunded', tone: 'slate' },
  PARTIALLY_REFUNDED: { label: 'Partly refunded', tone: 'slate' },
};

export const reminderTypeLabel = (value: unknown) => REMINDER_TYPES.find(m => m.value === value)?.label ?? String(value ?? '—');

/** Still owed: payments, reminders and edits are allowed. */
export const isOpenCredit = (status: unknown) => status === 'PENDING' || status === 'PARTIAL' || status === 'OVERDUE';

/** "Due in 3 days" / "Due today" / "5 days overdue" for an open credit. */
export function dueHint(credit: { status?: unknown; overdueDays?: unknown; dueInDays?: unknown }): string | null {
  if (credit.status === 'PAID' || credit.status === 'CANCELLED') return null;
  const overdue = Number(credit.overdueDays) || 0;
  if (overdue > 0) return `${overdue} day${overdue === 1 ? '' : 's'} overdue`;
  const dueIn = credit.dueInDays;
  if (dueIn === null || dueIn === undefined) return null;
  const n = Number(dueIn);
  return n === 0 ? 'Due today' : `Due in ${n} day${n === 1 ? '' : 's'}`;
}

/** Amount in rupees → paise, to compare money without float drift. */
export const paise = (value: unknown) => Math.round((Number(value) || 0) * 100);

/** Today on the phone's calendar, YYYY-MM-DD. */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD shifted by `days`. */
export function shiftISO(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

/** Why a payment can't be recorded, or '' (the backend checks the same). */
export function paymentAmountProblem(amount: string, outstanding: number, formatRupees: (n: number) => string) {
  if (amount === '') return '';
  const p = paise(amount);
  if (!(p > 0)) return 'Enter an amount above ₹0';
  if (p > paise(outstanding)) return `Can't exceed the outstanding ${formatRupees(outstanding)}`;
  return '';
}
