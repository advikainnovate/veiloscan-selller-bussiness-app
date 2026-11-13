import i18n from '../i18n';
// Ported verbatim from the Seller Panel's src/lib/selling.ts — keep the two in step.
/**
 * How a SKU is bought, as sent by eshop-backend (src/modules/selling), and
 * the same quantity checks and pricing the server does — so the order form can
 * explain a problem before the order is placed. The server checks again.
 */
export type Selling = {
  /** FIXED: whole selling units. VARIABLE: an amount the customer enters (1.5 KG). */
  method: 'FIXED' | 'VARIABLE';
  sellingType: string;
  sellingUom: string;
  baseUom: string;
  /** Units the customer may enter; factor = base units in one. The selling unit comes first. */
  units: { code: string; factor: number }[];
  /** Base units in one selling unit. */
  sellingFactor: number;
  /** In the selling unit. */
  minimum: number | null;
  maximum: number | null;
  step: number | null;
  allowDecimal: boolean;
  precision: number;
  /** Base units the SKU's price is for: price = base quantity ÷ priceBasis × price. */
  priceBasis: number;
  priceUom: string;
  priceQuantity: number;
  /** "₹2 / 10 GM" */
  priceLabel: string;
  quickSelect: { quantity: number; uom: string }[];
};

/** Sold as whole pieces (SKUs without a selling configuration, or an older API). */
export const PIECES: Selling = {
  method: 'FIXED',
  sellingType: 'FIXED_UNIT',
  sellingUom: 'PCS',
  baseUom: 'PCS',
  units: [{ code: 'PCS', factor: 1 }],
  sellingFactor: 1,
  minimum: 1,
  maximum: null,
  step: 1,
  allowDecimal: false,
  precision: 0,
  priceBasis: 1,
  priceUom: 'PCS',
  priceQuantity: 1,
  priceLabel: '',
  quickSelect: [],
};

export const round4 = (v: number) => Math.round(v * 10000) / 10000;
const round2 = (v: number) => Math.round(v * 100) / 100;

const decimalsOf = (v: number) => {
  const text = String(round4(v));
  return text.includes('.') ? text.split('.')[1].length : 0;
};

export function factorOf(selling: Selling, uom: string): number | null {
  return selling.units.find(u => u.code === uom)?.factor ?? null;
}

/** Price of a quantity entered in `uom` (1.5 KG at ₹2 / 10 GM = ₹300). */
export function priceOf(
  selling: Selling,
  quantity: number,
  uom: string,
  price: number,
): number {
  const factor = factorOf(selling, uom) ?? selling.sellingFactor;
  return round2(((quantity * factor) / selling.priceBasis) * price);
}

/** "1.5 KG" */
export function quantityLabel(quantity: number, uom: string) {
  return `${round4(quantity)} ${uom}`;
}

/** The amount in another unit, e.g. 1500 GM → 1.5 KG. */
export function convert(
  selling: Selling,
  quantity: number,
  from: string,
  to: string,
): number {
  const a = factorOf(selling, from);
  const b = factorOf(selling, to);
  return a && b ? round4((quantity * a) / b) : quantity;
}

/**
 * What's wrong with a quantity, or null when it can be bought. `available`
 * is the stock in selling units (null: not tracked).
 */
export function quantityProblem(
  selling: Selling,
  quantity: number,
  uom: string,
  available: number | null,
): string | null {
  const factor = factorOf(selling, uom);
  if (factor === null)
    return i18n.t('orders.thisIsSoldInJoin', { join: selling.units.map(u => u.code).join(', ') });
  if (!Number.isFinite(quantity) || quantity <= 0)
    return i18n.t('orders.enterAQuantityAbove0');
  const unit = selling.sellingUom;
  if (selling.method === 'FIXED' && !Number.isInteger(quantity))
    return i18n.t('orders.thisIsSoldInWholeUom', { uom });
  const inSelling = round4((quantity * factor) / selling.sellingFactor);
  if (!selling.allowDecimal && !Number.isInteger(inSelling))
    return i18n.t('orders.chooseAWholeNumberOfUnit', { unit });
  if (selling.allowDecimal && decimalsOf(inSelling) > selling.precision)
    return i18n.t('orders.useAtMostDecimalPlaces', { count: selling.precision, unit });
  if (selling.minimum !== null && inSelling < selling.minimum - 1e-9)
    return i18n.t('orders.theMinimumIsQuantitylabel', { quantityLabel: quantityLabel(selling.minimum, unit) });
  if (selling.maximum !== null && inSelling > selling.maximum + 1e-9)
    return i18n.t('orders.theMaximumIsQuantitylabel', { quantityLabel: quantityLabel(selling.maximum, unit) });
  if (selling.step) {
    const steps = inSelling / selling.step;
    if (Math.abs(steps - Math.round(steps)) > 1e-6)
      return i18n.t('orders.chooseAQuantityInStepsOf', { quantityLabel: quantityLabel(
        selling.step,
        unit,
      ) });
  }
  if (available !== null && inSelling > available + 1e-9)
    return available > 0
      ? i18n.t('orders.onlyQuantitylabelLeftInStock', { quantityLabel: quantityLabel(available, unit) })
      : i18n.t('common.outOfStock2');
  return null;
}

/** The most a customer can take, in selling units (maximum and stock). */
export function maxSelling(
  selling: Selling,
  available: number | null,
): number | null {
  const limits = [selling.maximum, available].filter(
    (v): v is number => v !== null,
  );
  return limits.length ? Math.min(...limits) : null;
}

/** The starting quantity, in selling units. */
export function startQuantity(selling: Selling): number {
  return Math.max(selling.minimum ?? 0, selling.step ?? 0) || 1;
}

/** The amount in selling units (1500 GM → 1.5 KG when sold in KG). */
export function inSellingUnits(
  selling: Selling,
  quantity: number,
  uom: string,
): number {
  return round4(
    (quantity * (factorOf(selling, uom) ?? selling.sellingFactor)) /
      selling.sellingFactor,
  );
}

/**
 * How the server bills a line (storefront-order placeOrder): fixed selling
 * is `count` units at the price of one; a variable amount is one unit
 * priced for the whole amount (750 GM at ₹5 / 50 GM = 1 × ₹75).
 */
export function invoiceLine(
  selling: Selling,
  quantity: number,
  uom: string,
  price: number,
): { count: number; unitPrice: number } {
  if (selling.method === 'FIXED')
    return { count: quantity, unitPrice: priceOf(selling, 1, uom, price) };
  return { count: 1, unitPrice: priceOf(selling, quantity, uom, price) };
}

/** "× 3" for pieces, "3 BOX", "750 GM". */
export function amountLabel(
  selling: Selling,
  quantity: number,
  uom: string,
): string {
  return selling.method === 'FIXED' && uom === 'PCS'
    ? `× ${round4(quantity)}`
    : quantityLabel(quantity, uom);
}

/** A catalog item's selling rules; whole pieces when an older API sent none. */
export const sellingOf = (item: { selling?: Selling }): Selling =>
  item.selling ?? PIECES;
