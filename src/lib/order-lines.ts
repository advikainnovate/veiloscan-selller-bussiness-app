// Order-line rules for self orders, from the Seller Panel's
// components/dashboard/orders/quantity-control.tsx and order-items-table.tsx
// (the non-UI parts). The server checks everything again.
import type { CatalogItem } from '../services/seller-order-service';
import { formatRupees } from './format';
import type { LineQuantityDiscount } from './seller-order-pricing';
import { slabDiscountLabel, slabRangeLabel } from './quantity-discount';
import {
  amountLabel,
  convert,
  inSellingUnits,
  invoiceLine,
  quantityLabel,
  quantityProblem,
  round4,
  sellingOf,
  startQuantity,
  type Selling,
} from './selling';
import i18n from '../i18n';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface OrderLine {
  item: CatalogItem;
  /** In `uom`: whole units for fixed selling, an amount (750 GM) for variable. */
  quantity: number;
  uom: string;
  /** ₹ off the whole line, as typed. */
  discount: string;
}

/** The smallest whole-unit order of a fixed-quantity item. */
function fixedMinimum(item: CatalogItem, selling: Selling) {
  return Math.max(item.minimumQuantity, selling.minimum ?? 1);
}

/** What a new line of the item starts at: the minimum (or one step), in the selling unit. */
export function startOf(item: CatalogItem): { quantity: number; uom: string } {
  const selling = sellingOf(item);
  return { quantity: selling.method === 'FIXED' ? fixedMinimum(item, selling) : startQuantity(selling), uom: selling.sellingUom };
}

/** Why the quantity can't be ordered (unit, decimals, min / max / step), or null. Stock is checked separately. */
export function quantityIssue(item: CatalogItem, quantity: number, uom: string): string | null {
  const selling = sellingOf(item);
  if (selling.method === 'FIXED' && quantity < fixedMinimum(item, selling)) {
    return i18n.t('orders.theMinimumIsReplace', { replace: amountLabel(selling, fixedMinimum(item, selling), selling.sellingUom).replace('× ', '') });
  }
  return quantityProblem(selling, quantity, uom, null);
}

/** The amount, readable: "× 3", "750 GM". */
export function lineAmount(item: CatalogItem, quantity: number, uom: string) {
  return amountLabel(sellingOf(item), quantity, uom);
}

/** "₹5 / 50 GM · Min 50 GM · Steps of 50 GM" — the rules a variable item is sold by. */
export function rulesHint(item: CatalogItem): string | null {
  const selling = sellingOf(item);
  if (selling.method !== 'VARIABLE') return null;
  const unit = selling.sellingUom;
  return [
    selling.priceLabel,
    selling.minimum !== null ? i18n.t('orders.minQuantitylabel', { quantityLabel: quantityLabel(selling.minimum, unit) }) : null,
    selling.maximum !== null ? i18n.t('orders.maxQuantitylabel', { quantityLabel: quantityLabel(selling.maximum, unit) }) : null,
    selling.step ? i18n.t('orders.stepsOfQuantitylabel', { quantityLabel: quantityLabel(selling.step, unit) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Adds `quantity` in `uom` to a line's amount, kept in the line's unit. */
export function addAmount(item: CatalogItem, line: { quantity: number; uom: string }, quantity: number, uom: string): number {
  return round4(line.quantity + convert(sellingOf(item), quantity, uom, line.uom));
}

/** The amount in the item's selling unit (what its stock is counted in). */
export function sellingAmount(item: CatalogItem, quantity: number, uom: string): number {
  return inSellingUnits(sellingOf(item), quantity, uom);
}

/** Items for "Total Items": fixed units counted, a measured amount (750 GM) is one item. */
export function itemCount(lines: OrderLine[]) {
  return lines.reduce((n, l) => n + (sellingOf(l.item).method === 'FIXED' ? l.quantity : 1), 0);
}

/** The line before any discount, as the server bills it. */
export function lineBase(line: OrderLine) {
  const { count, unitPrice } = invoiceLine(sellingOf(line.item), line.quantity, line.uom, line.item.price);
  return round2(unitPrice * count);
}

/** What's wrong with the line's quantity or discount, or null. `quantityOff`: its quantity discount, taken first. */
export function lineProblem(line: OrderLine, quantityOff = 0) {
  const issue = quantityIssue(line.item, line.quantity, line.uom);
  if (issue) return issue;
  const base = round2(lineBase(line) - quantityOff);
  if (Number(line.discount) > base) return i18n.t('orders.moreThanTheLineTotalBase', { base: formatRupees(base) });
  if (Number(line.discount) < 0) return i18n.t('orders.aDiscountCanTBeNegative');
  return null;
}

/** Ordered beyond the stock: allowed, the stock goes below 0. Stock is in the selling unit. */
export function stockShortfall(line: OrderLine): string | null {
  const { stock } = line.item;
  const selling = sellingOf(line.item);
  const wanted = sellingAmount(line.item, line.quantity, line.uom);
  if (stock === null || wanted <= stock) return null;
  const unit = selling.sellingUom === 'PCS' ? '' : ` ${selling.sellingUom}`;
  return i18n.t(stock <= 0 ? 'orders.outOfStockWouldGoTo' : 'orders.onlyInStockWouldGoTo', { stock: `${round2(stock)}${unit}`, after: `${round2(stock - wanted)}${unit}` });
}

/** The price as the item is sold: "₹5 / 50 GM" for an amount, "₹499" a unit otherwise. */
export function priceText(item: CatalogItem) {
  const selling = sellingOf(item);
  return selling.method === 'VARIABLE' && selling.priceLabel ? selling.priceLabel : formatRupees(item.price);
}

/** "Bulk buy · 10% off at 10–24 PCS: −₹600", and "Add 3 more PCS for 10% off". */
export function quantityNotes(quantity: LineQuantityDiscount | null): { earned: string | null; next: string | null } {
  if (!quantity) return { earned: null, next: null };
  const { scheme, discount, slab, qualifying, next } = quantity;
  const combined = scheme.aggregation === 'COMBINED_PRODUCT' ? i18n.t('orders.allVariantsTogether') : '';
  const more = next ? round4(next.minQuantity - qualifying) : 0;
  return {
    earned:
      discount > 0 && slab
        ? i18n.t('orders.schemenameSlabdiscountlabelAtSlabrangelabelCombinedDiscount', { schemeName: scheme.schemeName, slabDiscountLabel: slabDiscountLabel(slab, scheme.unit), slabRangeLabel: slabRangeLabel(slab, scheme.unit), combined, discount: formatRupees(discount) })
        : null,
    next: next ? i18n.t('orders.addMoreForDiscount', { more, unit: scheme.unit, combined, discount: slabDiscountLabel(next, scheme.unit) }) : null,
  };
}
