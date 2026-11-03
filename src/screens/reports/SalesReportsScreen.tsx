import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { STORE_PENDING, useStore } from '../../context/StoreContext';
import { useFetch } from '../../hooks/useFetch';
import { formatNumber, formatRupees } from '../../lib/format';
import { formatWhen } from '../../lib/date';
import {
  autoInterval,
  bucketLabels,
  change,
  CHART_COLORS,
  DEFAULT_PRESET,
  groupLabel,
  paymentLabel,
  RANGE_PRESETS,
  saleStatus,
  SALES_TABS,
  type RangePreset,
} from '../../lib/sales-report';
import {
  storeOperationsService,
  type OpsMetrics,
  type SalesGroup,
  type SalesGroupRow,
  type SalesOrderRow,
  type TrendInterval,
} from '../../services/store-operations-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { Ring, SalesProfitChart } from '../../components/reports/SalesCharts';
import {
  BarChartIcon,
  BoxIcon,
  CartIcon,
  CheckIcon,
  ChevronRightIcon,
  FilterIcon,
  LayersIcon,
  PercentIcon,
  ShoppingBagIcon,
  StoreIcon,
  TagIcon,
  WalletIcon,
  type IconProps,
} from '../../components/icons';
import type { TabScreenProps } from '../../navigation/types';

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const CATEGORY_ICONS = [TagIcon, ShoppingBagIcon, BoxIcon, LayersIcon, CartIcon];
const INTERVALS: { value: TrendInterval; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

const KPI_TONES = {
  orange: ['#fff7ed', '#f97316'],
  blue: ['#eff6ff', '#3b82f6'],
  green: ['#ecfdf5', '#059669'],
  amber: ['#fffbeb', '#f59e0b'],
  rose: ['#fff1f2', '#f43f5e'],
  violet: ['#f5f3ff', '#8b5cf6'],
} as const;

const aov = (m?: OpsMetrics) => (m ? (m.orders > 0 ? Math.round(m.sales / m.orders) : 0) : null);
const money = (n: number | null | undefined) => (n == null ? '—' : formatRupees(Math.round(n)));
const profitColor = (n: number | null | undefined) => ((n ?? 0) < 0 ? colors.error : colors.success);

/** Reports tab: the Seller Panel's Sales Reports for one store and a date range. */
export function SalesReportsScreen({ navigation }: TabScreenProps<'Reports'>) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('store-operations:manage');
  const canOpenOrders = hasPermission('orders:manage');

  // Reports are for one store: the one picked in the header.
  const { current: store, storeKey } = useStore();
  const storeId = store?.id ?? '';
  const storesLoading = storeKey === STORE_PENDING;

  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const range = useMemo(() => preset.range(new Date()), [preset]);
  const [chosenInterval, setChosenInterval] = useState<TrendInterval | null>(null);
  const interval = chosenInterval ?? autoInterval(range);

  const overview = useFetch(
    () => (storeId ? storeOperationsService.overview(storeId, range) : Promise.resolve(null)),
    [storeId, range.from, range.to],
  );
  const trend = useFetch(
    () => (storeId ? storeOperationsService.trend(storeId, { ...range, interval }) : Promise.resolve(null)),
    [storeId, range.from, range.to, interval],
  );
  const breakdown = useFetch(
    () => (storeId ? storeOperationsService.breakdown(storeId, range) : Promise.resolve(null)),
    [storeId, range.from, range.to],
  );

  // The sales list under the charts.
  const [group, setGroup] = useState<SalesGroup>('none');
  const [method, setMethod] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  // Any change to what's listed starts again from the first page.
  useEffect(() => setPage(1), [storeId, range.from, range.to, group, method, search]);

  const table = useFetch(
    () =>
      storeId
        ? storeOperationsService.sales(storeId, {
            ...range,
            groupBy: group,
            page,
            limit: PAGE_SIZE,
            ...(method ? { paymentMethod: method } : {}),
            ...(search ? { search } : {}),
          })
        : Promise.resolve(null),
    [storeId, range.from, range.to, group, method, search, page],
  );

  const { reload: reloadOverview } = overview;
  const { reload: reloadTrend } = trend;
  const { reload: reloadBreakdown } = breakdown;
  const { reload: reloadTable } = table;
  const reloadAll = useCallback(
    (asRefresh = false) => {
      reloadOverview(asRefresh);
      reloadTrend();
      reloadBreakdown();
      reloadTable();
    },
    [reloadOverview, reloadTrend, reloadBreakdown, reloadTable],
  );

  // New sales come in while away.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current && storeId) reloadAll();
      focused.current = true;
    }, [storeId, reloadAll]),
  );

  const scrollRef = useRef<ScrollViewInstance>(null);
  const tableY = useRef(0);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Sales Reports" />
        <ComingSoon label="Sales Reports" icon={BarChartIcon} allowed={false} />
      </View>
    );
  }

  const cur = overview.data?.period;
  const prev = overview.data?.previous;
  const canProfit = overview.data?.canViewProfit ?? false;
  const compare = preset.compareLabel;
  const loadingKpi = overview.loading;

  const points = trend.data?.points ?? [];
  const chart = bucketLabels(points.map(p => p.date), interval);

  const methods = breakdown.data?.byPaymentMethod ?? [];
  const methodTotal = methods.reduce((s, m) => s + m.sales, 0);
  const methodSegments = methods.map((m, i) => ({ key: m.method, value: m.sales, color: CHART_COLORS[i % CHART_COLORS.length] }));

  const categories = breakdown.data?.byCategory ?? [];
  const catTotal = categories.reduce((s, c) => s + c.sales, 0);
  const topCats =
    categories.length > 5
      ? [
          ...categories.slice(0, 4),
          { categoryId: 'others', name: 'Others', orders: 0, units: 0, sales: categories.slice(4).reduce((s, c) => s + c.sales, 0), profit: null },
        ]
      : categories;

  const showGroup = (next: SalesGroup) => {
    setGroup(next);
    scrollRef.current?.scrollTo({ y: Math.max(0, tableY.current - 8), animated: true });
  };

  const goToPage = (next: number) => {
    setPage(next);
    scrollRef.current?.scrollTo({ y: Math.max(0, tableY.current - 8), animated: true });
  };

  const tableData = table.data;
  const pages = tableData ? Math.max(1, Math.ceil(tableData.total / PAGE_SIZE)) : 1;

  return (
    <View style={styles.screen}>
      <AppHeader brand />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={overview.refreshing} onRefresh={() => reloadAll(true)} tintColor={colors.secondary} colors={[colors.secondary]} />
        }
      >
        <View>
          <Text style={styles.pageTitle} accessibilityRole="header">
            Sales Reports
          </Text>
          <Text style={styles.pageSubtitle}>Track your store sales performance, revenue, profit and orders over time.</Text>
        </View>

        {storesLoading ? (
          <ListSkeleton rows={3} height={120} />
        ) : !store ? (
          <EmptyState
            icon={StoreIcon}
            title="No store to report on"
            text="Set up your store on the Seller Panel, or ask the store owner to give your role access to its stores."
          />
        ) : (
          <>
            <View style={styles.storeLine}>
              <StoreIcon size={14} color={colors.textSecondary} />
              <Text style={styles.storeLineText}>{store.name}</Text>
            </View>

            <FilterChips
              options={RANGE_PRESETS.map(p => ({ value: p.key, label: p.label }))}
              value={preset.key}
              onChange={key => {
                setPreset(RANGE_PRESETS.find(p => p.key === key) ?? DEFAULT_PRESET);
                setChosenInterval(null);
              }}
            />

            {overview.error && !overview.data ? <ErrorState message={overview.error} onRetry={() => overview.reload()} /> : null}

            <View style={styles.kpis}>
              <Kpi icon={CartIcon} tone="orange" label="Total Sales" value={money(cur?.sales)} delta={change(cur?.sales, prev?.sales)} compare={compare} loading={loadingKpi} />
              <Kpi
                icon={ShoppingBagIcon}
                tone="blue"
                label="Total Orders"
                value={cur ? formatNumber(cur.orders) : '—'}
                delta={change(cur?.orders, prev?.orders)}
                compare={compare}
                loading={loadingKpi}
              />
              <Kpi icon={WalletIcon} tone="green" label="Average Order Value" value={money(aov(cur))} delta={change(aov(cur), aov(prev))} compare={compare} loading={loadingKpi} />
              {canProfit || loadingKpi ? (
                <Kpi
                  icon={TagIcon}
                  tone="amber"
                  label="Gross Profit"
                  value={money(cur?.grossProfit)}
                  negative={(cur?.grossProfit ?? 0) < 0}
                  delta={change(cur?.grossProfit, prev?.grossProfit)}
                  compare={compare}
                  loading={loadingKpi}
                />
              ) : null}
              <Kpi icon={BoxIcon} tone="rose" label="Expenses" value={money(cur?.expenses)} delta={change(cur?.expenses, prev?.expenses)} invert compare={compare} loading={loadingKpi} />
              {canProfit || loadingKpi ? (
                <Kpi
                  icon={PercentIcon}
                  tone="violet"
                  label="Profit Margin"
                  value={cur?.grossMargin == null ? '—' : `${cur.grossMargin.toFixed(1)}%`}
                  negative={(cur?.grossMargin ?? 0) < 0}
                  delta={cur?.grossMargin != null && prev?.grossMargin != null ? cur.grossMargin - prev.grossMargin : null}
                  compare={compare}
                  loading={loadingKpi}
                />
              ) : null}
            </View>

            <Panel
              title="Sales & Profit Trend"
              action={
                <View style={styles.segment}>
                  {INTERVALS.map(option => {
                    const on = option.value === interval;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => setChosenInterval(option.value)}
                        style={[styles.segmentItem, on && styles.segmentItemOn]}
                      >
                        <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              }
            >
              {trend.error && !trend.data ? (
                <ErrorState message={trend.error} onRetry={() => trend.reload()} />
              ) : trend.loading ? (
                <View style={[styles.placeholder, styles.placeholderTall]} />
              ) : (
                <SalesProfitChart
                  labels={chart.labels}
                  fullLabels={chart.full}
                  sales={points.map(p => p.sales)}
                  profit={trend.data?.canViewProfit ? points.map(p => p.grossProfit) : null}
                  orders={points.map(p => p.orders)}
                />
              )}
            </Panel>

            <Panel title="Sales by Payment Method">
              {breakdown.error && !breakdown.data ? (
                <ErrorState message={breakdown.error} onRetry={() => breakdown.reload()} />
              ) : breakdown.loading ? (
                <View style={styles.placeholder} />
              ) : methods.length === 0 ? (
                <Text style={styles.noData}>No sales in this period</Text>
              ) : (
                <View style={styles.ringBlock}>
                  <Ring segments={methodSegments} centerValue={money(methodTotal)} centerLabel="Total Sales" selected={selectedMethod} />
                  <View style={styles.methodList}>
                    {methods.map((m, i) => {
                      const on = selectedMethod === m.method;
                      return (
                        <Pressable
                          key={m.method}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => setSelectedMethod(on ? null : m.method)}
                          style={[styles.methodRow, on && styles.methodRowOn]}
                        >
                          <View style={[styles.dot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
                          <Text style={styles.methodName} numberOfLines={1}>
                            {paymentLabel(m.method)}
                          </Text>
                          <Text style={styles.methodShare}>{methodTotal > 0 ? ((m.sales / methodTotal) * 100).toFixed(1) : '0.0'}%</Text>
                          <Text style={styles.methodValue}>{money(m.sales)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </Panel>

            <Panel
              title="Top Product Categories"
              action={
                categories.length ? (
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => showGroup('category')}>
                    <Text style={styles.link}>View All</Text>
                  </Pressable>
                ) : null
              }
            >
              {breakdown.loading ? (
                <View style={styles.placeholder} />
              ) : topCats.length === 0 ? (
                <Text style={styles.noData}>No sales in this period</Text>
              ) : (
                <View style={styles.cats}>
                  {topCats.map((c, i) => {
                    const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length];
                    const share = catTotal > 0 ? (c.sales / catTotal) * 100 : 0;
                    const color = CHART_COLORS[i % CHART_COLORS.length];
                    return (
                      <View key={c.categoryId} style={styles.cat}>
                        <View style={styles.catIcon}>
                          <Icon size={18} color={color} />
                        </View>
                        <View style={styles.flex}>
                          <View style={styles.catTop}>
                            <Text style={styles.catName} numberOfLines={1}>
                              {c.name}
                            </Text>
                            <Text style={styles.catValue}>{money(c.sales)}</Text>
                          </View>
                          <ShareBar share={share} color={color} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Panel>

            <View
              style={styles.salesCard}
              onLayout={e => {
                tableY.current = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.salesHead}>
                <FilterChips options={SALES_TABS} value={group} onChange={value => setGroup(value as SalesGroup)} />
                <View style={styles.searchRow}>
                  <View style={styles.flex}>
                    <SearchBar value={query} onChange={setQuery} placeholder="Search by order ID, customer, product…" />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={method ? 'Filters, 1 applied' : 'Filters'}
                    onPress={() => setFiltersOpen(true)}
                    style={[styles.filterBtn, method ? styles.filterBtnOn : null]}
                  >
                    <FilterIcon size={18} color={method ? colors.secondaryDark : colors.text} />
                    {method ? <View style={styles.filterDot} /> : null}
                  </Pressable>
                </View>
              </View>

              {table.error && !tableData ? (
                <ErrorState message={table.error} onRetry={() => table.reload()} />
              ) : table.loading ? (
                <View style={styles.salesBody}>
                  <ListSkeleton rows={4} height={64} />
                </View>
              ) : !tableData?.items.length ? (
                <Text style={styles.noData}>{search || method ? 'No sales match your search or filters.' : 'No sales in this period.'}</Text>
              ) : tableData.groupBy === 'none' ? (
                tableData.items.map(o => (
                  <SaleRow
                    key={o.id}
                    order={o}
                    canProfit={tableData.canViewProfit}
                    onPress={canOpenOrders ? () => navigation.navigate('OrderDetail', { id: o.id }) : undefined}
                  />
                ))
              ) : (
                <GroupRows group={tableData.groupBy} rows={tableData.items} canProfit={tableData.canViewProfit} />
              )}

              {tableData && tableData.total > 0 ? (
                <View style={styles.pager}>
                  <Text style={styles.pagerText}>
                    {`Showing ${formatNumber((page - 1) * PAGE_SIZE + 1)}–${formatNumber(Math.min(page * PAGE_SIZE, tableData.total))} of ${formatNumber(tableData.total)} ${group === 'none' ? 'orders' : 'rows'}`}
                  </Text>
                  <PageButton label="Previous page" disabled={page <= 1} onPress={() => goToPage(page - 1)} flip />
                  <Text style={styles.pagerCount}>{`${page} / ${pages}`}</Text>
                  <PageButton label="Next page" disabled={page >= pages} onPress={() => goToPage(page + 1)} />
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <Sheet visible={filtersOpen} title="Filters" subtitle="Payment mode" onClose={() => setFiltersOpen(false)}>
        <View style={styles.options}>
          {[{ value: '', label: 'All payment modes' }, ...methods.map(m => ({ value: m.method, label: paymentLabel(m.method) }))].map(option => {
            const on = option.value === method;
            return (
              <Pressable
                key={option.value || 'all'}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setMethod(option.value);
                  setFiltersOpen(false);
                }}
                style={[styles.option, on && styles.optionOn]}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{option.label}</Text>
                {on ? <CheckIcon size={18} color={colors.secondary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  delta,
  compare,
  invert,
  negative,
  loading,
}: {
  icon: ComponentType<IconProps>;
  tone: keyof typeof KPI_TONES;
  label: string;
  value: string;
  delta: number | null;
  compare: string;
  invert?: boolean;
  negative?: boolean;
  loading: boolean;
}) {
  // Expenses going down is the good direction.
  const good = delta !== null && (invert ? delta <= 0 : delta >= 0);
  const [bg, fg] = KPI_TONES[tone];
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${label}: ${loading ? 'loading' : value}`}>
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Icon size={20} color={fg} />
      </View>
      <Text style={styles.kpiLabel} numberOfLines={1}>
        {label}
      </Text>
      {loading ? (
        <View style={styles.kpiSkeleton} />
      ) : (
        <Text style={[styles.kpiValue, negative && styles.negative]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
      )}
      {loading ? null : (
        <Text style={styles.kpiCompare} numberOfLines={2}>
          {delta === null ? (
            <Text style={styles.kpiNew}>New </Text>
          ) : (
            <Text style={[styles.kpiDelta, { color: good ? colors.success : colors.error }]}>
              {`${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}% `}
            </Text>
          )}
          {compare}
        </Text>
      )}
    </View>
  );
}

function ShareBar({ share, color = colors.secondary }: { share: number; color?: string }) {
  return (
    <View style={styles.shareRow}>
      <View style={styles.shareTrack}>
        <View style={[styles.shareFill, { width: `${Math.max(2, Math.min(100, share))}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.sharePct}>{share.toFixed(1)}%</Text>
    </View>
  );
}

function SaleRow({ order, canProfit, onPress }: { order: SalesOrderRow; canProfit: boolean; onPress?: () => void }) {
  const status = saleStatus(order.orderStatus);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Order ${order.orderNumber}, ${formatRupees(order.amount)}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowTop}>
        <View style={styles.flex}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {order.orderNumber}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {`${formatWhen(order.orderedAt)} · ${order.items} item${order.items === 1 ? '' : 's'}`}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.rowAmount}>{money(order.amount)}</Text>
          {canProfit ? <Text style={[styles.rowProfit, { color: profitColor(order.profit) }]}>{`${money(order.profit)} profit`}</Text> : null}
        </View>
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {`${order.customerName || 'Walk-in customer'} · ${paymentLabel(order.paymentMethod)}`}
        </Text>
        <Badge label={status.label} tone={status.tone} />
      </View>
    </Pressable>
  );
}

function GroupRows({ group, rows, canProfit }: { group: Exclude<SalesGroup, 'none'>; rows: SalesGroupRow[]; canProfit: boolean }) {
  const total = rows.reduce((s, r) => s + r.sales, 0);
  return (
    <>
      {rows.map(r => {
        const share = total > 0 ? (r.sales / total) * 100 : 0;
        const margin = canProfit && r.sales > 0 && r.profit !== null ? `${((r.profit / r.sales) * 100).toFixed(1)}%` : null;
        return (
          <View key={r.key} style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {groupLabel(group, r.label)}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {`${formatNumber(r.orders)} order${r.orders === 1 ? '' : 's'} · ${formatNumber(r.units)} unit${r.units === 1 ? '' : 's'}`}
                  {r.sub ? ` · ${r.sub}` : ''}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowAmount}>{money(r.sales)}</Text>
                {canProfit ? (
                  <Text style={[styles.rowProfit, { color: profitColor(r.profit) }]}>
                    {`${money(r.profit)}${margin ? ` · ${margin}` : ''}`}
                  </Text>
                ) : null}
              </View>
            </View>
            <ShareBar share={share} />
          </View>
        );
      })}
    </>
  );
}

function PageButton({ label, disabled, onPress, flip }: { label: string; disabled: boolean; onPress: () => void; flip?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pageBtn, disabled && styles.pageBtnDisabled, pressed && styles.pageBtnPressed]}
    >
      <View style={flip ? styles.flip : undefined}>
        <ChevronRightIcon size={18} color={colors.text} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flip: { transform: [{ rotate: '180deg' }] },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  pageTitle: { fontSize: 24, fontFamily: fonts.extrabold, color: colors.text, letterSpacing: -0.4 },
  pageSubtitle: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textSecondary },
  storeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 },
  storeLineText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  kpiValue: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, letterSpacing: -0.3 },
  kpiSkeleton: { marginTop: 6, height: 24, width: 90, borderRadius: 6, backgroundColor: colors.background },
  negative: { color: colors.error },
  kpiCompare: { marginTop: 4, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.textSecondary },
  kpiDelta: { fontFamily: fonts.semibold },
  kpiNew: { fontFamily: fonts.medium, color: colors.textMuted },
  panel: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  panelTitle: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  placeholder: { height: 180, borderRadius: radius.md, backgroundColor: colors.background },
  placeholderTall: { height: 250 },
  noData: { paddingVertical: 40, textAlign: 'center', fontFamily: fonts.regular, fontSize: 13.5, color: colors.textMuted },
  segment: { flexDirection: 'row', padding: 2, borderRadius: 9, backgroundColor: colors.background },
  segmentItem: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  segmentItemOn: { backgroundColor: colors.surface, ...shadow.card },
  segmentText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  segmentTextOn: { color: colors.text },
  ringBlock: { alignItems: 'center', gap: 14 },
  methodList: { alignSelf: 'stretch', gap: 2 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8 },
  methodRowOn: { backgroundColor: colors.background },
  dot: { width: 10, height: 10, borderRadius: 5 },
  methodName: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.text },
  methodShare: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  methodValue: { minWidth: 76, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.info },
  cats: { gap: 14 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  catName: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.text },
  catValue: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  shareTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#f1f5f9', overflow: 'hidden' },
  shareFill: { height: 6, borderRadius: 3 },
  sharePct: { width: 42, textAlign: 'right', fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  salesCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.card,
  },
  salesHead: { gap: 10, padding: 14 },
  salesBody: { paddingHorizontal: 14, paddingBottom: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterBtnOn: { borderColor: colors.secondarySoft, backgroundColor: colors.secondaryLight },
  filterDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  row: { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { backgroundColor: '#fffaf5' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  rowMeta: { flexShrink: 1, marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  rowProfit: { marginTop: 2, fontFamily: fonts.medium, fontSize: 12 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pagerText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  pagerCount: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnPressed: { backgroundColor: colors.background },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  optionText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
  optionTextOn: { fontFamily: fonts.semibold },
});
