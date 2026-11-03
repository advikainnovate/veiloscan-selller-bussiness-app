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

export const TARGET_LABEL: Record<DiscountTargetType, string> = {
  ALL_VARIANTS: 'All variants',
  SPECIFIC_VARIANTS: 'Specific variants',
  SIMPLE_PRODUCT: 'Product without variants',
};

export const STATES: SchemeState[] = ['RUNNING', 'SCHEDULED', 'ENDED', 'INACTIVE'];
export const STATE_BADGE: Record<SchemeState, { label: string; tone: BadgeTone }> = {
  RUNNING: { label: 'Running', tone: 'green' },
  SCHEDULED: { label: 'Scheduled', tone: 'amber' },
  ENDED: { label: 'Ended', tone: 'slate' },
  INACTIVE: { label: 'Inactive', tone: 'slate' },
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
  CREATED: 'Created',
  UPDATED: 'Details changed',
  VARIANTS_CHANGED: 'Variants changed',
  SLABS_CHANGED: 'Slabs changed',
  STATUS_CHANGED: 'Status changed',
  DELETED: 'Deleted',
};

export function auditSummary(entry: SchemeAuditEntry, skus: SchemeSku[]): string | null {
  const c = entry.changes as Record<string, unknown> | null;
  if (!c) return null;
  const name = (id: string) => skus.find(s => s.id === id)?.label ?? 'a variant';
  if (entry.action === 'VARIANTS_CHANGED') {
    const added = (c.added as string[]) ?? [];
    const removed = (c.removed as string[]) ?? [];
    return [added.length ? `Added ${added.map(name).join(', ')}` : null, removed.length ? `Removed ${removed.map(name).join(', ')}` : null].filter(Boolean).join(' · ');
  }
  if (entry.action === 'STATUS_CHANGED') return `${String(c.before)} → ${String(c.after)}`;
  if (entry.action === 'UPDATED' && c.after && typeof c.after === 'object') return `Changed ${Object.keys(c.after).join(', ')}`;
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
  if (!rows.length) return 'Add at least one slab';
  for (const [i, s] of rows.entries()) {
    const n = `Slab ${i + 1}`;
    const min = num(s.min);
    const max = num(s.max);
    const value = num(s.value);
    if (min === null || Number.isNaN(min) || min < 0) return `${n}: enter the quantity it starts from`;
    if (max !== null && (Number.isNaN(max) || max < min)) return `${n}: the maximum can't be below the minimum`;
    if (whole && (!Number.isInteger(min) || (max !== null && !Number.isInteger(max)))) return `${n}: quantities are whole numbers in this unit`;
    if (value === null || Number.isNaN(value) || value < 0) return `${n}: enter the discount`;
    if (s.type === 'PERCENTAGE' && value > 100) return `${n}: a percentage can be at most 100`;
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
  if (!f.productId) return 'Choose the product';
  if (!f.schemeName.trim()) return 'Give the scheme a name';
  if (f.schemeName.trim().length > 150) return 'The scheme name can be at most 150 characters';
  if (f.targetType === 'SPECIFIC_VARIANTS' && !f.variantIds.length) return 'Select at least one variant';
  if (!f.startDate) return 'Choose when the scheme starts';
  const starts = joinDateTime(f.startDate, f.startTime)!;
  const ends = joinDateTime(f.endDate, f.endTime || '23:59');
  if (ends && ends <= starts) return 'The end must be after the start';
  if (!f.unit) return 'Choose the quantity unit';
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
