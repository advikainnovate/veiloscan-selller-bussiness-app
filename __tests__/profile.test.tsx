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
import { profileService } from '../src/services/profile-service';
import { subscriptionService } from '../src/services/subscription-service';
import { pastSplash, press, textOf } from '../jest/test-helpers';

jest.mock('../src/services/auth-service', () => ({
  authService: { me: jest.fn(), logout: jest.fn(async () => ({})), forgotPassword: jest.fn(async () => ({})), resetPassword: jest.fn(async () => ({})) },
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

jest.mock('../src/services/profile-service', () => ({
  profileService: { get: jest.fn(), updateUser: jest.fn(async () => ({})), upsert: jest.fn(async () => ({})), salesTeam: jest.fn(), requestSalesTeam: jest.fn(async () => ({})) },
}));

const { act } = ReactTestRenderer;
const me = authService.me as jest.Mock;
const profile = profileService as jest.Mocked<typeof profileService>;

const USER = {
  id: 'u1',
  firstName: 'Rajendra',
  lastName: 'Sah',
  email: 'rajendra.sah@yopmail.com',
  countryCode: '91',
  phoneNumber: '9876011990',
  userType: 'SELLER',
  status: 'ACTIVE',
  isEmailVerification: true,
  isPhoneVerification: false,
  createdAt: '2026-09-01T10:00:00Z',
  roles: [{ id: 'r1', roleTitle: 'Store Owner' }],
  permissions: ['orders:manage'],
};

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue(USER);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  profile.get.mockResolvedValue({ shortDescription: null, idProofDocId: 'f9', status: 'ACTIVE' });
  profile.salesTeam.mockResolvedValue({ standing: 'NONE', canRequest: true, salesTeam: null, salesPortalUrl: null, history: [] });
  (subscriptionService.mine as jest.Mock).mockResolvedValue({
    consolidatedDashboard: true,
    plan: { planName: 'Growth', status: 'TRIALING', isDefault: false, billingCycle: 'MONTHLY', amount: 999, currency: 'INR', trialEndsAt: '2026-11-20T00:00:00Z', currentPeriodEnd: '2026-11-20T00:00:00Z', autoRenew: true },
  });
});
afterEach(() => alertSpy.mockRestore());

async function openProfile() {
  await AsyncStorage.setItem('app.onboarded', '1');
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ username: 'session', password: JSON.stringify({ accessToken: 'a', refreshToken: 'r' }) });
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await pastSplash();
  await act(async () => openMenuKey('profile'));
  return tree;
}
const field = (tree: ReactTestRenderer.ReactTestRenderer, label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0];

test('profile shows who you are, completeness, security, plan and sales team', async () => {
  const tree = await openProfile();
  const text = textOf(tree);
  expect(text).toContain('Rajendra Sah');
  expect(text).toContain('Store Owner');
  expect(text).toContain('+91 9876011990');
  // Email verified only: 1 of 6.
  expect(text).toContain('17%');
  expect(text).toContain('Not verified');
  expect(text).toContain('Uploaded');
  expect(text).toContain('Growth');
  expect(text).toContain('Trialing');
  expect(text).toContain('₹999 / month');
  expect(text).toContain('Free Trial Ends');
  expect(text).toContain('Not a member');
  await act(async () => tree.unmount());
});

test('edit profile saves the name, gender and bio, then reloads the user', async () => {
  const tree = await openProfile();
  await press(tree, 'Edit Profile');
  await act(async () => field(tree, 'First Name').props.onChangeText(''));
  await press(tree, 'Save changes');
  expect(textOf(tree)).toContain('Enter your first name');
  await act(async () => field(tree, 'First Name').props.onChangeText('Raju'));
  await act(async () => field(tree, 'Display Name').props.onChangeText('raju_store'));
  await press(tree, 'Male');
  await act(async () => field(tree, 'About Me').props.onChangeText('Grocery seller in Pune'));
  me.mockResolvedValue({ ...USER, firstName: 'Raju' });
  await press(tree, 'Save changes');
  expect(profile.updateUser).toHaveBeenCalledWith('u1', { firstName: 'Raju', lastName: 'Sah', displayName: 'raju_store', gender: 'MALE' });
  expect(profile.upsert).toHaveBeenCalledWith('u1', { shortDescription: 'Grocery seller in Pune' });
  expect(textOf(tree)).toContain('Raju Sah');
  await act(async () => tree.unmount());
});

test('change password emails a code, then checks the new password', async () => {
  const tree = await openProfile();
  await press(tree, 'Change Password');
  await press(tree, 'Send Code');
  expect(authService.forgotPassword).toHaveBeenCalledWith('rajendra.sah@yopmail.com');
  const otp = tree.root.findAll(n => n.props.maxLength === 6 && n.props.onChangeText)[0];
  await act(async () => otp.props.onChangeText('112211'));
  const byPlaceholder = (p: string) => tree.root.findAll(n => n.props.placeholder === p && n.props.onChangeText)[0];
  // The sheet's own button, not the Account row with the same title.
  const submit = () => {
    const buttons = tree.root.findAll(n => n.props.accessibilityRole === 'button' && n.props.onPress && n.findAll(c => c.props.children === 'Change Password').length);
    return act(async () => buttons[buttons.length - 1].props.onPress());
  };
  await act(async () => byPlaceholder('Enter a new password').props.onChangeText('weak'));
  await submit();
  expect(textOf(tree)).toContain('The new password doesn’t meet the rules below');
  await act(async () => byPlaceholder('Enter a new password').props.onChangeText('Strong#Pass1'));
  await act(async () => byPlaceholder('Enter it again').props.onChangeText('Strong#Pass2'));
  await submit();
  expect(textOf(tree)).toContain('The passwords don’t match');
  await act(async () => byPlaceholder('Enter it again').props.onChangeText('Strong#Pass1'));
  await submit();
  expect(authService.resetPassword).toHaveBeenCalledWith('rajendra.sah@yopmail.com', '112211', 'Strong#Pass1');
  await act(async () => tree.unmount());
});

test('a seller can ask to join the sales team, and sign out from the profile', async () => {
  const tree = await openProfile();
  await press(tree, 'Join');
  await act(async () => field(tree, 'Note').props.onChangeText('I know sellers in my area'));
  await press(tree, 'Send request');
  expect(profile.requestSalesTeam).toHaveBeenCalledWith('I know sellers in my area');
  await press(tree, 'Sign Out');
  expect(authService.logout).toHaveBeenCalled();
  await act(async () => tree.unmount());
});
