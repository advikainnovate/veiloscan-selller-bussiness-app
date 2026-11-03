import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** The five quick pages in the bottom bar. */
export type TabParamList = {
  Home: undefined;
  Orders: undefined;
  Products: undefined;
  Customers: undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  GetStarted: undefined;
  /** `email` pre-fills the form; `notice` is a success message, e.g. after a password reset. */
  Login: { email?: string; notice?: string } | undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { email: string };
  /** The signed-in app: the bottom tabs. */
  Main: NavigatorScreenParams<TabParamList> | undefined;
  /** Any other page from the menu or header, by its menu key. */
  Module: { key: string };
  OrderDetail: { id: string };
  /** A self order (counter / phone); with `requestId`, an order request's final bill. */
  CreateOrder: { requestId?: string } | undefined;
  OrderRequests: undefined;
  ProductDetail: { id: string };
  /** Create (no id) or edit a product. */
  ProductEditor: { id?: string };
  OrderRequestDetail: { id: string };
  CustomerCredit: undefined;
  CreditDetail: { id: string };
  Coupons: undefined;
  CouponDetail: { id: string };
  /** Create (no id) or edit a coupon. */
  CouponForm: { id?: string };
  AllStores: undefined;
  BusinessOverview: undefined;
  DailyBusiness: undefined;
  /** Expenses, on one of its tabs (Dashboard by default); `status` / `search` open All Expenses filtered. */
  Expenses: { tab?: ExpenseTab; status?: string; search?: string; supplierId?: string; sort?: string } | undefined;
  /** `action` opens the Add Payment / Record Return sheet straight away. */
  ExpenseDetail: { id: string; action?: 'pay' | 'return' };
  /** New (no id), edit (id), or a copy dated today (copyOf). */
  ExpenseForm: { id?: string; copyOf?: string; supplierId?: string } | undefined;
  SupplierLedger: { id: string };
  Notes: undefined;
  /** Inventory, on Stock / Ledger / Reservations / Low Stock. */
  Inventory: { tab?: InventoryTab } | undefined;
  StockDetail: { id: string };
  /** The current store's page, on one of its tabs (Overview by default). */
  StoreSettings: { tab?: StoreSettingsTab } | undefined;
};

export type StoreSettingsTab = 'overview' | 'setup' | 'operations' | 'gst' | 'qr-tag' | 'info' | 'activity';

export type InventoryTab = 'stock' | 'ledger' | 'reservations' | 'low';

export type ExpenseTab = 'dashboard' | 'list' | 'suppliers' | 'recurring' | 'reports' | 'categories';

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
