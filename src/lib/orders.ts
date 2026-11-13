import type { BadgeTone } from '../components/ui/Badge';
import { formatRupees } from './format';
import i18n from '../i18n';

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
  get CREATED() { return i18n.t('common.new'); },
  get CONFIRMED() { return i18n.t('orders.accepted'); },
  get PACKED() { return i18n.t('orders.readyForPickup'); },
  get DELIVERED() { return i18n.t('orders.pickedUp'); },
  get CANCELLED() { return i18n.t('common.cancelled'); },
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
      return { status: 'CONFIRMED', label: i18n.t('orders.acceptOrder') };
    case 'CONFIRMED':
      return { status: 'PACKED', label: i18n.t('orders.markReadyForPickup') };
    case 'PACKED':
      return { status: 'DELIVERED', label: i18n.t('orders.markPickedUp') };
    default:
      return null;
  }
}

export const canCancelPickup = (status: string) => status === 'CREATED' || status === 'CONFIRMED' || status === 'PACKED';

export const PICKUP_STEPS = [
  { status: 'CREATED', get label() { return i18n.t('common.new'); }, get hint() { return i18n.t('orders.placed'); } },
  { status: 'CONFIRMED', get label() { return i18n.t('orders.accepted'); }, get hint() { return i18n.t('orders.beingPrepared'); } },
  { status: 'PACKED', get label() { return i18n.t('common.ready'); }, get hint() { return i18n.t('common.waitingForCustomer'); } },
  { status: 'DELIVERED', get label() { return i18n.t('orders.pickedUp'); }, get hint() { return i18n.t('orders.handedOver'); } },
];

export const ORDER_FILTERS = [
  { value: '', get label() { return i18n.t('common.all'); } },
  { value: 'CREATED', get label() { return i18n.t('common.new'); } },
  { value: 'CONFIRMED', get label() { return i18n.t('orders.accepted'); } },
  { value: 'PACKED', get label() { return i18n.t('common.ready'); } },
  { value: 'DELIVERED', get label() { return i18n.t('orders.pickedUp'); } },
  { value: 'CANCELLED', get label() { return i18n.t('common.cancelled'); } },
];

/** How an order stands on payment, as a short pill. */
export function paymentState(order: OrderRow): { label: string; tone: BadgeTone } {
  const atStore = order.paymentMode === 'COD';
  switch (order.paymentStatus) {
    case 'PAID':
      return { label: atStore ? i18n.t('orders.paidAtStore') : i18n.t('orders.paidOnline'), tone: 'green' };
    case 'PENDING':
      return { label: atStore ? i18n.t('orders.payAtStore') : i18n.t('common.awaitingPayment'), tone: 'amber' };
    case 'PARTIAL':
      return { label: i18n.t('orders.partPaid'), tone: 'amber' };
    case 'CREDIT':
      return { label: i18n.t('common.onCredit'), tone: 'violet' };
    case 'OVERDUE':
      return { label: i18n.t('common.creditOverdue'), tone: 'red' };
    case 'REFUNDED':
      return { label: i18n.t('common.refunded'), tone: 'slate' };
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
  return { amount, label: percent ? i18n.t('orders.percentPercentOff', { percent }) : i18n.t('common.amountOff', { amount: formatRupees(Math.round(amount)) }) };
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
  { value: 'CASH', get label() { return i18n.t('common.cash'); } },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', get label() { return i18n.t('common.card'); } },
  { value: 'BANK_TRANSFER', get label() { return i18n.t('common.bankTransfer'); } },
  { value: 'OTHER', get label() { return i18n.t('common.other'); } },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export const methodLabel = (value: unknown) => PAYMENT_METHODS.find(m => m.value === value)?.label ?? String(value ?? '—');

// Customer Credit reminder channels (the backend's ReminderNotificationType).
export const REMINDER_TYPES = [
  { value: 'IN_APP', label: 'In-App' },
  { value: 'PUSH', get label() { return i18n.t('orders.push'); } },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', get label() { return i18n.t('common.email'); } },
  { value: 'WHATSAPP', label: 'WhatsApp' },
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number]['value'];
