/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
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

const base = { fulfillmentType: 'PICKUP', paymentMode: 'COD', paymentStatus: 'PENDING', store: { name: 'Main Store' } };
const ORDERS = [
  { ...base, id: 'o1', uniqueOrderId: 'ORD-1001', orderStatus: 'CREATED', customerName: 'Asha Rao', customerPhone: '9800000001', totalAmount: 500, createdAt: '2026-11-02T09:00:00Z' },
  { ...base, id: 'o2', uniqueOrderId: 'ORD-1002', orderStatus: 'PACKED', customerName: 'Vikram Shah', customerPhone: '9800000002', totalAmount: 1200, createdAt: '2026-11-02T08:00:00Z' },
  { ...base, id: 'o3', uniqueOrderId: 'ORD-1003', orderStatus: 'DELIVERED', customerName: 'Meena K', paymentStatus: 'PAID', totalAmount: 300, createdAt: '2026-11-01T08:00:00Z' },
];
const ITEM = { id: 'i1', productName: 'Basmati Rice 5kg', variantLabel: null, sku: 'RICE5', quantity: 2, unitPrice: 250, finalPrice: 250, imageUrl: null };

const paymentSummary = (amountDue: number) => ({
  orderId: 'x',
  orderNumber: 'ORD',
  paymentStatus: 'PENDING',
  creditAllowed: true,
  maxCreditDays: 15,
  paymentPreference: null,
  creditRequest: null,
  totalAmount: amountDue,
  paidAtOrder: 0,
  onCredit: 0,
  amountDue,
  payments: [],
  credit: null,
});

jest.mock('../src/services/order-service', () => ({
  orderService: {
    list: jest.fn(),
    get: jest.fn(),
    payments: jest.fn(),
    updatePickupStatus: jest.fn(async () => ({})),
    recordPayment: jest.fn(async () => ({})),
    decideCreditRequest: jest.fn(async () => ({})),
  },
}));

const { act } = ReactTestRenderer;
const mocked = orderService as jest.Mocked<typeof orderService>;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.list.mockResolvedValue(ORDERS as never);
  mocked.get.mockImplementation(async id => ({ ...ORDERS.find(o => o.id === id)!, items: [ITEM], subtotal: 500 }) as never);
  mocked.payments.mockImplementation(async id => paymentSummary(id === 'o2' ? 1200 : 500) as never);
});

async function openOrders() {
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
  await press(tree, 'Orders');
  return tree;
}

test('lists orders with filters and search', async () => {
  const tree = await openOrders();
  let text = textOf(tree);
  expect(text).toContain('ORD-1001');
  expect(text).toContain('ORD-1003');
  expect(text).toContain('₹1,200');

  await press(tree, 'Ready');
  text = textOf(tree);
  expect(text).toContain('ORD-1002');
  expect(text).not.toContain('ORD-1001');

  await press(tree, 'All');
  await type(tree, 'Search order ID, customer, phone', 'asha');
  text = textOf(tree);
  expect(text).toContain('ORD-1001');
  expect(text).not.toContain('ORD-1002');

  await act(async () => tree.unmount());
});

test('accepts a new order', async () => {
  const tree = await openOrders();
  await press(tree, 'Order ORD-1001, New, ₹500');
  expect(textOf(tree)).toContain('Basmati Rice 5kg');

  await press(tree, 'Accept order');
  expect(mocked.updatePickupStatus).toHaveBeenCalledWith('o1', 'CONFIRMED', undefined);
  expect(textOf(tree)).toContain('Order marked accepted');

  await act(async () => tree.unmount());
});

test('collects a split payment and completes a ready order', async () => {
  const tree = await openOrders();
  await press(tree, 'Order ORD-1002, Ready for pickup, ₹1,200');
  await press(tree, 'Collect payment');

  // Cash starts at the full amount due; split it with UPI.
  const amount = (label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0];
  await act(async () => amount('Cash amount').props.onChangeText('1000'));
  // Short by ₹200: completing is blocked until it's collected or put on credit.
  expect(textOf(tree)).toContain('₹200 is still unpaid');
  await act(async () => amount('UPI amount').props.onChangeText('200'));
  await type(tree, 'Reference no. (optional)', 'UPI123');

  await press(tree, 'Paid · mark picked up');
  expect(mocked.recordPayment).toHaveBeenCalledWith('o2', {
    payments: [
      { method: 'CASH', amount: 1000 },
      { method: 'UPI', amount: 200, referenceNumber: 'UPI123' },
    ],
    completeOrder: true,
  });

  await act(async () => tree.unmount());
});

test('cancels an order with a reason', async () => {
  const tree = await openOrders();
  await press(tree, 'Order ORD-1001, New, ₹500');
  await press(tree, 'Cancel');
  await type(tree, 'Reason (optional) — e.g. item out of stock', 'Out of stock');
  await press(tree, 'Cancel order');
  expect(mocked.updatePickupStatus).toHaveBeenCalledWith('o1', 'CANCELLED', 'Out of stock');

  await act(async () => tree.unmount());
});
