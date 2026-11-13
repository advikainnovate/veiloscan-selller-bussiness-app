import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../theme';
import { useNotifications } from '../../context/NotificationContext';
import { openNotification } from '../../lib/notifications';
import type { AppNotification } from '../../services/dashboard-service';
import { ClipboardListIcon, CloseIcon, ShoppingBagIcon } from '../icons';
import { useTranslation } from 'react-i18next';

/** New-order banners at the top of the screen, as the Seller Panel's alert stack. */
export function OrderAlerts() {
  const insets = useSafeAreaInsets();
  const { alerts, dismissAlert } = useNotifications();
  if (!alerts.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      {alerts.map(alert => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onView={() => {
            dismissAlert(alert.id);
            openNotification(alert);
          }}
          onDismiss={() => dismissAlert(alert.id)}
        />
      ))}
    </View>
  );
}

// How long a banner stays before it hides itself.
const ALERT_MS = 3000;

function AlertCard({ alert, onView, onDismiss }: { alert: AppNotification; onView: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  const progress = useRef(new Animated.Value(0)).current;
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    // Gone on its own after a few seconds (slides back up first); the bell keeps it.
    const timer = setTimeout(() => {
      Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => dismiss.current());
    }, ALERT_MS);
    return () => clearTimeout(timer);
  }, [progress]);
  const request = alert.type === 'NEW_ORDER_REQUEST';
  const Icon = request ? ClipboardListIcon : ShoppingBagIcon;
  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        styles.card,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}
    >
      <View style={styles.icon}>
        <Icon size={20} color={colors.white} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {alert.title || (request ? t('orders.newOrderRequest') : t('common.newOrder'))}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {alert.message}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onView} style={styles.view}>
        <Text style={styles.viewText}>{t('common.view')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('orders.dismiss')} hitSlop={10} onPress={onDismiss}>
        <CloseIcon size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  wrap: { position: 'absolute', left: 12, right: 12, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadow.raised,
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  message: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.8)' },
  view: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.secondary },
  viewText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
});
