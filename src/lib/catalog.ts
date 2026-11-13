// Catalog pages as on the Seller Panel: Warehouses (lib/warehouse-status,
// warehouses/*), Brand Approvals (lib/brand-request, brand-requests/*),
// Product Variants, Business Variants and Product Specs.
import type { BadgeTone } from '../components/ui/Badge';
import type { Row } from '../services/products-service';
import type { StockBalance } from '../services/stock-service';
import i18n from '../i18n';

export const isActiveRow = (r: Record<string, unknown>) => Number(r.status) === 1;
const text = (v: unknown) => (v == null ? '' : String(v));

// ── Warehouses ───────────────────────────────────────────────────────────

export const WAREHOUSE_TYPES = [
  { value: 'WAREHOUSE', get label() { return i18n.t('common.warehouse'); } },
  { value: 'RETAIL_STORE', get label() { return i18n.t('catalog.retailStore'); } },
  { value: 'DARK_STORE', get label() { return i18n.t('catalog.darkStore'); } },
];
export const warehouseTypeLabel = (t: unknown) => WAREHOUSE_TYPES.find(o => o.value === t)?.label ?? text(t);

/** A warehouse's approval state; only ACTIVE ones receive, hold or dispatch stock. */
export type WarehouseLifecycle = 'PENDING_APPROVAL' | 'UNDER_REVIEW' | 'INFO_REQUESTED' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE';

export const WAREHOUSE_STATUS: Record<WarehouseLifecycle, { label: string; tone: BadgeTone; hint: string }> = {
  PENDING_APPROVAL: { get label() { return i18n.t('common.awaitingApproval'); }, tone: 'amber', get hint() { return i18n.t('catalog.veiloscanIsReviewingThisWarehouseYou'); } },
  UNDER_REVIEW: { get label() { return i18n.t('common.underReview'); }, tone: 'blue', get hint() { return i18n.t('catalog.aReviewerIsCheckingThisWarehouses'); } },
  INFO_REQUESTED: { get label() { return i18n.t('catalog.infoNeeded'); }, tone: 'amber', get hint() { return i18n.t('catalog.veiloscanNeedsMoreInformationUpdateThe'); } },
  ACTIVE: { get label() { return i18n.t('common.active'); }, tone: 'green', get hint() { return i18n.t('catalog.approvedAndInUse'); } },
  REJECTED: { get label() { return i18n.t('common.rejected'); }, tone: 'red', get hint() { return i18n.t('catalog.fixTheIssuesBelowThenResubmit'); } },
  SUSPENDED: { get label() { return i18n.t('common.suspended'); }, tone: 'red', get hint() { return i18n.t('catalog.veiloscanHasSuspendedThisWarehouseContact'); } },
  INACTIVE: { get label() { return i18n.t('common.inactive'); }, tone: 'slate', get hint() { return i18n.t('catalog.switchedOffItsHistoryIsKept'); } },
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
  get SUBMITTED() { return i18n.t('common.submittedForApproval'); },
  get AUTO_APPROVED() { return i18n.t('catalog.approvedAutomatically'); },
  get SENT_TO_REVIEW() { return i18n.t('catalog.sentToVeiloscansReviewTeam'); },
  get CREATED_BY_ADMIN() { return i18n.t('catalog.addedByVeiloscan'); },
  get REVIEW_STARTED() { return i18n.t('catalog.reviewStarted'); },
  get INFO_REQUESTED() { return i18n.t('catalog.moreInformationRequested'); },
  get RESUBMITTED() { return i18n.t('catalog.resubmitted'); },
  get APPROVED() { return i18n.t('common.approved'); },
  get REJECTED() { return i18n.t('common.notApproved'); },
  get SUSPENDED() { return i18n.t('catalog.suspendedByVeiloscan'); },
  get REINSTATED() { return i18n.t('catalog.reinstated'); },
  get DEACTIVATED() { return i18n.t('catalog.switchedOff'); },
  get REACTIVATED() { return i18n.t('catalog.switchedBackOn'); },
  get REVERIFIED() { return i18n.t('catalog.addressChangeCheckedAndApproved'); },
  get REVERIFICATION_REQUIRED() { return i18n.t('catalog.addressChangedSentForApproval'); },
};

export type WarehouseStock = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export const WAREHOUSE_STOCK: Record<WarehouseStock, { label: string; color: string }> = {
  IN_STOCK: { get label() { return i18n.t('catalog.inStock'); }, color: '#059669' },
  LOW_STOCK: { get label() { return i18n.t('common.lowStock'); }, color: '#d97706' },
  OUT_OF_STOCK: { get label() { return i18n.t('catalog.noStock'); }, color: '#94a3b8' },
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
  const missing = [!f.facilityTitle.trim() && i18n.t('catalog.warehouseName'), !f.facilityCode.trim() && i18n.t('catalog.warehouseCode'), !f.facilityType && i18n.t('catalog.warehouseType')].filter(Boolean);
  if (missing.length) return i18n.t('common.pleaseFillInJoin', { join: missing.join(', ') });
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return i18n.t('common.enterAValidEmailAddress');
  const lat = f.latitude.trim();
  const lng = f.longitude.trim();
  if (lat && !(Number(lat) >= -90 && Number(lat) <= 90)) return i18n.t('common.latitudeMustBeBetween90And');
  if (lng && !(Number(lng) >= -180 && Number(lng) <= 180)) return i18n.t('common.longitudeMustBeBetween180And');
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
  0: { get label() { return i18n.t('common.awaitingReview'); }, tone: 'amber', get hint() { return i18n.t('catalog.veiloscanIsCheckingTheDocuments'); } },
  1: { get label() { return i18n.t('common.approved'); }, tone: 'green', get hint() { return i18n.t('catalog.youCanListThisBrandsProducts'); } },
  2: { get label() { return i18n.t('catalog.changesNeeded'); }, tone: 'red', get hint() { return i18n.t('catalog.fixWhatTheReviewerAskedFor'); } },
};

export const SALES_CHANNELS = [
  { value: 'NOT_APPLICABLE', get label() { return i18n.t('catalog.notApplicable'); } },
  { value: 'WHOLESALE', get label() { return i18n.t('catalog.wholesaleDistribution'); } },
  { value: 'BRICK_AND_MORTAR', get label() { return i18n.t('catalog.brickAndMortarShop'); } },
  { value: 'OTHER_MARKETPLACES', get label() { return i18n.t('catalog.otherOnlineMarketplaces'); } },
  { value: 'BRAND_WEBSITE', get label() { return i18n.t('catalog.brandRetailWebsite'); } },
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
    { label: i18n.t('common.childCategory'), done: c.isResubmit || !!c.categoryId },
    { label: i18n.t('common.brand'), done: c.isResubmit || (isNew ? !!c.newBrandTitle.trim() : c.hasBrand) },
    { label: i18n.t('common.stores'), done: c.isResubmit || c.storeCount > 0 },
    { label: i18n.t('catalog.whereItsSoldToday'), done: c.salesChannels.length > 0 },
    { label: i18n.t('catalog.brandOwnership'), done: c.isBrandOwner !== null },
    ...(c.isBrandOwner ? [{ label: i18n.t('catalog.trademarkDetails'), done: !!(c.applicationNumber.trim() && c.registeredClass.trim() && c.registeredDate) }] : []),
    { label: i18n.t('catalog.registeredDocument'), done: c.hasDocument },
    ...(isNew ? [{ label: i18n.t('catalog.brandLogo'), done: c.hasLogo }] : []),
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
  const missing = [!f.productId && i18n.t('common.product'), !f.skuItemNumber.trim() && i18n.t('catalog.skuItemNumber'), !f.businessPrice.trim() && i18n.t('catalog.sellingPrice')].filter(Boolean);
  if (missing.length) return i18n.t('common.pleaseFillInJoin', { join: missing.join(', ') });
  if (!f.attributes.some(a => a.key.trim())) return i18n.t('catalog.addAtLeastOneVariantAttribute');
  if (!money(f.businessPrice) || !money(f.mrp) || !money(f.costPrice)) return i18n.t('catalog.pricesMustBeAmountsOf0');
  if (f.quantityPriceType === 'SLAB') {
    for (const [i, t] of f.tiers.entries()) {
      if ((t.lowerBound === '') !== (t.price === '')) return i18n.t('catalog.tierIEnterBothTheMinimum', { i: i + 1 });
      if (!money(t.price) || !money(t.lowerBound)) return i18n.t('catalog.tierIQuantityAndPriceMust', { i: i + 1 });
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

