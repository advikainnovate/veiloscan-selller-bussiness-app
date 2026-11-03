/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import type { InternalAxiosRequestConfig } from 'axios';
import App from '../App';
import { api, setRequestStoreId } from '../src/lib/api';
import { customerService } from '../src/services/customer-service';
import { storeService } from '../src/services/store-service';
import { pastSplash, press, textOf } from '../jest/test-helpers';

// Ships untranspiled TypeScript that Jest doesn't transform.
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));

jest.mock('../src/services/auth-service', () => ({
  authService: {
    me: jest.fn(async () => ({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['customers:manage'] })),
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
  customerService: { list: jest.fn(), summary: jest.fn() },
}));

const { act } = ReactTestRenderer;
const customers = customerService as jest.Mocked<typeof customerService>;

const STORES = [
  { id: 's1', name: 'Main Store', code: 'MAIN', status: 'ACTIVE' },
  { id: 's2', name: 'Second Store', code: 'SEC', status: 'ACTIVE' },
];

beforeEach(() => {
  jest.clearAllMocks();
  (storeService.list as jest.Mock).mockResolvedValue(STORES);
  customers.summary.mockResolvedValue({ total: 0, newThisMonth: 0, top: 0, withCredit: null, creditOutstanding: null });
  customers.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 });
});

async function signIn() {
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

test('remembers the store, switches it and reloads the data', async () => {
  await AsyncStorage.setItem('app.currentStoreId.u1', 's2');
  const tree = await signIn();
  await press(tree, 'Customers');
  // The remembered store, not the first one.
  expect(textOf(tree)).toContain('Second Store');
  const before = customers.list.mock.calls.length;
  expect(before).toBeGreaterThan(0);

  await press(tree, 'Store: Second Store. Switch store');
  expect(textOf(tree)).toContain('Switch store');
  await press(tree, 'Main Store');

  expect(customers.list.mock.calls.length).toBeGreaterThan(before);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('app.currentStoreId.u1', 's1');
  expect(textOf(tree)).toContain('Switched to Main Store');

  await act(async () => tree.unmount());
});

test('shows no switcher with a single store', async () => {
  (storeService.list as jest.Mock).mockResolvedValue([STORES[0]]);
  const tree = await signIn();
  await press(tree, 'Customers');
  expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Store: Main Store. Switch store')).toHaveLength(0);
  expect(customers.list).toHaveBeenCalled();

  await act(async () => tree.unmount());
});

test('sends the picked store with every request', async () => {
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter = async (config: InternalAxiosRequestConfig) => {
    seen.push(config);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };

  setRequestStoreId('s9');
  await api.get('/orders', { adapter });
  // The store list itself goes out without one.
  await api.get('/stores', { adapter, headers: { 'X-Store-Id': '' } });
  setRequestStoreId(null);
  await api.get('/orders', { adapter });

  expect(seen[0].headers.get('X-Store-Id')).toBe('s9');
  expect(seen[1].headers.get('X-Store-Id')).toBeFalsy();
  expect(seen[2].headers.get('X-Store-Id')).toBeUndefined();
});
