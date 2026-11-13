import React from 'react';
import {
  Image,
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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
          accessibilityLabel={onBack ? t('common.back') : t('layout.openMenu')}
          onPress={onBack ?? open}
          hitSlop={6}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          {onBack ? (
            <ArrowLeftIcon size={20} color={colors.text} strokeWidth={2} />
          ) : (
            <MenuIcon size={21} color={colors.text} strokeWidth={2} />
          )}
        </Pressable>

        {props.brand ? (
          <View
            style={styles.brand}
            accessibilityRole="header"
            accessibilityLabel={t('common.veiloscanBusiness')}
          >
            <Image
              source={markColor}
              style={styles.mark}
              resizeMode="contain"
            />
            <View style={styles.brandText}>
              <Text
                style={styles.wordmark}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t('common.veilo')}<Text style={styles.wordmarkAccent}>{t('common.scan')}</Text>
              </Text>
              <Text style={styles.brandTag}>{t('common.business')}</Text>
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
              ? t('layout.notificationsUnreadcountUnread', { unreadCount })
              : t('common.notifications')
          }
          onPress={() => openMenuKey('notifications')}
          hitSlop={6}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <BellIcon size={20} color={colors.text} strokeWidth={1.9} />
          {unreadCount > 0 ? (
            <View style={styles.count}>
              <Text style={styles.countText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('layout.myProfile')}
          onPress={() => openMenuKey('profile')}
          hitSlop={6}
          style={({ pressed }) => [styles.avatarRing, pressed && styles.pressedRing]}
        >
          <Avatar user={user} size={34} />
        </Pressable>
      </View>
      {/* Sub-pages (with a back arrow) stay in the store they were opened from. */}
      {onBack ? null : <StoreBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  // Soft, borderless buttons on a light tint.
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  pressed: { backgroundColor: colors.primaryLight },
  count: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  countText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.white },
  avatarRing: {
    padding: 2,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.secondarySoft,
  },
  pressedRing: { borderColor: colors.secondary },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 2,
  },
  mark: { width: 30, height: 30 },
  brandText: { flexShrink: 1 },
  wordmark: {
    fontSize: 18,
    lineHeight: 21,
    fontFamily: fonts.extrabold,
    color: colors.text,
    letterSpacing: -0.4,
  },
  wordmarkAccent: { color: colors.secondary },
  brandTag: {
    fontFamily: fonts.semibold,
    fontSize: 8.5,
    letterSpacing: 2.6,
    color: colors.textSecondary,
  },
  titles: { flex: 1, minWidth: 0, marginLeft: 2 },
  title: { fontSize: 17.5, fontFamily: fonts.bold, letterSpacing: -0.3, color: colors.text },
  subtitle: {
    marginTop: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
