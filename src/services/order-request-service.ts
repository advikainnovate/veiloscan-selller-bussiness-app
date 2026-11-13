// Ported from the Seller Panel's src/services/order-request-service.ts.
import { api } from '../lib/api';
import type { BadgeTone } from '../components/ui/Badge';
import type {
  CatalogItem,
  CreateSellerOrderPayload,
  SellerOrderResult,
} from './seller-order-service';
import i18n from '../i18n';

// Order requests customers send to ORDER_REQUEST stores (eshop-backend
// /order-requests): a list of products without prices, which the store
// reviews and bills as a normal order.

export type OrderRequestStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface OrderRequestRow {
  id: string;
  requestNumber: string;
  status: OrderRequestStatus;
  storeId: string;
  storeName: string;
  customerName: string;
  customerMobile: string;
  customerNote: string | null;
  itemCount: number;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
  statusUpdatedAt: string;
}

export interface OrderRequestList {
  items: OrderRequestRow[];
  total: number;
  page: number;
  limit: number;
  counts: Record<OrderRequestStatus, number>;
}

export interface OrderRequestItem {
  id: string;
  productId: string;
  productSlug: string | null;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  sku: string | null;
  imageUrl: string | null;
  // In `uom` (2 PCS, 1.5 KG).
  quantity: number;
  uom: string;
  // The same amount in the SKU's selling unit (what orders and stock use).
  sellingQuantity: number;
  sellingUom: string;
  // Current price, stock and tax; null when the SKU can't be sold now (no price set, inactive…).
  catalogItem: CatalogItem | null;
}

export interface OrderRequestDetail {
  id: string;
  requestNumber: string;
  status: OrderRequestStatus;
  statusNote: string | null;
  createdAt: string;
  statusUpdatedAt: string;
  store: { id: string; name: string; code: string };
  customer: {
    id: string | null;
    name: string;
    countryCode: string;
    mobile: string;
    email: string | null;
    address: string | null;
    note: string | null;
  };
  items: OrderRequestItem[];
  // The final bill: the order it was billed as.
  bill: {
    orderId: string;
    orderNumber: string | null;
    totalAmount: number | null;
    orderStatus: string | null;
  } | null;
  // Where the status may go next.
  nextStatuses: OrderRequestStatus[];
  // Items can still change and a bill can be generated.
  canEdit: boolean;
}

export const orderRequestService = {
  list(
    params: {
      status?: OrderRequestStatus;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<OrderRequestList> {
    return api.get('/order-requests', { params }).then(res => res.data);
  },
  get(id: string): Promise<OrderRequestDetail> {
    return api.get(`/order-requests/${id}`).then(res => res.data);
  },
  updateStatus(
    id: string,
    status: OrderRequestStatus,
    note?: string,
  ): Promise<OrderRequestDetail> {
    return api
      .patch(`/order-requests/${id}/status`, {
        status,
        ...(note ? { note } : {}),
      })
      .then(res => res.data);
  },
  // `quantity` in `uom`; without a unit, the SKU's selling unit.
  updateItems(
    id: string,
    items: {
      productId: string;
      variantId: string;
      quantity: number;
      uom?: string;
    }[],
  ): Promise<OrderRequestDetail> {
    return api
      .put(`/order-requests/${id}/items`, { items })
      .then(res => res.data);
  },
  // The final bill: the request placed as an order for the customer, with its payment.
  bill(
    id: string,
    payload: CreateSellerOrderPayload,
  ): Promise<SellerOrderResult & { requestId: string }> {
    return api
      .post(`/order-requests/${id}/bill`, payload)
      .then(res => res.data);
  },
};


export const ORDER_REQUEST_STATUSES: {
  value: OrderRequestStatus;
  label: string;
  badge: string;
  tone: BadgeTone;
}[] = [
  { value: 'REQUESTED', get label() { return i18n.t('common.new'); }, badge: 'PENDING', tone: 'amber' },
  {
    value: 'UNDER_REVIEW',
    get label() { return i18n.t('common.underReview'); },
    badge: 'IN_PROGRESS',
    tone: 'blue',
  },
  { value: 'CONFIRMED', get label() { return i18n.t('common.confirmed'); }, badge: 'DRAFT', tone: 'violet' },
  { value: 'COMPLETED', get label() { return i18n.t('common.completed'); }, badge: 'COMPLETED', tone: 'green' },
  { value: 'REJECTED', get label() { return i18n.t('common.rejected'); }, badge: 'REJECTED', tone: 'red' },
  { value: 'CANCELLED', get label() { return i18n.t('common.cancelled'); }, badge: 'CLOSED', tone: 'slate' },
];

export function requestStatusLabel(status: OrderRequestStatus): string {
  return ORDER_REQUEST_STATUSES.find(s => s.value === status)?.label ?? status;
}

export function requestStatusBadge(status: OrderRequestStatus): string {
  return (
    ORDER_REQUEST_STATUSES.find(s => s.value === status)?.badge ?? 'DEFAULT'
  );
}

/** "× 2" for pieces, "1.5 KG" / "× 2 BOX" otherwise. */
export function requestQuantityLabel(item: {
  quantity: number;
  uom: string;
}): string {
  const quantity = Math.round(item.quantity * 10000) / 10000;
  if (item.uom === 'PCS') return `× ${quantity}`;
  return Number.isInteger(quantity)
    ? `× ${quantity} ${item.uom}`
    : `${quantity} ${item.uom}`;
}

export function requestStatusTone(status: OrderRequestStatus): BadgeTone {
  return ORDER_REQUEST_STATUSES.find(s => s.value === status)?.tone ?? 'slate';
}
