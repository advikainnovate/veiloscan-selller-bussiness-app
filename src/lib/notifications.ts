// Notifications as the Seller Panel's bell shows them, and where each one
// opens in the app (the API's links are Seller Panel paths).
import type { ComponentType } from 'react';
import { monthShort } from './date';
import { navigationRef } from '../navigation/navigationRef';
import type { AppNotification } from '../services/dashboard-service';
import {
  AwardIcon,
  BellIcon,
  BoxIcon,
  ClipboardListIcon,
  FileTextIcon,
  HelpCircleIcon,
  PercentIcon,
  ShoppingBagIcon,
  StoreIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from '../components/icons';
import i18n from '../i18n';

type Note = AppNotification & { category?: string | null };

/** The icon and its tint for a notification, by type or category. */
export function notificationLook(n: Note): { icon: ComponentType<IconProps>; color: string; tint: string } {
  if (n.type === 'NEW_ORDER_REQUEST') return { icon: ClipboardListIcon, color: '#7c3aed', tint: '#f5f3ff' };
  if (n.type === 'NOTE_REMINDER') return { icon: FileTextIcon, color: '#0284c7', tint: '#f0f9ff' };
  switch (n.category) {
    case 'PAYMENT':
    case 'CREDIT':
      return { icon: WalletIcon, color: '#059669', tint: '#ecfdf5' };
    case 'INVENTORY':
      return { icon: BoxIcon, color: '#d97706', tint: '#fffbeb' };
    case 'STORE':
      return { icon: StoreIcon, color: '#4f46e5', tint: '#eef2ff' };
    case 'SUBSCRIPTION':
      return { icon: AwardIcon, color: '#db2777', tint: '#fdf2f8' };
    case 'CUSTOMER':
      return { icon: UsersIcon, color: '#0891b2', tint: '#ecfeff' };
    case 'PROMOTION':
      return { icon: PercentIcon, color: '#ea580c', tint: '#fff7ed' };
    case 'SUPPORT':
      return { icon: HelpCircleIcon, color: '#475569', tint: '#f1f5f9' };
    case 'SYSTEM':
      return { icon: BellIcon, color: '#475569', tint: '#f1f5f9' };
    default:
      // Orders (the panel's own icon for every notification).
      return { icon: ShoppingBagIcon, color: '#ea580c', tint: '#fff7ed' };
  }
}

export const CATEGORY_LABEL: Record<string, string> = {
  get ORDER() { return i18n.t('common.orders'); },
  get PAYMENT() { return i18n.t('common.payments'); },
  get INVENTORY() { return i18n.t('common.inventory'); },
  get STORE() { return i18n.t('common.store'); },
  get SUBSCRIPTION() { return i18n.t('common.plan'); },
  get CUSTOMER() { return i18n.t('common.customers'); },
  get CREDIT() { return i18n.t('common.credit'); },
  get PROMOTION() { return i18n.t('common.promotions'); },
  get SUPPORT() { return i18n.t('notifications.support'); },
  get SYSTEM() { return i18n.t('common.system'); },
};

/** A notification's group in the list: orders and requests are Orders, note reminders Notes. */
export function notificationGroup(n: Note): string {
  if (n.type === 'NEW_ORDER' || n.type === 'NEW_ORDER_REQUEST') return 'ORDER';
  if (n.type === 'NOTE_REMINDER') return 'NOTES';
  return n.category || 'SYSTEM';
}
export const groupLabel = (g: string) => (g === 'NOTES' ? i18n.t('common.notes') : CATEGORY_LABEL[g] ?? g.charAt(0) + g.slice(1).toLowerCase());

/** "Just now", "5m ago", "3h ago", "Yesterday", "4d ago", then the date. */
export function relativeTime(value: string, now = Date.now()): string {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const minutes = Math.floor((now - t) / 60000);
  if (minutes < 1) return i18n.t('notifications.justNow');
  if (minutes < 60) return i18n.t('notifications.minutesMAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t('notifications.hoursHAgo', { hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return i18n.t('common.yesterday');
  if (days < 7) return i18n.t('notifications.daysDAgo', { days });
  // 12 Oct, or 12 Oct 2025 from another year.
  const date = new Date(t);
  return `${date.getDate()} ${monthShort(date.getMonth())}${date.getFullYear() === new Date(now).getFullYear() ? '' : ` ${date.getFullYear()}`}`;
}

/** Today / Yesterday / This week / Earlier, for section headers. */
export function dayBucket(value: string, now = new Date()): string {
  const d = new Date(value);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff <= 0) return i18n.t('common.today');
  if (diff === 1) return i18n.t('common.yesterday');
  if (diff < 7) return i18n.t('notifications.thisWeek');
  return i18n.t('notifications.earlier');
}

/** Groups notifications (already newest first) into day sections. */
export function bySection<T extends { createdAt: string }>(items: T[], now = new Date()): { title: string; data: T[] }[] {
  const out: { title: string; data: T[] }[] = [];
  for (const n of items) {
    const title = dayBucket(n.createdAt, now);
    const last = out[out.length - 1];
    if (last?.title === title) last.data.push(n);
    else out.push({ title, data: [n] });
  }
  return out;
}

/**
 * Opens what a notification is about. Its link is a Seller Panel path
 * (/dashboard/orders/<id>, /dashboard/operations/notes?note=…); unknown
 * paths fall back by type. Returns false when there's nowhere to go.
 */
export function openNotification(n: AppNotification): boolean {
  if (!navigationRef.isReady()) return false;
  const link = n.link ?? '';
  const id = (re: RegExp) => re.exec(link)?.[1];
  const request = id(/\/order-requests\/([\w-]+)/) ?? (n.data?.requestId as string | undefined);
  const order = id(/\/orders\/([\w-]+)/) ?? (n.data?.orderId as string | undefined);
  const credit = id(/\/customer-credit\/([\w-]+)/);
  const expense = id(/\/expenses\/([\w-]+)/);
  const product = id(/\/products-master\/([\w-]+)/);
  const brand = id(/\/brand-approvals\/([\w-]+)/);
  const warehouse = id(/\/warehouse-master\/([\w-]+)/);
  const store = id(/\/stores\/([\w-]+)/);
  const ticket = id(/\/support\/tickets\/([\w-]+)/) ?? (n.data?.ticketId as string | undefined);
  if (n.type === 'NEW_ORDER_REQUEST' || request) {
    if (request) navigationRef.navigate('OrderRequestDetail', { id: request });
    else navigationRef.navigate('OrderRequests');
  } else if (ticket) navigationRef.navigate('SupportTicket', { id: ticket });
  else if (order) navigationRef.navigate('OrderDetail', { id: order });
  else if (n.type === 'NOTE_REMINDER' || /\/operations\/notes/.test(link)) navigationRef.navigate('Notes');
  else if (credit) navigationRef.navigate('CreditDetail', { id: credit });
  else if (expense) navigationRef.navigate('ExpenseDetail', { id: expense });
  else if (product) navigationRef.navigate('ProductDetail', { id: product });
  else if (brand) navigationRef.navigate('BrandRequestDetail', { id: brand });
  else if (warehouse) navigationRef.navigate('WarehouseDetail', { id: warehouse });
  else if (store && store !== 'create') navigationRef.navigate('StoreSettings', { storeId: store });
  else if (n.type === 'NEW_ORDER') navigationRef.navigate('Main', { screen: 'Orders' });
  else return false;
  return true;
}
