import React, { useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useFetch } from '../../hooks/useFetch';
import { autoInterval, CHART_COLORS, formatReportDay, saleStatus } from '../../lib/sales-report';
import { change, count, money, presetRange, rangeLabel, todayDay, type OpsRange } from '../../lib/operations';
import { openMenuKey } from '../../navigation/navigationRef';
import { storeOperationsService, type SalesGroupRow, type SalesOrderRow, type TrendInterval } from '../../services/store-operations-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Choices } from '../../components/form/Fields';
import { EmptyState, ErrorState } from '../../components/list/ListParts';
import { Ring } from '../../components/reports/SalesCharts';
import { ComboChart } from '../../components/operations/OpsCharts';
import { LinkButton, NoData, OpsCard, opsStyles, PageTitle, Placeholder, profitHidden, RangeChips, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { BarChartIcon, BoxIcon, CartIcon, ChartTrendIcon, ClockIcon, StoreIcon, TruckIcon, WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const PRESET_KEYS = ['today', 'yesterday', 'week', 'month', '3m'];
const COMPARE: Record<string, string> = {
  get today() { return i18n.t('common.vsYesterday'); },
  get yesterday() { return i18n.t('operations.vsDayBefore'); },
  get week() { return i18n.t('operations.vsLastWeek'); },
  get month() { return i18n.t('common.vsLastMonth'); },
  '3m': 'vs previous 3 months',
};
const COLORS = { sales: '#3b82f6', gross: '#16a34a', net: '#f97316', expenses: CHART_COLORS[7] };
type SeriesView = 'all' | 'expenses' | 'sales';

/** Operations › Business Overview: sales, profit, expenses and stock alerts at a glance. */
export function BusinessOverviewScreen({ navigation }: ScreenProps<'BusinessOverview'>) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('store-operations:manage');
  const { current: store } = useStore();
  const storeId = allowed ? store?.id ?? '' : '';
  const today = todayDay();
  const [range, setRange] = useState<OpsRange>(() => presetRange(today, 'month'));
  const [chosenInterval, setChosenInterval] = useState<TrendInterval | null>(null);
  const interval = chosenInterval ?? autoInterval(range);
  const [view, setView] = useState<SeriesView>('all');

  const none = Promise.resolve(null);
  const overview = useFetch(() => (storeId ? storeOperationsService.overview(storeId, range) : none), [storeId, range.from, range.to]);
  const trend = useFetch(() => (storeId ? storeOperationsService.trend(storeId, { ...range, interval }) : none), [storeId, range.from, range.to, interval]);
  const breakdown = useFetch(() => (storeId ? storeOperationsService.breakdown(storeId, range) : none), [storeId, range.from, range.to]);
  const top = useFetch(() => (storeId ? storeOperationsService.sales(storeId, { ...range, groupBy: 'product', page: 1, limit: 5 }) : none), [storeId, range.from, range.to]);
  const recent = useFetch(() => (storeId ? storeOperationsService.sales(storeId, { ...range, groupBy: 'none', page: 1, limit: 5 }) : none), [storeId, range.from, range.to]);
  const stock = useFetch(() => (storeId ? storeOperationsService.stockHealth(storeId, { filter: 'all', limit: 5 }) : none), [storeId]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const points = useMemo(() => trend.data?.points ?? [], [trend.data]);
  const profitOk = trend.data?.canViewProfit ?? false;
  const chart = useMemo(() => {
    const label = (d: string) => (interval === 'month' ? formatReportDay(d, true).slice(3).replace(/ (\d\d)(\d\d)$/, ' $2') : formatReportDay(d, false));
    return {
      labels: points.map(p => label(p.date)),
      full: points.map(p => (interval === 'week' ? t('operations.weekOfDate', { date: formatReportDay(p.date) }) : interval === 'month' ? label(p.date) : formatReportDay(p.date))),
      bars: { key: 'sales', label: t('common.sales'), color: COLORS.sales, values: points.map(p => p.sales) },
      lines: [
        ...(view === 'all' && profitOk
          ? [
              { key: 'gross', label: t('common.grossProfit'), color: COLORS.gross, values: points.map(p => p.grossProfit) },
              { key: 'net', label: t('operations.netProfit'), color: COLORS.net, values: points.map(p => p.netProfit) },
            ]
          : []),
        ...(view === 'expenses' ? [{ key: 'expenses', label: t('common.expenses'), color: COLORS.expenses, values: points.map(p => p.expenses) }] : []),
      ],
    };
  }, [points, interval, view, profitOk, t]);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('common.businessOverview')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.businessOverview')} icon={ChartTrendIcon} allowed={false} />
      </View>
    );
  }

  const m = overview.data?.period;
  const p = overview.data?.previous;
  const canProfit = overview.data?.canViewProfit ?? false;
  const loading = overview.loading;
  const compare = COMPARE[range.key] ?? t('operations.vsPreviousPeriod');

  const categories = breakdown.data?.byCategory ?? [];
  const catTotal = categories.reduce((s, c) => s + c.sales, 0);
  const catRows = (
    categories.length > 6 ? [...categories.slice(0, 5), { categoryId: 'others', name: 'Others', sales: categories.slice(5).reduce((s, c) => s + c.sales, 0) }] : categories
  ).map((c, i) => ({ key: c.categoryId, name: c.name || 'Uncategorised', sales: c.sales, color: c.categoryId === 'others' ? '#cbd5e1' : CHART_COLORS[i % CHART_COLORS.length] }));

  const alerts = (stock.data?.items ?? []).filter(r => r.health !== 'healthy');
  const pending = overview.data?.alerts.pendingStockOrders ?? 0;
  const delayed = overview.data?.alerts.delayedStockOrders ?? 0;
  const reloadAll = () => [overview, trend, breakdown, top, recent, stock].forEach(f => f.reload(f === overview));

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('common.businessOverview')} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={overview.refreshing} onRefresh={reloadAll} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <PageTitle title={t('common.businessOverview')} subtitle={t('operations.salesProfitExpensesAndStockAlerts')} />
        {!store ? (
          <EmptyState icon={StoreIcon} title={t('common.youDonTHaveAStore')} text={t('operations.setUpYourStoreOnThe')} />
        ) : (
          <>
            <RangeChips
              today={today}
              value={range}
              keys={PRESET_KEYS}
              onChange={r => {
                setRange(r);
                setChosenInterval(null);
              }}
            />
            <Text style={opsStyles.muted}>{`${store.name} · ${rangeLabel(range)}`}</Text>
            {overview.error && !overview.data ? <ErrorState message={overview.error} onRetry={() => overview.reload()} /> : null}

            <StatGrid>
              <StatCard icon={CartIcon} tone="orange" label={t('common.totalSales')} value={money(m?.sales)} delta={change(m?.sales, p?.sales)} sub={compare} loading={loading} />
              <StatCard
                icon={ChartTrendIcon}
                tone="blue"
                label={t('common.grossProfit')}
                value={canProfit ? money(m?.grossProfit) : '—'}
                negative={(m?.grossProfit ?? 0) < 0}
                delta={canProfit ? change(m?.grossProfit, p?.grossProfit) : null}
                sub={canProfit ? compare : profitHidden()}
                loading={loading}
              />
              <StatCard icon={WalletIcon} tone="red" label={t('common.expenses')} value={money(m?.expenses)} delta={change(m?.expenses, p?.expenses)} invertDelta sub={compare} loading={loading} />
              <StatCard
                icon={BarChartIcon}
                tone="emerald"
                label={t('operations.netProfit')}
                value={canProfit ? money(m?.netProfit) : '—'}
                negative={(m?.netProfit ?? 0) < 0}
                delta={canProfit ? change(m?.netProfit, p?.netProfit) : null}
                sub={canProfit ? compare : profitHidden()}
                loading={loading}
              />
              <StatCard icon={BoxIcon} tone="violet" label={t('common.totalOrders')} value={count(m?.orders)} delta={change(m?.orders, p?.orders)} sub={compare} loading={loading} />
            </StatGrid>
            {canProfit && (m?.linesWithoutCost ?? 0) > 0 ? (
              <Text style={opsStyles.warn}>
                {t('operations.soldItemsWithoutCost', { count: m!.linesWithoutCost })}
              </Text>
            ) : null}

            <OpsCard title={t('operations.salesAndProfit')} description={t('operations.compareSalesGrossProfitAndNet')}>
              <View style={styles.controls}>
                <Choices
                  options={[
                    { value: 'day', label: t('common.daily') },
                    { value: 'week', label: t('common.weekly') },
                    { value: 'month', label: t('common.monthly') },
                  ]}
                  value={interval}
                  onChange={v => setChosenInterval(v as TrendInterval)}
                />
                <Choices
                  options={[
                    { value: 'all', label: t('operations.salesProfitAndExpenses') },
                    { value: 'expenses', label: t('operations.salesAndExpenses') },
                    { value: 'sales', label: t('operations.salesOnly') },
                  ]}
                  value={view}
                  onChange={v => setView(v as SeriesView)}
                />
              </View>
              {trend.error && !trend.data ? (
                <ErrorState message={trend.error} onRetry={() => trend.reload()} />
              ) : trend.loading ? (
                <Placeholder height={260} />
              ) : (
                <ComboChart labels={chart.labels} fullLabels={chart.full} bars={chart.bars} lines={chart.lines} />
              )}
            </OpsCard>

            <OpsCard title={t('operations.salesByCategory')}>
              {breakdown.loading ? (
                <Placeholder />
              ) : catRows.length === 0 ? (
                <NoData text={t('operations.noSalesInRange', { range: rangeLabel(range) })} />
              ) : (
                <View style={styles.ring}>
                  <Ring segments={catRows.map(c => ({ key: c.key, value: c.sales, color: c.color }))} centerValue={money(catTotal)} centerLabel={t('common.totalSales')} selected={selectedCat} />
                  <View style={styles.legend}>
                    {catRows.map(c => (
                      <Pressable
                        key={c.key}
                        accessibilityRole="button"
                        onPress={() => setSelectedCat(s => (s === c.key ? null : c.key))}
                        style={[styles.legendRow, selectedCat && selectedCat !== c.key && styles.faded]}
                      >
                        <View style={[styles.dot, { backgroundColor: c.color }]} />
                        <Text style={styles.legendName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={styles.legendPct}>{`${catTotal > 0 ? Math.round((c.sales / catTotal) * 100) : 0}%`}</Text>
                        <Text style={styles.legendValue}>{money(c.sales)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </OpsCard>

            <OpsCard title={t('operations.topSellingProducts')} description={t('operations.bestPerformingProductsBySalesValue')} action={<LinkButton label={t('operations.viewAll')} onPress={() => openMenuKey('sales-reports')} />}>
              {top.loading ? (
                <Placeholder height={120} />
              ) : !top.data?.items.length ? (
                <NoData text={t('operations.noProductsSoldInThisPeriod')} />
              ) : (
                (top.data.items as SalesGroupRow[]).map((r, i) => (
                  <View key={r.key} style={[opsStyles.row, i > 0 && opsStyles.listRow]}>
                    <Text style={styles.rank}>{i + 1}</Text>
                    <Thumb src={r.imageUrl ?? null} />
                    <View style={styles.flex}>
                      <Text style={opsStyles.title} numberOfLines={1}>
                        {r.label}
                      </Text>
                      <Text style={opsStyles.meta} numberOfLines={1}>{t('operations.unitsSoldSub', { units: count(r.units), sub: r.sub ?? '—' })}</Text>
                    </View>
                    <View style={styles.right}>
                      <Text style={opsStyles.amount}>{money(r.sales)}</Text>
                      {top.data!.canViewProfit ? <Text style={[styles.profit, (r.profit ?? 0) < 0 && opsStyles.danger]}>{money(r.profit)}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </OpsCard>

            <OpsCard title={t('operations.recentOrders')} description={t('operations.latestOrdersInThisPeriod')} action={<LinkButton label={t('operations.viewAll')} onPress={() => openMenuKey('orders')} />}>
              {recent.loading ? (
                <Placeholder height={120} />
              ) : !recent.data?.items.length ? (
                <NoData text={t('operations.noOrdersInThisPeriod')} />
              ) : (
                (recent.data.items as SalesOrderRow[]).map((o, i) => {
                  const s = saleStatus(o.orderStatus);
                  return (
                    <Pressable
                      key={o.id}
                      accessibilityRole="button"
                      disabled={!hasPermission('orders:manage')}
                      onPress={() => navigation.navigate('OrderDetail', { id: o.id })}
                      style={[opsStyles.rowBetween, i > 0 && opsStyles.listRow]}
                    >
                      <View style={styles.flex}>
                        <Text style={opsStyles.title} numberOfLines={1}>
                          {o.orderNumber}
                        </Text>
                        <Text style={opsStyles.meta} numberOfLines={1}>
                          {o.customerName ?? t('common.walkInCustomer')}
                        </Text>
                      </View>
                      <View style={styles.right}>
                        <Text style={opsStyles.amount}>{money(o.amount)}</Text>
                        <Badge label={s.label} tone={s.tone} />
                      </View>
                    </Pressable>
                  );
                })
              )}
            </OpsCard>

            <OpsCard title={t('operations.stockAlerts')} description={t('operations.productsNeedAttention')} action={<LinkButton label={t('operations.viewAll')} onPress={() => openMenuKey('stock-health')} />}>
              {stock.loading ? (
                <Placeholder height={120} />
              ) : alerts.length === 0 ? (
                <NoData text={t('operations.allProductsAreAboveTheirMinimum')} />
              ) : (
                alerts.map((r, i) => (
                  <View key={r.variantId} style={[opsStyles.row, i > 0 && opsStyles.listRow]}>
                    <Thumb src={r.imageUrl} />
                    <View style={styles.flex}>
                      <Text style={opsStyles.title} numberOfLines={1}>
                        {r.productName}
                      </Text>
                      <Text style={opsStyles.meta} numberOfLines={1}>
                        {r.sku}
                      </Text>
                    </View>
                    <Badge label={r.health === 'out' ? t('common.outOfStock2') : t('common.lowStock2')} tone={r.health === 'out' ? 'red' : 'amber'} />
                    <Text style={styles.qty}>{`${count(Math.max(0, r.available))} ${r.uom.toUpperCase()}`}</Text>
                  </View>
                ))
              )}
              {pending > 0 || delayed > 0 ? (
                <View style={styles.pills}>
                  {pending > 0 ? (
                    <Pressable accessibilityRole="button" onPress={() => openMenuKey('pending-stock')} style={[styles.pill, styles.pillSky]}>
                      <TruckIcon size={14} color="#0369a1" />
                      <Text style={[styles.pillText, styles.pillTextSky]}>{t('operations.pendingStockOrders', { count: pending })}</Text>
                    </Pressable>
                  ) : null}
                  {delayed > 0 ? (
                    <Pressable accessibilityRole="button" onPress={() => openMenuKey('pending-stock')} style={[styles.pill, styles.pillOrange]}>
                      <ClockIcon size={14} color="#c2410c" />
                      <Text style={[styles.pillText, styles.pillTextOrange]}>{t('operations.delayedDelayed', { delayed })}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </OpsCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <View style={styles.thumb}>
      {src ? <Image source={{ uri: src }} style={styles.thumbImg} resizeMode="contain" /> : <BoxIcon size={16} color={colors.textMuted} />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  controls: { gap: 8, marginBottom: 10 },
  ring: { alignItems: 'center', gap: 12 },
  legend: { alignSelf: 'stretch' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  faded: { opacity: 0.5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.text },
  legendPct: { width: 40, textAlign: 'right', fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  legendValue: { minWidth: 70, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  rank: { width: 16, fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  thumb: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  thumbImg: { width: '100%', height: '100%' },
  right: { alignItems: 'flex-end', gap: 3 },
  profit: { fontFamily: fonts.medium, fontSize: 12, color: colors.successDark },
  qty: { minWidth: 52, textAlign: 'right', fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  pillSky: { backgroundColor: '#f0f9ff' },
  pillOrange: { backgroundColor: '#fff7ed' },
  pillText: { fontFamily: fonts.semibold, fontSize: 12 },
  pillTextSky: { color: '#0369a1' },
  pillTextOrange: { color: '#c2410c' },
});
