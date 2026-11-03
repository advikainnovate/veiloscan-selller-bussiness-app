/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { navigationRef, openMenuKey } from '../src/navigation/navigationRef';
import { authService } from '../src/services/auth-service';
import { storeService } from '../src/services/store-service';
import { supportService, type SupportTicketDetail, type SupportTicketSummary } from '../src/services/support-service';
import { emptyTicket, formatMinutes, htmlToText, slaState, textToHtml, ticketPayload, ticketProblem } from '../src/lib/support';
import { pastSplash, press, textOf } from '../jest/test-helpers';

jest.mock('../src/services/auth-service', () => ({
  authService: { me: jest.fn(), logout: jest.fn(async () => ({})) },
}));

jest.mock('../src/services/dashboard-service', () => ({
  ...jest.requireActual('../src/services/dashboard-service'),
  dashboardService: {
    today: jest.fn(async () => ({ storeName: null, kpis: { orders: null, sales: null, customers: null, products: null } })),
    customerCount: jest.fn(async () => 0),
    unreadNotifications: jest.fn(async () => 0),
    notifications: jest.fn(async () => ({ items: [], unreadCount: 0 })),
  },
}));

jest.mock('../src/services/support-service', () => ({
  supportService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(async () => ({ id: 'new1', ticketNumber: 'VS-TKT-9' })),
    update: jest.fn(async () => ({})),
    transition: jest.fn(async () => ({})),
    addMessage: jest.fn(async () => ({ id: 'm9' })),
    editMessage: jest.fn(async () => ({})),
    upload: jest.fn(async () => ({})),
    downloadUrl: jest.fn(),
    assignees: jest.fn(async () => []),
    assign: jest.fn(async () => ({})),
    escalate: jest.fn(async () => ({})),
    updateEscalation: jest.fn(async () => ({})),
    dashboard: jest.fn(),
    ticketTypes: jest.fn(async () => [
      { code: 'SUPPORT_REQUEST', name: 'Support Request', purpose: 'Help from VeiloScan', order: 'optional', relatedTicket: 'optional', defaultPriority: null, platformByDefault: false, requester: 'any' },
      { code: 'COMPLAINT', name: 'Complaint', purpose: 'Something went wrong', order: 'optional', relatedTicket: 'optional', defaultPriority: 'HIGH', platformByDefault: false, requester: 'any' },
    ]),
    categories: jest.fn(async () => [{ id: 'c1', code: 'PAYMENTS', name: 'Payments', description: null, children: [{ id: 'c2', code: 'REFUNDS', name: 'Refunds', description: null }] }]),
    customerOrders: jest.fn(async () => []),
  },
}));

const { act } = ReactTestRenderer;
const svc = supportService as jest.Mocked<typeof supportService>;
const me = authService.me as jest.Mock;
const soon = new Date(Date.now() + 45 * 60000).toISOString();

const TICKET: SupportTicketSummary = {
  id: 't1',
  ticketNumber: 'VS-TKT-101',
  subject: 'Refund not received',
  status: 'OPEN',
  priority: 'URGENT',
  source: 'PHONE',
  ticketType: { code: 'COMPLAINT', name: 'Complaint' },
  relatedTicket: null,
  category: { id: 'c2', code: 'REFUNDS', name: 'Refunds' },
  store: { id: 's1', name: 'Main Store' },
  order: null,
  requesterType: 'CUSTOMER',
  customer: { id: 'u9', name: 'Asha Rao', email: 'asha@example.com', phone: '+919800000000', isGuest: false, isStore: false },
  raisedBy: null,
  assignee: null,
  assignedTeam: null,
  escalationLevel: 0,
  firstResponseDueAt: soon,
  resolutionDueAt: null,
  firstResponseAt: null,
  resolvedAt: null,
  firstResponseOverdue: false,
  resolutionOverdue: false,
  lastCustomerMessageAt: '2026-11-02T10:00:00Z',
  lastStaffMessageAt: null,
  createdAt: '2026-11-02T09:00:00Z',
  updatedAt: '2026-11-02T10:00:00Z',
};
const DETAIL: SupportTicketDetail = {
  ticket: {
    ...TICKET,
    description: '<p>Paid on <b>28 Oct</b>, the refund never came.</p>',
    preferredContactChannel: null,
    externalReference: null,
    slaPolicy: { id: 'p1', name: 'Urgent', businessHoursOnly: false, firstResponseMinutes: 60, resolutionMinutes: 480 },
    firstResponseBreachedAt: null,
    resolutionBreachedAt: null,
    closedAt: null,
    reopenCount: 0,
    resolutionSummary: null,
  },
  followUps: [],
  messages: [{ id: 'm1', messageType: 'REPLY', body: 'Still waiting for my money', isCustomerVisible: true, internalAudience: null, channel: 'PORTAL', fromCustomer: true, author: { id: 'u9', name: 'Asha Rao' }, createdAt: '2026-11-02T10:00:00Z', editedAt: null, attachments: [] }],
  attachments: [],
  assignments: [],
  escalations: [],
  feedback: null,
  events: [],
  allowed: { reply: true, internalNote: true, assign: true, assignOthers: true, escalate: true, edit: true, viewAudit: true, transitions: ['IN_PROGRESS', 'RESOLVED'] },
};
const DASHBOARD = {
  totals: { total: 12, open: 5, unassigned: 2, urgent: 1, escalated: 1, breached: 3, approaching: 1 },
  performance: { avgFirstResponseMinutes: 95, avgResolutionMinutes: 3000, firstResponseSlaMetPercent: 80, reopenedRatePercent: 5, csatAverage: 4.5, csatResponses: 8 },
  byStatus: [{ key: 'OPEN', label: 'OPEN', count: 5, open: 5 }],
  byPriority: [{ key: 'URGENT', label: 'Urgent', count: 1, open: 1 }],
  byType: [],
  byCategory: [{ key: 'c2', label: 'Refunds', count: 4, open: 2 }],
  byStore: [],
  agents: [{ userId: 'a1', name: 'Kiran', open: 3, breached: 1, resolved: 7, avgResolutionMinutes: 120 }],
  definitions: { Open: 'Not resolved or closed' },
  generatedAt: '2026-11-03T08:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ id: 'me1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['support-tickets:manage', 'support-tickets:view', 'support-reports:view'] });
  (storeService.list as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Main Store', code: null, status: 'ACTIVE' }]);
  svc.list.mockResolvedValue({ items: [TICKET], total: 1, page: 1, limit: 20 });
  svc.get.mockResolvedValue(DETAIL);
  svc.dashboard.mockResolvedValue(DASHBOARD);
});

async function openApp() {
  await AsyncStorage.setItem('app.onboarded', '1');
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ username: 'session', password: JSON.stringify({ accessToken: 'a', refreshToken: 'r' }) });
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await pastSplash();
  return tree;
}
const field = (tree: ReactTestRenderer.ReactTestRenderer, label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && n.props.onChangeText)[0];
const typeIn = (tree: ReactTestRenderer.ReactTestRenderer, label: string, v: string) => act(async () => field(tree, label).props.onChangeText(v));
/** The last pressable with this text or label: the screen or sheet on top. */
async function pick(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const targets = tree.root
    .findAll(n => n.props.children === label || n.props.accessibilityLabel === label)
    .map(n => {
      let p: ReactTestRenderer.ReactTestInstance | null = n;
      while (p && !p.props.onPress) p = p.parent;
      return p;
    })
    .filter(Boolean);
  await act(async () => targets[targets.length - 1]!.props.onPress());
}

test('the queue: figures, a ticket card, and the queue filter', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('support-tickets'));
  const text = textOf(tree);
  expect(text).toContain('VS-TKT-101');
  expect(text).toContain('Refund not received');
  expect(text).toContain('Asha Rao · Refunds');
  expect(text).toContain('● Urgent');
  expect(text).toContain('Customer replied');
  expect(text).toContain('Response in 45m');
  expect(text).toContain('"5","Open"');
  expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ queue: 'active', page: 1 }), false);

  await press(tree, 'Unassigned');
  expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ queue: 'unassigned' }), false);
  await act(async () => tree.unmount());
});

test('a ticket: report, conversation, reply, take it and resolve', async () => {
  const tree = await openApp();
  await act(async () => navigationRef.navigate('SupportTicket', { id: 't1' }));
  const text = textOf(tree);
  expect(text).toContain('Paid on 28 Oct, the refund never came.');
  expect(text).toContain('Still waiting for my money');
  expect(text).toContain('Urgent · 24/7');
  expect(text).toContain('Unassigned');

  await typeIn(tree, 'Reply', 'Refund is on its way');
  await pick(tree, 'Send reply');
  expect(svc.addMessage).toHaveBeenCalledWith('t1', { messageType: 'REPLY', body: 'Refund is on its way' });

  await pick(tree, 'Take it');
  expect(svc.assign).toHaveBeenCalledWith('t1', { assignedTo: 'me1' });

  await pick(tree, 'Resolve');
  await typeIn(tree, 'Resolution summary (shown to the customer)', 'Refunded ₹499');
  await pick(tree, 'Resolve');
  expect(svc.transition).toHaveBeenCalledWith('t1', 'RESOLVED', { resolutionSummary: 'Refunded ₹499' });
  await act(async () => tree.unmount());
});

test('escalate needs a reason', async () => {
  const tree = await openApp();
  await act(async () => navigationRef.navigate('SupportTicket', { id: 't1' }));
  await pick(tree, 'Escalate');
  await typeIn(tree, 'Escalation reason', 'Customer threatened chargeback');
  await pick(tree, 'Escalate');
  expect(svc.escalate).toHaveBeenCalledWith('t1', { reason: 'Customer threatened chargeback', level: 1, escalatedTo: undefined, escalatedTeam: undefined });
  await act(async () => tree.unmount());
});

test("a store's own request: the checks, then the ticket", async () => {
  const tree = await openApp();
  await act(async () => navigationRef.navigate('SupportTicketForm', {}));
  await pick(tree, 'Create Ticket');
  expect(textOf(tree)).toContain('Add a category, a subject, a description');
  await act(async () => {
    const select = tree.root.findAll(n => n.props.label === 'Category' && n.props.onChange)[0];
    select.props.onChange('c2');
  });
  await typeIn(tree, 'Subject', 'Payout delayed');
  await typeIn(tree, 'Description', 'Last week payout missing.\n\nPlease check.');
  await pick(tree, 'Create Ticket');
  expect(svc.create).toHaveBeenCalledWith({
    ticketType: 'SUPPORT_REQUEST',
    categoryId: 'c2',
    subject: 'Payout delayed',
    description: '<p>Last week payout missing.</p><p>Please check.</p>',
    source: 'PHONE',
    storeId: 's1',
    requesterType: 'STORE',
  });
  expect(navigationRef.getCurrentRoute()?.name).toBe('SupportTicket');
  await act(async () => tree.unmount());
});

test('the dashboard: totals, performance, breakdowns and agents', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('support-dashboard'));
  const text = textOf(tree);
  expect(text).toContain('Tickets created');
  expect(text).toContain('4.5 / 5');
  expect(text).toContain('1h 35m');
  expect(text).toContain('2d 2h');
  expect(text).toContain('Refunds');
  expect(text).toContain('Kiran');
  expect(text).toContain('1 breached');
  await press(tree, 'Last 7 days');
  expect(svc.dashboard).toHaveBeenLastCalledWith({ createdFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }, false);
  await act(async () => tree.unmount());
});

test('no access without the permissions', async () => {
  me.mockResolvedValue({ id: 'me1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage'] });
  const tree = await openApp();
  await act(async () => navigationRef.navigate('SupportTickets'));
  expect(textOf(tree)).toContain('No access');
  await act(async () => navigationRef.navigate('SupportDashboard'));
  expect(textOf(tree)).toContain('No access');
  expect(svc.list).not.toHaveBeenCalled();
  expect(svc.dashboard).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('support helpers', () => {
  expect(formatMinutes(95)).toBe('1h 35m');
  expect(formatMinutes(3000)).toBe('2d 2h');
  const now = Date.parse('2026-11-03T10:00:00Z');
  expect(slaState('2026-11-03T09:30:00Z', null, true, now)).toEqual({ text: '30m overdue', tone: 'late' });
  expect(slaState('2026-11-03T11:00:00Z', '2026-11-03T10:30:00Z', false, now)).toEqual({ text: 'met', tone: 'ok' });
  expect(htmlToText('<ul><li>One</li><li>Two &amp; three</li></ul>')).toBe('• One\n• Two & three');
  expect(textToHtml('a < b\nc')).toBe('<p>a &lt; b<br>c</p>');
  const guest = { ...emptyTicket('s1'), requester: 'guest' as const, categoryId: 'c1', subject: 'S', description: 'D' };
  expect(ticketProblem(guest, undefined)).toBe('Add a phone number or email');
  expect(ticketProblem({ ...guest, contactEmail: 'bad' }, undefined)).toBe('Enter a valid email address');
  expect(ticketPayload({ ...guest, contactPhone: ' 98 ' }, false)).toEqual(expect.objectContaining({ contactPhone: '98', storeId: 's1' }));
});
