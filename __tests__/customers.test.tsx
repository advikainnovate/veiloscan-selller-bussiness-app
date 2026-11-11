/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { customerService } from '../src/services/customer-service';
import { authService } from '../src/services/auth-service';
import { pastSplash, press, textOf, type } from '../jest/test-helpers';

// Ships untranspiled TypeScript that Jest doesn't transform.
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));

jest.mock('../src/services/auth-service', () => ({
  authService: {
    me: jest.fn(),
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

jest.mock('../src/services/customer-service', () => ({
  customerService: { list: jest.fn(), summary: jest.fn(), get: jest.fn(), orders: jest.fn(), addresses: jest.fn() },
}));

jest.mock('../src/services/customer-credit-service', () => ({
  ...jest.requireActual('../src/services/customer-credit-service'),
  customerCreditService: {
    customer: jest.fn(async () => ({ totalCredit: 6500, totalPaid: 0, outstanding: 6500, overdueAmount: 2000, credits: [] })),
  },
}));

const customer = (id: string, firstName: string, lastName: string, extra: object) => ({
  id,
  idd: `CUST-${id}`,
  firstName,
  lastName,
  email: `${id}@store-customer.veiloscan.invalid`,
  countryCode: '91',
  phoneNumber: '9876543210',
  status: 'ACTIVE',
  createdAt: '2026-10-01T09:00:00Z',
  orderCount: 3,
  lifetimePurchase: 12500,
  lastOrderAt: '2026-11-01T09:00:00Z',
  creditOutstanding: 0,
  creditOverdue: 0,
  ...extra,
});

const RAJESH = customer('10024', 'Rajesh', 'Kumar', {});
const SURESH = customer('10022', 'Suresh', 'Patel', { lifetimePurchase: 7980, creditOutstanding: 6500, creditOverdue: 2000 });

const { act } = ReactTestRenderer;
const mocked = customerService as jest.Mocked<typeof customerService>;
const me = authService.me as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ firstName: 'Rajendra', userType: 'SELLER', permissions: ['customers:manage', 'customer-credit:manage', 'orders:manage'] });
  mocked.summary.mockResolvedValue({ total: 2624, newThisMonth: 142, top: 40, withCredit: 86, creditOutstanding: 124500 });
  mocked.list.mockImplementation(async ({ view, page }) => ({
    items: view === 'credit' ? [SURESH] : [RAJESH, SURESH],
    total: view === 'credit' ? 1 : 2624,
    page,
    limit: 50,
  }) as never);
  mocked.get.mockImplementation(async id => ({ ...(id === SURESH.id ? SURESH : RAJESH) }) as never);
  mocked.orders.mockResolvedValue([
    { id: 'o1', uniqueOrderId: 'ORD-501', orderStatus: 'DELIVERED', fulfillmentType: 'PICKUP', paymentStatus: 'PAID', totalAmount: 7980, orderDateTime: '2026-11-01T09:00:00Z' },
  ] as never);
  mocked.addresses.mockResolvedValue([]);
});

async function openCustomers() {
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
  await press(tree, 'Customers');
  return tree;
}

test('shows the customer figures, credit and purchases', async () => {
  const tree = await openCustomers();
  const text = textOf(tree);
  expect(text).toContain('2,624');
  expect(text).toContain('₹1,24,500');
  expect(text).toContain('Rajesh Kumar');
  expect(text).toContain('+91 98765 43210  •  ');
  expect(text).toContain('₹12,500');
  expect(text).toContain(' (Overdue ₹2,000)');
  expect(text).toContain('1 / 53');

  await press(tree, 'Next page');
  expect(mocked.list).toHaveBeenLastCalledWith({ page: 2, limit: 50, view: 'all' });

  await act(async () => tree.unmount());
});

test('switches tabs and searches on the server', async () => {
  const tree = await openCustomers();

  await press(tree, 'With Credit (86)');
  expect(mocked.list).toHaveBeenLastCalledWith({ page: 1, limit: 50, view: 'credit' });
  expect(textOf(tree)).not.toContain('Rajesh Kumar');

  await type(tree, 'Search by name, mobile or customer ID', 'suresh');
  await act(() => new Promise<void>(resolve => setTimeout(resolve, 400)));
  expect(mocked.list).toHaveBeenLastCalledWith({ page: 1, limit: 50, view: 'credit', search: 'suresh' });

  // A customer opens their own page: account, orders with you, addresses and credit.
  await press(tree, 'Suresh Patel, lifetime purchase ₹7,980');
  expect(mocked.get).toHaveBeenCalledWith('10022');
  const text = textOf(tree);
  expect(text).toContain('Call');
  expect(text).toContain('No email (store customer)');
  expect(text).toContain('₹6,500 due');
  expect(text).toContain('Orders with you');
  expect(mocked.orders).toHaveBeenCalledWith('10022');

  await act(async () => tree.unmount());
});

test('hides credit for roles without Customer Credit', async () => {
  me.mockResolvedValue({ firstName: 'Rajendra', userType: 'SELLER', permissions: ['customers:manage'] });
  mocked.summary.mockResolvedValue({ total: 2, newThisMonth: 0, top: 2, withCredit: null, creditOutstanding: null });
  mocked.list.mockResolvedValue({
    items: [{ ...RAJESH, creditOutstanding: null, creditOverdue: null }],
    total: 1,
    page: 1,
    limit: 50,
  } as never);
  const tree = await openCustomers();
  const text = textOf(tree);
  expect(text).toContain('Rajesh Kumar');
  expect(text).not.toContain('With Credit');
  expect(text).not.toContain('Credit: ');

  await act(async () => tree.unmount());
});
