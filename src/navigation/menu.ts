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
  GlobeIcon,
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
import i18n from '../i18n';

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
  { key: 'overview', get label() { return i18n.t('common.overview'); }, icon: HomeIcon, section: 'main', tab: 'Home' },

  { key: 'orders', get label() { return i18n.t('common.orders'); }, icon: ShoppingBagIcon, section: 'sales', permission: 'orders:manage', tab: 'Orders' },
  { key: 'order-requests', get label() { return i18n.t('common.orderRequests'); }, icon: ClipboardListIcon, section: 'sales', permission: 'orders:manage' },
  { key: 'customers', get label() { return i18n.t('common.customers'); }, icon: UsersIcon, section: 'sales', permission: 'customers:manage', tab: 'Customers' },
  { key: 'customer-credit', get label() { return i18n.t('common.customerCredit'); }, icon: WalletIcon, section: 'sales', permission: 'customer-credit:manage' },
  { key: 'coupons', get label() { return i18n.t('nav.coupons'); }, icon: TicketIcon, section: 'sales', permission: 'coupons-master:manage' },
  { key: 'freebies', get label() { return i18n.t('common.freebies'); }, icon: GiftIcon, section: 'sales', permission: 'freebie-master:manage' },
  { key: 'gift-cards', get label() { return i18n.t('common.giftCards'); }, icon: CreditCardIcon, section: 'sales', permission: 'gift-cards:manage' },
  { key: 'promotions', get label() { return i18n.t('common.promotions'); }, icon: PercentIcon, section: 'sales', permission: 'my-promotions:manage' },
  { key: 'shipping', get label() { return i18n.t('nav.shipping'); }, icon: TruckIcon, section: 'sales', permission: 'shipping:manage' },

  { key: 'support-tickets', get label() { return i18n.t('common.supportTickets'); }, icon: HelpCircleIcon, section: 'crm', permission: 'support-tickets:view' },
  { key: 'support-dashboard', get label() { return i18n.t('common.supportDashboard'); }, icon: BarChartIcon, section: 'crm', permission: 'support-reports:view' },

  { key: 'products', get label() { return i18n.t('common.products'); }, icon: BoxIcon, section: 'catalog', permission: 'products-master:manage', tab: 'Products' },
  {
    key: 'pricing-discounts',
    get label() { return i18n.t('common.pricingAndDiscounts'); },
    icon: PercentIcon,
    section: 'catalog',
    permission: 'quantity-discounts:manage',
    children: [{ key: 'quantity-slabs', get label() { return i18n.t('common.quantityDiscountSlabs'); } }],
  },
  { key: 'brand-approvals', get label() { return i18n.t('common.brandApprovals'); }, icon: ShieldCheckIcon, section: 'catalog', permission: 'products-master:manage' },
  { key: 'product-variants', get label() { return i18n.t('common.productVariants'); }, icon: LayersIcon, section: 'catalog', permission: 'product-variants:manage' },
  { key: 'business-variants', get label() { return i18n.t('common.businessVariants'); }, icon: LayersIcon, section: 'catalog', permission: 'product-business-variants:manage' },
  { key: 'product-specs', get label() { return i18n.t('common.productSpecs'); }, icon: SlidersIcon, section: 'catalog', permission: 'product-specifications:manage' },
  { key: 'inventory-transactions', get label() { return i18n.t('common.inventoryLedger'); }, icon: ClipboardListIcon, section: 'catalog', permission: 'inventory-transactions:manage' },
  { key: 'warehouses', get label() { return i18n.t('nav.warehouses'); }, icon: WarehouseIcon, section: 'catalog', permission: 'warehouse-master:manage' },

  {
    key: 'inventory',
    get label() { return i18n.t('common.inventory'); },
    icon: WarehouseIcon,
    section: 'inventory',
    permission: 'product-inventory:manage',
    children: [
      { key: 'inventory-stock', get label() { return i18n.t('common.stock'); } },
      { key: 'inventory-ledger', get label() { return i18n.t('common.ledger'); } },
      { key: 'inventory-reservations', get label() { return i18n.t('common.reservations'); } },
      { key: 'inventory-low-stock', get label() { return i18n.t('common.lowStock'); } },
    ],
  },
  { key: 'stock-health', get label() { return i18n.t('common.stockHealth'); }, icon: BoxIcon, section: 'inventory', permission: 'store-operations:manage' },
  { key: 'pending-stock', get label() { return i18n.t('common.pendingStock'); }, icon: TruckIcon, section: 'inventory', permission: 'pending-stock:manage' },

  { key: 'all-stores', get label() { return i18n.t('common.allStores'); }, icon: BuildingIcon, section: 'operations', permission: 'store-operations:manage', feature: 'consolidatedDashboard' },
  { key: 'business-overview', get label() { return i18n.t('common.businessOverview'); }, icon: ChartTrendIcon, section: 'operations', permission: 'store-operations:manage' },
  { key: 'daily-business', get label() { return i18n.t('common.dailyBusiness'); }, icon: CalendarIcon, section: 'operations', permission: 'store-operations:manage' },
  { key: 'expenses', get label() { return i18n.t('common.expenses'); }, icon: WalletIcon, section: 'operations', permission: 'store-expenses:view' },
  { key: 'notes', get label() { return i18n.t('common.notes'); }, icon: FileTextIcon, section: 'operations', permission: 'store-notes:view' },

  { key: 'sales-reports', get label() { return i18n.t('common.salesReports'); }, icon: BarChartIcon, section: 'reports', permission: 'store-operations:manage', tab: 'Reports' },

  { key: 'users', get label() { return i18n.t('nav.users'); }, icon: UsersIcon, section: 'management', permission: 'users:view' },

  { key: 'store-settings', get label() { return i18n.t('common.storeSettings'); }, icon: SettingsIcon, section: 'settings', permission: 'stores:view' },
  { key: 'store-qr-tag', get label() { return i18n.t('nav.storeQrTag'); }, icon: QrCodeIcon, section: 'settings', permission: 'stores:view' },
  // No permission: the plan a seller is on is theirs and their staff's to read.
  { key: 'subscription', get label() { return i18n.t('common.subscription'); }, icon: AwardIcon, section: 'settings' },
  // Every user's own choice: the interface language, saved on their account.
  { key: 'language', get label() { return i18n.t('nav.languageAndRegion'); }, icon: GlobeIcon, section: 'settings' },
];

export const MENU_SECTIONS = [
  { key: 'main', label: '' },
  { key: 'sales', get label() { return i18n.t('common.sales'); } },
  { key: 'catalog', get label() { return i18n.t('common.catalog'); } },
  { key: 'inventory', get label() { return i18n.t('common.inventory'); } },
  { key: 'operations', get label() { return i18n.t('common.operations'); } },
  { key: 'reports', get label() { return i18n.t('common.reports'); } },
  { key: 'management', get label() { return i18n.t('nav.management'); } },
  { key: 'crm', label: 'CRM' },
  { key: 'settings', get label() { return i18n.t('nav.settings'); } },
];

// Pages reached from the header rather than the menu.
const HEADER_PAGES: MenuItem[] = [
  { key: 'profile', get label() { return i18n.t('common.myProfile'); }, icon: UserIcon, section: 'account' },
  { key: 'notifications', get label() { return i18n.t('common.notifications'); }, icon: BellIcon, section: 'account' },
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
