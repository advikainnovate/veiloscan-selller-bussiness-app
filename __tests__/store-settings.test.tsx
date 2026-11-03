/**
 * @format
 */

import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { openMenuKey } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { storeService } from '../src/services/store-service';
import { storeManageService } from '../src/services/store-manage-service';
import { qrTagService } from '../src/services/qr-tag-service';
import { contactFromRecord, contactProblem, displayStatus, gstProblem, hoursProblem, missingDocuments, DEFAULT_DOCUMENT_REQUIREMENTS, storeImageProblem } from '../src/lib/store-manage';
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
    get: jest.fn(),
    update: jest.fn(async () => ({})),
    remove: jest.fn(async () => ({})),
    updateSettings: jest.fn(async () => ({})),
    updateConfig: jest.fn(async () => ({})),
    updateBranding: jest.fn(async () => ({})),
    updateBusinessHours: jest.fn(async () => ({})),
    updateTaxDetails: jest.fn(async () => ({})),
    addDocument: jest.fn(async () => ({})),
    removeDocument: jest.fn(async () => ({})),
    reuploadDocument: jest.fn(async () => ({})),
    approvalHistory: jest.fn(async () => []),
    documentRequirements: jest.fn(async () => []),
  },
}));

jest.mock('../src/services/qr-tag-service', () => ({
  qrTagService: { get: jest.fn(), generate: jest.fn(), preview: jest.fn(async () => ({ image: 'data:image/png;base64,AA' })) },
}));

const { act } = ReactTestRenderer;
const manage = storeManageService as jest.Mocked<typeof storeManageService>;
const qr = qrTagService as jest.Mocked<typeof qrTagService>;
const me = authService.me as jest.Mock;

const STORE = {
  id: 's1',
  name: 'Green Basket',
  code: 'GB01',
  slug: 'green-basket',
  status: 'ACTIVE',
  approvalStatus: 'APPROVED',
  onboardingStatus: 'COMPLETED',
  businessType: 'RETAIL',
  businessCategory: 'Groceries',
  description: '<p>Fresh <b>vegetables</b> daily</p>',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  rejectionReason: null,
  submittedAt: '2026-10-01T10:00:00Z',
  reviewedAt: '2026-10-02T10:00:00Z',
  onboardingCompletedAt: '2026-10-01T10:00:00Z',
  createdAt: '2026-09-30T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
  owner: { id: 'u1', firstName: 'Rajendra', lastName: 'Patil', email: 'raj@example.com', countryCode: '+91', phoneNumber: '9876543210' },
  settings: { email: 'shop@example.com', phone: '+919876543210', addressLine1: '12 MG Road', city: 'Pune', state: 'Maharashtra', country: 'India', postalCode: '411001', updatedAt: 'a' },
  config: { commerceMode: 'STANDARD', currencySymbol: '₹', acceptOrders: true, allowCustomerCredit: false, maxCreditDays: 30, updatedAt: 'a' },
  taxDetails: { gstRegistered: true, gstin: '27AAACG1234A1Z5', legalBusinessName: 'Green Basket Pvt Ltd', verificationStatus: 'VERIFIED', updatedAt: 'a' },
  branding: { tagline: 'Farm fresh', updatedAt: 'a' },
  documents: [{ id: 'd1', documentType: 'PAN', documentNumber: 'AAACG1234A', verificationStatus: 'REJECTED', rejectionReason: 'Blurry photo', fileUrl: 'https://x/pan.jpg' }],
  businessHours: [{ dayOfWeek: 'MONDAY', isOpen: true, openTime: '09:00:00', closeTime: '21:00:00', updatedAt: 'a' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['stores:view', 'stores:edit', 'stores:delete'] });
  (storeService.list as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Green Basket', code: 'GB01', status: 'ACTIVE' }]);
  manage.get.mockResolvedValue(STORE as never);
  manage.approvalHistory.mockResolvedValue([
    { id: 'h1', action: 'APPROVED', createdAt: '2026-10-02T10:00:00Z', actor: { firstName: 'Admin' } },
    { id: 'h2', action: 'DOCUMENT_REJECTED', documentType: 'PAN', createdAt: '2026-10-03T10:00:00Z', details: { reason: 'Blurry photo' } },
  ]);
});

async function openModule(key: string) {
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
  await act(async () => openMenuKey(key));
  return tree;
}

const field = (tree: ReactTestRenderer.ReactTestRenderer, label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0];

test('overview shows the store, then setup and settings save with the panel checks', async () => {
  const tree = await openModule('store-settings');
  expect(manage.get).toHaveBeenCalledWith('s1');
  let text = textOf(tree);
  expect(text).toContain('Green Basket');
  expect(text).toContain('#GB01');
  expect(text).toContain('Approved');
  expect(text).toContain('Fresh vegetables daily');
  expect(text).toContain('27AAACG1234A1Z5');
  expect(text).toContain('9:00 AM - 9:00 PM');
  expect(text).toContain('Rajendra Patil');

  await press(tree, 'Store Setup');
  await act(async () => field(tree, 'Store Email').props.onChangeText(''));
  await press(tree, 'Save Address & Contact');
  expect(textOf(tree)).toContain('Please fill in: Store Email');
  await act(async () => field(tree, 'Store Email').props.onChangeText('not-an-email'));
  await press(tree, 'Save Address & Contact');
  expect(textOf(tree)).toContain('Enter a valid store email');
  expect(manage.updateSettings).not.toHaveBeenCalled();
  await act(async () => field(tree, 'Store Email').props.onChangeText('hello@greenbasket.in'));
  await press(tree, 'Save Address & Contact');
  expect(manage.updateSettings).toHaveBeenCalledWith('s1', expect.objectContaining({ email: 'hello@greenbasket.in', city: 'Pune' }));

  await press(tree, 'Operational Settings');
  const credit = tree.root.findAll(n => n.props.accessibilityLabel === 'Allow Customer Credit' && n.props.onValueChange)[0];
  await act(async () => credit.props.onValueChange(true));
  await act(async () => field(tree, 'Maximum credit period in days').props.onChangeText('400'));
  await press(tree, 'Save Settings');
  expect(textOf(tree)).toContain('Maximum credit period must be between 1 and 365 days.');
  await act(async () => field(tree, 'Maximum credit period in days').props.onChangeText('45'));
  await press(tree, 'Save Settings');
  expect(manage.updateConfig).toHaveBeenCalledWith('s1', expect.objectContaining({ allowCustomerCredit: true, maxCreditDays: 45 }));

  await press(tree, 'GST & Documents');
  text = textOf(tree);
  expect(text).toContain('Rejected: Blurry photo');
  expect(text).toContain('Re-upload');
  await act(async () => field(tree, 'GSTIN').props.onChangeText('BAD'));
  await press(tree, 'Save GST Details');
  expect(manage.updateTaxDetails).not.toHaveBeenCalled();

  await press(tree, 'Activity Log');
  text = textOf(tree);
  expect(text).toContain('Store approved');
  expect(text).toContain('PAN rejected');
  await act(async () => tree.unmount());
});

test('more actions: mark inactive after confirming, and the business details sheet', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  const tree = await openModule('store-settings');
  await press(tree, 'More Actions');
  const text = textOf(tree);
  expect(text).toContain('Mark Inactive');
  expect(text).toContain('Close Store');
  // Already active.
  expect(text).not.toContain('Activate Store');
  await press(tree, 'Mark Inactive');
  expect(manage.update).toHaveBeenCalledWith('s1', { status: 'INACTIVE' });

  await press(tree, 'Edit store');
  await act(async () => field(tree, 'Store Name').props.onChangeText(''));
  await press(tree, 'Save Changes');
  expect(textOf(tree)).toContain('Please fill in: Store Name');
  await act(async () => field(tree, 'Store Name').props.onChangeText('Green Basket Fresh'));
  await press(tree, 'Save Changes');
  expect(manage.update).toHaveBeenLastCalledWith('s1', expect.objectContaining({ name: 'Green Basket Fresh', businessType: 'RETAIL' }));
  alert.mockRestore();
  await act(async () => tree.unmount());
});

test('Store QR Tag opens the store page on its QR tab', async () => {
  qr.get.mockResolvedValue({
    enabled: true,
    tag: null,
    designs: [{ key: 'classic', name: 'Classic', description: null, locked: false }],
    themes: [{ id: 't1', name: 'Orange', accentColor: '#FF6A00', darkColor: '#1A1A1A', locked: false }],
    plan: { name: 'Free', designLimit: 1, themeLimit: 1 },
    frame: 'classic',
    themeId: 't1',
    isOutdated: false,
  });
  qr.generate.mockResolvedValue({ enabled: true, tag: null, designs: [], themes: [], plan: { name: null, designLimit: null, themeLimit: null }, frame: 'classic', themeId: 't1', isOutdated: false } as never);
  const tree = await openModule('store-qr-tag');
  expect(qr.get).toHaveBeenCalledWith('s1');
  expect(textOf(tree)).toContain('QR Store Tag');
  await press(tree, 'Generate Store Tag');
  expect(qr.generate).toHaveBeenCalledWith('s1', { frame: 'classic', themeId: 't1', regenerate: false });
  await act(async () => tree.unmount());
});

test('view only without stores:edit, no access without stores:view', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['stores:view'] });
  let tree = await openModule('store-settings');
  let text = textOf(tree);
  expect(text).toContain('Green Basket');
  expect(text).not.toContain('More Actions');
  await press(tree, 'Store Setup');
  text = textOf(tree);
  expect(text).toContain('Your role can view this store but not change it.');
  expect(text).not.toContain('Save Address & Contact');
  await act(async () => tree.unmount());

  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  tree = await openModule('store-settings');
  expect(textOf(tree)).toContain('No access');
  expect(manage.get).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test('store checks match the panel', () => {
  const contact = { ...contactFromRecord(STORE.settings), phone: '12' };
  expect(contactProblem(contact)).toBe('Store phone must be 7 to 15 digits, optionally starting with +');
  expect(contactProblem({ ...contact, phone: '+919876543210', openingTime: '21:00', closingTime: '09:00' })).toBe('Closing time must be after opening time');
  expect(gstProblem({ gstRegistered: true, gstin: '27AAACG1234A1Z5', legalBusinessName: '', tradeName: '', businessConstitution: '', gstRegistrationDate: '', gstStatus: '' })).toBeTruthy();
  expect(hoursProblem([{ dayOfWeek: 'MONDAY', isOpen: true, openTime: '18:00', closeTime: '09:00' }])).toBeTruthy();
  expect(missingDocuments(false, [], DEFAULT_DOCUMENT_REQUIREMENTS).length).toBeGreaterThan(0);
  expect(storeImageProblem('logo', { type: 'image/jpeg', fileSize: 3 * 1024 * 1024, width: 400, height: 400 })).toBeTruthy();
  expect(storeImageProblem('logo', { type: 'image/jpeg', fileSize: 100 * 1024, width: 400, height: 400 })).toBeNull();
  expect(displayStatus({ ...STORE, approvalStatus: 'PENDING', documents: [], taxDetails: null } as never)).toBe('PENDING');
  // A verified (or rejected) document or GST means review has begun.
  expect(displayStatus({ ...STORE, approvalStatus: 'PENDING' } as never)).toBe('IN_REVIEW');
  expect(displayStatus({ ...STORE, status: 'INACTIVE' } as never)).toBe('INACTIVE');
});
