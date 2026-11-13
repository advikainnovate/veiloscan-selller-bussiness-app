// Shipping zones and their methods, as the Seller Panel's shipping pages and
// the backend's CreateShippingZoneDto / CreateShippingMethodDto.
import type { Row } from '../services/products-service';
import i18n from '../i18n';

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export type RateType = 'FIXED' | 'PER_KG' | 'PERCENTAGE_OF_ORDER';
export const RATE_TYPES: { value: RateType; label: string; hint: string }[] = [
  { value: 'FIXED', get label() { return i18n.t('common.fixed'); }, get hint() { return i18n.t('shipping.oneChargePerOrder'); } },
  { value: 'PER_KG', get label() { return i18n.t('shipping.perKg'); }, get hint() { return i18n.t('shipping.chargedOnTheOrderWeight'); } },
  { value: 'PERCENTAGE_OF_ORDER', get label() { return i18n.t('shipping.percentOfOrder'); }, get hint() { return i18n.t('shipping.aShareOfTheOrderValue'); } },
];

/** "₹49", "₹12/kg", "5%". */
export function rateLabel(m: Row) {
  const rate = String(m.rate ?? '0');
  if (m.rateType === 'PERCENTAGE_OF_ORDER') return `${Number(rate)}%`;
  return `₹${Number(rate).toLocaleString('en-IN')}${m.rateType === 'PER_KG' ? '/kg' : ''}`;
}

/** "3–5 days", "2 days", or null. */
export function etaLabel(m: Row) {
  const min = m.estimatedDaysMin;
  const max = m.estimatedDaysMax;
  if (min == null && max == null) return null;
  if (min != null && max != null && Number(min) !== Number(max)) return i18n.t('shipping.minMaxDays', { min, max });
  const d = Number(min ?? max);
  return i18n.t('common.dayCount', { count: d });
}

export const coveredLabel = (states: unknown) => (Array.isArray(states) && states.length ? (states as string[]).join(', ') : i18n.t('shipping.allUnspecified'));

/** "South India" → "south-india". */
export const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 255);

export interface ZoneForm {
  zoneTitle: string;
  zoneSlug: string;
  coveredStates: string[];
  description: string;
  status: string;
}
export const EMPTY_ZONE: ZoneForm = { zoneTitle: '', zoneSlug: '', coveredStates: [], description: '', status: '1' };

export const zoneFromRecord = (r: Row): ZoneForm => ({
  zoneTitle: String(r.zoneTitle ?? ''),
  zoneSlug: String(r.zoneSlug ?? ''),
  coveredStates: Array.isArray(r.coveredStates) ? (r.coveredStates as string[]) : [],
  description: String(r.description ?? ''),
  status: r.status == null ? '1' : String(Number(r.status)),
});

export function zoneProblem(f: ZoneForm): string | null {
  const missing = [!f.zoneTitle.trim() && i18n.t('shipping.zoneTitle'), !f.zoneSlug.trim() && i18n.t('common.slug')].filter(Boolean);
  if (missing.length) return i18n.t('common.pleaseFillInJoin', { join: missing.join(', ') });
  return null;
}

export const zonePayload = (f: ZoneForm) => ({
  zoneTitle: f.zoneTitle.trim(),
  zoneSlug: f.zoneSlug.trim(),
  coveredStates: f.coveredStates.length ? f.coveredStates : undefined,
  description: f.description.trim() || undefined,
});

export interface MethodForm {
  methodTitle: string;
  methodSlug: string;
  rateType: RateType;
  rate: string;
  freeAboveOrderValue: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  status: string;
}
export const EMPTY_METHOD: MethodForm = { methodTitle: '', methodSlug: '', rateType: 'FIXED', rate: '', freeAboveOrderValue: '', estimatedDaysMin: '', estimatedDaysMax: '', status: '1' };

const str = (v: unknown) => (v == null ? '' : String(v));
export const methodFromRecord = (m: Row): MethodForm => ({
  methodTitle: str(m.methodTitle),
  methodSlug: str(m.methodSlug),
  rateType: (m.rateType as RateType) || 'FIXED',
  rate: str(m.rate),
  freeAboveOrderValue: str(m.freeAboveOrderValue),
  estimatedDaysMin: str(m.estimatedDaysMin),
  estimatedDaysMax: str(m.estimatedDaysMax),
  status: m.status == null ? '1' : String(Number(m.status)),
});

const isAmount = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());
const isDays = (v: string) => /^\d+$/.test(v.trim());

/** The backend's checks (numbers, whole days), plus min ≤ max and a percentage up to 100. */
export function methodProblem(f: MethodForm): string | null {
  const missing = [!f.methodTitle.trim() && i18n.t('shipping.methodTitle'), !f.methodSlug.trim() && i18n.t('common.slug'), !f.rate.trim() && i18n.t('shipping.rate')].filter(Boolean);
  if (missing.length) return i18n.t('common.pleaseFillInJoin', { join: missing.join(', ') });
  if (!isAmount(f.rate)) return i18n.t('shipping.theRateIsAnAmountE');
  if (f.rateType === 'PERCENTAGE_OF_ORDER' && Number(f.rate) > 100) return i18n.t('shipping.aPercentageRateCanBeAt');
  if (f.freeAboveOrderValue.trim() && !isAmount(f.freeAboveOrderValue)) return i18n.t('shipping.freeAboveIsAnOrderValue');
  if ((f.estimatedDaysMin.trim() && !isDays(f.estimatedDaysMin)) || (f.estimatedDaysMax.trim() && !isDays(f.estimatedDaysMax))) return i18n.t('shipping.deliveryDaysAreWholeNumbers');
  if (f.estimatedDaysMin.trim() && f.estimatedDaysMax.trim() && Number(f.estimatedDaysMin) > Number(f.estimatedDaysMax)) return i18n.t('shipping.minDaysCanTBeMore');
  return null;
}

export const methodPayload = (f: MethodForm, zoneId: string) => ({
  zoneId,
  methodTitle: f.methodTitle.trim(),
  methodSlug: f.methodSlug.trim(),
  rateType: f.rateType,
  rate: f.rate.trim(),
  freeAboveOrderValue: f.freeAboveOrderValue.trim() || undefined,
  estimatedDaysMin: f.estimatedDaysMin.trim() ? Number(f.estimatedDaysMin) : undefined,
  estimatedDaysMax: f.estimatedDaysMax.trim() ? Number(f.estimatedDaysMax) : undefined,
});
