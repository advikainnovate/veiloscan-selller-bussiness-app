import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatRupees } from '../../lib/format';
import { formatWhen, isToday } from '../../lib/date';
import {
  isPickupOrder,
  isQuickSale,
  orderAmount,
  orderDiscountInfo,
  orderStatusLabel,
  methodLabel,
  orderStatusTone,
  ORDER_FILTERS,
  paymentState,
  type OrderRow,
} from '../../lib/orders';
import { orderService } from '../../services/order-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Gradient } from '../../components/ui/Gradient';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ArrowDownIcon, ArrowUpIcon, CartIcon, CheckCircleIcon, PlusIcon, ShoppingBagIcon } from '../../components/icons';
import type { TabScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const QUICK_SALES = 'QUICK';

type SortKey = 'placed' | 'amount' | 'customer';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'placed', get label() { return i18n.t('common.date'); } },
  { key: 'amount', get label() { return i18n.t('common.amount'); } },
  { key: 'customer', get label() { return i18n.t('common.customer'); } },
];

const customerKey = (row: OrderRow) => (isQuickSale(row) ? 'quick sale' : (row.customerName ?? '').toLowerCase());

/** Orders tab: the store's orders, newest first, with status filters and search. */
export function OrdersScreen({ navigation }: TabScreenProps<'Orders'>) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('orders:manage');
  const { data, error, loading, refreshing, reload } = useFetch(
    () => (allowed ? orderService.list() : Promise.resolve([])),
    [allowed],
  );
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'placed', desc: true });

  // New orders may have come in while away.
  useFocusEffect(
    useCallback(() => {
      if (allowed) reload();
    }, [allowed, reload]),
  );

  const rows = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const paid = rows.filter(r => r.paymentStatus === 'PAID');
    return {
      newCount: rows.filter(r => r.orderStatus === 'CREATED').length,
      ready: rows.filter(r => r.orderStatus === 'PACKED').length,
      pickedUpToday: rows.filter(r => r.orderStatus === 'DELIVERED' && isToday(r.orderStatusTimestamp)).length,
      collected: paid.reduce((sum, r) => sum + orderAmount(r), 0),
    };
  }, [rows]);

  const chips = useMemo(
    () => [
      ...ORDER_FILTERS.map(f => ({ ...f, count: f.value ? rows.filter(r => r.orderStatus === f.value).length : rows.length })),
      { value: QUICK_SALES, label: t('orders.quickSales'), count: rows.filter(isQuickSale).length },
    ],
    [rows, t],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter(row => {
        if (filter === QUICK_SALES ? !isQuickSale(row) : filter && row.orderStatus !== filter) return false;
        if (!q) return true;
        const text = `${row.uniqueOrderId} ${row.customerName ?? ''} ${row.customerPhone ?? ''} ${row.store?.name ?? ''} ${isQuickSale(row) ? 'quick sale' : ''}`;
        return text.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const order =
          sort.key === 'amount'
            ? orderAmount(a) - orderAmount(b)
            : sort.key === 'customer'
              ? customerKey(a).localeCompare(customerKey(b))
              : new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
        return sort.desc ? -order : order;
      });
  }, [rows, filter, search, sort]);

  // Tapping the current sort flips its direction; a new one starts on its natural order.
  const toggleSort = (key: SortKey) =>
    setSort(prev => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== 'customer' }));

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('common.orders')} />
        <ComingSoon label={t('common.orders')} icon={ShoppingBagIcon} allowed={false} />
      </View>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      {/* Today at a glance; tapping a figure filters the list */}
      <View style={styles.summary}>
        <Gradient colors={[colors.primary, '#0b2a52']} direction="diagonal" borderRadius={20} />
        <View style={styles.summaryGlow} />
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>{t('common.collected')}</Text>
            <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatRupees(Math.round(stats.collected))}
            </Text>
          </View>
          <View style={styles.summaryBadge}>
            <CheckCircleIcon size={14} color="#4ade80" />
            <Text style={styles.summaryBadgeText}>{t('orders.pickeduptodayPickedUpToday', { pickedUpToday: stats.pickedUpToday })}</Text>
          </View>
        </View>
        <View style={styles.summaryStats}>
          <SummaryStat label={t('orders.newOrders')} value={stats.newCount} dot="#fbbf24" active={filter === 'CREATED'} onPress={() => setFilter(filter === 'CREATED' ? '' : 'CREATED')} />
          <SummaryStat label={t('common.ready')} value={stats.ready} dot="#c084fc" active={filter === 'PACKED'} onPress={() => setFilter(filter === 'PACKED' ? '' : 'PACKED')} />
          <SummaryStat label={t('orders.allOrders')} value={rows.length} dot="#94a3b8" active={!filter} onPress={() => setFilter('')} />
        </View>
      </View>
      <SearchBar value={search} onChange={setSearch} placeholder={t('orders.searchOrderIdCustomerPhone')} />
      <FilterChips options={chips} value={filter} onChange={setFilter} />
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>{t('orders.visiblecountShownSort', { visibleCount: visible.length })}</Text>
        <View style={styles.sortGroup}>
          {SORTS.map(option => {
            const active = sort.key === option.key;
            const Arrow = sort.desc ? ArrowDownIcon : ArrowUpIcon;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={active ? t(sort.desc ? 'orders.sortByDescending' : 'orders.sortByAscending', { option: option.label }) : t('orders.sortBy', { option: option.label })}
                onPress={() => toggleSort(option.key)}
                style={[styles.sort, active && styles.sortActive]}
              >
                <Text style={[styles.sortText, active && styles.sortTextActive]}>{option.label}</Text>
                {active ? <Arrow size={11} color={colors.white} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title={t('common.orders')} subtitle={data ? t('common.orderCount', { count: rows.length }) : undefined} />
      <FlatList
        data={loading || (error && !data) ? [] : visible}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <OrderCard order={item} onPress={() => navigation.navigate('OrderDetail', { id: item.id })} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <ListSkeleton />
          ) : error && !data ? (
            <ErrorState message={error} onRetry={() => reload()} />
          ) : (
            <EmptyState
              icon={ShoppingBagIcon}
              title={rows.length ? t('orders.noOrdersMatch') : t('orders.noOrdersYet')}
              text={rows.length ? t('common.tryAnotherFilterOrSearch') : t('orders.ordersPlacedAtYourStoresWill')}
            />
          )
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />
        }
      />
      {/* "Add Self Orders": counter and phone orders. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.newOrder')}
        onPress={() => navigation.navigate('CreateOrder')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <PlusIcon size={20} color={colors.white} strokeWidth={2.4} />
        <Text style={styles.fabText}>{t('common.newOrder')}</Text>
      </Pressable>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function SummaryStat({ label, value, dot, active, onPress }: { label: string; value: number; dot: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.stat, active && styles.statActive]}
    >
      <View style={styles.statHead}>
        <View style={[styles.statDot, { backgroundColor: dot }]} />
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </Pressable>
  );
}

const TONE_COLOR: Record<string, string> = {
  amber: '#f59e0b',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#ff6b00',
  slate: '#94a3b8',
};

function OrderCard({ order, onPress }: { order: OrderRow; onPress: () => void }) {
  const { t } = useTranslation();
  const quick = isQuickSale(order);
  const pay = paymentState(order);
  const discount = orderDiscountInfo(order);
  // How it was paid: "Cash ₹500 + UPI ₹200", and any credit still owed.
  const paidBy = (order.payments ?? []).map(p => `${methodLabel(p.method)} ${formatRupees(Number(p.amount) || 0)}`).join(' + ');
  const creditDue = Number(order.creditOutstanding) || 0;
  const name = quick ? t('orders.quickSale2') : order.customerName || t('orders.registeredCustomer');

  const tone = orderStatusTone(order.orderStatus);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('orders.orderUniqueorderidOrderAmount', { uniqueOrderId: order.uniqueOrderId, order: orderStatusLabel(order), amount: formatRupees(orderAmount(order)) })}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.stripe, { backgroundColor: TONE_COLOR[tone] ?? TONE_COLOR.slate }]} />
      <View style={styles.cardTop}>
        <View style={[styles.avatar, quick && styles.avatarQuick]}>
          {quick ? <CartIcon size={17} color={colors.secondary} /> : <Text style={styles.avatarText}>{initials(name)}</Text>}
        </View>
        <View style={styles.flex}>
          <Text style={styles.customer} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.orderId} numberOfLines={1}>
            {`${order.uniqueOrderId} · ${formatWhen(order.createdAt)}`}
          </Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amount}>{formatRupees(orderAmount(order))}</Text>
          {discount ? <Text style={styles.discount}>{t('orders.amountOff', { amount: formatRupees(discount.amount) })}</Text> : null}
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Badge label={orderStatusLabel(order)} tone={tone} />
        <Badge label={pay.label} tone={pay.tone} />
        <Text style={styles.meta} numberOfLines={1}>
          {[
            isPickupOrder(order) ? t('orders.pickup') : t('common.delivery'),
            paidBy || null,
            creditDue > 0 ? t('orders.creditdueOnCredit', { creditDue: formatRupees(creditDue) }) : null,
            order.store?.name,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

/** "Asha Rao" → "AR". */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('') || '?';

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 96 },
  headerBlock: { gap: 12, marginBottom: 12 },
  summary: { overflow: 'hidden', padding: 16, borderRadius: 20, backgroundColor: colors.primary, ...shadow.raised },
  summaryGlow: { position: 'absolute', top: -60, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,138,51,0.06)' },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.65)' },
  summaryValue: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.6, color: colors.white },
  summaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(74,222,128,0.12)' },
  summaryBadgeText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#bbf7d0' },
  summaryStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.07)' },
  statActive: { borderColor: 'rgba(255,138,51,0.7)', backgroundColor: 'rgba(255,107,0,0.18)' },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statLabel: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  statValue: { marginTop: 3, fontFamily: fonts.extrabold, fontSize: 18, color: colors.white },
  separator: { height: 10 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sortLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  sortGroup: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: 12, backgroundColor: colors.surface, ...shadow.card },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  sortActive: { backgroundColor: colors.primary },
  sortText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  sortTextActive: { color: colors.white },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: colors.secondary,
    ...shadow.button,
  },
  fabPressed: { backgroundColor: colors.secondaryDark },
  fabText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  card: { overflow: 'hidden', paddingVertical: 12, paddingLeft: 16, paddingRight: 14, borderRadius: 16, backgroundColor: colors.surface, ...shadow.card },
  cardPressed: { backgroundColor: '#fffaf5' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatarQuick: { backgroundColor: colors.secondaryLight },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  customer: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  orderId: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  amountCol: { alignItems: 'flex-end' },
  amount: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  discount: { marginTop: 2, fontFamily: fonts.semibold, fontSize: 11, color: colors.successDark },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  meta: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'right' },
});
