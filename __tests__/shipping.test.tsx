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
import { shippingMethodService, shippingZoneService } from '../src/services/shipping-service';
import { etaLabel, methodPayload, methodProblem, rateLabel, slugify, EMPTY_METHOD } from '../src/lib/shipping';
import { pastSplash, press, textOf } from '../jest/test-helpers';

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

jest.mock('../src/services/shipping-service', () => {
  const c = () => ({ list: jest.fn(async () => []), get: jest.fn(), create: jest.fn(async () => ({ id: 'new1' })), update: jest.fn(async () => ({})), remove: jest.fn(async () => ({})) });
  return { shippingZoneService: c(), shippingMethodService: c() };
});

const { act } = ReactTestRenderer;
const zones = shippingZoneService as jest.Mocked<typeof shippingZoneService>;
const methods = shippingMethodService as jest.Mocked<typeof shippingMethodService>;
const me = authService.me as jest.Mock;

const ZONES = [
  { id: 'z1', zoneTitle: 'South India', zoneSlug: 'south-india', coveredStates: ['Karnataka', 'Kerala'], status: 1, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z' },
  { id: 'z2', zoneTitle: 'Everywhere else', zoneSlug: 'rest', coveredStates: [], status: 0 },
];
const METHODS = [{ id: 'm1', zoneId: 'z1', methodTitle: 'Standard Delivery', methodSlug: 'standard-delivery', rateType: 'FIXED', rate: '49.00', freeAboveOrderValue: '999.00', estimatedDaysMin: 3, estimatedDaysMax: 5, status: 1 }];

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['shipping:manage'] });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  zones.list.mockResolvedValue(ZONES as never);
  zones.get.mockImplementation(async id => ZONES.find(z => z.id === id) as never);
  methods.list.mockResolvedValue(METHODS as never);
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
const field = (tree: ReactTestRenderer.ReactTestRenderer, label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0];
const typeIn = (tree: ReactTestRenderer.ReactTestRenderer, label: string, v: string) => act(async () => field(tree, label).props.onChangeText(v));
/** The last pressable with this text or label: the screen on top. */
async function pick(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const targets = tree.root
    .findAll(n => n.props.children === label || n.props.accessibilityLabel === label)
    .map(n => {
      let p: ReactTestRenderer.ReactTestInstance | null = n;
      while (p && !p.props.onPress) p = p.parent;
      return p;
    })
    .filter(Boolean);
  await act(async () => targets[targets.length - 1]!.props.onPress());
}

test('zones: figures, covered states, method counts, filter and deactivate', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('shipping'));
  let text = textOf(tree);
  expect(text).toContain('South India');
  expect(text).toContain('south-india · 1 method');
  expect(text).toContain('Karnataka, Kerala');
  expect(text).toContain('All / Unspecified');
  await press(tree, 'Inactive: 1');
  text = textOf(tree);
  expect(text).toContain('Everywhere else');
  expect(text).not.toContain('South India');
  await press(tree, 'Inactive: 1');

  await press(tree, 'More for South India');
  await pick(tree, 'Deactivate');
  expect(zones.update).toHaveBeenCalledWith('z1', { status: 0 });
  await act(async () => tree.unmount());
});

test('create a zone: slug from the title, states picked, then its page', async () => {
  const tree = await openApp();
  await act(async () => navigationRef.navigate('ShippingZoneForm'));
  await pick(tree, 'Create Zone');
  expect(textOf(tree)).toContain('Please fill in: Zone Title, Slug');
  await typeIn(tree, 'Zone Title', 'West India');
  expect(field(tree, 'Zone Slug').props.value).toBe('west-india');
  await press(tree, 'Maharashtra');
  await press(tree, 'Gujarat');
  expect(textOf(tree)).toContain('2 selected');
  await pick(tree, 'Create Zone');
  expect(zones.create).toHaveBeenCalledWith({ zoneTitle: 'West India', zoneSlug: 'west-india', coveredStates: ['Maharashtra', 'Gujarat'], description: undefined });
  expect(navigationRef.getCurrentRoute()?.name).toBe('ShippingZone');
  await act(async () => tree.unmount());
});

test('a zone page: its methods, then add one with the checks and edit another', async () => {
  const tree = await openApp();
  await act(async () => navigationRef.navigate('ShippingZone', { id: 'z1' }));
  let text = textOf(tree);
  expect(text).toContain('Standard Delivery');
  expect(text).toContain('₹49');
  expect(text).toContain('₹999');
  expect(text).toContain('3–5 days');

  await press(tree, 'Add method');
  await typeIn(tree, 'Method Title', 'Express Delivery');
  expect(field(tree, 'Method Slug').props.value).toBe('express-delivery');
  await press(tree, '% of order');
  await typeIn(tree, 'Rate', '120');
  await pick(tree, 'Add Method');
  expect(textOf(tree)).toContain('A percentage rate can be at most 100');
  await typeIn(tree, 'Rate', '5');
  await typeIn(tree, 'Min Days', '4');
  await typeIn(tree, 'Max Days', '2');
  await pick(tree, 'Add Method');
  expect(textOf(tree)).toContain("Min days can't be more than max days");
  await typeIn(tree, 'Max Days', '6');
  await pick(tree, 'Add Method');
  expect(methods.create).toHaveBeenCalledWith({
    zoneId: 'z1',
    methodTitle: 'Express Delivery',
    methodSlug: 'express-delivery',
    rateType: 'PERCENTAGE_OF_ORDER',
    rate: '5',
    freeAboveOrderValue: undefined,
    estimatedDaysMin: 4,
    estimatedDaysMax: 6,
  });

  await press(tree, 'Edit Standard Delivery');
  text = textOf(tree);
  expect(field(tree, 'Method Slug').props.value).toBe('standard-delivery');
  await typeIn(tree, 'Rate', '59');
  await pick(tree, 'Save Changes');
  expect(methods.update).toHaveBeenCalledWith('m1', expect.objectContaining({ rate: '59', estimatedDaysMin: 3, estimatedDaysMax: 5, status: 1 }));
  await act(async () => tree.unmount());
});

test('no access without shipping:manage', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  const tree = await openApp();
  await act(async () => openMenuKey('shipping'));
  expect(textOf(tree)).toContain('No access');
  expect(zones.list).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('shipping helpers', () => {
  expect(slugify('  Same Day — Bengaluru!  ')).toBe('same-day-bengaluru');
  expect(rateLabel({ id: 'x', rate: '12', rateType: 'PER_KG' })).toBe('₹12/kg');
  expect(rateLabel({ id: 'x', rate: '5.00', rateType: 'PERCENTAGE_OF_ORDER' })).toBe('5%');
  expect(etaLabel({ id: 'x', estimatedDaysMin: 2, estimatedDaysMax: 2 })).toBe('2 days');
  expect(etaLabel({ id: 'x' })).toBeNull();
  expect(methodProblem({ ...EMPTY_METHOD, methodTitle: 'A', methodSlug: 'a', rate: '4.999' })).toBe('The rate is an amount, e.g. 49 or 49.50');
  expect(methodPayload({ ...EMPTY_METHOD, methodTitle: ' A ', methodSlug: 'a', rate: '10' }, 'z').methodTitle).toBe('A');
});
