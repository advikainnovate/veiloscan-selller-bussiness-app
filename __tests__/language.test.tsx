/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import i18n from '../src/i18n';
import en from '../src/locales/en/translation.json';
import hi from '../src/locales/hi/translation.json';
import { openMenuKey } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { formatRupees, formatNumber } from '../src/lib/format';
import { formatLongDate, formatWhen } from '../src/lib/date';
import { pastSplash, press, textOf } from '../jest/test-helpers';

jest.mock('../src/services/auth-service', () => ({
  authService: { me: jest.fn(), updateMe: jest.fn(), logout: jest.fn(async () => ({})) },
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

const { act } = ReactTestRenderer;
const me = authService.me as jest.Mock;
const updateMe = authService.updateMe as jest.Mock;

const USER = { id: 'u1', firstName: 'Rajendra', lastName: 'Sah', userType: 'SELLER', roles: [{ roleTitle: 'Store Owner' }], permissions: ['orders:manage'] };

let tree: ReactTestRenderer.ReactTestRenderer | null = null;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await i18n.changeLanguage('en');
  me.mockResolvedValue(USER);
  updateMe.mockImplementation(async (payload: { preferredLanguage?: string }) => ({ ...USER, ...payload }));
});

afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = null;
});

async function launch({ signedIn }: { signedIn: boolean }) {
  await AsyncStorage.setItem('app.onboarded', '1');
  if (signedIn) {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ username: 'session', password: JSON.stringify({ accessToken: 'a', refreshToken: 'r' }) });
  }
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await pastSplash();
  return tree!;
}

type Tree = Record<string, unknown>;
const flatten = (o: Tree, p = ''): [string, string][] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[p + k, v] as [string, string]] : flatten(v as Tree, `${p}${k}.`)));
const tokens = (s: string) => [...s.matchAll(/\{\{\s*\w+\s*\}\}|<\/?\w+>/g)].map(m => m[0]).sort().join(',');

test('Hindi has every English key, with the same placeholders and tags', () => {
  const english = new Map(flatten(en as Tree));
  const hindi = new Map(flatten(hi as Tree));
  expect([...english.keys()].filter(k => !hindi.has(k))).toEqual([]);
  expect([...hindi.keys()].filter(k => !english.has(k))).toEqual([]);
  expect([...english].filter(([k, v]) => tokens(v) !== tokens(hindi.get(k) ?? '')).map(([k]) => k)).toEqual([]);
  expect([...hindi].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
});

test('Hindi formats dates and plurals; money and numbers keep Indian grouping', async () => {
  await i18n.changeLanguage('hi');
  expect(formatWhen(new Date())).toMatch(/^आज, /);
  expect(formatLongDate(new Date(2026, 10, 13))).toBe('शुक्रवार, 13 नवंबर');
  expect(formatRupees(12500)).toBe('₹12,500');
  expect(formatNumber(1234567.5)).toBe('12,34,567.50');
  expect(i18n.t('home.todaysSales')).toBe('आज की बिक्री');
  expect(i18n.t('common.productCount', { count: 5 })).toBe('5 उत्पाद');
  // A key missing in Hindi falls back to English.
  i18n.addResource('en', 'translation', 'test.onlyEnglish', 'Only in English');
  expect(i18n.t('test.onlyEnglish')).toBe('Only in English');
});

test('switching to Hindi changes the app at once, remembers it and saves it on the account', async () => {
  await launch({ signedIn: true });
  await act(async () => openMenuKey('language'));
  expect(textOf(tree!)).toContain('Choose Your Language / अपनी भाषा चुनें');

  await press(tree!, 'हिन्दी, Hindi');
  const text = textOf(tree!);
  expect(text).toContain(hi.nav.languageAndRegion);
  expect(text).toContain(hi.settings.savedToAccount);
  expect(await AsyncStorage.getItem('app.language')).toBe('hi');
  expect(updateMe).toHaveBeenCalledWith({ preferredLanguage: 'hi' });

  // And back, without leaving the page.
  await press(tree!, 'English');
  expect(textOf(tree!)).toContain(en.nav.languageAndRegion);
  expect(updateMe).toHaveBeenLastCalledWith({ preferredLanguage: 'en' });
});

test("the account's language applies at sign-in on a new device, and business data stays as entered", async () => {
  me.mockResolvedValue({ ...USER, preferredLanguage: 'hi' });
  await launch({ signedIn: true });
  const text = textOf(tree!);
  expect(text).toContain(hi.home.todaysSales);
  expect(text).toContain('Rajendra');
  expect(await AsyncStorage.getItem('app.language')).toBe('hi');
  expect(updateMe).not.toHaveBeenCalled();
});

test('a language saved on this phone opens Sign In in it', async () => {
  await AsyncStorage.setItem('app.language', 'hi');
  await launch({ signedIn: false });
  expect(textOf(tree!)).toContain(hi.auth.mobileOtp);
});

test("a change that can't reach the server is kept and sent at the next sign-in", async () => {
  updateMe.mockRejectedValueOnce(new Error('offline'));
  await launch({ signedIn: true });
  await act(async () => openMenuKey('language'));
  await press(tree!, 'हिन्दी, Hindi');
  expect(textOf(tree!)).toContain(hi.settings.savedOnDevicePending);
  expect(await AsyncStorage.getItem('app.language.pendingSync')).toBe('1');
  await act(async () => tree!.unmount());
  tree = null;

  // Next launch: the account still says English, but the unsent change wins.
  me.mockResolvedValue({ ...USER, preferredLanguage: 'en' });
  await launch({ signedIn: true });
  expect(updateMe).toHaveBeenLastCalledWith({ preferredLanguage: 'hi' });
  expect(textOf(tree!)).toContain(hi.home.todaysSales);
  expect(await AsyncStorage.getItem('app.language.pendingSync')).toBeNull();
});
