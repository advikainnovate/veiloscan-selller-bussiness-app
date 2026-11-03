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
import { notificationService } from '../src/services/notification-service';
import { bySection, dayBucket, notificationGroup, relativeTime } from '../src/lib/notifications';
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
    notifications: jest.fn(async () => ({ items: [], unreadCount: 2 })),
  },
}));

jest.mock('../src/services/notification-service', () => ({
  notificationService: { page: jest.fn(), markRead: jest.fn(async () => ({})), markAllRead: jest.fn(async () => ({ updated: 2 })) },
}));

const { act } = ReactTestRenderer;
const svc = notificationService as jest.Mocked<typeof notificationService>;

const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
const ITEMS = [
  { id: 'n1', type: 'NEW_ORDER', title: 'New order ORD-101', message: '₹1,250 from Asha Rao', link: '/dashboard/orders/o1', data: { orderId: 'o1' }, readAt: null, createdAt: ago(5), category: 'ORDER' },
  { id: 'n2', type: 'NEW_ORDER_REQUEST', title: 'New order request', message: '3 items from Ravi', link: '/dashboard/order-requests/r1', data: null, readAt: null, createdAt: ago(90), category: 'ORDER' },
  { id: 'n3', type: 'NOTE_REMINDER', title: 'Reminder: call the supplier', message: 'Rice stock', link: '/dashboard/operations/notes?store=s1&note=x', data: null, readAt: ago(10), createdAt: ago(60 * 30), category: 'STORE' },
];

beforeEach(() => {
  jest.clearAllMocks();
  (authService.me as jest.Mock).mockResolvedValue({ id: 'u1', firstName: 'Rajendra', userType: 'SELLER', permissions: ['orders:manage', 'store-notes:view'] });
  svc.page.mockImplementation(async ({ isRead }) => {
    const items = isRead === false ? ITEMS.filter(n => !n.readAt) : ITEMS;
    return { items, unreadCount: 2, total: items.length, page: 1, limit: 20 };
  });
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

test('the bell opens notifications: unread first, by day, by kind, mark all read', async () => {
  const tree = await openApp();
  await press(tree, 'Notifications, 2 unread');
  let text = textOf(tree);
  expect(text).toContain('New order ORD-101');
  expect(text).toContain('5m ago');
  expect(text).toContain('TODAY');
  expect(text).toContain('YESTERDAY');
  expect(text).toContain('2 unread');

  // Kinds present: orders and notes. (The last "Notes": the chip, not Home's tile underneath.)
  const notes = tree.root.findAll(n => n.props.children === 'Notes' && n.parent?.props.onPress === undefined).map(n => {
    let p: ReactTestRenderer.ReactTestInstance | null = n;
    while (p && !p.props.onPress) p = p.parent;
    return p!;
  });
  await act(async () => notes[notes.length - 1].props.onPress());
  text = textOf(tree);
  expect(text).toContain('Reminder: call the supplier');
  expect(text).not.toContain('New order ORD-101');
  await press(tree, 'Everything');

  await press(tree, 'Unread · 2');
  expect(svc.page).toHaveBeenLastCalledWith({ page: 1, limit: 20, isRead: false });
  expect(textOf(tree)).not.toContain('Reminder: call the supplier');

  await press(tree, 'Mark all as read');
  expect(svc.markAllRead).toHaveBeenCalled();
  expect(textOf(tree)).toContain('2 notifications marked as read');
  await act(async () => tree.unmount());
});

test('opening a notification marks it read and goes to what it is about', async () => {
  const tree = await openApp();
  await act(async () => openMenuKey('notifications'));
  await press(tree, 'Unread. New order request');
  expect(svc.markRead).toHaveBeenCalledWith('n2');
  expect(navigationRef.getCurrentRoute()?.name).toBe('OrderRequestDetail');
  expect(navigationRef.getCurrentRoute()?.params).toEqual({ id: 'r1' });

  await act(async () => navigationRef.goBack());
  await press(tree, 'Reminder: call the supplier');
  // Already read: nothing to mark.
  expect(svc.markRead).toHaveBeenCalledTimes(1);
  expect(navigationRef.getCurrentRoute()?.name).toBe('Notes');
  await act(async () => tree.unmount());
});

test('notification helpers', () => {
  const now = new Date('2026-11-03T12:00:00');
  expect(relativeTime('2026-11-03T11:59:40', now.getTime())).toBe('Just now');
  expect(relativeTime('2026-11-03T09:00:00', now.getTime())).toBe('3h ago');
  expect(relativeTime('2026-11-02T09:00:00', now.getTime())).toBe('Yesterday');
  expect(dayBucket('2026-10-30T09:00:00', now)).toBe('This week');
  expect(dayBucket('2026-10-01T09:00:00', now)).toBe('Earlier');
  expect(bySection([{ createdAt: '2026-11-03T10:00:00' }, { createdAt: '2026-11-03T08:00:00' }, { createdAt: '2026-11-01T08:00:00' }], now).map(s => [s.title, s.data.length])).toEqual([
    ['Today', 2],
    ['This week', 1],
  ]);
  expect(notificationGroup({ type: 'NOTE_REMINDER', category: 'STORE' } as never)).toBe('NOTES');
  expect(notificationGroup({ type: 'X', category: 'PAYMENT' } as never)).toBe('PAYMENT');
});
