import { api } from '../lib/api';
import type { StockType } from './products-service';

// Inventory (eshop-backend src/modules/product-inventory, /inventory), as the
// Seller Panel's inventory-service. Quantities are in each SKU's base unit;
// `salesFactor` base units make one sales unit. Needs product-inventory:manage.

export type StockStatus = 'ACTIVE' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'BLOCKED' | 'DISCONTINUED';

export interface StockBalance {
  id: string;
  idd: string;
  productId: string;
  productName: string;
  productVariantId: string;
  sku: string;
  variantLabel: string;
  warehouseId: string;
  warehouseTitle: string;
  stockType: StockType;
  baseUom: string;
  salesUom: string;
  salesFactor: number;
  tracksLots: boolean;
  trackExpiry: boolean;
  trackBatch: boolean;
  trackLot: boolean;
  onHand: number;
  reserved: number;
  blocked: number;
  available: number;
  minimum: number;
  maximum: number | null;
  reorder: number;
  stockStatus: StockStatus;
  updatedAt: string;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  /** Cost per base unit (the SKU's cost price). */
  costPrice?: number | null;
  suggestedReorder?: number | null;
}

export interface LedgerEntry {
  id: string;
  type: string;
  referenceId: string | null;
  enteredQuantity: number | null;
  enteredUom: string | null;
  baseQuantity: number | null;
  onHandDelta: number | null;
  reservedDelta: number | null;
  blockedDelta: number | null;
  onHandAfter: number | null;
  reservedAfter: number | null;
  blockedAfter: number | null;
  reason: string | null;
  notes: string | null;
  legacyQuantity?: number;
  createdAt: string;
  performedBy: string | null;
}

export interface LedgerPageEntry extends LedgerEntry {
  inventoryId: string | null;
  orderId: string | null;
  orderNumber: string | null;
  productId: string | null;
  productName: string | null;
  sku: string | null;
  variantLabel: string | null;
  warehouseTitle: string | null;
  imageUrl: string | null;
}

export type LedgerGroup = 'receipts' | 'sales' | 'reservations' | 'adjustments' | 'damage' | 'transfers' | 'returns';

export interface LedgerPage {
  summary: Record<'movements' | 'received' | 'sold' | 'adjusted', { value: number; previous: number }>;
  items: LedgerPageEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface Reservation {
  id: string;
  idd: string;
  inventoryId?: string;
  orderId: string | null;
  orderNumber?: string | null;
  reservedQty: number;
  uom?: string | null;
  baseReservedQty: number;
  baseUom?: string | null;
  status: 'RESERVED' | 'RELEASED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  reservedAt: string;
  fulfilledAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  productName?: string;
  productId?: string;
  warehouseId?: string;
  categoryName?: string | null;
  imageUrl?: string | null;
  orderStatus?: string | null;
  orderedAt?: string | null;
  customerName?: string | null;
  /** Value of the order line the stock is held for. */
  value?: number | null;
  sku?: string;
  warehouseTitle?: string;
}

export interface Lot {
  id: string;
  idd: string;
  lotNumber: string | null;
  batchNumber: string | null;
  receivedQty: number;
  remainingQty: number;
  expiryDate: string | null;
  manufactureDate: string | null;
  unitCost: number | null;
  status: 'ACTIVE' | 'DEPLETED' | 'BLOCKED';
}

export interface StockDetail extends StockBalance {
  ledger: LedgerEntry[];
  reservations: Reservation[];
  lots: Lot[];
}

interface Meta {
  referenceId?: string;
  idempotencyKey?: string;
  notes?: string;
}

export const stockService = {
  list(params: { warehouseId?: string; status?: string } = {}): Promise<StockBalance[]> {
    return api.get('/inventory', { params }).then(r => (Array.isArray(r.data) ? r.data : []));
  },
  get(id: string): Promise<StockDetail> {
    return api.get(`/inventory/${id}`).then(r => r.data);
  },
  ledgerPage(params: { from: string; to: string; warehouseId?: string; group?: LedgerGroup; search?: string; page: number; limit: number }): Promise<LedgerPage> {
    return api.get('/inventory/ledger/page', { params }).then(r => r.data);
  },
  reservations(params: { status?: string } = {}): Promise<Reservation[]> {
    return api.get('/inventory/reservations', { params }).then(r => (Array.isArray(r.data) ? r.data : []));
  },
  lowStock(): Promise<StockBalance[]> {
    return api.get('/inventory/low-stock').then(r => (Array.isArray(r.data) ? r.data : []));
  },
  receive(
    body: Meta & {
      productVariantId: string;
      warehouseId: string;
      quantity: number;
      uom?: string;
      type?: 'PURCHASE_RECEIPT' | 'OPENING_STOCK';
      unitCost?: number;
      lotNumber?: string;
      batchNumber?: string;
      expiryDate?: string;
      manufactureDate?: string;
    },
  ) {
    return api.post('/inventory/receive', body).then(r => r.data);
  },
  adjust(id: string, body: Meta & { mode: 'COUNT' | 'IN' | 'OUT'; quantity: number; uom?: string; reason: string; lotId?: string }) {
    return api.post(`/inventory/${id}/adjust`, body).then(r => r.data);
  },
  block(id: string, body: Meta & { action: 'BLOCK' | 'UNBLOCK' | 'WRITE_OFF'; quantity: number; uom?: string; reason: string; lotId?: string }) {
    return api.post(`/inventory/${id}/block`, body).then(r => r.data);
  },
  transfer(body: Meta & { inventoryId: string; toWarehouseId: string; quantity: number; uom?: string; reason?: string }) {
    return api.post('/inventory/transfer', body).then(r => r.data);
  },
  returnStock(id: string, body: Meta & { type: 'CUSTOMER_RETURN' | 'PURCHASE_RETURN'; quantity: number; uom?: string; sellable?: boolean; reason: string; lotId?: string }) {
    return api.post(`/inventory/${id}/return`, body).then(r => r.data);
  },
  setLevels(id: string, body: { minimum?: number | null; maximum?: number | null; reorder?: number | null; uom?: string }) {
    return api.put(`/inventory/${id}/levels`, body).then(r => r.data);
  },
};
