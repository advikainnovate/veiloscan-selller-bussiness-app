// Quantity Discount Slabs pages, as the Seller Panel's
// components/dashboard/quantity-discounts (list and form). The arithmetic and
// slab labels live in quantity-discount.ts; this is the page's own logic.
import type { BadgeTone } from '../components/ui/Badge';
import { slabDiscountLabel, slabRangeLabel } from './quantity-discount';
import type {
  DiscountTargetType,
  FlatDiscountMethod,
  SchemeAuditEntry,
  SchemeInput,
  SchemeListRow,
  SchemeSku,
  SchemeSlab,
  SchemeState,
  SlabDiscountType,
} from '../services/quantity-discount-service';
import i18n from '../i18n';

export const TARGET_LABEL: Record<DiscountTargetType, string> = {
  get ALL_VARIANTS() { return i18n.t('pricing.allVariants'); },
  get SPECIFIC_VARIANTS() { return i18n.t('pricing.specificVariants'); },
  get SIMPLE_PRODUCT() { return i18n.t('pricing.productWithoutVariants'); },
};

export const STATES: SchemeState[] = ['RUNNING', 'SCHEDULED', 'ENDED', 'INACTIVE'];
export const STATE_BADGE: Record<SchemeState, { label: string; tone: BadgeTone }> = {
  RUNNING: { get label() { return i18n.t('pricing.running'); }, tone: 'green' },
  SCHEDULED: { get label() { return i18n.t('common.scheduled'); }, tone: 'amber' },
  ENDED: { get label() { return i18n.t('common.ended'); }, tone: 'slate' },
  INACTIVE: { get label() { return i18n.t('common.inactive'); }, tone: 'slate' },
};

/** Search covers the scheme name, the product and the ID. */
export function filterSchemes(rows: SchemeListRow[], search: string, state: SchemeState | '') {
  const q = search.trim().toLowerCase();
  return rows.filter(r => (!state || r.state === state) && (!q || `${r.schemeName} ${r.productName} ${r.idd}`.toLowerCase().includes(q)));
}

/** A saved slab in the shape the labels take. */
export const asSlab = (s: SchemeSlab) => ({ ...s, id: s.id ?? '', flatMethod: s.flatDiscountMethod });

/** "5–9 PCS · 5% off". */
export const slabLabel = (s: SchemeSlab) => `${slabRangeLabel(asSlab(s), s.quantityUnit)} · ${slabDiscountLabel(asSlab(s), s.quantityUnit)}`;

export const AUDIT_LABEL: Record<string, string> = {
  get CREATED() { return i18n.t('common.created'); },
  get UPDATED() { return i18n.t('pricing.detailsChanged'); },
  get VARIANTS_CHANGED() { return i18n.t('pricing.variantsChanged'); },
  get SLABS_CHANGED() { return i18n.t('pricing.slabsChanged'); },
  get STATUS_CHANGED() { return i18n.t('common.statusChanged'); },
  get DELETED() { return i18n.t('common.deleted'); },
};

export function auditSummary(entry: SchemeAuditEntry, skus: SchemeSku[]): string | null {
  const c = entry.changes as Record<string, unknown> | null;
  if (!c) return null;
  const name = (id: string) => skus.find(s => s.id === id)?.label ?? i18n.t('pricing.aVariant');
  if (entry.action === 'VARIANTS_CHANGED') {
    const added = (c.added as string[]) ?? [];
    const removed = (c.removed as string[]) ?? [];
    return [added.length ? i18n.t('pricing.addedJoin', { join: added.map(name).join(', ') }) : null, removed.length ? i18n.t('pricing.removedJoin', { join: removed.map(name).join(', ') }) : null].filter(Boolean).join(' · ');
  }
  if (entry.action === 'STATUS_CHANGED') return `${String(c.before)} → ${String(c.after)}`;
  if (entry.action === 'UPDATED' && c.after && typeof c.after === 'object') return i18n.t('pricing.changedJoin', { join: Object.keys(c.after).join(', ') });
  return null;
}

// ── The form ─────────────────────────────────────────────────────────────

export interface SlabRow {
  key: number;
  min: string;
  max: string;
  type: SlabDiscountType;
  value: string;
  method: FlatDiscountMethod;
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));
let nextKey = 1;
export const newSlab = (over: Partial<SlabRow> = {}): SlabRow => ({ key: nextKey++, min: '', max: '', type: 'PERCENTAGE', value: '', method: 'PER_UNIT', ...over });

export const slabRowsFrom = (slabs: SchemeSlab[]) =>
  slabs.map(s =>
    newSlab({
      min: String(s.minQuantity),
      max: s.maxQuantity === null ? '' : String(s.maxQuantity),
      type: s.discountType,
      value: String(s.discountValue),
      method: s.flatDiscountMethod ?? 'PER_UNIT',
    }),
  );

/** The next slab starts just above the last one's maximum. */
export function addSlab(rows: SlabRow[], whole: boolean): SlabRow[] {
  const lastMax = rows.length ? num(rows[rows.length - 1].max) : null;
  const step = whole ? 1 : 0.001;
  return [...rows, newSlab({ min: lastMax !== null ? String(Math.round((lastMax + step) * 1000) / 1000) : '' })];
}

/** The slabs as customers will read them. */
export function slabPreview(rows: SlabRow[], unit: string) {
  return rows
    .filter(s => num(s.min) !== null && num(s.value) !== null)
    .map(s => {
      const slab = { id: String(s.key), minQuantity: num(s.min)!, maxQuantity: num(s.max), discountType: s.type, discountValue: num(s.value)!, flatMethod: s.type === 'FLAT' ? s.method : null };
      return { key: s.key, range: slabRangeLabel(slab, unit || 'units'), discount: slabDiscountLabel(slab, unit || 'unit') };
    });
}

/**
 * What the panel's inputs refuse (required, ≥ 0, ≤ 100%, whole units),
 * plus max ≥ min. Overlaps, open-ended slabs and units are checked by the
 * server, which explains what to change.
 */
export function slabsProblem(rows: SlabRow[], whole: boolean): string | null {
  if (!rows.length) return i18n.t('pricing.addAtLeastOneSlab');
  for (const [i, s] of rows.entries()) {
    const n = i18n.t('pricing.slabI', { i: i + 1 });
    const min = num(s.min);
    const max = num(s.max);
    const value = num(s.value);
    if (min === null || Number.isNaN(min) || min < 0) return i18n.t('pricing.nEnterTheQuantityItStarts', { n });
    if (max !== null && (Number.isNaN(max) || max < min)) return i18n.t('pricing.nTheMaximumCanTBe', { n });
    if (whole && (!Number.isInteger(min) || (max !== null && !Number.isInteger(max)))) return i18n.t('pricing.nQuantitiesAreWholeNumbersIn', { n });
    if (value === null || Number.isNaN(value) || value < 0) return i18n.t('pricing.nEnterTheDiscount', { n });
    if (s.type === 'PERCENTAGE' && value > 100) return i18n.t('pricing.nAPercentageCanBeAt', { n });
  }
  return null;
}

export interface SchemeForm {
  schemeName: string;
  productId: string;
  storeId: string;
  targetType: DiscountTargetType;
  aggregationMode: SchemeInput['aggregationMode'];
  variantIds: string[];
  stackWithCoupons: boolean;
  /** YYYY-MM-DD and HH:MM, the phone's local time. */
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  status: 'ACTIVE' | 'INACTIVE';
  unit: string;
  slabs: SlabRow[];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dateOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** A local date and time as a Date (time defaults to midnight). */
export function joinDateTime(date: string, time: string): Date | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

/** The panel's checks before saving, then the request body. */
export function schemeProblem(f: SchemeForm, whole: boolean): string | null {
  if (!f.productId) return i18n.t('pricing.chooseTheProduct');
  if (!f.schemeName.trim()) return i18n.t('pricing.giveTheSchemeAName');
  if (f.schemeName.trim().length > 150) return i18n.t('pricing.theSchemeNameCanBeAt');
  if (f.targetType === 'SPECIFIC_VARIANTS' && !f.variantIds.length) return i18n.t('pricing.selectAtLeastOneVariant');
  if (!f.startDate) return i18n.t('pricing.chooseWhenTheSchemeStarts');
  const starts = joinDateTime(f.startDate, f.startTime)!;
  const ends = joinDateTime(f.endDate, f.endTime || '23:59');
  if (ends && ends <= starts) return i18n.t('pricing.theEndMustBeAfterThe');
  if (!f.unit) return i18n.t('pricing.chooseTheQuantityUnit');
  return slabsProblem(f.slabs, whole);
}

export function schemeInput(f: SchemeForm): SchemeInput {
  const ends = joinDateTime(f.endDate, f.endTime || '23:59');
  return {
    schemeName: f.schemeName.trim(),
    productId: f.productId,
    storeId: f.storeId || null,
    targetType: f.targetType,
    aggregationMode: f.targetType === 'SIMPLE_PRODUCT' ? 'PER_VARIANT' : f.aggregationMode,
    variantIds: f.targetType === 'SPECIFIC_VARIANTS' ? f.variantIds : [],
    stackWithCoupons: f.stackWithCoupons,
    startsAt: joinDateTime(f.startDate, f.startTime)!.toISOString(),
    endsAt: ends ? ends.toISOString() : null,
    status: f.status,
    slabs: f.slabs.map(s => ({
      minQuantity: Number(s.min),
      maxQuantity: num(s.max),
      quantityUnit: f.unit,
      discountType: s.type,
      discountValue: Number(s.value),
      flatDiscountMethod: s.type === 'FLAT' ? s.method : null,
    })),
  };
}

/** Whole units (PCS, BOX…) first; weight and volume read best in KG / L. */
export function preferredUnit(units: { code: string; whole: boolean }[]) {
  return (units.find(u => u.whole) ?? units.find(u => ['KG', 'L', 'M', 'SQ_FT'].includes(u.code)) ?? units[0])?.code ?? '';
}
