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
import { LinkButton, NoData, OpsCard, opsStyles, PageTitle, Placeholder, PROFIT_HIDDEN, RangeChips, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { BarChartIcon, BoxIcon, CartIcon, ChartTrendIcon, ClockIcon, StoreIcon, TruckIcon, WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PRESET_KEYS = ['today', 'yesterday', 'week', 'month', '3m'];
const COMPARE: Record<string, string> = {
  today: 'vs yesterday',
  yesterday: 'vs day before',
  week: 'vs last week',
  month: 'vs last month',
  '3m': 'vs previous 3 months',
};
const COLORS = { sales: '#3b82f6', gross: '#16a34a', net: '#f97316', expenses: CHART_COLORS[7] };
type SeriesView = 'all' | 'expenses' | 'sales';

/** Operations › Business Overview: sales, profit, expenses and stock alerts at a glance. */
export function BusinessOverviewScreen({ navigation }: ScreenProps<'BusinessOverview'>) {
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
      full: points.map(p => (interval === 'week' ? `Week of ${formatReportDay(p.date)}` : interval === 'month' ? label(p.date) : formatReportDay(p.date))),
      bars: { key: 'sales', label: 'Sales', color: COLORS.sales, values: points.map(p => p.sales) },
      lines: [
        ...(view === 'all' && profitOk
          ? [
              { key: 'gross', label: 'Gross Profit', color: COLORS.gross, values: points.map(p => p.grossProfit) },
              { key: 'net', label: 'Net Profit', color: COLORS.net, values: points.map(p => p.netProfit) },
            ]
          : []),
        ...(view === 'expenses' ? [{ key: 'expenses', label: 'Expenses', color: COLORS.expenses, values: points.map(p => p.expenses) }] : []),
      ],
    };
  }, [points, interval, view, profitOk]);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Business Overview" onBack={navigation.goBack} />
        <ComingSoon label="Business Overview" icon={ChartTrendIcon} allowed={false} />
      </View>
    );
  }

  const m = overview.data?.period;
  const p = overview.data?.previous;
  const canProfit = overview.data?.canViewProfit ?? false;
  const loading = overview.loading;
  const compare = COMPARE[range.key] ?? 'vs previous period';

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
      <AppHeader title="Business Overview" onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={overview.refreshing} onRefresh={reloadAll} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <PageTitle title="Business Overview" subtitle="Sales, profit, expenses and stock alerts at a glance." />
        {!store ? (
          <EmptyState icon={StoreIcon} title="You don't have a store yet" text="Set up your store on the Seller Panel to see its business here." />
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
              <StatCard icon={CartIcon} tone="orange" label="Total Sales" value={money(m?.sales)} delta={change(m?.sales, p?.sales)} sub={compare} loading={loading} />
              <StatCard
                icon={ChartTrendIcon}
                tone="blue"
                label="Gross Profit"
                value={canProfit ? money(m?.grossProfit) : '—'}
                negative={(m?.grossProfit ?? 0) < 0}
                delta={canProfit ? change(m?.grossProfit, p?.grossProfit) : null}
                sub={canProfit ? compare : PROFIT_HIDDEN}
                loading={loading}
              />
              <StatCard icon={WalletIcon} tone="red" label="Expenses" value={money(m?.expenses)} delta={change(m?.expenses, p?.expenses)} invertDelta sub={compare} loading={loading} />
              <StatCard
                icon={BarChartIcon}
                tone="emerald"
                label="Net Profit"
                value={canProfit ? money(m?.netProfit) : '—'}
                negative={(m?.netProfit ?? 0) < 0}
                delta={canProfit ? change(m?.netProfit, p?.netProfit) : null}
                sub={canProfit ? compare : PROFIT_HIDDEN}
                loading={loading}
              />
              <StatCard icon={BoxIcon} tone="violet" label="Total Orders" value={count(m?.orders)} delta={change(m?.orders, p?.orders)} sub={compare} loading={loading} />
            </StatGrid>
            {canProfit && (m?.linesWithoutCost ?? 0) > 0 ? (
              <Text style={opsStyles.warn}>
                {`${m!.linesWithoutCost} sold item${m!.linesWithoutCost === 1 ? ' has' : 's have'} no cost price, so profit is overstated. Add cost prices to the product variants.`}
              </Text>
            ) : null}

            <OpsCard title="Sales & Profit" description="Compare sales, gross profit and net profit over time.">
              <View style={styles.controls}>
                <Choices
                  options={[
                    { value: 'day', label: 'Daily' },
                    { value: 'week', label: 'Weekly' },
                    { value: 'month', label: 'Monthly' },
                  ]}
                  value={interval}
                  onChange={v => setChosenInterval(v as TrendInterval)}
                />
                <Choices
                  options={[
                    { value: 'all', label: 'Sales, Profit & Expenses' },
                    { value: 'expenses', label: 'Sales & Expenses' },
                    { value: 'sales', label: 'Sales only' },
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

            <OpsCard title="Sales by Category">
              {breakdown.loading ? (
                <Placeholder />
              ) : catRows.length === 0 ? (
                <NoData text={`No sales in ${rangeLabel(range)}.`} />
              ) : (
                <View style={styles.ring}>
                  <Ring segments={catRows.map(c => ({ key: c.key, value: c.sales, color: c.color }))} centerValue={money(catTotal)} centerLabel="Total Sales" selected={selectedCat} />
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

            <OpsCard title="Top Selling Products" description="Best performing products by sales value." action={<LinkButton label="View All →" onPress={() => openMenuKey('sales-reports')} />}>
              {top.loading ? (
                <Placeholder height={120} />
              ) : !top.data?.items.length ? (
                <NoData text="No products sold in this period." />
              ) : (
                (top.data.items as SalesGroupRow[]).map((r, i) => (
                  <View key={r.key} style={[opsStyles.row, i > 0 && opsStyles.listRow]}>
                    <Text style={styles.rank}>{i + 1}</Text>
                    <Thumb src={r.imageUrl ?? null} />
                    <View style={styles.flex}>
                      <Text style={opsStyles.title} numberOfLines={1}>
                        {r.label}
                      </Text>
                      <Text style={opsStyles.meta} numberOfLines={1}>{`${count(r.units)} sold · ${r.sub ?? '—'}`}</Text>
                    </View>
                    <View style={styles.right}>
                      <Text style={opsStyles.amount}>{money(r.sales)}</Text>
                      {top.data!.canViewProfit ? <Text style={[styles.profit, (r.profit ?? 0) < 0 && opsStyles.danger]}>{money(r.profit)}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </OpsCard>

            <OpsCard title="Recent Orders" description="Latest orders in this period." action={<LinkButton label="View All →" onPress={() => openMenuKey('orders')} />}>
              {recent.loading ? (
                <Placeholder height={120} />
              ) : !recent.data?.items.length ? (
                <NoData text="No orders in this period." />
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
                          {o.customerName ?? 'Walk-in customer'}
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

            <OpsCard title="Stock Alerts" description="Products need attention." action={<LinkButton label="View All →" onPress={() => openMenuKey('stock-health')} />}>
              {stock.loading ? (
                <Placeholder height={120} />
              ) : alerts.length === 0 ? (
                <NoData text="All products are above their minimum stock." />
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
                    <Badge label={r.health === 'out' ? 'Out of stock' : 'Low stock'} tone={r.health === 'out' ? 'red' : 'amber'} />
                    <Text style={styles.qty}>{`${count(Math.max(0, r.available))} ${r.uom.toUpperCase()}`}</Text>
                  </View>
                ))
              )}
              {pending > 0 || delayed > 0 ? (
                <View style={styles.pills}>
                  {pending > 0 ? (
                    <Pressable accessibilityRole="button" onPress={() => openMenuKey('pending-stock')} style={[styles.pill, styles.pillSky]}>
                      <TruckIcon size={14} color="#0369a1" />
                      <Text style={[styles.pillText, styles.pillTextSky]}>{`${pending} pending stock order${pending === 1 ? '' : 's'}`}</Text>
                    </Pressable>
                  ) : null}
                  {delayed > 0 ? (
                    <Pressable accessibilityRole="button" onPress={() => openMenuKey('pending-stock')} style={[styles.pill, styles.pillOrange]}>
                      <ClockIcon size={14} color="#c2410c" />
                      <Text style={[styles.pillText, styles.pillTextOrange]}>{`${delayed} delayed`}</Text>
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
