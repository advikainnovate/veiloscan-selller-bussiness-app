// Ported from the Seller Panel's src/lib/product-wizard-helpers.ts — keep the two in step.
export function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// "one, two; three" (or one per line) → ["one", "two", "three"]: trimmed,
// empty parts dropped, repeats (any letter case) kept once.
export function splitTags(text: string): string[] {
  const seen = new Set<string>();
  return (text || '')
    .split(/[,;\n\r\t]+/)
    .map(t => t.trim().replace(/\s+/g, ' '))
    .filter(t => {
      const key = t.toLowerCase();
      if (!t || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function cartesianProduct<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>(
    (acc, group) => acc.flatMap(combo => group.map(item => [...combo, item])),
    [[]],
  );
}

export const LENGTH_UNIT_OPTIONS = ['MM', 'CM', 'M', 'INCH', 'FT'];
export const WEIGHT_UNIT_OPTIONS = ['MG', 'G', 'KG', 'LB'];
export const ITEM_CONDITION_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'USED', label: 'Used' },
  { value: 'REFURBISHED', label: 'Refurbished' },
];
