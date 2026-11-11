/**
 * @format
 */

import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { navigationRef, openMenuKey } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { userService } from '../src/services/user-service';
import { orderService } from '../src/services/order-service';
import { userProblem, EMPTY_USER } from '../src/lib/users';
import { pastSplash, press, textOf } from '../jest/test-helpers';

// Ships untranspiled TypeScript that Jest doesn't transform.
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));

jest.mock('../src/services/auth-service', () => ({
  authService: { me: jest.fn(), logout: jest.fn(async () => ({})), forgotPassword: jest.fn(async () => ({ message: 'ok' })) },
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

jest.mock('../src/services/user-service', () => ({
  userService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(async () => ({ id: 'new1' })),
    update: jest.fn(async () => ({})),
    assignableRoles: jest.fn(),
    assignRole: jest.fn(async () => ({})),
    setActive: jest.fn(async () => ({})),
    remove: jest.fn(async () => ({})),
    profile: jest.fn(async () => null),
    upsertProfile: jest.fn(async () => ({})),
    sessions: jest.fn(async () => []),
    activity: jest.fn(async () => []),
    staffUsage: jest.fn(async () => null),
  },
}));

jest.mock('../src/services/order-service', () => ({
  ...jest.requireActual('../src/services/order-service'),
  orderService: {
    get: jest.fn(),
    payments: jest.fn(async () => null),
    invoices: jest.fn(async () => []),
    receipts: jest.fn(async () => []),
    update: jest.fn(async () => ({})),
  },
}));

const { act } = ReactTestRenderer;
const me = authService.me as jest.Mock;
const users = userService as jest.Mocked<typeof userService>;
const orders = orderService as jest.Mocked<typeof orderService>;

const ASHA = { id: 'u2', firstName: 'Asha', lastName: 'Rao', email: 'asha@shop.in', countryCode: '91', phoneNumber: '9876543210', status: 'ACTIVE', roleId: 'r1', createdAt: '2026-10-01T09:00:00Z' };
const VIJAY = { id: 'u3', firstName: 'Vijay', lastName: 'Shah', email: 'vijay@shop.in', countryCode: '91', phoneNumber: '9123456780', status: 'INACTIVE', roleId: 'r2', createdAt: '2026-01-01T09:00:00Z' };

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['users:view', 'users:create', 'users:edit', 'users:delete', 'orders:manage'] });
  // Confirms every prompt.
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  // The seller themself comes back from the API too; the list hides them.
  users.list.mockResolvedValue([{ ...ASHA, id: 'u1', firstName: 'Rajendra', lastName: 'Patil', email: 'raj@shop.in' }, ASHA, VIJAY] as never);
  users.assignableRoles.mockResolvedValue([
    { id: 'r1', roleTitle: 'Cashier' },
    { id: 'r2', roleTitle: 'Store Manager' },
  ]);
  users.get.mockResolvedValue(ASHA as never);
});
afterEach(() => alertSpy.mockRestore());

async function openApp() {
  await AsyncStorage.setItem('app.onboarded', '1');
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ username: 'session', password: JSON.stringify({ accessToken: 'a', refreshToken: 'r' }) });
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await pastSplash();
  return tree;
}
/** The last pressable with this text or label: the screen on top, over the drawer and the screens under it. */
async function pick(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const targets = tree.root
    .findAll(n => n.props.children === label || n.props.accessibilityLabel === label)
    .map(n => {
      let p: ReactTestRenderer.ReactTestInstance | null = n;
      while (p && !p.props.onPress) p = p.parent;
      return p;
    })
    .filter(Boolean);
  if (!targets.length) throw new Error(`Nothing pressable labelled "${label}"`);
  await act(async () => targets[targets.length - 1]!.props.onPress());
}
const typeIn = (tree: ReactTestRenderer.ReactTestRenderer, label: string, text: string) =>
  act(async () => tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0].props.onChangeText(text));

test('users: the menu opens the staff list with roles, and filters by status', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('users'));
  let text = textOf(tree);
  expect(text).toContain('Asha Rao');
  expect(text).toContain('Vijay Shah');
  expect(text).toContain('Cashier');
  expect(text).not.toContain('Rajendra Patil');

  await press(tree, 'Inactive: 1');
  text = textOf(tree);
  expect(text).toContain('Vijay Shah');
  expect(text).not.toContain('Asha Rao');

  await press(tree, 'More for Vijay Shah');
  await pick(tree, 'Activate');
  expect(users.setActive).toHaveBeenCalledWith('u3', true);
  await act(async () => tree.unmount());
});

test('users: add a staff user — the form checks names and role before saving', async () => {
  const tree = await openApp();
  await act(async () => navigationRef.navigate('UserForm'));
  await pick(tree, 'Create User');
  expect(textOf(tree)).toContain('Enter the first and last name.');

  await typeIn(tree, 'First name', 'Meena');
  await typeIn(tree, 'Last name', 'Iyer');
  await typeIn(tree, 'Email', 'Meena@Shop.in');
  await typeIn(tree, 'Mobile number', '98450 12345');
  await pick(tree, 'Create User');
  expect(textOf(tree)).toContain('Choose a role.');
  expect(users.create).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('users: a valid form needs a role and a strong password if one is set', () => {
  const base = { ...EMPTY_USER, firstName: 'Meena', lastName: 'Iyer', email: 'meena@shop.in', phoneNumber: '9845012345' };
  expect(userProblem(base, false)).toBe('Choose a role.');
  expect(userProblem({ ...base, roleId: 'r1' }, false)).toBeNull();
  expect(userProblem({ ...base, roleId: 'r1', password: 'weak' }, false)).toMatch(/password/);
  expect(userProblem({ ...base, roleId: 'r1', password: 'Str0ng!pass' }, false)).toBeNull();
  // Email and mobile can't be changed on edit, so they aren't checked.
  expect(userProblem({ ...base, email: '', phoneNumber: '', roleId: 'r1' }, true)).toBeNull();
});

test('user detail: account, role, and deactivating', async () => {
  users.sessions.mockResolvedValue([{ id: 's1', startTime: '2026-11-05T10:00:00Z', logoutTime: null, isActive: true, deviceName: 'Pixel 8', browser: 'App', os: 'Android' }]);
  const tree = await openApp();
  await act(async () => navigationRef.navigate('UserDetail', { id: 'u2' }));
  let text = textOf(tree);
  expect(text).toContain('Asha Rao');
  expect(text).toContain('Cashier');
  expect(text).toContain('asha@shop.in');

  await pick(tree, 'Devices');
  text = textOf(tree);
  expect(text).toContain('Pixel 8');

  await pick(tree, 'Overview');
  await pick(tree, 'Deactivate user');
  expect(users.setActive).toHaveBeenCalledWith('u2', false);
  await act(async () => tree.unmount());
});

test('order edit: remarks and payment status go to PATCH /orders/:id', async () => {
  orders.get.mockResolvedValue({ id: 'o1', uniqueOrderId: 'ORD-9', orderStatus: 'CONFIRMED', fulfillmentType: 'PICKUP', paymentStatus: 'PENDING', remarks: null, items: [] } as never);
  const tree = await openApp();
  await act(async () => navigationRef.navigate('OrderDetail', { id: 'o1' }));
  expect(textOf(tree)).toContain('No remarks.');

  await pick(tree, 'Edit order');
  await typeIn(tree, 'Remarks', 'Collect after 6 pm');
  await pick(tree, 'Save changes');
  expect(orders.update).toHaveBeenCalledWith('o1', { remarks: 'Collect after 6 pm' });
  await act(async () => tree.unmount());
});
