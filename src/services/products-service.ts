import { api } from '../lib/api';
import i18n from '../i18n';

// The Seller Panel's products-master-service plus the product sub-resources
// its list and detail pages read (images, tags, documents, SEO, measures,
// SKUs, stock) — the same endpoints, typed for the app.

export type Row = Record<string, unknown> & { id: string };

const list = <T = Row>(resource: string, params?: Record<string, unknown>): Promise<T[]> =>
  api.get(resource, { params }).then(res => (Array.isArray(res.data) ? res.data : res.data?.items ?? []));

export function crud(resource: string) {
  return {
    list: (params?: Record<string, unknown>) => list(resource, params),
    get: (id: string): Promise<Row> => api.get(`${resource}/${id}`).then(res => res.data),
    create: (payload: Record<string, unknown>): Promise<Row> => api.post(resource, payload).then(res => res.data),
    update: (id: string, payload: Record<string, unknown>): Promise<Row> => api.patch(`${resource}/${id}`, payload).then(res => res.data),
    remove: (id: string) => api.delete(`${resource}/${id}`).then(res => res.data),
  };
}

export type ProductStoreScope = 'ALL_STORES' | 'SPECIFIC_STORES';

export interface ProductStoreOption {
  id: string;
  name: string;
  code: string;
  slug?: string;
  status: string;
}

export const productsService = {
  ...crud('/products-master'),
  /** Copies a product (SKUs, photos, specifications…) into a new draft; stock and barcodes aren't copied. */
  copy(id: string): Promise<{ id: string; productName: string }> {
    return api.post(`/products-master/${id}/copy`).then(res => res.data);
  },
  /** The seller's stores products can be scoped to. */
  stores(): Promise<ProductStoreOption[]> {
    return api.get('/products-master/stores').then(res => res.data);
  },
  /** Auto validation: what still keeps the product from being submitted. */
  submissionCheck(id: string): Promise<{ ready: boolean; issues: string[] }> {
    return api.get(`/products-master/${id}/submission-check`).then(res => res.data);
  },
  /** Draft / changes required → awaiting admin approval. */
  submitForApproval(id: string): Promise<Row> {
    return api.post(`/products-master/${id}/submit`).then(res => res.data);
  },
};

export const categoryService = crud('/category-master');
export const brandService = crud('/brands-master');
export const productSkuService = crud('/product-business-variants');
export const productImageService = crud('/product-images');
export const productTagService = crud('/product-tags');
export const productDocumentService = crud('/product-documents');
export const productSeoService = crud('/product-seo');
export const productMeasuresService = crud('/products-measures');

export type StockType = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'AREA' | 'CUBIC_VOLUME' | string;

export interface Uom {
  id: string;
  code: string;
  name: string;
  stockType: StockType;
  factorToBase: string | null;
  isBase: boolean;
}

/** A SKU's stock in one warehouse, in the SKU's base unit. */
export interface InventoryBalance {
  id: string;
  productId: string;
  productVariantId?: string;
  warehouseId: string;
  baseUom: string;
  /** The unit stock is shown in, and base units in one of it. */
  salesUom?: string;
  salesFactor?: number;
  onHand: number;
  reserved: number;
  blocked: number;
  available: number;
  minimum: number;
}

/** How a product's (or one SKU's) stock is counted. */
export interface StockConfig {
  id: string;
  productVariantId: string | null;
  stockType: StockType;
  baseUom: string;
  packConversions: Record<string, number>;
  trackLot: boolean;
  trackBatch: boolean;
  trackExpiry: boolean;
  consumptionRule: 'FIFO' | 'FEFO';
  allowNegativeStock: boolean;
}

export interface StockConfigView {
  productId: string;
  variants: { id: string; sku: string; label: string }[];
  configs: StockConfig[];
}

export const STOCK_TYPES = [
  { value: 'PIECE', get label() { return i18n.t('products.pieces'); } },
  { value: 'WEIGHT', get label() { return i18n.t('products.weight'); } },
  { value: 'VOLUME', get label() { return i18n.t('products.volume'); } },
  { value: 'LENGTH', get label() { return i18n.t('products.length'); } },
  { value: 'AREA', get label() { return i18n.t('common.area'); } },
  { value: 'CUBIC_VOLUME', get label() { return i18n.t('products.cubicVolume'); } },
  { value: 'PACK', get label() { return i18n.t('products.packsBoxes'); } },
];

export const inventoryService = {
  list(params: { productId?: string; warehouseId?: string } = {}): Promise<InventoryBalance[]> {
    return list<InventoryBalance>('/inventory', params);
  },
  uoms(): Promise<Uom[]> {
    return list<Uom>('/inventory/uoms');
  },
  /** Stock coming in: opening stock or a purchase, in any unit of the SKU, with lot details. */
  receive(body: {
    productVariantId: string;
    warehouseId: string;
    quantity: number;
    uom?: string;
    type?: 'PURCHASE_RECEIPT' | 'OPENING_STOCK';
    unitCost?: number;
    lotNumber?: string;
    batchNumber?: string;
    expiryDate?: string;
    idempotencyKey?: string;
  }) {
    return api.post('/inventory/receive', body).then(res => res.data);
  },
  setLevels(id: string, body: { minimum?: number | null; maximum?: number | null; reorder?: number | null; uom?: string }) {
    return api.put(`/inventory/${id}/levels`, body).then(res => res.data);
  },
  stockConfig(productId: string): Promise<StockConfigView> {
    return api.get(`/inventory/stock-config/${productId}`).then(res => res.data);
  },
  saveStockConfig(productId: string, body: Omit<StockConfig, 'id'>): Promise<StockConfigView> {
    return api.put(`/inventory/stock-config/${productId}`, body).then(res => res.data);
  },
  removeStockConfig(productId: string, configId: string): Promise<StockConfigView> {
    return api.delete(`/inventory/stock-config/${productId}/${configId}`).then(res => res.data);
  },
};

export const warehouseService = crud('/warehouse-master');

// ── Selling: how customers buy a product / SKU (eshop-backend src/modules/selling) ──

export type SellingMethod = 'FIXED' | 'VARIABLE';
export type SellingType =
  | 'FIXED_UNIT'
  | 'VARIABLE_WEIGHT'
  | 'VARIABLE_VOLUME'
  | 'VARIABLE_LENGTH'
  | 'VARIABLE_AREA'
  | 'VARIABLE_COUNT'
  | 'PACK'
  | 'BOX'
  | 'DOZEN'
  | 'BUNDLE';

export interface SellingConfig {
  id: string;
  productVariantId: string | null;
  sellingMethod: SellingMethod;
  sellingType: SellingType;
  sellingUom: string;
  allowedUoms: string[];
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  quantityStep: number | null;
  allowDecimal: boolean;
  decimalPrecision: number;
  priceUom: string;
  priceQuantity: number;
  quickSelect: { quantity: number; uom: string }[];
}

export interface SellingSummary {
  configured: boolean;
  method: SellingMethod;
  sellingType: SellingType;
  sellingUom: string;
  priceLabel: string;
  priceUom: string;
  priceQuantity: number;
}

export interface SellingConfigView {
  productId: string;
  stock: { stockType: string; baseUom: string };
  variants: {
    id: string;
    sku: string;
    label: string;
    price: number;
    mrp: number | null;
    costPrice: number | null;
    stock: { stockType: string; baseUom: string };
    selling: SellingSummary;
  }[];
  configs: SellingConfig[];
}

export type SellingPreview = { valid: true; quantity: string; baseQuantity: string; price: string; amount: number } | { valid: false; message: string };

export const SELLING_TYPES: { value: SellingType; label: string; method: SellingMethod; stock: string[] }[] = [
  { value: 'FIXED_UNIT', get label() { return i18n.t('products.pieceUnit'); }, method: 'FIXED', stock: ['PIECE', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'CUBIC_VOLUME', 'PACK'] },
  { value: 'PACK', get label() { return i18n.t('products.pack'); }, method: 'FIXED', stock: ['PACK', 'PIECE'] },
  { value: 'BOX', get label() { return i18n.t('products.box'); }, method: 'FIXED', stock: ['PACK', 'PIECE'] },
  { value: 'DOZEN', get label() { return i18n.t('products.dozen'); }, method: 'FIXED', stock: ['PIECE'] },
  { value: 'BUNDLE', get label() { return i18n.t('products.bundle'); }, method: 'FIXED', stock: ['PACK', 'PIECE'] },
  { value: 'VARIABLE_WEIGHT', get label() { return i18n.t('products.weight'); }, method: 'VARIABLE', stock: ['WEIGHT'] },
  { value: 'VARIABLE_VOLUME', get label() { return i18n.t('products.volume'); }, method: 'VARIABLE', stock: ['VOLUME', 'CUBIC_VOLUME'] },
  { value: 'VARIABLE_LENGTH', get label() { return i18n.t('products.length'); }, method: 'VARIABLE', stock: ['LENGTH'] },
  { value: 'VARIABLE_AREA', get label() { return i18n.t('common.area'); }, method: 'VARIABLE', stock: ['AREA'] },
  { value: 'VARIABLE_COUNT', get label() { return i18n.t('products.count'); }, method: 'VARIABLE', stock: ['PIECE'] },
];

export const sellingConfigService = {
  get(productId: string): Promise<SellingConfigView> {
    return api.get(`/selling-config/${productId}`).then(res => res.data);
  },
  save(productId: string, body: Omit<SellingConfig, 'id'>): Promise<SellingConfigView> {
    return api.put(`/selling-config/${productId}`, body).then(res => res.data);
  },
  remove(productId: string, configId: string): Promise<SellingConfigView> {
    return api.delete(`/selling-config/${productId}/${configId}`).then(res => res.data);
  },
  preview(productId: string, body: { productVariantId: string; quantity: number; uom?: string }): Promise<SellingPreview> {
    return api.post(`/selling-config/${productId}/preview`, body).then(res => res.data);
  },
};

// ── Expiry batches ──

export const productExpiryService = crud('/product-expiry');

/** A photo or document picked on the phone. */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  /** From the picker, when it knows them (for size rules). */
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface UploadedFile {
  id: string;
  url?: string;
  [key: string]: unknown;
}

export const fileService = {
  /** POST /files/upload (multipart): the Seller Panel's fileService.upload. */
  upload(file: PickedFile, dirName: string, extra: { documentType?: string; documentId?: string } = {}): Promise<UploadedFile> {
    const form = new FormData();
    // React Native's FormData takes a { uri, name, type } file.
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    form.append('dirName', dirName);
    if (extra.documentType) form.append('documentType', extra.documentType);
    if (extra.documentId) form.append('documentId', extra.documentId);
    return api
      .post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
      .then(res => res.data);
  },
};
