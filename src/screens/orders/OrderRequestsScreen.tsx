import React, { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatWhen } from '../../lib/date';
import {
  orderRequestService,
  ORDER_REQUEST_STATUSES,
  requestStatusLabel,
  requestStatusTone,
  type OrderRequestRow,
  type OrderRequestStatus,
} from '../../services/order-request-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { CheckCircleIcon, ClipboardListIcon, ClockIcon, ShoppingBagIcon, StoreIcon, type IconProps } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const SEARCH_DELAY_MS = 300;

/** Order requests customers send to the store: product lists without prices, billed by the store. */
export function OrderRequestsScreen({ navigation }: ScreenProps<'OrderRequests'>) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('orders:manage');
  const [status, setStatus] = useState<OrderRequestStatus | ''>('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, error, loading, refreshing, reload } = useFetch(
    () =>
      allowed
        ? orderRequestService.list({ ...(status ? { status } : {}), ...(debounced ? { q: debounced } : {}), limit: 100 })
        : Promise.resolve(null),
    [allowed, status, debounced],
  );

  useFocusEffect(
    useCallback(() => {
      if (allowed) reload();
    }, [allowed, reload]),
  );

  const counts = data?.counts;
  const all = counts ? Object.values(counts).reduce((n, c) => n + (c ?? 0), 0) : undefined;
  const count = (st: OrderRequestStatus) => (counts ? String(counts[st] ?? 0) : '…');
  const chips = useMemo(() => {
    return [
      { value: '', label: 'All', count: all },
      ...ORDER_REQUEST_STATUSES.map(s => ({ value: s.value, label: s.label, count: counts?.[s.value] })),
    ];
  }, [counts, all]);

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Order Requests" onBack={navigation.goBack} />
        <ComingSoon label="Order Requests" icon={ClipboardListIcon} allowed={false} />
      </View>
    );
  }

  const rows = data?.items ?? [];
  return (
    <View style={styles.screen}>
      <AppHeader title="Order Requests" subtitle={data ? `${data.total} request${data.total === 1 ? '' : 's'}` : undefined} onBack={navigation.goBack} />
      <FlatList
        data={loading || (error && !data) ? [] : rows}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <RequestCard request={item} onPress={() => navigation.navigate('OrderRequestDetail', { id: item.id })} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View>
              <Text style={styles.pageTitle} accessibilityRole="header">
                Order Requests
              </Text>
              <Text style={styles.pageSubtitle}>
                Lists customers sent to your order-request stores. Check availability, confirm the items, generate the final bill and complete them.
              </Text>
            </View>
            <View style={styles.cards}>
              <SummaryCard icon={ShoppingBagIcon} tone={['#fffbeb', '#d97706']} label="New requests" value={count('REQUESTED')} hint="Waiting for you to check" />
              <SummaryCard icon={ClockIcon} tone={['#f0f9ff', '#0284c7']} label="Under review" value={count('UNDER_REVIEW')} hint="Checking availability" />
              <SummaryCard icon={CheckCircleIcon} tone={['#fff7ed', '#ea580c']} label="Confirmed" value={count('CONFIRMED')} hint="Ready for the final bill" />
              <SummaryCard
                icon={StoreIcon}
                tone={['#ecfdf5', '#059669']}
                label="Completed"
                value={count('COMPLETED')}
                hint={all != null ? `Billed as orders · ${all} request${all === 1 ? '' : 's'} in all` : 'Billed as orders'}
              />
            </View>
            <SearchBar value={query} onChange={setQuery} placeholder="Search request, customer or mobile…" />
            <FilterChips options={chips} value={status} onChange={value => setStatus(value as OrderRequestStatus | '')} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ListSkeleton />
          ) : error && !data ? (
            <ErrorState message={error} onRetry={() => reload()} />
          ) : (
            <EmptyState
              icon={ClipboardListIcon}
              title={status || debounced ? 'No requests match' : 'No order requests yet'}
              text={
                status || debounced
                  ? 'Try another filter or search term.'
                  : 'They arrive when a store is set to take order requests (Store › Settings) and a customer sends their list.'
              }
            />
          )
        }
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      />
    </View>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: ComponentType<IconProps>;
  tone: [string, string];
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.summary} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.summaryHead}>
        <View style={[styles.summaryIcon, { backgroundColor: tone[0] }]}>
          <Icon size={16} color={tone[1]} />
        </View>
        <Text style={styles.summaryLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryHint} numberOfLines={2}>
        {hint}
      </Text>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function RequestCard({ request, onPress }: { request: OrderRequestRow; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Request ${request.requestNumber}, ${requestStatusLabel(request.status)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.number} numberOfLines={1}>
          {request.requestNumber}
        </Text>
        <Badge label={requestStatusLabel(request.status)} tone={requestStatusTone(request.status)} />
        <Text style={styles.items}>
          {request.itemCount} item{request.itemCount === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {formatWhen(request.createdAt)} · {request.storeName}
      </Text>
      <View style={styles.cardBottom}>
        <View style={styles.flex}>
          <Text style={styles.customer} numberOfLines={1}>
            {request.customerName}
          </Text>
          <Text style={styles.phone}>{request.customerMobile}</Text>
        </View>
        {request.orderNumber ? <Badge label={`Bill ${request.orderNumber}`} tone="green" /> : null}
      </View>
      {request.customerNote ? (
        <Text style={styles.note} numberOfLines={2}>
          “{request.customerNote}”
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 28 },
  headerBlock: { gap: 12, marginBottom: 14 },
  pageTitle: { fontSize: 24, fontFamily: fonts.extrabold, color: colors.text, letterSpacing: -0.4 },
  pageSubtitle: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textSecondary },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summary: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  summaryValue: { marginTop: 10, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  summaryHint: { marginTop: 2, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: colors.textSecondary },
  separator: { height: 10 },
  card: { padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  cardPressed: { backgroundColor: '#fffaf5' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  number: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  items: { marginLeft: 'auto', fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
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
  customer: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  phone: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  note: { marginTop: 8, fontFamily: fonts.regular, fontSize: 12.5, fontStyle: 'italic', color: colors.textSecondary },
});
