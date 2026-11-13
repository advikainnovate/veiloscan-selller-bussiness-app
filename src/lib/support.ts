// Support labels, SLA wording and the new-ticket rules, as the Seller Panel's
// src/lib/support.ts and new-ticket-modal.tsx.
import type { BadgeTone } from '../components/ui/Badge';
export { htmlToText } from './format';
import type { SupportTicketSummary, TicketPriority, TicketStatus, TicketTypeDef } from '../services/support-service';
import i18n from '../i18n';

export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_STORE', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED'];

export const STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { get label() { return i18n.t('common.open'); }, tone: 'blue' },
  IN_PROGRESS: { get label() { return i18n.t('common.inProgress'); }, tone: 'amber' },
  WAITING_FOR_CUSTOMER: { get label() { return i18n.t('common.waitingForCustomer'); }, tone: 'violet' },
  WAITING_FOR_STORE: { get label() { return i18n.t('support.waitingForStore'); }, tone: 'violet' },
  ESCALATED: { get label() { return i18n.t('support.escalated'); }, tone: 'red' },
  RESOLVED: { get label() { return i18n.t('support.resolved'); }, tone: 'green' },
  CLOSED: { get label() { return i18n.t('common.closed'); }, tone: 'slate' },
  REOPENED: { get label() { return i18n.t('support.reopened'); }, tone: 'amber' },
};
export const statusOf = (s: string) => STATUS[s as TicketStatus] ?? { label: s, tone: 'slate' as BadgeTone };

export const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const PRIORITY_TONE: Record<TicketPriority, BadgeTone> = { LOW: 'slate', MEDIUM: 'blue', HIGH: 'amber', URGENT: 'red' };
export const priorityLabel = (p: string) => p.charAt(0) + p.slice(1).toLowerCase();

export const SOURCE_LABEL: Record<string, string> = {
  get WEB() { return i18n.t('common.website'); },
  get APP() { return i18n.t('support.mobileApp'); },
  get EMAIL() { return i18n.t('common.email'); },
  get PHONE() { return i18n.t('common.phone'); },
  WHATSAPP: 'WhatsApp',
  get ADMIN() { return i18n.t('support.adminPanel'); },
  get STORE() { return i18n.t('support.storePanel'); },
  get SYSTEM() { return i18n.t('common.system'); },
};
/** How a store team logs a ticket for someone who got in touch. */
export const STAFF_SOURCES = ['PHONE', 'EMAIL', 'WHATSAPP', 'STORE'];

export const QUEUES = [
  { value: '', get label() { return i18n.t('common.all'); } },
  { value: 'active', get label() { return i18n.t('common.active'); } },
  { value: 'mine', get label() { return i18n.t('support.assignedToMe'); } },
  { value: 'unassigned', get label() { return i18n.t('support.unassigned'); } },
  { value: 'overdue', get label() { return i18n.t('common.overdue'); } },
  { value: 'urgent', get label() { return i18n.t('common.urgent'); } },
  { value: 'escalated', get label() { return i18n.t('support.escalated'); } },
];

export const EVENT_LABEL: Record<string, string> = {
  get TICKET_CREATED() { return i18n.t('support.ticketCreated'); },
  get STATUS_CHANGED() { return i18n.t('common.statusChanged'); },
  get PRIORITY_CHANGED() { return i18n.t('support.priorityChanged'); },
  get CATEGORY_CHANGED() { return i18n.t('support.categoryChanged'); },
  get FIELDS_UPDATED() { return i18n.t('support.detailsUpdated'); },
  get ASSIGNED() { return i18n.t('support.assigned'); },
  get UNASSIGNED() { return i18n.t('support.unassigned'); },
  get ESCALATED() { return i18n.t('support.escalated'); },
  get ESCALATION_UPDATED() { return i18n.t('support.escalationUpdated'); },
  get MESSAGE_ADDED() { return i18n.t('support.messageAdded'); },
  get MESSAGE_EDITED() { return i18n.t('support.messageEdited'); },
  get ATTACHMENT_ADDED() { return i18n.t('support.fileAttached'); },
  get ATTACHMENT_DOWNLOADED() { return i18n.t('support.fileDownloaded'); },
  get FIRST_RESPONSE() { return i18n.t('support.firstResponse'); },
  get SLA_APPLIED() { return i18n.t('support.slaApplied'); },
  get SLA_WARNING() { return i18n.t('support.slaWarning'); },
  get SLA_BREACHED() { return i18n.t('support.slaBreached'); },
  get FEEDBACK_SUBMITTED() { return i18n.t('support.feedbackSubmitted'); },
  get TICKET_DELETED() { return i18n.t('support.ticketDeleted'); },
};

export const isActiveStatus = (s: TicketStatus) => s !== 'RESOLVED' && s !== 'CLOSED';

/** 95 → "1h 35m", 3000 → "2d 2h". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days) return hours ? `${days}d ${hours}h` : `${days}d`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

/** An SLA deadline: met / missed once done, else how long is left (amber inside two hours, red once overdue). */
export function slaState(due: string | null, done: string | null, overdue: boolean, now = Date.now()): { text: string; tone: 'ok' | 'soon' | 'late' | 'none' } {
  if (!due) return { text: i18n.t('support.noSla'), tone: 'none' };
  if (done) return new Date(done).getTime() <= new Date(due).getTime() ? { text: i18n.t('support.slaMet'), tone: 'ok' } : { text: i18n.t('support.slaMissed'), tone: 'late' };
  const diff = (new Date(due).getTime() - now) / 60000;
  if (overdue || diff < 0) return { text: i18n.t('support.minutesOverdue', { minutes: formatMinutes(Math.abs(diff)) }), tone: 'late' };
  return { text: i18n.t('support.slaIn', { time: formatMinutes(diff) }), tone: diff < 120 ? 'soon' : 'none' };
}

/** The customer wrote after the store's last reply. */
export const customerReplied = (t: Pick<SupportTicketSummary, 'lastCustomerMessageAt' | 'lastStaffMessageAt'>) =>
  !!t.lastCustomerMessageAt && (!t.lastStaffMessageAt || t.lastCustomerMessageAt > t.lastStaffMessageAt);

export const requesterName = (t: SupportTicketSummary) => t.customer.name ?? t.customer.phone ?? t.customer.email ?? '—';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return i18n.t('support.fixedKb', { fixed: (bytes / 1024).toFixed(0) });
  return i18n.t('support.fixedMb', { fixed: (bytes / 1024 / 1024).toFixed(1) });
}


/** Plain text typed on the phone, as the paragraphs the panel's editor would send. */
export function textToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .trim()
    .split(/\n{2,}/)
    .map(p => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** "status: OPEN → IN_PROGRESS", from an audit event's values. */
export function describeChange(oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null): string {
  const keys = [...new Set([...Object.keys(oldValue ?? {}), ...Object.keys(newValue ?? {})])].filter(k => !/Id$/.test(k) || k === 'assignedTo');
  const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? '…' : String(v).slice(0, 40));
  return keys
    .slice(0, 4)
    .map(k => (oldValue && k in oldValue ? `${k}: ${show(oldValue[k])} → ${show(newValue?.[k])}` : `${k}: ${show(newValue?.[k])}`))
    .join(', ');
}

// ─── New ticket ─────────────────────────────────────────────────────────────

export type Requester = 'store' | 'account' | 'guest';
export const REQUESTERS: { value: Requester; label: string }[] = [
  { value: 'store', get label() { return i18n.t('support.ourStore'); } },
  { value: 'account', get label() { return i18n.t('common.customer'); } },
  { value: 'guest', get label() { return i18n.t('support.guest'); } },
];

export interface TicketForm {
  ticketType: string;
  requester: Requester;
  customerId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  storeId: string;
  orderId: string;
  categoryId: string;
  subject: string;
  description: string;
  source: string;
  priority: string;
  relatedTicketId: string;
}

export const emptyTicket = (storeId: string, related?: string): TicketForm => ({
  ticketType: related ? 'ESCALATION' : 'SUPPORT_REQUEST',
  requester: 'store',
  customerId: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  storeId,
  orderId: '',
  categoryId: '',
  subject: '',
  description: '',
  source: 'PHONE',
  priority: '',
  relatedTicketId: related ?? '',
});

/** What's still missing, as the panel lists it ("Add the customer, a subject"), or null. */
export function ticketProblem(f: TicketForm, type: TicketTypeDef | undefined, storeRequired = true): string | null {
  const guest = f.requester === 'guest';
  const missing = [
    f.requester === 'account' && !f.customerId && !f.relatedTicketId && !f.orderId ? i18n.t('support.theCustomer') : null,
    guest && !f.contactPhone.trim() && !f.contactEmail.trim() && !f.orderId && !f.relatedTicketId ? i18n.t('support.aPhoneNumberOrEmail') : null,
    storeRequired && !f.storeId ? i18n.t('support.theStore') : null,
    type?.order === 'required' && !f.orderId ? i18n.t('support.theOrder') : null,
    type?.relatedTicket === 'required' && !f.relatedTicketId ? i18n.t('support.theEarlierTicket') : null,
    !f.categoryId ? i18n.t('support.aCategory') : null,
    !f.subject.trim() ? i18n.t('support.aSubject') : null,
    !f.description.trim() ? i18n.t('support.aDescription') : null,
  ].filter(Boolean);
  if (missing.length) return i18n.t('support.addJoin', { join: missing.join(', ') });
  if (f.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail.trim())) return i18n.t('common.enterAValidEmailAddress');
  return null;
}

export function ticketPayload(f: TicketForm, linkRelated: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ticketType: f.ticketType,
    categoryId: f.categoryId,
    subject: f.subject.trim(),
    description: textToHtml(f.description),
    source: f.source,
  };
  if (f.storeId) payload.storeId = f.storeId;
  if (f.requester === 'store') payload.requesterType = 'STORE';
  if (f.requester === 'account' && f.customerId) payload.customerId = f.customerId;
  if (f.requester === 'guest') {
    if (f.contactName.trim()) payload.contactName = f.contactName.trim();
    if (f.contactPhone.trim()) payload.contactPhone = f.contactPhone.trim();
    if (f.contactEmail.trim()) payload.contactEmail = f.contactEmail.trim();
  }
  if (f.orderId) payload.orderId = f.orderId;
  if (f.priority) payload.priority = f.priority;
  if (linkRelated && f.relatedTicketId) payload.relatedTicketId = f.relatedTicketId;
  return payload;
}

/** Ticket types for who it's for: store-only types (e.g. Category Request) only on the store's own request. */
export const typesFor = (types: TicketTypeDef[], requester: Requester) => types.filter(t => requester === 'store' || t.requester !== 'store');

/** Categories with their sub-categories, as "Parent › Child". */
export function categoryOptions(categories: { id: string; name: string; code: string; children: { id: string; name: string; code: string }[] }[]) {
  return categories.flatMap(c => [{ value: c.id, label: c.name, code: c.code }, ...c.children.map(ch => ({ value: ch.id, label: `${c.name} › ${ch.name}`, code: ch.code }))]);
}
