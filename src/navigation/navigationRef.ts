import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { MENU_ITEMS } from './menu';

// The drawer sits beside the navigator, not inside it, so it navigates through this ref.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Menu pages that have their own screen (the rest open the "coming soon" module page).
const MODULE_ROUTES: Partial<Record<string, 'OrderRequests' | 'CustomerCredit' | 'Coupons'>> = {
  'order-requests': 'OrderRequests',
  'customer-credit': 'CustomerCredit',
  coupons: 'Coupons',
};

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
  ProductDetail: 'products',
  ProductEditor: 'products',
};

/** Opens a menu page: its bottom tab, its own screen, or its module page. */
export function openMenuKey(key: string) {
  if (!navigationRef.isReady()) return;
  const tab = MENU_ITEMS.find(item => item.key === key)?.tab;
  const route = MODULE_ROUTES[key];
  if (tab) navigationRef.navigate('Main', { screen: tab });
  else if (route) navigationRef.navigate(route);
  else navigationRef.navigate('Module', { key });
}
