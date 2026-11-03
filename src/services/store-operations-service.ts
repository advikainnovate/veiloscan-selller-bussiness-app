import { api, STORE_HEADER } from '../lib/api';

// Store Operations reports (eshop-backend src/modules/store-operations,
// /stores/:storeId/operations), as on the Seller Panel's Sales Reports page.
// Needs store-operations:manage; profit figures need store-profit:view.

export interface OpsMetrics {
  orders: number;
  sales: number;
  expenses: number;
  collection: number;
  cashCollection: number;
  onlineCollection: number;
  /** Null without the store-profit:view permission (and the margins with it). */
  productCost: number | null;
  grossProfit: number | null;
  netProfit: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  /** Sold lines with no cost price, so profit is overstated. */
  linesWithoutCost: number | null;
}

export interface StockAlerts {
  lowStock: number;
  outOfStock: number;
  pendingStockOrders: number;
  delayedStockOrders: number;
}

export interface OpsOverview {
  canViewProfit: boolean;
  period: OpsMetrics;
  previous: OpsMetrics;
  alerts: StockAlerts;
}

export interface TimelineEvent {
  at: string;
  type: 'ORDER' | 'EXPENSE' | 'STOCK_RECEIVED' | 'STOCK_ADJUSTED' | 'NOTE' | 'CREDIT_PAYMENT';
  id: string;
  title: string | null;
  detail: string | null;
  amount: number | null;
  units: number | null;
}

/** One day in the store: its figures, credit, stock movements and activity. */
export interface OpsDaily {
  date: string;
  canViewProfit: boolean;
  metrics: OpsMetrics;
  credit: { creditGiven: number; creditOutstanding: number };
  stock: { receivedUnits: number; receipts: number; adjustments: number };
  timeline: TimelineEvent[];
}

export interface StockHealthRow {
  variantId: string;
  productName: string;
  sku: string;
  uom: string;
  available: number;
  health: 'low' | 'out' | 'healthy';
  imageUrl: string | null;
}

export interface LogEntry {
  id: string;
  action: string;
  changes: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
}

export type NotePriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';
export type NoteStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface StoreNote {
  id: string;
  idd: string;
  title: string;
  description: string | null;
  noteDate: string;
  priority: NotePriority;
  status: NoteStatus;
  reminderAt: string | null;
  reminderSentAt: string | null;
  completedAt: string | null;
  attachmentFileId: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdByName: string | null;
  createdAt: string;
  history?: LogEntry[];
}

export interface NoteList {
  items: StoreNote[];
  total: number;
  page: number;
  limit: number;
  counts: { active: number; completed: number; archived: number; urgent: number };
}

export interface NotePayload {
  title: string;
  description: string;
  noteDate: string;
  priority: NotePriority;
  reminderAt: string | null;
  attachmentFileId: string | null;
}

export type TrendInterval = 'day' | 'week' | 'month';

export interface TrendPoint {
  /** The bucket's first day, YYYY-MM-DD. */
  date: string;
  orders: number;
  sales: number;
  expenses: number;
  grossProfit: number | null;
  netProfit: number | null;
}

export interface SalesBreakdown {
  byPaymentMethod: { method: string; orders: number; sales: number }[];
  byCategory: { categoryId: string; name: string; orders: number; units: number; sales: number; profit: number | null }[];
}

export type SalesGroup = 'none' | 'date' | 'category' | 'product' | 'payment' | 'customer' | 'staff';

export interface SalesOrderRow {
  id: string;
  orderNumber: string;
  orderedAt: string;
  orderStatus: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string;
  staffName: string | null;
  items: number;
  units: number;
  amount: number;
  profit: number | null;
}

export interface SalesGroupRow {
  key: string;
  label: string;
  sub: string | null;
  /** Products only. */
  imageUrl?: string | null;
  orders: number;
  units: number;
  sales: number;
  profit: number | null;
}

export type SalesList =
  | { groupBy: 'none'; canViewProfit: boolean; total: number; items: SalesOrderRow[] }
  | { groupBy: Exclude<SalesGroup, 'none'>; canViewProfit: boolean; total: number; items: SalesGroupRow[] };

export interface DateRange {
  from: string;
  to: string;
}

const base = (storeId: string) => `/stores/${storeId}/operations`;

export const storeOperationsService = {
  overview(storeId: string, range: DateRange): Promise<OpsOverview> {
    return api.get(`${base(storeId)}/overview`, { params: range }).then(res => res.data);
  },
  trend(storeId: string, params: DateRange & { interval: TrendInterval }): Promise<{ canViewProfit: boolean; points: TrendPoint[] }> {
    return api.get(`${base(storeId)}/trend`, { params }).then(res => res.data);
  },
  breakdown(storeId: string, range: DateRange): Promise<SalesBreakdown> {
    return api.get(`${base(storeId)}/sales/breakdown`, { params: range }).then(res => res.data);
  },
  sales(
    storeId: string,
    query: DateRange & { groupBy: SalesGroup; paymentMethod?: string; search?: string; page: number; limit: number },
  ): Promise<SalesList> {
    return api.get(`${base(storeId)}/sales`, { params: query }).then(res => res.data);
  },
  daily(storeId: string, date: string): Promise<OpsDaily> {
    return api.get(`${base(storeId)}/daily`, { params: { date } }).then(res => res.data);
  },
  stockHealth(storeId: string, query: { filter?: string; limit?: number }): Promise<{ items: StockHealthRow[]; total: number }> {
    return api.get(`${base(storeId)}/stock-health`, { params: query }).then(res => res.data);
  },

  // Notes: the shop diary (store-notes:view / create / edit / delete).
  notes(storeId: string, query: { status: NoteStatus; priority?: string; search?: string; page: number; limit: number }): Promise<NoteList> {
    return api.get(`${base(storeId)}/notes`, { params: query }).then(res => res.data);
  },
  note(storeId: string, id: string): Promise<StoreNote> {
    return api.get(`${base(storeId)}/notes/${id}`).then(res => res.data);
  },
  createNote(storeId: string, payload: NotePayload): Promise<StoreNote> {
    return api.post(`${base(storeId)}/notes`, payload).then(res => res.data);
  },
  updateNote(storeId: string, id: string, payload: NotePayload): Promise<StoreNote> {
    return api.patch(`${base(storeId)}/notes/${id}`, payload).then(res => res.data);
  },
  setNoteStatus(storeId: string, id: string, status: NoteStatus): Promise<StoreNote> {
    return api.post(`${base(storeId)}/notes/${id}/status`, { status }).then(res => res.data);
  },
  removeNote(storeId: string, id: string) {
    return api.delete(`${base(storeId)}/notes/${id}`).then(res => res.data);
  },
};

// All Stores: every store a seller owns, combined (GET /reports/multi-store/overview).
export interface ConsolidatedStore {
  store: { id: string; name: string; timezone: string };
  metrics: OpsMetrics;
  previous: OpsMetrics;
  alerts: StockAlerts;
}

export interface ConsolidatedOverview {
  canViewProfit: boolean;
  storeCount: number;
  totals: OpsMetrics | null;
  previousTotals: OpsMetrics | null;
  stores: ConsolidatedStore[];
  alerts: StockAlerts;
}

export const consolidatedService = {
  overview(range: DateRange): Promise<ConsolidatedOverview> {
    // Across every store, so not narrowed to the one picked in the header.
    return api.get('/reports/multi-store/overview', { params: range, headers: { [STORE_HEADER]: '' } }).then(res => res.data);
  },
};
