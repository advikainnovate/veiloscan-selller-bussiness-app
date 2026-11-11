import type { BadgeTone } from '../components/ui/Badge';
import { formatRupees } from './format';

// Ported from the Seller Panel's src/lib/order-status.ts and orders list.
// Storefront pickup orders reuse the backend's order statuses:
// CREATED → CONFIRMED → PACKED → DELIVERED, or CANCELLED.

export interface OrderRow {
  id: string;
  uniqueOrderId: string;
  orderStatus: string;
  orderStatusTimestamp?: string | null;
  fulfillmentType?: 'PICKUP' | 'DELIVERY' | string | null;
  orderType?: string | null;
  paymentStatus?: string | null;
  paymentMode?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: unknown;
  customerNote?: string | null;
  /** The seller's internal note on the order. */
  remarks?: string | null;
  totalAmount?: number | string | null;
  /** A seller's share of a multi-seller order. */
  clientAmount?: number | string | null;
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  discountAmount?: number | string | null;
  couponDiscount?: number | string | null;
  orderDiscountType?: string | null;
  orderDiscountValue?: number | string | null;
  orderDiscountAmount?: number | string | null;
  cancellationReason?: string | null;
  store?: { name?: string } | null;
  createdAt?: string | null;
  items?: OrderItem[];
  payments?: { method: string; amount: number }[];
  creditOutstanding?: number | string | null;
}

export interface OrderItem {
  id: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number | string;
  finalPrice: number | string;
  imageUrl: string | null;
  // VARIABLE lines are quantity 1 with the measured amount (1.5 KG) here.
  sellingMethod?: string;
  soldQuantity?: number | null;
  soldUom?: string | null;
}

export const isPickupOrder = (order: Pick<OrderRow, 'fulfillmentType'>) => order.fulfillmentType === 'PICKUP';
export const isQuickSale = (order: Pick<OrderRow, 'orderType'>) => order.orderType === 'QUICK_SALE';
export const isMeasured = (item: OrderItem) => item.sellingMethod === 'VARIABLE' && item.soldQuantity != null && !!item.soldUom;

/** The amount that belongs to the seller: their share, or the whole order. */
export const orderAmount = (order: OrderRow) => Number(order.clientAmount ?? order.totalAmount) || 0;

const PICKUP_LABELS: Record<string, string> = {
  CREATED: 'New',
  CONFIRMED: 'Accepted',
  PACKED: 'Ready for pickup',
  DELIVERED: 'Picked up',
  CANCELLED: 'Cancelled',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  CREATED: 'amber',
  CONFIRMED: 'blue',
  PACKED: 'violet',
  READY_TO_SHIP: 'violet',
  SHIPPED: 'blue',
  OUT_FOR_DELIVERY: 'blue',
  DELIVERED: 'green',
  CANCELLED: 'red',
  RETURN_REQUESTED: 'orange',
  RETURNED: 'red',
  REPLACED: 'slate',
};

export function orderStatusLabel(order: Pick<OrderRow, 'orderStatus' | 'fulfillmentType'>) {
  const status = String(order.orderStatus ?? '');
  if (isPickupOrder(order)) return PICKUP_LABELS[status] ?? status;
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

export const orderStatusTone = (status: string): BadgeTone => STATUS_TONES[status] ?? 'slate';

export interface OrderAction {
  status: string;
  label: string;
}

/** The next step for a pickup order (cancel is offered separately until it's picked up). */
export function nextPickupAction(status: string): OrderAction | null {
  switch (status) {
    case 'CREATED':
      return { status: 'CONFIRMED', label: 'Accept order' };
    case 'CONFIRMED':
      return { status: 'PACKED', label: 'Mark ready for pickup' };
    case 'PACKED':
      return { status: 'DELIVERED', label: 'Mark picked up' };
    default:
      return null;
  }
}

export const canCancelPickup = (status: string) => status === 'CREATED' || status === 'CONFIRMED' || status === 'PACKED';

export const PICKUP_STEPS = [
  { status: 'CREATED', label: 'New', hint: 'Placed' },
  { status: 'CONFIRMED', label: 'Accepted', hint: 'Being prepared' },
  { status: 'PACKED', label: 'Ready', hint: 'Waiting for customer' },
  { status: 'DELIVERED', label: 'Picked up', hint: 'Handed over' },
];

export const ORDER_FILTERS = [
  { value: '', label: 'All' },
  { value: 'CREATED', label: 'New' },
  { value: 'CONFIRMED', label: 'Accepted' },
  { value: 'PACKED', label: 'Ready' },
  { value: 'DELIVERED', label: 'Picked up' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** How an order stands on payment, as a short pill. */
export function paymentState(order: OrderRow): { label: string; tone: BadgeTone } {
  const atStore = order.paymentMode === 'COD';
  switch (order.paymentStatus) {
    case 'PAID':
      return { label: atStore ? 'Paid at store' : 'Paid online', tone: 'green' };
    case 'PENDING':
      return { label: atStore ? 'Pay at store' : 'Awaiting payment', tone: 'amber' };
    case 'PARTIAL':
      return { label: 'Part paid', tone: 'amber' };
    case 'CREDIT':
      return { label: 'On credit', tone: 'violet' };
    case 'OVERDUE':
      return { label: 'Credit overdue', tone: 'red' };
    case 'REFUNDED':
      return { label: 'Refunded', tone: 'slate' };
    default:
      return { label: String(order.paymentStatus ?? '—').replace(/_/g, ' ').toLowerCase(), tone: 'slate' };
  }
}

/**
 * The discount on an order (item discounts, the seller's order discount and
 * the coupon), with a short label: "20% off", "₹500 off". Null when none.
 */
export function orderDiscountInfo(order: OrderRow): { amount: number; label: string } | null {
  const amount = Math.round(((Number(order.discountAmount) || 0) + (Number(order.couponDiscount) || 0)) * 100) / 100;
  if (amount <= 0) return null;
  const percent =
    order.orderDiscountType === 'PERCENTAGE' && Number(order.orderDiscountAmount) > 0 ? Number(order.orderDiscountValue) : null;
  return { amount, label: percent ? `${percent}% off` : `${formatRupees(Math.round(amount))} off` };
}

/** One line of a customer address, from whatever shape the API sent. */
export function addressText(address: unknown): string | null {
  if (!address) return null;
  if (typeof address === 'string') return address;
  const a = address as Record<string, unknown>;
  const parts = [a.addressLine1, a.addressLine2, a.landmark, a.city, a.state, a.pincode ?? a.postalCode]
    .map(v => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export const methodLabel = (value: unknown) => PAYMENT_METHODS.find(m => m.value === value)?.label ?? String(value ?? '—');

// Customer Credit reminder channels (the backend's ReminderNotificationType).
export const REMINDER_TYPES = [
  { value: 'IN_APP', label: 'In-App' },
  { value: 'PUSH', label: 'Push' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number]['value'];
