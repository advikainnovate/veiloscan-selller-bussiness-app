import i18n from '../i18n';
import { monthShort } from './date';
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
    get label() { return i18n.t('products.text'); },
    get purpose() { return i18n.t('products.freeTextValue'); },
    get example() { return i18n.t('products.modelNumberAbc123'); },
    pill: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  {
    value: 'NUMBER',
    get label() { return i18n.t('products.number'); },
    get purpose() { return i18n.t('products.wholeNumber'); },
    get example() { return i18n.t('products.weight500'); },
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  {
    value: 'SELECT',
    get label() { return i18n.t('products.select'); },
    get purpose() { return i18n.t('products.selectOneOption'); },
    get example() { return i18n.t('products.materialSteel'); },
    pill: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  {
    value: 'MULTI_SELECT',
    label: 'Multi-select',
    get purpose() { return i18n.t('products.selectMultipleOptions'); },
    get example() { return i18n.t('products.usageHomeIndustrial'); },
    pill: 'bg-orange-50 text-orange-700 ring-orange-200',
  },
  {
    value: 'BOOLEAN',
    get label() { return i18n.t('products.yesNo'); },
    get purpose() { return i18n.t('products.yesOrNo'); },
    get example() { return i18n.t('products.waterproofYes'); },
    pill: 'bg-teal-50 text-teal-700 ring-teal-200',
  },
  {
    value: 'TEXTAREA',
    get label() { return i18n.t('products.longText'); },
    get purpose() { return i18n.t('products.longText'); },
    get example() { return i18n.t('products.careInstructions'); },
    pill: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
  {
    value: 'DATE',
    get label() { return i18n.t('common.date'); },
    get purpose() { return i18n.t('products.dateValue'); },
    get example() { return i18n.t('products.warrantyStartDate'); },
    pill: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  {
    value: 'DECIMAL',
    get label() { return i18n.t('products.decimal'); },
    get purpose() { return i18n.t('products.decimalNumber'); },
    get example() { return i18n.t('products.loadCapacity125'); },
    pill: 'bg-lime-50 text-lime-700 ring-lime-200',
  },
  {
    value: 'MEASUREMENT',
    get label() { return i18n.t('products.measurement'); },
    get purpose() { return i18n.t('products.numberWithAUnit'); },
    get example() { return i18n.t('products.productWeight500G'); },
    pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  },
  {
    value: 'RANGE',
    get label() { return i18n.t('products.range'); },
    get purpose() { return i18n.t('products.fromTo'); },
    get example() { return i18n.t('products.operatingTemperature20To80C'); },
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
    return value === 'true' ? i18n.t('common.yes') : value === 'false' ? i18n.t('common.no') : value;
  if (type === 'DATE' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    // 05 Mar 2026
    return `${String(d).padStart(2, '0')} ${monthShort(m - 1)} ${y}`;
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
    get label() { return i18n.t('products.sameForAllVariants'); },
    get hint() { return i18n.t('products.enteredOncePerProductBrandProcessor'); },
  },
  {
    value: 'VARIANT',
    get label() { return i18n.t('products.perVariant'); },
    get hint() { return i18n.t('products.enteredForEachSkuRamThat'); },
  },
  {
    value: 'BOTH',
    get label() { return i18n.t('products.sharedCanDiffer'); },
    get hint() { return i18n.t('products.aProductValueEachSkuMay'); },
  },
];
