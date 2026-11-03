/**
 * @format
 */

import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { navigationRef } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { storeService } from '../src/services/store-service';
import { storeManageService } from '../src/services/store-manage-service';
import { buildTree, pathOf, productCounts, searchCategories, selectionCounts, setChecked } from '../src/lib/store-categories';
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

const CATEGORIES = [
  { id: 'm1', categoryTitle: 'Grocery', categoryType: 'MAIN_CATEGORY', parentCategoryId: null, sequence: 1 },
  { id: 'm2', categoryTitle: 'Bakery', categoryType: 'MAIN_CATEGORY', parentCategoryId: null, sequence: 2 },
  { id: 's1', categoryTitle: 'Rice & Grains', categoryType: 'SUB_CATEGORY', parentCategoryId: 'm1', sequence: 1, tags: ['staples'] },
  { id: 's2', categoryTitle: 'Oils', categoryType: 'SUB_CATEGORY', parentCategoryId: 'm1', sequence: 2 },
  { id: 'c1', categoryTitle: 'Basmati', categoryType: 'CHILD_CATEGORY', parentCategoryId: 's1', sequence: 1 },
  { id: 'c2', categoryTitle: 'Brown Rice', categoryType: 'CHILD_CATEGORY', parentCategoryId: 's1', sequence: 2 },
  { id: 'x1', categoryTitle: 'Gone', categoryType: 'MAIN_CATEGORY', parentCategoryId: null, isDeleted: true },
];

jest.mock('../src/services/products-service', () => ({
  ...jest.requireActual('../src/services/products-service'),
  categoryService: { list: jest.fn(async () => CATEGORIES) },
  productsService: { list: jest.fn(async () => [{ id: 'p1', categoryId: 'c1' }, { id: 'p2', categoryId: 'c1' }, { id: 'p3', categoryId: 's2' }]) },
}));

jest.mock('../src/services/store-manage-service', () => ({
  storeManageService: {
    get: jest.fn(),
    approvalHistory: jest.fn(async () => []),
    documentRequirements: jest.fn(async () => []),
    categories: jest.fn(),
    syncCategories: jest.fn(async () => ({})),
    setCategoryStatus: jest.fn(async () => ({})),
    resubmitCategory: jest.fn(async () => ({})),
  },
}));

const { act } = ReactTestRenderer;
const manage = storeManageService as jest.Mocked<typeof storeManageService>;
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
  businessCategory: 'Grocery & Fresh Food',
  createdAt: '2026-09-30T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
  documents: [],
  businessHours: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['stores:view', 'stores:edit', 'store-categories:manage', 'products-master:manage'] });
  (storeService.list as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Green Basket', code: 'GB01', status: 'ACTIVE' }]);
  manage.get.mockResolvedValue(STORE as never);
  manage.categories.mockResolvedValue([
    { id: 'map1', categoryId: 'm1', status: 'active', approvalStatus: 'approved', category: { categoryTitle: 'Grocery' } },
    { id: 'map2', categoryId: 's1', status: 'active', approvalStatus: 'pending', category: { categoryTitle: 'Rice & Grains' } },
    { id: 'map3', categoryId: 'c1', status: 'active', approvalStatus: 'approved', category: { categoryTitle: 'Basmati' } },
    { id: 'map4', categoryId: 's2', status: 'inactive', approvalStatus: 'rejected', approvalRemarks: 'Not a grocery store', category: { categoryTitle: 'Oils' } },
  ]);
});

async function openCategories() {
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
  await act(async () => navigationRef.navigate('StoreSettings', { tab: 'categories' }));
  return tree;
}

test('categories tab: mapped tree, approvals, status switch, map and save', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  const tree = await openCategories();
  expect(manage.categories).toHaveBeenCalledWith('s1');
  let text = textOf(tree);
  expect(text).toContain('Associated Categories');
  expect(text).toContain('"Main Categories","1"');
  expect(text).toContain('"Sub Categories","2"');
  expect(text).toContain('1 category is awaiting approval.');
  expect(text).toContain('Oils was rejected.');
  expect(text).toContain(' Reason: Not a grocery store');
  // Grocery: Basmati ×2 + Oils ×1.
  expect(text).toContain('3 products');
  expect(text).toContain('Inactive in this store');

  await press(tree, 'Request again');
  expect(manage.resubmitCategory).toHaveBeenCalledWith('s1', 'map4');
  const sw = tree.root.findAll(n => n.props.accessibilityLabel === 'Grocery active in this store' && n.props.onValueChange)[0];
  await act(async () => sw.props.onValueChange(false));
  expect(manage.setCategoryStatus).toHaveBeenCalledWith('s1', 'map1', 'inactive');

  // Map: open Grocery › Rice & Grains, tick Brown Rice, untick Oils.
  await press(tree, 'Map Categories');
  expect(textOf(tree)).toContain('Select Main Categories');
  await press(tree, 'Open Grocery');
  expect(textOf(tree)).toContain('Select Sub Categories');
  await press(tree, 'Open Rice & Grains');
  text = textOf(tree);
  expect(text).toContain('Grocery › Rice & Grains');
  await press(tree, 'Select Brown Rice');
  // The picker's Back (the header has one too).
  const backs = tree.root.findAll(n => n.props.accessibilityLabel === 'Back' && n.props.onPress);
  await act(async () => backs[backs.length - 1].props.onPress());
  const oils = tree.root.findAll(n => n.props.accessibilityRole === 'checkbox' && n.props.accessibilityLabel === 'Select Oils')[0];
  await act(async () => oils.props.onPress());
  expect(textOf(tree)).toContain('1 Main • 1 Sub • 2 Child Categories Selected');
  await press(tree, 'Save & Request Approval');
  expect(alert).toHaveBeenCalledWith('Remove 1 category from Green Basket?', 'Oils', expect.anything());
  expect(manage.syncCategories).toHaveBeenCalledWith('s1', expect.arrayContaining(['m1', 's1', 'c1', 'c2']));
  expect((manage.syncCategories.mock.calls[0][1] as string[]).length).toBe(4);
  alert.mockRestore();
  await act(async () => tree.unmount());
});

test('search finds categories at any level, with their path', async () => {
  const tree = await openCategories();
  await press(tree, 'Map Categories');
  await act(async () => tree.root.findAll(n => n.props.placeholder?.startsWith?.('Search categories') && n.props.onChangeText)[0].props.onChangeText('staples'));
  const text = textOf(tree);
  expect(text).toContain('Rice & Grains');
  expect(text).toContain('Grocery › Rice & Grains');
  expect(text).not.toContain('Bakery');
  await act(async () => tree.unmount());
});

test('no Categories tab without store-categories:manage', async () => {
  me.mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['stores:view'] });
  const tree = await openCategories();
  const text = textOf(tree);
  expect(text).not.toContain('Associated Categories');
  expect(text).not.toContain('"Categories"');
  expect(manage.categories).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('category helpers match the panel', () => {
  const t = buildTree(CATEGORIES);
  expect(t.mains.map(m => m.id)).toEqual(['m1', 'm2']);
  // Ticking a child ticks its parents; unticking a main unticks everything under it.
  const on = setChecked(t, new Set(), ['c2'], true);
  expect([...on].sort()).toEqual(['c2', 'm1', 's1']);
  expect([...setChecked(t, on, ['m1'], false)]).toEqual([]);
  expect(selectionCounts(t, on)).toEqual({ main: 1, sub: 1, child: 1 });
  expect(pathOf(t, 'c1')).toBe('Grocery › Rice & Grains › Basmati');
  expect(searchCategories(t, 'rice').map(c => c.id)).toEqual(['s1', 'c2']);
  const counts = productCounts(t, [{ categoryId: 'c1' }, { categoryId: 'c2' }]);
  expect(counts.get('m1')).toBe(2);
  expect(counts.get('c1')).toBe(1);
});
