import React, { useCallback, useMemo, useRef, useState, type ComponentType } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDay } from '../../lib/date';
import { formatDiscount, isActiveCoupon, isExpiredCoupon } from '../../lib/coupons';
import { couponService, type Coupon } from '../../services/coupon-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { BanIcon, CheckCircleIcon, ClockIcon, PlusIcon, TicketIcon, type IconProps } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'FLAT', label: 'Flat' },
  { value: 'PERCENTAGE', label: 'Percentage' },
];
const STATUS_FILTERS = [
  { value: '', label: 'All Status' },
  { value: '1', label: 'Active' },
  { value: '0', label: 'Inactive' },
];

/** Sales › Coupons: discount codes customers use at checkout. */
export function CouponsScreen({ navigation }: ScreenProps<'Coupons'>) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('coupons-master:manage');
  const { data, error, loading, refreshing, reload } = useFetch(() => (allowed ? couponService.list() : Promise.resolve([])), [allowed]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  // Coupons may have been created or changed on their own pages.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current && allowed) reload();
      focused.current = true;
    }, [allowed, reload]),
  );

  const rows = useMemo(() => data ?? [], [data]);
  const stats = useMemo(() => {
    const active = rows.filter(isActiveCoupon).length;
    return { total: rows.length, active, inactive: rows.length - active, expired: rows.filter(r => isExpiredCoupon(r)).length };
  }, [rows]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (type && r.discountType !== type) return false;
      if (status !== '' && String(r.status) !== status) return false;
      return !q || r.title?.toLowerCase().includes(q) || r.couponCode?.toLowerCase().includes(q);
    });
  }, [rows, search, type, status]);
  const filtered = !!(search.trim() || type || status);

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Coupons" onBack={navigation.goBack} />
        <ComingSoon label="Coupons" icon={TicketIcon} allowed={false} />
      </View>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={styles.pageTitle} accessibilityRole="header">
            Coupons
          </Text>
          <Text style={styles.pageSubtitle}>Discount coupon codes available to customers at checkout.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create Coupon"
          onPress={() => navigation.navigate('CouponForm', {})}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <PlusIcon size={16} color={colors.white} strokeWidth={2.4} />
          <Text style={styles.addText}>Create</Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <Stat icon={TicketIcon} tone={['#fff7ed', '#ea580c']} label="Total Coupons" value={stats.total} />
        <Stat icon={CheckCircleIcon} tone={['#ecfdf5', '#059669']} label="Active" value={stats.active} />
        <Stat icon={BanIcon} tone={['#fff1f2', '#e11d48']} label="Inactive" value={stats.inactive} />
        <Stat icon={ClockIcon} tone={['#fffbeb', '#d97706']} label="Expired" value={stats.expired} />
      </View>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by title or coupon code…" />
      <FilterChips options={TYPE_FILTERS} value={type} onChange={setType} />
      <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
      {filtered ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setSearch('');
            setType('');
            setStatus('');
          }}
          hitSlop={6}
          style={styles.reset}
        >
          <Text style={styles.resetText}>Reset filters</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Coupons" subtitle={data ? `${rows.length} coupon${rows.length === 1 ? '' : 's'}` : undefined} onBack={navigation.goBack} />
      <FlatList
        data={loading || (error && !data) ? [] : visible}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <CouponCard coupon={item} onPress={() => navigation.navigate('CouponDetail', { id: item.id })} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <ListSkeleton height={96} />
          ) : error && !data ? (
            <ErrorState message={error} onRetry={() => reload()} />
          ) : (
            <EmptyState
              icon={TicketIcon}
              title={filtered ? 'No coupons match' : 'No coupons found'}
              text={filtered ? 'Try another filter or search.' : 'Create a coupon code customers can use at checkout.'}
            />
          )
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function Stat({ icon: Icon, tone, label, value }: { icon: ComponentType<IconProps>; tone: [string, string]; label: string; value: number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.statIcon, { backgroundColor: tone[0] }]}>
        <Icon size={16} color={tone[1]} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function CouponCard({ coupon, onPress }: { coupon: Coupon; onPress: () => void }) {
  const active = isActiveCoupon(coupon);
  const expired = isExpiredCoupon(coupon);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${coupon.title}, ${coupon.couponCode}, ${active ? 'Active' : 'Inactive'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1}>
            {coupon.title}
          </Text>
          <View style={styles.code}>
            <Text style={styles.codeText}>{coupon.couponCode}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={styles.discount}>{formatDiscount(coupon)}</Text>
          <View style={styles.badges}>
            {expired ? <Badge label="Expired" tone="amber" /> : null}
            <Badge label={active ? 'Active' : 'Inactive'} tone={active ? 'green' : 'slate'} />
          </View>
        </View>
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {`${coupon.startDate ? formatDay(coupon.startDate) : '—'} → ${coupon.endDate ? formatDay(coupon.endDate) : 'No end date'} · ${
          coupon.usageLimitTotal ? `${coupon.usageLimitTotal} total` : 'Unlimited'
        }`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 32 },
  headerBlock: { gap: 12, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 24, fontFamily: fonts.extrabold, color: colors.text, letterSpacing: -0.4 },
  pageSubtitle: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textSecondary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    ...shadow.button,
  },
  addBtnPressed: { backgroundColor: colors.secondaryDark },
  addText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  statIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  reset: { alignSelf: 'flex-start' },
  resetText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  separator: { height: 10 },
  card: { padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  cardPressed: { backgroundColor: '#fffaf5' },
  cardTop: { flexDirection: 'row', gap: 10 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  code: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.secondarySoft,
    backgroundColor: colors.secondaryLight,
  },
  codeText: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 0.6, color: colors.secondaryDark },
  right: { alignItems: 'flex-end', gap: 6 },
  discount: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  badges: { flexDirection: 'row', gap: 4 },
  meta: { marginTop: 10, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
});
