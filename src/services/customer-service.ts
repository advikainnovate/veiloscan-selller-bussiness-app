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

export const customerService = {
  list(params: { page: number; limit: number; view: CustomerView; search?: string }): Promise<CustomerPage> {
    return api.get('/customers', { params }).then(res => res.data);
  },
  summary(): Promise<CustomerSummary> {
    return api.get('/customers/summary').then(res => res.data);
  },
};
