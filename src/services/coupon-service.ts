import { api } from '../lib/api';

// Coupons (eshop-backend src/modules/coupons-master, /coupons-master), needs
// coupons-master:manage. The list is the selected store's coupons plus the
// ones shared by all the seller's stores; new coupons belong to that store.

export interface Coupon {
  id: string;
  idd: string;
  title: string;
  codeSlug: string;
  couponCode: string;
  description: string | null;
  discountType: 'FLAT' | 'PERCENTAGE' | null;
  discountValue: string | number | null;
  minOrderValue: string | number | null;
  maxOrderValue: string | number | null;
  maxDiscountAmount: string | number | null;
  usageLimitTotal: number | null;
  usageLimitPerUser: number | null;
  initialCoupon: number | null;
  categoriesSelection: 'ALL' | 'SELECTED' | null;
  brandsSelection: 'ALL' | 'SELECTED' | null;
  productSelection: 'ALL' | 'SELECTED' | null;
  startDate: string | null;
  endDate: string | null;
  termsAndConditions: string | null;
  /** 1 active, 0 inactive. */
  status: number;
  storeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CouponPayload = Record<string, string | number | undefined>;

export const couponService = {
  list(): Promise<Coupon[]> {
    return api.get('/coupons-master').then(res => (Array.isArray(res.data) ? res.data : []));
  },
  get(id: string): Promise<Coupon> {
    return api.get(`/coupons-master/${id}`).then(res => res.data);
  },
  create(payload: CouponPayload): Promise<Coupon> {
    return api.post('/coupons-master', payload).then(res => res.data);
  },
  update(id: string, payload: CouponPayload): Promise<Coupon> {
    return api.patch(`/coupons-master/${id}`, payload).then(res => res.data);
  },
  remove(id: string) {
    return api.delete(`/coupons-master/${id}`).then(res => res.data);
  },
};
