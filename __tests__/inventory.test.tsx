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
import { stockService } from '../src/services/stock-service';
import { formatQty, moved, operationProblem, reorderQty } from '../src/lib/stock';
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

jest.mock('../src/services/products-service', () => ({
  ...jest.requireActual('../src/services/products-service'),
  warehouseService: { list: jest.fn(async () => [{ id: 'w1', facilityTitle: 'Main Warehouse', status: 1 }]) },
  inventoryService: {
    uoms: jest.fn(async () => [{ id: 'u1', code: 'PCS', name: 'Pieces', stockType: 'PIECE', factorToBase: '1', isBase: true }]),
    stockConfig: jest.fn(async () => ({ productId: 'p1', variants: [], configs: [] })),
  },
  productsService: { list: jest.fn(async () => []) },
}));

jest.mock('../src/services/stock-service', () => ({
  stockService: {
    list: jest.fn(),
    get: jest.fn(),
    ledgerPage: jest.fn(),
    reservations: jest.fn(),
    lowStock: jest.fn(),
    receive: jest.fn(async () => ({})),
    adjust: jest.fn(async () => ({})),
    block: jest.fn(async () => ({})),
    transfer: jest.fn(async () => ({})),
    returnStock: jest.fn(async () => ({})),
    setLevels: jest.fn(async () => ({})),
  },
}));

const { act } = ReactTestRenderer;
const stock = stockService as jest.Mocked<typeof stockService>;
const me = authService.me as jest.Mock;

const ROW = {
  id: 'i1',
  idd: 'INV-1',
  productId: 'p1',
  productName: 'Basmati Rice',
  productVariantId: 'v1',
  sku: 'RICE5',
  variantLabel: '5 kg',
  warehouseId: 'w1',
  warehouseTitle: 'Main Warehouse',
  stockType: 'PIECE',
  baseUom: 'PCS',
  salesUom: 'PCS',
  salesFactor: 1,
  tracksLots: false,
  trackExpiry: false,
  trackBatch: false,
  trackLot: false,
  onHand: 12,
  reserved: 4,
  blocked: 1,
  available: 7,
  minimum: 10,
  maximum: null,
  reorder: 20,
  stockStatus: 'LOW_STOCK',
  updatedAt: '2026-11-03T08:00:00Z',
  imageUrl: null,
  categoryId: 'c1',
  categoryName: 'Groceries',
  costPrice: 50,
  suggestedReorder: null,
};
const SECOND = { ...ROW, id: 'i2', productName: 'Sugar', sku: 'SUG1', reserved: 0, blocked: 0, available: 30, onHand: 30, stockStatus: 'ACTIVE' };

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['product-inventory:manage', 'orders:manage'] });
  stock.list.mockResolvedValue([ROW, SECOND] as never);
  stock.lowStock.mockResolvedValue([ROW] as never);
  stock.reservations.mockResolvedValue([
    {
      id: 'r1',
      idd: 'RES-1',
      inventoryId: 'i1',
      orderId: 'o1',
      orderNumber: 'ORD-77',
      reservedQty: 4,
      uom: 'PCS',
      baseReservedQty: 4,
      baseUom: 'PCS',
      status: 'RESERVED',
      reservedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      fulfilledAt: null,
      releasedAt: null,
      cancelledAt: null,
      productName: 'Basmati Rice',
      warehouseId: 'w1',
      orderStatus: 'PACKED',
      customerName: 'Asha Rao',
      value: 1200,
      sku: 'RICE5',
      warehouseTitle: 'Main Warehouse',
    },
  ] as never);
  stock.ledgerPage.mockResolvedValue({
    summary: { movements: { value: 8, previous: 4 }, received: { value: 30, previous: 30 }, sold: { value: 5, previous: 0 }, adjusted: { value: 1, previous: 2 } },
    items: [
      {
        id: 'l1',
        type: 'PURCHASE_RECEIPT',
        referenceId: 'PO-9',
        enteredQuantity: 30,
        enteredUom: 'PCS',
        baseQuantity: 30,
        onHandDelta: 30,
        reservedDelta: 0,
        blockedDelta: 0,
        onHandAfter: 42,
        reservedAfter: 4,
        blockedAfter: 1,
        reason: null,
        notes: null,
        createdAt: '2026-11-03T09:00:00Z',
        performedBy: 'Rajendra',
        inventoryId: 'i1',
        orderId: null,
        orderNumber: null,
        productId: 'p1',
        productName: 'Basmati Rice',
        sku: 'RICE5',
        variantLabel: '5 kg',
        warehouseTitle: 'Main Warehouse',
        imageUrl: null,
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  } as never);
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

/** The last pressable with this exact text (a sheet's, over the screen's own). */
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

test('stock: figures, filters, receive and count with the panel checks', async () => {
  const tree = await openModule('inventory-stock');
  let text = textOf(tree);
  expect(text).toContain('Basmati Rice');
  expect(text).toContain('Sugar');
  expect(text).toContain('"Total Stock Records"');

  // Switches have no text child: flip it through its handler.
  const toggle = tree.root.findAll(n => n.props.accessibilityLabel === 'Only with blocked stock' && n.props.onValueChange)[0];
  await act(async () => toggle.props.onValueChange(true));
  text = textOf(tree);
  expect(text).toContain('Basmati Rice');
  expect(text).not.toContain('Sugar');

  await press(tree, 'Receive Basmati Rice');
  await press(tree, 'Save');
  expect(textOf(tree)).toContain('Enter a quantity');
  await act(async () => field(tree, 'Quantity').props.onChangeText('25'));
  await press(tree, 'Save');
  expect(stock.receive).toHaveBeenCalledWith(expect.objectContaining({ productVariantId: 'v1', warehouseId: 'w1', quantity: 25, type: 'PURCHASE_RECEIPT', idempotencyKey: expect.any(String) }));

  await press(tree, 'More for Basmati Rice');
  await pressLast(tree, 'Count / Adjust');
  await act(async () => field(tree, 'Quantity').props.onChangeText('0'));
  await press(tree, 'Save');
  expect(textOf(tree)).toContain("Enter a reason — it's kept in the ledger");
  await act(async () => field(tree, 'Reason').props.onChangeText('Physical stock count'));
  await press(tree, 'Save');
  // A count of zero is allowed.
  expect(stock.adjust).toHaveBeenCalledWith('i1', expect.objectContaining({ mode: 'COUNT', quantity: 0, reason: 'Physical stock count' }));
  await act(async () => tree.unmount());
});

test('ledger, reservations and low stock each open from the menu', async () => {
  const tree = await openModule('inventory-ledger');
  let text = textOf(tree);
  expect(text).toContain('Purchase Receipt');
  expect(text).toContain('+30');
  expect(text).toContain('↑ 100% this month');
  expect(stock.ledgerPage).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, from: expect.any(String), to: expect.any(String) }));

  await act(async () => openMenuKey('inventory-reservations'));
  text = textOf(tree);
  expect(text).toContain('ORD-77 · Asha Rao');
  expect(text).toContain('Held for 5 days');
  expect(text).toContain('₹1.20K');

  await act(async () => openMenuKey('inventory-low-stock'));
  text = textOf(tree);
  // Reorder to minimum: 10 − 7 = 3 PCS, at ₹50 each.
  expect(text).toContain('3 PCS');
  expect(text).toContain('₹150');

  await press(tree, 'Set stock levels for Basmati Rice');
  await act(async () => field(tree, 'Minimum').props.onChangeText('10'));
  await act(async () => field(tree, 'Maximum').props.onChangeText('5'));
  await press(tree, 'Save');
  expect(textOf(tree)).toContain("The maximum can't be below the minimum");
  expect(stock.setLevels).not.toHaveBeenCalled();
  await act(async () => field(tree, 'Maximum').props.onChangeText('50'));
  await press(tree, 'Save');
  expect(stock.setLevels).toHaveBeenCalledWith('i1', { minimum: 10, maximum: 50, reorder: 20, uom: 'PCS' });
  await act(async () => tree.unmount());
});

test('inventory is blocked without product-inventory:manage', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'R', userType: 'SELLER_USER', permissions: ['orders:manage'] });
  const tree = await openModule('inventory-stock');
  expect(textOf(tree)).toContain('No access');
  expect(stock.list).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('stock rules match the panel', () => {
  expect(operationProblem('adjust', { quantity: '', mode: 'COUNT', reason: 'x' })).toBe('Enter a quantity');
  expect(operationProblem('adjust', { quantity: '0', mode: 'IN', reason: 'x' })).toBe('Enter a quantity');
  expect(operationProblem('block', { quantity: '2', mode: '', reason: ' ' })).toBe("Enter a reason — it's kept in the ledger");
  expect(operationProblem('transfer', { quantity: '2', mode: '', reason: '' })).toBe('Pick the warehouse to transfer to');
  expect(operationProblem('receive', { quantity: '2', mode: '', reason: '', variantId: 'v', warehouseId: '' })).toBe('Pick the SKU and the warehouse');
  expect(operationProblem('transfer', { quantity: '2', mode: '', reason: '', toWarehouseId: 'w2' })).toBeNull();

  const kg = { baseUom: 'GM', salesUom: 'KG', salesFactor: 1000 };
  expect(formatQty(35000, kg)).toBe('35 KG');
  expect(formatQty(12, { baseUom: 'PCS', salesUom: 'PCS', salesFactor: 1 })).toBe('12 PCS');
  expect(moved({ enteredQuantity: 5, baseQuantity: 5, onHandDelta: -5, reservedDelta: 0, blockedDelta: 0 })).toBe(-5);
  expect(reorderQty({ ...ROW, suggestedReorder: 8 } as never)).toBe(8);
  expect(reorderQty({ ...ROW, available: 15 } as never)).toBe(0);
});
