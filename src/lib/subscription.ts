// The Subscription screen's wording and arithmetic, as the Seller Panel's
// components/dashboard/subscription (plan-overview, usage-meter,
// change-plan, payment-history).
import type { BadgeTone } from '../components/ui/Badge';
import type { BillingCycle, CataloguePlan, FeatureUsage, MyPayment, PlanDetails, RenewalQuote, SubscriptionStage } from '../services/subscription-service';
import i18n from '../i18n';

const DAY = 86_400_000;

export const titleCase = (v: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '');

export const day = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const money = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);

export const daysLeft = (until: string | null | undefined, now = Date.now()) => (until ? Math.max(0, Math.ceil((new Date(until).getTime() - now) / DAY)) : null);

/** How far through a window today is, 0–1; null when either end is unknown. */
export function elapsed(from: string | null | undefined, to: string | null | undefined, now = Date.now()): number | null {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const span = new Date(to).getTime() - start;
  if (span <= 0) return null;
  return Math.min(1, Math.max(0, (now - start) / span));
}

/** Each stage on the navy plan card: label and a colour that reads on navy. */
export const STAGE: Record<SubscriptionStage, { label: string; color: string; tint: string }> = {
  PENDING: { get label() { return i18n.t('common.awaitingPayment'); }, color: '#fde68a', tint: 'rgba(251,191,36,0.16)' },
  TRIAL: { get label() { return i18n.t('subscription.freeTrial'); }, color: '#bae6fd', tint: 'rgba(56,189,248,0.16)' },
  COMPLIMENTARY: { get label() { return i18n.t('subscription.complimentaryMonth'); }, color: '#a7f3d0', tint: 'rgba(52,211,153,0.16)' },
  ACTIVE: { get label() { return i18n.t('common.active'); }, color: '#a7f3d0', tint: 'rgba(52,211,153,0.16)' },
  RENEWAL_DUE: { get label() { return i18n.t('subscription.renewalDue'); }, color: '#fde68a', tint: 'rgba(251,191,36,0.16)' },
  CANCELLED: { get label() { return i18n.t('common.cancelled'); }, color: '#e2e8f0', tint: 'rgba(255,255,255,0.1)' },
  PAUSED: { get label() { return i18n.t('common.paused'); }, color: '#e2e8f0', tint: 'rgba(255,255,255,0.1)' },
  EXPIRED: { get label() { return i18n.t('common.expired'); }, color: '#fecdd3', tint: 'rgba(251,113,133,0.16)' },
};

export interface PlanState {
  stage: SubscriptionStage | null;
  urgent: boolean;
  message: string;
  /** The window the progress bar measures, if any. */
  phase: { label: string; from: string | null | undefined; to: string | null | undefined } | null;
  progress: number | null;
  left: number | null;
  /** `trial` marks the free-trial dates, which never show as urgent. */
  dates: { label: string; value: string; kind?: 'trial' }[];
}

/** Where the plan stands — trial, complimentary, paid, renewal due or expired — as the panel's plan card. */
export function planState(details: PlanDetails, renewal: RenewalQuote | null, now = Date.now()): PlanState {
  const sub = details.subscription;
  // An expired plan no longer shows on the details; the renewal quote still knows it.
  const stage: SubscriptionStage | null = sub?.stage ?? renewal?.stage ?? null;
  const accessEnd = sub?.currentPeriodEnd ?? renewal?.accessEndsAt ?? null;
  const graceEnd = sub?.graceEndAt ?? renewal?.graceEndAt ?? null;
  const phase =
    stage === 'TRIAL'
      ? { label: i18n.t('subscription.freeTrial'), from: sub?.trialStartAt, to: sub?.trialEndAt }
      : stage === 'COMPLIMENTARY'
        ? { label: i18n.t('subscription.complimentaryMonth'), from: sub?.complimentaryStartAt, to: sub?.complimentaryEndAt }
        : stage === 'RENEWAL_DUE'
          ? { label: i18n.t('subscription.gracePeriod'), from: accessEnd, to: graceEnd }
          : stage === 'EXPIRED' || !stage
            ? null
            : { label: i18n.t('subscription.currentPeriod'), from: sub?.currentPeriodStart, to: accessEnd };
  const messages: Record<SubscriptionStage, string> = {
    TRIAL: sub?.complimentaryStartAt
      ? i18n.t('subscription.freeTrialActiveYourComplimentaryMonth')
      : i18n.t('subscription.freeTrialActiveYourPaidPlan'),
    COMPLIMENTARY: i18n.t('subscription.complimentaryAccessActiveRenewYourPlan', { accessEnd: day(accessEnd) }),
    // An assigned free plan has no end date.
    ACTIVE: accessEnd ? i18n.t('subscription.yourPlanIsActiveUntilAccessend', { accessEnd: day(accessEnd) }) : i18n.t('subscription.yourPlanIsActiveWithNothing'),
    RENEWAL_DUE: graceEnd ? i18n.t('subscription.freeAccessEndedGraceUntil', { date: day(graceEnd) }) : i18n.t('subscription.freeAccessEnded'),
    EXPIRED: i18n.t('subscription.yourSubscriptionHasExpiredAndPaid'),
    PENDING: i18n.t('subscription.yourPlanPurchaseIsAwaitingPayment'),
    CANCELLED: i18n.t('subscription.yourPlanIsCancelledAndRuns', { accessEnd: day(accessEnd) }),
    PAUSED: i18n.t('subscription.yourPlanIsPausedContactSupport'),
  };
  const dates = [
    sub?.trialStartAt ? { label: i18n.t('subscription.freeTrial'), value: `${day(sub.trialStartAt)} – ${day(sub.trialEndAt)}`, kind: 'trial' as const } : null,
    sub?.complimentaryStartAt ? { label: i18n.t('subscription.complimentaryMonth'), value: `${day(sub.complimentaryStartAt)} – ${day(sub.complimentaryEndAt)}` } : null,
    stage ? { label: stage === 'EXPIRED' ? i18n.t('subscription.expiredAfter') : i18n.t('subscription.renewalDue'), value: day(sub?.nextBillingAt ?? accessEnd) } : null,
  ].filter((d): d is { label: string; value: string; kind?: 'trial' } => d !== null);
  return {
    stage,
    urgent: stage === 'RENEWAL_DUE' || stage === 'EXPIRED',
    message: stage ? messages[stage] : i18n.t('subscription.youReOnTheFreePlan'),
    phase,
    progress: phase ? elapsed(phase.from, phase.to, now) : null,
    left: phase ? daysLeft(phase.to, now) : null,
    dates,
  };
}

// ── Usage ────────────────────────────────────────────────────────────────

const n = (v: number) => v.toLocaleString('en-IN');

/** Spent share, 0–1; unlimited and zero allowances never read as full. */
export function spentShare(u: FeatureUsage) {
  if (u.allowed === null || u.allowed <= 0) return 0;
  return Math.min(1, u.used / u.allowed);
}

export type UsageLevel = 'off' | 'unlimited' | 'full' | 'near' | 'ok';
export function usageLevel(u: FeatureUsage): UsageLevel {
  if (!u.isEnabled) return 'off';
  if (u.remaining === null) return 'unlimited';
  if (u.remaining === 0) return 'full';
  return spentShare(u) >= 0.8 ? 'near' : 'ok';
}

/** "3 of 5 used" / "12 used · unlimited" / "Not included". */
export const usageLabel = (u: FeatureUsage) => (!u.isEnabled ? i18n.t('common.notIncluded') : u.allowed === null ? i18n.t('subscription.usedUsedUnlimited', { used: n(u.used) }) : i18n.t('common.usedOfAllowedUsed', { used: n(u.used), allowed: n(u.allowed) }));
/** "2 left". */
export const pendingLabel = (u: FeatureUsage) => (!u.isEnabled ? '—' : u.remaining === null ? i18n.t('common.noLimit') : u.remaining === 0 ? i18n.t('common.noneLeft') : i18n.t('common.remainingLeft', { remaining: n(u.remaining) }));

// ── Payments ─────────────────────────────────────────────────────────────

export const PAYMENT_METHOD: Record<MyPayment['method'], string> = { get ONLINE() { return i18n.t('subscription.online'); }, get CASH() { return i18n.t('common.cash'); }, get COMPLIMENTARY() { return i18n.t('subscription.complimentary'); } };
export const PAYMENT_STATUS: Record<MyPayment['status'], { label: string; tone: BadgeTone }> = {
  PAID: { get label() { return i18n.t('common.paid'); }, tone: 'green' },
  PENDING: { get label() { return i18n.t('common.awaitingPayment'); }, tone: 'amber' },
  AWAITING_VERIFICATION: { get label() { return i18n.t('subscription.awaitingVerification'); }, tone: 'amber' },
  REJECTED: { get label() { return i18n.t('subscription.notAccepted'); }, tone: 'red' },
  FAILED: { get label() { return i18n.t('common.failed'); }, tone: 'red' },
  REFUNDED: { get label() { return i18n.t('common.refunded'); }, tone: 'slate' },
  PARTIALLY_REFUNDED: { get label() { return i18n.t('subscription.partRefunded'); }, tone: 'slate' },
};

// ── Changing plan ────────────────────────────────────────────────────────

/** Only what deciding a move needs. */
export interface CurrentPlan {
  planCode: string;
  planName: string;
  tier: number;
  isDefault: boolean;
  billingCycle: BillingCycle | null;
  status: string | null;
}

export type Move = 'current' | 'upgrade' | 'downgrade' | 'cycle' | 'custom' | 'unavailable';
export const MOVE_LABEL: Record<Move, string> = {
  get current() { return i18n.t('subscription.currentPlan'); },
  get upgrade() { return i18n.t('common.upgrade'); },
  get downgrade() { return i18n.t('subscription.downgrade'); },
  cycle: 'Switch billing',
  get custom() { return i18n.t('subscription.contactSales'); },
  get unavailable() { return i18n.t('subscription.notAvailable'); },
};

export const priceOn = (plan: CataloguePlan, cycle: BillingCycle) => plan.prices.find(p => p.billingCycle === cycle && p.amount !== null);

export function moveFor(plan: CataloguePlan, current: CurrentPlan, cycle: BillingCycle): Move {
  if (plan.pricingModel === 'CUSTOM') return 'custom';
  if (!priceOn(plan, cycle)) return 'unavailable';
  // On the free fallback plan nothing's been bought, so every paid plan is an upgrade.
  if (current.isDefault) return 'upgrade';
  if (plan.planCode === current.planCode) return current.billingCycle === cycle ? 'current' : 'cycle';
  return plan.tier > current.tier ? 'upgrade' : 'downgrade';
}

export const cycleNoun = (cycle: BillingCycle) => (cycle === 'YEARLY' ? 'year' : 'month');

/** Only account owners may commit the account to a plan; staff get a 403. */
export const canChangePlan = (userType: unknown) => userType === 'SELLER' || userType === 'CLIENT';
