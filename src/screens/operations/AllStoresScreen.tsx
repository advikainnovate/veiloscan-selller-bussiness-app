import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { change, count, money, presetRange, rangeLabel, todayDay, type OpsRange } from '../../lib/operations';
import { consolidatedService, type ConsolidatedStore } from '../../services/store-operations-service';
import { subscriptionService } from '../../services/subscription-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { OpsCard, opsStyles, PageTitle, PROFIT_HIDDEN, RangeChips, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { AlertCircleIcon, BarChartIcon, BoxIcon, BuildingIcon, CartIcon, ChevronRightIcon, LockIcon, ShoppingBagIcon, StoreIcon, TruckIcon, WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

/**
 * Operations › All Stores: every store a seller owns, combined. Each store's
 * row matches its own dashboard; tap one to switch to it.
 */
export function AllStoresScreen({ navigation }: ScreenProps<'AllStores'>) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('store-operations:manage');
  const { stores, select } = useStore();
  const toast = useToast();
  const today = todayDay();
  const [range, setRange] = useState<OpsRange>(() => presetRange(today, 'month'));

  const plan = useFetch(() => (allowed ? subscriptionService.mine() : Promise.resolve(null)), [allowed]);
  const enabled = !!plan.data?.consolidatedDashboard;
  const { data, error, loading, refreshing, reload } = useFetch(
    () => (enabled ? consolidatedService.overview({ from: range.from, to: range.to }) : Promise.resolve(null)),
    [enabled, range.from, range.to],
  );

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="All Stores" onBack={navigation.goBack} />
        <ComingSoon label="All Stores" icon={BuildingIcon} allowed={false} />
      </View>
    );
  }

  if (plan.loading) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="All Stores" onBack={navigation.goBack} />
        <View style={opsStyles.content}>
          <ListSkeleton rows={4} height={110} />
        </View>
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="All Stores" onBack={navigation.goBack} />
        <ScrollView contentContainerStyle={opsStyles.content}>
          <View style={opsStyles.row}>
            <PageTitle title="Business Overview" subtitle="Combined performance across all your stores" />
            <View style={styles.locked}>
              <LockIcon size={12} color={colors.textSecondary} />
              <Text style={styles.lockedText}>Locked</Text>
            </View>
          </View>
          <View style={styles.upgrade}>
            <View style={styles.upgradeIcon}>
              <BuildingIcon size={22} color={colors.secondaryDark} />
            </View>
            <Text style={styles.upgradeTitle}>Consolidated reporting isn't in your plan</Text>
            <Text style={styles.upgradeText}>
              {`${plan.data?.plan?.planName ? `Your ${plan.data.plan.planName} plan` : 'Your plan'} lets you switch between your ${stores.length || ''} ${
                stores.length === 1 ? 'store' : 'stores'
              } and read each one's dashboard. Upgrade to see their sales, expenses and net profit combined in one place.`}
            </Text>
            <Text style={styles.upgradeHint}>Upgrade to the Business plan — contact your account manager to switch.</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const totals = data?.totals ?? undefined;
  const previous = data?.previousTotals ?? undefined;
  const canProfit = data?.canViewProfit ?? false;

  function openStore(entry: ConsolidatedStore) {
    select(entry.store.id);
    toast(`Switched to ${entry.store.name}`);
    navigation.navigate('BusinessOverview');
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="All Stores" onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <PageTitle
          title="Business Overview"
          subtitle={`${data ? `All ${data.storeCount} ${data.storeCount === 1 ? 'store' : 'stores'}` : 'All stores'} · ${rangeLabel(range)}`}
        />
        <RangeChips today={today} value={range} onChange={setRange} />
        {error && !data ? <ErrorState message={error} onRetry={() => reload()} /> : null}

        <StatGrid>
          <StatCard icon={CartIcon} tone="orange" label="Total Sales" value={money(totals?.sales)} delta={previous ? change(totals?.sales, previous.sales) : undefined} loading={loading} />
          <StatCard
            icon={WalletIcon}
            tone="red"
            label="Total Expenses"
            value={money(totals?.expenses)}
            delta={previous ? change(totals?.expenses, previous.expenses) : undefined}
            invertDelta
            loading={loading}
          />
          <StatCard
            icon={BoxIcon}
            tone="amber"
            label="Cost of Goods Sold"
            value={canProfit ? money(totals?.productCost) : '—'}
            delta={previous && canProfit ? change(totals?.productCost, previous.productCost) : undefined}
            invertDelta
            sub={canProfit ? undefined : PROFIT_HIDDEN}
            loading={loading}
          />
          <StatCard
            icon={BarChartIcon}
            tone="emerald"
            label="Net Profit"
            value={canProfit ? money(totals?.netProfit) : '—'}
            negative={(totals?.netProfit ?? 0) < 0}
            delta={previous && canProfit ? change(totals?.netProfit, previous.netProfit) : undefined}
            sub={canProfit ? (totals?.netMargin != null ? `${totals.netMargin}% margin` : undefined) : PROFIT_HIDDEN}
            loading={loading}
          />
          <StatCard icon={ShoppingBagIcon} tone="violet" label="Orders" value={count(totals?.orders)} delta={previous ? change(totals?.orders, previous.orders) : undefined} loading={loading} />
          <StatCard
            icon={WalletIcon}
            tone="sky"
            label="Collection"
            value={money(totals?.collection)}
            delta={previous ? change(totals?.collection, previous.collection) : undefined}
            sub={totals ? `Cash ${money(totals.cashCollection)} · Online ${money(totals.onlineCollection)}` : undefined}
            loading={loading}
          />
        </StatGrid>

        <OpsCard title="Store-wise performance" description="Each store's share of the combined totals. Tap one to open its own dashboard.">
          {loading ? (
            <ListSkeleton rows={3} height={64} />
          ) : !data?.stores.length ? (
            <EmptyState icon={StoreIcon} title="No stores yet" text="Create a store to start seeing its performance here." />
          ) : (
            <View style={styles.stores}>
              {data.stores.map(entry => (
                <StoreRow key={entry.store.id} entry={entry} totalSales={data.totals?.sales ?? 0} canProfit={canProfit} onOpen={() => openStore(entry)} />
              ))}
            </View>
          )}
        </OpsCard>

        <OpsCard title="Combined inventory" description="Stock alerts across every store.">
          <StatGrid>
            <StatCard icon={AlertCircleIcon} tone="amber" label="Low stock" value={count(data?.alerts.lowStock)} loading={loading} />
            <StatCard icon={BoxIcon} tone="red" label="Out of stock" value={count(data?.alerts.outOfStock)} loading={loading} />
            <StatCard icon={TruckIcon} tone="sky" label="Pending stock orders" value={count(data?.alerts.pendingStockOrders)} loading={loading} />
            <StatCard icon={TruckIcon} tone="slate" label="Delayed stock orders" value={count(data?.alerts.delayedStockOrders)} loading={loading} />
          </StatGrid>
        </OpsCard>
      </ScrollView>
    </View>
  );
}

function StoreRow({ entry, totalSales, canProfit, onOpen }: { entry: ConsolidatedStore; totalSales: number; canProfit: boolean; onOpen: () => void }) {
  const share = totalSales > 0 ? (entry.metrics.sales / totalSales) * 100 : 0;
  const profit = entry.metrics.netProfit;
  const delta = change(entry.metrics.sales, entry.previous.sales);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.store.name}, ${money(entry.metrics.sales)} sales`}
      onPress={onOpen}
      style={({ pressed }) => [styles.storeRow, pressed && styles.pressed]}
    >
      <View style={styles.storeIcon}>
        <StoreIcon size={16} color={colors.textSecondary} />
      </View>
      <View style={styles.flex}>
        <Text style={opsStyles.title} numberOfLines={1}>
          {entry.store.name}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(share, 100)}%` }]} />
        </View>
        <Text style={opsStyles.meta}>{`${share.toFixed(1)}% of sales · ${count(entry.metrics.orders)} orders`}</Text>
      </View>
      <View style={styles.right}>
        <Text style={opsStyles.amount}>{money(entry.metrics.sales)}</Text>
        <Text style={[styles.profit, !canProfit ? styles.mutedText : (profit ?? 0) < 0 ? opsStyles.danger : opsStyles.success]}>
          {canProfit ? `${money(profit)} profit` : '—'}
        </Text>
        {delta !== null ? (
          <Text style={[styles.delta, delta >= 0 ? opsStyles.success : opsStyles.danger]}>{`${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`}</Text>
        ) : null}
      </View>
      <ChevronRightIcon size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.background },
  lockedText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  upgrade: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  upgradeIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  upgradeTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, textAlign: 'center' },
  upgradeText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center' },
  upgradeHint: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.secondaryLight, fontFamily: fonts.semibold, fontSize: 12, color: colors.secondaryDark, textAlign: 'center' },
  stores: { gap: 8 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: '#fffaf5' },
  storeIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  track: { marginTop: 6, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.secondary },
  right: { alignItems: 'flex-end' },
  profit: { marginTop: 1, fontFamily: fonts.semibold, fontSize: 12 },
  mutedText: { color: colors.textMuted },
  delta: { fontFamily: fonts.semibold, fontSize: 11 },
});
