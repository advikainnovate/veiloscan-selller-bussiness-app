// Stock Health and Pending Stock, as the Seller Panel's store-operations
// stock-health-tab and pending-stock-tab.
import type { BadgeTone } from '../components/ui/Badge';
import type { SkuOption, StockHealthRow, StockOrderStatus } from '../services/store-operations-service';
import i18n from '../i18n';

export const HEALTH: Record<StockHealthRow['health'], { label: string; tone: BadgeTone; color: string }> = {
  out: { get label() { return i18n.t('common.outOfStock'); }, tone: 'red', color: '#dc2626' },
  low: { get label() { return i18n.t('inventory.low'); }, tone: 'amber', color: '#b45309' },
  healthy: { get label() { return i18n.t('inventory.healthy'); }, tone: 'green', color: '#0f172a' },
};

export const HEALTH_FILTERS = [
  { value: 'all', get label() { return i18n.t('common.all'); } },
  { value: 'low', get label() { return i18n.t('common.lowStock'); } },
  { value: 'out', get label() { return i18n.t('common.outOfStock'); } },
  { value: 'healthy', get label() { return i18n.t('inventory.healthy'); } },
] as const;
export type HealthFilter = (typeof HEALTH_FILTERS)[number]['value'];

export const STOCK_ORDER_STATUS: Record<StockOrderStatus, { label: string; tone: BadgeTone }> = {
  ORDERED: { get label() { return i18n.t('inventory.ordered'); }, tone: 'slate' },
  IN_TRANSIT: { get label() { return i18n.t('inventory.inTransit'); }, tone: 'blue' },
  PARTIALLY_RECEIVED: { get label() { return i18n.t('inventory.partiallyReceived'); }, tone: 'amber' },
  RECEIVED: { get label() { return i18n.t('inventory.received'); }, tone: 'green' },
  CANCELLED: { get label() { return i18n.t('common.cancelled'); }, tone: 'red' },
};

/** The panel's tabs; `count` is the key in the list's counts. */
export const ORDER_FILTERS: { value: string; label: string; count?: 'open' | 'delayed' | 'received' | 'cancelled' | 'all' }[] = [
  { value: 'open', get label() { return i18n.t('common.open'); }, count: 'open' },
  { value: 'delayed', get label() { return i18n.t('inventory.delayed'); }, count: 'delayed' },
  { value: 'ORDERED', get label() { return i18n.t('inventory.ordered'); } },
  { value: 'IN_TRANSIT', get label() { return i18n.t('inventory.inTransit'); } },
  { value: 'PARTIALLY_RECEIVED', get label() { return i18n.t('inventory.partiallyReceived'); } },
  { value: 'RECEIVED', get label() { return i18n.t('inventory.received'); }, count: 'received' },
  { value: 'CANCELLED', get label() { return i18n.t('common.cancelled'); }, count: 'cancelled' },
  { value: 'all', get label() { return i18n.t('common.all'); }, count: 'all' },
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
  if (!f.warehouseId) return i18n.t('inventory.pickTheWarehouseTheStockGoes');
  if (!f.supplierName.trim()) return i18n.t('inventory.enterTheSupplier');
  if (!lines.length) return i18n.t('inventory.addAtLeastOneProduct');
  if (lines.some(l => !(Number(l.quantity) > 0))) return i18n.t('inventory.enterAQuantityForEveryProduct');
  if (lines.some(l => l.unitCost.trim() !== '' && !(Number(l.unitCost) >= 0))) return i18n.t('inventory.unitCostsMustBe0Or');
  if (f.orderAmount.trim() && !(Number(f.orderAmount) >= 0)) return i18n.t('inventory.theOrderAmountMustBe0');
  if (f.orderDate && f.orderDate > today) return i18n.t('inventory.theOrderDateCanTBe');
  if (f.expectedDate && f.orderDate && f.expectedDate < f.orderDate) return i18n.t('inventory.theExpectedDateCanTBe');
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
  if (!lines.some(([, v]) => Number(v) > 0)) return i18n.t('inventory.enterWhatArrivedForAtLeast');
  for (const [id, v] of lines) {
    const item = items.find(i => i.id === id);
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return i18n.t('inventory.quantitiesMustBe0OrMore');
    if (item && n > item.pendingQty) return i18n.t('inventory.productnameOnlyPendingqtyIsStillPending', { productName: item.productName, pendingQty: qty(item.pendingQty) });
  }
  return null;
}

export const receiptLines = (receiving: Record<string, string>) =>
  Object.entries(receiving)
    .map(([itemId, v]) => ({ itemId, quantity: Number(v) }))
    .filter(l => l.quantity > 0);
