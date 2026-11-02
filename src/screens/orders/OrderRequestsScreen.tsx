import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ClipboardListIcon } from '../../components/icons';
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

  const chips = useMemo(() => {
    const counts = data?.counts;
    const all = counts ? Object.values(counts).reduce((n, c) => n + (c ?? 0), 0) : undefined;
    return [
      { value: '', label: 'All', count: all },
      ...ORDER_REQUEST_STATUSES.map(s => ({ value: s.value, label: s.label, count: counts?.[s.value] })),
    ];
  }, [data]);

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
            <SearchBar value={query} onChange={setQuery} placeholder="Search request no., customer, mobile" />
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
              text={status || debounced ? 'Try another filter or search.' : 'When customers send a list of products to your store, it shows up here.'}
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
