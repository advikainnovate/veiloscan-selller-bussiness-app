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
import {
  brandRequestService,
  categorywiseBrands,
  productSpecificationService,
  productSpecificationValueService,
  productVariantService,
  warehouseMasterService,
} from '../src/services/catalog-service';
import { fileService, productSkuService } from '../src/services/products-service';
import { stockService } from '../src/services/stock-service';
import {
  brandChecklist,
  childCategoryOptions,
  emptySku,
  skuPayload,
  skuProblem,
  toggleChannel,
  warehouseLifecycle,
  warehousePayload,
  warehouseProblem,
  warehouseRows,
  EMPTY_WAREHOUSE,
} from '../src/lib/catalog';
import { pastSplash, press, textOf } from '../jest/test-helpers';

// Ships untranspiled TypeScript that Jest doesn't transform.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(async () => ({ assets: [{ uri: 'file:///tm.jpg', fileName: 'trademark.jpg', type: 'image/jpeg' }] })),
}));

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

jest.mock('../src/services/catalog-service', () => {
  const c = () => ({ list: jest.fn(async () => []), get: jest.fn(), create: jest.fn(async () => ({ id: 'new1' })), update: jest.fn(async () => ({})), remove: jest.fn(async () => ({})) });
  return {
    brandRequestService: { options: jest.fn(), list: jest.fn(), get: jest.fn(), create: jest.fn(), resubmit: jest.fn(async () => ({})), withdraw: jest.fn(async () => ({})) },
    categorywiseBrands: jest.fn(),
    productVariantService: c(),
    variantMasterService: c(),
    variantDataService: c(),
    productSpecificationService: c(),
    productSpecificationValueService: c(),
    specificationService: c(),
    specificationDataService: c(),
    warehouseMasterService: { ...c(), resubmit: jest.fn(async () => ({})), history: jest.fn(async () => []) },
    recentMovements: jest.fn(async () => []),
  };
});

jest.mock('../src/services/products-service', () => {
  const c = () => ({ list: jest.fn(async () => []), get: jest.fn(), create: jest.fn(async () => ({ id: 'new1' })), update: jest.fn(async () => ({})), remove: jest.fn(async () => ({})) });
  return {
    ...jest.requireActual('../src/services/products-service'),
    productsService: { ...c(), list: jest.fn(async () => [{ id: 'p1', productName: 'Basmati Rice', categoryId: 'cat3' }]) },
    productSkuService: c(),
    productImageService: c(),
    categoryService: c(),
    brandService: c(),
    fileService: { upload: jest.fn(async () => ({ id: 'f1', url: 'https://x/f1.jpg' })) },
  };
});

jest.mock('../src/services/stock-service', () => ({
  ...jest.requireActual('../src/services/stock-service'),
  stockService: { list: jest.fn(async () => []) },
}));

jest.mock('../src/services/product-builder-service', () => ({
  productBuilderService: { configuration: jest.fn(async () => ({ category: { title: 'Rice' }, specifications: [{ id: 'sp1' }, { id: 'sp2' }] })) },
}));

const { act } = ReactTestRenderer;
const me = authService.me as jest.Mock;
const wh = warehouseMasterService as jest.Mocked<typeof warehouseMasterService>;
const brands = brandRequestService as jest.Mocked<typeof brandRequestService>;
const sku = productSkuService as jest.Mocked<typeof productSkuService>;
const pv = productVariantService as jest.Mocked<typeof productVariantService>;
const ps = productSpecificationService as jest.Mocked<typeof productSpecificationService>;
const psv = productSpecificationValueService as jest.Mocked<typeof productSpecificationValueService>;
const products = jest.requireMock('../src/services/products-service');
const catalog = jest.requireMock('../src/services/catalog-service');

const ALL = ['warehouse-master:manage', 'products-master:manage', 'product-variants:manage', 'product-business-variants:manage', 'product-specifications:manage'];

const WAREHOUSES = [
  { id: 'w1', facilityTitle: 'Main Warehouse', facilityCode: 'MW1', facilityType: 'WAREHOUSE', city: 'Pune', state: 'Maharashtra', lifecycleStatus: 'ACTIVE', status: 1, contactPerson: 'Asha', isDefault: true, inboundEnabled: true, outboundEnabled: true, returnEnabled: false },
  { id: 'w2', facilityTitle: 'Dark Store East', facilityCode: 'DS2', facilityType: 'DARK_STORE', city: 'Mumbai', state: 'Maharashtra', lifecycleStatus: 'REJECTED', status: 0, reviewNote: 'Pincode does not match the city' },
];

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', lastName: 'Patil', email: 'raj@example.com', userType: 'SELLER', permissions: ALL });
  // Confirms, and "Choose from library" when picking a photo.
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  wh.list.mockResolvedValue(WAREHOUSES as never);
  (stockService.list as jest.Mock).mockResolvedValue([
    { id: 'i1', warehouseId: 'w1', productVariantId: 'v1', productName: 'Basmati Rice', sku: 'RICE5', variantLabel: '5 kg', available: 8, minimum: 10, onHand: 10, reserved: 2, salesFactor: 1, costPrice: 50, stockStatus: 'LOW_STOCK', baseUom: 'PCS', salesUom: 'PCS', stockType: 'PIECE' },
  ]);
  sku.list.mockResolvedValue([{ id: 'v1', productId: 'p1', skuItemNumber: 'RICE5', businessPrice: '100', mrp: '120', status: 1, quantityPriceType: 'FIXED', variantCombination: { Size: '5 kg' } }] as never);
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
const typeIn = (tree: ReactTestRenderer.ReactTestRenderer, label: string, text: string) => act(async () => field(tree, label).props.onChangeText(text));
/** The last pressable with this text or label: the screen on top, over the ones under it in the stack. */
async function pick(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const targets = tree.root
    .findAll(n => n.props.children === label || n.props.accessibilityLabel === label)
    .map(n => {
      let p: ReactTestRenderer.ReactTestInstance | null = n;
      while (p && !p.props.onPress) p = p.parent;
      return p;
    })
    .filter(Boolean);
  if (!targets.length) throw new Error(`Nothing pressable labelled "${label}"`);
  await act(async () => targets[targets.length - 1]!.props.onPress());
}
const settle = () => act(() => new Promise<void>(r => setTimeout(r, 50)));

test('warehouses: list figures, attention, resubmit, then add with the checks', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('warehouses'));
  let text = textOf(tree);
  expect(text).toContain('Main Warehouse');
  expect(text).toContain('1 warehouse needs your attention');
  expect(text).toContain(' — rejected: Pincode does not match the city');
  // 8 available × ₹100.
  expect(text).toContain('8 units · ₹800.00');
  expect(text).toContain('Low Stock');
  expect(text).toContain('Low stock items 1');

  await press(tree, 'Rejected: 1');
  text = textOf(tree);
  expect(text).toContain('Dark Store East');
  expect(text).not.toContain('Main Warehouse');

  await press(tree, 'More for Dark Store East');
  await press(tree, 'Resubmit for review');
  await typeIn(tree, 'Note for the reviewer (optional)', 'Corrected the pincode');
  await press(tree, 'Resubmit');
  expect(wh.resubmit).toHaveBeenCalledWith('w2', 'Corrected the pincode');

  await press(tree, 'Add Warehouse');
  await press(tree, 'Save Warehouse');
  expect(textOf(tree)).toContain('Please fill in: Warehouse Name, Warehouse Code');
  await typeIn(tree, 'Warehouse Name', 'North Hub');
  await typeIn(tree, 'Warehouse Code', 'NH1');
  await typeIn(tree, 'Email', 'bad-email');
  await press(tree, 'Save Warehouse');
  expect(textOf(tree)).toContain('Enter a valid email address');
  await typeIn(tree, 'Email', 'hub@example.com');
  wh.create.mockResolvedValue({ id: 'w3', lifecycleStatus: 'PENDING_APPROVAL' } as never);
  await press(tree, 'Save Warehouse');
  expect(wh.create).toHaveBeenCalledWith(expect.objectContaining({ facilityTitle: 'North Hub', facilityCode: 'NH1', facilityType: 'WAREHOUSE', email: 'hub@example.com', inboundEnabled: true, isDefault: false }));
  expect(wh.update).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('warehouse detail: status, stock, operations, history and switching off', async () => {
  wh.get.mockResolvedValue(WAREHOUSES[0] as never);
  wh.history.mockResolvedValue([{ id: 'h1', action: 'AUTO_APPROVED', fromStatus: 'PENDING_APPROVAL', toStatus: 'ACTIVE', note: null, createdAt: '2026-10-01T10:00:00Z', actor: null }]);
  const tree = await openApp();
  await act(async () => navigationRef.navigate('WarehouseDetail', { id: 'w1' }));
  const text = textOf(tree);
  expect(text).toContain('Default');
  expect(text).toContain('Approved automatically');
  expect(text).toContain('Automatic');
  expect(text).toContain('Accepts returns');
  expect(text).toContain('Basmati Rice');
  expect(text).toContain('1 SKU has stock reserved for orders.');
  wh.update.mockResolvedValue({ lifecycleStatus: 'INACTIVE' } as never);
  await press(tree, 'Switch off');
  expect(wh.update).toHaveBeenCalledWith('w1', { status: 0 });
  await act(async () => tree.unmount());
});

test('brand approvals: list, rejected detail with withdraw, and a new request', async () => {
  const REQ = {
    id: 'b1',
    idd: 'BRQ-1',
    status: 2,
    remarks: 'Trademark photo is blurry',
    brand: { title: 'Tata' },
    category: { categoryTitle: 'Rice' },
    store: { name: 'Green Basket' },
    createdAt: '2026-10-01T10:00:00Z',
    reviewedAt: '2026-10-02T10:00:00Z',
    salesChannels: ['WHOLESALE'],
    isBrandOwner: false,
  };
  brands.list.mockResolvedValue([REQ, { ...REQ, id: 'b2', idd: 'BRQ-2', status: 1, brand: { title: 'Fortune' } }] as never);
  brands.get.mockResolvedValue(REQ as never);
  const tree = await openApp();
  await act(async () => openMenuKey('brand-approvals'));
  let text = textOf(tree);
  expect(text).toContain('Tata');
  expect(text).toContain('Fortune');
  expect(text).toContain('1 request needs changes before it can be approved.');
  expect(text).toContain('Fix & resubmit ›');

  await press(tree, 'Open Tata');
  text = textOf(tree);
  expect(text).toContain('What needs to change');
  expect(text).toContain('Trademark photo is blurry');
  expect(text).toContain('Wholesale Distribution');
  expect(text).toContain('No — authorised reseller');
  await press(tree, 'Withdraw');
  expect(brands.withdraw).toHaveBeenCalledWith('b1');

  // New request: child category → brand → store → channels → ownership → document.
  brands.options.mockResolvedValue([{ id: 's1', name: 'Green Basket', code: 'GB01', categoryIds: ['cat3'] }]);
  products.categoryService.list.mockResolvedValue([
    { id: 'cat1', categoryTitle: 'Grocery', categoryType: 'MAIN_CATEGORY', parentCategoryId: null },
    { id: 'cat2', categoryTitle: 'Staples', categoryType: 'SUB_CATEGORY', parentCategoryId: 'cat1' },
    { id: 'cat3', categoryTitle: 'Rice', categoryType: 'CHILD_CATEGORY', parentCategoryId: 'cat2' },
    { id: 'cat4', categoryTitle: 'Oil', categoryType: 'CHILD_CATEGORY', parentCategoryId: 'cat2' },
  ]);
  products.brandService.list.mockResolvedValue([{ id: 'br1', title: 'India Gate', status: 1 }]);
  (categorywiseBrands as jest.Mock).mockResolvedValue([{ brandId: 'br1', status: 1 }]);
  brands.create.mockResolvedValue([{ id: 'b9' }] as never);
  brands.get.mockResolvedValue({ ...REQ, id: 'b9', status: 0, brand: { title: 'India Gate' } } as never);

  await act(async () => navigationRef.navigate('BrandRequestForm'));
  await press(tree, 'Child category: not chosen');
  // Only categories mapped to a store, with their path.
  expect(textOf(tree)).not.toContain('Grocery › Staples › Oil');
  await press(tree, 'Grocery › Staples › Rice');
  await settle();
  await press(tree, 'Brand: not chosen');
  await press(tree, 'India Gate');
  await press(tree, 'Wholesale Distribution');
  await press(tree, 'No, I resell it');
  const submit = () => tree.root.findAll(n => n.props.accessibilityRole === 'button' && n.props.accessibilityState?.disabled !== undefined && n.props.onPress).pop()!;
  expect(submit().props.accessibilityState.disabled).toBe(true);
  await press(tree, 'Upload Registered document');
  expect(textOf(tree)).toContain('trademark.jpg');
  await act(async () => submit().props.onPress());
  expect(fileService.upload).toHaveBeenCalledWith(expect.objectContaining({ name: 'trademark.jpg' }), 'brand-approvals', { documentType: 'brand-approval-registeredDocument' });
  expect(brands.create).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat3', storeIds: ['s1'], brandId: 'br1', salesChannels: ['WHOLESALE'], isBrandOwner: false, registeredDocumentFileId: 'f1' }));
  await act(async () => tree.unmount());
});

test('product variants: list and a mapping whose values follow the type', async () => {
  pv.list.mockResolvedValue([
    { id: 'm1', productId: 'p1', variantId: 't1', variantDataId: 'd1', sequence: 1, status: 1, product: { productName: 'Basmati Rice', skuItemNumber: 'RICE' }, variant: { variantTitle: 'Size' }, variantData: { variantData: '5 kg' }, createdAt: '2026-10-01T10:00:00Z' },
  ] as never);
  catalog.variantMasterService.list.mockResolvedValue([{ id: 't1', variantTitle: 'Size' }, { id: 't2', variantTitle: 'Colour' }]);
  catalog.variantDataService.list.mockResolvedValue([{ id: 'd1', variantId: 't1', variantData: '5 kg' }, { id: 'd2', variantId: 't2', variantData: 'Red', colorCode: '#f00' }]);
  const tree = await openApp();
  await act(async () => openMenuKey('product-variants'));
  let text = textOf(tree);
  expect(text).toContain('Basmati Rice');
  expect(text).toContain('Size');
  expect(text).toContain('5 kg');

  await press(tree, 'Add Variant Mapping');
  await pick(tree, 'Add Mapping');
  expect(textOf(tree)).toContain('Please fill in: Product, Variant type, Variant value');
  await press(tree, 'Product: not chosen');
  await pick(tree, 'Basmati Rice');
  await press(tree, 'Variant type: not chosen');
  await pick(tree, 'Colour');
  await press(tree, 'Variant value: not chosen');
  text = textOf(tree);
  expect(text).toContain('Red (#f00)');
  // Only the list underneath shows 5 kg; it isn't offered for Colour.
  expect(text.split('"5 kg"').length - 1).toBe(1);
  await pick(tree, 'Red (#f00)');
  await pick(tree, 'Add Mapping');
  expect(pv.create).toHaveBeenCalledWith({ productId: 'p1', variantId: 't2', variantDataId: 'd2', status: 1 });
  await act(async () => tree.unmount());
});

test('business variants: list and a slab-priced SKU', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('business-variants'));
  const text = textOf(tree);
  expect(text).toContain('RICE5');
  expect(text).toContain('₹100');
  expect(text).toContain('₹120');
  expect(text).toContain('5 kg');

  await press(tree, 'Add SKU');
  await press(tree, 'Product: not chosen');
  await pick(tree, 'Basmati Rice');
  await typeIn(tree, 'SKU Item Number', 'RICE10');
  await typeIn(tree, 'Selling Price', '190');
  await pick(tree, 'Add Business Variant');
  expect(textOf(tree)).toContain('Add at least one variant attribute (e.g. Color: Black).');
  await typeIn(tree, 'Attribute 1', 'Size');
  await typeIn(tree, 'Attribute 1 value', '10 kg');
  await press(tree, 'Slab (by quantity)');
  await typeIn(tree, 'Tier 1 minimum quantity', '5');
  await pick(tree, 'Add Business Variant');
  expect(textOf(tree)).toContain('Tier 1: enter both the minimum quantity and the price');
  await typeIn(tree, 'Tier 1 price', '180');
  await pick(tree, 'Add Business Variant');
  expect(sku.create).toHaveBeenCalledWith(
    expect.objectContaining({ productId: 'p1', skuItemNumber: 'RICE10', businessPrice: '190', variantCombination: { Size: '10 kg' }, quantityPriceType: 'SLAB', quantityLowerBound1: 5, quantityPrice1: '180' }),
  );
  await act(async () => tree.unmount());
});

test("product specs: list, then add a SELECT spec from the product's category", async () => {
  catalog.specificationService.list.mockResolvedValue([
    { id: 'sp1', specificationTitle: 'Grain', type: 'SELECT', isRequired: true },
    { id: 'sp2', specificationTitle: 'Weight', type: 'TEXT' },
    { id: 'sp3', specificationTitle: 'Screen size', type: 'TEXT' },
  ]);
  catalog.specificationDataService.list.mockResolvedValue([{ id: 'o1', specificationId: 'sp1', optionTitle: 'Long grain' }]);
  ps.list.mockResolvedValue([{ id: 'a1', productId: 'p1', specificationId: 'sp2', status: 1 }] as never);
  psv.list.mockResolvedValue([{ id: 'v1', productSpecificationId: 'a1', specificationValue: '5 kg', sequence: 1 }] as never);
  ps.create.mockResolvedValue({ id: 'a2' } as never);
  const tree = await openApp();
  await act(async () => openMenuKey('product-specs'));
  expect(textOf(tree)).toContain('Weight');
  expect(textOf(tree)).toContain('5 kg');

  await pick(tree, 'Add Specification');
  await press(tree, 'Product: not chosen');
  await pick(tree, 'Basmati Rice');
  await settle();
  await press(tree, 'Specification: not chosen');
  const text = textOf(tree);
  // Mapped to the category and not yet assigned: Grain only.
  expect(text).toContain('Grain');
  expect(text).not.toContain('Screen size');
  await pick(tree, 'Grain');
  await press(tree, 'Value 1: not chosen');
  await pick(tree, 'Long grain');
  await pick(tree, 'Add Specification');
  expect(ps.create).toHaveBeenCalledWith({ productId: 'p1', specificationId: 'sp1' });
  expect(psv.create).toHaveBeenCalledWith({ productSpecificationId: 'a2', sequence: 1, specsDataId: 'o1' });
  await act(async () => tree.unmount());
});

test('each page shows No access without its permission', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  const tree = await openApp();
  for (const key of ['warehouses', 'brand-approvals', 'product-variants', 'business-variants', 'product-specs']) {
    await act(async () => openMenuKey(key));
    expect(textOf(tree)).toContain('No access');
  }
  expect(wh.list).not.toHaveBeenCalled();
  expect(brands.list).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('catalog helpers match the panel', () => {
  expect(warehouseLifecycle({ status: 1 })).toBe('ACTIVE');
  expect(warehouseLifecycle({ lifecycleStatus: 'UNDER_REVIEW', status: 1 })).toBe('UNDER_REVIEW');
  const [row] = warehouseRows([{ id: 'w1' }] as never, [{ warehouseId: 'w1', productVariantId: 'v1', available: 0, minimum: 5 }] as never, new Map());
  expect(row.stockStatus).toBe('OUT_OF_STOCK');
  expect(warehouseProblem({ ...EMPTY_WAREHOUSE, facilityTitle: 'A', facilityCode: 'B', latitude: '95' })).toBe('Latitude must be between -90 and 90');
  expect(warehousePayload({ ...EMPTY_WAREHOUSE, facilityTitle: ' A ' }).facilityTitle).toBe('A');
  expect(toggleChannel(['WHOLESALE'], 'NOT_APPLICABLE')).toEqual(['NOT_APPLICABLE']);
  expect(toggleChannel(['NOT_APPLICABLE'], 'WHOLESALE')).toEqual(['WHOLESALE']);
  const checks = brandChecklist({ isResubmit: false, categoryId: 'c', brandMode: 'new', hasBrand: false, newBrandTitle: 'X', storeCount: 1, salesChannels: ['W'], isBrandOwner: true, applicationNumber: '1', registeredClass: '', registeredDate: '', hasDocument: true, hasLogo: false });
  expect(checks.filter(c => !c.done).map(c => c.label)).toEqual(['Trademark details', 'Brand logo']);
  expect(childCategoryOptions([{ id: 'a', categoryTitle: 'A', categoryType: 'MAIN_CATEGORY' }, { id: 'b', categoryTitle: 'B', categoryType: 'CHILD_CATEGORY', parentCategoryId: 'a' }] as never)).toEqual([{ value: 'b', label: 'A › B' }]);
  expect(skuProblem({ ...emptySku('p'), skuItemNumber: 'S', businessPrice: '-1', attributes: [{ key: 'K', value: 'V' }] })).toBe('Prices must be amounts of 0 or more');
  // Fixed pricing sends no tiers.
  expect(skuPayload({ ...emptySku('p'), skuItemNumber: 'S', businessPrice: '1', tiers: [{ lowerBound: '5', price: '1' }] })).not.toHaveProperty('quantityLowerBound1');
});
