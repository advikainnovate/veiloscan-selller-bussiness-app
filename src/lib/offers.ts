// Freebies, Gift Cards and Promotions: three simple masters with the same
// list / detail / form shape on the Seller Panel (freebies/*, gift-cards/*,
// promotions/*). One config each drives the app's shared screens; the field
// rules follow the backend's Create*Dto.
import type { ComponentType } from 'react';
import type { Row } from '../services/products-service';
import { CreditCardIcon, GiftIcon, PercentIcon, type IconProps } from '../components/icons';

export type OfferKind = 'freebies' | 'gift-cards' | 'promotions';

export type FieldType = 'text' | 'multiline' | 'amount' | 'int' | 'date' | 'choice' | 'image';
export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** For `int`: the smallest value. */
  min?: number;
  defaultValue?: string;
  maxLength?: number;
}
export interface SectionSpec {
  title: string;
  subtitle?: string;
  fields: FieldSpec[];
}

export interface OfferConfig {
  kind: OfferKind;
  menuKey: string;
  title: string;
  singular: string;
  subtitle: string;
  permission: string;
  resource: string;
  icon: ComponentType<IconProps>;
  titleKey: string;
  searchKeys: string[];
  searchPlaceholder: string;
  /** Extra chip filter on one field. */
  filter?: { key: string; label: string; options?: { value: string; label: string }[] };
  sections: SectionSpec[];
  /** Shown on create, as the panel's tip. */
  tip: string;
}

const STATUS_FIELD: FieldSpec = {
  key: 'status',
  label: 'Status',
  type: 'choice',
  options: [
    { value: '1', label: 'Active' },
    { value: '0', label: 'Inactive' },
  ],
};
const SELECTION = [
  { value: 'ALL', label: 'All' },
  { value: 'SELECTED', label: 'Selected' },
];
export const PROMOTION_TYPES = [
  { value: 'FLAT', label: 'Flat' },
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'BUY_X_GET_Y', label: 'Buy X Get Y' },
  { value: 'FREEBIE', label: 'Freebie' },
  { value: 'CASHBACK', label: 'Cashback' },
];
const DISCOUNT_TYPES = [
  { value: 'FLAT', label: 'Flat (₹)' },
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
];

export const OFFERS: Record<OfferKind, OfferConfig> = {
  freebies: {
    kind: 'freebies',
    menuKey: 'freebies',
    title: 'Freebies',
    singular: 'Freebie',
    subtitle: 'Buy-X-get-Y-free promotions for your customers.',
    permission: 'freebie-master:manage',
    resource: '/freebie-master',
    icon: GiftIcon,
    titleKey: 'title',
    searchKeys: ['title'],
    searchPlaceholder: 'Search by freebie title…',
    sections: [
      { title: 'Basic Information', subtitle: 'Title and description shown to customers.', fields: [{ key: 'title', label: 'Title', type: 'text', required: true, maxLength: 255 }, { key: 'description', label: 'Description', type: 'multiline' }] },
      {
        title: 'Eligibility & Order Rules',
        subtitle: 'Which catalog items qualify and the order value range.',
        fields: [
          { key: 'categoriesSelection', label: 'Categories', type: 'choice', options: SELECTION, defaultValue: 'ALL' },
          { key: 'brandsSelection', label: 'Brands', type: 'choice', options: SELECTION, defaultValue: 'ALL' },
          { key: 'productsSelection', label: 'Products', type: 'choice', options: SELECTION, defaultValue: 'ALL' },
          { key: 'minOrderValue', label: 'Min Order Value (₹)', type: 'amount' },
          { key: 'maxOrderValue', label: 'Max Order Value (₹)', type: 'amount' },
        ],
      },
      { title: 'Validity & Terms', fields: [{ key: 'startDate', label: 'Start Date', type: 'date' }, { key: 'endDate', label: 'End Date', type: 'date' }, { key: 'termsAndConditions', label: 'Terms & Conditions', type: 'multiline' }] },
    ],
    tip: 'Set eligibility to Selected to restrict this freebie to specific categories, brands, or products (chosen on the Seller Panel).',
  },
  'gift-cards': {
    kind: 'gift-cards',
    menuKey: 'gift-cards',
    title: 'Gift Cards',
    singular: 'Gift Card',
    subtitle: 'Gift card catalog available for purchase.',
    permission: 'gift-cards:manage',
    resource: '/gift-cards',
    icon: CreditCardIcon,
    titleKey: 'cardTitle',
    searchKeys: ['cardTitle', 'platform'],
    searchPlaceholder: 'Search by title or platform…',
    filter: { key: 'category', label: 'Category' },
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { key: 'cardTitle', label: 'Card Title', type: 'text', required: true, maxLength: 255 },
          { key: 'platform', label: 'Platform', type: 'text', hint: 'e.g. Amazon' },
          { key: 'category', label: 'Category', type: 'text' },
          { key: 'subCategory', label: 'Sub Category', type: 'text' },
          { key: 'imageFileId', label: 'Card Image', type: 'image' },
        ],
      },
      {
        title: 'Pricing & Validity',
        fields: [
          { key: 'gcValue', label: 'Face Value (₹)', type: 'amount', required: true },
          { key: 'personalPrice', label: 'Personal Price (₹)', type: 'amount' },
          { key: 'corporatePrice', label: 'Corporate Price (₹)', type: 'amount' },
          { key: 'minOrderQty', label: 'Min Order Qty', type: 'int', min: 1, defaultValue: '1' },
          { key: 'validityDays', label: 'Validity (days)', type: 'int', min: 1, defaultValue: '365' },
        ],
      },
      { title: 'Description & Terms', fields: [{ key: 'gcDescription', label: 'Description', type: 'multiline' }, { key: 'termsAndConditions', label: 'Terms & Conditions', type: 'multiline' }] },
    ],
    tip: 'Face value is what the card is worth; personal and corporate prices are what buyers pay.',
  },
  promotions: {
    kind: 'promotions',
    menuKey: 'promotions',
    title: 'Promotions',
    singular: 'Promotion',
    subtitle: 'Storewide and targeted promotional campaigns.',
    permission: 'my-promotions:manage',
    resource: '/my-promotions',
    icon: PercentIcon,
    titleKey: 'title',
    searchKeys: ['title'],
    searchPlaceholder: 'Search by promotion title…',
    filter: { key: 'promotionType', label: 'Type', options: PROMOTION_TYPES },
    sections: [
      {
        title: 'Basic Information',
        fields: [
          { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 255 },
          { key: 'description', label: 'Description', type: 'multiline' },
          { key: 'promotionType', label: 'Promotion Type', type: 'choice', options: PROMOTION_TYPES, defaultValue: 'FLAT' },
          { key: 'discountType', label: 'Discount Type', type: 'choice', options: DISCOUNT_TYPES, defaultValue: 'FLAT' },
          { key: 'discountValue', label: 'Discount Value', type: 'amount' },
        ],
      },
      {
        title: 'Order Rules & Validity',
        fields: [
          { key: 'minOrderValue', label: 'Min Order Value (₹)', type: 'amount' },
          { key: 'maxOrderValue', label: 'Max Order Value (₹)', type: 'amount' },
          { key: 'maximumDiscount', label: 'Maximum Discount (₹)', type: 'amount' },
          { key: 'startDate', label: 'Start Date', type: 'date' },
          { key: 'endDate', label: 'End Date', type: 'date' },
        ],
      },
      { title: 'Terms', fields: [{ key: 'termsAndConditions', label: 'Terms & Conditions', type: 'multiline' }] },
    ],
    tip: 'A percentage discount can be capped with Maximum Discount.',
  },
};

export const OFFER_KINDS = Object.keys(OFFERS) as OfferKind[];
export const offerFields = (c: OfferConfig) => c.sections.flatMap(s => s.fields);
export const statusField = STATUS_FIELD;

export type OfferForm = Record<string, string> & { imageUrl?: string };

const val = (v: unknown) => (v === undefined || v === null ? '' : String(v));

export function emptyOffer(c: OfferConfig): OfferForm {
  return { ...Object.fromEntries(offerFields(c).map(f => [f.key, f.defaultValue ?? ''])), status: '1' };
}

export function offerFromRecord(c: OfferConfig, r: Row): OfferForm {
  const form: OfferForm = { status: r.status == null ? '1' : String(Number(r.status)) };
  for (const f of offerFields(c)) form[f.key] = f.type === 'date' ? val(r[f.key]).slice(0, 10) : val(r[f.key]) || (f.defaultValue && r[f.key] == null ? f.defaultValue : '');
  if (c.kind === 'gift-cards') form.imageUrl = val((r.imageFile as Row | undefined)?.url);
  return form;
}

const isAmount = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());

/** Required fields, number formats and the backend's minimums, then ranges that only make sense one way round. */
export function offerProblem(c: OfferConfig, f: OfferForm): string | null {
  const fields = offerFields(c);
  const missing = fields.filter(x => x.required && !String(f[x.key] ?? '').trim()).map(x => x.label.replace(/ \(.*\)$/, ''));
  if (missing.length) return `Please fill in: ${missing.join(', ')}`;
  for (const x of fields) {
    const v = String(f[x.key] ?? '').trim();
    if (!v) continue;
    const name = x.label.replace(/ \(.*\)$/, '');
    if (x.type === 'amount' && !isAmount(v)) return `${name} must be an amount, e.g. 499 or 499.50`;
    if (x.type === 'int' && (!/^\d+$/.test(v) || Number(v) < (x.min ?? 0))) return `${name} must be a whole number of at least ${x.min ?? 0}`;
  }
  const n = (k: string) => (String(f[k] ?? '').trim() ? Number(f[k]) : null);
  const minO = n('minOrderValue');
  const maxO = n('maxOrderValue');
  if (minO !== null && maxO !== null && maxO < minO) return "Max order value can't be less than the min order value";
  if (f.startDate && f.endDate && f.endDate < f.startDate) return "The end date can't be before the start date";
  if (c.kind === 'promotions' && f.discountType === 'PERCENTAGE' && (n('discountValue') ?? 0) > 100) return 'A percentage discount can be at most 100';
  return null;
}

/** As the panel sends it: empty fields left out, dates as ISO, counts as numbers. */
export function offerPayload(c: OfferConfig, f: OfferForm, withStatus: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const x of offerFields(c)) {
    const v = String(f[x.key] ?? '').trim();
    if (x.type === 'choice') out[x.key] = v || x.defaultValue || undefined;
    else if (!v) out[x.key] = undefined;
    else if (x.type === 'date') out[x.key] = new Date(`${v}T00:00:00`).toISOString();
    else if (x.type === 'int') out[x.key] = Number(v);
    else out[x.key] = v;
  }
  if (withStatus) out.status = Number(f.status);
  return out;
}

export const offerTitle = (c: OfferConfig, r: Row) => String(r[c.titleKey] ?? '—');

export const isExpired = (r: Row, now = Date.now()) => !!r.endDate && new Date(String(r.endDate)).getTime() < now;

export function filterOffers(c: OfferConfig, rows: Row[], search: string, status: string, extra: string) {
  const q = search.trim().toLowerCase();
  return rows.filter(r => {
    if (status === 'expired' ? !isExpired(r) : status && String(Number(r.status)) !== status) return false;
    if (c.filter && extra && String(r[c.filter.key] ?? '') !== extra) return false;
    return !q || c.searchKeys.some(k => String(r[k] ?? '').toLowerCase().includes(q));
  });
}

const rupees = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);
const choiceLabel = (options: { value: string; label: string }[], v: unknown) => options.find(o => o.value === v)?.label ?? (v ? String(v) : '—');

/** "Flat · ₹100 off" / "10% off". */
export const discountLabel = (r: Row) => (r.discountValue ? (r.discountType === 'PERCENTAGE' ? `${Number(r.discountValue)}% off` : `${rupees(r.discountValue)} off`) : '—');

/** The line under a card's title, and its chips. */
export function offerSummary(c: OfferConfig, r: Row): { sub: string; chips: string[] } {
  if (c.kind === 'gift-cards') {
    return {
      sub: [r.platform, r.category].filter(Boolean).map(String).join(' · ') || '—',
      chips: [`Value ${rupees(r.gcValue)}`, `${rupees(r.personalPrice)} / ${rupees(r.corporatePrice)}`, `${val(r.validityDays) || '—'} days`],
    };
  }
  if (c.kind === 'promotions') {
    return { sub: choiceLabel(PROMOTION_TYPES, r.promotionType), chips: [discountLabel(r), ...(r.minOrderValue ? [`Min ${rupees(r.minOrderValue)}`] : [])] };
  }
  return {
    sub: `Cat: ${choiceLabel(SELECTION, r.categoriesSelection)} · Brand: ${choiceLabel(SELECTION, r.brandsSelection)} · Prod: ${choiceLabel(SELECTION, r.productsSelection)}`,
    chips: [...(r.minOrderValue ? [`Min ${rupees(r.minOrderValue)}`] : []), ...(r.maxOrderValue ? [`Max ${rupees(r.maxOrderValue)}`] : [])],
  };
}

/** A field's value as the detail page shows it. */
export function displayValue(x: FieldSpec, r: Row): string {
  const v = r[x.key];
  if (v === undefined || v === null || v === '') return '—';
  if (x.type === 'amount') return rupees(v);
  if (x.type === 'choice') return choiceLabel(x.options ?? [], v);
  if (x.type === 'date') return new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (x.key === 'validityDays') return `${String(v)} days`;
  return String(v);
}
