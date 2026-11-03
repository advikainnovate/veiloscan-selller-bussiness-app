import { api } from '../lib/api';
import type { LogEntry } from './store-operations-service';

// Expenses Management (eshop-backend store-operations: expenses, payments,
// returns, suppliers, recurring expenses, reports), as the Seller Panel's
// expenses-service. Amounts are rupees. An expense's `amount` is its original
// amount (base − discount + tax): payments and returns never change it.

export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type ExpensePaymentType = 'PAID' | 'CREDIT';
export type ExpenseStatus = 'PAID' | 'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CANCELLED';
export type ExpenseKind = 'OPERATING' | 'PURCHASE';
export type ReturnStatus = 'PENDING' | 'APPROVED' | 'CANCELLED';
export type AttachmentKind = 'BILL' | 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE' | 'OTHER';
export type RecurringFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ExpenseCategory {
  id: string;
  name: string;
  isSystem: boolean;
  expenseCount: number;
}

export interface Expense {
  id: string;
  idd: string;
  kind: ExpenseKind;
  title: string | null;
  expenseDate: string;
  paymentType: ExpensePaymentType;
  status: ExpenseStatus;
  baseAmount: number;
  discountAmount: number;
  taxRate: number | null;
  taxAmount: number;
  amount: number;
  paidAmount: number;
  returnedAmount: number;
  netAmount: number;
  outstandingAmount: number;
  refundDue: number;
  dueInDays: number | null;
  paymentMode: PaymentMode | null;
  paidTo: string | null;
  referenceNumber: string | null;
  invoiceDate: string | null;
  description: string | null;
  notes: string | null;
  creditDate: string | null;
  dueDate: string | null;
  creditTermsDays: number | null;
  reminderDate: string | null;
  stockOrderId: string | null;
  recurringId: string | null;
  categoryId: string;
  categoryName: string;
  supplierId: string | null;
  supplierName: string | null;
  attachmentCount: number;
  createdByName: string | null;
  createdAt: string;
}

export interface ExpenseAttachment {
  id: string;
  kind: AttachmentKind;
  fileId: string;
  url: string | null;
  fileName: string;
}

export interface ExpensePayment {
  id: string;
  idd: string;
  paymentDate: string;
  amount: number;
  method: PaymentMode;
  accountLabel: string | null;
  transactionReference: string | null;
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  voidedByName: string | null;
  attachments: ExpenseAttachment[];
}

export interface ExpenseReturn {
  id: string;
  idd: string;
  returnDate: string;
  amount: number;
  quantity: number | null;
  referenceNumber: string | null;
  creditNoteNumber: string | null;
  description: string | null;
  reason: string | null;
  status: ReturnStatus;
  cancelReason: string | null;
  attachments: ExpenseAttachment[];
}

export interface ExpenseDetail extends Expense {
  supplier: { id: string; idd: string; name: string; phone: string | null; address: string | null; gstNumber: string | null } | null;
  stockOrderIdd: string | null;
  recurringTitle: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  payments: ExpensePayment[];
  returns: ExpenseReturn[];
  attachments: ExpenseAttachment[];
  reminders: { type: string; remindOn: string; status: string; sentAt: string | null }[];
  history: LogEntry[];
}

export interface ExpenseQuery {
  from?: string;
  to?: string;
  categoryId?: string;
  supplierId?: string;
  paymentMode?: string;
  paymentType?: string;
  status?: string;
  createdBy?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface ExpenseList {
  items: Expense[];
  total: number;
  totalAmount: number;
  netAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

export interface ExpenseDashboard {
  totals: { count: number; totalExpenses: number; paidExpenses: number; creditExpenses: number; returns: number };
  owed: {
    outstanding: number;
    openCount: number;
    overdue: number;
    overdueCount: number;
    partiallyPaid: number;
    partiallyPaidCount: number;
    dueThisWeek: number;
    refundsDue: number;
    stockBillsOutstanding: number;
  };
  months: { month: string; total: number; paid: number; credit: number; payments: number; count: number }[];
  byCategory: { categoryId: string; name: string; amount: number; count: number }[];
  upcoming: Expense[];
}

export interface Supplier {
  id: string;
  idd: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  notes: string | null;
  isActive: boolean;
  bills: number;
  creditTotal: number;
  paid: number;
  returned: number;
  outstanding: number;
  overdue: number;
  refundDue: number;
  lastBillDate: string | null;
}

export interface SupplierBill {
  id: string;
  idd: string;
  kind: ExpenseKind;
  title: string;
  expenseDate: string;
  dueDate: string | null;
  status: ExpenseStatus;
  amount: number;
  paidAmount: number;
  returnedAmount: number;
  outstandingAmount: number;
  referenceNumber: string | null;
}

export interface SupplierLedgerEntry {
  date: string;
  type: 'BILL' | 'PAYMENT' | 'RETURN';
  expenseId: string;
  reference: string;
  title: string;
  detail: string | null;
  amount: number;
  void: boolean;
  balance: number;
}

export interface SupplierLedger extends Omit<Supplier, 'bills'> {
  bills: SupplierBill[];
  transactions: SupplierLedgerEntry[];
  history: LogEntry[];
}

export interface RecurringExpense {
  id: string;
  idd: string;
  title: string;
  categoryId: string;
  categoryName: string;
  supplierId: string | null;
  supplierName: string | null;
  baseAmount: number;
  taxRate: number | null;
  amount: number;
  paymentType: ExpensePaymentType;
  paymentMethod: PaymentMode | null;
  accountLabel: string | null;
  creditTermsDays: number | null;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string | null;
  nextRunDate: string | null;
  occurrences: number;
  isActive: boolean;
  totalRecorded: number;
}

export interface ExpenseReport {
  period: ReportPeriod;
  range: { from: string; to: string };
  totals: { count: number; gross: number; net: number; credit: number; tax: number; paid: number; returned: number };
  points: { bucket: string; count: number; gross: number; net: number; credit: number; tax: number; paid: number; returned: number }[];
  byCategory: { name: string; count: number; amount: number }[];
  bySupplier: { name: string; count: number; amount: number; paid: number }[];
  byPaymentMethod: { method: PaymentMode; count: number; amount: number }[];
  byStatus: { status: ExpenseStatus; count: number; amount: number }[];
}

export interface AttachmentInput {
  fileId: string;
  kind?: AttachmentKind;
}

type Body = Record<string, unknown>;
const base = (storeId: string) => `/stores/${storeId}/operations`;
const get = <T>(url: string, params?: object): Promise<T> => api.get(url, { params }).then(res => res.data);
const post = <T>(url: string, body?: object): Promise<T> => api.post(url, body ?? {}).then(res => res.data);
const patch = <T>(url: string, body: object): Promise<T> => api.patch(url, body).then(res => res.data);
const del = (url: string) => api.delete(url).then(res => res.data);

/** `/path?a=1&b=2` without empty values, for a PDF download URL. */
export function withQuery(path: string, query: Record<string, unknown>) {
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
}

export const expensesService = {
  categories: (storeId: string) => get<ExpenseCategory[]>(`${base(storeId)}/expense-categories`),
  createCategory: (storeId: string, name: string) => post(`${base(storeId)}/expense-categories`, { name }),
  renameCategory: (storeId: string, id: string, name: string) => patch(`${base(storeId)}/expense-categories/${id}`, { name }),
  removeCategory: (storeId: string, id: string) => del(`${base(storeId)}/expense-categories/${id}`),

  dashboard: (storeId: string, range: { from: string; to: string }) => get<ExpenseDashboard>(`${base(storeId)}/expenses/dashboard`, range),
  contributors: (storeId: string) => get<{ id: string; name: string }[]>(`${base(storeId)}/expenses/contributors`),
  list: (storeId: string, query: ExpenseQuery) => get<ExpenseList>(`${base(storeId)}/expenses`, query),
  get: (storeId: string, id: string) => get<ExpenseDetail>(`${base(storeId)}/expenses/${id}`),
  create: (storeId: string, payload: Body) => post<ExpenseDetail>(`${base(storeId)}/expenses`, payload),
  update: (storeId: string, id: string, payload: Body) => patch<ExpenseDetail>(`${base(storeId)}/expenses/${id}`, payload),
  duplicate: (storeId: string, id: string) => post<ExpenseDetail>(`${base(storeId)}/expenses/${id}/duplicate`),
  cancel: (storeId: string, id: string, reason: string) => post<ExpenseDetail>(`${base(storeId)}/expenses/${id}/cancel`, { reason }),
  remove: (storeId: string, id: string) => del(`${base(storeId)}/expenses/${id}`),

  addPayment: (storeId: string, id: string, payload: Body) => post<ExpenseDetail>(`${base(storeId)}/expenses/${id}/payments`, payload),
  voidPayment: (storeId: string, id: string, paymentId: string, reason: string) =>
    post<ExpenseDetail>(`${base(storeId)}/expenses/${id}/payments/${paymentId}/void`, { reason }),
  addReturn: (storeId: string, id: string, payload: Body) => post<ExpenseDetail>(`${base(storeId)}/expenses/${id}/returns`, payload),
  approveReturn: (storeId: string, id: string, returnId: string) => post<ExpenseDetail>(`${base(storeId)}/expenses/${id}/returns/${returnId}/approve`),
  cancelReturn: (storeId: string, id: string, returnId: string, reason?: string) =>
    post<ExpenseDetail>(`${base(storeId)}/expenses/${id}/returns/${returnId}/cancel`, reason ? { reason } : {}),
  addAttachments: (storeId: string, id: string, attachments: AttachmentInput[]) =>
    post<ExpenseDetail>(`${base(storeId)}/expenses/${id}/attachments`, { attachments }),
  removeAttachment: (storeId: string, id: string, attachmentId: string) => del(`${base(storeId)}/expenses/${id}/attachments/${attachmentId}`),

  suppliers: (storeId: string, query: { search?: string; owing?: 'true'; includeInactive?: 'true' } = {}) =>
    get<{ items: Supplier[]; totals: { outstanding: number; overdue: number; refundDue: number; owing: number } }>(`${base(storeId)}/expense-suppliers`, query),
  supplier: (storeId: string, id: string) => get<SupplierLedger>(`${base(storeId)}/expense-suppliers/${id}`),
  createSupplier: (storeId: string, payload: Body) => post<SupplierLedger>(`${base(storeId)}/expense-suppliers`, payload),
  updateSupplier: (storeId: string, id: string, payload: Body) => patch<SupplierLedger>(`${base(storeId)}/expense-suppliers/${id}`, payload),
  removeSupplier: (storeId: string, id: string) => del(`${base(storeId)}/expense-suppliers/${id}`),

  recurring: (storeId: string) => get<RecurringExpense[]>(`${base(storeId)}/expense-recurring`),
  createRecurring: (storeId: string, payload: Body) => post(`${base(storeId)}/expense-recurring`, payload),
  updateRecurring: (storeId: string, id: string, payload: Body) => patch(`${base(storeId)}/expense-recurring/${id}`, payload),
  removeRecurring: (storeId: string, id: string) => del(`${base(storeId)}/expense-recurring/${id}`),

  report: (storeId: string, query: { period: ReportPeriod; from?: string; to?: string }) => get<ExpenseReport>(`${base(storeId)}/expenses/reports`, query),
  /** Paths for openPdf (the API's PDF exports). */
  reportPdfPath: (storeId: string, query: { period: ReportPeriod; from?: string; to?: string }) =>
    withQuery(`${base(storeId)}/expenses/reports/export`, { ...query, format: 'pdf' }),
  listPdfPath: (storeId: string, query: ExpenseQuery) => withQuery(`${base(storeId)}/expenses/export`, { ...query, format: 'pdf' }),
};
