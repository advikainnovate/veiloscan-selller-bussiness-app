import { api } from '../lib/api';
import type { LedgerEntry } from './stock-service';

// Inventory Ledger (eshop-backend src/modules/inventory-transactions,
// /inventory-transactions): the append-only stock ledger, newest first, at
// most 1000 entries. Entries are written by stock operations and orders only.
// Needs inventory-transactions:manage.

export interface LedgerRow extends LedgerEntry {
  idd?: string;
  inventoryId: string | null;
  referenceType: string | null;
  orderId: string | null;
  baseUom: string | null;
  unitCost: number | null;
  totalCost: number | null;
  lotNumber: string | null;
  batchNumber: string | null;
  productName: string | null;
  sku: string | null;
  warehouseTitle: string | null;
}

export const inventoryLedgerService = {
  list: (filters: { productId?: string; warehouseId?: string } = {}) =>
    api.get<LedgerRow[]>('/inventory-transactions', { params: filters }).then(r => (Array.isArray(r.data) ? r.data : [])),
};
