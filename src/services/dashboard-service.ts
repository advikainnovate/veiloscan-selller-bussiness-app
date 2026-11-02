import { api } from '../lib/api';

export interface Metric {
  value: number;
  /** The same figure for the previous period (yesterday, for a one-day range). */
  previous: number;
}

// GET /reports/overview (the Seller Panel's dashboard). Sections the user's
// role doesn't cover come back as null.
export interface Overview {
  storeName: string | null;
  kpis: {
    sales: Metric | null;
    orders: Metric | null;
    customers: Metric | null;
    /** All the seller's products (value) and those that existed before the range (previous). */
    products: Metric | null;
  };
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  /** A Seller Panel path, e.g. /dashboard/orders/<id>. */
  link: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

/** YYYY-MM-DD in the phone's time zone. */
export function localDate(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const dashboardService = {
  /** Today's figures, compared with yesterday's. */
  today(): Promise<Overview> {
    const today = localDate();
    return api.get('/reports/overview', { params: { from: today, to: today } }).then(res => res.data);
  },
  /** Every shopper who has ordered from the seller (needs customers:manage). */
  customerCount(): Promise<number> {
    return api.get('/customers', { params: { page: 1, limit: 1 } }).then(res => Number(res.data?.total ?? 0));
  },
  unreadNotifications(): Promise<number> {
    return api.get('/notifications', { params: { limit: 1 } }).then(res => Number(res.data?.unreadCount ?? 0));
  },
  /** The latest notifications and the unread count (the header bell). */
  notifications(limit = 10): Promise<NotificationList> {
    return api.get('/notifications', { params: { limit } }).then(res => ({
      items: Array.isArray(res.data?.items) ? res.data.items : [],
      unreadCount: Number(res.data?.unreadCount ?? 0),
    }));
  },
};
