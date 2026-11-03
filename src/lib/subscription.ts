// The Subscription screen's wording and arithmetic, as the Seller Panel's
// components/dashboard/subscription (plan-overview, usage-meter,
// change-plan, payment-history).
import type { BadgeTone } from '../components/ui/Badge';
import type { BillingCycle, CataloguePlan, FeatureUsage, MyPayment, PlanDetails, RenewalQuote, SubscriptionStage } from '../services/subscription-service';

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
  PENDING: { label: 'Awaiting payment', color: '#fde68a', tint: 'rgba(251,191,36,0.16)' },
  TRIAL: { label: 'Free trial', color: '#bae6fd', tint: 'rgba(56,189,248,0.16)' },
  COMPLIMENTARY: { label: 'Complimentary month', color: '#a7f3d0', tint: 'rgba(52,211,153,0.16)' },
  ACTIVE: { label: 'Active', color: '#a7f3d0', tint: 'rgba(52,211,153,0.16)' },
  RENEWAL_DUE: { label: 'Renewal due', color: '#fde68a', tint: 'rgba(251,191,36,0.16)' },
  CANCELLED: { label: 'Cancelled', color: '#e2e8f0', tint: 'rgba(255,255,255,0.1)' },
  PAUSED: { label: 'Paused', color: '#e2e8f0', tint: 'rgba(255,255,255,0.1)' },
  EXPIRED: { label: 'Expired', color: '#fecdd3', tint: 'rgba(251,113,133,0.16)' },
};

export interface PlanState {
  stage: SubscriptionStage | null;
  urgent: boolean;
  message: string;
  /** The window the progress bar measures, if any. */
  phase: { label: string; from: string | null | undefined; to: string | null | undefined } | null;
  progress: number | null;
  left: number | null;
  dates: { label: string; value: string }[];
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
      ? { label: 'Free trial', from: sub?.trialStartAt, to: sub?.trialEndAt }
      : stage === 'COMPLIMENTARY'
        ? { label: 'Complimentary month', from: sub?.complimentaryStartAt, to: sub?.complimentaryEndAt }
        : stage === 'RENEWAL_DUE'
          ? { label: 'Grace period', from: accessEnd, to: graceEnd }
          : stage === 'EXPIRED' || !stage
            ? null
            : { label: 'Current period', from: sub?.currentPeriodStart, to: accessEnd };
  const messages: Record<SubscriptionStage, string> = {
    TRIAL: sub?.complimentaryStartAt
      ? 'Free trial active. Your complimentary month starts after your trial ends.'
      : 'Free trial active. Your paid plan period starts after your trial ends.',
    COMPLIMENTARY: `Complimentary access active. Renew your plan before ${day(accessEnd)} to continue without interruption.`,
    // An assigned free plan has no end date.
    ACTIVE: accessEnd ? `Your plan is active until ${day(accessEnd)}.` : 'Your plan is active, with nothing to pay and no end date.',
    RENEWAL_DUE: `Your free access has ended. Renew your subscription to restore or continue paid-plan access${graceEnd ? ` — your plan stays until ${day(graceEnd)}` : ''}.`,
    EXPIRED: 'Your subscription has expired and paid-plan features are switched off. Renew to reactivate it.',
    PENDING: 'Your plan purchase is awaiting payment or approval.',
    CANCELLED: `Your plan is cancelled and runs until ${day(accessEnd)}.`,
    PAUSED: 'Your plan is paused. Contact support to resume it.',
  };
  const dates = [
    sub?.trialStartAt ? { label: 'Free trial', value: `${day(sub.trialStartAt)} – ${day(sub.trialEndAt)}` } : null,
    sub?.complimentaryStartAt ? { label: 'Complimentary month', value: `${day(sub.complimentaryStartAt)} – ${day(sub.complimentaryEndAt)}` } : null,
    stage ? { label: stage === 'EXPIRED' ? 'Expired after' : 'Renewal due', value: day(sub?.nextBillingAt ?? accessEnd) } : null,
  ].filter((d): d is { label: string; value: string } => d !== null);
  return {
    stage,
    urgent: stage === 'RENEWAL_DUE' || stage === 'EXPIRED',
    message: stage ? messages[stage] : "You're on the free plan. Choose a paid plan to unlock higher limits and more features.",
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
export const usageLabel = (u: FeatureUsage) => (!u.isEnabled ? 'Not included' : u.allowed === null ? `${n(u.used)} used · unlimited` : `${n(u.used)} of ${n(u.allowed)} used`);
/** "2 left". */
export const pendingLabel = (u: FeatureUsage) => (!u.isEnabled ? '—' : u.remaining === null ? 'No limit' : u.remaining === 0 ? 'None left' : `${n(u.remaining)} left`);

// ── Payments ─────────────────────────────────────────────────────────────

export const PAYMENT_METHOD: Record<MyPayment['method'], string> = { ONLINE: 'Online', CASH: 'Cash', COMPLIMENTARY: 'Complimentary' };
export const PAYMENT_STATUS: Record<MyPayment['status'], { label: string; tone: BadgeTone }> = {
  PAID: { label: 'Paid', tone: 'green' },
  PENDING: { label: 'Awaiting payment', tone: 'amber' },
  AWAITING_VERIFICATION: { label: 'Awaiting verification', tone: 'amber' },
  REJECTED: { label: 'Not accepted', tone: 'red' },
  FAILED: { label: 'Failed', tone: 'red' },
  REFUNDED: { label: 'Refunded', tone: 'slate' },
  PARTIALLY_REFUNDED: { label: 'Part refunded', tone: 'slate' },
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
  current: 'Current plan',
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  cycle: 'Switch billing',
  custom: 'Contact sales',
  unavailable: 'Not available',
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
