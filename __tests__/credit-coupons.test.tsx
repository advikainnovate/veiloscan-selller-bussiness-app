/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { openMenuKey } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { customerCreditService } from '../src/services/customer-credit-service';
import { couponService } from '../src/services/coupon-service';
import { couponPayload, EMPTY_COUPON, validateCoupon } from '../src/lib/coupons';
import { dueHint, paymentAmountProblem } from '../src/lib/customer-credit';
import { formatRupees } from '../src/lib/format';
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

jest.mock('../src/services/subscription-service', () => ({
  subscriptionService: { mine: jest.fn(async () => ({ plan: null, consolidatedDashboard: false })) },
}));

jest.mock('../src/services/customer-credit-service', () => ({
  customerCreditService: {
    summary: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    receivePayment: jest.fn(async () => ({})),
    update: jest.fn(async () => ({})),
    cancel: jest.fn(async () => ({})),
    sendReminder: jest.fn(),
  },
}));

jest.mock('../src/services/coupon-service', () => ({
  couponService: { list: jest.fn(), get: jest.fn(), create: jest.fn(async () => ({})), update: jest.fn(async () => ({})), remove: jest.fn(async () => ({})) },
}));

const { act } = ReactTestRenderer;
const credit = customerCreditService as jest.Mocked<typeof customerCreditService>;
const coupons = couponService as jest.Mocked<typeof couponService>;
const me = authService.me as jest.Mock;

const ROW = {
  id: 'c1',
  idd: 'CRD-0001',
  customerName: 'Asha Rao',
  customerPhone: '9800000001',
  customerId: 'u1',
  orderId: 'o1',
  orderNumber: 'ORD-1001',
  storeName: 'Main Store',
  creditAmount: 5000,
  paidAmount: 1500,
  outstandingAmount: 3500,
  dueDate: '2026-11-10',
  status: 'PARTIAL',
  overdueDays: 0,
  dueInDays: 8,
  lastPaymentDate: null,
  lastPaymentAmount: null,
};

const DETAIL = {
  id: 'c1',
  idd: 'CRD-0001',
  status: 'PENDING',
  creditAmount: 5000,
  paidAmount: 0,
  outstandingAmount: 5000,
  dueDate: '2026-11-10',
  overdueDays: 0,
  dueInDays: 8,
  reminderEnabled: true,
  reminderDays: 1,
  reminderChannels: ['IN_APP'],
  notes: null,
  createdAt: '2026-11-01T10:00:00Z',
  store: { id: 's1', name: 'Main Store' },
  customer: { id: 'u1', registered: true, name: 'Asha Rao', phone: '9800000001', email: null },
  order: { id: 'o1', orderNumber: 'ORD-1001', orderDate: '2026-11-01', orderStatus: 'DELIVERED', paymentStatus: 'CREDIT', totalAmount: 5000, paidAtOrder: 0, receiptId: 'r1' },
  payments: [],
  reminders: [{ id: 'rm1', reminderDate: '2026-11-09', daysBeforeDue: 1, notificationType: 'IN_APP', status: 'PENDING', sentAt: null, failureReason: null }],
};

const COUPON = {
  id: 'k1',
  idd: 'CPN-1',
  title: 'Diwali Sale',
  codeSlug: 'diwali-sale',
  couponCode: 'DIWALI20',
  description: null,
  discountType: 'PERCENTAGE',
  discountValue: '20.00',
  minOrderValue: '500',
  maxOrderValue: null,
  maxDiscountAmount: '200',
  usageLimitTotal: 0,
  usageLimitPerUser: 1,
  initialCoupon: 0,
  categoriesSelection: 'ALL',
  brandsSelection: 'ALL',
  productSelection: 'ALL',
  startDate: '2026-10-01T00:00:00.000Z',
  endDate: '2026-10-31T00:00:00.000Z',
  termsAndConditions: null,
  status: 1,
  storeId: null,
  createdAt: '2026-09-30T00:00:00Z',
  updatedAt: '2026-09-30T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ firstName: 'Rajendra', userType: 'SELLER', permissions: ['customer-credit:manage', 'coupons-master:manage', 'orders:manage'] });
  credit.summary.mockResolvedValue({
    totalCredit: 124500,
    totalCollected: 62250,
    totalOutstanding: 62250,
    dueThisWeek: 3500,
    overdueAmount: 0,
    overdueCount: 0,
    customersWithOutstanding: 12,
  });
  credit.list.mockImplementation(async ({ limit }) => (limit === 1 ? { items: [], total: 3 } : { items: [ROW], total: 1 }));
  credit.get.mockResolvedValue(DETAIL as never);
  credit.sendReminder.mockResolvedValue({ ...DETAIL, reminders: [{ ...DETAIL.reminders[0], id: 'rm2', daysBeforeDue: null, status: 'SENT' }] } as never);
  coupons.list.mockResolvedValue([COUPON, { ...COUPON, id: 'k2', title: 'Flat 100', couponCode: 'FLAT100', discountType: 'FLAT', discountValue: '100', status: 0, endDate: null }] as never);
  coupons.get.mockResolvedValue(COUPON as never);
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

/** Presses the pressable whose own text is `label` and that passes `match` (for labels shown twice). */
async function pressWhere(tree: ReactTestRenderer.ReactTestRenderer, label: string, match: (n: ReactTestRenderer.ReactTestInstance) => boolean = () => true) {
  const targets = tree.root
    .findAll(n => n.props.children === label)
    .map(n => {
      let p: ReactTestRenderer.ReactTestInstance | null = n;
      while (p && !p.props.onPress) p = p.parent;
      return p;
    })
    .filter((p): p is ReactTestRenderer.ReactTestInstance => !!p && match(p));
  const target = targets[targets.length - 1];
  if (!target) throw new Error(`Nothing pressable labelled "${label}"`);
  await act(async () => target.props.onPress());
}

const input = (tree: ReactTestRenderer.ReactTestRenderer, label: string) =>
  tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0];

test('customer credit: summary, tabs and collecting a payment with the amount checked', async () => {
  const tree = await openModule('customer-credit');
  let text = textOf(tree);
  expect(text).toContain('₹1.24 L');
  expect(text).toContain('50% of total credit');
  expect(text).toContain('Asha Rao');
  expect(text).toContain('Due in 8 days');

  await press(tree, 'Overdue');
  expect(credit.list).toHaveBeenCalledWith(expect.objectContaining({ filter: 'overdue', page: 1, limit: 20 }));

  await press(tree, 'Collect from Asha Rao');
  await act(async () => input(tree, 'Payment amount').props.onChangeText('4000'));
  expect(textOf(tree)).toContain("Can't exceed the outstanding ₹3,500");

  await act(async () => input(tree, 'Payment amount').props.onChangeText('1000'));
  await press(tree, 'Continue');
  text = textOf(tree);
  expect(text).toContain('Confirm payment');
  expect(text).toContain('₹2,500');
  await press(tree, 'Confirm ₹1,000');
  expect(credit.receivePayment).toHaveBeenCalledWith('c1', expect.objectContaining({ amount: 1000, paymentMethod: 'CASH' }));

  await act(async () => tree.unmount());
});

test('credit detail: reminder, edit validation and cancel', async () => {
  const tree = await openModule('customer-credit');
  await press(tree, 'Asha Rao, Partial, ₹3,500 outstanding');
  let text = textOf(tree);
  expect(text).toContain('Customer Credit created');
  expect(text).toContain('Cancel this credit');

  await press(tree, 'Send now');
  expect(credit.sendReminder).toHaveBeenCalledWith('c1', 'IN_APP');

  // Reminders on with no channel can't be saved.
  const channel = (n: ReactTestRenderer.ReactTestInstance) => n.props.accessibilityRole === 'checkbox';
  await press(tree, 'Edit');
  await pressWhere(tree, 'In-App', channel);
  await press(tree, 'Save');
  expect(textOf(tree)).toContain('Choose at least one reminder channel.');
  expect(credit.update).not.toHaveBeenCalled();
  await pressWhere(tree, 'In-App', channel);
  await press(tree, 'Save');
  expect(credit.update).toHaveBeenCalledWith('c1', expect.objectContaining({ reminderEnabled: true, reminderChannels: ['IN_APP'] }));

  await press(tree, 'Cancel this credit');
  await press(tree, 'Cancel credit');
  expect(credit.cancel).toHaveBeenCalledWith('c1', undefined);

  await act(async () => tree.unmount());
});

test('coupons: stats, filters, create with validation, toggle', async () => {
  const tree = await openModule('coupons');
  let text = textOf(tree);
  expect(text).toContain('DIWALI20');
  expect(text).toContain('20% OFF');
  expect(text).toContain('Expired');

  await press(tree, 'Flat');
  text = textOf(tree);
  expect(text).toContain('FLAT100');
  expect(text).not.toContain('DIWALI20');

  await press(tree, 'Create Coupon');
  // The form's own button (the list's header button is labelled the same).
  await pressWhere(tree, 'Create Coupon');
  text = textOf(tree);
  expect(text).toContain('Title is required');
  expect(text).toContain('Discount value is required');
  expect(coupons.create).not.toHaveBeenCalled();

  const field = (placeholderOrValue: (n: ReactTestRenderer.ReactTestInstance) => boolean) => tree.root.findAll(n => n.props.onChangeText && placeholderOrValue(n))[0];
  await act(async () => field(n => n.props.placeholder === 'e.g. Diwali Sale').props.onChangeText('Weekend Deal'));
  // The slug follows the title.
  expect(field(n => n.props.value === 'weekend-deal')).toBeTruthy();
  const inputs = tree.root.findAll(n => n.props.onChangeText && n.props.keyboardType === undefined && n.props.autoCapitalize === 'characters');
  await act(async () => inputs[0].props.onChangeText('WEEKEND'));
  await pressWhere(tree, 'Percentage', n => n.props.accessibilityRole === 'radio');
  await act(async () => tree.root.findAll(n => n.props.onChangeText && n.props.keyboardType === 'decimal-pad')[0].props.onChangeText('150'));
  await pressWhere(tree, 'Create Coupon');
  expect(textOf(tree)).toContain("A percentage discount can't be more than 100%");
  await act(async () => tree.root.findAll(n => n.props.onChangeText && n.props.keyboardType === 'decimal-pad')[0].props.onChangeText('15'));
  await pressWhere(tree, 'Create Coupon');
  expect(coupons.create).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Weekend Deal', codeSlug: 'weekend-deal', couponCode: 'WEEKEND', discountType: 'PERCENTAGE', discountValue: '15' }),
  );

  // Back on the list, still filtered to Flat.
  await press(tree, 'All Types');
  await press(tree, 'Diwali Sale, DIWALI20, Active');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  await press(tree, 'Deactivate');
  expect(coupons.update).toHaveBeenCalledWith('k1', { status: 0 });
  alert.mockRestore();

  await act(async () => tree.unmount());
});

test('the modules are blocked without their permissions', async () => {
  me.mockResolvedValue({ firstName: 'Rajendra', userType: 'SELLER_USER', permissions: ['orders:manage'] });
  const tree = await openModule('customer-credit');
  expect(textOf(tree)).toContain('No access');
  expect(credit.list).not.toHaveBeenCalled();
  await act(async () => openMenuKey('coupons'));
  expect(coupons.list).not.toHaveBeenCalled();

  await act(async () => tree.unmount());
});

test('validation rules match the backend', () => {
  const ok = { ...EMPTY_COUPON, title: 'T', codeSlug: 't', couponCode: 'T', discountValue: '10' };
  expect(validateCoupon(ok)).toEqual({});
  expect(validateCoupon({ ...ok, discountValue: '10.555' }).discountValue).toBeTruthy();
  expect(validateCoupon({ ...ok, usageLimitTotal: '2.5' }).usageLimitTotal).toBeTruthy();
  expect(validateCoupon({ ...ok, minOrderValue: '500', maxOrderValue: '100' }).maxOrderValue).toBeTruthy();
  expect(validateCoupon({ ...ok, startDate: '2026-11-10', endDate: '2026-11-01' }).endDate).toBeTruthy();
  expect(validateCoupon({ ...ok, couponCode: 'X'.repeat(101) }).couponCode).toBeTruthy();
  expect(couponPayload({ ...ok, startDate: '2026-11-01', usageLimitTotal: '5' }, false)).toEqual(
    expect.objectContaining({ startDate: '2026-11-01T00:00:00.000Z', usageLimitTotal: 5, minOrderValue: undefined }),
  );
  expect(couponPayload(ok, false)).not.toHaveProperty('status');

  expect(paymentAmountProblem('0', 100, formatRupees)).toBe('Enter an amount above ₹0');
  expect(paymentAmountProblem('100.01', 100, formatRupees)).toContain("Can't exceed");
  expect(paymentAmountProblem('100', 100, formatRupees)).toBe('');
  expect(dueHint({ status: 'OVERDUE', overdueDays: 3 })).toBe('3 days overdue');
  expect(dueHint({ status: 'PENDING', dueInDays: 0 })).toBe('Due today');
  expect(dueHint({ status: 'PAID', dueInDays: 2 })).toBeNull();
});
