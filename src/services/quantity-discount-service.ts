import { api } from '../lib/api';

// Quantity discount schemes (eshop-backend src/modules/quantity-discounts), as
// the Seller Panel's quantity-discount-service. Needs quantity-discounts:manage.
// The list follows the current store (X-Store-Id).

export type DiscountTargetType =
  | 'ALL_VARIANTS'
  | 'SPECIFIC_VARIANTS'
  | 'SIMPLE_PRODUCT';
export type DiscountAggregationMode = 'PER_VARIANT' | 'COMBINED_PRODUCT';
export type SlabDiscountType = 'PERCENTAGE' | 'FLAT';
export type FlatDiscountMethod = 'PER_UNIT' | 'PER_ORDER';
export type SchemeState = 'SCHEDULED' | 'RUNNING' | 'ENDED' | 'INACTIVE';

export interface SchemeSlab {
  id?: string;
  minQuantity: number;
  // null: no upper limit (the highest slab only).
  maxQuantity: number | null;
  quantityUnit: string;
  discountType: SlabDiscountType;
  discountValue: number;
  flatDiscountMethod: FlatDiscountMethod | null;
}

export interface SchemeSku {
  id: string;
  sku: string;
  label: string;
  attributes: Record<string, string>;
  price: number;
  mrp: number | null;
  active: boolean;
  deleted: boolean;
}

export interface SchemeListRow {
  id: string;
  idd: string;
  schemeName: string;
  productId: string;
  productName: string;
  storeId: string | null;
  storeName: string | null;
  targetType: DiscountTargetType;
  aggregationMode: DiscountAggregationMode;
  stackWithCoupons: boolean;
  startsAt: string;
  endsAt: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  state: SchemeState;
  variantCount: number;
  skuCount: number;
  slabs: SchemeSlab[];
  updatedAt: string;
}

export interface SchemeAuditEntry {
  id: string;
  action: string;
  changes: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
}

export interface SchemeDetail {
  id: string;
  idd: string;
  schemeName: string;
  productId: string;
  productName: string | null;
  storeId: string | null;
  targetType: DiscountTargetType;
  aggregationMode: DiscountAggregationMode;
  stackWithCoupons: boolean;
  startsAt: string;
  endsAt: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  state: SchemeState;
  variantIds: string[];
  variants: SchemeSku[];
  slabs: SchemeSlab[];
  audit: SchemeAuditEntry[];
}

export interface SchemeProduct {
  id: string;
  name: string;
  skuCount: number;
  sku: string | null;
}

export interface SchemeProductOptions {
  id: string;
  name: string;
  // One SKU: only 'Product without variants' applies.
  simple: boolean;
  skus: SchemeSku[];
  // Units slabs can be in; `whole`: counted in whole numbers.
  units: { code: string; name: string; stockType: string; whole: boolean }[];
}

export interface SchemeInput {
  schemeName: string;
  productId: string;
  // null = all stores that sell the product.
  storeId: string | null;
  targetType: DiscountTargetType;
  aggregationMode: DiscountAggregationMode;
  variantIds: string[];
  stackWithCoupons: boolean;
  startsAt: string;
  endsAt: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  slabs: Omit<SchemeSlab, 'id'>[];
}

export const quantityDiscountService = {
  list(
    params: { productId?: string; status?: string; search?: string } = {},
  ): Promise<SchemeListRow[]> {
    return api.get('/quantity-discounts', { params }).then(r => r.data);
  },
  get(id: string): Promise<SchemeDetail> {
    return api.get(`/quantity-discounts/${id}`).then(r => r.data);
  },
  products(search?: string): Promise<SchemeProduct[]> {
    return api
      .get('/quantity-discounts/products', {
        params: { search: search || undefined },
      })
      .then(r => r.data);
  },
  productOptions(productId: string): Promise<SchemeProductOptions> {
    return api
      .get(`/quantity-discounts/products/${productId}`)
      .then(r => r.data);
  },
  create(body: SchemeInput): Promise<SchemeDetail> {
    return api.post('/quantity-discounts', body).then(r => r.data);
  },
  update(id: string, body: Partial<SchemeInput>): Promise<SchemeDetail> {
    return api.patch(`/quantity-discounts/${id}`, body).then(r => r.data);
  },
  remove(id: string): Promise<{ message: string }> {
    return api.delete(`/quantity-discounts/${id}`).then(r => r.data);
  },
};
