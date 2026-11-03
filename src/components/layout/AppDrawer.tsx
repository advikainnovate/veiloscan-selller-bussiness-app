import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert as NativeAlert,
  Animated,
  BackHandler,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useDrawer } from '../../context/DrawerContext';
import { useStore } from '../../context/StoreContext';
import { useFetch } from '../../hooks/useFetch';
import { subscriptionService } from '../../services/subscription-service';
import { MENU_ITEMS, MENU_SECTIONS, type MenuItem } from '../../navigation/menu';
import { navigationRef, openMenuKey } from '../../navigation/navigationRef';
import { ChevronDownIcon, ChevronRightIcon, CloseIcon, LockIcon, LogoutIcon, PlusIcon, StoreIcon } from '../icons';
import { Avatar, displayName } from './Avatar';
import { StorePickerSheet } from './StoreSwitcher';

const markWhite = require('../../assets/brand/logo-mark-white.png');
const { version } = require('../../../package.json');

const NAVY = '#061b3a';
const NAVY_LIGHT = '#0b2a55';

/**
 * The Seller Panel's sidebar as a slide-in drawer: sections, permissions and
 * expandable children as on the web. `activeKey` is the page on screen.
 */
export function AppDrawer({ activeKey }: { activeKey: string | null }) {
  const { isOpen, close } = useDrawer();
  const { user, hasPermission, logout } = useAuth();
  const { stores, current: currentStore } = useStore();
  const [pickingStore, setPickingStore] = useState(false);
  // The plan, for the lock on features it doesn't include (as on the panel's sidebar).
  const needsPlan = MENU_ITEMS.some(item => item.feature && (!item.permission || hasPermission(item.permission)));
  const subscription = useFetch(() => (needsPlan ? subscriptionService.mine().catch(() => null) : Promise.resolve(null)), [needsPlan]);
  const locked = (item: MenuItem) => item.feature === 'consolidatedDashboard' && !!subscription.data && !subscription.data.consolidatedDashboard;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(320, screenWidth * 0.86);

  const progress = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const drag = useRef(new Animated.Value(0)).current; // ≤ 0 while swiping it shut
  const [mounted, setMounted] = useState(false);
  // Items with children the user opened or closed by hand (otherwise: open while on one of their pages).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) setMounted(true);
    drag.setValue(0);
    Animated.timing(progress, {
      toValue: isOpen ? 1 : 0,
      duration: isOpen ? 260 : 200,
      easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !isOpen) setMounted(false);
    });
  }, [isOpen, progress, drag]);

  // Android back closes the drawer first.
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  // Swipe left to close.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => drag.setValue(Math.min(0, g.dx)),
        onPanResponderRelease: (_, g) => {
          if (g.dx < -width / 3 || g.vx < -0.5) close();
          else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [drag, width, close],
  );

  const visibleItems = MENU_ITEMS.filter(item => !item.permission || hasPermission(item.permission));

  function go(key: string) {
    close();
    openMenuKey(key);
  }

  function confirmSignOut() {
    NativeAlert.alert('Sign out?', 'You will need to sign in again to manage your store.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          close();
          logout();
        },
      },
    ]);
  }

  if (!mounted) return null;

  const translateX = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }),
    drag,
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        accessibilityViewIsModal
        style={[styles.panel, { width, paddingTop: insets.top, transform: [{ translateX }] }]}
      >
        <View style={styles.brandRow}>
          <Image source={markWhite} style={styles.mark} resizeMode="contain" />
          <View style={styles.flex}>
            <Text style={styles.brand}>
              Veilo<Text style={styles.brandAccent}>Scan</Text>
            </Text>
            <Text style={styles.brandSub}>Seller Business</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close menu" hitSlop={10} onPress={close} style={styles.closeBtn}>
            <CloseIcon size={18} color="rgba(255,255,255,0.75)" />
          </Pressable>
        </View>

        <Pressable onPress={() => go('profile')} style={({ pressed }) => [styles.userCard, pressed && styles.pressed]}>
          <Avatar user={user} size={42} />
          <View style={styles.flex}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName(user)}
            </Text>
            <Text style={styles.userMeta} numberOfLines={1}>
              {user?.userType === 'SELLER_USER' ? 'Store staff' : 'Store owner'}
              {user?.email ? ` · ${user.email}` : ''}
            </Text>
          </View>
          <ChevronRightIcon size={16} color="rgba(255,255,255,0.5)" />
        </Pressable>

        {currentStore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={stores.length > 1 ? `Store: ${currentStore.name}. Switch store` : `Store: ${currentStore.name}. Manage store`}
            onPress={() => setPickingStore(true)}
            style={({ pressed }) => [styles.storeRow, pressed && styles.pressed]}
          >
            <StoreIcon size={18} color="#ff8a33" />
            <View style={styles.flex}>
              <Text style={styles.storeLabel}>{stores.length > 1 ? 'CURRENT STORE' : 'STORE'}</Text>
              <Text style={styles.storeName} numberOfLines={1}>
                {currentStore.name}
              </Text>
            </View>
            <Text style={styles.storeSwitch}>{stores.length > 1 ? 'Switch' : 'Manage'}</Text>
          </Pressable>
        ) : hasPermission('stores:create') ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set up store"
            onPress={() => {
              close();
              if (navigationRef.isReady()) navigationRef.navigate('CreateStore');
            }}
            style={({ pressed }) => [styles.storeRow, pressed && styles.pressed]}
          >
            <PlusIcon size={18} color="#ff8a33" />
            <View style={styles.flex}>
              <Text style={styles.storeName}>Set up store</Text>
            </View>
          </Pressable>
        ) : null}

        <ScrollView style={styles.flex} contentContainerStyle={styles.nav} showsVerticalScrollIndicator={false}>
          {MENU_SECTIONS.map(section => {
            const items = visibleItems.filter(item => item.section === section.key);
            if (!items.length) return null;
            return (
              <View key={section.key} style={styles.section}>
                {section.label ? <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text> : null}
                {items.map(item => (
                  <DrawerItem
                    key={item.key}
                    item={item}
                    activeKey={activeKey}
                    hasPermission={hasPermission}
                    locked={locked(item)}
                    expanded={toggled[item.key]}
                    onToggle={next => setToggled(t => ({ ...t, [item.key]: next }))}
                    onOpen={go}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={confirmSignOut} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
            <LogoutIcon size={20} color="#ff8a33" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
          <Text style={styles.version}>VeiloScan Business v{version}</Text>
        </View>
      </Animated.View>
      <StorePickerSheet visible={pickingStore} onClose={() => setPickingStore(false)} onSwitched={close} />
    </View>
  );
}

function DrawerItem({
  item,
  activeKey,
  hasPermission,
  locked,
  expanded: toggledOpen,
  onToggle,
  onOpen,
}: {
  item: MenuItem;
  activeKey: string | null;
  hasPermission: (permission: string) => boolean;
  locked: boolean;
  expanded: boolean | undefined;
  onToggle: (next: boolean) => void;
  onOpen: (key: string) => void;
}) {
  const children = item.children?.filter(c => !c.permission || hasPermission(c.permission)) ?? [];
  const childActive = children.some(c => c.key === activeKey);
  const onItem = item.key === activeKey || childActive;
  const expanded = children.length > 0 && (toggledOpen ?? childActive);
  // A parent with children is highlighted through its active child.
  const isActive = onItem && !expanded;
  const Icon = item.icon;
  const iconColor = onItem ? colors.white : '#94a3b8';

  return (
    <View>
      <View style={[styles.item, isActive ? styles.itemActive : onItem ? styles.itemOnPath : null]}>
        <Pressable
          onPress={() => (children.length ? onToggle(!expanded) : onOpen(item.key))}
          style={({ pressed }) => [styles.itemMain, pressed && !isActive && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive, expanded: children.length ? expanded : undefined }}
        >
          <Icon size={20} color={iconColor} />
          <Text style={[styles.itemText, onItem && styles.itemTextActive]} numberOfLines={1}>
            {item.label}
          </Text>
          {locked ? (
            <View accessible accessibilityLabel="Not included in your plan">
              <LockIcon size={14} color="#94a3b8" />
            </View>
          ) : children.length ? (
            <View style={!expanded && styles.rotated}>
              <ChevronDownIcon size={16} color={onItem ? colors.white : '#94a3b8'} />
            </View>
          ) : isActive ? (
            <ChevronRightIcon size={16} color={colors.white} />
          ) : null}
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.children}>
          {children.map(child => {
            const active = child.key === activeKey;
            return (
              <Pressable
                key={child.key}
                onPress={() => onOpen(child.key)}
                style={({ pressed }) => [styles.child, active && styles.childActive, pressed && !active && styles.pressed]}
              >
                <View style={[styles.dot, active && styles.dotActive]} />
                <Text style={[styles.childText, active && styles.childTextActive]}>{child.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,19,41,0.55)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: NAVY,
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: NAVY_LIGHT },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: NAVY_LIGHT,
  },
  mark: { width: 36, height: 36 },
  brand: { fontSize: 21, fontFamily: fonts.extrabold, color: colors.white, letterSpacing: -0.4 },
  brandAccent: { color: colors.secondary },
  brandSub: { fontFamily: fonts.regular, fontSize: 12, color: '#94a3b8', marginTop: -1 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 12,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userName: { fontSize: 15, fontFamily: fonts.bold, color: colors.white },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,138,51,0.1)',
  },
  storeLabel: { fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.6, color: '#94a3b8' },
  storeName: { marginTop: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.white },
  storeSwitch: { fontSize: 12.5, fontFamily: fonts.semibold, color: '#ff8a33' },
  userMeta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: '#94a3b8' },
  nav: { paddingHorizontal: 12, paddingBottom: 16, gap: 18 },
  section: { gap: 2 },
  sectionLabel: {
    marginBottom: 6,
    paddingHorizontal: 12,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.3,
    color: 'rgba(255,138,51,0.75)',
  },
  item: { borderRadius: radius.md },
  itemActive: { backgroundColor: colors.secondary },
  itemOnPath: { backgroundColor: NAVY_LIGHT },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  itemText: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: '#cbd5e1' },
  itemTextActive: { color: colors.white, fontFamily: fonts.bold },
  rotated: { transform: [{ rotate: '-90deg' }] },
  children: {
    marginLeft: 22,
    marginTop: 2,
    marginBottom: 4,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: NAVY_LIGHT,
    gap: 2,
  },
  child: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm },
  childActive: { backgroundColor: colors.secondary },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#64748b' },
  dotActive: { backgroundColor: colors.white },
  childText: { fontSize: 13.5, fontFamily: fonts.medium, color: '#94a3b8' },
  childTextActive: { color: colors.white, fontFamily: fonts.bold },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: NAVY_LIGHT,
    gap: 8,
  },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: radius.md },
  signOutText: { fontSize: 15, fontFamily: fonts.bold, color: '#ff8a33' },
  version: { paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 11, color: '#64748b' },
});
