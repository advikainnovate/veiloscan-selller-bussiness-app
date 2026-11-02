// Ported from the Seller Panel's src/lib/specification-types.ts — keep the two in step.
// Mirrors eshop-backend src/modules/specifications/enums/specification-type.enum.ts.

export type SpecificationTypeValue =
  | 'TEXT'
  | 'NUMBER'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'BOOLEAN'
  | 'TEXTAREA'
  | 'DATE'
  | 'DECIMAL'
  | 'MEASUREMENT'
  | 'RANGE';

export interface SpecificationTypeMeta {
  value: SpecificationTypeValue;
  label: string;
  purpose: string;
  example: string;
  pill: string;
}

export const SPECIFICATION_TYPES: SpecificationTypeMeta[] = [
  {
    value: 'TEXT',
    label: 'Text',
    purpose: 'Free text value',
    example: 'Model Number → ABC-123',
    pill: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  {
    value: 'NUMBER',
    label: 'Number',
    purpose: 'Whole number',
    example: 'Weight → 500',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  {
    value: 'SELECT',
    label: 'Select',
    purpose: 'Select one option',
    example: 'Material → Steel',
    pill: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  {
    value: 'MULTI_SELECT',
    label: 'Multi-select',
    purpose: 'Select multiple options',
    example: 'Usage → Home, Industrial',
    pill: 'bg-orange-50 text-orange-700 ring-orange-200',
  },
  {
    value: 'BOOLEAN',
    label: 'Yes / No',
    purpose: 'Yes or No',
    example: 'Waterproof → Yes',
    pill: 'bg-teal-50 text-teal-700 ring-teal-200',
  },
  {
    value: 'TEXTAREA',
    label: 'Long text',
    purpose: 'Long text',
    example: 'Care Instructions',
    pill: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
  {
    value: 'DATE',
    label: 'Date',
    purpose: 'Date value',
    example: 'Warranty Start Date',
    pill: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  {
    value: 'DECIMAL',
    label: 'Decimal',
    purpose: 'Decimal number',
    example: 'Load Capacity → 12.5',
    pill: 'bg-lime-50 text-lime-700 ring-lime-200',
  },
  {
    value: 'MEASUREMENT',
    label: 'Measurement',
    purpose: 'Number with a unit',
    example: 'Product Weight → 500 g',
    pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  },
  {
    value: 'RANGE',
    label: 'Range',
    purpose: 'From – to',
    example: 'Operating Temperature → -20 to 80 °C',
    pill: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  },
];

// Types stored as numbers + unit (the category chooses the allowed units).
export function isStructuredSpecificationType(type: unknown): boolean {
  return type === 'MEASUREMENT' || type === 'RANGE';
}

// Types that can show a fixed unit label with their numbers (e.g. °C, W).
export function usesUnitLabel(type: unknown): boolean {
  return type === 'NUMBER' || type === 'DECIMAL' || type === 'RANGE';
}

const BY_VALUE = new Map(SPECIFICATION_TYPES.map(t => [t.value as string, t]));

// Older records may still say INPUT (now TEXT) or SELECT + multiselect.
export function normalizeSpecificationType(
  type: unknown,
  isMultiselect?: unknown,
): SpecificationTypeValue {
  const value = String(type ?? '').toUpperCase();
  if (value === 'INPUT') return 'TEXT';
  if (value === 'SELECT' && isMultiselect === true) return 'MULTI_SELECT';
  return (BY_VALUE.has(value) ? value : 'TEXT') as SpecificationTypeValue;
}

export function specificationTypeMeta(
  type: unknown,
  isMultiselect?: unknown,
): SpecificationTypeMeta {
  return BY_VALUE.get(
    normalizeSpecificationType(type, isMultiselect),
  ) as SpecificationTypeMeta;
}

// Types whose values are picked from the specification's options.
export function isOptionSpecificationType(type: unknown): boolean {
  return type === 'SELECT' || type === 'MULTI_SELECT';
}

// How a stored value reads: booleans as Yes / No, dates as "28 Sep 2026".
export function formatSpecificationValue(
  type: unknown,
  value: string | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'BOOLEAN')
    return value === 'true' ? 'Yes' : value === 'false' ? 'No' : value;
  if (type === 'DATE' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  return value;
}

// Where a category's products keep a specification's value (mirrors
// eshop-backend categorywise-specifications/enums/specification-scope.enum.ts).
export type SpecificationScope = 'PRODUCT' | 'VARIANT' | 'BOTH';

export const SPECIFICATION_SCOPES: {
  value: SpecificationScope;
  label: string;
  hint: string;
}[] = [
  {
    value: 'PRODUCT',
    label: 'Same for all variants',
    hint: 'Entered once per product (Brand, Processor).',
  },
  {
    value: 'VARIANT',
    label: 'Per variant',
    hint: 'Entered for each SKU (RAM that differs between storage options).',
  },
  {
    value: 'BOTH',
    label: 'Shared, can differ',
    hint: 'A product value each SKU may override.',
  },
];
