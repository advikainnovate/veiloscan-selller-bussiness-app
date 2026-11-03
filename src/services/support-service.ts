import { api, STORE_HEADER } from '../lib/api';
import type { PickedFile } from './products-service';

// Customer Support & Complaints (eshop-backend src/modules/support), as the
// Seller Panel's support-service. Reading needs support-tickets:view, any
// change support-tickets:manage; the dashboard needs support-reports:view.
// Each ticket's `allowed` says what this user may do with it. Lists and the
// dashboard follow the current store; an empty X-Store-Id asks for all of
// the seller's stores.

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'WAITING_FOR_STORE' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type RequesterType = 'CUSTOMER' | 'GUEST' | 'STORE';

export interface TicketTypeDef {
  code: string;
  name: string;
  purpose: string;
  order: 'required' | 'optional';
  relatedTicket: 'required' | 'optional';
  defaultPriority: TicketPriority | null;
  platformByDefault: boolean;
  /** "store": only a store raises it, for itself. */
  requester: 'any' | 'store';
}

export interface TicketLink {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  ticketType: { code: string; name: string } | null;
  createdAt: string;
}

export interface SupportRequester {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  isGuest: boolean;
  isStore: boolean;
}

export interface SupportPerson {
  id: string;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  userType?: string;
  isPlatform?: boolean;
}

export interface SupportCategory {
  id: string;
  parentId?: string | null;
  code: string;
  name: string;
  description: string | null;
  defaultPriority?: TicketPriority | null;
}

export interface SupportTicketSummary {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: string;
  ticketType: { code: string; name: string };
  relatedTicket: TicketLink | null;
  category: { id: string; code: string; name: string } | null;
  store: { id: string; name: string } | null;
  order: { id: string; orderNumber: string } | null;
  requesterType: RequesterType;
  customer: SupportRequester;
  raisedBy: SupportPerson | null;
  assignee: SupportPerson | null;
  assignedTeam: string | null;
  escalationLevel: number;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  firstResponseOverdue: boolean;
  resolutionOverdue: boolean;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicket extends SupportTicketSummary {
  description: string;
  preferredContactChannel: string | null;
  externalReference: string | null;
  slaPolicy: { id: string; name: string; businessHoursOnly: boolean; firstResponseMinutes: number; resolutionMinutes: number } | null;
  firstResponseBreachedAt: string | null;
  resolutionBreachedAt: string | null;
  closedAt: string | null;
  reopenCount: number;
  resolutionSummary: string | null;
}

export interface SupportAttachment {
  id: string;
  messageId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  isCustomerVisible: boolean;
  internalAudience: 'STORE' | 'PLATFORM' | null;
  uploadedByCustomer: boolean;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  messageType: 'REPLY' | 'INTERNAL_NOTE' | 'SYSTEM_EVENT';
  body: string;
  isCustomerVisible: boolean;
  internalAudience: 'STORE' | 'PLATFORM' | null;
  channel: string;
  fromCustomer: boolean;
  author: SupportPerson | null;
  createdAt: string;
  editedAt: string | null;
  attachments: SupportAttachment[];
}

export interface SupportEvent {
  id: string;
  eventType: string;
  actor: (SupportPerson & { isCustomer: boolean }) | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
}

export interface SupportEscalation {
  id: string;
  level: number;
  reason: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';
  isAutomatic: boolean;
  escalatedBy: SupportPerson | null;
  escalatedTo: SupportPerson | null;
  escalatedTeam: string | null;
  escalatedAt: string;
  resolutionNote: string | null;
}

export interface SupportAssignment {
  id: string;
  assignee: SupportPerson | null;
  assignedTeam: string | null;
  assignedBy: SupportPerson | null;
  note: string | null;
  assignedAt: string;
  unassignedAt: string | null;
}

export interface TicketAllowed {
  reply: boolean;
  internalNote: boolean;
  assign: boolean;
  assignOthers: boolean;
  escalate: boolean;
  edit: boolean;
  viewAudit: boolean;
  transitions: TicketStatus[];
}

export interface SupportTicketDetail {
  ticket: SupportTicket;
  followUps: TicketLink[];
  messages: SupportMessage[];
  attachments: SupportAttachment[];
  assignments: SupportAssignment[];
  escalations: SupportEscalation[];
  feedback: { rating: number; comments: string | null; submittedAt: string } | null;
  events: SupportEvent[] | null;
  allowed: TicketAllowed;
}

export interface SupportTicketList {
  items: SupportTicketSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface Breakdown {
  key: string | null;
  label: string;
  count: number;
  open: number;
}

export interface SupportDashboard {
  totals: { total: number; open: number; unassigned: number; urgent: number; escalated: number; breached: number; approaching: number };
  performance: {
    avgFirstResponseMinutes: number | null;
    avgResolutionMinutes: number | null;
    firstResponseSlaMetPercent: number | null;
    reopenedRatePercent: number | null;
    csatAverage: number | null;
    csatResponses: number;
  };
  byStatus: Breakdown[];
  byPriority: Breakdown[];
  byType: Breakdown[];
  byCategory: Breakdown[];
  byStore: Breakdown[];
  agents: { userId: string; name: string | null; open: number; breached: number; resolved: number; avgResolutionMinutes: number | null }[];
  definitions: Record<string, string>;
  generatedAt: string;
}

export interface TicketQuery {
  page: number;
  limit: number;
  queue?: string;
  status?: string;
  priority?: string;
  ticketType?: string;
  categoryId?: string;
  search?: string;
}

type Body = Record<string, unknown>;
const allStores = { headers: { [STORE_HEADER]: '' } };
const data = <T>(p: Promise<{ data: T }>) => p.then(r => r.data);
const base = '/support/tickets';

export const supportService = {
  list: (params: TicketQuery, everyStore = false) => data<SupportTicketList>(api.get(base, { params, ...(everyStore ? allStores : {}) })),
  get: (id: string) => data<SupportTicketDetail>(api.get(`${base}/${id}`)),
  create: (payload: Body) => data<{ id: string; ticketNumber: string }>(api.post(base, payload)),
  update: (id: string, payload: Body) => data<unknown>(api.patch(`${base}/${id}`, payload)),
  transition: (id: string, toStatus: TicketStatus, extra: { reason?: string; resolutionSummary?: string } = {}) => data<unknown>(api.post(`${base}/${id}/transition`, { toStatus, ...extra })),
  addMessage: (id: string, payload: { messageType: 'REPLY' | 'INTERNAL_NOTE'; body: string }) => data<SupportMessage>(api.post(`${base}/${id}/messages`, payload)),
  editMessage: (id: string, messageId: string, body: string) => data<unknown>(api.patch(`${base}/${id}/messages/${messageId}`, { body })),
  upload(id: string, file: PickedFile, fields: { messageId?: string; visibility?: 'PUBLIC' | 'INTERNAL' } = {}) {
    const form = new FormData();
    // React Native's FormData takes a { uri, name, type } file.
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
    return data<SupportAttachment>(api.post(`${base}/${id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }));
  },
  downloadUrl: (id: string, attachmentId: string) => data<{ url: string; fileName: string }>(api.get(`${base}/${id}/attachments/${attachmentId}/download`)),
  assignees: (id: string) => data<SupportPerson[]>(api.get(`${base}/${id}/assignees`)),
  assign: (id: string, payload: { assignedTo?: string | null; assignedTeam?: string | null; note?: string }) => data<unknown>(api.post(`${base}/${id}/assign`, payload)),
  escalate: (id: string, payload: { reason: string; escalatedTo?: string; escalatedTeam?: string; level?: number }) => data<unknown>(api.post(`${base}/${id}/escalate`, payload)),
  updateEscalation: (id: string, escalationId: string, status: SupportEscalation['status'], note?: string) =>
    data<unknown>(api.patch(`${base}/${id}/escalations/${escalationId}`, { status, note })),
  dashboard: (params: { createdFrom?: string } = {}, everyStore = false) => data<SupportDashboard>(api.get('/support/dashboard', { params, ...(everyStore ? allStores : {}) })),
  ticketTypes: () => data<TicketTypeDef[]>(api.get('/support/ticket-types')),
  categories: () => data<(SupportCategory & { children: SupportCategory[] })[]>(api.get('/support/categories')),
  /** A customer's orders, to link one to their ticket. */
  customerOrders: (customerId: string) => data<unknown>(api.get(`/customers/${customerId}/orders`)).then(r => (Array.isArray(r) ? r : ((r as { items?: unknown[] })?.items ?? [])) as Body[]),
};
