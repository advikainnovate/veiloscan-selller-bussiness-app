// Freebies, Gift Cards and Promotions: three simple masters with the same
// list / detail / form shape on the Seller Panel (freebies/*, gift-cards/*,
// promotions/*). One config each drives the app's shared screens; the field
// rules follow the backend's Create*Dto.
import type { ComponentType } from 'react';
import type { Row } from '../services/products-service';
import { CreditCardIcon, GiftIcon, PercentIcon, type IconProps } from '../components/icons';
import i18n from '../i18n';

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
  get label() { return i18n.t('common.status'); },
  type: 'choice',
  options: [
    { value: '1', get label() { return i18n.t('common.active'); } },
    { value: '0', get label() { return i18n.t('common.inactive'); } },
  ],
};
const SELECTION = [
  { value: 'ALL', get label() { return i18n.t('common.all'); } },
  { value: 'SELECTED', get label() { return i18n.t('common.selected'); } },
];
export const PROMOTION_TYPES = [
  { value: 'FLAT', get label() { return i18n.t('common.flat'); } },
  { value: 'PERCENTAGE', get label() { return i18n.t('common.percentage'); } },
  { value: 'BUY_X_GET_Y', get label() { return i18n.t('offers.buyXGetY'); } },
  { value: 'FREEBIE', get label() { return i18n.t('offers.freebie'); } },
  { value: 'CASHBACK', get label() { return i18n.t('offers.cashback'); } },
];
const DISCOUNT_TYPES = [
  { value: 'FLAT', get label() { return i18n.t('offers.flatRs'); } },
  { value: 'PERCENTAGE', get label() { return i18n.t('offers.percentagePercent'); } },
];

export const OFFERS: Record<OfferKind, OfferConfig> = {
  freebies: {
    kind: 'freebies',
    menuKey: 'freebies',
    get title() { return i18n.t('common.freebies'); },
    get singular() { return i18n.t('offers.freebie'); },
    get subtitle() { return i18n.t('offers.buyXGetYFreePromotions'); },
    permission: 'freebie-master:manage',
    resource: '/freebie-master',
    icon: GiftIcon,
    titleKey: 'title',
    searchKeys: ['title'],
    get searchPlaceholder() { return i18n.t('offers.searchByFreebieTitle'); },
    sections: [
      { get title() { return i18n.t('common.basicInformation'); }, get subtitle() { return i18n.t('offers.titleAndDescriptionShownToCustomers'); }, fields: [{ key: 'title', get label() { return i18n.t('common.title'); }, type: 'text', required: true, maxLength: 255 }, { key: 'description', get label() { return i18n.t('common.description'); }, type: 'multiline' }] },
      {
        get title() { return i18n.t('offers.eligibilityAndOrderRules'); },
        get subtitle() { return i18n.t('offers.whichCatalogItemsQualifyAndThe'); },
        fields: [
          { key: 'categoriesSelection', get label() { return i18n.t('common.categories'); }, type: 'choice', options: SELECTION, defaultValue: 'ALL' },
          { key: 'brandsSelection', get label() { return i18n.t('common.brands'); }, type: 'choice', options: SELECTION, defaultValue: 'ALL' },
          { key: 'productsSelection', get label() { return i18n.t('common.products'); }, type: 'choice', options: SELECTION, defaultValue: 'ALL' },
          { key: 'minOrderValue', get label() { return i18n.t('offers.minOrderValueRs'); }, type: 'amount' },
          { key: 'maxOrderValue', get label() { return i18n.t('offers.maxOrderValueRs'); }, type: 'amount' },
        ],
      },
      { get title() { return i18n.t('offers.validityAndTerms'); }, fields: [{ key: 'startDate', get label() { return i18n.t('common.startDate'); }, type: 'date' }, { key: 'endDate', get label() { return i18n.t('common.endDate'); }, type: 'date' }, { key: 'termsAndConditions', get label() { return i18n.t('common.termsAndConditions'); }, type: 'multiline' }] },
    ],
    get tip() { return i18n.t('offers.setEligibilityToSelectedToRestrict'); },
  },
  'gift-cards': {
    kind: 'gift-cards',
    menuKey: 'gift-cards',
    get title() { return i18n.t('common.giftCards'); },
    get singular() { return i18n.t('offers.giftCard'); },
    get subtitle() { return i18n.t('offers.giftCardCatalogAvailableForPurchase'); },
    permission: 'gift-cards:manage',
    resource: '/gift-cards',
    icon: CreditCardIcon,
    titleKey: 'cardTitle',
    searchKeys: ['cardTitle', 'platform'],
    get searchPlaceholder() { return i18n.t('offers.searchByTitleOrPlatform'); },
    filter: { key: 'category', get label() { return i18n.t('common.category'); } },
    sections: [
      {
        get title() { return i18n.t('common.basicInformation'); },
        fields: [
          { key: 'cardTitle', get label() { return i18n.t('offers.cardTitle'); }, type: 'text', required: true, maxLength: 255 },
          { key: 'platform', get label() { return i18n.t('offers.platform'); }, type: 'text', hint: 'e.g. Amazon' },
          { key: 'category', get label() { return i18n.t('common.category'); }, type: 'text' },
          { key: 'subCategory', get label() { return i18n.t('offers.subCategory'); }, type: 'text' },
          { key: 'imageFileId', get label() { return i18n.t('offers.cardImage'); }, type: 'image' },
        ],
      },
      {
        get title() { return i18n.t('offers.pricingAndValidity'); },
        fields: [
          { key: 'gcValue', get label() { return i18n.t('offers.faceValueRs'); }, type: 'amount', required: true },
          { key: 'personalPrice', get label() { return i18n.t('offers.personalPriceRs'); }, type: 'amount' },
          { key: 'corporatePrice', get label() { return i18n.t('offers.corporatePriceRs'); }, type: 'amount' },
          { key: 'minOrderQty', get label() { return i18n.t('offers.minOrderQty'); }, type: 'int', min: 1, defaultValue: '1' },
          { key: 'validityDays', get label() { return i18n.t('offers.validityDays'); }, type: 'int', min: 1, defaultValue: '365' },
        ],
      },
      { get title() { return i18n.t('common.descriptionAndTerms'); }, fields: [{ key: 'gcDescription', get label() { return i18n.t('common.description'); }, type: 'multiline' }, { key: 'termsAndConditions', get label() { return i18n.t('common.termsAndConditions'); }, type: 'multiline' }] },
    ],
    get tip() { return i18n.t('offers.faceValueIsWhatTheCard'); },
  },
  promotions: {
    kind: 'promotions',
    menuKey: 'promotions',
    get title() { return i18n.t('common.promotions'); },
    get singular() { return i18n.t('offers.promotion'); },
    get subtitle() { return i18n.t('offers.storewideAndTargetedPromotionalCampaigns'); },
    permission: 'my-promotions:manage',
    resource: '/my-promotions',
    icon: PercentIcon,
    titleKey: 'title',
    searchKeys: ['title'],
    get searchPlaceholder() { return i18n.t('offers.searchByPromotionTitle'); },
    filter: { key: 'promotionType', get label() { return i18n.t('common.type'); }, options: PROMOTION_TYPES },
    sections: [
      {
        get title() { return i18n.t('common.basicInformation'); },
        fields: [
          { key: 'title', get label() { return i18n.t('common.title'); }, type: 'text', required: true, maxLength: 255 },
          { key: 'description', get label() { return i18n.t('common.description'); }, type: 'multiline' },
          { key: 'promotionType', get label() { return i18n.t('offers.promotionType'); }, type: 'choice', options: PROMOTION_TYPES, defaultValue: 'FLAT' },
          { key: 'discountType', get label() { return i18n.t('common.discountType'); }, type: 'choice', options: DISCOUNT_TYPES, defaultValue: 'FLAT' },
          { key: 'discountValue', get label() { return i18n.t('common.discountValue'); }, type: 'amount' },
        ],
      },
      {
        get title() { return i18n.t('offers.orderRulesAndValidity'); },
        fields: [
          { key: 'minOrderValue', get label() { return i18n.t('offers.minOrderValueRs'); }, type: 'amount' },
          { key: 'maxOrderValue', get label() { return i18n.t('offers.maxOrderValueRs'); }, type: 'amount' },
          { key: 'maximumDiscount', get label() { return i18n.t('offers.maximumDiscountRs'); }, type: 'amount' },
          { key: 'startDate', get label() { return i18n.t('common.startDate'); }, type: 'date' },
          { key: 'endDate', get label() { return i18n.t('common.endDate'); }, type: 'date' },
        ],
      },
      { get title() { return i18n.t('offers.terms'); }, fields: [{ key: 'termsAndConditions', get label() { return i18n.t('common.termsAndConditions'); }, type: 'multiline' }] },
    ],
    get tip() { return i18n.t('offers.aPercentageDiscountCanBeCapped'); },
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
  if (missing.length) return i18n.t('common.pleaseFillInJoin', { join: missing.join(', ') });
  for (const x of fields) {
    const v = String(f[x.key] ?? '').trim();
    if (!v) continue;
    const name = x.label.replace(/ \(.*\)$/, '');
    if (x.type === 'amount' && !isAmount(v)) return i18n.t('offers.nameMustBeAnAmountE', { name });
    if (x.type === 'int' && (!/^\d+$/.test(v) || Number(v) < (x.min ?? 0))) return i18n.t('offers.nameMustBeAWholeNumber', { name, min: x.min ?? 0 });
  }
  const n = (k: string) => (String(f[k] ?? '').trim() ? Number(f[k]) : null);
  const minO = n('minOrderValue');
  const maxO = n('maxOrderValue');
  if (minO !== null && maxO !== null && maxO < minO) return i18n.t('offers.maxOrderValueCanTBe');
  if (f.startDate && f.endDate && f.endDate < f.startDate) return i18n.t('common.theEndDateCanTBe');
  if (c.kind === 'promotions' && f.discountType === 'PERCENTAGE' && (n('discountValue') ?? 0) > 100) return i18n.t('offers.aPercentageDiscountCanBeAt');
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
export const discountLabel = (r: Row) => (r.discountValue ? (r.discountType === 'PERCENTAGE' ? i18n.t('common.discountvaluePercentOff', { discountValue: Number(r.discountValue) }) : i18n.t('offers.discountvalueOff', { discountValue: rupees(r.discountValue) })) : '—');

/** The line under a card's title, and its chips. */
export function offerSummary(c: OfferConfig, r: Row): { sub: string; chips: string[] } {
  if (c.kind === 'gift-cards') {
    return {
      sub: [r.platform, r.category].filter(Boolean).map(String).join(' · ') || '—',
      chips: [i18n.t('offers.valueGcvalue', { gcValue: rupees(r.gcValue) }), `${rupees(r.personalPrice)} / ${rupees(r.corporatePrice)}`, i18n.t('offers.countDays', { count: val(r.validityDays) || '—' })],
    };
  }
  if (c.kind === 'promotions') {
    return { sub: choiceLabel(PROMOTION_TYPES, r.promotionType), chips: [discountLabel(r), ...(r.minOrderValue ? [i18n.t('offers.minMinordervalue', { minOrderValue: rupees(r.minOrderValue) })] : [])] };
  }
  return {
    sub: i18n.t('offers.catChoicelabelBrandChoicelabel2ProdChoicelabel3', { choiceLabel: choiceLabel(SELECTION, r.categoriesSelection), choiceLabel2: choiceLabel(SELECTION, r.brandsSelection), choiceLabel3: choiceLabel(SELECTION, r.productsSelection) }),
    chips: [...(r.minOrderValue ? [i18n.t('offers.minMinordervalue', { minOrderValue: rupees(r.minOrderValue) })] : []), ...(r.maxOrderValue ? [i18n.t('offers.maxMaxordervalue', { maxOrderValue: rupees(r.maxOrderValue) })] : [])],
  };
}

/** A field's value as the detail page shows it. */
export function displayValue(x: FieldSpec, r: Row): string {
  const v = r[x.key];
  if (v === undefined || v === null || v === '') return '—';
  if (x.type === 'amount') return rupees(v);
  if (x.type === 'choice') return choiceLabel(x.options ?? [], v);
  if (x.type === 'date') return new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (x.key === 'validityDays') return i18n.t('offers.vDays', { v: String(v) });
  return String(v);
}
