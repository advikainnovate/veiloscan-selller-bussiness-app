import { api, STORE_HEADER } from '../lib/api';
import type { BrandingRequirement } from '../lib/store-manage';

// Managing one store (eshop-backend src/modules/store), as the Seller Panel's
// store page. Viewing needs stores:view, changes stores:edit, closing
// stores:delete. Every section saves through its own endpoint.

export type Rec = Record<string, unknown>;

export interface StoreRecord extends Rec {
  id: string;
  name: string;
  code: string;
  slug: string | null;
  status: string;
  approvalStatus: string | null;
  onboardingStatus: string | null;
  businessType: string | null;
  businessCategory: string | null;
  description: string | null;
  timezone: string | null;
  currency: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: Rec | null;
  settings?: Rec | null;
  config?: Rec | null;
  taxDetails?: Rec | null;
  branding?: Rec | null;
  documents?: Rec[];
  businessHours?: Rec[];
}

/** Where a store's onboarding stands (GET /store-onboarding/:id and every step save). */
export interface OnboardingProgress {
  store: StoreRecord;
  steps: { step: number; key: string; required: boolean; completed: boolean }[];
  missingSteps: string[];
  missingDocuments?: string[];
  missingBranding?: string[];
  canComplete: boolean;
}

/** One plan allowance (GET /subscriptions/me/usage); null is unlimited. */
export interface FeatureUsage {
  featureCode: string;
  featureName: string;
  isEnabled: boolean;
  allowed: number | null;
  used: number;
  remaining: number | null;
}

export interface DocumentRequirement {
  key: string;
  label: string;
  types: string[];
  gstOnly: boolean;
  requiredWithGst: boolean;
  requiredWithoutGst: boolean;
}

const base = (id: string) => `/stores/${id}`;
const onboarding = (id: string) => `/store-onboarding/${id}`;
// Account-wide: sent without a store so none narrows them.
const allStores = { headers: { [STORE_HEADER]: '' } };
const data = <T>(p: Promise<{ data: T }>) => p.then(res => res.data);

export const storeManageService = {
  /** Every store the seller holds, with owner, settings, GST and branding. */
  list: () => data<StoreRecord[]>(api.get('/stores', allStores)).then(r => (Array.isArray(r) ? r : [])),
  /** The plan's store allowance, if it has one. */
  storeUsage: () =>
    data<{ isPlatformAdmin?: boolean; usage?: FeatureUsage[] }>(api.get('/subscriptions/me/usage', allStores)).then(r =>
      r.isPlatformAdmin ? null : (r.usage ?? []).find(u => u.featureCode === 'STORE_LIMIT') ?? null,
    ),
  get: (id: string) => data<StoreRecord>(api.get(base(id))),
  update: (id: string, payload: Rec) => data<StoreRecord>(api.patch(base(id), payload)),
  /** Closes the store. */
  remove: (id: string) => data(api.delete(base(id))),
  updateSettings: (id: string, payload: Rec) => data(api.put(`${base(id)}/settings`, payload)),
  updateConfig: (id: string, payload: Rec) => data(api.put(`${base(id)}/config`, payload)),
  updateBranding: (id: string, payload: Rec) => data(api.put(`${base(id)}/branding`, payload)),
  updateBusinessHours: (id: string, hours: Rec[]) => data(api.put(`${base(id)}/business-hours`, { hours })),
  updateTaxDetails: (id: string, payload: Rec) => data(api.put(`${base(id)}/tax-details`, payload)),
  addDocument: (id: string, payload: Rec) => data(api.post(`${base(id)}/documents`, payload)),
  removeDocument: (id: string, documentId: string) => data(api.delete(`${base(id)}/documents/${documentId}`)),
  /** A new file for a rejected document: it goes back for review. */
  reuploadDocument: (id: string, documentId: string, payload: Rec) => data(api.post(`${base(id)}/documents/${documentId}/reupload`, payload)),
  approvalHistory: (id: string) => data<Rec[]>(api.get(`${base(id)}/approval-history`)).then(r => (Array.isArray(r) ? r : [])),
  /** Which documents stores must upload, as the platform has set it. */
  documentRequirements: () => data<DocumentRequirement[]>(api.get('/store-document-requirements')),
  /** Whether stores need a logo / banner, with and without GST. */
  brandingRequirements: () => data<BrandingRequirement[]>(api.get('/store-document-requirements/branding')),

  // ── Add New Store (the backend's six-step onboarding; needs stores:create to start) ──
  startOnboarding: (payload: Rec) => data<OnboardingProgress>(api.post('/store-onboarding', payload, allStores)),
  getOnboarding: (id: string) => data<OnboardingProgress>(api.get(onboarding(id))),
  saveBusinessDetails: (id: string, payload: Rec) => data<OnboardingProgress>(api.put(`${onboarding(id)}/business-details`, payload)),
  saveStoreDetails: (id: string, payload: Rec) => data<OnboardingProgress>(api.put(`${onboarding(id)}/store-details`, payload)),
  saveAddressContact: (id: string, payload: Rec) => data<OnboardingProgress>(api.put(`${onboarding(id)}/address-contact`, payload)),
  saveGstDetails: (id: string, payload: Rec) => data<OnboardingProgress>(api.put(`${onboarding(id)}/gst-details`, payload)),
  addOnboardingDocument: (id: string, payload: Rec) => data<OnboardingProgress>(api.post(`${onboarding(id)}/documents`, payload)),
  removeOnboardingDocument: (id: string, documentId: string) => data<OnboardingProgress>(api.delete(`${onboarding(id)}/documents/${documentId}`)),
  setOnboardingStep: (id: string, step: number) => data<OnboardingProgress>(api.patch(`${onboarding(id)}/step`, { step })),
  /** Sends the store for approval; it stays a draft until approved. */
  completeOnboarding: (id: string) => data<OnboardingProgress>(api.post(`${onboarding(id)}/complete`, { activate: false })),
};
