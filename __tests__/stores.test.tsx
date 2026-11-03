/**
 * @format
 */

import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { navigationRef } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { storeService } from '../src/services/store-service';
import { storeManageService } from '../src/services/store-manage-service';
import { countWords, descriptionHtml, descriptionText, filterStores, missingBranding, newStoreProblem, NEW_STORE_INITIAL, DEFAULT_BRANDING_REQUIREMENTS, STORE_FILTERS_INITIAL } from '../src/lib/store-manage';
import { pastSplash, press, textOf } from '../jest/test-helpers';

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

jest.mock('../src/services/store-manage-service', () => ({
  storeManageService: {
    list: jest.fn(),
    storeUsage: jest.fn(async () => null),
    get: jest.fn(),
    update: jest.fn(async () => ({})),
    remove: jest.fn(async () => ({})),
    updateConfig: jest.fn(async () => ({})),
    updateBranding: jest.fn(async () => ({})),
    updateBusinessHours: jest.fn(async () => ({})),
    approvalHistory: jest.fn(async () => []),
    documentRequirements: jest.fn(async () => []),
    brandingRequirements: jest.fn(async () => []),
    startOnboarding: jest.fn(),
    getOnboarding: jest.fn(),
    saveBusinessDetails: jest.fn(),
    saveStoreDetails: jest.fn(),
    saveAddressContact: jest.fn(),
    saveGstDetails: jest.fn(async () => ({})),
    addOnboardingDocument: jest.fn(),
    removeOnboardingDocument: jest.fn(),
    reuploadDocument: jest.fn(),
    setOnboardingStep: jest.fn(),
    completeOnboarding: jest.fn(async () => ({})),
  },
}));

const { act } = ReactTestRenderer;
const manage = storeManageService as jest.Mocked<typeof storeManageService>;
const me = authService.me as jest.Mock;

const base = {
  code: 'GB01',
  slug: 'green-basket',
  onboardingStatus: 'COMPLETED',
  businessType: 'RETAIL',
  businessCategory: 'Grocery & Fresh Food',
  description: null,
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  rejectionReason: null,
  submittedAt: '2026-10-01T10:00:00Z',
  reviewedAt: null,
  onboardingCompletedAt: null,
  createdAt: '2026-09-30T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
  owner: { firstName: 'Rajendra', lastName: 'Patil', email: 'raj@example.com' },
  documents: [],
  businessHours: [],
};
const STORES = [
  { ...base, id: 's1', name: 'Green Basket', status: 'ACTIVE', approvalStatus: 'APPROVED', settings: { city: 'Pune', state: 'Maharashtra' }, taxDetails: { gstRegistered: true, gstin: '27AAACG1234A1Z5' } },
  { ...base, id: 's2', name: 'Blue Bakery', code: 'BB02', status: 'INACTIVE', approvalStatus: 'PENDING', businessCategory: 'Bakery & Sweets', settings: { city: 'Mumbai', state: 'Maharashtra' } },
  { ...base, id: 's3', name: 'Red Pharmacy', code: 'RP03', status: 'INACTIVE', approvalStatus: 'REJECTED', onboardingStatus: 'IN_PROGRESS', rejectionReason: 'Licence missing', businessCategory: 'Pharmacy', settings: null },
];

const WORDS = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', lastName: 'Patil', email: 'raj@example.com', userType: 'SELLER', permissions: ['stores:view', 'stores:create', 'stores:edit', 'stores:delete'] });
  (storeService.list as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Green Basket', code: 'GB01', status: 'ACTIVE' }]);
  manage.list.mockResolvedValue(STORES as never);
});

async function openApp() {
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

const field = (tree: ReactTestRenderer.ReactTestRenderer, label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0];
const typeIn = (tree: ReactTestRenderer.ReactTestRenderer, label: string, text: string) => act(async () => field(tree, label).props.onChangeText(text));

test('the switcher links to Manage this store, All stores and Add New Store', async () => {
  const tree = await openApp();
  await press(tree, 'Open menu');
  await press(tree, 'Store: Green Basket. Manage store');
  const text = textOf(tree);
  expect(text).toContain('Manage this store');
  expect(text).toContain('All stores');
  expect(text).toContain('Add New Store');
  await press(tree, 'All stores');
  expect(manage.list).toHaveBeenCalled();
  expect(textOf(tree)).toContain('Blue Bakery');
  await act(async () => tree.unmount());
});

test('all stores: totals, plan usage, search and filters, row actions', async () => {
  manage.storeUsage.mockResolvedValue({ featureCode: 'STORE_LIMIT', featureName: 'Stores', isEnabled: true, allowed: 3, used: 3, remaining: 0 });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  const tree = await openApp();
  await act(async () => navigationRef.navigate('Stores'));
  let text = textOf(tree);
  expect(text).toContain('"Total Stores","3"');
  expect(text).toContain('"Pending Approval","1"');
  expect(text).toContain('"Rejected","1"');
  expect(text).toContain('3 of 3 used');
  expect(text).toContain('None left');
  expect(text).toContain('Licence missing');
  expect(text).toContain('Pune, Maharashtra');

  await act(async () => tree.root.findAll(n => n.props.placeholder?.startsWith?.('Search by store name') && n.props.onChangeText)[0].props.onChangeText('mumbai'));
  text = textOf(tree);
  expect(text).toContain('Blue Bakery');
  expect(text).not.toContain('Green Basket');
  await press(tree, 'Reset');

  await press(tree, 'More for Red Pharmacy');
  text = textOf(tree);
  expect(text).toContain('Switch to this store');
  expect(text).toContain('Continue Onboarding');
  await press(tree, 'Close Store');
  expect(manage.remove).toHaveBeenCalledWith('s3');

  // Opening a store shows its page, whichever store is current.
  manage.get.mockResolvedValue({ ...STORES[1], config: null, branding: null } as never);
  await press(tree, 'Open Blue Bakery');
  expect(manage.get).toHaveBeenCalledWith('s2');
  expect(textOf(tree)).toContain('Pending Approval');
  alert.mockRestore();
  await act(async () => tree.unmount());
});

test('add new store: the four steps with the panel checks, then submit', async () => {
  const draft = { ...base, id: 'n1', name: 'Fresh Basket', status: 'INACTIVE', approvalStatus: null, onboardingStatus: 'IN_PROGRESS', onboardingStep: 3, settings: null, taxDetails: null, documents: [] };
  const progress = (store: object, extra: object = {}) => ({ store, steps: [], missingSteps: [], missingDocuments: [], missingBranding: [], canComplete: false, ...extra });
  manage.startOnboarding.mockResolvedValue(progress(draft) as never);
  manage.saveStoreDetails.mockResolvedValue(progress(draft) as never);
  const withSettings = { ...draft, settings: { email: 'a@b.in', phone: '+919876543210', addressLine1: '1 MG Road', city: 'Pune', state: 'MH', country: 'India', postalCode: '411001' } };
  manage.saveAddressContact.mockResolvedValue(progress(withSettings) as never);
  const withDocs = { ...withSettings, onboardingStep: 6, taxDetails: { gstRegistered: false }, documents: [{ id: 'd1', documentType: 'PAN', verificationStatus: 'PENDING' }, { id: 'd2', documentType: 'ADDRESS_PROOF', verificationStatus: 'PENDING' }] };
  manage.setOnboardingStep.mockResolvedValue(progress(withDocs, { canComplete: true }) as never);
  manage.get.mockResolvedValue({ ...withDocs, approvalStatus: 'PENDING' } as never);

  const tree = await openApp();
  await act(async () => navigationRef.navigate('CreateStore'));
  expect(textOf(tree)).toContain('Business Details');

  await press(tree, 'Next: Store Setup');
  expect(textOf(tree)).toContain('Store description is required');
  await typeIn(tree, 'Description', 'Too short');
  await press(tree, 'Next: Store Setup');
  expect(textOf(tree)).toContain('Store description must be at least 100 words (currently 2)');
  await typeIn(tree, 'Description', WORDS);
  await press(tree, 'Next: Store Setup');
  expect(textOf(tree)).toContain('Please fill in: Store Name, Business Type, Business Category');
  await typeIn(tree, 'Store Name', 'Fresh Basket');
  await press(tree, 'Business Type: not chosen');
  await press(tree, 'Retail');
  await press(tree, 'Business Category: not chosen');
  await press(tree, 'Grocery & Fresh Food');
  await press(tree, 'Next: Store Setup');
  expect(manage.startOnboarding).toHaveBeenCalledWith({ name: 'Fresh Basket', businessType: 'RETAIL', businessCategory: 'Grocery & Fresh Food', description: `<p>${WORDS}</p>` });
  expect(manage.saveStoreDetails).toHaveBeenCalledWith('n1', expect.objectContaining({ name: 'Fresh Basket', timezone: 'Asia/Kolkata', currency: 'INR' }));
  expect(storeService.list).toHaveBeenCalledTimes(2);

  // Store Setup
  await press(tree, 'Next: GST & Documents');
  expect(textOf(tree)).toContain('Please fill in: Store Email, Store Phone, Address Line 1, City, State, Postal Code');
  await typeIn(tree, 'Store Email', 'a@b.in');
  await typeIn(tree, 'Store Phone', '+919876543210');
  await typeIn(tree, 'Address Line 1', '1 MG Road');
  await typeIn(tree, 'City', 'Pune');
  await typeIn(tree, 'State', 'MH');
  await typeIn(tree, 'Postal Code', '411001');
  await typeIn(tree, 'Latitude', '18.5');
  await press(tree, 'Next: GST & Documents');
  expect(textOf(tree)).toContain('Enter both latitude and longitude, or neither');
  await typeIn(tree, 'Latitude', '');
  await press(tree, 'Next: GST & Documents');
  expect(manage.updateBusinessHours).toHaveBeenCalledWith('n1', expect.arrayContaining([{ dayOfWeek: 'SUNDAY', isOpen: false }, { dayOfWeek: 'MONDAY', isOpen: true, openTime: '09:00', closeTime: '21:00' }]));
  expect(manage.updateConfig).toHaveBeenCalledWith('n1', { acceptOrders: true, onlinePaymentEnabled: true, guestCheckoutEnabled: true, currencySymbol: '₹' });
  expect(manage.saveAddressContact).toHaveBeenCalledWith('n1', expect.objectContaining({ email: 'a@b.in', city: 'Pune', country: 'India' }));

  // GST & Documents: without GST, PAN and Address Proof are required.
  await press(tree, 'Next: Review & Submit');
  expect(textOf(tree)).toContain('Upload the required documents: PAN Card, Address Proof');
  expect(manage.saveGstDetails).not.toHaveBeenCalled();
  // Uploads go through the image picker; here the documents arrive with the next saved progress.
  manage.saveAddressContact.mockResolvedValue(progress(withDocs) as never);
  await press(tree, 'Previous');
  await press(tree, 'Next: GST & Documents');
  await press(tree, 'Next: Review & Submit');
  expect(manage.saveGstDetails).toHaveBeenCalledWith('n1', { gstRegistered: false });
  expect(manage.setOnboardingStep).toHaveBeenCalledWith('n1', 6);

  // Review & Submit waits for the terms.
  expect(textOf(tree)).toContain('What happens next?');
  await press(tree, 'Terms & Conditions');
  await press(tree, 'Submit for Approval');
  expect(manage.completeOnboarding).toHaveBeenCalledWith('n1');
  expect(manage.get).toHaveBeenCalledWith('n1');
  await act(async () => tree.unmount());
});

test('without stores:create there is no Add New Store', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['stores:view'] });
  const tree = await openApp();
  await act(async () => navigationRef.navigate('Stores'));
  expect(textOf(tree)).not.toContain('Add New Store');
  await act(async () => navigationRef.navigate('CreateStore'));
  expect(textOf(tree)).toContain('No access');
  expect(manage.startOnboarding).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('store list and wizard helpers', () => {
  expect(filterStores(STORES as never, { ...STORE_FILTERS_INITIAL, search: 'licence' }).length).toBe(0);
  expect(filterStores(STORES as never, { ...STORE_FILTERS_INITIAL, search: '27AAACG' }).map(s => s.id)).toEqual(['s1']);
  expect(filterStores(STORES as never, { ...STORE_FILTERS_INITIAL, status: 'REJECTED' }).map(s => s.id)).toEqual(['s3']);
  expect(newStoreProblem({ ...NEW_STORE_INITIAL, name: 'A', businessType: 'RETAIL', businessCategory: 'Other', description: WORDS })).toBeNull();
  expect(countWords('<p>one <b>two</b></p><p>three</p>')).toBe(3);
  expect(descriptionText('<p>Hello <b>there</b></p><p>Second</p>')).toBe('Hello there\n\nSecond');
  expect(descriptionHtml('a < b\n\nnext')).toBe('<p>a &lt; b</p><p>next</p>');
  // Defaults: logo and banner only required with GST.
  expect(missingBranding(DEFAULT_BRANDING_REQUIREMENTS, null, { logo: null, banner: null })).toEqual([]);
  expect(missingBranding(DEFAULT_BRANDING_REQUIREMENTS, true, { logo: { id: 'x' }, banner: null })).toEqual(['Store Banner']);
});
