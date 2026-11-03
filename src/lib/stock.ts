// Inventory labels, units and the stock-operation rules, as on the Seller
// Panel (src/lib/inventory.ts and inventory-operation-modal.tsx).
import type { BadgeTone } from '../components/ui/Badge';
import type { StockBalance, StockStatus } from '../services/stock-service';
import { formatQuantity } from './inventory';

export const STOCK_STATUS: Record<StockStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'In stock', tone: 'green' },
  LOW_STOCK: { label: 'Low stock', tone: 'amber' },
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'red' },
  BLOCKED: { label: 'Blocked', tone: 'violet' },
  DISCONTINUED: { label: 'Discontinued', tone: 'slate' },
};
export const stockStatus = (s: string) => STOCK_STATUS[s as StockStatus] ?? STOCK_STATUS.ACTIVE;

const MOVEMENT_LABELS: Record<string, string> = {
  OPENING_STOCK: 'Opening stock',
  PURCHASE_RECEIPT: 'Purchase receipt',
  RESERVATION: 'Reserved',
  RESERVATION_RELEASE: 'Reservation released',
  SALE: 'Sale (fulfilled)',
  CUSTOMER_RETURN: 'Customer return',
  PURCHASE_RETURN: 'Purchase return',
  DAMAGE: 'Damaged / blocked',
  DAMAGE_RECOVERY: 'Unblocked',
  WRITE_OFF: 'Written off',
  ADJUSTMENT_IN: 'Adjustment in',
  ADJUSTMENT_OUT: 'Adjustment out',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
  PURCHASE: 'Purchase (old)',
  RETURN: 'Return (old)',
  ADJUSTMENT: 'Adjustment (old)',
  RESERVE: 'Reserve (old)',
  RELEASE: 'Release (old)',
  STOCK_TAKE: 'Stock take (old)',
};

/** Every movement type, for a filter. */
export const MOVEMENT_TYPES = Object.keys(MOVEMENT_LABELS);

export const movementLabel = (type: string) => (MOVEMENT_LABELS[type] ?? type.replace(/_/g, ' ').toLowerCase()).replace(/\b\w/g, c => c.toUpperCase());

/** Tint per kind of movement: in, sale, hold, adjust, damage, move, return, out. */
const TONE = {
  in: ['#ecfdf5', '#047857'],
  sale: ['#fff7ed', '#ea580c'],
  hold: ['#f1f5f9', '#334155'],
  adjust: ['#f5f3ff', '#6d28d9'],
  damage: ['#fef2f2', '#dc2626'],
  move: ['#f0f9ff', '#0369a1'],
  ret: ['#fffbeb', '#b45309'],
  out: ['#fff1f2', '#e11d48'],
} as const;
const MOVEMENT_TONE: Record<string, keyof typeof TONE> = {
  PURCHASE_RECEIPT: 'in',
  OPENING_STOCK: 'in',
  PURCHASE: 'in',
  SALE: 'sale',
  RESERVATION: 'hold',
  RESERVE: 'hold',
  RESERVATION_RELEASE: 'hold',
  RELEASE: 'hold',
  DAMAGE: 'damage',
  WRITE_OFF: 'damage',
  TRANSFER_IN: 'move',
  TRANSFER_OUT: 'move',
  CUSTOMER_RETURN: 'ret',
  RETURN: 'ret',
  PURCHASE_RETURN: 'out',
};
export const movementTone = (type: string) => TONE[MOVEMENT_TONE[type] ?? 'adjust'];

export const LEDGER_GROUPS: { value: string; label: string }[] = [
  { value: '', label: 'All Movements' },
  { value: 'receipts', label: 'Receipts' },
  { value: 'sales', label: 'Sales' },
  { value: 'reservations', label: 'Reservations' },
  { value: 'adjustments', label: 'Adjustments & Counts' },
  { value: 'damage', label: 'Damage & Write-offs' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'returns', label: 'Returns' },
];

type Units = Pick<StockBalance, 'baseUom' | 'salesUom' | 'salesFactor'>;
const inSales = (u: Units) => u.salesUom !== u.baseUom && !!u.salesFactor;

/** A base quantity in the sales unit ("35 KG"), or the base unit when they're the same. */
export function formatQty(base: number | null | undefined, units: Units): string {
  if (base === null || base === undefined) return '—';
  if (!inSales(units)) return `${formatQuantity(base)} ${units.baseUom}`;
  return `${formatQuantity(base / units.salesFactor)} ${units.salesUom}`;
}

/** The base quantity, when it differs from the sales unit ("35,000 GM"). */
export function baseHint(base: number | null | undefined, units: Units): string | null {
  if (base === null || base === undefined || !inSales(units)) return null;
  return `${formatQuantity(base)} ${units.baseUom}`;
}

/** +5 / −2.5, or — for nothing. */
export function signed(v: number | null | undefined) {
  if (!v) return '—';
  return `${v > 0 ? '+' : '−'}${formatQuantity(Math.abs(v))}`;
}

/** How far a ledger entry moved stock, signed by which way. */
export function moved(e: { enteredQuantity: number | null; baseQuantity: number | null; onHandDelta: number | null; reservedDelta: number | null; blockedDelta: number | null }) {
  const qty = e.enteredQuantity ?? e.baseQuantity;
  if (qty === null) return null;
  const sign = e.onHandDelta ? Math.sign(e.onHandDelta) : e.reservedDelta ? Math.sign(e.reservedDelta) : e.blockedDelta ? Math.sign(e.blockedDelta) : 1;
  return sign * Math.abs(qty);
}

/** Units to reorder to reach the minimum (the server's suggestion when it has one). */
export const reorderQty = (r: StockBalance) => Math.max(0, r.suggestedReorder ?? r.minimum - r.available);

const ORDER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'slate' },
  CONFIRMED: { label: 'Confirmed', tone: 'blue' },
  ACCEPTED: { label: 'Confirmed', tone: 'blue' },
  PROCESSING: { label: 'Processing', tone: 'amber' },
  PACKED: { label: 'Packing', tone: 'violet' },
  PACKING: { label: 'Packing', tone: 'violet' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', tone: 'green' },
  SHIPPED: { label: 'Shipped', tone: 'blue' },
};
export const reservationOrderStatus = (s: string | null | undefined) =>
  ORDER_STATUS[s ?? ''] ?? { label: s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) : 'Open', tone: 'slate' as BadgeTone };

/** "3 hours" / "2 days" since `from`. */
export function heldFor(from: string, now: number) {
  const h = Math.floor((now - new Date(from).getTime()) / 3600000);
  if (h < 1) return 'Under an hour';
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

export type StockOperation = 'receive' | 'adjust' | 'block' | 'transfer' | 'return' | 'levels';

export const OPERATION_TITLES: Record<StockOperation, string> = {
  receive: 'Receive stock',
  adjust: 'Count / adjust stock',
  block: 'Damaged / blocked stock',
  transfer: 'Transfer to another warehouse',
  return: 'Return',
  levels: 'Stock levels',
};

/** The panel's checks before an operation is sent; null when it can be. */
export function operationProblem(
  op: StockOperation,
  v: { quantity: string; mode: string; reason: string; variantId?: string; warehouseId?: string; toWarehouseId?: string; minimum?: string; maximum?: string; reorder?: string },
): string | null {
  if (op === 'levels') {
    const nums = [v.minimum, v.maximum, v.reorder].filter(x => x && x.trim() !== '');
    if (nums.some(x => !(Number(x) >= 0))) return 'Levels must be 0 or more';
    if (v.maximum?.trim() && v.minimum?.trim() && Number(v.maximum) < Number(v.minimum)) return "The maximum can't be below the minimum";
    return null;
  }
  const q = Number(v.quantity);
  const countToZero = op === 'adjust' && v.mode === 'COUNT' && v.quantity.trim() !== '' && q >= 0;
  if (!(q > 0 || countToZero)) return 'Enter a quantity';
  if ((op === 'adjust' || op === 'block' || op === 'return') && !v.reason.trim()) return "Enter a reason — it's kept in the ledger";
  if (op === 'receive' && (!v.variantId || !v.warehouseId)) return 'Pick the SKU and the warehouse';
  if (op === 'transfer' && !v.toWarehouseId) return 'Pick the warehouse to transfer to';
  return null;
}
