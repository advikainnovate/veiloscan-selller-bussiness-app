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
    label: 'List (Select)',
    hint: 'Picked from a list of values — Color, Material, Size.',
  },
  {
    value: 'MEASUREMENT',
    label: 'Measurement',
    hint: 'A number with a unit — Length 20 mm, Weight 1.5 kg.',
  },
  { value: 'NUMERIC', label: 'Number', hint: 'A plain number — Pack Size 6.' },
  { value: 'TEXT', label: 'Text', hint: 'Typed in per product.' },
];

export const MEASUREMENT_TYPES: { value: MeasurementType; label: string }[] = [
  { value: 'LENGTH', label: 'Length (mm, cm, m, in, ft)' },
  { value: 'WEIGHT', label: 'Weight (g, mg, kg, lb, oz, ton)' },
  { value: 'VOLUME', label: 'Volume (ml, l, gal)' },
  { value: 'STORAGE', label: 'Storage (KB, MB, GB, TB)' },
  { value: 'FREQUENCY', label: 'Frequency (Hz, kHz, MHz, GHz)' },
  { value: 'ELECTRICAL', label: 'Electrical (V, A, W, Wh, mAh…)' },
  { value: 'COUNT', label: 'Count (pcs, pair, dozen)' },
  { value: 'ROTATIONAL_SPEED', label: 'Rotational speed (rpm, rps)' },
  { value: 'TORQUE', label: 'Torque (Nm, Ncm, kgfcm, lbft)' },
];

export function variantTypeLabel(
  type: unknown,
  measurementType?: unknown,
): string {
  const label =
    VARIANT_TYPES.find(t => t.value === type)?.label ?? 'List (Select)';
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
    label: 'Selected',
    hint: 'Only the options ticked below.',
  },
  {
    value: 'ALL',
    label: 'All',
    hint: 'Every active option, including ones added later.',
  },
  {
    value: 'ALL_EXCEPT',
    label: 'All except',
    hint: 'Every active option except the ones ticked below.',
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
    ? 'All options'
    : mode === 'SELECTED'
    ? `${count} selected`
    : `All except ${count}`;
}
