import i18n from '../i18n';
// Ported from the Seller Panel's src/lib/variant-types.ts — keep the two in step.
// Variant attribute types (eshop-backend src/modules/variant-master).

export type VariantType = 'SELECT' | 'MEASUREMENT' | 'NUMERIC' | 'TEXT';
export type MeasurementType =
  | 'LENGTH'
  | 'WEIGHT'
  | 'VOLUME'
  | 'STORAGE'
  | 'FREQUENCY'
  | 'ELECTRICAL'
  | 'COUNT'
  | 'ROTATIONAL_SPEED'
  | 'TORQUE';

export const VARIANT_TYPES: {
  value: VariantType;
  label: string;
  hint: string;
}[] = [
  {
    value: 'SELECT',
    get label() { return i18n.t('products.listSelect'); },
    get hint() { return i18n.t('products.pickedFromAListOfValues'); },
  },
  {
    value: 'MEASUREMENT',
    get label() { return i18n.t('products.measurement'); },
    get hint() { return i18n.t('products.aNumberWithAUnitLength'); },
  },
  { value: 'NUMERIC', get label() { return i18n.t('products.number'); }, get hint() { return i18n.t('products.aPlainNumberPackSize6'); } },
  { value: 'TEXT', get label() { return i18n.t('products.text'); }, get hint() { return i18n.t('products.typedInPerProduct'); } },
];

export const MEASUREMENT_TYPES: { value: MeasurementType; label: string }[] = [
  { value: 'LENGTH', get label() { return i18n.t('products.lengthMmCmMInFt'); } },
  { value: 'WEIGHT', get label() { return i18n.t('products.weightGMgKgLbOz'); } },
  { value: 'VOLUME', get label() { return i18n.t('products.volumeMlLGal'); } },
  { value: 'STORAGE', get label() { return i18n.t('products.storageKbMbGbTb'); } },
  { value: 'FREQUENCY', get label() { return i18n.t('products.frequencyHzKhzMhzGhz'); } },
  { value: 'ELECTRICAL', get label() { return i18n.t('products.electricalVAWWhMah'); } },
  { value: 'COUNT', get label() { return i18n.t('products.countPcsPairDozen'); } },
  { value: 'ROTATIONAL_SPEED', get label() { return i18n.t('products.rotationalSpeedRpmRps'); } },
  { value: 'TORQUE', get label() { return i18n.t('products.torqueNmNcmKgfcmLbft'); } },
];

export function variantTypeLabel(
  type: unknown,
  measurementType?: unknown,
): string {
  const label =
    VARIANT_TYPES.find(t => t.value === type)?.label ?? i18n.t('products.listSelect');
  return type === 'MEASUREMENT' && measurementType
    ? `${label} · ${String(measurementType).toLowerCase()}`
    : label;
}

// Units per measurement type; the first is the base unit values are normalized to.
export type MeasurementUnits = Record<
  MeasurementType,
  { code: string; label: string; factor: number }[]
>;

export interface OptionSet {
  id: string;
  idd: string;
  variantId: string;
  setCode: string;
  title: string;
  description: string | null;
  sequence: number;
  status: number;
  valueCount: number;
  categoryCount: number;
}

// Which of an attribute's (or a unit's) global options a category allows.
export type SelectionMode = 'ALL' | 'SELECTED' | 'ALL_EXCEPT';

export const SELECTION_MODES: {
  value: SelectionMode;
  label: string;
  hint: string;
}[] = [
  {
    value: 'SELECTED',
    get label() { return i18n.t('common.selected'); },
    get hint() { return i18n.t('products.onlyTheOptionsTickedBelow'); },
  },
  {
    value: 'ALL',
    get label() { return i18n.t('common.all'); },
    get hint() { return i18n.t('products.everyActiveOptionIncludingOnesAdded'); },
  },
  {
    value: 'ALL_EXCEPT',
    get label() { return i18n.t('products.allExcept'); },
    get hint() { return i18n.t('products.everyActiveOptionExceptTheOnes'); },
  },
];

// A measurement unit a category allows, with its own selection mode.
export interface UnitRule {
  unit: string;
  selectionMode: SelectionMode;
  // Allowed (SELECTED) or excluded (ALL_EXCEPT) option ids.
  optionIds: string[];
}

export interface CategoryVariantRules {
  variantId: string;
  variantType: string;
  optionSetId: string | null;
  optionSelectionMode: SelectionMode;
  optionIds: string[];
  units: UnitRule[];
}

interface VariantValueRow {
  id?: unknown;
  variantId?: unknown;
  optionSetId?: unknown;
  numericValue?: unknown;
  unit?: unknown;
  status?: unknown;
}

const modeAllows = (mode: SelectionMode, ids: string[], id: string) =>
  mode === 'SELECTED'
    ? ids.includes(id)
    : mode === 'ALL_EXCEPT'
    ? !ids.includes(id)
    : true;

/**
 * The active values a category mapping offers products (as the backend's
 * product configuration does): list values in the mapping's option set (or
 * in no set), numbers with a number, measurements in an allowed unit — each
 * filtered by the selection mode (per unit for measurements).
 */
export function offeredValues<T extends VariantValueRow>(
  values: T[],
  link: CategoryVariantRules,
): T[] {
  return values.filter(o => {
    if (o.variantId !== link.variantId || Number(o.status ?? 1) !== 1)
      return false;
    const id = o.id as string;
    if (link.variantType === 'MEASUREMENT') {
      const unit = link.units.find(u => u.unit === o.unit);
      return (
        o.numericValue != null &&
        !!unit &&
        modeAllows(unit.selectionMode, unit.optionIds, id)
      );
    }
    if (
      link.variantType === 'SELECT' &&
      ((o.optionSetId as string | null) ?? null) !== (link.optionSetId || null)
    )
      return false;
    if (link.variantType === 'NUMERIC' && o.numericValue == null) return false;
    return modeAllows(link.optionSelectionMode, link.optionIds, id);
  });
}

export function selectionSummary(mode: SelectionMode, count: number): string {
  return mode === 'ALL'
    ? i18n.t('products.allOptions')
    : mode === 'SELECTED'
    ? i18n.t('products.countSelected', { count })
    : i18n.t('products.allExceptCount', { count });
}
