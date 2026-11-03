import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { STORE_PENDING, useStore } from '../context/StoreContext';
import { useNotifications } from '../context/NotificationContext';
import { extractErrorMessage } from '../lib/api';
import { formatNumber, formatRupees, trend } from '../lib/format';
import { dashboardService, type Overview } from '../services/dashboard-service';
import { AppHeader } from '../components/layout/AppHeader';
import { HeroCarousel } from '../components/home/HeroCarousel';
import { StatCard } from '../components/home/StatCard';
import { QuickAccess } from '../components/home/QuickAccess';
import { GrowCard } from '../components/home/GrowCard';
import { BoxIcon, CartIcon, LayersIcon, UsersIcon } from '../components/icons';
import type { TabScreenProps } from '../navigation/types';

interface HomeData {
  overview: Overview;
  /** null when the role can't see customers. */
  customers: number | null;
}

/** Home: banner, today's figures, quick access and a growth nudge. */
export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { hasPermission } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const canOrders = hasPermission('orders:manage');
  const canProducts = hasPermission('products-master:manage');
  const canCustomers = hasPermission('customers:manage');
  const { storeKey } = useStore();

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
  // null = still loading (skeleton); '—' = loaded but unavailable.
  const valueOf = (text: string | undefined) => text ?? (data || error ? '—' : null);
  // Before the first load a card shows if the role should see it; after, only if the API returned it.
  const show = (loaded: unknown, allowed: boolean) => (data ? loaded != null : allowed);

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
        <HeroCarousel />

        <View style={styles.section}>
          {error && !data ? (
            <Text style={styles.error} onPress={load} accessibilityRole="button">
              Couldn't load today's figures. {error} Tap to retry.
            </Text>
          ) : null}
          <View style={styles.stats}>
            {show(kpis?.orders, canOrders) ? (
              <StatCard
                label="Today Orders"
                icon={CartIcon}
                tone="orange"
                value={valueOf(kpis?.orders ? formatNumber(kpis.orders.value) : undefined)}
                trend={kpis?.orders ? trend(kpis.orders.value, kpis.orders.previous) : undefined}
              />
            ) : null}
            {show(kpis?.sales, canOrders) ? (
              <StatCard
                label="Today's Sales"
                icon={LayersIcon}
                tone="amber"
                value={valueOf(kpis?.sales ? formatRupees(kpis.sales.value) : undefined)}
                trend={kpis?.sales ? trend(kpis.sales.value, kpis.sales.previous) : undefined}
              />
            ) : null}
            {show(kpis?.products, canProducts) ? (
              <StatCard
                label="Total Products"
                icon={BoxIcon}
                tone="violet"
                value={valueOf(kpis?.products ? formatNumber(kpis.products.value) : undefined)}
              />
            ) : null}
            {show(data?.customers, canCustomers) ? (
              <StatCard
                label="Total Customers"
                icon={UsersIcon}
                tone="green"
                value={valueOf(data?.customers != null ? formatNumber(data.customers) : undefined)}
              />
            ) : null}
          </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 14, paddingBottom: 28 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  error: {
    marginBottom: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
    color: colors.errorDark,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
});
