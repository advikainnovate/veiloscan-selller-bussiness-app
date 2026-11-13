// Customer Credit labels and rules, as on the Seller Panel
// (src/lib/customer-credit.ts).
import type { BadgeTone } from '../components/ui/Badge';
import { REMINDER_TYPES } from './orders';
import i18n from '../i18n';

export type CreditStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type CreditFilter = 'all' | 'pending' | 'partial' | 'due_soon' | 'overdue' | 'paid';

export const CREDIT_STATUS: Record<CreditStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { get label() { return i18n.t('common.pending'); }, tone: 'amber' },
  PARTIAL: { get label() { return i18n.t('credit.partial'); }, tone: 'blue' },
  PAID: { get label() { return i18n.t('common.paid'); }, tone: 'green' },
  OVERDUE: { get label() { return i18n.t('common.overdue'); }, tone: 'red' },
  CANCELLED: { get label() { return i18n.t('common.cancelled'); }, tone: 'slate' },
};

export const creditStatus = (status: unknown) => CREDIT_STATUS[status as CreditStatus] ?? CREDIT_STATUS.PENDING;

export const CREDIT_FILTERS: { value: CreditFilter; label: string }[] = [
  { value: 'all', get label() { return i18n.t('common.all'); } },
  { value: 'pending', get label() { return i18n.t('common.pending'); } },
  { value: 'partial', get label() { return i18n.t('credit.partial'); } },
  { value: 'due_soon', get label() { return i18n.t('credit.dueSoon'); } },
  { value: 'overdue', get label() { return i18n.t('common.overdue'); } },
  { value: 'paid', get label() { return i18n.t('common.paid'); } },
];

export const REMINDER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { get label() { return i18n.t('common.pending'); }, tone: 'amber' },
  SENT: { get label() { return i18n.t('common.sent'); }, tone: 'green' },
  FAILED: { get label() { return i18n.t('common.failed'); }, tone: 'red' },
  CANCELLED: { get label() { return i18n.t('common.cancelled'); }, tone: 'slate' },
};

// Order payment statuses (after Customer Credit).
export const ORDER_PAYMENT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { get label() { return i18n.t('credit.notPaidYet'); }, tone: 'amber' },
  PARTIAL: { get label() { return i18n.t('credit.partlyPaid'); }, tone: 'blue' },
  PAID: { get label() { return i18n.t('common.paid'); }, tone: 'green' },
  CREDIT: { get label() { return i18n.t('common.onCredit'); }, tone: 'violet' },
  OVERDUE: { get label() { return i18n.t('common.creditOverdue'); }, tone: 'red' },
  FAILED: { get label() { return i18n.t('credit.paymentFailed'); }, tone: 'red' },
  REFUNDED: { get label() { return i18n.t('common.refunded'); }, tone: 'slate' },
  PARTIALLY_REFUNDED: { get label() { return i18n.t('credit.partlyRefunded'); }, tone: 'slate' },
};

export const reminderTypeLabel = (value: unknown) => REMINDER_TYPES.find(m => m.value === value)?.label ?? String(value ?? '—');

/** Still owed: payments, reminders and edits are allowed. */
export const isOpenCredit = (status: unknown) => status === 'PENDING' || status === 'PARTIAL' || status === 'OVERDUE';

/** "Due in 3 days" / "Due today" / "5 days overdue" for an open credit. */
export function dueHint(credit: { status?: unknown; overdueDays?: unknown; dueInDays?: unknown }): string | null {
  if (credit.status === 'PAID' || credit.status === 'CANCELLED') return null;
  const overdue = Number(credit.overdueDays) || 0;
  if (overdue > 0) return i18n.t('common.daysOverdue', { count: overdue });
  const dueIn = credit.dueInDays;
  if (dueIn === null || dueIn === undefined) return null;
  const n = Number(dueIn);
  return n === 0 ? i18n.t('common.dueToday') : i18n.t('common.dueInDays', { count: n });
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
  if (!(p > 0)) return i18n.t('common.enterAnAmountAboveRs0');
  if (p > paise(outstanding)) return i18n.t('credit.canTExceedTheOutstandingOutstanding', { outstanding: formatRupees(outstanding) });
  return '';
}
