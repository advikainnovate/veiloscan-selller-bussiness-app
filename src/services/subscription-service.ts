import { api, STORE_HEADER } from '../lib/api';

// The seller's plan (eshop-backend src/modules/subscriptions, GET
// /subscriptions/me). Presentation only: the API enforces the same gates.
export interface MySubscription {
  plan: {
    planCode?: string;
    planName?: string;
    status?: string | null;
      tier?: number;
    /** The free fallback plan: no billing details. */
    isDefault?: boolean;
    billingCycle?: 'MONTHLY' | 'YEARLY' | null;
    amount?: number | null;
    currency?: string | null;
    trialEndsAt?: string | null;
    currentPeriodEnd?: string | null;
    startedAt?: string | null;
    autoRenew?: boolean;
  } | null;
  /** The plan includes All Stores (the consolidated dashboard). */
  consolidatedDashboard: boolean;
}

export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStage = 'PENDING' | 'TRIAL' | 'COMPLIMENTARY' | 'ACTIVE' | 'RENEWAL_DUE' | 'CANCELLED' | 'PAUSED' | 'EXPIRED';
export type FeatureTier = 'NONE' | 'BASIC' | 'STANDARD' | 'ADVANCED' | 'CUSTOM' | null;

export interface PlanFeatureDetail {
  featureCode: string;
  featureName: string;
  description: string | null;
  isEnabled: boolean;
  /** Null while enabled means unlimited. */
  limitValue: number | null;
  tier: FeatureTier;
  /** Worded by the backend, as the pricing page says it. */
  displayValue: string;
}

/** GET /subscriptions/me/plan: the plan in full (Seller Panel › Subscription). */
export interface PlanDetails {
  /** From the seller's own subscription, or the free fallback plan before buying one. */
  source: 'SUBSCRIPTION' | 'DEFAULT_PLAN';
  plan: { planCode: string; planName: string; description: string | null; targetSeller: string | null; tier: number; trialDays: number; highlights: string[]; isDefault: boolean };
  subscription: {
    idd: string;
    status: string;
    billingCycle: BillingCycle;
    amount: number | null;
    currency: string;
    taxRatePercent: number | null;
    autoRenew: boolean;
    startedAt: string | null;
    trialStartAt: string | null;
    trialEndAt: string | null;
    /** The one free month a 100% discount gives, after any trial. */
    complimentaryStartAt: string | null;
    complimentaryEndAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    nextBillingAt: string | null;
    /** While renewal is due: the plan stays until this, then expires. */
    graceEndAt: string | null;
    stage: SubscriptionStage;
  } | null;
  modules: { module: string; features: PlanFeatureDetail[] }[];
}

export interface FeatureUsage {
  featureCode: string;
  featureName: string;
  scope: 'ACCOUNT' | 'STORE';
  isEnabled: boolean;
  /** For STORE scope this is per store; null is unlimited. */
  limitValue: number | null;
  /** What the allowance adds up to across every store. */
  allowed: number | null;
  used: number;
  /** Null is unlimited. */
  remaining: number | null;
  /** Whether `stores` carries a real breakdown (staff accounts can only be totalled). */
  perStore: boolean;
  stores: { storeId: string; storeName: string; used: number; remaining: number | null }[];
}

export interface MyPlanResponse {
  isPlatformAdmin: boolean;
  details: PlanDetails | null;
  usage: FeatureUsage[];
}

/** What renewing costs and covers: today's price with GST, for the period after current access. */
export interface RenewalQuote {
  stage: SubscriptionStage;
  planCode: string;
  planName: string;
  billingCycle: BillingCycle;
  currency: string;
  isTaxInclusive: boolean;
  taxRatePercent: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  accessEndsAt: string | null;
  graceEndAt: string | null;
  canRenew: boolean;
  opensAt: string;
}

/** A payment for the plan; how it was paid is set by whoever sold it. */
export interface MyPayment {
  idd: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: string;
  discountAmount: string;
  currency: string;
  method: 'ONLINE' | 'CASH' | 'COMPLIMENTARY';
  status: 'PAID' | 'PENDING' | 'AWAITING_VERIFICATION' | 'REJECTED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  invoiceNumber: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface CataloguePlan {
  planCode: string;
  planName: string;
  tier: number;
  description: string | null;
  targetSeller: string | null;
  pricingModel: 'FIXED' | 'CUSTOM' | string;
  trialDays: number;
  isRecommended: boolean;
  isDefault: boolean;
  highlights: string[];
  /** Amount null on a quote-only plan; the price's trial wins over the plan's. */
  prices: { billingCycle: BillingCycle; amount: number | null; currency: string; isTaxInclusive: boolean; trialDays: number }[];
}

export interface ChangedSubscription {
  planCode: string;
  planName: string;
  billingCycle: BillingCycle;
  status: string;
  trialEndsAt: string | null;
}

// About the whole account, not the selected store.
const allStores = { headers: { [STORE_HEADER]: '' } };
const data = <T>(p: Promise<{ data: T }>) => p.then(res => res.data);

export const subscriptionService = {
  mine(): Promise<MySubscription> {
    return api.get('/subscriptions/me', allStores).then(res => res.data);
  },
  planDetails: () => data<MyPlanResponse>(api.get('/subscriptions/me/plan', allStores)),
  payments: () => data<MyPayment[]>(api.get('/subscriptions/me/payments', allStores)).then(r => (Array.isArray(r) ? r : [])),
  renewal: () => data<RenewalQuote>(api.get('/subscriptions/renewal', allStores)),
  /** The public catalogue the marketplace pricing page reads: only plans on sale. */
  catalogue: () => data<{ plans: CataloguePlan[] }>(api.get('/public/subscription-plans', allStores)),
  /** Never bought a plan: opens the chosen plan's trial. */
  start: (planCode: string, billingCycle: BillingCycle) => data<ChangedSubscription>(api.post('/subscriptions/start', { planCode, billingCycle }, allStores)),
  /** Already on one. A downgrade the account can't fit into is refused, naming what's over. */
  change: (planCode: string, billingCycle: BillingCycle) => data<ChangedSubscription>(api.post('/subscriptions/change', { planCode, billingCycle }, allStores)),
};
