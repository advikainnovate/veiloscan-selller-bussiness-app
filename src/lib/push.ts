// Push notifications (Firebase Cloud Messaging). The backend sends a push for
// each notification rule on the PUSH channel to every active device of the
// user (eshop-backend src/modules/notifications, POST /notifications/devices).
// Android only for now: iOS needs its GoogleService-Info.plist and APNs key.
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { navigationRef } from '../navigation/navigationRef';
import { notificationService } from '../services/notification-service';
import { openNotification } from './notifications';
import type { AppNotification } from '../services/dashboard-service';

const DEVICE_KEY = 'app.pushDeviceId';
const APP_VERSION: string = require('../../package.json').version;
export const pushSupported = Platform.OS === 'android';

function playForegroundNotificationSound() {
  try {
    NativeModules.NotificationSound?.play();
  } catch {
    // Sound is best-effort; a native audio issue must not block push handling.
  }
}

/** This install's id, so the backend keeps one token per phone. */
async function deviceId() {
  const saved = await AsyncStorage.getItem(DEVICE_KEY);
  if (saved) return saved;
  const id = `android-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_KEY, id);
  return id;
}

/** Android 13+ asks; older versions allow notifications by default. */
async function allowed() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function register(token: string) {
  await notificationService.registerDevice({
    deviceId: await deviceId(),
    fcmToken: token,
    platform: 'ANDROID',
    deviceName: (Platform.constants as { Model?: string }).Model ?? 'Android',
    appVersion: APP_VERSION,
  });
}

/** The notification a push is about, in the shape the notification list opens. */
function toNotification(m: RemoteMessage): AppNotification {
  const data = (m.data ?? {}) as Record<string, string>;
  return {
    id: data.notificationId ?? m.messageId ?? '',
    type: data.type ?? '',
    title: m.notification?.title ?? '',
    message: m.notification?.body ?? '',
    link: data.link ?? null,
    data,
    readAt: null,
    createdAt: new Date(m.sentTime ?? Date.now()).toISOString(),
  };
}

/** Opens what a tapped push is about, once the app's screens are up, and marks it read. */
function openPush(m: RemoteMessage, onOpened: () => void) {
  const n = toNotification(m);
  if (n.id) notificationService.markRead(n.id).then(onOpened, () => {});
  let tries = 0;
  const attempt = () => {
    if (navigationRef.isReady()) {
      if (!openNotification(n)) navigationRef.navigate('Notifications');
    } else if (tries++ < 40) setTimeout(attempt, 125);
  };
  attempt();
}

/**
 * While signed in: registers this phone for pushes (and again whenever the
 * token changes), refreshes on pushes that arrive with the app open, and
 * opens tapped pushes. Returns the clean-up.
 */
export function startPush({ onReceived }: { onReceived: () => void }): () => void {
  if (!pushSupported) return () => {};
  const messaging = getMessaging();
  let stopped = false;
  (async () => {
    try {
      if (!(await allowed()) || stopped) return;
      await register(await getToken(messaging));
    } catch {
      // No Play Services, offline or refused: the in-app alerts still work.
    }
  })();
  const subs = [
    onTokenRefresh(messaging, token => register(token).catch(() => {})),
    // With the app open Android shows nothing: the in-app banner and bell do.
    onMessage(messaging, () => {
      playForegroundNotificationSound();
      onReceived();
    }),
    onNotificationOpenedApp(messaging, m => openPush(m, onReceived)),
  ];
  // Opened from a push while the app was closed.
  getInitialNotification(messaging).then(m => m && !stopped && openPush(m, onReceived), () => {});
  return () => {
    stopped = true;
    subs.forEach(unsubscribe => unsubscribe());
  };
}

/** On sign-out: this phone stops getting the user's pushes. */
export async function stopPush() {
  if (!pushSupported) return;
  try {
    await notificationService.removeDevice(await deviceId());
  } catch {
    // Offline: the backend drops the token once FCM reports it dead.
  }
  try {
    await deleteToken(getMessaging());
  } catch {
    // Nothing to delete.
  }
}

/** Pushes that arrive while the app is in the background are shown by Android itself. */
export function registerBackgroundHandler() {
  if (pushSupported) setBackgroundMessageHandler(getMessaging(), async () => {});
}
