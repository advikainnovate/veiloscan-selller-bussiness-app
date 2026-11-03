// Support labels, SLA wording and the new-ticket rules, as the Seller Panel's
// src/lib/support.ts and new-ticket-modal.tsx.
import type { BadgeTone } from '../components/ui/Badge';
import type { SupportTicketSummary, TicketPriority, TicketStatus, TicketTypeDef } from '../services/support-service';

export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_STORE', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED'];

export const STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Open', tone: 'blue' },
  IN_PROGRESS: { label: 'In progress', tone: 'amber' },
  WAITING_FOR_CUSTOMER: { label: 'Waiting for customer', tone: 'violet' },
  WAITING_FOR_STORE: { label: 'Waiting for store', tone: 'violet' },
  ESCALATED: { label: 'Escalated', tone: 'red' },
  RESOLVED: { label: 'Resolved', tone: 'green' },
  CLOSED: { label: 'Closed', tone: 'slate' },
  REOPENED: { label: 'Reopened', tone: 'amber' },
};
export const statusOf = (s: string) => STATUS[s as TicketStatus] ?? { label: s, tone: 'slate' as BadgeTone };

export const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const PRIORITY_TONE: Record<TicketPriority, BadgeTone> = { LOW: 'slate', MEDIUM: 'blue', HIGH: 'amber', URGENT: 'red' };
export const priorityLabel = (p: string) => p.charAt(0) + p.slice(1).toLowerCase();

export const SOURCE_LABEL: Record<string, string> = {
  WEB: 'Website',
  APP: 'Mobile app',
  EMAIL: 'Email',
  PHONE: 'Phone',
  WHATSAPP: 'WhatsApp',
  ADMIN: 'Admin panel',
  STORE: 'Store panel',
  SYSTEM: 'System',
};
/** How a store team logs a ticket for someone who got in touch. */
export const STAFF_SOURCES = ['PHONE', 'EMAIL', 'WHATSAPP', 'STORE'];

export const QUEUES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'mine', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'escalated', label: 'Escalated' },
];

export const EVENT_LABEL: Record<string, string> = {
  TICKET_CREATED: 'Ticket created',
  STATUS_CHANGED: 'Status changed',
  PRIORITY_CHANGED: 'Priority changed',
  CATEGORY_CHANGED: 'Category changed',
  FIELDS_UPDATED: 'Details updated',
  ASSIGNED: 'Assigned',
  UNASSIGNED: 'Unassigned',
  ESCALATED: 'Escalated',
  ESCALATION_UPDATED: 'Escalation updated',
  MESSAGE_ADDED: 'Message added',
  MESSAGE_EDITED: 'Message edited',
  ATTACHMENT_ADDED: 'File attached',
  ATTACHMENT_DOWNLOADED: 'File downloaded',
  FIRST_RESPONSE: 'First response',
  SLA_APPLIED: 'SLA applied',
  SLA_WARNING: 'SLA warning',
  SLA_BREACHED: 'SLA breached',
  FEEDBACK_SUBMITTED: 'Feedback submitted',
  TICKET_DELETED: 'Ticket deleted',
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
  if (!due) return { text: 'No SLA', tone: 'none' };
  if (done) return new Date(done).getTime() <= new Date(due).getTime() ? { text: 'met', tone: 'ok' } : { text: 'missed', tone: 'late' };
  const diff = (new Date(due).getTime() - now) / 60000;
  if (overdue || diff < 0) return { text: `${formatMinutes(Math.abs(diff))} overdue`, tone: 'late' };
  return { text: `in ${formatMinutes(diff)}`, tone: diff < 120 ? 'soon' : 'none' };
}

/** The customer wrote after the store's last reply. */
export const customerReplied = (t: Pick<SupportTicketSummary, 'lastCustomerMessageAt' | 'lastStaffMessageAt'>) =>
  !!t.lastCustomerMessageAt && (!t.lastStaffMessageAt || t.lastCustomerMessageAt > t.lastStaffMessageAt);

export const requesterName = (t: SupportTicketSummary) => t.customer.name ?? t.customer.phone ?? t.customer.email ?? '—';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Descriptions are rich text on the panel: shown here as plain paragraphs. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  { value: 'store', label: 'Our store' },
  { value: 'account', label: 'Customer' },
  { value: 'guest', label: 'Guest' },
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
    f.requester === 'account' && !f.customerId && !f.relatedTicketId && !f.orderId ? 'the customer' : null,
    guest && !f.contactPhone.trim() && !f.contactEmail.trim() && !f.orderId && !f.relatedTicketId ? 'a phone number or email' : null,
    storeRequired && !f.storeId ? 'the store' : null,
    type?.order === 'required' && !f.orderId ? 'the order' : null,
    type?.relatedTicket === 'required' && !f.relatedTicketId ? 'the earlier ticket' : null,
    !f.categoryId ? 'a category' : null,
    !f.subject.trim() ? 'a subject' : null,
    !f.description.trim() ? 'a description' : null,
  ].filter(Boolean);
  if (missing.length) return `Add ${missing.join(', ')}`;
  if (f.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail.trim())) return 'Enter a valid email address';
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
