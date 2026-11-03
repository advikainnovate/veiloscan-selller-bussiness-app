import { createNavigationContainerRef } from '@react-navigation/native';
import type { InventoryTab, RootStackParamList } from './types';
import { MENU_ITEMS } from './menu';

// The drawer sits beside the navigator, not inside it, so it navigates through this ref.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Menu pages that have their own screen (the rest open the "coming soon" module page).
type ModuleRoute = 'OrderRequests' | 'CustomerCredit' | 'Coupons' | 'AllStores' | 'BusinessOverview' | 'DailyBusiness' | 'Expenses' | 'Notes' | 'QuantitySlabs' | 'Profile' | 'Warehouses' | 'BrandApprovals' | 'ProductVariants' | 'BusinessVariants' | 'ProductSpecs';
const MODULE_ROUTES: Partial<Record<string, ModuleRoute>> = {
  'order-requests': 'OrderRequests',
  'customer-credit': 'CustomerCredit',
  coupons: 'Coupons',
  'all-stores': 'AllStores',
  'business-overview': 'BusinessOverview',
  'daily-business': 'DailyBusiness',
  expenses: 'Expenses',
  notes: 'Notes',
  'quantity-slabs': 'QuantitySlabs',
  profile: 'Profile',
  warehouses: 'Warehouses',
  'brand-approvals': 'BrandApprovals',
  'product-variants': 'ProductVariants',
  'business-variants': 'BusinessVariants',
  'product-specs': 'ProductSpecs',
};

// Inventory's menu children: one screen, one tab each.
export const INVENTORY_TAB_KEYS: Record<InventoryTab, string> = {
  stock: 'inventory-stock',
  ledger: 'inventory-ledger',
  reservations: 'inventory-reservations',
  low: 'inventory-low-stock',
};
const INVENTORY_KEY_TABS = Object.fromEntries(Object.entries(INVENTORY_TAB_KEYS).map(([tab, key]) => [key, tab as InventoryTab]));

/** The menu key a screen belongs to, for highlighting it in the drawer. */
export const ROUTE_MENU_KEYS: Partial<Record<keyof RootStackParamList, string>> = {
  OrderDetail: 'orders',
  CreateOrder: 'orders',
  OrderRequests: 'order-requests',
  OrderRequestDetail: 'order-requests',
  CustomerCredit: 'customer-credit',
  CreditDetail: 'customer-credit',
  Coupons: 'coupons',
  CouponDetail: 'coupons',
  CouponForm: 'coupons',
  AllStores: 'all-stores',
  BusinessOverview: 'business-overview',
  DailyBusiness: 'daily-business',
  Expenses: 'expenses',
  ExpenseDetail: 'expenses',
  ExpenseForm: 'expenses',
  SupplierLedger: 'expenses',
  Notes: 'notes',
  StockDetail: 'inventory-stock',
  Stores: 'store-settings',
  QuantitySlabs: 'quantity-slabs',
  Profile: 'profile',
  Warehouses: 'warehouses',
  WarehouseDetail: 'warehouses',
  WarehouseForm: 'warehouses',
  BrandApprovals: 'brand-approvals',
  BrandRequestDetail: 'brand-approvals',
  BrandRequestForm: 'brand-approvals',
  ProductVariants: 'product-variants',
  ProductVariantForm: 'product-variants',
  BusinessVariants: 'business-variants',
  BusinessVariantForm: 'business-variants',
  ProductSpecs: 'product-specs',
  ProductSpecDetail: 'product-specs',
  ProductSpecForm: 'product-specs',
  QuantitySlabForm: 'quantity-slabs',
  CreateStore: 'store-settings',
  ProductDetail: 'products',
  ProductEditor: 'products',
};

/** Opens a menu page: its bottom tab, its own screen, or its module page. */
export function openMenuKey(key: string) {
  if (!navigationRef.isReady()) return;
  const tab = MENU_ITEMS.find(item => item.key === key)?.tab;
  const route = MODULE_ROUTES[key];
  const inventoryTab = INVENTORY_KEY_TABS[key];
  if (inventoryTab) navigationRef.navigate('Inventory', { tab: inventoryTab });
  else if (key === 'store-settings' || key === 'store-qr-tag') navigationRef.navigate('StoreSettings', { tab: key === 'store-qr-tag' ? 'qr-tag' : 'overview' });
  else if (tab) navigationRef.navigate('Main', { screen: tab });
  else if (route) navigationRef.navigate(route);
  else navigationRef.navigate('Module', { key });
}
