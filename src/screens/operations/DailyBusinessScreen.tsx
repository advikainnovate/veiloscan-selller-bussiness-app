import React, { useState, type ComponentType } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useFetch } from '../../hooks/useFetch';
import { count, day, money, shiftDay, time, todayDay } from '../../lib/operations';
import { storeOperationsService, type TimelineEvent } from '../../services/store-operations-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { DateField } from '../../components/form/Fields';
import { EmptyState, ErrorState } from '../../components/list/ListParts';
import { NoData, OpsCard, opsStyles, PageTitle, Placeholder, PROFIT_HIDDEN, StatCard, StatGrid } from '../../components/operations/OpsParts';
import {
  BarChartIcon,
  BoxIcon,
  CalendarIcon,
  CartIcon,
  ChartTrendIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  ShoppingBagIcon,
  SlidersIcon,
  StoreIcon,
  TruckIcon,
  WalletIcon,
  type IconProps,
} from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const EVENT: Record<TimelineEvent['type'], { label: string; icon: ComponentType<IconProps>; tone: [string, string] }> = {
  ORDER: { label: 'Order', icon: ShoppingBagIcon, tone: ['#fff7ed', '#ea580c'] },
  EXPENSE: { label: 'Expense', icon: WalletIcon, tone: ['#fef2f2', '#dc2626'] },
  STOCK_RECEIVED: { label: 'Stock Received', icon: TruckIcon, tone: ['#ecfdf5', '#059669'] },
  STOCK_ADJUSTED: { label: 'Stock Adjusted', icon: SlidersIcon, tone: ['#f1f5f9', '#475569'] },
  NOTE: { label: 'Note Added', icon: ClipboardListIcon, tone: ['#f5f3ff', '#7c3aed'] },
  CREDIT_PAYMENT: { label: 'Credit Collected', icon: CreditCardIcon, tone: ['#f0f9ff', '#0284c7'] },
};

/** Operations › Daily Business: everything that happened in the store on a day. */
export function DailyBusinessScreen({ navigation }: ScreenProps<'DailyBusiness'>) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('store-operations:manage');
  const { current: store } = useStore();
  const storeId = allowed ? store?.id ?? '' : '';
  const today = todayDay();
  const [date, setDate] = useState(today);
  const { data, error, loading, refreshing, reload } = useFetch(() => (storeId ? storeOperationsService.daily(storeId, date) : Promise.resolve(null)), [storeId, date]);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Daily Business" onBack={navigation.goBack} />
        <ComingSoon label="Daily Business" icon={CalendarIcon} allowed={false} />
      </View>
    );
  }

  const m = data?.metrics;
  const canProfit = data?.canViewProfit ?? false;
  const margin = (v: number | null | undefined) => (canProfit ? (v != null ? `${v}% margin` : undefined) : PROFIT_HIDDEN);

  // Where an activity opens: orders and credits have their own pages.
  function open(e: TimelineEvent) {
    if (e.type === 'ORDER' && hasPermission('orders:manage')) navigation.navigate('OrderDetail', { id: e.id });
    else if (e.type === 'CREDIT_PAYMENT' && hasPermission('customer-credit:manage')) navigation.navigate('CreditDetail', { id: e.id });
    else if (e.type === 'EXPENSE' && hasPermission('store-expenses:view')) navigation.navigate('ExpenseDetail', { id: e.id });
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Daily Business" onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <PageTitle title="Daily Business" subtitle={`Everything that happened in the store on ${day(date)}${date === today ? ' (today)' : ''}.`} />
        {!store ? (
          <EmptyState icon={StoreIcon} title="You don't have a store yet" />
        ) : (
          <>
            <View style={styles.dayBar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => setDate(d => shiftDay(d, -1))} style={styles.arrow}>
                <View style={styles.flip}>
                  <ChevronRightIcon size={18} color={colors.text} strokeWidth={2.2} />
                </View>
              </Pressable>
              <View style={styles.flex}>
                <DateField label="Day" required value={date} onChange={d => d && setDate(d > today ? today : d)} maximumDate={new Date()} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next day"
                accessibilityState={{ disabled: date >= today }}
                disabled={date >= today}
                onPress={() => setDate(d => shiftDay(d, 1))}
                style={[styles.arrow, date >= today && styles.disabled]}
              >
                <ChevronRightIcon size={18} color={colors.text} strokeWidth={2.2} />
              </Pressable>
            </View>
            {date !== today ? (
              <Pressable accessibilityRole="button" onPress={() => setDate(today)} style={styles.todayBtn}>
                <Text style={styles.todayText}>Back to today</Text>
              </Pressable>
            ) : null}

            {error && !data ? <ErrorState message={error} onRetry={() => reload()} /> : null}

            <StatGrid>
              <StatCard icon={CartIcon} tone="orange" label="Sales" value={money(m?.sales)} loading={loading} />
              <StatCard
                icon={ChartTrendIcon}
                tone="blue"
                label="Gross Profit"
                value={canProfit ? money(m?.grossProfit) : '—'}
                negative={(m?.grossProfit ?? 0) < 0}
                sub={margin(m?.grossMargin)}
                loading={loading}
              />
              <StatCard icon={WalletIcon} tone="red" label="Expenses" value={money(m?.expenses)} loading={loading} />
              <StatCard
                icon={BarChartIcon}
                tone="emerald"
                label="Net Profit"
                value={canProfit ? money(m?.netProfit) : '—'}
                negative={(m?.netProfit ?? 0) < 0}
                sub={margin(m?.netMargin)}
                loading={loading}
              />
              <StatCard icon={ShoppingBagIcon} tone="violet" label="Orders" value={count(m?.orders)} loading={loading} />
              <StatCard
                icon={WalletIcon}
                tone="sky"
                label="Collection"
                value={money(m?.collection)}
                sub={m ? `Cash ${money(m.cashCollection)} · Online ${money(m.onlineCollection)}` : undefined}
                loading={loading}
              />
              <StatCard icon={WalletIcon} tone="emerald" label="Cash Collection" value={money(m?.cashCollection)} loading={loading} />
              <StatCard icon={CreditCardIcon} tone="blue" label="Online Collection" value={money(m?.onlineCollection)} loading={loading} />
              <StatCard icon={FileTextIcon} tone="amber" label="Credit Given" value={money(data?.credit.creditGiven)} sub="On this day's orders" loading={loading} />
              <StatCard icon={WalletIcon} tone="red" label="Credit Outstanding" value={money(data?.credit.creditOutstanding)} sub="All open credit, now" loading={loading} />
              <StatCard
                icon={TruckIcon}
                tone="sky"
                label="Stock Received"
                value={data ? `${count(data.stock.receivedUnits)} units` : '—'}
                sub={data ? `${data.stock.receipts} receipt${data.stock.receipts === 1 ? '' : 's'}` : undefined}
                loading={loading}
              />
              <StatCard icon={SlidersIcon} tone="slate" label="Stock Adjustments" value={data ? String(data.stock.adjustments) : '—'} sub="Counts, damage, write-offs" loading={loading} />
            </StatGrid>

            <OpsCard title="Activity Timeline" description="Orders, expenses, stock movements, notes and credit collections, in time order">
              {loading ? (
                <Placeholder height={200} />
              ) : !data?.timeline.length ? (
                <NoData text="Nothing recorded on this day" />
              ) : (
                data.timeline.map((e, i) => {
                  const meta = EVENT[e.type] ?? { label: e.type, icon: BoxIcon, tone: ['#f1f5f9', '#475569'] as [string, string] };
                  const Icon = meta.icon;
                  const title =
                    e.type === 'ORDER' ? `Order #${e.title}` : e.type === 'EXPENSE' ? `Expense: ${e.title}` : e.type === 'CREDIT_PAYMENT' ? `Credit payment ${e.title}` : e.title ?? meta.label;
                  return (
                    <Pressable key={`${e.type}-${e.id}-${i}`} accessibilityRole="button" onPress={() => open(e)} style={styles.event}>
                      <Text style={styles.time}>{time(e.at)}</Text>
                      <View style={[styles.eventIcon, { backgroundColor: meta.tone[0] }]}>
                        <Icon size={14} color={meta.tone[1]} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={opsStyles.title} numberOfLines={2}>
                          {title}
                        </Text>
                        <Text style={opsStyles.meta} numberOfLines={1}>
                          {meta.label}
                          {e.detail ? ` · ${e.detail.replace(/_/g, ' ').toLowerCase()}` : ''}
                        </Text>
                      </View>
                      <Text style={[opsStyles.amount, e.type === 'EXPENSE' && opsStyles.danger]}>
                        {e.amount !== null ? money(e.amount) : e.units !== null ? `${count(e.units)} units` : ''}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </OpsCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flip: { transform: [{ rotate: '180deg' }] },
  dayBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  arrow: {
    width: 44,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.4 },
  todayBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.secondaryLight },
  todayText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondaryDark },
  event: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  time: { width: 56, textAlign: 'right', fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  eventIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
