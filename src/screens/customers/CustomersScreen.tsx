import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatNumber, formatRupees } from '../../lib/format';
import { formatDay } from '../../lib/date';
import { customerInitials, customerName, customerPhone } from '../../lib/customers';
import { customerService, type CustomerRow, type CustomerView } from '../../services/customer-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Button } from '../../components/ui/Button';
import { Gradient } from '../../components/ui/Gradient';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ChevronRightIcon, PlusIcon, UserPlusIcon, UsersIcon, WalletIcon } from '../../components/icons';
import type { TabScreenProps } from '../../navigation/types';
import { Trans, useTranslation } from 'react-i18next';

const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 300;

// Initials circles take turns through these, picked by customer.
const AVATAR_TONES = [
  { bg: '#fff1e6', fg: '#f97316' },
  { bg: '#eaf2fb', fg: '#3b82f6' },
  { bg: '#f3e8ff', fg: '#9333ea' },
  { bg: '#dcfce7', fg: '#22c55e' },
  { bg: '#fef3c7', fg: '#d97706' },
];

function avatarTone(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 100003;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** Customers tab: who buys from the store, what they've spent and what they owe. */
export function CustomersScreen({ navigation }: TabScreenProps<'Customers'>) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('customers:manage');
  const [view, setView] = useState<CustomerView>('all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const listRef = useRef<FlatList<CustomerRow>>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // A new tab or search starts from the first page.
  useEffect(() => setPage(1), [view, debounced]);

  const summary = useFetch(() => (allowed ? customerService.summary() : Promise.resolve(null)), [allowed]);
  const list = useFetch(
    () =>
      allowed
        ? customerService.list({ page, limit: PAGE_SIZE, view, ...(debounced ? { search: debounced } : {}) })
        : Promise.resolve(null),
    [allowed, view, debounced, page],
  );
  const reloadSummary = summary.reload;
  const reloadList = list.reload;

  // New customers come in with every order.
  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      reloadSummary();
      reloadList();
    }, [allowed, reloadSummary, reloadList]),
  );

  const goToPage = (next: number) => {
    setPage(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('common.customers')} />
        <ComingSoon label={t('common.customers')} icon={UsersIcon} allowed={false} />
      </View>
    );
  }

  const stats = summary.data;
  // Credit figures come back null for roles without Customer Credit.
  const showCredit = stats?.withCredit != null;
  const value = (n: number | null | undefined, format = formatNumber) => (n == null ? '—' : format(n));
  const tabs: { key: CustomerView; label: string; count?: number }[] = [
    { key: 'all', label: t('common.all'), count: stats?.total },
    ...(showCredit ? [{ key: 'credit' as const, label: t('customers.withCredit'), count: stats?.withCredit ?? undefined }] : []),
    { key: 'top', label: t('customers.top'), count: stats?.top },
  ];

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, total);
  const searching = !!debounced || view !== 'all';

  const header = (
    <View style={styles.headerBlock}>
      {/* Who buys from the store, and what they owe; tapping a figure opens its tab */}
      <View style={styles.summary}>
        <Gradient colors={[colors.primary, '#0b2a52']} direction="diagonal" borderRadius={20} />
        <View style={styles.summaryGlow} />
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>{t('customers.totalCustomers')}</Text>
            <Text style={styles.summaryValue}>{value(stats?.total)}</Text>
          </View>
          {stats?.newThisMonth ? (
            <View style={styles.newPill}>
              <UserPlusIcon size={13} color="#bbf7d0" />
              <Text style={styles.newPillText}>{t('customers.newthismonthThisMonth', { newThisMonth: formatNumber(stats.newThisMonth) })}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.summaryStats}>
          {showCredit ? (
            <>
              <SummaryStat label={t('customers.withCredit2')} value={value(stats?.withCredit)} dot="#fb923c" active={view === 'credit'} onPress={() => setView(view === 'credit' ? 'all' : 'credit')} />
              <SummaryStat label={t('customers.creditDue')} value={value(stats?.creditOutstanding, n => formatRupees(Math.round(n)))} dot="#f87171" active={false} onPress={() => setView('credit')} />
            </>
          ) : null}
          <SummaryStat label={t('customers.topBuyers')} value={value(stats?.top)} dot="#4ade80" active={view === 'top'} onPress={() => setView(view === 'top' ? 'all' : 'top')} />
        </View>
      </View>

      <SearchBar value={query} onChange={setQuery} placeholder={t('customers.searchByNameMobileOrCustomer')} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.map(tab => {
          const active = tab.key === view;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setView(tab.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.count != null ? `${tab.label} (${formatNumber(tab.count)})` : tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const footer =
    rows.length && total > PAGE_SIZE ? (
      <View style={styles.pager}>
        <Text style={styles.pagerText}>
          <Trans
            i18nKey="customers.showingRangeOfTotal"
            values={{ from: formatNumber(first), to: formatNumber(last), total: formatNumber(total) }}
            components={{ b: <Text style={styles.pagerStrong} /> }}
          />
        </Text>
        <PageButton label={t('common.previousPage')} disabled={page <= 1} onPress={() => goToPage(page - 1)} flip />
        <Text style={styles.pagerCount}>{`${page} / ${pages}`}</Text>
        <PageButton label={t('common.nextPage')} disabled={page >= pages} onPress={() => goToPage(page + 1)} />
      </View>
    ) : rows.length ? (
      <Text style={[styles.pagerText, styles.pagerAlone]}>
        <Trans i18nKey="customers.showingCustomers" count={total} values={{ total: formatNumber(total) }} components={{ b: <Text style={styles.pagerStrong} /> }} />
      </Text>
    ) : undefined;

  return (
    <View style={styles.screen}>
      <AppHeader title={t('common.customers')} subtitle={stats ? t('customers.customerTotal', { count: stats.total, total: formatNumber(stats.total) }) : undefined} />
      <FlatList
        ref={listRef}
        data={list.loading || (list.error && !list.data) ? [] : rows}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <CustomerCard customer={item} onPress={() => navigation.navigate('CustomerDetail', { id: item.id })} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          list.loading ? (
            <ListSkeleton height={104} />
          ) : list.error && !list.data ? (
            <ErrorState message={list.error} onRetry={() => list.reload()} />
          ) : (
            <EmptyState
              icon={UsersIcon}
              title={searching ? t('common.noCustomersMatch') : t('customers.noCustomersYet')}
              text={
                debounced
                  ? t('customers.tryAnotherNameMobileNumberOr')
                  : view === 'credit'
                    ? t('customers.noCustomerOwesYouMoneyRight')
                    : t('customers.customersShowUpHereOnceThey')
              }
            />
          )
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={list.refreshing}
            onRefresh={() => {
              summary.reload();
              list.reload(true);
            }}
            tintColor={colors.secondary}
            colors={[colors.secondary]}
          />
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('customers.addCustomer')}
        onPress={() => setAdding(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <PlusIcon size={20} color={colors.white} strokeWidth={2.4} />
        <Text style={styles.fabText}>{t('customers.addCustomer2')}</Text>
      </Pressable>

      {/* Customers are saved with their first order; there is no separate sign-up. */}
      <Sheet
        visible={adding}
        title={t('customers.addACustomer')}
        subtitle={t('customers.customersAreSavedWhenYouBill')}
        onClose={() => setAdding(false)}
        footer={
          <Button
            title={t('customers.startANewOrder')}
            onPress={() => {
              setAdding(false);
              navigation.navigate('CreateOrder');
            }}
          />
        }
      >
        <View />
      </Sheet>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function SummaryStat({ label, value, dot, active, onPress }: { label: string; value: string; dot: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.stat, active && styles.statActive]}>
      <View style={styles.statHead}>
        <View style={[styles.statDot, { backgroundColor: dot }]} />
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </Pressable>
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

/** The credit pill: what's owed (red when any of it is overdue), or ₹0. */
function CreditPill({ customer }: { customer: CustomerRow }) {
  if (customer.creditOutstanding == null) return null;
  const owed = customer.creditOutstanding;
  const overdue = customer.creditOverdue ?? 0;
  const tone = overdue > 0 ? CREDIT_TONES.overdue : owed > 0 ? CREDIT_TONES.due : CREDIT_TONES.none;
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <WalletIcon size={14} color={tone.fg} />
      <Text style={[styles.pillText, { color: tone.fg }]} numberOfLines={1}>
        <Trans
          i18nKey={overdue > 0 ? 'customers.creditPillOverdue' : owed > 0 ? 'customers.creditPillDue' : 'customers.creditPill'}
          values={{ amount: formatRupees(owed), overdue: formatRupees(overdue) }}
          components={{ b: <Text style={styles.pillStrong} /> }}
        />
      </Text>
    </View>
  );
}

const CREDIT_TONES = {
  overdue: { bg: '#fef2f2', fg: '#dc2626' },
  due: { bg: '#fff1e6', fg: '#ea580c' },
  none: { bg: '#f1f5f9', fg: '#475569' },
};

function CustomerCard({ customer, onPress }: { customer: CustomerRow; onPress: () => void }) {
  const { t } = useTranslation();
  const name = customerName(customer);
  const phone = customerPhone(customer);
  const tone = avatarTone(customer.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('customers.nameLifetimePurchaseLifetimepurchase', { name, lifetimePurchase: formatRupees(customer.lifetimePurchase) })}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
          <Text style={[styles.avatarText, { color: tone.fg }]}>{customerInitials(customer)}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {phone ? `${phone}  •  ` : ''}
            {customer.idd}
          </Text>
        </View>
        <View style={styles.spend}>
          <Text style={styles.spendValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {formatRupees(Math.round(customer.lifetimePurchase))}
          </Text>
          <Text style={styles.spendLabel}>{t('common.orderCount', { count: customer.orderCount })}</Text>
        </View>
      </View>
      {customer.creditOutstanding != null || customer.lastOrderAt ? (
        <View style={styles.cardBottom}>
          <CreditPill customer={customer} />
          {customer.lastOrderAt ? (
            <Text style={styles.lastOrder} numberOfLines={1}>
              {t('customers.lastOrderLastorderat', { lastOrderAt: formatDay(customer.lastOrderAt) })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flip: { transform: [{ rotate: '180deg' }] },
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 96 },
  headerBlock: { gap: 12, marginBottom: 12 },
  summary: { overflow: 'hidden', padding: 16, borderRadius: 20, backgroundColor: colors.primary, ...shadow.raised },
  summaryGlow: { position: 'absolute', top: -60, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,138,51,0.06)' },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.65)' },
  summaryValue: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.6, color: colors.white },
  newPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(74,222,128,0.12)' },
  newPillText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#bbf7d0' },
  summaryStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.07)' },
  statActive: { borderColor: 'rgba(255,138,51,0.7)', backgroundColor: 'rgba(255,107,0,0.18)' },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statLabel: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  statValue: { marginTop: 3, fontFamily: fonts.extrabold, fontSize: 17, color: colors.white },
  tabs: { gap: 6, padding: 3, borderRadius: 14, backgroundColor: colors.surface, ...shadow.card },
  tab: { height: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  separator: { height: 10 },
  card: { padding: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow.card },
  cardPressed: { backgroundColor: '#fffaf5' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 15.5 },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  spend: { alignItems: 'flex-end', maxWidth: 120 },
  spendValue: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.text },
  spendLabel: { marginTop: 1, fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lastOrder: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted, textAlign: 'right' },
  pill: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full },
  pillText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12 },
  pillStrong: { fontFamily: fonts.bold },
  fab: { position: 'absolute', right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6, height: 50, paddingHorizontal: 18, borderRadius: 25, backgroundColor: colors.secondary, ...shadow.button },
  fabPressed: { backgroundColor: colors.secondaryDark },
  fabText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  pagerText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  pagerAlone: { marginTop: 16, textAlign: 'center' },
  pagerStrong: { fontFamily: fonts.bold, color: colors.text },
  pagerCount: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnPressed: { backgroundColor: colors.background },
});
