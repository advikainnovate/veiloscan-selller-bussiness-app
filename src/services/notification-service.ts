import { api } from '../lib/api';
import type { AppNotification } from './dashboard-service';

export type { AppNotification };

export interface NotificationPage {
  items: (AppNotification & { category?: string | null; eventType?: string | null })[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
}

// The signed-in user's notifications (eshop-backend /notifications), as the
// Seller Panel's bell: newest first, 50 a page at most.
export const notificationService = {
  page(params: { page: number; limit?: number; isRead?: boolean }): Promise<NotificationPage> {
    return api.get('/notifications', { params: { limit: 20, ...params } }).then(res => ({
      items: Array.isArray(res.data?.items) ? res.data.items : [],
      unreadCount: Number(res.data?.unreadCount ?? 0),
      total: Number(res.data?.total ?? 0),
      page: Number(res.data?.page ?? params.page),
      limit: Number(res.data?.limit ?? params.limit ?? 20),
    }));
  },
  /** Registers (or refreshes) this phone's push token. */
  registerDevice: (payload: { deviceId: string; fcmToken: string; platform: 'ANDROID' | 'IOS'; deviceName?: string; appVersion?: string }) =>
    api.post('/notifications/devices', payload).then(res => res.data),
  removeDevice: (deviceId: string) => api.delete(`/notifications/devices/${encodeURIComponent(deviceId)}`).then(res => res.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then(res => res.data),
  markAllRead: (): Promise<{ updated: number }> => api.patch('/notifications/read-all').then(res => res.data),
};
