import { api } from '../lib/api';

// The store's customers (eshop-backend src/modules/users, GET /customers):
// shoppers who have ordered from the selected store, needs customers:manage.

/** all: newest first · credit: who owes the most · top: the biggest spenders. */
export type CustomerView = 'all' | 'credit' | 'top';

export interface CustomerRow {
  id: string;
  /** The customer ID shown to sellers, e.g. USRCIZCUR8HK. */
  idd: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  countryCode: string | null;
  phoneNumber: string | null;
  status: string;
  createdAt: string;
  orderCount: number;
  /** Orders that weren't cancelled. */
  lifetimePurchase: number;
  lastOrderAt: string | null;
  /** Still owed on open credits; null when the role can't see Customer Credit. */
  creditOutstanding: number | null;
  /** The overdue part of it. */
  creditOverdue: number | null;
}

export interface CustomerPage {
  items: CustomerRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerSummary {
  total: number;
  newThisMonth: number;
  top: number;
  /** Null when the role can't see Customer Credit. */
  withCredit: number | null;
  creditOutstanding: number | null;
}

/** GET /customers/:id: the customer's account. */
export interface CustomerAccount {
  id: string;
  idd?: string | null;
  firstName: string | null;
  lastName: string | null;
  username?: string | null;
  userDisplayName?: string | null;
  email: string | null;
  countryCode: string | null;
  phoneNumber: string | null;
  gender?: string | null;
  status: string;
  isEmailVerification?: boolean | null;
  isPhoneVerification?: boolean | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface CustomerAddress {
  id: string;
  addressType?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  phone?: string | null;
  isDefaultShipping?: boolean | null;
  isDefaultBilling?: boolean | null;
}

/** The customer's orders with the seller's stores. */
export interface CustomerOrder {
  id: string;
  uniqueOrderId: string;
  orderStatus: string;
  fulfillmentType?: string | null;
  paymentStatus?: string | null;
  totalAmount?: number | string | null;
  clientAmount?: number | string | null;
  orderDateTime?: string | null;
  createdAt?: string | null;
  items?: unknown[];
}

const asList = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : Array.isArray((value as { items?: unknown })?.items) ? (value as { items: T[] }).items : [];

export const customerService = {
  get(id: string): Promise<CustomerAccount> {
    return api.get(`/customers/${id}`).then(res => res.data);
  },
  addresses(id: string): Promise<CustomerAddress[]> {
    return api.get(`/customers/${id}/addresses`).then(res => asList<CustomerAddress>(res.data));
  },
  orders(id: string): Promise<CustomerOrder[]> {
    return api.get(`/customers/${id}/orders`).then(res => asList<CustomerOrder>(res.data));
  },
  list(params: { page: number; limit: number; view: CustomerView; search?: string }): Promise<CustomerPage> {
    return api.get('/customers', { params }).then(res => res.data);
  },
  summary(): Promise<CustomerSummary> {
    return api.get('/customers/summary').then(res => res.data);
  },
};
