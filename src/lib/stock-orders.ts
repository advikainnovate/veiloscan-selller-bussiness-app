// Stock Health and Pending Stock, as the Seller Panel's store-operations
// stock-health-tab and pending-stock-tab.
import type { BadgeTone } from '../components/ui/Badge';
import type { SkuOption, StockHealthRow, StockOrderStatus } from '../services/store-operations-service';

export const HEALTH: Record<StockHealthRow['health'], { label: string; tone: BadgeTone; color: string }> = {
  out: { label: 'Out of Stock', tone: 'red', color: '#dc2626' },
  low: { label: 'Low', tone: 'amber', color: '#b45309' },
  healthy: { label: 'Healthy', tone: 'green', color: '#0f172a' },
};

export const HEALTH_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low Stock' },
  { value: 'out', label: 'Out of Stock' },
  { value: 'healthy', label: 'Healthy' },
] as const;
export type HealthFilter = (typeof HEALTH_FILTERS)[number]['value'];

export const STOCK_ORDER_STATUS: Record<StockOrderStatus, { label: string; tone: BadgeTone }> = {
  ORDERED: { label: 'Ordered', tone: 'slate' },
  IN_TRANSIT: { label: 'In Transit', tone: 'blue' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', tone: 'amber' },
  RECEIVED: { label: 'Received', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'red' },
};

/** The panel's tabs; `count` is the key in the list's counts. */
export const ORDER_FILTERS: { value: string; label: string; count?: 'open' | 'delayed' | 'received' | 'cancelled' | 'all' }[] = [
  { value: 'open', label: 'Open', count: 'open' },
  { value: 'delayed', label: 'Delayed', count: 'delayed' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { value: 'RECEIVED', label: 'Received', count: 'received' },
  { value: 'CANCELLED', label: 'Cancelled', count: 'cancelled' },
  { value: 'all', label: 'All', count: 'all' },
];

export const OPEN_STATUSES: StockOrderStatus[] = ['ORDERED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'];

/** "Red · XL" from a variant's combination. */
export const variantLabel = (c: Record<string, string> | null | undefined) => (c ? Object.values(c).filter(Boolean).join(' · ') : '');

/** Quantities: whole numbers plain, else up to 3 decimals. */
export const qty = (n: number | null | undefined) => (n == null ? '—' : Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { maximumFractionDigits: 3 }));

export interface OrderLine {
  sku: SkuOption;
  quantity: string;
  unitCost: string;
}

export const lineFrom = (sku: SkuOption): OrderLine => ({ sku, quantity: '', unitCost: sku.costPrice !== null ? String(sku.costPrice) : '' });

/** Quantity × unit cost across the lines. */
export const linesTotal = (lines: OrderLine[]) => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

export interface StockOrderForm {
  warehouseId: string;
  supplierName: string;
  supplierPhone: string;
  referenceNumber: string;
  orderDate: string;
  expectedDate: string;
  orderAmount: string;
  notes: string;
}

/** The panel's checks, plus amounts that read as numbers and dates in order. */
export function stockOrderProblem(f: StockOrderForm, lines: OrderLine[], today: string): string | null {
  if (!f.warehouseId) return 'Pick the warehouse the stock goes to';
  if (!f.supplierName.trim()) return 'Enter the supplier';
  if (!lines.length) return 'Add at least one product';
  if (lines.some(l => !(Number(l.quantity) > 0))) return 'Enter a quantity for every product';
  if (lines.some(l => l.unitCost.trim() !== '' && !(Number(l.unitCost) >= 0))) return 'Unit costs must be 0 or more';
  if (f.orderAmount.trim() && !(Number(f.orderAmount) >= 0)) return 'The order amount must be 0 or more';
  if (f.orderDate && f.orderDate > today) return "The order date can't be in the future";
  if (f.expectedDate && f.orderDate && f.expectedDate < f.orderDate) return "The expected date can't be before the order date";
  return null;
}

export function stockOrderPayload(f: StockOrderForm, lines: OrderLine[]) {
  return {
    warehouseId: f.warehouseId,
    supplierName: f.supplierName.trim(),
    supplierPhone: f.supplierPhone.trim() || undefined,
    referenceNumber: f.referenceNumber.trim() || undefined,
    orderDate: f.orderDate || undefined,
    expectedDate: f.expectedDate || undefined,
    orderAmount: f.orderAmount ? Number(f.orderAmount) : undefined,
    notes: f.notes.trim() || undefined,
    items: lines.map(l => ({ productVariantId: l.sku.id, quantity: Number(l.quantity), unitCost: l.unitCost ? Number(l.unitCost) : undefined })),
  };
}

/** What arrived, per item: never more than is still pending. */
export function receiptProblem(receiving: Record<string, string>, items: { id: string; productName: string; pendingQty: number }[]): string | null {
  const lines = Object.entries(receiving).filter(([, v]) => v.trim() !== '');
  if (!lines.some(([, v]) => Number(v) > 0)) return 'Enter what arrived for at least one product';
  for (const [id, v] of lines) {
    const item = items.find(i => i.id === id);
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return 'Quantities must be 0 or more';
    if (item && n > item.pendingQty) return `${item.productName}: only ${qty(item.pendingQty)} is still pending`;
  }
  return null;
}

export const receiptLines = (receiving: Record<string, string>) =>
  Object.entries(receiving)
    .map(([itemId, v]) => ({ itemId, quantity: Number(v) }))
    .filter(l => l.quantity > 0);
