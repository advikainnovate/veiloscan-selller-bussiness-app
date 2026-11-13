// Ported verbatim from the Seller Panel's src/lib/quantity-discount.ts — keep the two in step.
import { formatNumber } from './format';
import i18n from '../i18n';
// Copy of eshop-backend/src/modules/quantity-discounts/engine/quantity-discount-engine.ts —
// keep the two identical (the server applies the same arithmetic to the order).

/**
 * Quantity discount slabs — the arithmetic, with no dependencies, so the
 * Seller Panel and the shop carry exact copies of this file (as they do for
 * the selling rules) and show the same discount the order gets. The server
 * resolves which scheme applies to each SKU; this only prices it.
 *
 * Rules:
 * - A line's qualifying quantity is in the scheme's unit: base quantity ÷
 *   (base units in one scheme unit). 1.5 KG is 1500 toward a GM slab.
 * - PER_VARIANT: each SKU qualifies on its own quantity. COMBINED_PRODUCT:
 *   the quantities of every line the scheme covers are added up, and the
 *   slab they reach applies to each of those lines.
 * - A slab matches when min ≤ quantity ≤ max (no max = no upper limit).
 *   A scheme's slabs never overlap, so at most one matches.
 * - PERCENTAGE: that % of each covered line. FLAT PER_UNIT: the amount per
 *   scheme unit of each line (₹15 per PCS). FLAT PER_ORDER: the amount once
 *   per group (per SKU, or per product when combined), shared across the
 *   group's lines in proportion to their value.
 * - Rounded to paise per line; a shared amount is split in paise with the
 *   last line taking the remainder. A line invoiced as N equal units (fixed
 *   selling: 6 PCS) gets a whole number of paise off each unit, so the
 *   invoice's unit price is exact (5% of 6 × ₹562.50 = 6 × ₹28.13). A line
 *   never gets more off than it's worth.
 */

export type QuantityDiscountType = 'PERCENTAGE' | 'FLAT';
export type FlatDiscountMethod = 'PER_UNIT' | 'PER_ORDER';
export type QuantityAggregation = 'PER_VARIANT' | 'COMBINED_PRODUCT';
export type QuantityDiscountTarget =
  | 'ALL_VARIANTS'
  | 'SPECIFIC_VARIANTS'
  | 'SIMPLE_PRODUCT';

export interface QuantitySlab {
  id: string;
  minQuantity: number;
  // null: no upper limit (the highest slab only).
  maxQuantity: number | null;
  discountType: QuantityDiscountType;
  discountValue: number;
  // FLAT only.
  flatMethod: FlatDiscountMethod | null;
}

/** The scheme that applies to one SKU, as the server resolved it. */
export interface SkuQuantityScheme {
  schemeId: string;
  schemeName: string;
  productId: string;
  targetType: QuantityDiscountTarget;
  aggregation: QuantityAggregation;
  // Whether a coupon may also be used on the lines this discounts.
  stackWithCoupons: boolean;
  // The unit slab quantities are in (PCS, GM, KG, BOX…).
  unit: string;
  // Base units of this SKU in one `unit` (1000 for KG when stock is in GM).
  unitFactor: number;
  // Lowest first.
  slabs: QuantitySlab[];
}

export interface QuantityDiscountLine {
  key: string;
  // In the SKU's base unit.
  baseQuantity: number;
  // The line's value before any discount (₹).
  amount: number;
  // Invoiced as this many equal units (fixed selling); 1 for a measured amount.
  units?: number;
  scheme: SkuQuantityScheme | null;
}

export interface AppliedQuantityDiscount {
  key: string;
  schemeId: string;
  slabId: string;
  // What reached the slab, in the scheme's unit (the group's total when combined).
  qualifyingQuantity: number;
  // ₹ off this line.
  discount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const EPSILON = 1e-9;

/** The line's quantity in the scheme's unit. */
export function inSchemeUnits(scheme: SkuQuantityScheme, baseQuantity: number) {
  return round4(baseQuantity / scheme.unitFactor);
}

/** The slab a quantity (in the scheme's unit) reaches, if any. */
export function slabFor(
  slabs: QuantitySlab[],
  quantity: number,
): QuantitySlab | null {
  return (
    slabs.find(
      s =>
        quantity >= s.minQuantity - EPSILON &&
        (s.maxQuantity === null || quantity <= s.maxQuantity + EPSILON),
    ) ?? null
  );
}

/** The next better slab above a quantity, to say "add N more for …". */
export function nextSlab(
  slabs: QuantitySlab[],
  quantity: number,
): QuantitySlab | null {
  return (
    [...slabs]
      .sort((a, b) => a.minQuantity - b.minQuantity)
      .find(s => s.minQuantity > quantity + EPSILON) ?? null
  );
}

/** Splits `total` across `weights` in proportion, in paise; the last part takes the rounding. */
function splitProportionally(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!total || !sum) return weights.map(() => 0);
  const paise = Math.round(total * 100);
  let left = paise;
  return weights.map((w, i) => {
    const part =
      i === weights.length - 1 ? left : Math.round((paise * w) / sum);
    left -= part;
    return part / 100;
  });
}

/**
 * The quantity discount of each line that gets one. Lines without a
 * scheme, or below every slab, aren't in the result.
 */
export function applyQuantityDiscounts(
  lines: QuantityDiscountLine[],
): Map<string, AppliedQuantityDiscount> {
  const result = new Map<string, AppliedQuantityDiscount>();
  const groups = new Map<string, QuantityDiscountLine[]>();
  for (const line of lines) {
    const scheme = line.scheme;
    if (!scheme || !(scheme.unitFactor > 0) || line.amount <= 0) continue;
    const group =
      scheme.aggregation === 'COMBINED_PRODUCT'
        ? scheme.schemeId
        : `${scheme.schemeId}:${line.key}`;
    groups.set(group, [...(groups.get(group) ?? []), line]);
  }

  for (const group of groups.values()) {
    const scheme = group[0].scheme!;
    const quantities = group.map(l => inSchemeUnits(l.scheme!, l.baseQuantity));
    const qualifying = round4(quantities.reduce((s, q) => s + q, 0));
    const slab = slabFor(scheme.slabs, qualifying);
    if (!slab || slab.discountValue <= 0) continue;

    let offs: number[];
    if (slab.discountType === 'PERCENTAGE') {
      offs = group.map(l =>
        round2((l.amount * Math.min(slab.discountValue, 100)) / 100),
      );
    } else if (slab.flatMethod === 'PER_ORDER') {
      const worth = round2(group.reduce((s, l) => s + l.amount, 0));
      offs = splitProportionally(
        Math.min(slab.discountValue, worth),
        group.map(l => l.amount),
      );
    } else {
      offs = group.map((l, i) => round2(slab.discountValue * quantities[i]));
    }

    group.forEach((line, i) => {
      const units = line.units && line.units > 1 ? line.units : 1;
      const perUnit = round2(Math.max(0, offs[i]) / units);
      const discount = round2(Math.min(round2(perUnit * units), line.amount));
      if (discount <= 0) return;
      result.set(line.key, {
        key: line.key,
        schemeId: scheme.schemeId,
        slabId: slab.id,
        qualifyingQuantity: qualifying,
        discount,
      });
    });
  }
  return result;
}

/** "5–9 PCS", "25+ PCS", "1.5–3 KG". */
export function slabRangeLabel(slab: QuantitySlab, unit: string): string {
  const n = (v: number) => String(round4(v));
  return slab.maxQuantity === null
    ? `${n(slab.minQuantity)}+ ${unit}`
    : `${n(slab.minQuantity)}–${n(slab.maxQuantity)} ${unit}`;
}

/** "5% off", "₹15 off per PCS", "₹100 off". */
export function slabDiscountLabel(slab: QuantitySlab, unit: string): string {
  if (slab.discountType === 'PERCENTAGE')
    return i18n.t('common.discountvaluePercentOff', { discountValue: round4(slab.discountValue) });
  const amount = `₹${formatNumber(round2(slab.discountValue))}`;
  return slab.flatMethod === 'PER_ORDER'
    ? i18n.t('common.amountOff', { amount })
    : i18n.t('products.amountOffPerUnit', { amount, unit });
}
