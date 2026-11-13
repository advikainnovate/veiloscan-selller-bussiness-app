// Store page labels and form rules, as on the Seller Panel
// (components/dashboard/stores: store-constants, store-status, store-forms,
// store-wizard-types, store-edit-sections) and the backend's store DTOs.
import type { BadgeTone } from '../components/ui/Badge';
import type { DocumentRequirement, Rec, StoreRecord } from '../services/store-manage-service';
import i18n from '../i18n';

export interface Opt {
  value: string;
  label: string;
}

export const BUSINESS_TYPES: Opt[] = [
  { value: 'RETAIL', get label() { return i18n.t('store.retail'); } },
  { value: 'WHOLESALE', get label() { return i18n.t('store.wholesale'); } },
  { value: 'MANUFACTURER', get label() { return i18n.t('common.manufacturer'); } },
  { value: 'DISTRIBUTOR', get label() { return i18n.t('store.distributor'); } },
  { value: 'RESELLER', get label() { return i18n.t('store.reseller'); } },
  { value: 'SERVICE', get label() { return i18n.t('store.service'); } },
  { value: 'OTHER', get label() { return i18n.t('common.other'); } },
];

export const BUSINESS_CONSTITUTIONS: Opt[] = [
  { value: 'PROPRIETORSHIP', get label() { return i18n.t('store.proprietorship'); } },
  { value: 'PARTNERSHIP', get label() { return i18n.t('store.partnership'); } },
  { value: 'LLP', label: 'LLP' },
  { value: 'PRIVATE_LIMITED', get label() { return i18n.t('store.privateLimited'); } },
  { value: 'PUBLIC_LIMITED', get label() { return i18n.t('store.publicLimited'); } },
  { value: 'HUF', label: 'HUF' },
  { value: 'TRUST', get label() { return i18n.t('store.trust'); } },
  { value: 'SOCIETY', get label() { return i18n.t('store.society'); } },
  { value: 'OTHER', get label() { return i18n.t('common.other'); } },
];

export const GST_STATUSES: Opt[] = [
  { value: 'ACTIVE', get label() { return i18n.t('common.active'); } },
  { value: 'SUSPENDED', get label() { return i18n.t('common.suspended'); } },
  { value: 'CANCELLED', get label() { return i18n.t('common.cancelled'); } },
  { value: 'INACTIVE', get label() { return i18n.t('common.inactive'); } },
];

export const DOCUMENT_TYPES: Opt[] = [
  { value: 'PAN', label: 'PAN' },
  { value: 'GST_CERTIFICATE', get label() { return i18n.t('store.gstCertificate'); } },
  { value: 'BUSINESS_REGISTRATION', get label() { return i18n.t('store.businessRegistration'); } },
  { value: 'SHOP_LICENSE', get label() { return i18n.t('store.shopLicense'); } },
  { value: 'TRADE_LICENSE', get label() { return i18n.t('store.tradeLicense'); } },
  { value: 'ADDRESS_PROOF', get label() { return i18n.t('common.addressProof'); } },
  { value: 'BANK_PROOF', get label() { return i18n.t('store.bankProof'); } },
  { value: 'OWNER_ID', get label() { return i18n.t('store.ownerId'); } },
  { value: 'OTHER', get label() { return i18n.t('common.other'); } },
];

export const CATEGORY_OPTIONS: Opt[] = [
  'Grocery & Fresh Food',
  'Fashion & Apparel',
  'Electronics & Appliances',
  'Home & Kitchen',
  'Health & Beauty',
  'Pharmacy',
  'Books & Stationery',
  'Sports & Fitness',
  'Toys & Baby Care',
  'Jewellery & Accessories',
  'Restaurant & Food',
  'Bakery & Sweets',
  'Hardware & Tools',
  'Automotive',
  'Pet Supplies',
  'Other',
].map(label => ({ value: label, label }));

export const CURRENCIES: Opt[] = [
  { value: 'INR', get label() { return i18n.t('store.inrIndianRupeeRs'); } },
  { value: 'USD', get label() { return i18n.t('store.usdUsDollar'); } },
  { value: 'EUR', get label() { return i18n.t('store.eurEuro'); } },
  { value: 'GBP', get label() { return i18n.t('store.gbpBritishPound'); } },
  { value: 'AED', get label() { return i18n.t('store.aedUaeDirham'); } },
  { value: 'SGD', get label() { return i18n.t('store.sgdSingaporeDollarS'); } },
];

export const TIMEZONES: Opt[] = [
  { value: 'Asia/Kolkata', get label() { return i18n.t('store.asiaKolkataGmt0530'); } },
  { value: 'Asia/Dubai', get label() { return i18n.t('store.asiaDubaiGmt0400'); } },
  { value: 'Asia/Singapore', get label() { return i18n.t('store.asiaSingaporeGmt0800'); } },
  { value: 'Europe/London', get label() { return i18n.t('store.europeLondonGmt0000'); } },
  { value: 'Europe/Berlin', get label() { return i18n.t('store.europeBerlinGmt0100'); } },
  { value: 'America/New_York', get label() { return i18n.t('store.americaNewYorkGmt0500'); } },
  { value: 'America/Los_Angeles', get label() { return i18n.t('store.americaLosAngelesGmt0800'); } },
  { value: 'UTC', get label() { return i18n.t('store.utcGmt0000'); } },
];

export const WEEK_DAYS = [
  { value: 'MONDAY', get label() { return i18n.t('store.monday'); } },
  { value: 'TUESDAY', get label() { return i18n.t('store.tuesday'); } },
  { value: 'WEDNESDAY', get label() { return i18n.t('store.wednesday'); } },
  { value: 'THURSDAY', get label() { return i18n.t('store.thursday'); } },
  { value: 'FRIDAY', get label() { return i18n.t('store.friday'); } },
  { value: 'SATURDAY', get label() { return i18n.t('store.saturday'); } },
  { value: 'SUNDAY', get label() { return i18n.t('store.sunday'); } },
];

export const ONBOARDING_STEPS = [
  { key: 'BUSINESS_DETAILS', get label() { return i18n.t('store.businessDetails'); } },
  { key: 'STORE_DETAILS', get label() { return i18n.t('store.storeDetails'); } },
  { key: 'ADDRESS_CONTACT', get label() { return i18n.t('store.addressAndContact'); } },
  { key: 'GST_DETAILS', get label() { return i18n.t('store.gstDetails'); }, optional: true },
  { key: 'DOCUMENTS', get label() { return i18n.t('common.documents'); }, optional: true },
  { key: 'REVIEW', get label() { return i18n.t('store.reviewAndCreate'); } },
];

export const COMMERCE_MODES = [
  { value: 'STANDARD', get label() { return i18n.t('store.standardShop'); }, get description() { return i18n.t('store.customersSeePricesAddToCart'); }, get customerSees() { return i18n.t('store.pricesCartCheckoutPayment'); } },
  {
    value: 'ORDER_REQUEST',
    get label() { return i18n.t('store.orderRequests'); },
    get description() { return i18n.t('store.customersSendAListOfProducts'); },
    get customerSees() { return i18n.t('store.availabilityCartOrderRequestNoPrices'); },
  },
  {
    value: 'CATALOG_ONLY',
    get label() { return i18n.t('store.catalogueOnly'); },
    get description() { return i18n.t('store.aProductShowcaseCustomersBrowseProducts'); },
    get customerSees() { return i18n.t('store.productsAvailabilityNoPricesCartOr'); },
  },
];

export const labelFor = (options: Opt[], value: unknown) => options.find(o => o.value === value)?.label ?? (typeof value === 'string' && value ? value : '—');

// One status per store, combining onboarding, approval and the store's own lifecycle.
export type DisplayStatus = 'DRAFT' | 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE' | 'CLOSED';
export const DISPLAY_STATUS: Record<DisplayStatus, { label: string; hint: string; tone: BadgeTone }> = {
  DRAFT: { get label() { return i18n.t('common.draft'); }, get hint() { return i18n.t('store.onboardingInProgress'); }, tone: 'blue' },
  PENDING: { get label() { return i18n.t('store.pendingApproval'); }, get hint() { return i18n.t('common.awaitingReview'); }, tone: 'amber' },
  IN_REVIEW: { get label() { return i18n.t('common.inReview'); }, get hint() { return i18n.t('store.underVerification'); }, tone: 'blue' },
  APPROVED: { get label() { return i18n.t('common.approved'); }, get hint() { return i18n.t('store.activeStore'); }, tone: 'green' },
  REJECTED: { get label() { return i18n.t('common.rejected'); }, get hint() { return i18n.t('common.changesRequested'); }, tone: 'red' },
  SUSPENDED: { get label() { return i18n.t('common.suspended'); }, get hint() { return i18n.t('store.suspendedByAdmin'); }, tone: 'red' },
  INACTIVE: { get label() { return i18n.t('common.inactive'); }, get hint() { return i18n.t('store.notTakingOrders'); }, tone: 'slate' },
  CLOSED: { get label() { return i18n.t('common.closed'); }, get hint() { return i18n.t('store.storeClosed'); }, tone: 'slate' },
};

const reviewed = (s: unknown) => s === 'VERIFIED' || s === 'REJECTED';

export function displayStatus(store: StoreRecord): DisplayStatus {
  switch (store.approvalStatus) {
    case 'PENDING': {
      const inReview = (store.documents ?? []).some(d => reviewed(d.verificationStatus)) || reviewed(store.taxDetails?.verificationStatus);
      return inReview ? 'IN_REVIEW' : 'PENDING';
    }
    case 'REJECTED':
      return 'REJECTED';
    case 'APPROVED':
      if (store.status === 'SUSPENDED' || store.status === 'INACTIVE' || store.status === 'CLOSED') return store.status;
      return 'APPROVED';
    default:
      return store.status === 'CLOSED' ? 'CLOSED' : 'DRAFT';
  }
}

export const VERIFICATION: Record<string, { label: string; tone: BadgeTone }> = {
  VERIFIED: { get label() { return i18n.t('common.verified'); }, tone: 'green' },
  PENDING: { get label() { return i18n.t('common.pending'); }, tone: 'amber' },
  REJECTED: { get label() { return i18n.t('common.rejected'); }, tone: 'red' },
};

/** The store's page in the shop (the slug, or the code's short link). */
export function storeShopUrl(shopUrl: string, code: string, slug?: string | null) {
  const root = shopUrl.replace(/\/+$/, '');
  return slug ? `${root}/shops/${encodeURIComponent(slug)}` : `${root}/s/${code.toLowerCase()}`;
}

/** "Address line 1, line 2 / Landmark, City - PIN / State, Country". */
export function addressLines(settings?: Rec | null): string[] {
  if (!settings) return [];
  return [
    [settings.addressLine1, settings.addressLine2].filter(Boolean).join(', '),
    `${[settings.landmark, settings.city].filter(Boolean).join(', ')} - ${String(settings.postalCode ?? '')}`,
    [settings.state, settings.country].filter(Boolean).join(', '),
  ].filter(line => line.trim() && line.trim() !== '-');
}

const str = (r: Rec | null | undefined, k: string) => (r?.[k] == null ? '' : String(r[k]));

/** Empty optional strings are dropped so the backend's validators only see filled values. */
export function compact(values: Record<string, string>): Rec {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, v.trim()]));
}

// ── Address & contact ────────────────────────────────────────────────────

export const CONTACT_FIELDS = [
  'email',
  'phone',
  'alternatePhone',
  'website',
  'addressLine1',
  'addressLine2',
  'landmark',
  'city',
  'state',
  'country',
  'postalCode',
  'latitude',
  'longitude',
  'openingTime',
  'closingTime',
] as const;
export type ContactForm = Record<(typeof CONTACT_FIELDS)[number], string>;

export function contactFromRecord(settings: Rec | null | undefined): ContactForm {
  const form = Object.fromEntries(CONTACT_FIELDS.map(k => [k, str(settings, k)])) as ContactForm;
  form.country ||= 'India';
  // Postgres TIME comes back as HH:MM:SS; the API takes HH:MM.
  form.openingTime = form.openingTime.slice(0, 5);
  form.closingTime = form.closingTime.slice(0, 5);
  return form;
}

const REQUIRED: [keyof ContactForm, string][] = [
  ['email', 'Store Email'],
  ['phone', 'Store Phone'],
  ['addressLine1', 'Address Line 1'],
  ['city', 'City'],
  ['state', 'State'],
  ['country', 'Country'],
  ['postalCode', 'Postal Code'],
];
const PHONE = /^\+?[0-9]{7,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The panel's required fields, then the backend's formats. */
export function contactProblem(f: ContactForm): string | null {
  const missing = REQUIRED.filter(([k]) => !f[k].trim()).map(([, label]) => label);
  if (missing.length) return i18n.t('common.pleaseFillInJoin', { join: missing.join(', ') });
  if (!EMAIL.test(f.email.trim())) return i18n.t('store.enterAValidStoreEmail');
  if (!PHONE.test(f.phone.trim())) return i18n.t('store.storePhoneMustBe7To');
  if (f.alternatePhone.trim() && !PHONE.test(f.alternatePhone.trim())) return i18n.t('store.alternatePhoneMustBe7To');
  if (f.website.trim() && !/^https?:\/\/\S+\.\S+/.test(f.website.trim())) return i18n.t('store.theWebsiteMustStartWithHttp');
  const lat = f.latitude.trim();
  const lng = f.longitude.trim();
  if (lat && !(Number(lat) >= -90 && Number(lat) <= 90)) return i18n.t('common.latitudeMustBeBetween90And');
  if (lng && !(Number(lng) >= -180 && Number(lng) <= 180)) return i18n.t('common.longitudeMustBeBetween180And');
  if (f.openingTime && f.closingTime && f.openingTime >= f.closingTime) return i18n.t('store.closingTimeMustBeAfterOpening');
  return null;
}

// ── GST ──────────────────────────────────────────────────────────────────

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export interface GstForm {
  gstRegistered: boolean;
  gstin: string;
  legalBusinessName: string;
  tradeName: string;
  businessConstitution: string;
  gstRegistrationDate: string;
  gstStatus: string;
}

export function gstFromRecord(tax: Rec | null | undefined): GstForm {
  return {
    gstRegistered: Boolean(tax?.gstRegistered),
    gstin: str(tax, 'gstin'),
    legalBusinessName: str(tax, 'legalBusinessName'),
    tradeName: str(tax, 'tradeName'),
    businessConstitution: str(tax, 'businessConstitution'),
    gstRegistrationDate: str(tax, 'gstRegistrationDate').slice(0, 10),
    gstStatus: str(tax, 'gstStatus'),
  };
}

export function gstProblem(f: GstForm): string | null {
  if (!f.gstRegistered) return null;
  if (!GSTIN_PATTERN.test(f.gstin.trim().toUpperCase())) return i18n.t('store.enterAValid15CharacterGstin');
  if (!f.legalBusinessName.trim()) return i18n.t('store.legalBusinessNameIsRequiredWhen');
  return null;
}

export function gstPayload(f: GstForm): Rec {
  if (!f.gstRegistered) return { gstRegistered: false };
  return {
    gstRegistered: true,
    ...compact({
      gstin: f.gstin.toUpperCase(),
      legalBusinessName: f.legalBusinessName,
      tradeName: f.tradeName,
      businessConstitution: f.businessConstitution,
      gstRegistrationDate: f.gstRegistrationDate,
      gstStatus: f.gstStatus,
    }),
  };
}

// ── Documents ────────────────────────────────────────────────────────────

const SLOTS = [
  { key: 'PAN', types: ['PAN'], get label() { return i18n.t('store.panCard'); } },
  { key: 'BUSINESS_REGISTRATION', types: ['BUSINESS_REGISTRATION'], get label() { return i18n.t('store.businessRegistration'); } },
  { key: 'SHOP_LICENSE', types: ['SHOP_LICENSE', 'TRADE_LICENSE'], get label() { return i18n.t('store.shopTradeLicense'); } },
  { key: 'ADDRESS_PROOF', types: ['ADDRESS_PROOF'], get label() { return i18n.t('common.addressProof'); } },
  { key: 'BANK_PROOF', types: ['BANK_PROOF'], get label() { return i18n.t('store.bankProof'); } },
  { key: 'OTHER', types: ['OTHER', 'OWNER_ID'], get label() { return i18n.t('store.otherDocument'); } },
];

/** The platform defaults, until the admin's requirements load. */
export const DEFAULT_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  { key: 'GST_CERTIFICATE', get label() { return i18n.t('store.gstCertificate'); }, types: ['GST_CERTIFICATE'], gstOnly: true, requiredWithGst: true, requiredWithoutGst: false },
  ...SLOTS.map(s => ({
    key: s.key,
    label: s.label,
    types: s.types,
    gstOnly: false,
    requiredWithGst: s.key === 'PAN' || s.key === 'ADDRESS_PROOF',
    requiredWithoutGst: s.key === 'PAN' || s.key === 'ADDRESS_PROOF',
  })),
];

export const requiredDocuments = (gst: boolean, reqs: DocumentRequirement[]) => reqs.filter(r => (gst ? r.requiredWithGst : r.requiredWithoutGst));

export function missingDocuments(gst: boolean, documents: Rec[], reqs: DocumentRequirement[]): string[] {
  const uploaded = new Set(documents.map(d => d.documentType));
  return requiredDocuments(gst, reqs)
    .filter(slot => !slot.types.some(t => uploaded.has(t)))
    .map(slot => slot.label);
}

// ── Business hours ───────────────────────────────────────────────────────

export interface HourRow {
  dayOfWeek: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export function hoursFromRecord(hours: Rec[]): HourRow[] {
  return WEEK_DAYS.map(d => {
    const row = hours.find(h => h.dayOfWeek === d.value);
    return {
      dayOfWeek: d.value,
      isOpen: row ? Boolean(row.isOpen) : true,
      openTime: String(row?.openTime ?? '09:00').slice(0, 5),
      closeTime: String(row?.closeTime ?? '21:00').slice(0, 5),
    };
  });
}

export function hoursProblem(rows: HourRow[]): string | null {
  const bad = rows.find(h => h.isOpen && (!h.openTime || !h.closeTime || h.openTime >= h.closeTime));
  return bad ? i18n.t('store.labelClosingTimeMustBeAfter', { label: WEEK_DAYS.find(d => d.value === bad.dayOfWeek)?.label ?? bad.dayOfWeek }) : null;
}

// ── Business details (the store itself) ─────────────────────────────────

export interface BusinessForm {
  name: string;
  slug: string;
  businessType: string;
  businessCategory: string;
  timezone: string;
  currency: string;
}

export function businessFromStore(s: StoreRecord): BusinessForm {
  return {
    name: s.name ?? '',
    slug: s.slug ?? '',
    businessType: s.businessType ?? '',
    businessCategory: s.businessCategory ?? '',
    timezone: s.timezone || 'Asia/Kolkata',
    currency: s.currency || 'INR',
  };
}

export function businessProblem(f: BusinessForm): string | null {
  const missing = [!f.name.trim() ? i18n.t('store.storeName') : null, !f.businessType ? i18n.t('store.businessType') : null, !f.businessCategory.trim() ? i18n.t('store.businessCategory') : null].filter(Boolean);
  if (missing.length) return i18n.t('common.pleaseFillInJoin', { join: missing.join(', ') });
  if (f.name.trim().length > 150) return i18n.t('store.theStoreNameCanBeAt');
  if (f.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug.trim())) return i18n.t('store.theSlugCanOnlyHaveLowercase');
  if (f.businessCategory.trim().length > 100) return i18n.t('store.theBusinessCategoryCanBeAt');
  return null;
}

// ── Operational settings ─────────────────────────────────────────────────

export interface ConfigForm {
  commerceMode: string;
  currencySymbol: string;
  orderPrefix: string;
  minOrderAmount: string;
  taxInclusivePricing: boolean;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  autoAcceptOrders: boolean;
  acceptOrders: boolean;
  guestCheckoutEnabled: boolean;
  allowCustomerCredit: boolean;
  maxCreditDays: string;
}

export function configFromRecord(c: Rec | null | undefined): ConfigForm {
  return {
    commerceMode: (c?.commerceMode as string) ?? 'STANDARD',
    currencySymbol: (c?.currencySymbol as string) ?? '₹',
    orderPrefix: (c?.orderPrefix as string) ?? '',
    minOrderAmount: c?.minOrderAmount == null ? '' : String(c.minOrderAmount),
    taxInclusivePricing: c?.taxInclusivePricing !== false,
    codEnabled: c?.codEnabled !== false,
    onlinePaymentEnabled: c?.onlinePaymentEnabled !== false,
    autoAcceptOrders: Boolean(c?.autoAcceptOrders),
    acceptOrders: c?.acceptOrders !== false,
    guestCheckoutEnabled: c?.guestCheckoutEnabled !== false,
    allowCustomerCredit: Boolean(c?.allowCustomerCredit),
    maxCreditDays: String(c?.maxCreditDays ?? 30),
  };
}

export function configProblem(f: ConfigForm): string | null {
  const days = Number(f.maxCreditDays);
  if (f.allowCustomerCredit && (!Number.isInteger(days) || days < 1 || days > 365)) return i18n.t('store.maximumCreditPeriodMustBeBetween');
  if (f.currencySymbol.length > 5) return i18n.t('store.theCurrencySymbolCanBeAt');
  if (f.orderPrefix.length > 10) return i18n.t('store.theOrderPrefixCanBeAt');
  if (f.minOrderAmount.trim() && !(Number(f.minOrderAmount) >= 0)) return i18n.t('store.theMinimumOrderMustBeAn');
  return null;
}

export function configPayload(f: ConfigForm): Rec {
  const days = Number(f.maxCreditDays);
  return {
    ...f,
    orderPrefix: f.orderPrefix || undefined,
    minOrderAmount: f.minOrderAmount || undefined,
    maxCreditDays: Number.isInteger(days) && days >= 1 ? days : undefined,
  };
}

/** #RGB / #RRGGBB, as the panel's colour picker writes. */
export const isColor = (v: string) => !v.trim() || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

export const STORE_IMAGE_RULES = {
  logo: { maxMb: 2, min: { width: 200, height: 200 }, get text() { return i18n.t('store.ratio11Square512512'); } },
  banner: { maxMb: 5, min: { width: 1200, height: 450 }, get text() { return i18n.t('store.ratio83Wide1600600'); } },
} as const;

/** Why a picked photo can't be the logo / banner (the panel's checks), or null. */
export function storeImageProblem(kind: 'logo' | 'banner', file: { type?: string; fileSize?: number; width?: number; height?: number }): string | null {
  const rule = STORE_IMAGE_RULES[kind];
  const name = kind === 'logo' ? i18n.t('store.logo') : i18n.t('store.banner');
  if (file.type && !['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) return i18n.t('store.useAPngJpgOrWebp');
  if (file.fileSize && file.fileSize > rule.maxMb * 1024 * 1024) return i18n.t('store.nameMustBeMaxmbMbOr', { name, maxMb: rule.maxMb });
  if (file.width && file.height) {
    // A banner of any shape is fine as long as an 8:3 crop of it is big enough.
    const w = kind === 'banner' ? Math.min(file.width, (file.height * 8) / 3) : file.width;
    const h = kind === 'banner' ? Math.min(file.height, (file.width * 3) / 8) : file.height;
    if (w < rule.min.width || h < rule.min.height) return i18n.t('store.nameMustBeAtLeastWidth', { name, width: rule.min.width, height: rule.min.height });
  }
  return null;
}

/** Store description (rich text) as plain text. */
export function plainText(html: string | null | undefined) {
  return (html ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Store list (the panel's store-list-page) ─────────────────────────────

export const STATUS_FILTERS = (Object.keys(DISPLAY_STATUS) as DisplayStatus[]).map(value => ({ value, label: DISPLAY_STATUS[value].label }));

export const ownerName = (s: StoreRecord) => [s.owner?.firstName, s.owner?.lastName].filter(Boolean).join(' ');
export const storeCity = (s: StoreRecord) => String(s.settings?.city ?? '');
export const storeLocation = (s: StoreRecord) => [s.settings?.city, s.settings?.state].filter(Boolean).join(', ');
/** Drafts that haven't been submitted go by when they were created. */
export const submittedOn = (s: StoreRecord) => s.submittedAt ?? s.createdAt;

export interface StoreFilters {
  search: string;
  status: string;
  businessType: string;
  category: string;
  city: string;
}
export const STORE_FILTERS_INITIAL: StoreFilters = { search: '', status: '', businessType: '', category: '', city: '' };

/** Search covers name, code, slug, owner, email, GSTIN, city, state and PIN, as the panel's. */
export function filterStores(stores: StoreRecord[], f: StoreFilters): StoreRecord[] {
  const q = f.search.trim().toLowerCase();
  return stores.filter(s => {
    if (f.status && displayStatus(s) !== f.status) return false;
    if (f.businessType && s.businessType !== f.businessType) return false;
    if (f.category && s.businessCategory !== f.category) return false;
    if (f.city && storeCity(s) !== f.city) return false;
    if (!q) return true;
    return [s.name, s.code, s.slug, ownerName(s), s.owner?.email, s.taxDetails?.gstin, s.settings?.city, s.settings?.state, s.settings?.postalCode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

export function storeStats(stores: StoreRecord[]) {
  const count = (status: DisplayStatus) => stores.filter(s => displayStatus(s) === status).length;
  return { total: stores.length, pending: count('PENDING'), approved: count('APPROVED'), rejected: count('REJECTED'), inReview: count('IN_REVIEW') };
}

// ── Add New Store wizard (store-onboarding-wizard) ───────────────────────

/** Four screens over the backend's six onboarding steps. */
export const WIZARD_STEPS = [
  { step: 1, get label() { return i18n.t('store.businessDetails'); }, backendSteps: [1, 2] },
  { step: 2, get label() { return i18n.t('store.storeSetup'); }, backendSteps: [3] },
  { step: 3, get label() { return i18n.t('store.gstAndDocuments'); }, backendSteps: [4, 5], optional: true },
  { step: 4, get label() { return i18n.t('store.reviewAndSubmit'); }, backendSteps: [6] },
];
export const BACKEND_REVIEW_STEP = 6;
export const wizardStepFor = (backendStep: number) => WIZARD_STEPS.find(s => s.backendSteps.includes(backendStep))?.step ?? 1;

export const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' };

export const DESCRIPTION_MIN_WORDS = 100;
export const DESCRIPTION_MAX = 2000;

export function countWords(html: string | null | undefined) {
  const text = plainText(html);
  return text ? text.split(' ').length : 0;
}

/** The saved description as editable text, a line per paragraph. */
export function descriptionText(html: string | null | undefined) {
  return (html ?? '')
    .replace(/<(br)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .split('\n')
    .map(line => plainText(line))
    .filter(Boolean)
    .join('\n\n');
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Typed text as the panel editor's HTML: a paragraph per line. */
export function descriptionHtml(text: string) {
  return text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escape(p)}</p>`)
    .join('');
}

export interface NewStoreForm {
  name: string;
  businessType: string;
  businessCategory: string;
  description: string;
  timezone: string;
  currency: string;
}
export const NEW_STORE_INITIAL: NewStoreForm = { name: '', businessType: '', businessCategory: '', description: '', timezone: 'Asia/Kolkata', currency: 'INR' };

export function newStoreFromRecord(s: StoreRecord): NewStoreForm {
  return {
    name: s.name ?? '',
    businessType: s.businessType ?? '',
    businessCategory: s.businessCategory ?? '',
    description: descriptionText(s.description),
    timezone: s.timezone || 'Asia/Kolkata',
    currency: s.currency || 'INR',
  };
}

/** The panel's validateBusiness: a description of 100+ words first, then the required fields. */
export function newStoreProblem(f: NewStoreForm): string | null {
  const words = countWords(f.description);
  if (!words) return i18n.t('store.storeDescriptionIsRequired');
  if (words < DESCRIPTION_MIN_WORDS) return i18n.t('store.storeDescriptionMustBeAtLeast', { DESCRIPTION_MIN_WORDS, words });
  if (plainText(f.description).length > DESCRIPTION_MAX) return i18n.t('store.descriptionCanBeAtMostDescription', { DESCRIPTION_MAX });
  const missing = [!f.name.trim() ? i18n.t('store.storeName') : null, !f.businessType ? i18n.t('store.businessType') : null, !f.businessCategory.trim() ? i18n.t('store.businessCategory') : null].filter(Boolean);
  if (missing.length) return i18n.t('common.pleaseFillInJoin', { join: missing.join(', ') });
  if (f.name.trim().length > 150) return i18n.t('store.theStoreNameCanBeAt');
  return null;
}

/** Monday–Saturday 9 AM – 9 PM, Sunday closed, as the panel's wizard starts. */
export const DEFAULT_HOURS: HourRow[] = WEEK_DAYS.map(d => ({ dayOfWeek: d.value, isOpen: d.value !== 'SUNDAY', openTime: '09:00', closeTime: '21:00' }));

export function wizardHours(hours: Rec[] | undefined): HourRow[] {
  return hours?.length ? hoursFromRecord(hours) : DEFAULT_HOURS;
}

export interface BrandingRequirement {
  key: 'STORE_LOGO' | 'STORE_BANNER';
  label: string;
  requiredWithGst: boolean;
  requiredWithoutGst: boolean;
}

/** The platform defaults: required with GST, optional without. */
export const DEFAULT_BRANDING_REQUIREMENTS: BrandingRequirement[] = [
  { key: 'STORE_LOGO', get label() { return i18n.t('store.storeLogo'); }, requiredWithGst: true, requiredWithoutGst: false },
  { key: 'STORE_BANNER', get label() { return i18n.t('store.storeBanner'); }, requiredWithGst: true, requiredWithoutGst: false },
];

/** Required images not added yet; with `gst` null (not chosen yet) only those required either way. */
export function missingBranding(rules: BrandingRequirement[], gst: boolean | null, images: { logo: unknown; banner: unknown }): string[] {
  return rules
    .filter(r => (gst === null ? r.requiredWithGst && r.requiredWithoutGst : gst ? r.requiredWithGst : r.requiredWithoutGst))
    .filter(r => !(r.key === 'STORE_LOGO' ? images.logo : images.banner))
    .map(r => r.label);
}

/** The hint under a logo / banner field. */
export function brandingHint(rule: BrandingRequirement | undefined, gst: boolean | null): string | undefined {
  if (!rule) return undefined;
  if (gst !== null) {
    const required = gst ? rule.requiredWithGst : rule.requiredWithoutGst;
    return required ? (gst ? i18n.t('store.requiredForGstStores') : i18n.t('store.requiredForNonGstStores')) : i18n.t('common.optional2');
  }
  if (rule.requiredWithGst && rule.requiredWithoutGst) return i18n.t('common.required');
  if (rule.requiredWithGst) return i18n.t('store.requiredIfYouRegisterWithGst');
  if (rule.requiredWithoutGst) return i18n.t('store.requiredIfYouRegisterWithoutGst');
  return i18n.t('common.optional2');
}
