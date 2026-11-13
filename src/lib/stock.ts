// Inventory labels, units and the stock-operation rules, as on the Seller
// Panel (src/lib/inventory.ts and inventory-operation-modal.tsx).
import type { BadgeTone } from '../components/ui/Badge';
import type { StockBalance, StockStatus } from '../services/stock-service';
import { formatQuantity } from './inventory';
import i18n from '../i18n';

export const STOCK_STATUS: Record<StockStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { get label() { return i18n.t('common.inStock'); }, tone: 'green' },
  LOW_STOCK: { get label() { return i18n.t('common.lowStock2'); }, tone: 'amber' },
  OUT_OF_STOCK: { get label() { return i18n.t('common.outOfStock2'); }, tone: 'red' },
  BLOCKED: { get label() { return i18n.t('common.blocked'); }, tone: 'violet' },
  DISCONTINUED: { get label() { return i18n.t('inventory.discontinued'); }, tone: 'slate' },
};
export const stockStatus = (s: string) => STOCK_STATUS[s as StockStatus] ?? STOCK_STATUS.ACTIVE;

const MOVEMENT_LABELS: Record<string, string> = {
  get OPENING_STOCK() { return i18n.t('common.openingStock'); },
  get PURCHASE_RECEIPT() { return i18n.t('inventory.purchaseReceipt'); },
  get RESERVATION() { return i18n.t('common.reserved'); },
  get RESERVATION_RELEASE() { return i18n.t('inventory.reservationReleased'); },
  get SALE() { return i18n.t('inventory.saleFulfilled'); },
  get CUSTOMER_RETURN() { return i18n.t('inventory.customerReturn'); },
  get PURCHASE_RETURN() { return i18n.t('inventory.purchaseReturn'); },
  get DAMAGE() { return i18n.t('inventory.damagedBlocked'); },
  get DAMAGE_RECOVERY() { return i18n.t('inventory.unblocked'); },
  get WRITE_OFF() { return i18n.t('inventory.writtenOff'); },
  get ADJUSTMENT_IN() { return i18n.t('inventory.adjustmentIn'); },
  get ADJUSTMENT_OUT() { return i18n.t('inventory.adjustmentOut'); },
  get TRANSFER_IN() { return i18n.t('inventory.transferIn'); },
  get TRANSFER_OUT() { return i18n.t('inventory.transferOut'); },
  get PURCHASE() { return i18n.t('inventory.purchaseOld'); },
  get RETURN() { return i18n.t('inventory.returnOld'); },
  get ADJUSTMENT() { return i18n.t('inventory.adjustmentOld'); },
  get RESERVE() { return i18n.t('inventory.reserveOld'); },
  get RELEASE() { return i18n.t('inventory.releaseOld'); },
  get STOCK_TAKE() { return i18n.t('inventory.stockTakeOld'); },
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
  { value: '', get label() { return i18n.t('inventory.allMovements'); } },
  { value: 'receipts', get label() { return i18n.t('inventory.receipts'); } },
  { value: 'sales', get label() { return i18n.t('common.sales'); } },
  { value: 'reservations', get label() { return i18n.t('common.reservations'); } },
  { value: 'adjustments', get label() { return i18n.t('inventory.adjustmentsAndCounts'); } },
  { value: 'damage', get label() { return i18n.t('inventory.damageAndWriteOffs'); } },
  { value: 'transfers', get label() { return i18n.t('inventory.transfers'); } },
  { value: 'returns', get label() { return i18n.t('common.returns'); } },
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
  PENDING: { get label() { return i18n.t('common.pending'); }, tone: 'slate' },
  CONFIRMED: { get label() { return i18n.t('common.confirmed'); }, tone: 'blue' },
  ACCEPTED: { get label() { return i18n.t('common.confirmed'); }, tone: 'blue' },
  PROCESSING: { get label() { return i18n.t('common.processing'); }, tone: 'amber' },
  PACKED: { get label() { return i18n.t('inventory.packing'); }, tone: 'violet' },
  PACKING: { get label() { return i18n.t('inventory.packing'); }, tone: 'violet' },
  READY_FOR_PICKUP: { get label() { return i18n.t('inventory.readyForPickup'); }, tone: 'green' },
  SHIPPED: { get label() { return i18n.t('common.shipped'); }, tone: 'blue' },
};
export const reservationOrderStatus = (s: string | null | undefined) =>
  ORDER_STATUS[s ?? ''] ?? { label: s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) : i18n.t('common.open'), tone: 'slate' as BadgeTone };

/** "3 hours" / "2 days" since `from`. */
export function heldFor(from: string, now: number) {
  const h = Math.floor((now - new Date(from).getTime()) / 3600000);
  if (h < 1) return i18n.t('inventory.underAnHour');
  if (h < 24) return i18n.t('common.hourCount', { count: h });
  const d = Math.floor(h / 24);
  return i18n.t('common.dayCount', { count: d });
}

export type StockOperation = 'receive' | 'adjust' | 'block' | 'transfer' | 'return' | 'levels';

export const OPERATION_TITLES: Record<StockOperation, string> = {
  get receive() { return i18n.t('inventory.receiveStock'); },
  get adjust() { return i18n.t('inventory.countAdjustStock'); },
  get block() { return i18n.t('inventory.damagedBlockedStock'); },
  get transfer() { return i18n.t('inventory.transferToAnotherWarehouse'); },
  get return() { return i18n.t('common.return'); },
  get levels() { return i18n.t('inventory.stockLevels'); },
};

/** The panel's checks before an operation is sent; null when it can be. */
export function operationProblem(
  op: StockOperation,
  v: { quantity: string; mode: string; reason: string; variantId?: string; warehouseId?: string; toWarehouseId?: string; minimum?: string; maximum?: string; reorder?: string },
): string | null {
  if (op === 'levels') {
    const nums = [v.minimum, v.maximum, v.reorder].filter(x => x && x.trim() !== '');
    if (nums.some(x => !(Number(x) >= 0))) return i18n.t('inventory.levelsMustBe0OrMore');
    if (v.maximum?.trim() && v.minimum?.trim() && Number(v.maximum) < Number(v.minimum)) return i18n.t('inventory.theMaximumCanTBeBelow');
    return null;
  }
  const q = Number(v.quantity);
  const countToZero = op === 'adjust' && v.mode === 'COUNT' && v.quantity.trim() !== '' && q >= 0;
  if (!(q > 0 || countToZero)) return i18n.t('inventory.enterAQuantity');
  if ((op === 'adjust' || op === 'block' || op === 'return') && !v.reason.trim()) return i18n.t('inventory.enterAReasonItsKeptIn');
  if (op === 'receive' && (!v.variantId || !v.warehouseId)) return i18n.t('inventory.pickTheSkuAndTheWarehouse');
  if (op === 'transfer' && !v.toWarehouseId) return i18n.t('inventory.pickTheWarehouseToTransferTo');
  return null;
}
