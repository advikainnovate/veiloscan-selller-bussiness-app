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
import { storeService } from '../src/services/store-service';
import { subscriptionService } from '../src/services/subscription-service';
import { consolidatedService, storeOperationsService } from '../src/services/store-operations-service';
import { expensesService } from '../src/services/expenses-service';
import { expenseProblem, expenseTotals, rangePresets } from '../src/lib/operations';
import { reminderTime } from '../src/screens/operations/NotesScreen';
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

jest.mock('../src/services/store-operations-service', () => ({
  storeOperationsService: {
    overview: jest.fn(),
    trend: jest.fn(),
    breakdown: jest.fn(),
    sales: jest.fn(),
    daily: jest.fn(),
    stockHealth: jest.fn(),
    notes: jest.fn(),
    note: jest.fn(),
    createNote: jest.fn(async () => ({})),
    updateNote: jest.fn(async () => ({})),
    setNoteStatus: jest.fn(async () => ({})),
    removeNote: jest.fn(async () => ({})),
  },
  consolidatedService: { overview: jest.fn() },
}));

jest.mock('../src/services/expenses-service', () => ({
  ...jest.requireActual('../src/services/expenses-service'),
  expensesService: {
    categories: jest.fn(async () => [{ id: 'cat1', name: 'Rent', isSystem: true, expenseCount: 2 }]),
    suppliers: jest.fn(async () => ({ items: [], totals: { outstanding: 0, overdue: 0, refundDue: 0, owing: 0 } })),
    contributors: jest.fn(async () => []),
    dashboard: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(async () => ({ id: 'e9' })),
    addPayment: jest.fn(async () => ({})),
    recurring: jest.fn(async () => []),
    report: jest.fn(),
  },
}));

const { act } = ReactTestRenderer;
const ops = storeOperationsService as jest.Mocked<typeof storeOperationsService>;
const exp = expensesService as jest.Mocked<typeof expensesService>;
const me = authService.me as jest.Mock;

const metrics = (sales: number, expenses: number, gross: number | null) => ({
  orders: 10,
  sales,
  expenses,
  collection: sales,
  cashCollection: sales / 2,
  onlineCollection: sales / 2,
  productCost: gross === null ? null : sales - gross,
  grossProfit: gross,
  netProfit: gross === null ? null : gross - expenses,
  grossMargin: gross === null ? null : 40,
  netMargin: gross === null ? null : 20,
  linesWithoutCost: 0,
});
const ALERTS = { lowStock: 1, outOfStock: 0, pendingStockOrders: 2, delayedStockOrders: 1 };

const EXPENSE = {
  id: 'e1',
  idd: 'EXP-0001',
  kind: 'OPERATING',
  title: 'Shop rent',
  expenseDate: '2026-11-01',
  paymentType: 'CREDIT',
  status: 'UNPAID',
  baseAmount: 20000,
  discountAmount: 0,
  taxRate: null,
  taxAmount: 0,
  amount: 20000,
  paidAmount: 5000,
  returnedAmount: 0,
  netAmount: 20000,
  outstandingAmount: 15000,
  refundDue: 0,
  dueInDays: 5,
  paymentMode: null,
  paidTo: null,
  referenceNumber: null,
  invoiceDate: null,
  description: null,
  notes: null,
  creditDate: '2026-11-01',
  dueDate: '2026-11-08',
  creditTermsDays: 7,
  reminderDate: null,
  stockOrderId: null,
  recurringId: null,
  categoryId: 'cat1',
  categoryName: 'Rent',
  supplierId: null,
  supplierName: 'Landlord',
  attachmentCount: 0,
  createdByName: 'Rajendra',
  createdAt: '2026-11-01T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({
    id: 'u1',
    firstName: 'Rajendra',
    userType: 'SELLER',
    permissions: ['store-operations:manage', 'store-expenses:view', 'store-expenses:create', 'store-notes:view', 'store-notes:create', 'store-notes:edit'],
  });
  (storeService.list as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Main Store', code: 'MAIN', status: 'ACTIVE' }]);
  (subscriptionService.mine as jest.Mock).mockResolvedValue({ plan: { planName: 'Starter' }, consolidatedDashboard: true });
  ops.overview.mockResolvedValue({ canViewProfit: true, period: metrics(100000, 20000, 40000), previous: metrics(80000, 20000, 30000), alerts: ALERTS });
  ops.trend.mockResolvedValue({ canViewProfit: true, points: [{ date: '2026-11-01', orders: 10, sales: 100000, expenses: 20000, grossProfit: 40000, netProfit: 20000 }] });
  ops.breakdown.mockResolvedValue({ byPaymentMethod: [], byCategory: [{ categoryId: 'c1', name: 'Groceries', orders: 5, units: 9, sales: 100000, profit: 40000 }] });
  ops.sales.mockResolvedValue({ groupBy: 'none', canViewProfit: true, total: 0, items: [] });
  ops.stockHealth.mockResolvedValue({ items: [{ variantId: 'v1', productName: 'Basmati Rice', sku: 'RICE5', uom: 'pcs', available: 2, health: 'low', imageUrl: null }], total: 1 } as never);
  ops.daily.mockResolvedValue({
    date: '2026-11-03',
    canViewProfit: false,
    metrics: metrics(5000, 1000, null),
    credit: { creditGiven: 700, creditOutstanding: 9000 },
    stock: { receivedUnits: 12, receipts: 1, adjustments: 0 },
    timeline: [{ at: '2026-11-03T09:00:00Z', type: 'ORDER', id: 'o1', title: 'ORD-1', detail: 'DELIVERED', amount: 500, units: null }],
  });
  ops.notes.mockResolvedValue({
    items: [
      {
        id: 'n1',
        idd: 'NOTE-1',
        title: 'Supplier visit',
        description: 'Bring the invoice',
        noteDate: '2026-11-03',
        priority: 'URGENT',
        status: 'ACTIVE',
        reminderAt: null,
        reminderSentAt: null,
        completedAt: null,
        attachmentFileId: null,
        attachmentUrl: null,
        attachmentName: null,
        createdByName: 'Rajendra',
        createdAt: '2026-11-03T08:00:00Z',
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    counts: { active: 1, completed: 0, archived: 0, urgent: 1 },
  });
  (consolidatedService.overview as jest.Mock).mockResolvedValue({
    canViewProfit: true,
    storeCount: 2,
    totals: metrics(150000, 30000, 60000),
    previousTotals: metrics(120000, 30000, 50000),
    stores: [
      { store: { id: 's1', name: 'Main Store', timezone: 'Asia/Kolkata' }, metrics: metrics(100000, 20000, 40000), previous: metrics(80000, 20000, 30000), alerts: ALERTS },
      { store: { id: 's2', name: 'Second Store', timezone: 'Asia/Kolkata' }, metrics: metrics(50000, 10000, 20000), previous: metrics(40000, 10000, 20000), alerts: ALERTS },
    ],
    alerts: ALERTS,
  });
  exp.dashboard.mockResolvedValue({
    totals: { count: 3, totalExpenses: 30000, paidExpenses: 10000, creditExpenses: 20000, returns: 0 },
    owed: { outstanding: 15000, openCount: 1, overdue: 0, overdueCount: 0, partiallyPaid: 15000, partiallyPaidCount: 1, dueThisWeek: 15000, refundsDue: 0, stockBillsOutstanding: 0 },
    months: [{ month: '2026-11', total: 30000, paid: 10000, credit: 20000, payments: 15000, count: 3 }],
    byCategory: [{ categoryId: 'cat1', name: 'Rent', amount: 20000, count: 1 }],
    upcoming: [EXPENSE],
  } as never);
  exp.list.mockResolvedValue({ items: [EXPENSE], total: 1, totalAmount: 20000, netAmount: 20000, paidAmount: 5000, outstandingAmount: 15000 } as never);
  exp.get.mockResolvedValue({ ...EXPENSE, supplier: null, stockOrderIdd: null, recurringTitle: null, cancelReason: null, cancelledAt: null, cancelledByName: null, payments: [], returns: [], attachments: [], reminders: [], history: [] } as never);
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

/** The last pressable with this exact text (a sheet's button, over the screen's own). */
async function pressLast(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const targets = tree.root
    .findAll(n => n.props.children === label)
    .map(n => {
      let p: ReactTestRenderer.ReactTestInstance | null = n;
      while (p && !p.props.onPress) p = p.parent;
      return p;
    })
    .filter(Boolean);
  await act(async () => targets[targets.length - 1]!.props.onPress());
}

const field = (tree: ReactTestRenderer.ReactTestRenderer, label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0];

test('business overview: KPIs, chart, categories and stock alerts for the store', async () => {
  const tree = await openModule('business-overview');
  const text = textOf(tree);
  expect(text).toContain('₹1 L');
  expect(text).toContain('▲ 25.0% ');
  expect(text).toContain('Groceries');
  expect(text).toContain('Basmati Rice');
  expect(text).toContain('2 pending stock orders');
  expect(ops.overview).toHaveBeenCalledWith('s1', expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
  await act(async () => tree.unmount());
});

test('daily business: profit hidden for the role, previous day reloads', async () => {
  const tree = await openModule('daily-business');
  let text = textOf(tree);
  expect(text).toContain('Restricted for your role');
  expect(text).toContain('Order #ORD-1');
  expect(text).toContain('12 units');
  await press(tree, 'Previous day');
  const [, date] = ops.daily.mock.calls[ops.daily.mock.calls.length - 1];
  expect(date < ops.daily.mock.calls[0][1]).toBe(true);
  text = textOf(tree);
  expect(text).toContain('Back to today');
  await act(async () => tree.unmount());
});

test('all stores: locked without the plan, combined with it', async () => {
  (subscriptionService.mine as jest.Mock).mockResolvedValue({ plan: { planName: 'Starter' }, consolidatedDashboard: false });
  let tree = await openModule('all-stores');
  expect(textOf(tree)).toContain("Consolidated reporting isn't in your plan");
  expect(consolidatedService.overview).not.toHaveBeenCalled();
  await act(async () => tree.unmount());

  (subscriptionService.mine as jest.Mock).mockResolvedValue({ plan: null, consolidatedDashboard: true });
  tree = await openModule('all-stores');
  const text = textOf(tree);
  expect(text).toContain('Second Store');
  expect(text).toContain('All 2 stores');
  await act(async () => tree.unmount());
});

test('notes: tabs with counts, add with validation, complete', async () => {
  const tree = await openModule('notes');
  expect(textOf(tree)).toContain('Supplier visit');
  expect(textOf(tree)).toContain('Active · 1 urgent');

  await press(tree, 'Add Note');
  await pressLast(tree, 'Add Note');
  expect(textOf(tree)).toContain('Give the note a title');
  expect(ops.createNote).not.toHaveBeenCalled();

  const title = tree.root.findAll(n => n.props.placeholder === 'e.g. Supplier ABC will visit tomorrow' && n.props.onChangeText)[0];
  await act(async () => title.props.onChangeText('Order more rice'));
  await pressLast(tree, 'Add Note');
  expect(ops.createNote).toHaveBeenCalledWith('s1', expect.objectContaining({ title: 'Order more rice', priority: 'NORMAL', reminderAt: null, attachmentFileId: null }));

  await press(tree, 'Complete');
  expect(ops.setNoteStatus).toHaveBeenCalledWith('s1', 'n1', 'COMPLETED');
  await act(async () => tree.unmount());
});

test('notes: no edit or delete without those permissions', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'R', userType: 'SELLER_USER', permissions: ['store-notes:view'] });
  const tree = await openModule('notes');
  const text = textOf(tree);
  expect(text).toContain('Supplier visit');
  expect(text).not.toContain('"Complete"');
  expect(text).not.toContain('"Delete"');
  expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Add Note')).toHaveLength(0);
  await act(async () => tree.unmount());
});

test('expenses: dashboard opens the owed list, payment checked against what is owed', async () => {
  const tree = await openModule('expenses');
  expect(textOf(tree)).toContain('Shop rent');

  await press(tree, 'Outstanding: ₹15K');
  expect(exp.list).toHaveBeenLastCalledWith('s1', expect.objectContaining({ status: 'OPEN', sort: 'due_asc', from: undefined, page: 1 }));

  await press(tree, 'Shop rent, ₹20K');
  expect(textOf(tree)).toContain('EXP-0001');
  await press(tree, 'Add Payment');
  await act(async () => field(tree, 'Payment amount').props.onChangeText('16000'));
  await press(tree, 'Record Payment');
  expect(textOf(tree)).toContain('Only ₹15K is outstanding');
  expect(exp.addPayment).not.toHaveBeenCalled();
  await act(async () => field(tree, 'Payment amount').props.onChangeText('15000'));
  await press(tree, 'Record Payment');
  expect(exp.addPayment).toHaveBeenCalledWith('s1', 'e1', expect.objectContaining({ amount: 15000, method: 'CASH', idempotencyKey: expect.any(String) }));
  await act(async () => tree.unmount());
});

test('expenses: blocked without store-expenses:view', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'R', userType: 'SELLER_USER', permissions: ['store-notes:view'] });
  const tree = await openModule('expenses');
  expect(textOf(tree)).toContain('No access');
  expect(exp.dashboard).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('expense rules match the panel', () => {
  const t = expenseTotals({ baseAmount: '1000', discountAmount: '100', gst: '18', taxAmount: '', initialPaid: '', isCredit: false });
  expect(t).toEqual({ base: 1000, discount: 100, tax: 162, amount: 1062, paid: 1062, outstanding: 0 });
  const credit = expenseTotals({ baseAmount: '1000', discountAmount: '', gst: '', taxAmount: '', initialPaid: '1000', isCredit: true });
  const base = { categoryId: 'c', expenseDate: '2026-11-01', baseAmount: '1000', isCredit: true, newSupplier: false, supplierName: '', supplierGst: '', creditDate: '2026-11-01', dueDate: '' };
  expect(expenseProblem(base, credit, null, formatRupees)).toBe('That pays the whole amount — record it as Paid instead');
  expect(expenseProblem({ ...base, categoryId: '' }, credit, null, formatRupees)).toBe('Pick a category');
  const discounted = expenseTotals({ baseAmount: '100', discountAmount: '200', gst: '', taxAmount: '', initialPaid: '', isCredit: false });
  expect(expenseProblem({ ...base, isCredit: false }, discounted, null, formatRupees)).toBe("The discount can't be more than the base amount");
  expect(expenseProblem({ ...base, newSupplier: true, supplierName: 'A', supplierGst: 'BAD' }, { ...credit, paid: 0 }, null, formatRupees)).toBe('The GST number has 15 letters and digits');
  expect(expenseProblem({ ...base, dueDate: '2026-10-01' }, { ...credit, paid: 0 }, null, formatRupees)).toBe("The due date can't be before the credit date");
  expect(expenseProblem({ ...base, isCredit: false }, { ...t, amount: 500 }, { settled: 800 }, formatRupees)).toContain("the amount can't be lower");

  // The week starts on Monday.
  expect(rangePresets('2026-11-05').find(r => r.key === 'week')!.from).toBe('2026-11-02');
  expect(rangePresets('2026-11-05').find(r => r.key === 'last-month')).toEqual(expect.objectContaining({ from: '2026-10-01', to: '2026-10-31' }));

  const morning = new Date(2026, 10, 3, 8, 0);
  expect(new Date(reminderTime('today', '', '', morning)!).getHours()).toBe(10);
  expect(new Date(reminderTime('today', '', '', new Date(2026, 10, 3, 15, 0))!).getHours()).toBe(16);
  expect(reminderTime('custom', '2026-11-04', '25:00')).toBeNull();
  expect(reminderTime('none', '', '')).toBeNull();
});
