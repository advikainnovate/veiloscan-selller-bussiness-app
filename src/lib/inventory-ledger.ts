// The Inventory Ledger page's rules: which way an entry moved stock, and the
// list's filters (as the Seller Panel's inventory-ledger-page, plus search).
import type { LedgerRow } from '../services/inventory-ledger-service';

export type Direction = 'in' | 'out' | 'hold';

/** In / out by what it did to on hand; entries that only reserve or block stock are holds. */
export function direction(e: Pick<LedgerRow, 'onHandDelta' | 'reservedDelta' | 'blockedDelta' | 'legacyQuantity' | 'type'>): Direction {
  if (e.onHandDelta) return e.onHandDelta > 0 ? 'in' : 'out';
  if (e.reservedDelta || e.blockedDelta) return 'hold';
  // Older entries kept only a quantity.
  return /SALE|DAMAGE|OUT|RESERVE|WRITE_OFF|PURCHASE_RETURN/.test(e.type) ? 'out' : 'in';
}

export interface LedgerFilters {
  search: string;
  direction: string;
  type: string;
  warehouse: string;
}

export function filterLedger(rows: LedgerRow[], f: LedgerFilters) {
  const q = f.search.trim().toLowerCase();
  return rows.filter(e => {
    if (f.direction && direction(e) !== f.direction) return false;
    if (f.type && e.type !== f.type) return false;
    if (f.warehouse && e.warehouseTitle !== f.warehouse) return false;
    return !q || [e.productName, e.sku, e.referenceId, e.notes, e.reason, e.lotNumber, e.batchNumber].some(v => v && v.toLowerCase().includes(q));
  });
}

/** "12 PCS", or the old entries' bare quantity. */
export function enteredLabel(e: LedgerRow, format: (v: number) => string) {
  if (e.enteredQuantity !== null && e.enteredQuantity !== undefined) return `${format(e.enteredQuantity)}${e.enteredUom ? ` ${e.enteredUom}` : ''}`;
  return e.legacyQuantity !== undefined && e.legacyQuantity !== null ? format(Number(e.legacyQuantity)) : '—';
}

/** "purchase order: PO-12", from the reference type and id. */
export function referenceLabel(e: LedgerRow) {
  if (!e.referenceId) return null;
  return e.referenceType ? `${e.referenceType.replace(/_/g, ' ').toLowerCase()}: ${e.referenceId}` : e.referenceId;
}
