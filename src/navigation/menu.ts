import type { ComponentType } from 'react';
import {
  AwardIcon,
  BarChartIcon,
  BoxIcon,
  BuildingIcon,
  CalendarIcon,
  ChartTrendIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  GiftIcon,
  HelpCircleIcon,
  HomeIcon,
  LayersIcon,
  PercentIcon,
  QrCodeIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SlidersIcon,
  TicketIcon,
  TruckIcon,
  UserIcon,
  BellIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
  type IconProps,
} from '../components/icons';
import type { TabParamList } from './types';

export interface MenuChild {
  key: string;
  label: string;
  /** Overrides the parent's permission. */
  permission?: string;
}

export interface MenuItem {
  key: string;
  label: string;
  icon: ComponentType<IconProps>;
  section: string;
  /** Required to see and open it; omitted for pages every seller user can reach. */
  permission?: string;
  /** Opens this bottom tab instead of a module page. */
  tab?: keyof TabParamList;
  children?: MenuChild[];
  /** Shown with a lock when the seller's plan doesn't include it; the page still opens and explains the upgrade. */
  feature?: 'consolidatedDashboard';
}

// The Seller Panel's sidebar (src/components/dashboard/sidebar.tsx), without the
// pages only platform admins can open — sellers never hold those permissions.
export const MENU_ITEMS: MenuItem[] = [
  { key: 'overview', label: 'Overview', icon: HomeIcon, section: 'main', tab: 'Home' },

  { key: 'orders', label: 'Orders', icon: ShoppingBagIcon, section: 'sales', permission: 'orders:manage', tab: 'Orders' },
  { key: 'order-requests', label: 'Order Requests', icon: ClipboardListIcon, section: 'sales', permission: 'orders:manage' },
  { key: 'customers', label: 'Customers', icon: UsersIcon, section: 'sales', permission: 'customers:manage', tab: 'Customers' },
  { key: 'customer-credit', label: 'Customer Credit', icon: WalletIcon, section: 'sales', permission: 'customer-credit:manage' },
  { key: 'coupons', label: 'Coupons', icon: TicketIcon, section: 'sales', permission: 'coupons-master:manage' },
  { key: 'freebies', label: 'Freebies', icon: GiftIcon, section: 'sales', permission: 'freebie-master:manage' },
  { key: 'gift-cards', label: 'Gift Cards', icon: CreditCardIcon, section: 'sales', permission: 'gift-cards:manage' },
  { key: 'promotions', label: 'Promotions', icon: PercentIcon, section: 'sales', permission: 'my-promotions:manage' },
  { key: 'shipping', label: 'Shipping', icon: TruckIcon, section: 'sales', permission: 'shipping:manage' },

  { key: 'support-tickets', label: 'Support Tickets', icon: HelpCircleIcon, section: 'crm', permission: 'support-tickets:view' },
  { key: 'support-dashboard', label: 'Support Dashboard', icon: BarChartIcon, section: 'crm', permission: 'support-reports:view' },

  { key: 'products', label: 'Products', icon: BoxIcon, section: 'catalog', permission: 'products-master:manage', tab: 'Products' },
  {
    key: 'pricing-discounts',
    label: 'Pricing & Discounts',
    icon: PercentIcon,
    section: 'catalog',
    permission: 'quantity-discounts:manage',
    children: [{ key: 'quantity-slabs', label: 'Quantity Discount Slabs' }],
  },
  { key: 'brand-approvals', label: 'Brand Approvals', icon: ShieldCheckIcon, section: 'catalog', permission: 'products-master:manage' },
  { key: 'product-variants', label: 'Product Variants', icon: LayersIcon, section: 'catalog', permission: 'product-variants:manage' },
  { key: 'business-variants', label: 'Business Variants', icon: LayersIcon, section: 'catalog', permission: 'product-business-variants:manage' },
  { key: 'product-specs', label: 'Product Specs', icon: SlidersIcon, section: 'catalog', permission: 'product-specifications:manage' },
  { key: 'inventory-transactions', label: 'Inventory Ledger', icon: ClipboardListIcon, section: 'catalog', permission: 'inventory-transactions:manage' },
  { key: 'warehouses', label: 'Warehouses', icon: WarehouseIcon, section: 'catalog', permission: 'warehouse-master:manage' },

  {
    key: 'inventory',
    label: 'Inventory',
    icon: WarehouseIcon,
    section: 'inventory',
    permission: 'product-inventory:manage',
    children: [
      { key: 'inventory-stock', label: 'Stock' },
      { key: 'inventory-ledger', label: 'Ledger' },
      { key: 'inventory-reservations', label: 'Reservations' },
      { key: 'inventory-low-stock', label: 'Low Stock' },
    ],
  },
  { key: 'stock-health', label: 'Stock Health', icon: BoxIcon, section: 'inventory', permission: 'store-operations:manage' },
  { key: 'pending-stock', label: 'Pending Stock', icon: TruckIcon, section: 'inventory', permission: 'pending-stock:manage' },

  { key: 'all-stores', label: 'All Stores', icon: BuildingIcon, section: 'operations', permission: 'store-operations:manage', feature: 'consolidatedDashboard' },
  { key: 'business-overview', label: 'Business Overview', icon: ChartTrendIcon, section: 'operations', permission: 'store-operations:manage' },
  { key: 'daily-business', label: 'Daily Business', icon: CalendarIcon, section: 'operations', permission: 'store-operations:manage' },
  { key: 'expenses', label: 'Expenses', icon: WalletIcon, section: 'operations', permission: 'store-expenses:view' },
  { key: 'notes', label: 'Notes', icon: FileTextIcon, section: 'operations', permission: 'store-notes:view' },

  { key: 'sales-reports', label: 'Sales Reports', icon: BarChartIcon, section: 'reports', permission: 'store-operations:manage', tab: 'Reports' },

  { key: 'users', label: 'Users', icon: UsersIcon, section: 'management', permission: 'users:view' },

  { key: 'store-settings', label: 'Store Settings', icon: SettingsIcon, section: 'settings', permission: 'stores:view' },
  { key: 'store-qr-tag', label: 'Store QR Tag', icon: QrCodeIcon, section: 'settings', permission: 'stores:view' },
  // No permission: the plan a seller is on is theirs and their staff's to read.
  { key: 'subscription', label: 'Subscription', icon: AwardIcon, section: 'settings' },
];

export const MENU_SECTIONS = [
  { key: 'main', label: '' },
  { key: 'sales', label: 'Sales' },
  { key: 'catalog', label: 'Catalog' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'operations', label: 'Operations' },
  { key: 'reports', label: 'Reports' },
  { key: 'management', label: 'Management' },
  { key: 'crm', label: 'CRM' },
  { key: 'settings', label: 'Settings' },
];

// Pages reached from the header rather than the menu.
const HEADER_PAGES: MenuItem[] = [
  { key: 'profile', label: 'My Profile', icon: UserIcon, section: 'account' },
  { key: 'notifications', label: 'Notifications', icon: BellIcon, section: 'account' },
];

export interface ModuleInfo {
  label: string;
  icon: ComponentType<IconProps>;
  permission?: string;
  /** The menu item it belongs to, for highlighting (a child's parent). */
  parentKey: string;
}

/** Every page a key can open: menu items, their children and header pages. */
export function findModule(key: string): ModuleInfo | null {
  for (const item of [...MENU_ITEMS, ...HEADER_PAGES]) {
    if (item.key === key) return { label: item.label, icon: item.icon, permission: item.permission, parentKey: item.key };
    const child = item.children?.find(c => c.key === key);
    if (child) {
      return { label: child.label, icon: item.icon, permission: child.permission ?? item.permission, parentKey: item.key };
    }
  }
  return null;
}

export function menuKeyForTab(tab: keyof TabParamList) {
  return MENU_ITEMS.find(item => item.tab === tab)?.key ?? null;
}
