/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { storeOperationsService } from '../src/services/store-operations-service';
import { storeService } from '../src/services/store-service';
import { authService } from '../src/services/auth-service';
import { change, RANGE_PRESETS, shortRupees } from '../src/lib/sales-report';
import { pastSplash, press, textOf, type } from '../jest/test-helpers';

// Ships untranspiled TypeScript that Jest doesn't transform.
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));

jest.mock('../src/services/auth-service', () => ({
  authService: { me: jest.fn(), logout: jest.fn(async () => ({})) },
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

jest.mock('../src/services/store-operations-service', () => ({
  storeOperationsService: { overview: jest.fn(), trend: jest.fn(), breakdown: jest.fn(), sales: jest.fn() },
}));

const metrics = (sales: number, orders: number, expenses: number, grossProfit: number | null) => ({
  sales,
  orders,
  expenses,
  collection: sales,
  cashCollection: sales,
  onlineCollection: 0,
  productCost: grossProfit === null ? null : sales - grossProfit,
  grossProfit,
  netProfit: grossProfit === null ? null : grossProfit - expenses,
  grossMargin: grossProfit === null ? null : (grossProfit / sales) * 100,
  netMargin: null,
  linesWithoutCost: 0,
});
const ALERTS = { lowStock: 0, outOfStock: 0, pendingStockOrders: 0, delayedStockOrders: 0 };

const ORDER = {
  id: 'o1',
  orderNumber: 'ORD-2001',
  orderedAt: '2026-11-02T09:00:00Z',
  orderStatus: 'DELIVERED',
  customerName: 'Asha Rao',
  customerPhone: '9800000001',
  paymentMethod: 'UPI',
  staffName: null,
  items: 2,
  units: 3,
  amount: 1500,
  profit: 300,
};

const { act } = ReactTestRenderer;
const ops = storeOperationsService as jest.Mocked<typeof storeOperationsService>;
const me = authService.me as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ firstName: 'Rajendra', userType: 'SELLER', permissions: ['store-operations:manage', 'orders:manage'] });
  (storeService.list as jest.Mock).mockResolvedValue([
    { id: 's1', name: 'Main Store', code: 'MAIN', status: 'ACTIVE' },
    { id: 's2', name: 'Second Store', code: 'SEC', status: 'ACTIVE' },
  ]);
  ops.overview.mockResolvedValue({ canViewProfit: true, period: metrics(124500, 83, 20000, 31125), previous: metrics(100000, 80, 25000, 20000), alerts: ALERTS });
  ops.trend.mockResolvedValue({
    canViewProfit: true,
    points: [
      { date: '2026-11-01', orders: 40, sales: 60000, expenses: 0, grossProfit: 15000, netProfit: 15000 },
      { date: '2026-11-02', orders: 43, sales: 64500, expenses: 0, grossProfit: 16125, netProfit: 16125 },
    ],
  });
  ops.breakdown.mockResolvedValue({
    byPaymentMethod: [
      { method: 'UPI', orders: 50, sales: 74700 },
      { method: 'CASH', orders: 33, sales: 49800 },
    ],
    byCategory: [{ categoryId: 'c1', name: 'Groceries', orders: 60, units: 120, sales: 90000, profit: 20000 }],
  });
  ops.sales.mockImplementation(async (_store, query) =>
    query.groupBy === 'none'
      ? { groupBy: 'none', canViewProfit: true, total: 23, items: [ORDER] }
      : { groupBy: query.groupBy, canViewProfit: true, total: 1, items: [{ key: 'c1', label: 'Groceries', sub: null, orders: 60, units: 120, sales: 90000, profit: 20000 }] },
  );
});

async function openReports() {
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
  await press(tree, 'Reports');
  return tree;
}

test('shows the KPIs, breakdowns and sales for this month', async () => {
  const tree = await openReports();
  const text = textOf(tree);
  expect(text).toContain('Sales Reports');
  expect(text).toContain('₹1,24,500');
  expect(text).toContain('↑ 24.5% ');
  // Expenses fell: the good direction.
  expect(text).toContain('↓ 20.0% ');
  expect(text).toContain('25.0%');
  expect(text).toContain('Groceries');
  expect(text).toContain('UPI');
  expect(text).toContain('ORD-2001');
  expect(text).toContain('Showing 1–10 of 23 orders');

  const thisMonth = RANGE_PRESETS.find(p => p.key === 'this-month')!.range(new Date());
  expect(ops.overview).toHaveBeenCalledWith('s1', thisMonth);
  expect(ops.trend).toHaveBeenCalledWith('s1', { ...thisMonth, interval: 'day' });

  await press(tree, 'Next page');
  expect(ops.sales).toHaveBeenLastCalledWith('s1', { ...thisMonth, groupBy: 'none', page: 2, limit: 10 });

  await act(async () => tree.unmount());
});

test('changes store, range, grouping, search and payment filter', async () => {
  const tree = await openReports();

  // The header's store switcher.
  await press(tree, 'Store: Main Store. Switch store');
  await press(tree, 'Second Store');
  expect(ops.overview).toHaveBeenLastCalledWith('s2', expect.anything());

  await press(tree, 'Last 90 Days');
  const last90 = RANGE_PRESETS.find(p => p.key === '90d')!.range(new Date());
  // 90 days are charted by week.
  expect(ops.trend).toHaveBeenLastCalledWith('s2', { ...last90, interval: 'week' });

  await press(tree, 'View All');
  expect(ops.sales).toHaveBeenLastCalledWith('s2', expect.objectContaining({ groupBy: 'category', page: 1 }));
  expect(textOf(tree)).toContain('60 orders · 120 units');

  await press(tree, 'All');
  await type(tree, 'Search by order ID, customer, product…', 'asha');
  await act(() => new Promise<void>(resolve => setTimeout(resolve, 400)));
  expect(ops.sales).toHaveBeenLastCalledWith('s2', expect.objectContaining({ groupBy: 'none', search: 'asha' }));

  await press(tree, 'Filters');
  // The sheet's option, not the payment-method legend row of the same name.
  const cash = tree.root.find(n => n.props.accessibilityRole === 'radio' && n.props.onPress && textOf({ toJSON: () => n } as never).includes('"Cash"'));
  await act(async () => cash.props.onPress());
  expect(ops.sales).toHaveBeenLastCalledWith('s2', expect.objectContaining({ paymentMethod: 'CASH', search: 'asha' }));


  await act(async () => tree.unmount());
});

test('hides profit for roles without store-profit:view', async () => {
  ops.overview.mockResolvedValue({ canViewProfit: false, period: metrics(5000, 5, 0, null), previous: metrics(0, 0, 0, null), alerts: ALERTS });
  const tree = await openReports();
  const text = textOf(tree);
  expect(text).toContain('Total Sales');
  expect(text).not.toContain('Gross Profit');
  expect(text).not.toContain('Profit Margin');

  await act(async () => tree.unmount());
});

test('report helpers', () => {
  expect(change(120, 100)).toBe(20);
  expect(change(5, 0)).toBeNull();
  expect(change(0, 0)).toBe(0);
  expect(shortRupees(124500)).toBe('₹1.24 L');
  expect(shortRupees(12500)).toBe('₹12.50K');
});
