/**
 * @format
 */

import React from 'react';
import { RefreshControl } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { sellerOrderService } from '../src/services/seller-order-service';
import { orderRequestService } from '../src/services/order-request-service';
import { dashboardService } from '../src/services/dashboard-service';
import { orderService } from '../src/services/order-service';
import { pastSplash, press, textOf, type } from '../jest/test-helpers';

jest.mock('../src/services/auth-service', () => ({
  authService: {
    me: jest.fn(async () => ({ firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage', 'customer-credit:manage'] })),
    logout: jest.fn(async () => ({})),
  },
}));

jest.mock('../src/services/dashboard-service', () => ({
  ...jest.requireActual('../src/services/dashboard-service'),
  dashboardService: {
    today: jest.fn(async () => ({ storeName: null, kpis: { orders: null, sales: null, customers: null, products: null } })),
    customerCount: jest.fn(async () => 0),
    unreadNotifications: jest.fn(async () => 0),
    notifications: jest.fn(async () => ({ items: [], unreadCount: 0 })),
  },
}));

const STORE = { id: 's1', name: 'Sah Traders', code: 'ST', creditAllowed: true, maxCreditDays: 15, taxInclusive: true };
const RICE = {
  productId: 'p1',
  productName: 'Rice 1kg',
  variantId: 'v1',
  hasVariants: false,
  variantLabel: null,
  options: {},
  swatches: {},
  sku: 'RICE1',
  barcode: null,
  price: 100,
  mrp: 110,
  stock: 10,
  minimumQuantity: 1,
  gstPercentage: 5,
  imageUrl: null,
};

jest.mock('../src/services/seller-order-service', () => ({
  sellerOrderService: {
    stores: jest.fn(),
    catalog: jest.fn(),
    categories: jest.fn(async () => []),
    customers: jest.fn(async () => []),
    coupon: jest.fn(),
    create: jest.fn(async () => ({
      orderId: 'new1',
      orderNumber: 'ORD-2001',
      totalAmount: 200,
      payment: { paymentStatus: 'PAID', paidAtOrder: 200, onCredit: 0, credit: null },
    })),
  },
}));

jest.mock('../src/services/order-request-service', () => ({
  ...jest.requireActual('../src/services/order-request-service'),
  orderRequestService: { list: jest.fn(), get: jest.fn(), updateStatus: jest.fn(async () => ({})), updateItems: jest.fn(), bill: jest.fn() },
}));

jest.mock('../src/services/order-service', () => ({
  orderService: {
    list: jest.fn(async () => []),
    get: jest.fn(async (id: string) => ({ id, uniqueOrderId: 'ORD-9', orderStatus: 'CREATED', fulfillmentType: 'PICKUP', items: [] })),
    payments: jest.fn(async () => null),
    invoices: jest.fn(async () => []),
    receipts: jest.fn(async () => []),
  },
}));

const { act } = ReactTestRenderer;
const seller = sellerOrderService as jest.Mocked<typeof sellerOrderService>;
const requests = orderRequestService as jest.Mocked<typeof orderRequestService>;

beforeEach(() => {
  jest.clearAllMocks();
  seller.stores.mockResolvedValue([STORE]);
  seller.catalog.mockResolvedValue([RICE] as never);
});

async function signedIn() {
  await AsyncStorage.setItem('app.onboarded', '1');
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({
    username: 'session',
    password: JSON.stringify({ accessToken: 'a', refreshToken: 'r' }),
  });
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await pastSplash();
  return tree;
}

/** Waits out the picker's search debounce. */
const settle = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 400)));

async function newOrderWithRice(tree: ReactTestRenderer.ReactTestRenderer, times = 2) {
  await press(tree, 'Orders');
  await press(tree, 'New order');
  await press(tree, 'Add products');
  await settle();
  for (let i = 0; i < times; i++) await press(tree, 'Add Rice 1kg');
  await press(tree, 'Done');
}

test('a quick sale: items, no customer, paid now', async () => {
  const tree = await signedIn();
  await newOrderWithRice(tree);
  expect(textOf(tree)).toContain('₹200');

  await press(tree, 'Continue');
  // Price and stock are checked again before moving on.
  expect(seller.catalog).toHaveBeenLastCalledWith('s1', undefined, undefined, ['v1']);
  await press(tree, 'Quick Sale');
  await press(tree, 'Place order · ₹200');

  expect(seller.create).toHaveBeenCalledWith({
    storeId: 's1',
    items: [{ productId: 'p1', variantId: 'v1', quantity: 2, uom: 'PCS' }],
    handOverNow: true,
    orderType: 'QUICK_SALE',
    paymentOption: 'PAY_NOW',
    payments: [{ method: 'CASH' }],
  });
  expect(textOf(tree)).toContain('Order placed');
  expect(textOf(tree)).toContain('"ORD-2001"," ","· Quick Sale"," at ","Sah Traders"," ·"," ","completed and invoiced"');

  await act(async () => tree.unmount());
});

test('a new customer on Customer Credit, with reminder terms', async () => {
  const tree = await signedIn();
  await newOrderWithRice(tree, 1);
  await press(tree, 'Continue');
  await press(tree, 'New customer');
  await type(tree, '10-digit mobile number', '9876543210');
  await type(tree, "Customer's name", 'Asha Rao');
  await press(tree, 'Continue to payment');
  await press(tree, 'Payment option: Customer Credit');
  await press(tree, 'Place order · ₹100');

  const payload = seller.create.mock.calls[0][0];
  expect(payload).toMatchObject({
    storeId: 's1',
    customerName: 'Asha Rao',
    customerPhone: '9876543210',
    countryCode: '91',
    customerType: 'INDIVIDUAL',
    saveCustomer: true,
    paymentOption: 'PAY_CREDIT',
    payments: [],
    credit: { reminderEnabled: true, reminderDays: 1, reminderChannels: ['IN_APP'] },
  });
  expect(payload.credit?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  await act(async () => tree.unmount());
});

test('ordering beyond the stock needs a confirmation', async () => {
  seller.catalog.mockResolvedValue([{ ...RICE, stock: 1 }] as never);
  const tree = await signedIn();
  await newOrderWithRice(tree);
  expect(textOf(tree)).toContain('Confirm the out-of-stock item to continue');

  await press(tree, 'Sell anyway — the stock goes below 0');
  expect(textOf(tree)).not.toContain('Confirm the out-of-stock item');

  await act(async () => tree.unmount());
});

test('an order request is confirmed, then billed as an order', async () => {
  const detail = {
    id: 'r1',
    requestNumber: 'REQ-11',
    status: 'REQUESTED',
    statusNote: null,
    createdAt: '2026-11-02T08:00:00Z',
    statusUpdatedAt: '2026-11-02T08:00:00Z',
    store: { id: 's1', name: 'Sah Traders', code: 'ST' },
    customer: { id: null, name: 'Meena K', countryCode: '91', mobile: '9811111111', email: null, address: null, note: 'Ring the bell' },
    items: [{ id: 'ri1', productId: 'p1', productSlug: null, variantId: 'v1', name: 'Rice 1kg', variantLabel: null, sku: 'RICE1', imageUrl: null, quantity: 3, uom: 'PCS', sellingQuantity: 3, sellingUom: 'PCS', catalogItem: RICE }],
    bill: null,
    nextStatuses: ['UNDER_REVIEW', 'CONFIRMED', 'REJECTED'],
    canEdit: true,
  };
  requests.list.mockResolvedValue({ items: [{ id: 'r1', requestNumber: 'REQ-11', status: 'REQUESTED', storeId: 's1', storeName: 'Sah Traders', customerName: 'Meena K', customerMobile: '9811111111', customerNote: null, itemCount: 1, orderId: null, orderNumber: null, createdAt: detail.createdAt, statusUpdatedAt: detail.createdAt }], total: 1, page: 1, limit: 100, counts: { REQUESTED: 1 } } as never);
  requests.get.mockResolvedValue(detail as never);
  requests.bill.mockResolvedValue({ orderId: 'o9', orderNumber: 'ORD-9', totalAmount: 300, requestId: 'r1', payment: { paymentStatus: 'PAID', paidAtOrder: 300, onCredit: 0, credit: null } } as never);

  const tree = await signedIn();
  await press(tree, 'Open menu');
  await press(tree, 'Order Requests');
  await press(tree, 'Request REQ-11, New');
  expect(textOf(tree)).toContain('In stock (10)');

  await press(tree, 'Confirm request');
  expect(requests.updateStatus).toHaveBeenCalledWith('r1', 'CONFIRMED', undefined);

  await press(tree, 'Generate final bill');
  // The bill starts from the request: its store, customer and items.
  expect(textOf(tree)).toContain('Final bill · REQ-11');
  expect(textOf(tree)).toContain('₹300');
  await press(tree, 'Continue');
  await press(tree, 'Continue to payment');
  await press(tree, 'Save bill & create order');
  expect(requests.bill).toHaveBeenCalledWith('r1', expect.objectContaining({ customerName: 'Meena K', customerPhone: '9811111111', customerNote: 'Ring the bell' }));

  await act(async () => tree.unmount());
});

test('a new order alerts, and View opens it', async () => {
  const tree = await signedIn();
  const notifications = dashboardService.notifications as jest.Mock;
  notifications.mockResolvedValue({
    unreadCount: 1,
    items: [{ id: 'n1', type: 'NEW_ORDER', title: 'New order #ORD-77', message: '2 items · ₹450 from Ravi', link: '/dashboard/orders/o77', data: null, readAt: null, createdAt: '2026-11-02T09:00:00Z' }],
  });
  // Pull to refresh on Home checks notifications too.
  const refresh = tree.root.findByType(RefreshControl);
  await act(async () => refresh.props.onRefresh());
  expect(textOf(tree)).toContain('New order #ORD-77');

  await press(tree, 'View');
  expect(orderService.get).toHaveBeenCalledWith('o77');
  expect(textOf(tree)).not.toContain('New order #ORD-77');

  await act(async () => tree.unmount());
});
