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
import { quantityDiscountService, type SchemeProductOptions } from '../src/services/quantity-discount-service';
import { addSlab, filterSchemes, joinDateTime, newSlab, schemeInput, schemeProblem, slabPreview, slabsProblem, type SchemeForm } from '../src/lib/quantity-slabs';
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

jest.mock('../src/services/quantity-discount-service', () => ({
  quantityDiscountService: {
    list: jest.fn(),
    get: jest.fn(),
    products: jest.fn(),
    productOptions: jest.fn(),
    create: jest.fn(async () => ({})),
    update: jest.fn(async () => ({})),
    remove: jest.fn(async () => ({})),
  },
}));

const { act } = ReactTestRenderer;
const qd = quantityDiscountService as jest.Mocked<typeof quantityDiscountService>;
const me = authService.me as jest.Mock;

const slab = (min: number, max: number | null, value: number) => ({ minQuantity: min, maxQuantity: max, quantityUnit: 'PCS', discountType: 'PERCENTAGE' as const, discountValue: value, flatDiscountMethod: null });
const ROWS = [
  {
    id: 'q1',
    idd: 'QDS-1',
    schemeName: 'Bulk rice',
    productId: 'p1',
    productName: 'Basmati Rice',
    storeId: null,
    storeName: null,
    targetType: 'SPECIFIC_VARIANTS' as const,
    aggregationMode: 'COMBINED_PRODUCT' as const,
    stackWithCoupons: true,
    startsAt: '2026-10-01T04:30:00Z',
    endsAt: null,
    status: 'ACTIVE' as const,
    state: 'RUNNING' as const,
    variantCount: 2,
    skuCount: 3,
    slabs: [slab(5, 9, 5), slab(10, null, 10)],
    updatedAt: '2026-10-01T04:30:00Z',
  },
  { id: 'q2', idd: 'QDS-2', schemeName: 'Oil offer', productId: 'p2', productName: 'Sunflower Oil', storeId: 's1', storeName: 'Green Basket', targetType: 'SIMPLE_PRODUCT' as const, aggregationMode: 'PER_VARIANT' as const, stackWithCoupons: false, startsAt: '2026-12-01T04:30:00Z', endsAt: '2026-12-31T04:30:00Z', status: 'ACTIVE' as const, state: 'SCHEDULED' as const, variantCount: 0, skuCount: 1, slabs: [{ ...slab(3, null, 20), discountType: 'FLAT' as const, flatDiscountMethod: 'PER_UNIT' as const }], updatedAt: '2026-10-01T04:30:00Z' },
];

const OPTIONS: SchemeProductOptions = {
  id: 'p1',
  name: 'Basmati Rice',
  simple: false,
  skus: [
    { id: 'v1', sku: 'RICE1', label: '1 kg', attributes: { Size: '1 kg' }, price: 120, mrp: null, active: true, deleted: false },
    { id: 'v2', sku: 'RICE5', label: '5 kg', attributes: { Size: '5 kg' }, price: 560, mrp: null, active: true, deleted: false },
    { id: 'v3', sku: 'RICE10', label: '10 kg', attributes: {}, price: 1100, mrp: null, active: false, deleted: false },
  ],
  units: [
    { code: 'KG', name: 'Kilogram', stockType: 'WEIGHT', whole: false },
    { code: 'PCS', name: 'Pieces', stockType: 'PIECE', whole: true },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['quantity-discounts:manage'] });
  qd.list.mockResolvedValue(ROWS);
  qd.products.mockResolvedValue([{ id: 'p1', name: 'Basmati Rice', skuCount: 3, sku: 'RICE1' }]);
  qd.productOptions.mockResolvedValue(OPTIONS);
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
const typeIn = (tree: ReactTestRenderer.ReactTestRenderer, label: string, text: string) => act(async () => field(tree, label).props.onChangeText(text));

test('list: totals, slab ladder, search and state filters, delete', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  const tree = await openModule('quantity-slabs');
  let text = textOf(tree);
  expect(text).toContain('"1","Running"');
  expect(text).toContain('"1","Scheduled"');
  expect(text).toContain('"Basmati Rice"," · Specific variants (2 of 3) · quantities combined"');
  expect(text).toContain('5–9 PCS');
  expect(text).toContain('10% off');
  expect(text).toContain('₹20 off per PCS');
  expect(text).toContain('Coupons allowed');
  expect(text).toContain('All stores');
  expect(text).toContain('Green Basket · ');

  // A state tile filters to it; tapping it again clears the filter.
  await press(tree, 'Scheduled: 1');
  text = textOf(tree);
  expect(text).toContain('Oil offer');
  expect(text).not.toContain('Bulk rice');
  expect(text).toContain('Start at a later date');
  await press(tree, 'Scheduled: 1');
  expect(textOf(tree)).toContain('Bulk rice');

  await act(async () => tree.root.findAll(n => n.props.placeholder === 'Search by scheme, product or ID…' && n.props.onChangeText)[0].props.onChangeText('qds-2'));
  text = textOf(tree);
  expect(text).toContain('Oil offer');
  expect(text).not.toContain('Bulk rice');

  await press(tree, 'Delete Oil offer');
  expect(qd.remove).toHaveBeenCalledWith('q2');
  alert.mockRestore();
  await act(async () => tree.unmount());
});

test('create: product, specific variants, slabs with the checks, then save', async () => {
  const tree = await openModule('quantity-slabs');
  await press(tree, 'Create Discount Scheme');
  await press(tree, 'Create Scheme');
  expect(textOf(tree)).toContain('Choose a product first.');
  expect(qd.create).not.toHaveBeenCalled();

  await press(tree, 'Product: not chosen');
  await act(async () => new Promise<void>(r => setTimeout(r, 300)));
  await press(tree, 'Pick Basmati Rice');
  expect(qd.productOptions).toHaveBeenCalledWith('p1');
  let text = textOf(tree);
  // The name is filled in; whole units come first.
  expect(field(tree, 'Scheme name').props.value).toBe('Bulk discount — Basmati Rice');
  expect(text).toContain('Counted in whole PCS.');

  await press(tree, 'Specific variants');
  await press(tree, 'Create Scheme');
  expect(textOf(tree)).toContain('Select at least one variant');
  await press(tree, 'Select 1 kg');
  await press(tree, 'Select 5 kg');
  expect(textOf(tree)).toContain('2 of 3 selected');
  await press(tree, 'All covered variants together');

  await press(tree, 'Create Scheme');
  expect(textOf(tree)).toContain('Slab 1: enter the quantity it starts from');
  await typeIn(tree, 'Slab 1 minimum', '5');
  await typeIn(tree, 'Slab 1 maximum', '9');
  await typeIn(tree, 'Slab 1 value', '150');
  await press(tree, 'Create Scheme');
  expect(textOf(tree)).toContain('Slab 1: a percentage can be at most 100');
  await typeIn(tree, 'Slab 1 value', '5');
  // The next slab starts just above the last one.
  await press(tree, 'Add slab');
  expect(field(tree, 'Slab 2 minimum').props.value).toBe('10');
  await press(tree, 'Slab 2 flat amount');
  await typeIn(tree, 'Slab 2 value', '15');
  text = textOf(tree);
  expect(text).toContain('5–9 PCS');
  expect(text).toContain('₹15 off per PCS');
  expect(text).toContain('2 slabs · active · all stores');

  await press(tree, 'Create Scheme');
  expect(qd.create).toHaveBeenCalledWith(
    expect.objectContaining({
      schemeName: 'Bulk discount — Basmati Rice',
      productId: 'p1',
      storeId: null,
      targetType: 'SPECIFIC_VARIANTS',
      aggregationMode: 'COMBINED_PRODUCT',
      variantIds: ['v1', 'v2'],
      stackWithCoupons: false,
      endsAt: null,
      status: 'ACTIVE',
      slabs: [
        { minQuantity: 5, maxQuantity: 9, quantityUnit: 'PCS', discountType: 'PERCENTAGE', discountValue: 5, flatDiscountMethod: null },
        { minQuantity: 10, maxQuantity: null, quantityUnit: 'PCS', discountType: 'FLAT', discountValue: 15, flatDiscountMethod: 'PER_UNIT' },
      ],
    }),
  );
  await act(async () => tree.unmount());
});

test('edit: loads the scheme, the product is fixed, saves without productId', async () => {
  qd.get.mockResolvedValue({
    ...ROWS[0],
    variantIds: ['v1', 'v2'],
    variants: OPTIONS.skus.slice(0, 2),
    audit: [{ id: 'a1', action: 'SLABS_CHANGED', changes: null, createdAt: '2026-10-02T04:30:00Z', actorName: 'Rajendra' }],
  });
  const tree = await openModule('quantity-slabs');
  await press(tree, 'Open Bulk rice');
  expect(qd.get).toHaveBeenCalledWith('q1');
  const text = textOf(tree);
  expect(text).toContain("SKU RICE1 · can't be changed");
  expect(text).toContain('Slabs changed');
  expect(text).toContain('QDS-1');
  await typeIn(tree, 'Scheme name', 'Bulk rice — Diwali');
  await press(tree, 'Save Changes');
  const [id, body] = qd.update.mock.calls[0];
  expect(id).toBe('q1');
  expect(body).not.toHaveProperty('productId');
  expect(body).toEqual(expect.objectContaining({ schemeName: 'Bulk rice — Diwali', variantIds: ['v1', 'v2'], stackWithCoupons: true }));
  await act(async () => tree.unmount());
});

test('no access without quantity-discounts:manage', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  const tree = await openModule('quantity-slabs');
  expect(textOf(tree)).toContain('No access');
  expect(qd.list).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('slab and scheme helpers', () => {
  expect(filterSchemes(ROWS, '', 'SCHEDULED').map(r => r.id)).toEqual(['q2']);
  expect(filterSchemes(ROWS, 'basmati', '').map(r => r.id)).toEqual(['q1']);
  // Weight units step by 0.001.
  expect(addSlab([newSlab({ min: '0.5', max: '1.5' })], false)[1].min).toBe('1.501');
  expect(slabsProblem([newSlab({ min: '1.5', value: '5' })], true)).toBe('Slab 1: quantities are whole numbers in this unit');
  expect(slabsProblem([newSlab({ min: '5', max: '3', value: '5' })], true)).toBe("Slab 1: the maximum can't be below the minimum");
  expect(slabsProblem([newSlab({ min: '1.5', value: '5' })], false)).toBeNull();
  expect(slabPreview([newSlab({ min: '1', max: '', type: 'FLAT', method: 'PER_ORDER', value: '100' })], 'KG')).toEqual([expect.objectContaining({ range: '1+ KG', discount: '₹100 off' })]);
  const form: SchemeForm = {
    schemeName: 'x',
    productId: 'p1',
    storeId: '',
    targetType: 'SIMPLE_PRODUCT',
    aggregationMode: 'COMBINED_PRODUCT',
    variantIds: ['v1'],
    stackWithCoupons: false,
    startDate: '2026-11-10',
    startTime: '09:00',
    endDate: '2026-11-09',
    endTime: '',
    status: 'ACTIVE',
    unit: 'PCS',
    slabs: [newSlab({ min: '1', value: '5' })],
  };
  expect(schemeProblem(form, true)).toBe('The end must be after the start');
  const body = schemeInput({ ...form, endDate: '' });
  // A simple product counts per variant and has no variant list.
  expect(body.aggregationMode).toBe('PER_VARIANT');
  expect(body.variantIds).toEqual([]);
  expect(body.startsAt).toBe(joinDateTime('2026-11-10', '09:00')!.toISOString());
});
