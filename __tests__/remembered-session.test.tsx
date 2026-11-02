/**
 * @format
 */

import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { pastSplash, press, textOf } from '../jest/test-helpers';

jest.mock('../src/services/auth-service', () => ({
  authService: {
    me: jest.fn(async () => ({
      firstName: 'Rajendra',
      lastName: 'Sah',
      userType: 'SELLER',
      permissions: ['orders:manage', 'products-master:manage'],
    })),
    logout: jest.fn(async () => ({})),
  },
}));

jest.mock('../src/services/dashboard-service', () => ({
  ...jest.requireActual('../src/services/dashboard-service'),
  dashboardService: {
    today: jest.fn(async () => ({
      storeName: 'Sah Traders',
      kpis: {
        orders: { value: 24, previous: 20 },
        sales: { value: 128450, previous: 108856 },
        customers: null,
        products: { value: 1286, previous: 1280 },
      },
    })),
    customerCount: jest.fn(async () => 3627),
    unreadNotifications: jest.fn(async () => 2),
    notifications: jest.fn(async () => ({ items: [], unreadCount: 2 })),
  },
}));

jest.mock('../src/services/order-request-service', () => ({
  ...jest.requireActual('../src/services/order-request-service'),
  orderRequestService: {
    list: jest.fn(async () => ({ items: [], total: 0, page: 1, limit: 100, counts: { REQUESTED: 2 } })),
  },
}));

const { act } = ReactTestRenderer;

async function openSignedIn() {
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

test('a remembered sign-in opens on the Home tab, and signing out returns to Sign In', async () => {
  const tree = await openSignedIn();
  const home = textOf(tree);
  expect(home).toContain('Quick Access');
  // Today's figures against yesterday, in Indian grouping.
  expect(home).toContain('Today Orders');
  expect(home).toContain('"24"');
  expect(home).toContain('+20%');
  expect(home).toContain('₹1,28,450');
  expect(home).toContain('1,286');
  // No customers:manage in this role: no customer card.
  expect(home).not.toContain('Total Customers');

  await press(tree, 'Open menu');
  // Sign out asks first; confirm it.
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find(b => b.style === 'destructive')?.onPress?.();
  });
  await press(tree, 'Sign Out');
  expect(alert).toHaveBeenCalled();
  expect(textOf(tree)).toContain('Seller Sign In');

  await act(async () => tree.unmount());
});

test('the menu shows only what the role allows, and opens pages and tabs', async () => {
  const tree = await openSignedIn();

  await press(tree, 'Open menu');
  const menu = textOf(tree);
  expect(menu).toContain('Order Requests'); // orders:manage
  expect(menu).toContain('Product Variants'); // implied by products-master:manage
  expect(menu).toContain('Subscription'); // needs no permission
  expect(menu).not.toContain('Coupons');
  expect(menu).not.toContain('Customer Credit');

  // A built module opens its own screen…
  await press(tree, 'Order Requests');
  expect(textOf(tree)).toContain('No order requests yet');
  await press(tree, 'Back');

  // …one still to come opens its placeholder.
  await press(tree, 'Open menu');
  await press(tree, 'Product Variants');
  expect(textOf(tree)).toContain('Product Variants is coming to the app soon');

  // A tab the role can't open says so.
  await press(tree, 'Back');
  await press(tree, 'Customers');
  expect(textOf(tree)).toContain("Your role doesn't include Customers");

  await act(async () => tree.unmount());
});
