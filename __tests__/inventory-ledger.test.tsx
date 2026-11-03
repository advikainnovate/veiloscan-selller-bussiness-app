/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { navigationRef, openMenuKey } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { inventoryLedgerService, type LedgerRow } from '../src/services/inventory-ledger-service';
import { direction, filterLedger, referenceLabel } from '../src/lib/inventory-ledger';
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

jest.mock('../src/services/inventory-ledger-service', () => ({ inventoryLedgerService: { list: jest.fn(async () => []) } }));
// The stock record an entry links to: never a real request (a 401 would sign the next test out).
jest.mock('../src/services/stock-service', () => ({
  ...jest.requireActual('../src/services/stock-service'),
  stockService: { get: jest.fn(() => new Promise(() => {})) },
}));

const { act } = ReactTestRenderer;
const list = inventoryLedgerService.list as jest.Mock;
const me = authService.me as jest.Mock;

const base = {
  referenceId: null,
  referenceType: null,
  enteredUom: 'PCS',
  baseUom: 'PCS',
  reservedDelta: 0,
  blockedDelta: 0,
  reservedAfter: 0,
  blockedAfter: 0,
  reason: null,
  notes: null,
  performedBy: null,
  inventoryId: 'inv1',
  orderId: null,
  unitCost: null,
  totalCost: null,
  lotNumber: null,
  batchNumber: null,
  warehouseTitle: 'Main Store',
} as const;
const ROWS: LedgerRow[] = [
  { ...base, id: 't1', type: 'PURCHASE_RECEIPT', enteredQuantity: 50, baseQuantity: 50, onHandDelta: 50, onHandAfter: 80, productName: 'Basmati Rice 5kg', sku: 'RICE-5', referenceType: 'PURCHASE_ORDER', referenceId: 'PO-12', totalCost: 12500, unitCost: 250, lotNumber: 'L-7', performedBy: 'Rajendra', createdAt: '2026-10-30T10:00:00Z' },
  { ...base, id: 't2', type: 'SALE', enteredQuantity: 2, baseQuantity: 2, onHandDelta: -2, onHandAfter: 78, productName: 'Basmati Rice 5kg', sku: 'RICE-5', orderId: 'o1', createdAt: '2026-10-31T10:00:00Z' },
  { ...base, id: 't3', type: 'RESERVATION', enteredQuantity: 3, baseQuantity: 3, onHandDelta: 0, reservedDelta: 3, onHandAfter: 78, reservedAfter: 3, productName: 'Sunflower Oil 1L', sku: 'OIL-1', warehouseTitle: 'Back Godown', createdAt: '2026-11-01T10:00:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['inventory-transactions:manage', 'product-inventory:manage', 'orders:manage'] });
  list.mockResolvedValue(ROWS);
});

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

test('the ledger: figures, cards, the direction filter and search', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('inventory-transactions'));
  let text = textOf(tree);
  expect(text).toContain('Basmati Rice 5kg');
  expect(text).toContain('RICE-5 · Main Store');
  expect(text).toContain('Purchase Receipt');
  expect(text).toContain('+50');
  expect(text).toContain('−2');
  expect(text).toContain('On hand 80');

  await press(tree, 'Holds: 1');
  text = textOf(tree);
  expect(text).toContain('Sunflower Oil 1L');
  expect(text).not.toContain('Basmati Rice 5kg');
  await press(tree, 'Holds: 1');

  const search = tree.root.findAll(n => n.props.placeholder === 'Search product, SKU, reference…' && n.props.onChangeText)[0];
  await act(async () => search.props.onChangeText('PO-12'));
  text = textOf(tree);
  expect(text).toContain('Purchase Receipt');
  expect(text).not.toContain('Sale (Fulfilled)');
  await act(async () => tree.unmount());
});

test('an entry: changes, cost, lot and reference, then its stock record', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('inventory-transactions'));
  await press(tree, 'Open Purchase Receipt for Basmati Rice 5kg');
  const text = textOf(tree);
  expect(text).toContain('"On hand","+50"');
  expect(text).toContain('→ 80');
  expect(text).toContain('₹12,500');
  expect(text).toContain('L-7');
  expect(text).toContain('purchase order: PO-12');
  expect(text).toContain('Rajendra');
  await press(tree, 'Open stock record');
  expect(navigationRef.getCurrentRoute()?.name).toBe('StockDetail');
  await act(async () => tree.unmount());
});

test('no access without inventory-transactions:manage', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  const tree = await openApp();
  await act(async () => navigationRef.navigate('InventoryLedger'));
  expect(textOf(tree)).toContain('No access');
  expect(list).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('ledger helpers', () => {
  expect(direction(ROWS[0])).toBe('in');
  expect(direction(ROWS[1])).toBe('out');
  expect(direction(ROWS[2])).toBe('hold');
  expect(direction({ type: 'SALE', onHandDelta: null, reservedDelta: null, blockedDelta: null, legacyQuantity: 4 })).toBe('out');
  expect(filterLedger(ROWS, { search: '', direction: '', type: '', warehouse: 'Back Godown' }).map(e => e.id)).toEqual(['t3']);
  expect(filterLedger(ROWS, { search: 'oil', direction: '', type: 'SALE', warehouse: '' })).toEqual([]);
  expect(referenceLabel(ROWS[1])).toBeNull();
});
