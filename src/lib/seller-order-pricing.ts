// Ported verbatim from the Seller Panel's src/lib/seller-order-pricing.ts — keep the two in step.
import { formatNumber } from './format';
import type {
  CatalogItem,
  SellerCoupon,
} from '../services/seller-order-service';
import { factorOf, invoiceLine, sellingOf } from './selling';
import {
  applyQuantityDiscounts,
  nextSlab,
  slabFor,
  inSchemeUnits,
  type QuantitySlab,
  type SkuQuantityScheme,
} from './quantity-discount';
import i18n from '../i18n';

// Mirrors eshop-backend storefront-order.service placeOrder (seller orders) and
// utils/seller-order-pricing.util: line discounts first, then the seller's
// order discount, then the coupon — both shared across lines in proportion;
// each line's discounted unit price is invoiced (and taxed). A line is billed
// as the server bills it: N fixed units, or one unit for a measured amount.
// Quantity discount slabs come before everything else, and a coupon skips the
// lines they reduced unless their scheme allows coupons.

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export interface PricedLine {
  item: CatalogItem;
  // In `uom` (750 GM); whole units for fixed selling.
  quantity: number;
  uom: string;
  // ₹ off the whole line, as entered.
  discount: number;
}

export type OrderDiscountType = 'NONE' | 'FLAT' | 'PERCENTAGE';

export interface OrderDiscountInput {
  type: OrderDiscountType;
  // ₹ for FLAT, % for PERCENTAGE, as typed.
  value: number;
}

/** A line's quantity discount, and the next slab it could reach. */
export interface LineQuantityDiscount {
  scheme: SkuQuantityScheme;
  // ₹ off, and the slab earned (null: below every slab).
  discount: number;
  slab: QuantitySlab | null;
  // What counts toward the slab, in the scheme's unit (the product's total when combined).
  qualifying: number;
  next: QuantitySlab | null;
}

export interface OrderPricing {
  // Before any discount.
  gross: number;
  // Quantity discount slabs, in total and per line (null: no scheme).
  quantityOff: number;
  quantityDiscounts: (LineQuantityDiscount | null)[];
  lineDiscounts: number;
  // After line discounts: what the order discount is taken from.
  subtotal: number;
  orderDiscountOff: number;
  // Why the order discount can't be used (over the subtotal…), if it can't.
  orderDiscountProblem: string | null;
  couponOff: number;
  // Why the coupon doesn't apply (under its minimum…), if it doesn't.
  couponProblem: string | null;
  tax: number;
  total: number;
  lineTotals: number[];
}

export function couponDiscount(
  coupon: SellerCoupon,
  amount: number,
): { off: number; problem: string | null } {
  if (amount < coupon.minOrderValue)
    return {
      off: 0,
      problem: i18n.t('orders.codeNeedsAnOrderOfAt', { code: coupon.code, minOrderValue: coupon.minOrderValue }),
    };
  if (coupon.maxOrderValue && amount > coupon.maxOrderValue)
    return {
      off: 0,
      problem: i18n.t('orders.codeIsForOrdersUpTo', { code: coupon.code, maxOrderValue: coupon.maxOrderValue }),
    };
  const raw =
    coupon.discountType === 'PERCENTAGE'
      ? (amount * coupon.value) / 100
      : coupon.value;
  const capped = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
  return { off: round2(Math.min(capped, amount)), problem: null };
}

/** What an order discount takes off `amount` (after line discounts), or why it can't. */
export function orderDiscount(
  discount: OrderDiscountInput | null,
  amount: number,
): { off: number; problem: string | null } {
  if (!discount || discount.type === 'NONE') return { off: 0, problem: null };
  const value = discount.value;
  if (!Number.isFinite(value) || value < 0)
    return { off: 0, problem: i18n.t('orders.enterADiscountOf0Or') };
  if (discount.type === 'PERCENTAGE') {
    if (value > 100)
      return { off: 0, problem: i18n.t('orders.percentageMustBeBetween0And') };
    return { off: round2((amount * value) / 100), problem: null };
  }
  if (round2(value) > round2(amount))
    return {
      off: 0,
      problem: i18n.t('orders.flatDiscountCanTBeMore', { count: formatNumber(
        round2(amount),
      ) }),
    };
  return { off: round2(value), problem: null };
}

function splitProportionally(total: number, weights: number[]) {
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

export function priceOrder(
  lines: PricedLine[],
  coupon: SellerCoupon | null,
  taxInclusive: boolean,
  discount: OrderDiscountInput | null = null,
): OrderPricing {
  const billed = lines.map(l =>
    invoiceLine(sellingOf(l.item), l.quantity, l.uom, l.item.price),
  );
  const bases = billed.map(b => round2(b.unitPrice * b.count));
  const baseQuantity = (l: PricedLine) => {
    const selling = sellingOf(l.item);
    return l.quantity * (factorOf(selling, l.uom) ?? selling.sellingFactor);
  };
  const applied = applyQuantityDiscounts(
    lines.map((l, i) => ({
      key: l.item.variantId,
      baseQuantity: baseQuantity(l),
      amount: bases[i],
      units: billed[i].count,
      scheme: l.item.quantityDiscount ?? null,
    })),
  );
  // What counts toward each scheme's slab: the line, or every line it covers when combined.
  const quantityDiscounts = lines.map((l): LineQuantityDiscount | null => {
    const scheme = l.item.quantityDiscount;
    if (!scheme) return null;
    const qualifying =
      scheme.aggregation === 'COMBINED_PRODUCT'
        ? round4(
            lines
              .filter(
                o => o.item.quantityDiscount?.schemeId === scheme.schemeId,
              )
              .reduce(
                (s, o) =>
                  s + inSchemeUnits(o.item.quantityDiscount!, baseQuantity(o)),
                0,
              ),
          )
        : inSchemeUnits(scheme, baseQuantity(l));
    const got = applied.get(l.item.variantId);
    return {
      scheme,
      discount: got?.discount ?? 0,
      slab: got ? slabFor(scheme.slabs, qualifying) : null,
      qualifying,
      next: nextSlab(scheme.slabs, qualifying),
    };
  });
  const quantityOff = round2(
    quantityDiscounts.reduce((s, q) => s + (q?.discount ?? 0), 0),
  );
  const afterQuantity = bases.map((b, i) =>
    round2(b - (quantityDiscounts[i]?.discount ?? 0)),
  );
  const afterLine = lines.map((l, i) =>
    round2(
      afterQuantity[i] -
        Math.min(afterQuantity[i], Math.max(0, round2(l.discount))),
    ),
  );
  const subtotal = round2(afterLine.reduce((s, n) => s + n, 0));
  const { off: orderDiscountOff, problem: orderDiscountProblem } = lines.length
    ? orderDiscount(discount, subtotal)
    : { off: 0, problem: null };
  const orderShares = splitProportionally(orderDiscountOff, afterLine);
  const afterOrder = afterLine.map((n, i) => round2(n - orderShares[i]));
  // A coupon skips lines a quantity discount reduced, unless the scheme allows it.
  const couponable = quantityDiscounts.map(
    q => !q || q.discount <= 0 || q.scheme.stackWithCoupons,
  );
  const couponWeights = afterOrder.map((n, i) => (couponable[i] ? n : 0));
  const eligible = round2(couponWeights.reduce((s, n) => s + n, 0));
  const blocked =
    coupon && lines.length && eligible <= 0 && couponable.some(c => !c);
  const { off: couponOff, problem: couponProblem } = blocked
    ? {
        off: 0,
        problem: i18n.t('orders.codeCanTBeCombinedWith', { code: coupon.code }),
      }
    : coupon && lines.length
    ? couponDiscount(coupon, eligible)
    : { off: 0, problem: null };
  const shares = splitProportionally(couponOff, couponWeights);
  let tax = 0;
  const lineTotals = lines.map((l, i) => {
    const count = billed[i].count;
    const finalPrice = round2((afterOrder[i] - shares[i]) / count);
    const lineTotal = round2(finalPrice * count);
    const gst = l.item.gstPercentage;
    tax += round2(
      taxInclusive ? (lineTotal * gst) / (100 + gst) : (lineTotal * gst) / 100,
    );
    return lineTotal;
  });
  const gross = round2(bases.reduce((s, n) => s + n, 0));
  const net = round2(lineTotals.reduce((s, n) => s + n, 0));
  tax = round2(tax);
  return {
    gross,
    quantityOff,
    quantityDiscounts,
    lineDiscounts: round2(
      gross - net - couponOff - orderDiscountOff - quantityOff,
    ),
    subtotal,
    orderDiscountOff,
    orderDiscountProblem,
    couponOff,
    couponProblem,
    tax,
    total: taxInclusive ? net : round2(net + tax),
    lineTotals,
  };
}
