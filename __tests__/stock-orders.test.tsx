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
import { storeService } from '../src/services/store-service';
import { storeOperationsService } from '../src/services/store-operations-service';
import { linesTotal, receiptProblem, stockOrderPayload, stockOrderProblem, variantLabel } from '../src/lib/stock-orders';
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

jest.mock('../src/services/store-operations-service', () => ({
  ...jest.requireActual('../src/services/store-operations-service'),
  storeOperationsService: {
    stockHealth: jest.fn(),
    skus: jest.fn(),
    stockOrders: jest.fn(),
    stockOrder: jest.fn(),
    createStockOrder: jest.fn(),
    updateStockOrder: jest.fn(async () => ({})),
    receiveStockOrder: jest.fn(async () => ({})),
    cancelStockOrder: jest.fn(async () => ({})),
    createPurchaseBill: jest.fn(async () => ({})),
  },
}));

jest.mock('../src/services/products-service', () => ({
  ...jest.requireActual('../src/services/products-service'),
  warehouseService: { list: jest.fn(async () => [{ id: 'w1', facilityTitle: 'Main Warehouse', status: 1, isDefault: true }]) },
}));

const { act } = ReactTestRenderer;
const ops = storeOperationsService as jest.Mocked<typeof storeOperationsService>;
const me = authService.me as jest.Mock;

const ROWS = [
  { variantId: 'v1', productId: 'p1', productName: 'Basmati Rice', sku: 'RICE5', combination: { Size: '5 kg' }, uom: 'PCS', onHand: 3, available: 2, minimum: 10, reorder: 20, warehouses: 1, inventoryId: 'i1', health: 'low' as const, imageUrl: null, lastSoldAt: '2026-11-02T10:00:00Z', pendingQty: 6, suggestedReorder: 18 },
  { variantId: 'v2', productId: 'p2', productName: 'Sugar', sku: 'SUG1', combination: null, uom: 'PCS', onHand: 0, available: 0, minimum: 5, reorder: 10, warehouses: 1, inventoryId: 'i2', health: 'out' as const, imageUrl: null, lastSoldAt: null, pendingQty: 0, suggestedReorder: 10 },
  { variantId: 'v3', productId: 'p3', productName: 'Salt', sku: 'SALT', combination: null, uom: 'PCS', onHand: 50, available: 50, minimum: 5, reorder: 10, warehouses: 1, inventoryId: 'i3', health: 'healthy' as const, imageUrl: null, lastSoldAt: null, pendingQty: 0, suggestedReorder: 0 },
];
const SKUS = [
  { id: 'v1', productId: 'p1', productName: 'Basmati Rice', sku: 'RICE5', combination: { Size: '5 kg' }, costPrice: 50, available: 2, uom: 'PCS' },
  { id: 'v2', productId: 'p2', productName: 'Sugar', sku: 'SUG1', combination: null, costPrice: null, available: 0, uom: 'PCS' },
];
const ORDER = {
  id: 'so1',
  idd: 'SO-12',
  status: 'ORDERED' as const,
  supplierName: 'ABC Traders',
  supplierPhone: '9876500000',
  referenceNumber: 'PO-77',
  orderDate: '2026-11-01',
  expectedDate: '2026-11-02',
  delayed: true,
  orderAmount: 900,
  notes: null,
  cancelReason: null,
  warehouse: { id: 'w1', title: 'Main Warehouse' },
  createdByName: 'Rajendra',
  createdAt: '2026-11-01T10:00:00Z',
  totals: { products: 2, orderedUnits: 20, receivedUnits: 0, pendingUnits: 20 },
  items: [
    { id: 'it1', productName: 'Basmati Rice', sku: 'RICE5', uom: 'PCS', orderedQty: 12, receivedQty: 0, pendingQty: 12, unitCost: 50 },
    { id: 'it2', productName: 'Sugar', sku: 'SUG1', uom: 'PCS', orderedQty: 8, receivedQty: 0, pendingQty: 8, unitCost: 37.5 },
  ],
  receipts: [],
  purchaseBill: null,
  history: [],
};

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['store-operations:manage', 'pending-stock:manage', 'product-inventory:manage'] });
  (storeService.list as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Green Basket', code: 'GB01', status: 'ACTIVE' }]);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  ops.stockHealth.mockImplementation(async (_s, q) => ({
    kpis: { totalSkus: 3, totalProducts: 3, lowStock: 1, outOfStock: 1, healthy: 1 },
    items: ROWS.filter(r => !q.filter || q.filter === 'all' || r.health === q.filter),
    total: 3,
    page: 1,
    limit: 20,
  }));
  ops.skus.mockImplementation(async (_s, p) => (p.ids ? SKUS.filter(s => p.ids!.split(',').includes(s.id)) : SKUS.filter(s => s.productName.toLowerCase().includes((p.search ?? '').toLowerCase()))));
  ops.stockOrders.mockResolvedValue({
    items: [
      { id: 'so1', idd: 'SO-12', supplierName: 'ABC Traders', supplierPhone: null, referenceNumber: 'PO-77', orderDate: '2026-11-01', expectedDate: '2026-11-02', status: 'ORDERED', orderAmount: 900, warehouseTitle: 'Main Warehouse', createdByName: 'Rajendra', products: 2, totalUnits: 20, receivedUnits: 5, pendingUnits: 15, delayed: true },
    ],
    total: 1,
    page: 1,
    limit: 20,
    counts: { open: 1, delayed: 1, openAmount: 900, received: 4, cancelled: 0, all: 5 },
  });
  ops.stockOrder.mockResolvedValue(ORDER);
  ops.createStockOrder.mockResolvedValue({ ...ORDER, id: 'so2', idd: 'SO-13' });
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
const wait = (ms = 350) => act(() => new Promise<void>(r => setTimeout(r, ms)));

test('stock health: figures, filters, and ordering the low / out SKUs', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('stock-health'));
  let text = textOf(tree);
  expect(ops.stockHealth).toHaveBeenCalledWith('s1', { filter: 'all', search: undefined, page: 1, limit: 20 });
  expect(text).toContain('Basmati Rice');
  expect(text).toContain('5 kg · RICE5');
  expect(text).toContain('2 PCS');
  expect(text).toContain('18');
  expect(text).toContain('Last sold never');

  await press(tree, 'Out: 1');
  text = textOf(tree);
  expect(text).toContain('Sugar');
  expect(text).not.toContain('Basmati Rice');
  await press(tree, 'Out: 1');

  await press(tree, 'Order 2 low / out');
  await wait(50);
  expect(navigationRef.getCurrentRoute()?.name).toBe('StockOrderForm');
  expect(ops.skus).toHaveBeenCalledWith('s1', { ids: 'v1,v2' });
  text = textOf(tree);
  expect(text).toContain('2 products');
  await act(async () => tree.unmount());
});

test('new stock order: the checks, then it is created and opened', async () => {
  const tree = await openApp();
  await act(async () => navigationRef.navigate('StockOrderForm'));
  await press(tree, 'Create Stock Order');
  expect(textOf(tree)).toContain('Enter the supplier');
  await typeIn(tree, 'Supplier', 'ABC Traders');
  await press(tree, 'Create Stock Order');
  expect(textOf(tree)).toContain('Add at least one product');

  await act(async () => tree.root.findAll(n => n.props.placeholder === 'Search product or SKU to add…' && n.props.onChangeText)[0].props.onChangeText('rice'));
  await wait();
  await press(tree, 'Add Basmati Rice');
  await press(tree, 'Create Stock Order');
  expect(textOf(tree)).toContain('Enter a quantity for every product');
  await typeIn(tree, 'Quantity for Basmati Rice', '12');
  expect(textOf(tree)).toContain('1 product · ₹600');
  await press(tree, 'Create Stock Order');
  expect(ops.createStockOrder).toHaveBeenCalledWith('s1', expect.objectContaining({ warehouseId: 'w1', supplierName: 'ABC Traders', items: [{ productVariantId: 'v1', quantity: 12, unitCost: 50 }] }));
  expect(navigationRef.getCurrentRoute()?.name).toBe('StockOrderDetail');
  await act(async () => tree.unmount());
});

test('pending stock: list, then receive, in transit, cancel and supplier bill on an order', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('pending-stock'));
  let text = textOf(tree);
  expect(text).toContain('ABC Traders');
  expect(text).toContain('5 / 20 units received');
  expect(text).toContain('Delayed · expected');
  expect(text).toContain('"Received","4"');

  await press(tree, 'Open SO-12, ABC Traders');
  text = textOf(tree);
  expect(text).toContain('Stock Order SO-12');
  expect(text).toContain('Into Main Warehouse');
  expect(text).toContain('12 pending');

  // Receive: more than pending is refused.
  await press(tree, 'Receive Stock');
  await typeIn(tree, 'Arrived quantity for Basmati Rice', '20');
  const receiveButtons = () => tree.root.findAll(n => n.props.accessibilityRole === 'button' && n.props.onPress && n.findAll(c => c.props.children === 'Receive Stock').length);
  await act(async () => receiveButtons()[receiveButtons().length - 1].props.onPress());
  expect(textOf(tree)).toContain('Basmati Rice: only 12 is still pending');
  await press(tree, 'Everything pending arrived');
  await act(async () => receiveButtons()[receiveButtons().length - 1].props.onPress());
  expect(ops.receiveStockOrder).toHaveBeenCalledWith('s1', 'so1', expect.objectContaining({ lines: [{ itemId: 'it1', quantity: 12 }, { itemId: 'it2', quantity: 8 }] }));

  await press(tree, 'Mark In Transit');
  expect(ops.updateStockOrder).toHaveBeenCalledWith('s1', 'so1', { status: 'IN_TRANSIT' });

  await press(tree, 'Record supplier bill');
  await press(tree, 'Save Bill');
  expect(ops.createPurchaseBill).toHaveBeenCalledWith('s1', 'so1', expect.objectContaining({ baseAmount: 900, paymentType: 'CREDIT', credit: { creditTermsDays: 30 }, referenceNumber: 'PO-77' }));

  await press(tree, 'Cancel Order');
  await typeIn(tree, 'Reason (optional)', 'Supplier is out of stock');
  await press(tree, 'Cancel order');
  expect(ops.cancelStockOrder).toHaveBeenCalledWith('s1', 'so1', 'Supplier is out of stock');
  await act(async () => tree.unmount());
});

test('no access without the permissions', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  const tree = await openApp();
  await act(async () => openMenuKey('stock-health'));
  expect(textOf(tree)).toContain('No access');
  await act(async () => openMenuKey('pending-stock'));
  expect(textOf(tree)).toContain('No access');
  expect(ops.stockHealth).not.toHaveBeenCalled();
  expect(ops.stockOrders).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('stock order helpers', () => {
  const lines = [{ sku: SKUS[0], quantity: '4', unitCost: '50' }, { sku: SKUS[1], quantity: '2', unitCost: '' }];
  expect(linesTotal(lines)).toBe(200);
  const form = { warehouseId: 'w1', supplierName: 'A', supplierPhone: '', referenceNumber: '', orderDate: '2026-11-03', expectedDate: '2026-11-01', orderAmount: '', notes: '' };
  expect(stockOrderProblem(form, lines, '2026-11-03')).toBe("The expected date can't be before the order date");
  expect(stockOrderProblem({ ...form, expectedDate: '', orderDate: '2026-11-04' }, lines, '2026-11-03')).toBe("The order date can't be in the future");
  expect(stockOrderPayload({ ...form, expectedDate: '' }, lines).items).toEqual([
    { productVariantId: 'v1', quantity: 4, unitCost: 50 },
    { productVariantId: 'v2', quantity: 2, unitCost: undefined },
  ]);
  expect(receiptProblem({}, ORDER.items)).toBe('Enter what arrived for at least one product');
  expect(receiptProblem({ it2: '3' }, ORDER.items)).toBeNull();
  expect(variantLabel({ Colour: 'Red', Size: 'XL' })).toBe('Red · XL');
});
