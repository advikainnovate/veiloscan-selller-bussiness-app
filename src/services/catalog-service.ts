import { api } from '../lib/api';
import { crud, type Row } from './products-service';

// The Seller Panel's catalog pages (Brand Approvals, Product Variants,
// Business Variants, Product Specs, Warehouses): the same endpoints.

/** Brand approval requests for the seller's stores, reviewed by the platform. */
export const brandRequestService = {
  /** The seller's stores with the child categories mapped to each. */
  options: (): Promise<{ id: string; name: string; code: string | null; categoryIds: string[] }[]> => api.get('/brand-requests/options').then(r => r.data),
  list: (): Promise<Row[]> => api.get('/brand-requests').then(r => (Array.isArray(r.data) ? r.data : [])),
  get: (id: string): Promise<Row> => api.get(`/brand-requests/${id}`).then(r => r.data),
  /** One request per store; returns them all. */
  create: (payload: Record<string, unknown>): Promise<Row[]> => api.post('/brand-requests', payload).then(r => r.data),
  resubmit: (id: string, payload: Record<string, unknown>): Promise<Row> => api.post(`/brand-requests/${id}/resubmit`, payload).then(r => r.data),
  withdraw: (id: string) => api.delete(`/brand-requests/${id}`).then(r => r.data),
};

/** The brands offered in a category. */
export const categorywiseBrands = (categoryId: string): Promise<Row[]> =>
  api.get('/categorywise-brands', { params: { categoryId } }).then(r => (Array.isArray(r.data) ? r.data : r.data?.items ?? []));

export const productVariantService = crud('/product-variants');
export const variantMasterService = crud('/variant-master');
export const variantDataService = crud('/variant-data');

export const productSpecificationService = crud('/product-specifications');
export const productSpecificationValueService = crud('/product-specification-values');
export const specificationService = crud('/specifications');
export const specificationDataService = crud('/specifications-data');

export interface WarehouseHistoryEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

export const warehouseMasterService = {
  ...crud('/warehouse-master'),
  /** Sends a rejected warehouse, or one VeiloScan asked about, back for review. */
  resubmit: (id: string, note?: string) => api.post(`/warehouse-master/${id}/resubmit`, { note: note || undefined }).then(r => r.data),
  /** Every approval step, oldest first. */
  history: (id: string): Promise<WarehouseHistoryEntry[]> => api.get(`/warehouse-master/${id}/history`).then(r => (Array.isArray(r.data) ? r.data : [])),
};

/** A warehouse's recent stock movements. */
export const recentMovements = (warehouseId: string, limit = 12): Promise<Row[]> =>
  api.get('/inventory/ledger', { params: { warehouseId, limit } }).then(r => (Array.isArray(r.data) ? r.data : []));
