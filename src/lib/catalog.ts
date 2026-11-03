// Catalog pages as on the Seller Panel: Warehouses (lib/warehouse-status,
// warehouses/*), Brand Approvals (lib/brand-request, brand-requests/*),
// Product Variants, Business Variants and Product Specs.
import type { BadgeTone } from '../components/ui/Badge';
import type { Row } from '../services/products-service';
import type { StockBalance } from '../services/stock-service';

export const isActiveRow = (r: Record<string, unknown>) => Number(r.status) === 1;
const text = (v: unknown) => (v == null ? '' : String(v));

// ── Warehouses ───────────────────────────────────────────────────────────

export const WAREHOUSE_TYPES = [
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'RETAIL_STORE', label: 'Retail Store' },
  { value: 'DARK_STORE', label: 'Dark Store' },
];
export const warehouseTypeLabel = (t: unknown) => WAREHOUSE_TYPES.find(o => o.value === t)?.label ?? text(t);

/** A warehouse's approval state; only ACTIVE ones receive, hold or dispatch stock. */
export type WarehouseLifecycle = 'PENDING_APPROVAL' | 'UNDER_REVIEW' | 'INFO_REQUESTED' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE';

export const WAREHOUSE_STATUS: Record<WarehouseLifecycle, { label: string; tone: BadgeTone; hint: string }> = {
  PENDING_APPROVAL: { label: 'Awaiting approval', tone: 'amber', hint: "VeiloScan is reviewing this warehouse. You can add stock to it once it's approved." },
  UNDER_REVIEW: { label: 'Under review', tone: 'blue', hint: "A reviewer is checking this warehouse's address and details." },
  INFO_REQUESTED: { label: 'Info needed', tone: 'amber', hint: 'VeiloScan needs more information. Update the warehouse, then resubmit it.' },
  ACTIVE: { label: 'Active', tone: 'green', hint: 'Approved and in use.' },
  REJECTED: { label: 'Rejected', tone: 'red', hint: 'Fix the issues below, then resubmit the warehouse for review.' },
  SUSPENDED: { label: 'Suspended', tone: 'red', hint: 'VeiloScan has suspended this warehouse. Contact support to have it reviewed.' },
  INACTIVE: { label: 'Inactive', tone: 'slate', hint: 'Switched off. Its history is kept.' },
};

/** The lifecycle, falling back to the plain on/off status for older responses. */
export function warehouseLifecycle(row: Record<string, unknown>): WarehouseLifecycle {
  const value = row.lifecycleStatus as WarehouseLifecycle | undefined;
  if (value && value in WAREHOUSE_STATUS) return value;
  return Number(row.status) === 1 ? 'ACTIVE' : 'INACTIVE';
}
export const canResubmit = (s: WarehouseLifecycle) => s === 'REJECTED' || s === 'INFO_REQUESTED';
/** The on/off switch only applies to approved warehouses. */
export const canToggle = (s: WarehouseLifecycle) => s === 'ACTIVE' || s === 'INACTIVE';

export const WAREHOUSE_HISTORY: Record<string, string> = {
  SUBMITTED: 'Submitted for approval',
  AUTO_APPROVED: 'Approved automatically',
  SENT_TO_REVIEW: "Sent to VeiloScan's review team",
  CREATED_BY_ADMIN: 'Added by VeiloScan',
  REVIEW_STARTED: 'Review started',
  INFO_REQUESTED: 'More information requested',
  RESUBMITTED: 'Resubmitted',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
  SUSPENDED: 'Suspended by VeiloScan',
  REINSTATED: 'Reinstated',
  DEACTIVATED: 'Switched off',
  REACTIVATED: 'Switched back on',
  REVERIFIED: 'Address change checked and approved',
  REVERIFICATION_REQUIRED: 'Address changed — sent for approval',
};

export type WarehouseStock = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export const WAREHOUSE_STOCK: Record<WarehouseStock, { label: string; color: string }> = {
  IN_STOCK: { label: 'In Stock', color: '#059669' },
  LOW_STOCK: { label: 'Low Stock', color: '#d97706' },
  OUT_OF_STOCK: { label: 'No Stock', color: '#94a3b8' },
};

export interface WarehouseRow extends Row {
  lifecycle: WarehouseLifecycle;
  totalAvailable: number;
  stockValue: number;
  stockStatus: WarehouseStock;
}

/** Each warehouse's available stock, its value at the selling price and whether it's low. */
export function warehouseRows(warehouses: Row[], stock: StockBalance[], priceBySku: Map<string, number>): WarehouseRow[] {
  return warehouses.map(w => {
    const rows = stock.filter(r => r.warehouseId === w.id);
    let totalAvailable = 0;
    let totalMinimum = 0;
    let stockValue = 0;
    rows.forEach(r => {
      totalAvailable += r.available ?? 0;
      totalMinimum += r.minimum ?? 0;
      stockValue += (r.available ?? 0) * (priceBySku.get(r.productVariantId) ?? 0);
    });
    const stockStatus: WarehouseStock = !rows.length || totalAvailable === 0 ? 'OUT_OF_STOCK' : totalMinimum > 0 && totalAvailable <= totalMinimum ? 'LOW_STOCK' : 'IN_STOCK';
    return { ...w, lifecycle: warehouseLifecycle(w), totalAvailable, stockValue, stockStatus };
  });
}

export interface WarehouseFilters {
  search: string;
  status: string;
  state: string;
  type: string;
}
export const WAREHOUSE_FILTERS: WarehouseFilters = { search: '', status: '', state: '', type: '' };

export function filterWarehouses(rows: WarehouseRow[], f: WarehouseFilters) {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r => {
    if (f.status && r.lifecycle !== f.status) return false;
    if (f.state && r.state !== f.state) return false;
    if (f.type && r.facilityType !== f.type) return false;
    return !q || `${text(r.facilityTitle)} ${text(r.facilityCode)} ${text(r.city)}`.toLowerCase().includes(q);
  });
}

export const WAREHOUSE_FIELDS = [
  'facilityTitle',
  'facilityCode',
  'facilityType',
  'contactPerson',
  'email',
  'phone',
  'addressLine1',
  'addressLine2',
  'landmark',
  'area',
  'city',
  'state',
  'pincode',
  'country',
  'region',
  'latitude',
  'longitude',
  'timezone',
  'customField1',
  'customField2',
] as const;
export type WarehouseForm = Record<(typeof WAREHOUSE_FIELDS)[number], string> & {
  isActive: boolean;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  returnEnabled: boolean;
  isDefault: boolean;
};

export const EMPTY_WAREHOUSE: WarehouseForm = {
  ...(Object.fromEntries(WAREHOUSE_FIELDS.map(k => [k, ''])) as Record<(typeof WAREHOUSE_FIELDS)[number], string>),
  facilityType: 'WAREHOUSE',
  timezone: 'Asia/Kolkata',
  isActive: true,
  inboundEnabled: true,
  outboundEnabled: true,
  returnEnabled: true,
  isDefault: false,
};

export function warehouseFromRecord(r: Row): WarehouseForm {
  const lifecycle = warehouseLifecycle(r);
  return {
    ...(Object.fromEntries(WAREHOUSE_FIELDS.map(k => [k, text(r[k])])) as Record<(typeof WAREHOUSE_FIELDS)[number], string>),
    facilityType: text(r.facilityType) || 'WAREHOUSE',
    timezone: text(r.timezone) || 'Asia/Kolkata',
    // "Off" only when the seller switched it off; pending ones count as on.
    isActive: lifecycle !== 'INACTIVE',
    inboundEnabled: Boolean(r.inboundEnabled),
    outboundEnabled: Boolean(r.outboundEnabled),
    returnEnabled: Boolean(r.returnEnabled),
    isDefault: Boolean(r.isDefault),
  };
}

/** The panel's required fields, plus the formats its inputs take. */
export function warehouseProblem(f: WarehouseForm): string | null {
  const missing = [!f.facilityTitle.trim() && 'Warehouse Name', !f.facilityCode.trim() && 'Warehouse Code', !f.facilityType && 'Warehouse Type'].filter(Boolean);
  if (missing.length) return `Please fill in: ${missing.join(', ')}`;
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Enter a valid email address';
  const lat = f.latitude.trim();
  const lng = f.longitude.trim();
  if (lat && !(Number(lat) >= -90 && Number(lat) <= 90)) return 'Latitude must be between -90 and 90';
  if (lng && !(Number(lng) >= -180 && Number(lng) <= 180)) return 'Longitude must be between -180 and 180';
  return null;
}

/** Empty fields are left out; the status goes separately (see the form). */
export function warehousePayload(f: WarehouseForm): Record<string, unknown> {
  const fields = Object.fromEntries(WAREHOUSE_FIELDS.map(k => [k, f[k].trim() || undefined]));
  return { ...fields, inboundEnabled: f.inboundEnabled, outboundEnabled: f.outboundEnabled, returnEnabled: f.returnEnabled, isDefault: f.isDefault };
}

export const warehouseAddress = (w: Row) =>
  [w.addressLine1, w.addressLine2, w.landmark, w.area, w.city, [w.state, w.pincode].filter(Boolean).join(' '), w.country].filter(Boolean).map(text).join(', ');

// ── Brand approvals ──────────────────────────────────────────────────────

export const BRAND_STATUS = { PENDING: 0, APPROVED: 1, REJECTED: 2 } as const;
export const BRAND_STATUS_LABEL: Record<number, { label: string; tone: BadgeTone; hint: string }> = {
  0: { label: 'Awaiting review', tone: 'amber', hint: 'VeiloScan is checking the documents.' },
  1: { label: 'Approved', tone: 'green', hint: "You can list this brand's products in the category." },
  2: { label: 'Changes needed', tone: 'red', hint: 'Fix what the reviewer asked for and resubmit.' },
};

export const SALES_CHANNELS = [
  { value: 'NOT_APPLICABLE', label: 'Not applicable' },
  { value: 'WHOLESALE', label: 'Wholesale Distribution' },
  { value: 'BRICK_AND_MORTAR', label: 'Brick & Mortar Shop' },
  { value: 'OTHER_MARKETPLACES', label: 'Other Online Marketplaces' },
  { value: 'BRAND_WEBSITE', label: 'Brand Retail Website' },
];
export const channelLabel = (v: string) => SALES_CHANNELS.find(c => c.value === v)?.label ?? v;

/** "Not applicable" excludes the rest. */
export function toggleChannel(current: string[], value: string): string[] {
  if (current.includes(value)) return current.filter(c => c !== value);
  if (value === 'NOT_APPLICABLE') return [value];
  return [...current.filter(c => c !== 'NOT_APPLICABLE'), value];
}

/** "Electronics › Mobiles › Smartphones", walking a category's parents. */
export function categoryPath(category: Row | undefined, byId: Map<unknown, Row>): string {
  const titles: string[] = [];
  let current = category;
  while (current && titles.length < 5) {
    titles.unshift(text(current.categoryTitle));
    current = current.parentCategoryId ? byId.get(current.parentCategoryId) : undefined;
  }
  return titles.join(' › ');
}

export function childCategoryOptions(categories: Row[]) {
  const byId = new Map(categories.map(c => [c.id as unknown, c]));
  return categories
    .filter(c => c.categoryType === 'CHILD_CATEGORY')
    .map(c => ({ value: c.id, label: categoryPath(c, byId) || text(c.categoryTitle) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function filterBrandRequests(rows: Row[], status: number | null, search: string) {
  const q = search.trim().toLowerCase();
  return rows.filter(r => {
    if (status !== null && r.status !== status) return false;
    if (!q) return true;
    const b = r.brand as Row | undefined;
    const c = r.category as Row | undefined;
    const s = r.store as Row | undefined;
    return `${text(b?.title)} ${text(c?.categoryTitle)} ${text(s?.name)} ${text(r.idd)}`.toLowerCase().includes(q);
  });
}

export interface BrandChecklist {
  isResubmit: boolean;
  categoryId: string;
  brandMode: 'existing' | 'new';
  hasBrand: boolean;
  newBrandTitle: string;
  storeCount: number;
  salesChannels: string[];
  isBrandOwner: boolean | null;
  applicationNumber: string;
  registeredClass: string;
  registeredDate: string;
  hasDocument: boolean;
  hasLogo: boolean;
}

/** What the request still needs, as the panel's checklist. */
export function brandChecklist(c: BrandChecklist) {
  const isNew = c.brandMode === 'new';
  return [
    { label: 'Child category', done: c.isResubmit || !!c.categoryId },
    { label: 'Brand', done: c.isResubmit || (isNew ? !!c.newBrandTitle.trim() : c.hasBrand) },
    { label: 'Stores', done: c.isResubmit || c.storeCount > 0 },
    { label: "Where it's sold today", done: c.salesChannels.length > 0 },
    { label: 'Brand ownership', done: c.isBrandOwner !== null },
    ...(c.isBrandOwner ? [{ label: 'Trademark details', done: !!(c.applicationNumber.trim() && c.registeredClass.trim() && c.registeredDate) }] : []),
    { label: 'Registered document', done: c.hasDocument },
    ...(isNew ? [{ label: 'Brand logo', done: c.hasLogo }] : []),
  ];
}

// ── Product variants ─────────────────────────────────────────────────────

export interface VariantFilters {
  search: string;
  productId: string;
  variantId: string;
  status: string;
}
export const VARIANT_FILTERS: VariantFilters = { search: '', productId: '', variantId: '', status: '' };

const rel = (r: Row, key: string) => (r[key] as Row | undefined) ?? ({} as Row);
export const variantProduct = (r: Row) => rel(r, 'product');
export const variantType = (r: Row) => rel(r, 'variant');
export const variantValue = (r: Row) => rel(r, 'variantData');

export function filterVariants(rows: Row[], f: VariantFilters) {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r => {
    if (f.productId && r.productId !== f.productId) return false;
    if (f.variantId && r.variantId !== f.variantId) return false;
    if (f.status && String(isActiveRow(r) ? 1 : 0) !== f.status) return false;
    if (!q) return true;
    return [variantProduct(r).productName, variantProduct(r).skuItemNumber, variantType(r).variantTitle, variantValue(r).variantData].filter(Boolean).map(text).join(' ').toLowerCase().includes(q);
  });
}

// ── Business variants (SKUs) ─────────────────────────────────────────────

export interface SkuForm {
  productId: string;
  skuItemNumber: string;
  barcode: string;
  businessPrice: string;
  mrp: string;
  costPrice: string;
  quantityPriceType: 'FIXED' | 'SLAB';
  tiers: { lowerBound: string; price: string }[];
  attributes: { key: string; value: string }[];
  productImageFileId: string;
  productImageUrl: string;
  status: string;
}

export const emptySku = (productId = ''): SkuForm => ({
  productId,
  skuItemNumber: '',
  barcode: '',
  businessPrice: '',
  mrp: '',
  costPrice: '',
  quantityPriceType: 'FIXED',
  tiers: Array.from({ length: 5 }, () => ({ lowerBound: '', price: '' })),
  attributes: [{ key: '', value: '' }],
  productImageFileId: '',
  productImageUrl: '',
  status: '1',
});

export function skuFromRecord(r: Row): SkuForm {
  const val = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  const entries = Object.entries((r.variantCombination as Record<string, unknown>) ?? {});
  return {
    productId: val(r.productId),
    skuItemNumber: val(r.skuItemNumber),
    barcode: val(r.barcode),
    businessPrice: val(r.businessPrice),
    mrp: val(r.mrp),
    costPrice: val(r.costPrice),
    quantityPriceType: r.quantityPriceType === 'SLAB' ? 'SLAB' : 'FIXED',
    tiers: [1, 2, 3, 4, 5].map(n => ({ lowerBound: val(r[`quantityLowerBound${n}`]), price: val(r[`quantityPrice${n}`]) })),
    attributes: entries.length ? entries.map(([key, value]) => ({ key, value: String(value) })) : [{ key: '', value: '' }],
    productImageFileId: val(r.productImageFileId),
    productImageUrl: val((r.productImageFile as Row | undefined)?.url),
    status: r.status === undefined || r.status === null ? '1' : String(r.status),
  };
}

const money = (v: string) => v.trim() === '' || (Number(v) >= 0 && !Number.isNaN(Number(v)));

export function skuProblem(f: SkuForm): string | null {
  const missing = [!f.productId && 'Product', !f.skuItemNumber.trim() && 'SKU Item Number', !f.businessPrice.trim() && 'Selling Price'].filter(Boolean);
  if (missing.length) return `Please fill in: ${missing.join(', ')}`;
  if (!f.attributes.some(a => a.key.trim())) return 'Add at least one variant attribute (e.g. Color: Black).';
  if (!money(f.businessPrice) || !money(f.mrp) || !money(f.costPrice)) return 'Prices must be amounts of 0 or more';
  if (f.quantityPriceType === 'SLAB') {
    for (const [i, t] of f.tiers.entries()) {
      if ((t.lowerBound === '') !== (t.price === '')) return `Tier ${i + 1}: enter both the minimum quantity and the price`;
      if (!money(t.price) || !money(t.lowerBound)) return `Tier ${i + 1}: quantity and price must be 0 or more`;
    }
  }
  return null;
}

export function skuPayload(f: SkuForm): Record<string, unknown> {
  const variantCombination: Record<string, string> = {};
  f.attributes.forEach(a => {
    if (a.key.trim()) variantCombination[a.key.trim()] = a.value;
  });
  const payload: Record<string, unknown> = {
    productId: f.productId,
    skuItemNumber: f.skuItemNumber.trim(),
    barcode: f.barcode.trim() || undefined,
    variantCombination,
    businessPrice: String(f.businessPrice),
    mrp: f.mrp ? String(f.mrp) : undefined,
    costPrice: f.costPrice ? String(f.costPrice) : undefined,
    quantityPriceType: f.quantityPriceType,
    productImageFileId: f.productImageFileId || undefined,
  };
  if (f.quantityPriceType === 'SLAB') {
    f.tiers.forEach((t, i) => {
      if (t.lowerBound !== '') payload[`quantityLowerBound${i + 1}`] = Number(t.lowerBound);
      if (t.price !== '') payload[`quantityPrice${i + 1}`] = String(t.price);
    });
  }
  return payload;
}

export function filterSkus(rows: Row[], productName: (id: unknown) => string, search: string, productId: string, status: string) {
  const q = search.trim().toLowerCase();
  return rows.filter(r => {
    if (productId && r.productId !== productId) return false;
    if (status && String(r.status) !== status) return false;
    return !q || `${text(r.skuItemNumber)} ${text(r.barcode)} ${productName(r.productId)}`.toLowerCase().includes(q);
  });
}

// ── Product specifications ───────────────────────────────────────────────

export interface SpecValueRow {
  id?: string;
  specsDataId: string;
  specificationValue: string;
  sequence: string;
}
export const EMPTY_SPEC_VALUE: SpecValueRow = { specsDataId: '', specificationValue: '', sequence: '' };

/** A product specification's values, in order; older records keep a single value on themselves. */
export function specValues(record: Row, values: Row[]): Row[] {
  const rows = values.filter(v => v.productSpecificationId === record.id).sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
  if (!rows.length && (record.specsDataId || record.specificationValue)) return [{ id: 'legacy', sequence: 1, specsDataId: record.specsDataId, specificationValue: record.specificationValue, status: record.status }];
  return rows;
}

export const specValueLabel = (v: Row, optionTitle: (id: unknown) => string | undefined) => (v.specsDataId ? optionTitle(v.specsDataId) : (v.specificationValue as string | undefined)) ?? '';

export function filterSpecs(rows: Row[], productName: (id: unknown) => string, specTitle: (id: unknown) => string, f: { search: string; productId: string; specificationId: string; status: string }) {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r => {
    if (f.productId && r.productId !== f.productId) return false;
    if (f.specificationId && r.specificationId !== f.specificationId) return false;
    if (f.status && String(r.status) !== f.status) return false;
    return !q || productName(r.productId).toLowerCase().includes(q) || specTitle(r.specificationId).toLowerCase().includes(q);
  });
}

