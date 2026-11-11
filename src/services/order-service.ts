import { api } from '../lib/api';
import type { OrderRow, PaymentMethod } from '../lib/orders';

// The Seller Panel's order-master-service and the order payment calls from customer-credit-service.

/** GET /orders/:id/payments: what's been paid, what's due, and Customer Credit. */
export interface OrderPaymentSummary {
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  /** The store's Customer Credit setting. */
  creditAllowed: boolean;
  maxCreditDays: number;
  paymentPreference: 'PAY_FULL' | 'CREDIT' | null;
  creditRequest: {
    payNow: number;
    creditAmount: number;
    dueDate: string;
    note: string | null;
    status: 'PENDING' | 'APPROVED' | 'DECLINED';
  } | null;
  totalAmount: number;
  paidAtOrder: number;
  onCredit: number;
  amountDue: number;
  payments: { id: string; method: string; amount: number; referenceNumber?: string | null; remarks: string | null; paidAt: string | null }[];
  credit: { id: string; idd: string; status: string; creditAmount: number; outstandingAmount: number; dueDate: string } | null;
}

export interface RecordPaymentPayload {
  payments: { method: PaymentMethod; amount: number; referenceNumber?: string }[];
  /** The unpaid balance on Customer Credit. Reminders left out use the backend's defaults. */
  credit?: {
    amount: number;
    dueDate: string;
    reminderEnabled?: boolean;
    reminderDays?: number;
    reminderChannels?: string[];
    notes?: string;
  };
  /** Also mark the pickup order picked up. */
  completeOrder: boolean;
}

/** A seller's tax invoice, issued when the order is delivered. */
export interface OrderInvoice {
  id: string;
  invoiceNumber: string;
  seller?: { name?: string } | null;
  totals?: { total?: number | string } | null;
}

/** A payment receipt: the counter payment, or a Customer Credit payment. */
export interface OrderReceipt {
  id: string;
  receiptNumber: string;
  receiptType: 'ORDER_PAYMENT' | 'CREDIT_PAYMENT' | string;
  amount: number | string;
  balanceAfter?: number | string | null;
  paymentDate: string;
}

export const orderService = {
  list(): Promise<OrderRow[]> {
    return api.get('/orders').then(res => (Array.isArray(res.data) ? res.data : res.data?.items ?? []));
  },
  get(id: string): Promise<OrderRow> {
    return api.get(`/orders/${id}`).then(res => res.data);
  },
  /** Pickup orders: CONFIRMED (accept), PACKED (ready for pickup), DELIVERED (picked up) or CANCELLED. */
  /** The panel's order edit: status, payment status and remarks. */
  update(id: string, payload: { orderStatus?: string; paymentStatus?: string; remarks?: string | null }): Promise<OrderRow> {
    return api.patch(`/orders/${id}`, payload).then(res => res.data);
  },
  updatePickupStatus(id: string, status: string, reason?: string) {
    return api.patch(`/orders/${id}/pickup-status`, { status, ...(reason ? { reason } : {}) }).then(res => res.data);
  },
  payments(id: string): Promise<OrderPaymentSummary> {
    return api.get(`/orders/${id}/payments`).then(res => res.data);
  },
  recordPayment(id: string, payload: RecordPaymentPayload) {
    return api.post(`/orders/${id}/payments`, payload).then(res => res.data);
  },
  invoices(id: string): Promise<OrderInvoice[]> {
    return api.get(`/orders/${id}/invoices`).then(res => (Array.isArray(res.data) ? res.data : []));
  },
  receipts(id: string): Promise<OrderReceipt[]> {
    return api.get(`/orders/${id}/receipts`).then(res => (Array.isArray(res.data) ? res.data : []));
  },
  /** Accept or decline the customer's credit request. */
  decideCreditRequest(id: string, approve: boolean) {
    return api.post(`/orders/${id}/payments/credit-request`, { approve }).then(res => res.data);
  },
};
