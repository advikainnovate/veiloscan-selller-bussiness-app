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
  InventoryLedger: undefined;
  SupportTickets: undefined;
  SupportTicket: { id: string };
  /** A new ticket; with relatedTo, a follow-up of that one. */
  SupportTicketForm: { relatedTo?: { id: string; ticketNumber: string; subject: string; storeId?: string } } | undefined;
  SupportDashboard: undefined;
  /** A store's page (the current store without `storeId`), on one of its tabs (Overview by default). */
  StoreSettings: { tab?: StoreSettingsTab; storeId?: string } | undefined;
  /** Every store the seller holds. */
  Stores: undefined;
  /** Sales › Freebies / Gift Cards / Promotions: list, one record, create (no id) / edit. */
  Offers: { kind: OfferKind };
  OfferDetail: { kind: OfferKind; id: string };
  OfferForm: { kind: OfferKind; id?: string };
  /** Sales › Shipping: delivery zones, one zone with its methods, create (no id) / edit a zone. */
  Shipping: undefined;
  ShippingZone: { id: string };
  ShippingZoneForm: { id?: string } | undefined;
  /** Inventory › Stock Health: low, out-of-stock and healthy SKUs (`filter` opens one). */
  StockHealth: { filter?: string } | undefined;
  /** Inventory › Pending Stock: stock ordered from suppliers that hasn't fully arrived. */
  PendingStock: { filter?: string } | undefined;
  StockOrderDetail: { id: string };
  /** A new stock order; `variantIds` pre-fills it (e.g. the low SKUs from Stock Health). */
  StockOrderForm: { variantIds?: string[] } | undefined;
  /** Settings › Subscription: the plan, usage, payments; change plan. */
  Subscription: undefined;
  /** Settings › Language & Region: the interface language (saved on the account) and regional formats. */
  LanguageSettings: undefined;
  /** The header bell: every notification. */
  Notifications: undefined;
  /** My Profile (the header avatar and the menu's account card). */
  Profile: undefined;
  /** Catalog › Warehouses: list, one warehouse, add (no id) / edit. */
  Warehouses: undefined;
  WarehouseDetail: { id: string };
  WarehouseForm: { id?: string } | undefined;
  /** Catalog › Brand Approvals: list, one request (fix & resubmit there), a new request. */
  BrandApprovals: undefined;
  BrandRequestDetail: { id: string };
  BrandRequestForm: { categoryId?: string; brandId?: string } | undefined;
  /** Catalog › Product Variants (product × variant value mappings). */
  ProductVariants: undefined;
  ProductVariantForm: { id?: string } | undefined;
  /** Catalog › Business Variants (sellable SKUs). */
  BusinessVariants: undefined;
  BusinessVariantForm: { id?: string; productId?: string } | undefined;
  /** Catalog › Product Specs (a product's specification values). */
  ProductSpecs: undefined;
  ProductSpecDetail: { id: string };
  ProductSpecForm: { id?: string; productId?: string } | undefined;
  /** Pricing & Discounts › Quantity Discount Slabs. */
  QuantitySlabs: undefined;
  /** Create (no id) or edit a quantity discount scheme. */
  QuantitySlabForm: { id?: string } | undefined;
  /** Management › Users: staff accounts, one user, add (no id) / edit. */
  Users: undefined;
  UserDetail: { id: string };
  UserForm: { id?: string } | undefined;
  /** One customer (from the Customers tab), on one of its tabs. */
  CustomerDetail: { id: string; tab?: 'overview' | 'orders' | 'addresses' | 'credit' };
  /** Add New Store, or continue a draft's onboarding (`storeId`). */
  CreateStore: { storeId?: string } | undefined;
};

export type StoreSettingsTab = 'overview' | 'setup' | 'operations' | 'gst' | 'categories' | 'qr-tag' | 'info' | 'activity';

export type { OfferKind } from '../lib/offers';
import type { OfferKind } from '../lib/offers';

export type InventoryTab = 'stock' | 'ledger' | 'reservations' | 'low';

export type ExpenseTab = 'dashboard' | 'list' | 'suppliers' | 'recurring' | 'reports' | 'categories';

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
