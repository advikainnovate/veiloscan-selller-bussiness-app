import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { STORE_PENDING, useStore } from '../context/StoreContext';
import { useNotifications } from '../context/NotificationContext';
import { extractErrorMessage } from '../lib/api';
import { formatNumber, formatRupees, trend, type Trend } from '../lib/format';
import { dashboardService, type Overview } from '../services/dashboard-service';
import { AppHeader } from '../components/layout/AppHeader';
import { HeroCarousel } from '../components/home/HeroCarousel';
import { Gradient } from '../components/ui/Gradient';
import { QuickAccess } from '../components/home/QuickAccess';
import { GrowCard } from '../components/home/GrowCard';
import { ArrowDownIcon, ArrowUpIcon, BoxIcon, PlusIcon, StoreIcon } from '../components/icons';
import type { TabScreenProps } from '../navigation/types';

interface HomeData {
  overview: Overview;
  /** null when the role can't see customers. */
  customers: number | null;
}

/** Home: a greeting, today's figures, shortcuts, the banner, quick access and a growth nudge. */
export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { hasPermission, user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const canOrders = hasPermission('orders:manage');
  const canProducts = hasPermission('products-master:manage');
  const canCustomers = hasPermission('customers:manage');
  const { storeKey, current } = useStore();

  const load = useCallback(async () => {
    try {
      const [overview, customers] = await Promise.all([
        dashboardService.today(),
        canCustomers ? dashboardService.customerCount() : Promise.resolve(null),
      ]);
      setData({ overview, customers });
      setError(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
    // A new store's figures (storeKey isn't read: it rides in the request header).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCustomers, storeKey]);

  // Another store's figures mustn't linger while this one's load.
  useEffect(() => setData(null), [storeKey]);

  // Fresh figures each time Home comes back into view.
  useFocusEffect(
    useCallback(() => {
      // Wait for the store, so the figures aren't first loaded for every store.
      if (storeKey !== STORE_PENDING) load();
    }, [load, storeKey]),
  );

  async function onRefresh() {
    setRefreshing(true);
    refreshNotifications();
    await load();
    setRefreshing(false);
  }

  const kpis = data?.overview.kpis;
  const loadingFigures = !data && !error;
  const salesTrend = kpis?.sales ? trend(kpis.sales.value, kpis.sales.previous) : undefined;
  const ordersTrend = kpis?.orders ? trend(kpis.orders.value, kpis.orders.previous) : undefined;
  const storeName = current?.name ?? data?.overview.storeName ?? null;
  const firstName = String(user?.firstName ?? '').trim();
  // null = still loading; '—' = loaded but unavailable.
  const figure = (text: string | undefined) => text ?? (loadingFigures ? '…' : '—');

  return (
    <View style={styles.screen}>
      <AppHeader brand />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondary} colors={[colors.secondary]} />
        }
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <View style={styles.flex}>
            <Text style={styles.hello}>{`${greeting()}${firstName ? ',' : ''}`}</Text>
            {firstName ? (
              <Text style={styles.name} numberOfLines={1}>
                {firstName}
              </Text>
            ) : null}
            <Text style={styles.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          {storeName ? (
            <View style={styles.storeChip}>
              <StoreIcon size={14} color={colors.secondary} />
              <Text style={styles.storeText} numberOfLines={1}>
                {storeName}
              </Text>
            </View>
          ) : null}
        </View>

        {error && !data ? (
          <Text style={[styles.error, styles.section]} onPress={load} accessibilityRole="button">
            Couldn't load today's figures. {error} Tap to retry.
          </Text>
        ) : null}

        {/* Today */}
        {canOrders || canProducts || canCustomers ? (
          <View style={[styles.section, styles.todayWrap]}>
            <View style={styles.today}>
              <Gradient colors={[colors.primary, '#0b2a52']} direction="diagonal" borderRadius={22} />
              <View style={styles.glow} />
              {canOrders ? (
                <>
                  <View style={styles.todayTop}>
                    <Text style={styles.todayLabel}>Today's sales</Text>
                    {salesTrend ? <TrendPill trend={salesTrend} /> : null}
                  </View>
                  <Text style={styles.todayValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {figure(kpis?.sales ? formatRupees(kpis.sales.value) : undefined)}
                  </Text>
                </>
              ) : (
                <Text style={styles.todayLabel}>Your store today</Text>
              )}
              <View style={styles.todayStats}>
                {canOrders ? (
                  <TodayStat
                    label="Orders today"
                    value={figure(kpis?.orders ? formatNumber(kpis.orders.value) : undefined)}
                    hint={ordersTrend ? (ordersTrend.direction === 'flat' ? 'Same as yesterday' : `${ordersTrend.label} vs yesterday`) : undefined}
                    onPress={() => navigation.navigate('Orders')}
                  />
                ) : null}
                {canProducts ? (
                  <TodayStat label="Products" value={figure(kpis?.products ? formatNumber(kpis.products.value) : undefined)} onPress={() => navigation.navigate('Products')} />
                ) : null}
                {canCustomers ? (
                  <TodayStat label="Customers" value={figure(data?.customers != null ? formatNumber(data.customers) : undefined)} onPress={() => navigation.navigate('Customers')} />
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* The two things done most often */}
        {canOrders || canProducts ? (
          <View style={[styles.section, styles.shortcuts]}>
            {canOrders ? (
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateOrder')} style={({ pressed }) => [styles.shortcut, styles.shortcutPrimary, pressed && styles.pressed]}>
                <View style={[styles.shortcutIcon, styles.shortcutIconPrimary]}>
                  <PlusIcon size={18} color={colors.white} strokeWidth={2.4} />
                </View>
                <Text style={[styles.shortcutText, styles.shortcutTextPrimary]}>New order</Text>
              </Pressable>
            ) : null}
            {canProducts ? (
              <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ProductEditor', {})} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
                <View style={styles.shortcutIcon}>
                  <BoxIcon size={18} color={colors.secondary} />
                </View>
                <Text style={styles.shortcutText}>Add product</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* The banner pads itself, edge to edge. */}
        <View style={styles.banner}>
          <HeroCarousel />
        </View>

        <View style={styles.section}>
          <QuickAccess />
        </View>

        {canProducts ? (
          <View style={styles.section}>
            <GrowCard onAddProduct={() => navigation.navigate('Products')} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function greeting(hour = new Date().getHours()) {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function TrendPill({ trend: t }: { trend: Trend }) {
  const up = t.direction === 'up';
  const flat = t.direction === 'flat';
  return (
    <View style={[styles.trend, up ? styles.trendUp : flat ? styles.trendFlat : styles.trendDown]}>
      {flat ? null : up ? <ArrowUpIcon size={12} color="#4ade80" strokeWidth={2.4} /> : <ArrowDownIcon size={12} color="#fca5a5" strokeWidth={2.4} />}
      <Text style={[styles.trendText, up ? styles.trendTextUp : flat ? styles.trendTextFlat : styles.trendTextDown]}>{`${t.label}${flat ? ' yesterday' : ''}`}</Text>
    </View>
  );
}

function TodayStat({ label, value, hint, onPress }: { label: string; value: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.statHint} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 6, paddingBottom: 28 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  banner: { marginTop: 16 },
  greeting: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  hello: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  name: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: colors.text },
  date: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  storeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '45%', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.secondaryLight },
  storeText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.secondaryDark },
  todayWrap: { marginTop: 14 },
  today: { overflow: 'hidden', padding: 18, borderRadius: 22, backgroundColor: colors.primary, ...shadow.raised },
  glow: { position: 'absolute', top: -70, right: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,138,51,0.06)' },
  todayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  todayLabel: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  todayValue: { marginTop: 4, fontFamily: fonts.extrabold, fontSize: 34, letterSpacing: -0.8, color: colors.white },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  trendUp: { backgroundColor: 'rgba(74,222,128,0.14)' },
  trendDown: { backgroundColor: 'rgba(248,113,113,0.16)' },
  trendFlat: { backgroundColor: 'rgba(255,255,255,0.1)' },
  trendText: { fontFamily: fonts.semibold, fontSize: 11.5 },
  trendTextUp: { color: '#bbf7d0' },
  trendTextDown: { color: '#fecaca' },
  trendTextFlat: { color: 'rgba(255,255,255,0.75)' },
  todayStats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.07)' },
  statPressed: { backgroundColor: 'rgba(255,255,255,0.14)' },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' },
  statValue: { marginTop: 3, fontFamily: fonts.extrabold, fontSize: 19, color: colors.white },
  statHint: { marginTop: 2, fontFamily: fonts.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.55)' },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow.card },
  shortcutPrimary: { backgroundColor: colors.secondary, ...shadow.button },
  shortcutIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  shortcutIconPrimary: { backgroundColor: 'rgba(255,255,255,0.2)' },
  shortcutText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  shortcutTextPrimary: { color: colors.white },
  pressed: { opacity: 0.85 },
  error: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
    color: colors.errorDark,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
});
