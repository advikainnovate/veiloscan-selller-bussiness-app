import i18n from '../i18n';
// Ported from the Seller Panel's src/lib/sku.ts — keep the two in step.
/** Product SKUs: 8–16 characters of letters, numbers, "-" and "_". */
export const SKU_MIN = 8;
export const SKU_MAX = 16;

/** Upper-cases and drops anything a SKU can't hold, as the user types. */
export function cleanSku(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, SKU_MAX);
}

/** "" when valid, otherwise what's wrong. Empty is reported by the caller's own required check. */
export function skuError(value: string): string {
  const sku = value.trim();
  if (!sku) return '';
  if (sku.length < SKU_MIN || sku.length > SKU_MAX)
    return i18n.t('products.skuMustBeSkuMinSku', { SKU_MIN, SKU_MAX, skuCount: sku.length });
  if (!/^[A-Z0-9][A-Z0-9_-]*$/i.test(sku))
    return i18n.t('products.useLettersNumbersHyphensAndUnderscores');
  return '';
}

function randomTail(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I lookalikes
  let out = '';
  for (let i = 0; i < length; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * A SKU from the product title: first word (up to 4 letters), initials of the
 * next words, any model numbers, then a random tail so repeats don't clash.
 * "AeroPC Business Desktop 120" → "AERO-BD120-7K2Q".
 */
export function generateSku(title: string): string {
  const words = title
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const letters = words.filter(w => /[A-Z]/.test(w));
  const numbers = words
    .filter(w => /^\d+$/.test(w))
    .join('')
    .slice(0, 4);
  const head = (letters[0] ?? '').replace(/\d/g, '').slice(0, 4);
  const initials = letters
    .slice(1, 4)
    .map(w => w[0])
    .join('');
  const body =
    [head, `${initials}${numbers}`].filter(Boolean).join('-') || 'SKU';
  // Room for "-" + a tail of at least 4, within the 16 cap.
  const base = body.slice(0, SKU_MAX - 5);
  const tail = randomTail(Math.max(4, SKU_MIN - base.length - 1));
  return `${base}-${tail}`.slice(0, SKU_MAX);
}
