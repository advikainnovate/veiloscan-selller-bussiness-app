import type { Uom } from '../services/products-service';

// From the Seller Panel's src/lib/inventory.ts.

/** Up to `digits` decimals with trailing zeros dropped, Indian grouping: 25,000.5 · 0.125. */
export function formatQuantity(v: number, digits = 3) {
  const [whole, fraction = ''] = Math.abs(v).toFixed(digits).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  const decimals = fraction.replace(/0+$/, '');
  return `${v < 0 ? '-' : ''}${grouped}${decimals ? `.${decimals}` : ''}`;
}

const READABLE_LADDER: Record<string, string[]> = {
  WEIGHT: ['MG', 'GM', 'KG', 'TON'],
  VOLUME: ['ML', 'L', 'KL'],
  LENGTH: ['MM', 'CM', 'M', 'KM'],
  AREA: ['SQ_CM', 'SQ_M'],
  CUBIC_VOLUME: ['CU_CM', 'CU_M'],
};

/**
 * An amount in its base unit as the largest metric unit it fills
 * (25000 GM → "25 KG", 750 GM → "750 GM"). `uoms` gives the factors.
 */
export function readableQty(base: number, baseUom: string, uoms: Pick<Uom, 'code' | 'stockType' | 'factorToBase'>[]): string {
  const unit = uoms.find(u => u.code === baseUom);
  const ladder = unit ? READABLE_LADDER[unit.stockType] : undefined;
  if (!unit || !ladder || unit.factorToBase === null || base === 0) return `${formatQuantity(base)} ${baseUom}`;
  const inTypeBase = base * Number(unit.factorToBase);
  const steps = ladder
    .map(code => uoms.find(u => u.code === code))
    .filter((u): u is NonNullable<typeof u> => !!u && u.factorToBase !== null);
  const best = [...steps].reverse().find(u => Math.abs(inTypeBase) >= Number(u.factorToBase)) ?? steps[0];
  return best ? `${formatQuantity(inTypeBase / Number(best.factorToBase))} ${best.code}` : `${formatQuantity(base)} ${baseUom}`;
}
