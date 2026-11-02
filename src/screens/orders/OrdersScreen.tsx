import React, { useCallback, useMemo, useState, type ComponentType } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
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
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ArrowDownIcon, ArrowUpIcon, CartIcon, CheckCircleIcon, ClockIcon, PlusIcon, ShoppingBagIcon, WalletIcon, type IconProps } from '../../components/icons';
import type { TabScreenProps } from '../../navigation/types';

const QUICK_SALES = 'QUICK';

type SortKey = 'placed' | 'amount' | 'customer';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'placed', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'customer', label: 'Customer' },
];

const customerKey = (row: OrderRow) => (isQuickSale(row) ? 'quick sale' : (row.customerName ?? '').toLowerCase());

/** Orders tab: the store's orders, newest first, with status filters and search. */
export function OrdersScreen({ navigation }: TabScreenProps<'Orders'>) {
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
      { value: QUICK_SALES, label: 'Quick Sales', count: rows.filter(isQuickSale).length },
    ],
    [rows],
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
        <AppHeader title="Orders" />
        <ComingSoon label="Orders" icon={ShoppingBagIcon} allowed={false} />
      </View>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
        <Tile icon={ShoppingBagIcon} tone={['#fef3c7', '#d97706']} label="New orders" value={String(stats.newCount)} />
        <Tile icon={ClockIcon} tone={['#f3e8ff', '#9333ea']} label="Ready for pickup" value={String(stats.ready)} />
        <Tile icon={CheckCircleIcon} tone={['#dcfce7', '#16a34a']} label="Picked up today" value={String(stats.pickedUpToday)} />
        <Tile icon={WalletIcon} tone={['#fff1e6', '#ff6b00']} label="Collected" value={formatRupees(Math.round(stats.collected))} />
      </ScrollView>
      <SearchBar value={search} onChange={setSearch} placeholder="Search order ID, customer, phone" />
      <FilterChips options={chips} value={filter} onChange={setFilter} />
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by</Text>
        {SORTS.map(option => {
          const active = sort.key === option.key;
          const Arrow = sort.desc ? ArrowDownIcon : ArrowUpIcon;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Sort by ${option.label}${active ? (sort.desc ? ', descending' : ', ascending') : ''}`}
              onPress={() => toggleSort(option.key)}
              style={[styles.sort, active && styles.sortActive]}
            >
              <Text style={[styles.sortText, active && styles.sortTextActive]}>{option.label}</Text>
              {active ? <Arrow size={11} color={colors.text} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Orders" subtitle={data ? `${rows.length} order${rows.length === 1 ? '' : 's'}` : undefined} />
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
              title={rows.length ? 'No orders match' : 'No orders yet'}
              text={rows.length ? 'Try another filter or search.' : 'Orders placed at your stores will show up here.'}
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
        accessibilityLabel="New order"
        onPress={() => navigation.navigate('CreateOrder')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <PlusIcon size={20} color={colors.white} strokeWidth={2.4} />
        <Text style={styles.fabText}>New order</Text>
      </Pressable>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function Tile({ icon: Icon, tone, label, value }: { icon: ComponentType<IconProps>; tone: [string, string]; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: tone[0] }]}>
        <Icon size={18} color={tone[1]} />
      </View>
      <View>
        <Text style={styles.tileValue}>{value}</Text>
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
    </View>
  );
}

function OrderCard({ order, onPress }: { order: OrderRow; onPress: () => void }) {
  const quick = isQuickSale(order);
  const pay = paymentState(order);
  const discount = orderDiscountInfo(order);
  // How it was paid: "Cash ₹500 + UPI ₹200", and any credit still owed.
  const paidBy = (order.payments ?? []).map(p => `${methodLabel(p.method)} ${formatRupees(Number(p.amount) || 0)}`).join(' + ');
  const creditDue = Number(order.creditOutstanding) || 0;
  const name = quick ? 'Quick Sale' : order.customerName || 'Registered customer';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.uniqueOrderId}, ${orderStatusLabel(order)}, ${formatRupees(orderAmount(order))}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.orderId} numberOfLines={1}>
          {order.uniqueOrderId}
        </Text>
        <Badge label={orderStatusLabel(order)} tone={orderStatusTone(order.orderStatus)} />
        <Text style={styles.amount}>{formatRupees(orderAmount(order))}</Text>
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {formatWhen(order.createdAt)} · {isPickupOrder(order) ? 'Store pickup' : 'Delivery'}
        {order.store?.name ? ` · ${order.store.name}` : ''}
      </Text>
      <View style={styles.cardBottom}>
        <View style={[styles.avatar, quick && styles.avatarQuick]}>
          {quick ? (
            <CartIcon size={16} color={colors.secondary} />
          ) : (
            <Text style={styles.avatarText}>{name.trim()[0]?.toUpperCase() ?? '?'}</Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.customer} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.phone} numberOfLines={1}>
            {quick ? 'No customer details' : order.customerPhone || '—'}
          </Text>
        </View>
        <View style={styles.payment}>
          <Badge label={pay.label} tone={pay.tone} />
          {discount ? <Text style={styles.discount}>−{formatRupees(discount.amount)} off</Text> : null}
        </View>
      </View>
      {paidBy || creditDue > 0 ? (
        <Text style={styles.paidBy} numberOfLines={1}>
          {paidBy}
          {paidBy && creditDue > 0 ? ' · ' : ''}
          {creditDue > 0 ? `${formatRupees(creditDue)} on credit` : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 96 },
  headerBlock: { gap: 12, marginBottom: 14 },
  tiles: { gap: 10, paddingVertical: 2 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.text },
  tileLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  separator: { height: 10 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortLabel: { marginRight: 2, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  sortActive: { backgroundColor: colors.primaryLight },
  sortText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  sortTextActive: { color: colors.text },
  paidBy: { marginTop: 8, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
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
  card: { padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  cardPressed: { backgroundColor: '#fffaf5' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderId: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  amount: { marginLeft: 'auto', fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.text },
  meta: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  cardBottom: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatarQuick: { backgroundColor: colors.secondaryLight },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  customer: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  phone: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  payment: { alignItems: 'flex-end', gap: 3 },
  discount: { fontFamily: fonts.semibold, fontSize: 11, color: colors.successDark },
});
