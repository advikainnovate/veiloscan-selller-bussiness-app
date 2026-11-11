import { api } from '../lib/api';
import type { CreditFilter } from '../lib/customer-credit';
import type { PaymentMethod, ReminderType } from '../lib/orders';

// Customer Credit (eshop-backend src/modules/customer-credit), needs
// customer-credit:manage. Lists follow the store picked in the header.

export interface CreditSummary {
  totalCredit: number;
  totalCollected: number;
  totalOutstanding: number;
  dueThisWeek: number;
  overdueAmount: number;
  overdueCount: number;
  customersWithOutstanding: number;
}

export interface CreditRow {
  id: string;
  idd: string;
  customerName: string;
  customerPhone: string | null;
  customerId: string | null;
  orderId: string;
  orderNumber: string;
  storeName: string;
  creditAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  status: string;
  overdueDays: number;
  dueInDays: number | null;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
}

export interface CreditDetail {
  id: string;
  idd: string;
  status: string;
  creditAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  overdueDays: number;
  dueInDays: number | null;
  reminderEnabled: boolean;
  reminderDays: number;
  reminderChannels: ReminderType[];
  notes: string | null;
  createdAt: string;
  store: { id: string; name: string | null };
  customer: { id: string | null; registered: boolean; name: string; phone: string | null; email: string | null };
  order: {
    id: string;
    orderNumber: string;
    orderDate: string;
    orderStatus: string;
    paymentStatus: string;
    totalAmount: number;
    paidAtOrder: number;
    receiptId: string | null;
  };
  payments: {
    id: string;
    idd: string;
    receiptId: string | null;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    referenceNumber: string | null;
    notes: string | null;
  }[];
  reminders: {
    id: string;
    reminderDate: string;
    daysBeforeDue: number | null;
    notificationType: string;
    status: string;
    sentAt: string | null;
    failureReason: string | null;
  }[];
}

export interface ReceivePaymentPayload {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
}

export interface UpdateCreditPayload {
  dueDate: string;
  reminderEnabled: boolean;
  reminderDays: number;
  reminderChannels: ReminderType[];
  notes: string;
}

/** GET /customer-credit/customers/:id: one customer's credit with the seller's stores. */
export interface CustomerCreditSummary {
  totalCredit: number;
  totalPaid: number;
  outstanding: number;
  overdueAmount: number;
  credits: {
    id: string;
    idd: string;
    orderId: string;
    orderNumber: string;
    creditAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    dueDate: string;
    status: string;
    overdueDays: number;
    dueInDays: number | null;
    lastPaymentDate: string | null;
  }[];
}

export const customerCreditService = {
  customer(customerId: string): Promise<CustomerCreditSummary> {
    return api.get(`/customer-credit/customers/${customerId}`).then(res => res.data);
  },
  summary(): Promise<CreditSummary> {
    return api.get('/customer-credit/summary').then(res => res.data);
  },
  list(query: { filter: CreditFilter; search?: string; page: number; limit: number }): Promise<{ items: CreditRow[]; total: number }> {
    return api.get('/customer-credit', { params: query }).then(res => ({
      items: Array.isArray(res.data?.items) ? res.data.items : [],
      total: Number(res.data?.total ?? 0),
    }));
  },
  get(id: string): Promise<CreditDetail> {
    return api.get(`/customer-credit/${id}`).then(res => res.data);
  },
  receivePayment(id: string, payload: ReceivePaymentPayload) {
    return api.post(`/customer-credit/${id}/payments`, payload).then(res => res.data);
  },
  update(id: string, payload: UpdateCreditPayload) {
    return api.patch(`/customer-credit/${id}`, payload).then(res => res.data);
  },
  cancel(id: string, reason?: string) {
    return api.post(`/customer-credit/${id}/cancel`, reason ? { reason } : {}).then(res => res.data);
  },
  sendReminder(id: string, notificationType: ReminderType): Promise<CreditDetail> {
    return api.post(`/customer-credit/${id}/reminders`, { notificationType }).then(res => res.data);
  },
};
