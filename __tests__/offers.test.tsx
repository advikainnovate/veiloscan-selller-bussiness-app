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
import { offerService } from '../src/services/offers-service';
import { discountLabel, emptyOffer, filterOffers, OFFERS, offerPayload, offerProblem } from '../src/lib/offers';
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

jest.mock('../src/services/offers-service', () => {
  const c = () => ({ list: jest.fn(async () => []), get: jest.fn(), create: jest.fn(async () => ({ id: 'new1' })), update: jest.fn(async () => ({})), remove: jest.fn(async () => ({})) });
  const services = { freebies: c(), 'gift-cards': c(), promotions: c() };
  return { offerService: (kind: keyof typeof services) => services[kind] };
});

const { act } = ReactTestRenderer;
const freebies = offerService('freebies') as jest.Mocked<ReturnType<typeof offerService>>;
const cards = offerService('gift-cards') as jest.Mocked<ReturnType<typeof offerService>>;
const promos = offerService('promotions') as jest.Mocked<ReturnType<typeof offerService>>;
const me = authService.me as jest.Mock;

const FREEBIES = [
  { id: 'f1', title: 'Free tote over ₹999', categoriesSelection: 'ALL', brandsSelection: 'SELECTED', productsSelection: 'ALL', minOrderValue: '999.00', startDate: '2026-10-01T00:00:00Z', endDate: '2099-12-31T00:00:00Z', status: 1, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z' },
  { id: 'f2', title: 'Diwali sample', categoriesSelection: 'ALL', brandsSelection: 'ALL', productsSelection: 'ALL', endDate: '2025-11-01T00:00:00Z', status: 1 },
  { id: 'f3', title: 'Old offer', status: 0 },
];
const CARDS = [
  { id: 'g1', cardTitle: 'Amazon Pay ₹500', platform: 'Amazon', category: 'Shopping', gcValue: '500.00', personalPrice: '490.00', corporatePrice: '480.00', validityDays: 365, status: 1 },
  { id: 'g2', cardTitle: 'Zomato ₹1000', platform: 'Zomato', category: 'Food', gcValue: '1000.00', status: 1 },
];
const PROMOS = [
  { id: 'p1', title: 'Weekend 10%', promotionType: 'PERCENTAGE', discountType: 'PERCENTAGE', discountValue: '10.00', maximumDiscount: '200.00', status: 1 },
  { id: 'p2', title: 'Flat 100', promotionType: 'FLAT', discountType: 'FLAT', discountValue: '100.00', minOrderValue: '1000.00', status: 1 },
];

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['freebie-master:manage', 'gift-cards:manage', 'my-promotions:manage'] });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  freebies.list.mockResolvedValue(FREEBIES as never);
  freebies.get.mockImplementation(async id => FREEBIES.find(r => r.id === id) as never);
  cards.list.mockResolvedValue(CARDS as never);
  cards.get.mockImplementation(async id => CARDS.find(r => r.id === id) as never);
  promos.list.mockResolvedValue(PROMOS as never);
  promos.get.mockImplementation(async id => PROMOS.find(r => r.id === id) as never);
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

test('freebies: figures, eligibility line, expired filter and deactivate', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('freebies'));
  let text = textOf(tree);
  expect(text).toContain('Free tote over ₹999');
  expect(text).toContain('Cat: All · Brand: Selected · Prod: All');
  expect(text).toContain('Min ₹999');
  await press(tree, 'Expired: 1');
  text = textOf(tree);
  expect(text).toContain('Diwali sample');
  expect(text).not.toContain('Free tote over ₹999');
  await press(tree, 'Expired: 1');

  await press(tree, 'More for Free tote over ₹999');
  await pick(tree, 'Deactivate');
  expect(freebies.update).toHaveBeenCalledWith('f1', { status: 0 });
  await act(async () => tree.unmount());
});

test('create a freebie: required title, order range, then the payload', async () => {
  const tree = await openApp();
  await act(async () => navigationRef.navigate('OfferForm', { kind: 'freebies' }));
  await pick(tree, 'Create Freebie');
  expect(textOf(tree)).toContain('Please fill in: Title');
  await typeIn(tree, 'Title', 'Free mug');
  await typeIn(tree, 'Min Order Value (₹)', '500');
  await typeIn(tree, 'Max Order Value (₹)', '200');
  await pick(tree, 'Create Freebie');
  expect(textOf(tree)).toContain("Max order value can't be less than the min order value");
  await typeIn(tree, 'Max Order Value (₹)', '2000');
  await pick(tree, 'Create Freebie');
  expect(freebies.create).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Free mug', categoriesSelection: 'ALL', brandsSelection: 'ALL', productsSelection: 'ALL', minOrderValue: '500', maxOrderValue: '2000', startDate: undefined }),
  );
  await act(async () => tree.unmount());
});

test('gift cards: face value total, category chips, a card page and edit', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('gift-cards'));
  let text = textOf(tree);
  expect(text).toContain('₹1,500');
  expect(text).toContain('Amazon · Shopping');
  expect(text).toContain('Value ₹500');
  await press(tree, 'Food');
  text = textOf(tree);
  expect(text).toContain('Zomato ₹1000');
  expect(text).not.toContain('Amazon Pay ₹500');
  await press(tree, 'All Categories');

  await press(tree, 'Open Amazon Pay ₹500');
  text = textOf(tree);
  expect(text).toContain('PRICING & VALIDITY');
  expect(text).toContain('₹490');
  expect(text).toContain('365 days');
  await pick(tree, 'Edit');
  expect(field(tree, 'Face Value (₹)').props.value).toBe('500.00');
  await typeIn(tree, 'Validity (days)', '0');
  await pick(tree, 'Save Changes');
  expect(textOf(tree)).toContain('Validity must be a whole number of at least 1');
  await typeIn(tree, 'Validity (days)', '180');
  await pick(tree, 'Save Changes');
  expect(cards.update).toHaveBeenCalledWith('g1', expect.objectContaining({ cardTitle: 'Amazon Pay ₹500', gcValue: '500.00', validityDays: 180, minOrderQty: 1, status: 1 }));
  await act(async () => tree.unmount());
});

test('promotions: type filter, discount labels and the percentage cap', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('promotions'));
  let text = textOf(tree);
  expect(text).toContain('10% off');
  expect(text).toContain('₹100 off');
  await press(tree, 'Flat');
  text = textOf(tree);
  expect(text).toContain('Flat 100');
  expect(text).not.toContain('Weekend 10%');

  await act(async () => navigationRef.navigate('OfferForm', { kind: 'promotions' }));
  await typeIn(tree, 'Title', 'Big sale');
  await pick(tree, 'Percentage (%)');
  await typeIn(tree, 'Discount Value', '150');
  await pick(tree, 'Create Promotion');
  expect(textOf(tree)).toContain('A percentage discount can be at most 100');
  await typeIn(tree, 'Discount Value', '15');
  await pick(tree, 'Create Promotion');
  expect(promos.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Big sale', promotionType: 'FLAT', discountType: 'PERCENTAGE', discountValue: '15' }));
  await act(async () => tree.unmount());
});

test('no access without the permission', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  const tree = await openApp();
  await act(async () => openMenuKey('gift-cards'));
  expect(textOf(tree)).toContain('No access');
  expect(cards.list).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('offer helpers', () => {
  const p = OFFERS.promotions;
  expect(discountLabel({ id: 'x', discountType: 'PERCENTAGE', discountValue: '12.50' })).toBe('12.5% off');
  expect(offerProblem(p, { ...emptyOffer(p), title: 'A', discountValue: '4.999' })).toBe('Discount Value must be an amount, e.g. 499 or 499.50');
  expect(offerProblem(p, { ...emptyOffer(p), title: 'A', startDate: '2026-11-10', endDate: '2026-11-01' })).toBe("The end date can't be before the start date");
  expect(offerPayload(p, { ...emptyOffer(p), title: ' A ', startDate: '2026-11-10' }, false)).toEqual(expect.objectContaining({ title: 'A', startDate: new Date('2026-11-10T00:00:00').toISOString() }));
  expect(filterOffers(p, PROMOS, 'weekend', '', '').map(r => r.id)).toEqual(['p1']);
});
