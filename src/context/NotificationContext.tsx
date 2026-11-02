import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Vibration } from 'react-native';
import { dashboardService, type AppNotification } from '../services/dashboard-service';

// Checked often enough that a new order is noticed while the app is open.
const POLL_MS = 30_000;
const ORDER_TYPES = ['NEW_ORDER', 'NEW_ORDER_REQUEST'];

interface NotificationContextValue {
  unreadCount: number;
  refresh: () => void;
  /** New orders and order requests that arrived while the app was open, newest first. */
  alerts: AppNotification[];
  dismissAlert: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refresh: () => {},
  alerts: [],
  dismissAlert: () => {},
});

/**
 * The header bell's unread count, and the Seller Panel's new-order alerts:
 * polled while the app is open (signed-in only). Orders already there when
 * the app opened don't alert; new ones vibrate and show a banner.
 */
export function NotificationProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  // Notifications already seen; null until the first load sets the baseline.
  const seen = useRef<Set<string> | null>(null);

  const refresh = useCallback(() => {
    dashboardService.notifications(10).then(
      ({ items, unreadCount: count }) => {
        setUnreadCount(count);
        const known = seen.current;
        seen.current = new Set([...(known ?? []), ...items.map(n => n.id)]);
        if (!known) return;
        const fresh = items.filter(n => !known.has(n.id) && !n.readAt && ORDER_TYPES.includes(n.type));
        if (fresh.length) {
          Vibration.vibrate([0, 300, 150, 300]);
          setAlerts(prev => [...fresh, ...prev].slice(0, 3));
        }
      },
      () => {
        // Offline or a token refresh: the next poll retries.
      },
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      setAlerts([]);
      seen.current = null;
      return;
    }
    refresh();
    let timer = setInterval(refresh, POLL_MS);
    // No polling in the background; catch up when the app comes back.
    const sub = AppState.addEventListener('change', state => {
      clearInterval(timer);
      if (state === 'active') {
        refresh();
        timer = setInterval(refresh, POLL_MS);
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled, refresh]);

  const dismissAlert = useCallback((id: string) => setAlerts(prev => prev.filter(n => n.id !== id)), []);

  const value = useMemo(() => ({ unreadCount, refresh, alerts, dismissAlert }), [unreadCount, refresh, alerts, dismissAlert]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}
