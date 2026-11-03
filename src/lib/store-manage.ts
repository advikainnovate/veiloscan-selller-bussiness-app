// Store page labels and form rules, as on the Seller Panel
// (components/dashboard/stores: store-constants, store-status, store-forms,
// store-wizard-types, store-edit-sections) and the backend's store DTOs.
import type { BadgeTone } from '../components/ui/Badge';
import type { DocumentRequirement, Rec, StoreRecord } from '../services/store-manage-service';

export interface Opt {
  value: string;
  label: string;
}

export const BUSINESS_TYPES: Opt[] = [
  { value: 'RETAIL', label: 'Retail' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'MANUFACTURER', label: 'Manufacturer' },
  { value: 'DISTRIBUTOR', label: 'Distributor' },
  { value: 'RESELLER', label: 'Reseller' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'OTHER', label: 'Other' },
];

export const BUSINESS_CONSTITUTIONS: Opt[] = [
  { value: 'PROPRIETORSHIP', label: 'Proprietorship' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'LLP', label: 'LLP' },
  { value: 'PRIVATE_LIMITED', label: 'Private Limited' },
  { value: 'PUBLIC_LIMITED', label: 'Public Limited' },
  { value: 'HUF', label: 'HUF' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'SOCIETY', label: 'Society' },
  { value: 'OTHER', label: 'Other' },
];

export const GST_STATUSES: Opt[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export const DOCUMENT_TYPES: Opt[] = [
  { value: 'PAN', label: 'PAN' },
  { value: 'GST_CERTIFICATE', label: 'GST Certificate' },
  { value: 'BUSINESS_REGISTRATION', label: 'Business Registration' },
  { value: 'SHOP_LICENSE', label: 'Shop License' },
  { value: 'TRADE_LICENSE', label: 'Trade License' },
  { value: 'ADDRESS_PROOF', label: 'Address Proof' },
  { value: 'BANK_PROOF', label: 'Bank Proof' },
  { value: 'OWNER_ID', label: 'Owner ID' },
  { value: 'OTHER', label: 'Other' },
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
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'AED', label: 'AED - UAE Dirham (د.إ)' },
  { value: 'SGD', label: 'SGD - Singapore Dollar (S$)' },
];

export const TIMEZONES: Opt[] = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (GMT +05:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT +04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT +08:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT +00:00)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT +01:00)' },
  { value: 'America/New_York', label: 'America/New_York (GMT -05:00)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (GMT -08:00)' },
  { value: 'UTC', label: 'UTC (GMT +00:00)' },
];

export const WEEK_DAYS = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

export const ONBOARDING_STEPS = [
  { key: 'BUSINESS_DETAILS', label: 'Business Details' },
  { key: 'STORE_DETAILS', label: 'Store Details' },
  { key: 'ADDRESS_CONTACT', label: 'Address & Contact' },
  { key: 'GST_DETAILS', label: 'GST Details', optional: true },
  { key: 'DOCUMENTS', label: 'Documents', optional: true },
  { key: 'REVIEW', label: 'Review & Create' },
];

export const COMMERCE_MODES = [
  { value: 'STANDARD', label: 'Standard shop', description: 'Customers see prices, add to cart, check out and pay.', customerSees: 'Prices · Cart · Checkout · Payment' },
  {
    value: 'ORDER_REQUEST',
    label: 'Order requests',
    description: 'Customers send a list of products without prices. You confirm availability and the price, bill it, and they pay at the store.',
    customerSees: 'Availability · Cart · Order request — no prices or online payment',
  },
  {
    value: 'CATALOG_ONLY',
    label: 'Catalogue only',
    description: 'A product showcase. Customers browse products and availability, then visit or call you.',
    customerSees: 'Products · Availability — no prices, cart or ordering',
  },
];

export const labelFor = (options: Opt[], value: unknown) => options.find(o => o.value === value)?.label ?? (typeof value === 'string' && value ? value : '—');

// One status per store, combining onboarding, approval and the store's own lifecycle.
export type DisplayStatus = 'DRAFT' | 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE' | 'CLOSED';
export const DISPLAY_STATUS: Record<DisplayStatus, { label: string; hint: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Draft', hint: 'Onboarding in progress', tone: 'blue' },
  PENDING: { label: 'Pending Approval', hint: 'Awaiting review', tone: 'amber' },
  IN_REVIEW: { label: 'In Review', hint: 'Under verification', tone: 'blue' },
  APPROVED: { label: 'Approved', hint: 'Active store', tone: 'green' },
  REJECTED: { label: 'Rejected', hint: 'Changes requested', tone: 'red' },
  SUSPENDED: { label: 'Suspended', hint: 'Suspended by admin', tone: 'red' },
  INACTIVE: { label: 'Inactive', hint: 'Not taking orders', tone: 'slate' },
  CLOSED: { label: 'Closed', hint: 'Store closed', tone: 'slate' },
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
  VERIFIED: { label: 'Verified', tone: 'green' },
  PENDING: { label: 'Pending', tone: 'amber' },
  REJECTED: { label: 'Rejected', tone: 'red' },
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
  if (missing.length) return `Please fill in: ${missing.join(', ')}`;
  if (!EMAIL.test(f.email.trim())) return 'Enter a valid store email';
  if (!PHONE.test(f.phone.trim())) return 'Store phone must be 7 to 15 digits, optionally starting with +';
  if (f.alternatePhone.trim() && !PHONE.test(f.alternatePhone.trim())) return 'Alternate phone must be 7 to 15 digits, optionally starting with +';
  if (f.website.trim() && !/^https?:\/\/\S+\.\S+/.test(f.website.trim())) return 'The website must start with http:// or https://';
  const lat = f.latitude.trim();
  const lng = f.longitude.trim();
  if (lat && !(Number(lat) >= -90 && Number(lat) <= 90)) return 'Latitude must be between -90 and 90';
  if (lng && !(Number(lng) >= -180 && Number(lng) <= 180)) return 'Longitude must be between -180 and 180';
  if (f.openingTime && f.closingTime && f.openingTime >= f.closingTime) return 'Closing time must be after opening time';
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
  if (!GSTIN_PATTERN.test(f.gstin.trim().toUpperCase())) return 'Enter a valid 15-character GSTIN';
  if (!f.legalBusinessName.trim()) return 'Legal business name is required when GST registered';
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
  { key: 'PAN', types: ['PAN'], label: 'PAN Card' },
  { key: 'BUSINESS_REGISTRATION', types: ['BUSINESS_REGISTRATION'], label: 'Business Registration' },
  { key: 'SHOP_LICENSE', types: ['SHOP_LICENSE', 'TRADE_LICENSE'], label: 'Shop/Trade License' },
  { key: 'ADDRESS_PROOF', types: ['ADDRESS_PROOF'], label: 'Address Proof' },
  { key: 'BANK_PROOF', types: ['BANK_PROOF'], label: 'Bank Proof' },
  { key: 'OTHER', types: ['OTHER', 'OWNER_ID'], label: 'Other Document' },
];

/** The platform defaults, until the admin's requirements load. */
export const DEFAULT_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  { key: 'GST_CERTIFICATE', label: 'GST Certificate', types: ['GST_CERTIFICATE'], gstOnly: true, requiredWithGst: true, requiredWithoutGst: false },
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
  return bad ? `${WEEK_DAYS.find(d => d.value === bad.dayOfWeek)?.label ?? bad.dayOfWeek}: closing time must be after opening time` : null;
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
  const missing = [!f.name.trim() ? 'Store Name' : null, !f.businessType ? 'Business Type' : null, !f.businessCategory.trim() ? 'Business Category' : null].filter(Boolean);
  if (missing.length) return `Please fill in: ${missing.join(', ')}`;
  if (f.name.trim().length > 150) return 'The store name can be at most 150 characters';
  if (f.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.slug.trim())) return 'The slug can only have lowercase letters, numbers and dashes';
  if (f.businessCategory.trim().length > 100) return 'The business category can be at most 100 characters';
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
  if (f.allowCustomerCredit && (!Number.isInteger(days) || days < 1 || days > 365)) return 'Maximum credit period must be between 1 and 365 days.';
  if (f.currencySymbol.length > 5) return 'The currency symbol can be at most 5 characters';
  if (f.orderPrefix.length > 10) return 'The order prefix can be at most 10 characters';
  if (f.minOrderAmount.trim() && !(Number(f.minOrderAmount) >= 0)) return 'The minimum order must be an amount';
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
  logo: { maxMb: 2, min: { width: 200, height: 200 }, text: 'Ratio 1:1 (square) · 512 × 512 px recommended · Min 200 × 200 px · PNG, JPG, WEBP · Max 2 MB' },
  banner: { maxMb: 5, min: { width: 1200, height: 450 }, text: 'Ratio 8:3 (wide) · 1600 × 600 px recommended · Min 1200 × 450 px · PNG, JPG, WEBP · Max 5 MB' },
} as const;

/** Why a picked photo can't be the logo / banner (the panel's checks), or null. */
export function storeImageProblem(kind: 'logo' | 'banner', file: { type?: string; fileSize?: number; width?: number; height?: number }): string | null {
  const rule = STORE_IMAGE_RULES[kind];
  const name = kind === 'logo' ? 'Logo' : 'Banner';
  if (file.type && !['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) return 'Use a PNG, JPG or WEBP image';
  if (file.fileSize && file.fileSize > rule.maxMb * 1024 * 1024) return `${name} must be ${rule.maxMb} MB or smaller`;
  if (file.width && file.height) {
    // A banner of any shape is fine as long as an 8:3 crop of it is big enough.
    const w = kind === 'banner' ? Math.min(file.width, (file.height * 8) / 3) : file.width;
    const h = kind === 'banner' ? Math.min(file.height, (file.width * 3) / 8) : file.height;
    if (w < rule.min.width || h < rule.min.height) return `${name} must be at least ${rule.min.width} × ${rule.min.height} px`;
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
  { step: 1, label: 'Business Details', backendSteps: [1, 2] },
  { step: 2, label: 'Store Setup', backendSteps: [3] },
  { step: 3, label: 'GST & Documents', backendSteps: [4, 5], optional: true },
  { step: 4, label: 'Review & Submit', backendSteps: [6] },
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
  if (!words) return 'Store description is required';
  if (words < DESCRIPTION_MIN_WORDS) return `Store description must be at least ${DESCRIPTION_MIN_WORDS} words (currently ${words})`;
  if (plainText(f.description).length > DESCRIPTION_MAX) return `Description can be at most ${DESCRIPTION_MAX} characters`;
  const missing = [!f.name.trim() ? 'Store Name' : null, !f.businessType ? 'Business Type' : null, !f.businessCategory.trim() ? 'Business Category' : null].filter(Boolean);
  if (missing.length) return `Please fill in: ${missing.join(', ')}`;
  if (f.name.trim().length > 150) return 'The store name can be at most 150 characters';
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
  { key: 'STORE_LOGO', label: 'Store Logo', requiredWithGst: true, requiredWithoutGst: false },
  { key: 'STORE_BANNER', label: 'Store Banner', requiredWithGst: true, requiredWithoutGst: false },
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
    return required ? `Required for stores ${gst ? 'registered with' : 'without'} GST.` : 'Optional';
  }
  if (rule.requiredWithGst && rule.requiredWithoutGst) return 'Required';
  if (rule.requiredWithGst) return 'Required if you register with GST (next step); optional without GST.';
  if (rule.requiredWithoutGst) return 'Required if you register without GST (next step).';
  return 'Optional';
}
