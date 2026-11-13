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
import { NoData, OpsCard, opsStyles, PageTitle, Placeholder, profitHidden, StatCard, StatGrid } from '../../components/operations/OpsParts';
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
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const EVENT: Record<TimelineEvent['type'], { label: string; icon: ComponentType<IconProps>; tone: [string, string] }> = {
  ORDER: { get label() { return i18n.t('common.order'); }, icon: ShoppingBagIcon, tone: ['#fff7ed', '#ea580c'] },
  EXPENSE: { get label() { return i18n.t('common.expense'); }, icon: WalletIcon, tone: ['#fef2f2', '#dc2626'] },
  STOCK_RECEIVED: { get label() { return i18n.t('common.stockReceived'); }, icon: TruckIcon, tone: ['#ecfdf5', '#059669'] },
  STOCK_ADJUSTED: { get label() { return i18n.t('operations.stockAdjusted'); }, icon: SlidersIcon, tone: ['#f1f5f9', '#475569'] },
  NOTE: { get label() { return i18n.t('operations.noteAdded'); }, icon: ClipboardListIcon, tone: ['#f5f3ff', '#7c3aed'] },
  CREDIT_PAYMENT: { get label() { return i18n.t('operations.creditCollected'); }, icon: CreditCardIcon, tone: ['#f0f9ff', '#0284c7'] },
};

/** Operations › Daily Business: everything that happened in the store on a day. */
export function DailyBusinessScreen({ navigation }: ScreenProps<'DailyBusiness'>) {
  const { t } = useTranslation();
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
        <AppHeader title={t('common.dailyBusiness')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.dailyBusiness')} icon={CalendarIcon} allowed={false} />
      </View>
    );
  }

  const m = data?.metrics;
  const canProfit = data?.canViewProfit ?? false;
  const margin = (v: number | null | undefined) => (canProfit ? (v != null ? t('operations.vPercentMargin', { v }) : undefined) : profitHidden());

  // Where an activity opens: orders and credits have their own pages.
  function open(e: TimelineEvent) {
    if (e.type === 'ORDER' && hasPermission('orders:manage')) navigation.navigate('OrderDetail', { id: e.id });
    else if (e.type === 'CREDIT_PAYMENT' && hasPermission('customer-credit:manage')) navigation.navigate('CreditDetail', { id: e.id });
    else if (e.type === 'EXPENSE' && hasPermission('store-expenses:view')) navigation.navigate('ExpenseDetail', { id: e.id });
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('common.dailyBusiness')} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <PageTitle title={t('common.dailyBusiness')} subtitle={t(date === today ? 'operations.everythingThatHappenedToday' : 'operations.everythingThatHappenedOn', { date: day(date) })} />
        {!store ? (
          <EmptyState icon={StoreIcon} title={t('common.youDonTHaveAStore')} />
        ) : (
          <>
            <View style={styles.dayBar}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('operations.previousDay')} onPress={() => setDate(d => shiftDay(d, -1))} style={styles.arrow}>
                <View style={styles.flip}>
                  <ChevronRightIcon size={18} color={colors.text} strokeWidth={2.2} />
                </View>
              </Pressable>
              <View style={styles.flex}>
                <DateField label={t('operations.day')} required value={date} onChange={d => d && setDate(d > today ? today : d)} maximumDate={new Date()} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('operations.nextDay')}
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
                <Text style={styles.todayText}>{t('operations.backToToday')}</Text>
              </Pressable>
            ) : null}

            {error && !data ? <ErrorState message={error} onRetry={() => reload()} /> : null}

            <StatGrid>
              <StatCard icon={CartIcon} tone="orange" label={t('common.sales')} value={money(m?.sales)} loading={loading} />
              <StatCard
                icon={ChartTrendIcon}
                tone="blue"
                label={t('common.grossProfit')}
                value={canProfit ? money(m?.grossProfit) : '—'}
                negative={(m?.grossProfit ?? 0) < 0}
                sub={margin(m?.grossMargin)}
                loading={loading}
              />
              <StatCard icon={WalletIcon} tone="red" label={t('common.expenses')} value={money(m?.expenses)} loading={loading} />
              <StatCard
                icon={BarChartIcon}
                tone="emerald"
                label={t('operations.netProfit')}
                value={canProfit ? money(m?.netProfit) : '—'}
                negative={(m?.netProfit ?? 0) < 0}
                sub={margin(m?.netMargin)}
                loading={loading}
              />
              <StatCard icon={ShoppingBagIcon} tone="violet" label={t('common.orders')} value={count(m?.orders)} loading={loading} />
              <StatCard
                icon={WalletIcon}
                tone="sky"
                label={t('operations.collection')}
                value={money(m?.collection)}
                sub={m ? t('operations.cashCashcollectionOnlineOnlinecollection', { cashCollection: money(m.cashCollection), onlineCollection: money(m.onlineCollection) }) : undefined}
                loading={loading}
              />
              <StatCard icon={WalletIcon} tone="emerald" label={t('operations.cashCollection')} value={money(m?.cashCollection)} loading={loading} />
              <StatCard icon={CreditCardIcon} tone="blue" label={t('operations.onlineCollection')} value={money(m?.onlineCollection)} loading={loading} />
              <StatCard icon={FileTextIcon} tone="amber" label={t('operations.creditGiven')} value={money(data?.credit.creditGiven)} sub={t('operations.onThisDaysOrders')} loading={loading} />
              <StatCard icon={WalletIcon} tone="red" label={t('operations.creditOutstanding')} value={money(data?.credit.creditOutstanding)} sub={t('operations.allOpenCreditNow')} loading={loading} />
              <StatCard
                icon={TruckIcon}
                tone="sky"
                label={t('common.stockReceived')}
                value={data ? t('common.unitsValue', { units: count(data.stock.receivedUnits) }) : '—'}
                sub={data ? t('operations.receiptCount', { count: data.stock.receipts }) : undefined}
                loading={loading}
              />
              <StatCard icon={SlidersIcon} tone="slate" label={t('operations.stockAdjustments')} value={data ? String(data.stock.adjustments) : '—'} sub={t('operations.countsDamageWriteOffs')} loading={loading} />
            </StatGrid>

            <OpsCard title={t('operations.activityTimeline')} description={t('operations.ordersExpensesStockMovementsNotesAnd')}>
              {loading ? (
                <Placeholder height={200} />
              ) : !data?.timeline.length ? (
                <NoData text={t('operations.nothingRecordedOnThisDay')} />
              ) : (
                data.timeline.map((e, i) => {
                  const meta = EVENT[e.type] ?? { label: e.type, icon: BoxIcon, tone: ['#f1f5f9', '#475569'] as [string, string] };
                  const Icon = meta.icon;
                  const title =
                    e.type === 'ORDER' ? t('operations.orderTitle', { title: e.title }) : e.type === 'EXPENSE' ? t('operations.expenseTitle', { title: e.title }) : e.type === 'CREDIT_PAYMENT' ? t('operations.creditPaymentTitle', { title: e.title }) : e.title ?? meta.label;
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
                        {e.amount !== null ? money(e.amount) : e.units !== null ? t('operations.unitsUnits', { units: count(e.units) }) : ''}
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
