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
import { OpsCard, opsStyles, PageTitle, profitHidden, RangeChips, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { AlertCircleIcon, BarChartIcon, BoxIcon, BuildingIcon, CartIcon, ChevronRightIcon, LockIcon, ShoppingBagIcon, StoreIcon, TruckIcon, WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/**
 * Operations › All Stores: every store a seller owns, combined. Each store's
 * row matches its own dashboard; tap one to switch to it.
 */
export function AllStoresScreen({ navigation }: ScreenProps<'AllStores'>) {
  const { t } = useTranslation();
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
        <AppHeader title={t('common.allStores')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.allStores')} icon={BuildingIcon} allowed={false} />
      </View>
    );
  }

  if (plan.loading) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('common.allStores')} onBack={navigation.goBack} />
        <View style={opsStyles.content}>
          <ListSkeleton rows={4} height={110} />
        </View>
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('common.allStores')} onBack={navigation.goBack} />
        <ScrollView contentContainerStyle={opsStyles.content}>
          <View style={opsStyles.row}>
            <PageTitle title={t('common.businessOverview')} subtitle={t('operations.combinedPerformanceAcrossAllYourStores')} />
            <View style={styles.locked}>
              <LockIcon size={12} color={colors.textSecondary} />
              <Text style={styles.lockedText}>{t('operations.locked')}</Text>
            </View>
          </View>
          <View style={styles.upgrade}>
            <View style={styles.upgradeIcon}>
              <BuildingIcon size={22} color={colors.secondaryDark} />
            </View>
            <Text style={styles.upgradeTitle}>{t('operations.consolidatedReportingIsnTInYour')}</Text>
            <Text style={styles.upgradeText}>
              {t('operations.planLetsYouSwitchStores', {
                plan: plan.data?.plan?.planName ? t('store.yourNamedPlan', { name: plan.data.plan.planName }) : t('store.yourPlan'),
                stores: stores.length ? t('common.storeCount', { count: stores.length }) : t('operations.storesLower'),
              })}
            </Text>
            <Text style={styles.upgradeHint}>{t('operations.upgradeToTheBusinessPlanContact')}</Text>
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
    toast(t('common.switchedToName', { name: entry.store.name }));
    navigation.navigate('BusinessOverview');
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('common.allStores')} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <PageTitle
          title={t('common.businessOverview')}
          subtitle={`${data ? t('operations.allStoresCount', { count: data.storeCount }) : t('common.allStores')} · ${rangeLabel(range)}`}
        />
        <RangeChips today={today} value={range} onChange={setRange} />
        {error && !data ? <ErrorState message={error} onRetry={() => reload()} /> : null}

        <StatGrid>
          <StatCard icon={CartIcon} tone="orange" label={t('common.totalSales')} value={money(totals?.sales)} delta={previous ? change(totals?.sales, previous.sales) : undefined} loading={loading} />
          <StatCard
            icon={WalletIcon}
            tone="red"
            label={t('common.totalExpenses')}
            value={money(totals?.expenses)}
            delta={previous ? change(totals?.expenses, previous.expenses) : undefined}
            invertDelta
            loading={loading}
          />
          <StatCard
            icon={BoxIcon}
            tone="amber"
            label={t('operations.costOfGoodsSold')}
            value={canProfit ? money(totals?.productCost) : '—'}
            delta={previous && canProfit ? change(totals?.productCost, previous.productCost) : undefined}
            invertDelta
            sub={canProfit ? undefined : profitHidden()}
            loading={loading}
          />
          <StatCard
            icon={BarChartIcon}
            tone="emerald"
            label={t('operations.netProfit')}
            value={canProfit ? money(totals?.netProfit) : '—'}
            negative={(totals?.netProfit ?? 0) < 0}
            delta={previous && canProfit ? change(totals?.netProfit, previous.netProfit) : undefined}
            sub={canProfit ? (totals?.netMargin != null ? t('operations.netmarginPercentMargin', { netMargin: totals.netMargin }) : undefined) : profitHidden()}
            loading={loading}
          />
          <StatCard icon={ShoppingBagIcon} tone="violet" label={t('common.orders')} value={count(totals?.orders)} delta={previous ? change(totals?.orders, previous.orders) : undefined} loading={loading} />
          <StatCard
            icon={WalletIcon}
            tone="sky"
            label={t('operations.collection')}
            value={money(totals?.collection)}
            delta={previous ? change(totals?.collection, previous.collection) : undefined}
            sub={totals ? t('operations.cashCashcollectionOnlineOnlinecollection', { cashCollection: money(totals.cashCollection), onlineCollection: money(totals.onlineCollection) }) : undefined}
            loading={loading}
          />
        </StatGrid>

        <OpsCard title={t('operations.storeWisePerformance')} description={t('operations.eachStoresShareOfTheCombined')}>
          {loading ? (
            <ListSkeleton rows={3} height={64} />
          ) : !data?.stores.length ? (
            <EmptyState icon={StoreIcon} title={t('common.noStoresYet')} text={t('operations.createAStoreToStartSeeing')} />
          ) : (
            <View style={styles.stores}>
              {data.stores.map(entry => (
                <StoreRow key={entry.store.id} entry={entry} totalSales={data.totals?.sales ?? 0} canProfit={canProfit} onOpen={() => openStore(entry)} />
              ))}
            </View>
          )}
        </OpsCard>

        <OpsCard title={t('operations.combinedInventory')} description={t('operations.stockAlertsAcrossEveryStore')}>
          <StatGrid>
            <StatCard icon={AlertCircleIcon} tone="amber" label={t('common.lowStock2')} value={count(data?.alerts.lowStock)} loading={loading} />
            <StatCard icon={BoxIcon} tone="red" label={t('common.outOfStock2')} value={count(data?.alerts.outOfStock)} loading={loading} />
            <StatCard icon={TruckIcon} tone="sky" label={t('operations.pendingStockOrders')} value={count(data?.alerts.pendingStockOrders)} loading={loading} />
            <StatCard icon={TruckIcon} tone="slate" label={t('operations.delayedStockOrders')} value={count(data?.alerts.delayedStockOrders)} loading={loading} />
          </StatGrid>
        </OpsCard>
      </ScrollView>
    </View>
  );
}

function StoreRow({ entry, totalSales, canProfit, onOpen }: { entry: ConsolidatedStore; totalSales: number; canProfit: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const share = totalSales > 0 ? (entry.metrics.sales / totalSales) * 100 : 0;
  const profit = entry.metrics.netProfit;
  const delta = change(entry.metrics.sales, entry.previous.sales);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('operations.nameSalesSales', { name: entry.store.name, sales: money(entry.metrics.sales) })}
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
        <Text style={opsStyles.meta}>{t('operations.fixedPercentOfSalesOrdersOrders', { fixed: share.toFixed(1), orders: count(entry.metrics.orders) })}</Text>
      </View>
      <View style={styles.right}>
        <Text style={opsStyles.amount}>{money(entry.metrics.sales)}</Text>
        <Text style={[styles.profit, !canProfit ? styles.mutedText : (profit ?? 0) < 0 ? opsStyles.danger : opsStyles.success]}>
          {canProfit ? t('common.profitProfit', { profit: money(profit) }) : '—'}
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
