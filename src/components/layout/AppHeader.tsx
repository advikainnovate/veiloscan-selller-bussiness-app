import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useDrawer } from '../../context/DrawerContext';
import { useNotifications } from '../../context/NotificationContext';
import { openMenuKey } from '../../navigation/navigationRef';
import { ArrowLeftIcon, BellIcon, MenuIcon } from '../icons';
import { Avatar } from './Avatar';
import { StoreBar } from './StoreSwitcher';

const markColor = require('../../assets/brand/logo-mark-color.png');

type AppHeaderProps =
  /** Home: the VeiloScan Business logo in place of a title. */
  | { brand: true; title?: undefined; subtitle?: undefined; onBack?: undefined }
  | {
      brand?: false;
      title: string;
      subtitle?: string;
      /** Shows a back arrow instead of the menu button. */
      onBack?: () => void;
    };

/**
 * The top bar: menu (or back), the logo or page title, then notifications
 * (with a dot while any are unread) and the account. With more than one
 * store, the store switcher sits underneath.
 */
export function AppHeader(props: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { open } = useDrawer();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const onBack = props.onBack;

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <StatusBar barStyle="dark-content" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onBack ? 'Back' : 'Open menu'}
          onPress={onBack ?? open}
          hitSlop={6}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          {onBack ? (
            <ArrowLeftIcon size={20} color={colors.text} />
          ) : (
            <MenuIcon size={22} color={colors.text} />
          )}
        </Pressable>

        {props.brand ? (
          <View
            style={styles.brand}
            accessibilityRole="header"
            accessibilityLabel="VeiloScan Business"
          >
            <Image
              source={markColor}
              style={styles.mark}
              resizeMode="contain"
            />
            <Text
              style={styles.wordmark}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              VeiloScan
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Business</Text>
            </View>
          </View>
        ) : (
          <View style={styles.titles}>
            <Text
              style={styles.title}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {props.title}
            </Text>
            {props.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {props.subtitle}
              </Text>
            ) : null}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
          onPress={() => openMenuKey('notifications')}
          hitSlop={6}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <BellIcon size={21} color={colors.text} />
          {unreadCount > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My profile"
          onPress={() => openMenuKey('profile')}
          hitSlop={6}
        >
          <Avatar user={user} size={42} />
        </Pressable>
      </View>
      {/* Sub-pages (with a back arrow) stay in the store they were opened from. */}
      {onBack ? null : <StoreBar />}
    </View>
  );
}

const softShadow = Platform.select({
  ios: {
    shadowColor: '#061b3a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  default: { elevation: 2 },
});

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: colors.surface,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...softShadow,
  },
  pressed: { backgroundColor: colors.background },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.secondary,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mark: { width: 28, height: 28 },
  wordmark: {
    flexShrink: 1,
    fontSize: 19,
    fontFamily: fonts.extrabold,
    color: colors.text,
    letterSpacing: -0.4,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.secondary,
  },
  badgeText: { fontSize: 10.5, fontFamily: fonts.bold, color: colors.white },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  subtitle: {
    marginTop: 1,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
});
