/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { openMenuKey } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { subscriptionService } from '../src/services/subscription-service';
import { elapsed, moveFor, pendingLabel, planState, usageLabel, usageLevel } from '../src/lib/subscription';
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

jest.mock('../src/services/subscription-service', () => ({
  subscriptionService: {
    mine: jest.fn(async () => ({ plan: null, consolidatedDashboard: true })),
    planDetails: jest.fn(),
    renewal: jest.fn(),
    payments: jest.fn(),
    catalogue: jest.fn(),
    start: jest.fn(),
    change: jest.fn(),
  },
}));

const { act } = ReactTestRenderer;
const svc = subscriptionService as jest.Mocked<typeof subscriptionService>;
const me = authService.me as jest.Mock;
const DAY = 86_400_000;
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const DETAILS = {
  source: 'SUBSCRIPTION' as const,
  plan: { planCode: 'GROWTH', planName: 'Growth', description: null, targetSeller: 'For growing shops', tier: 2, trialDays: 14, highlights: ['5 stores', 'Customer credit'], isDefault: false },
  subscription: {
    idd: 'SUB-9',
    status: 'TRIALING',
    billingCycle: 'MONTHLY' as const,
    amount: 999,
    currency: 'INR',
    taxRatePercent: 18,
    autoRenew: false,
    startedAt: iso(-4),
    trialStartAt: iso(-4),
    trialEndAt: iso(10),
    complimentaryStartAt: null,
    complimentaryEndAt: null,
    currentPeriodStart: iso(-4),
    currentPeriodEnd: iso(10),
    nextBillingAt: iso(10),
    graceEndAt: null,
    stage: 'TRIAL' as const,
  },
  modules: [
    {
      module: 'Sales',
      features: [
        { featureCode: 'CREDIT', featureName: 'Customer credit', description: null, isEnabled: true, limitValue: null, tier: 'STANDARD' as const, displayValue: 'Included' },
        { featureCode: 'GIFT', featureName: 'Gift cards', description: null, isEnabled: false, limitValue: null, tier: null, displayValue: 'Not included' },
      ],
    },
  ],
};
const USAGE = [
  { featureCode: 'STORE_LIMIT', featureName: 'Stores', scope: 'ACCOUNT' as const, isEnabled: true, limitValue: 5, allowed: 5, used: 5, remaining: 0, perStore: false, stores: [] },
  { featureCode: 'PRODUCT_LIMIT', featureName: 'Products', scope: 'STORE' as const, isEnabled: true, limitValue: 100, allowed: 200, used: 40, remaining: 160, perStore: true, stores: [{ storeId: 's1', storeName: 'Green Basket', used: 40, remaining: 60 }] },
];
const CATALOGUE = {
  plans: [
    { planCode: 'STARTER', planName: 'Starter', tier: 1, description: null, targetSeller: null, pricingModel: 'FIXED', trialDays: 0, isRecommended: false, isDefault: false, highlights: [], prices: [{ billingCycle: 'MONTHLY' as const, amount: 499, currency: 'INR', isTaxInclusive: false, trialDays: 0 }] },
    { planCode: 'GROWTH', planName: 'Growth', tier: 2, description: null, targetSeller: null, pricingModel: 'FIXED', trialDays: 14, isRecommended: false, isDefault: false, highlights: [], prices: [{ billingCycle: 'MONTHLY' as const, amount: 999, currency: 'INR', isTaxInclusive: false, trialDays: 14 }] },
    { planCode: 'PRO', planName: 'Pro', tier: 3, description: null, targetSeller: null, pricingModel: 'FIXED', trialDays: 14, isRecommended: true, isDefault: false, highlights: ['Unlimited stores'], prices: [{ billingCycle: 'MONTHLY' as const, amount: 1999, currency: 'INR', isTaxInclusive: false, trialDays: 14 }, { billingCycle: 'YEARLY' as const, amount: 19990, currency: 'INR', isTaxInclusive: false, trialDays: 14 }] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  svc.planDetails.mockResolvedValue({ isPlatformAdmin: false, details: DETAILS, usage: USAGE });
  svc.renewal.mockResolvedValue({
    stage: 'TRIAL',
    planCode: 'GROWTH',
    planName: 'Growth',
    billingCycle: 'MONTHLY',
    currency: 'INR',
    isTaxInclusive: false,
    taxRatePercent: 18,
    subtotal: 999,
    taxAmount: 179.82,
    totalAmount: 1178.82,
    periodStart: iso(10),
    periodEnd: iso(40),
    accessEndsAt: iso(10),
    graceEndAt: null,
    canRenew: false,
    opensAt: iso(3),
  });
  svc.payments.mockResolvedValue([
    { idd: 'P1', planName: 'Growth', billingCycle: 'MONTHLY', amount: '999', discountAmount: '0', currency: 'INR', method: 'CASH', status: 'AWAITING_VERIFICATION', invoiceNumber: 'INV-7', createdAt: iso(-1), paidAt: null },
  ]);
  svc.catalogue.mockResolvedValue(CATALOGUE);
  svc.change.mockResolvedValue({ planCode: 'PRO', planName: 'Pro', billingCycle: 'MONTHLY', status: 'TRIALING', trialEndsAt: null });
});

async function openSubscription() {
  await AsyncStorage.setItem('app.onboarded', '1');
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ username: 'session', password: JSON.stringify({ accessToken: 'a', refreshToken: 'r' }) });
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await pastSplash();
  await act(async () => openMenuKey('subscription'));
  return tree;
}

test('the plan, renewal, usage, billing, payments and features', async () => {
  const tree = await openSubscription();
  let text = textOf(tree);
  expect(text).toContain('Growth');
  expect(text).toContain('Free trial');
  expect(text).toContain('Free trial active. Your paid plan period starts after your trial ends.');
  expect(text).toContain('10 days remaining');
  expect(text).toContain('₹999 / month');
  expect(text).toContain('+ 18% tax');
  expect(text).toContain('First charge due');
  expect(text).toContain('1 of 2');
  // Renewal: the quote, and when it opens.
  expect(text).toContain('₹1,178.82');
  expect(text).toContain('GST (18%)');
  expect(text).toContain('Renewal opens on');
  // Usage: stores used up, products per store.
  expect(text).toContain('None left');
  expect(text).toContain('You have used your whole allowance. Upgrade your plan to add more.');
  expect(text).toContain('100 per store');
  expect(text).toContain('40 / 100 · 60 left');
  // Payments: the cash payment being checked.
  expect(text).toContain('is being verified');
  expect(text).toContain('Awaiting verification');
  expect(text).toContain('Invoice INV-7');
  // Features: the first module open, included first.
  expect(text).toContain('Customer credit');
  expect(text).toContain('Standard');
  await press(tree, 'Included');
  text = textOf(tree);
  expect(text).not.toContain('Gift cards');
  await act(async () => tree.unmount());
});

test('an owner changes plan: monthly / yearly, pick, confirm', async () => {
  const tree = await openSubscription();
  await press(tree, 'Upgrade Plan');
  let text = textOf(tree);
  expect(text).toContain('You are on Growth. Pick another plan to move to.');
  expect(text).toContain('Most popular');
  expect(text).toContain('Current plan');
  await press(tree, 'Yearly');
  text = textOf(tree);
  // Starter and Growth aren't sold yearly; Growth is then a billing switch.
  expect(text).toContain('Not sold yearly');
  expect(text).toContain('₹19,990');
  await press(tree, 'Monthly');
  await press(tree, 'Upgrade to Pro');
  text = textOf(tree);
  expect(text).toContain('Confirm your new plan');
  expect(text).toContain('Your free trial carries over and keeps its original end date — switching does not start a new one.');
  await press(tree, 'Confirm Pro');
  expect(svc.change).toHaveBeenCalledWith('PRO', 'MONTHLY');
  expect(textOf(tree)).toContain("You're now on Pro");
  await act(async () => tree.unmount());
});

test('staff see the plan but cannot change it', async () => {
  me.mockResolvedValue({ id: 'u2', firstName: 'Asha', userType: 'SELLER_USER', permissions: ['orders:manage'] });
  const tree = await openSubscription();
  expect(textOf(tree)).toContain('Growth');
  expect(textOf(tree)).not.toContain('Upgrade Plan');
  await act(async () => tree.unmount());
});

test('subscription helpers', () => {
  const now = Date.now();
  expect(elapsed(new Date(now - 5 * DAY).toISOString(), new Date(now + 5 * DAY).toISOString(), now)).toBeCloseTo(0.5);
  expect(planState({ ...DETAILS, subscription: null }, null).message).toContain("You're on the free plan");
  const due = planState({ ...DETAILS, subscription: { ...DETAILS.subscription, stage: 'RENEWAL_DUE', graceEndAt: iso(3) } }, null);
  expect(due.urgent).toBe(true);
  expect(due.phase?.label).toBe('Grace period');
  expect(usageLabel(USAGE[0])).toBe('5 of 5 used');
  expect(usageLevel(USAGE[0])).toBe('full');
  expect(pendingLabel({ ...USAGE[1], remaining: null })).toBe('No limit');
  const current = { planCode: 'GROWTH', planName: 'Growth', tier: 2, isDefault: false, billingCycle: 'MONTHLY' as const, status: 'ACTIVE' };
  expect(moveFor(CATALOGUE.plans[0], current, 'MONTHLY')).toBe('downgrade');
  expect(moveFor(CATALOGUE.plans[2], current, 'YEARLY')).toBe('upgrade');
  expect(moveFor(CATALOGUE.plans[1], current, 'YEARLY')).toBe('unavailable');
  expect(moveFor(CATALOGUE.plans[0], { ...current, isDefault: true }, 'MONTHLY')).toBe('upgrade');
});
