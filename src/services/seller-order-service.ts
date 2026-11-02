// Ported from the Seller Panel's src/services/seller-order-service.ts (self orders: counter / phone).
import { api } from '../lib/api';
import type { Selling } from '../lib/selling';
import type { SkuQuantityScheme } from '../lib/quantity-discount';
import type { PaymentMethod, ReminderType } from '../lib/orders';

// Orders a seller places for a customer (eshop-backend POST /orders/for-customer).

export interface SellerStore {
  id: string;
  name: string;
  code: string;
  creditAllowed: boolean;
  maxCreditDays: number;
  taxInclusive: boolean;
}

export interface CatalogItem {
  productId: string;
  productName: string;
  variantId: string;
  hasVariants: boolean;
  // e.g. "King" — only what differs between the product's SKUs.
  variantLabel: string | null;
  // e.g. { "Bed Type": "King" } — the options that tell the product's SKUs apart.
  options: Record<string, string>;
  // Colour code per option value, where set (e.g. { Color: "#e53935" }).
  swatches: Record<string, string>;
  sku: string;
  barcode: string | null;
  price: number;
  mrp: number | null;
  // null = stock isn't tracked.
  stock: number | null;
  // The product's minimum order, in whole units (fixed selling only).
  minimumQuantity: number;
  gstPercentage: number;
  // How the SKU is bought: unit, minimum / step, price basis… (stock above is in its selling unit).
  selling?: Selling;
  // Its quantity discount slabs in this store, if a scheme applies (checked again on the server).
  quantityDiscount?: SkuQuantityScheme | null;
  imageUrl: string | null;
}

export interface StoreCategory {
  id: string;
  name: string;
  iconUrl: string | null;
  products: number;
}

export interface StoreCustomer {
  id: string;
  // Business ID, e.g. USR6F6G69ZSP.
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
  active: boolean;
  orders: number;
  spent: number;
  lastOrderAt: string;
  address: string | null;
}

export interface SellerCoupon {
  id: string;
  code: string;
  title: string;
  discountType: 'FLAT' | 'PERCENTAGE';
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  maxOrderValue: number | null;
}

export type SellerPaymentOption = 'PAY_NOW' | 'PAY_CREDIT';

export interface SellerOrderPaymentLine {
  method: PaymentMethod;
  amount?: number;
  referenceNumber?: string;
}

// QUICK_SALE: a counter sale without customer details (no customer account), paid now.
export type SellerOrderType = 'NORMAL' | 'QUICK_SALE';

export interface CreateSellerOrderPayload {
  storeId: string;
  // Default NORMAL; a Quick Sale leaves out every customer field.
  orderType?: SellerOrderType;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  // Calling code without "+" (default 91).
  countryCode?: string;
  customerAddress?: string;
  customerType?: 'INDIVIDUAL' | 'BUSINESS';
  // About the customer (preferred contact time…).
  customerNote?: string;
  // false: a guest order, the customer isn't saved.
  saveCustomer?: boolean;
  // `uom`: the unit of `quantity` (750 GM); the SKU's selling unit when left out.
  items: {
    productId: string;
    variantId: string;
    quantity: number;
    uom?: string;
  }[];
  paymentOption: SellerPaymentOption;
  payments?: SellerOrderPaymentLine[];
  credit?: {
    dueDate: string;
    reminderEnabled?: boolean;
    reminderDays?: number;
    reminderChannels?: ReminderType[];
    notes?: string;
  };
  handOverNow?: boolean;
  remarks?: string;
  // ₹ off each line, given by the seller.
  discounts?: { variantId: string; amount: number }[];
  // Order-level discount, after line discounts: ₹ (FLAT) or % (PERCENTAGE).
  orderDiscountType?: 'NONE' | 'FLAT' | 'PERCENTAGE';
  orderDiscountValue?: number;
  couponCode?: string;
}

export interface SellerOrderResult {
  orderId: string;
  orderNumber: string;
  orderType?: SellerOrderType;
  totalAmount: number;
  payment: {
    paymentStatus: string;
    paidAtOrder: number;
    onCredit: number;
    credit: { idd: string; dueDate: string; outstandingAmount: number } | null;
  };
}

export const sellerOrderService = {
  stores(): Promise<SellerStore[]> {
    return api.get('/orders/for-customer/stores').then(res => res.data);
  },
  // `variantIds`: only these SKUs (to refresh an order's items).
  catalog(
    storeId: string,
    q?: string,
    categoryId?: string,
    variantIds?: string[],
  ): Promise<CatalogItem[]> {
    return api
      .get('/orders/for-customer/catalog', {
        params: {
          storeId,
          ...(q ? { q } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(variantIds?.length ? { variantIds: variantIds.join(',') } : {}),
        },
      })
      .then(res => res.data);
  },
  categories(storeId: string): Promise<StoreCategory[]> {
    return api
      .get('/orders/for-customer/categories', { params: { storeId } })
      .then(res => res.data);
  },
  customers(storeId: string, q?: string): Promise<StoreCustomer[]> {
    return api
      .get('/orders/for-customer/customers', {
        params: { storeId, ...(q ? { q } : {}) },
      })
      .then(res => res.data);
  },
  coupon(
    storeId: string,
    couponCode: string,
    customerPhone?: string,
  ): Promise<SellerCoupon> {
    return api
      .post('/orders/for-customer/coupon', {
        storeId,
        couponCode,
        ...(customerPhone ? { customerPhone } : {}),
      })
      .then(res => res.data);
  },
  create(payload: CreateSellerOrderPayload): Promise<SellerOrderResult> {
    return api.post('/orders/for-customer', payload).then(res => res.data);
  },
};
