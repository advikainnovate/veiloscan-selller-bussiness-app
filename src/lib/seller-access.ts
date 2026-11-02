// This app is for sellers only: SELLER accounts and their staff (SELLER_USER).
// The API enforces this at login; the app also checks any saved session.
export const SELLER_APP_TYPES = ['SELLER', 'SELLER_USER'];

export function canUseSellerApp(userType: unknown): boolean {
  return SELLER_APP_TYPES.includes(userType as string);
}

export const NOT_SELLER_MESSAGE =
  "This account can't use VeiloScan Business. Sign in with a seller account.";

// A seller the Sales Portal onboarded can't sign in until their plan is
// active; the API names the pending step in the login error's `errorCode`.
export const ONBOARDING_STEPS = ['Account verified', 'Store registered', 'Store approved', 'Subscription active'] as const;

const PENDING_STEP: Record<string, { index: number; label: string }> = {
  SELLER_STEP_STORE_REGISTRATION: { index: 1, label: 'Store registration pending' },
  SELLER_STEP_STORE_CHANGES: { index: 1, label: 'Store changes requested' },
  SELLER_STEP_STORE_REVIEW: { index: 2, label: 'Awaiting store approval' },
  SELLER_STEP_SUBSCRIPTION: { index: 3, label: 'Subscription not assigned' },
  SELLER_STEP_PAYMENT: { index: 3, label: 'Subscription payment pending' },
  SELLER_STEP_CASH_VERIFICATION: { index: 3, label: 'Cash payment being verified' },
};

export type PendingStep = { index: number; label: string };

/** The onboarding step a login was refused at, if that is why it was refused. */
export function pendingOnboardingStep(errorCode: unknown): PendingStep | null {
  return typeof errorCode === 'string' ? PENDING_STEP[errorCode] ?? null : null;
}
