// Coupon form rules and labels, as on the Seller Panel's coupon pages
// (src/components/dashboard/coupons), checked against the backend's
// CreateCouponMasterDto limits.
import type { Coupon, CouponPayload } from '../services/coupon-service';
import i18n from '../i18n';

export const DISCOUNT_TYPES = [
  { value: 'FLAT', get label() { return i18n.t('common.flat'); } },
  { value: 'PERCENTAGE', get label() { return i18n.t('common.percentage'); } },
];

export const SELECTION_OPTIONS = [
  { value: 'ALL', get label() { return i18n.t('common.all'); } },
  { value: 'SELECTED', get label() { return i18n.t('common.selected'); } },
];

export interface CouponFormValues {
  title: string;
  codeSlug: string;
  couponCode: string;
  discountType: string;
  discountValue: string;
  minOrderValue: string;
  maxOrderValue: string;
  maxDiscountAmount: string;
  usageLimitTotal: string;
  usageLimitPerUser: string;
  categoriesSelection: string;
  brandsSelection: string;
  productSelection: string;
  startDate: string;
  endDate: string;
  description: string;
  termsAndConditions: string;
  status: string;
}

export const EMPTY_COUPON: CouponFormValues = {
  title: '',
  codeSlug: '',
  couponCode: '',
  discountType: 'FLAT',
  discountValue: '',
  minOrderValue: '',
  maxOrderValue: '',
  maxDiscountAmount: '',
  usageLimitTotal: '',
  usageLimitPerUser: '',
  categoriesSelection: 'ALL',
  brandsSelection: 'ALL',
  productSelection: 'ALL',
  startDate: '',
  endDate: '',
  description: '',
  termsAndConditions: '',
  status: '1',
};

const text = (v: unknown) => (v === undefined || v === null ? '' : String(v));

export function couponToForm(c: Coupon): CouponFormValues {
  return {
    title: text(c.title),
    codeSlug: text(c.codeSlug),
    couponCode: text(c.couponCode),
    discountType: c.discountType ?? 'FLAT',
    discountValue: text(c.discountValue),
    minOrderValue: text(c.minOrderValue),
    maxOrderValue: text(c.maxOrderValue),
    maxDiscountAmount: text(c.maxDiscountAmount),
    usageLimitTotal: text(c.usageLimitTotal),
    usageLimitPerUser: text(c.usageLimitPerUser),
    categoriesSelection: c.categoriesSelection ?? 'ALL',
    brandsSelection: c.brandsSelection ?? 'ALL',
    productSelection: c.productSelection ?? 'ALL',
    startDate: c.startDate ? String(c.startDate).slice(0, 10) : '',
    endDate: c.endDate ? String(c.endDate).slice(0, 10) : '',
    description: text(c.description),
    termsAndConditions: text(c.termsAndConditions),
    status: c.status != null ? String(c.status) : '1',
  };
}

/** "summer-sale-20" from a title, for the slug while it hasn't been typed. */
export function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255);
}

const MONEY = /^\d+(\.\d{1,2})?$/;
const WHOLE = /^\d+$/;

/** Field → message for everything that would be rejected; empty when the form can be saved. */
export function validateCoupon(v: CouponFormValues): Partial<Record<keyof CouponFormValues, string>> {
  const e: Partial<Record<keyof CouponFormValues, string>> = {};
  const required = (field: keyof CouponFormValues, label: string, max: number) => {
    const value = v[field].trim();
    if (!value) e[field] = i18n.t('coupons.labelIsRequired', { label });
    else if (value.length > max) e[field] = i18n.t('coupons.labelCanBeAtMostMax', { label, max });
  };
  required('title', i18n.t('common.title'), 255);
  required('codeSlug', i18n.t('common.slug'), 255);
  required('couponCode', i18n.t('common.couponCode'), 100);

  const money = (field: keyof CouponFormValues, label: string) => {
    const value = v[field].trim();
    if (value && !MONEY.test(value)) e[field] = i18n.t('coupons.labelMustBeAnAmountE', { label });
  };
  if (!v.discountValue.trim()) e.discountValue = i18n.t('coupons.discountValueIsRequired');
  else if (!MONEY.test(v.discountValue.trim())) e.discountValue = i18n.t('coupons.discountValueMustBeANumber');
  else if (Number(v.discountValue) <= 0) e.discountValue = i18n.t('coupons.discountValueMustBeAbove0');
  else if (v.discountType === 'PERCENTAGE' && Number(v.discountValue) > 100) e.discountValue = i18n.t('coupons.aPercentageDiscountCanTBe');
  money('minOrderValue', i18n.t('coupons.minOrderValue'));
  money('maxOrderValue', i18n.t('coupons.maxOrderValue'));
  money('maxDiscountAmount', i18n.t('coupons.maxDiscountAmount'));
  if (!e.minOrderValue && !e.maxOrderValue && v.minOrderValue.trim() && v.maxOrderValue.trim() && Number(v.maxOrderValue) < Number(v.minOrderValue)) {
    e.maxOrderValue = i18n.t('coupons.maxOrderValueCanTBe');
  }

  const whole = (field: keyof CouponFormValues, label: string) => {
    const value = v[field].trim();
    if (value && !WHOLE.test(value)) e[field] = i18n.t('coupons.labelMustBeAWholeNumber', { label });
  };
  whole('usageLimitTotal', i18n.t('coupons.totalUsageLimit'));
  whole('usageLimitPerUser', i18n.t('coupons.usageLimitPerUser'));

  if (v.startDate && v.endDate && v.endDate < v.startDate) e.endDate = i18n.t('common.theEndDateCanTBe');
  return e;
}

/** The request body, shaped as the Seller Panel sends it. */
export function couponPayload(v: CouponFormValues, isEdit: boolean): CouponPayload {
  const opt = (s: string) => (s.trim() ? s.trim() : undefined);
  const day = (s: string) => (s ? `${s}T00:00:00.000Z` : undefined);
  return {
    title: v.title.trim(),
    codeSlug: v.codeSlug.trim(),
    couponCode: v.couponCode.trim(),
    discountType: v.discountType || undefined,
    discountValue: v.discountValue.trim(),
    minOrderValue: opt(v.minOrderValue),
    maxOrderValue: opt(v.maxOrderValue),
    maxDiscountAmount: opt(v.maxDiscountAmount),
    usageLimitTotal: v.usageLimitTotal.trim() ? Number(v.usageLimitTotal) : undefined,
    usageLimitPerUser: v.usageLimitPerUser.trim() ? Number(v.usageLimitPerUser) : undefined,
    categoriesSelection: v.categoriesSelection,
    brandsSelection: v.brandsSelection,
    productSelection: v.productSelection,
    startDate: day(v.startDate),
    endDate: day(v.endDate),
    description: opt(v.description),
    termsAndConditions: opt(v.termsAndConditions),
    ...(isEdit ? { status: Number(v.status) } : {}),
  };
}

export const isActiveCoupon = (c: Pick<Coupon, 'status'>) => Number(c.status) === 1;
export const isExpiredCoupon = (c: Pick<Coupon, 'endDate'>, now = new Date()) => !!c.endDate && new Date(c.endDate) < now;

/** "20% OFF" / "₹100 OFF". */
export function formatDiscount(c: Pick<Coupon, 'discountType' | 'discountValue'>) {
  if (!c.discountValue) return '—';
  const n = Number(c.discountValue);
  const value = Number.isInteger(n) ? String(n) : String(c.discountValue);
  return c.discountType === 'PERCENTAGE' ? i18n.t('coupons.valuePercentOff', { value }) : i18n.t('coupons.rsValueOff', { value });
}
