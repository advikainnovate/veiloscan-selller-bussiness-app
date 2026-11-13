import type { BadgeTone } from '../components/ui/Badge';
import i18n from '../i18n';

// Ported from the Seller Panel's components/dashboard/products/product-approval.ts.
// Mirrors ProductApprovalStatus in eshop-backend. A product goes
// Draft → Submit for approval (auto validation) → admin review →
// Approved (published) or Changes required (seller edits and resubmits).
export type ProductApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'CHANGES_REQUIRED' | 'APPROVED';

export type ProductStageKey = 'draft' | 'in_review' | 'changes_required' | 'published' | 'unpublished';

export interface ProductStage {
  key: ProductStageKey;
  label: string;
  tone: BadgeTone;
  description: string;
}

const STAGES: Record<ProductStageKey, ProductStage> = {
  draft: { key: 'draft', get label() { return i18n.t('common.draft'); }, tone: 'slate', get description() { return i18n.t('products.notVisibleToCustomersCompleteThe'); } },
  in_review: { key: 'in_review', get label() { return i18n.t('common.inReview'); }, tone: 'amber', get description() { return i18n.t('products.submittedForApprovalItGoesLive'); } },
  changes_required: {
    key: 'changes_required',
    get label() { return i18n.t('products.changesRequired'); },
    tone: 'orange',
    get description() { return i18n.t('products.theReviewerAskedForChangesUpdate'); },
  },
  published: { key: 'published', get label() { return i18n.t('products.published'); }, tone: 'green', get description() { return i18n.t('products.approvedAndLiveOnTheStorefront'); } },
  unpublished: { key: 'unpublished', get label() { return i18n.t('products.unpublished'); }, tone: 'red', get description() { return i18n.t('products.approvedButHiddenFromTheStorefront'); } },
};

type ProductLike = { approvalStatus?: unknown; status?: unknown; isActive?: unknown; [key: string]: unknown };

export function approvalStatusOf(record: ProductLike | null | undefined): ProductApprovalStatus {
  const value = record?.approvalStatus as ProductApprovalStatus | undefined;
  if (value) return value;
  // Older API without the workflow: live products count as approved.
  return Number(record?.status) === 1 ? 'APPROVED' : 'DRAFT';
}

export function isLive(record: ProductLike): boolean {
  return Number(record.status) === 1 && record.isActive !== false;
}

export function productStage(record: ProductLike): ProductStage {
  switch (approvalStatusOf(record)) {
    case 'PENDING_APPROVAL':
      return STAGES.in_review;
    case 'CHANGES_REQUIRED':
      return STAGES.changes_required;
    case 'APPROVED':
      return isLive(record) ? STAGES.published : STAGES.unpublished;
    default:
      return STAGES.draft;
  }
}

/** Only approved products can be made live; drafts and products sent back are submitted for approval instead. */
export const canPublish = (record: ProductLike) => approvalStatusOf(record) === 'APPROVED';

export function canSubmitForApproval(record: ProductLike): boolean {
  const status = approvalStatusOf(record);
  return status === 'DRAFT' || status === 'CHANGES_REQUIRED';
}
