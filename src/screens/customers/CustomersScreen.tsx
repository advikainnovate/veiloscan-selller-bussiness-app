import React, { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatNumber, formatRupees } from '../../lib/format';
import { formatDay } from '../../lib/date';
import { customerEmail, customerInitials, customerName, customerPhone } from '../../lib/customers';
import { customerService, type CustomerRow, type CustomerView } from '../../services/customer-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Button } from '../../components/ui/Button';
import { Gradient } from '../../components/ui/Gradient';
import { Sheet } from '../../components/ui/Sheet';
import { CustomersArt } from '../../components/home/Illustrations';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import {
  ChevronRightIcon,
  LayersIcon,
  PhoneIcon,
  PlusIcon,
  RupeeIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from '../../components/icons';
import type { TabScreenProps } from '../../navigation/types';

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
  const { hasPermission } = useAuth();
  const allowed = hasPermission('customers:manage');
  const [view, setView] = useState<CustomerView>('all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
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
        <AppHeader title="Customers" />
        <ComingSoon label="Customers" icon={UsersIcon} allowed={false} />
      </View>
    );
  }

  const stats = summary.data;
  // Credit figures come back null for roles without Customer Credit.
  const showCredit = stats?.withCredit != null;
  const value = (n: number | null | undefined, format = formatNumber) => (n == null ? '—' : format(n));
  const tabs: { key: CustomerView; label: string; count?: number }[] = [
    { key: 'all', label: 'All Customers', count: stats?.total },
    ...(showCredit ? [{ key: 'credit' as const, label: 'With Credit', count: stats?.withCredit ?? undefined }] : []),
    { key: 'top', label: 'Top Customers', count: stats?.top },
  ];

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, total);
  const searching = !!debounced || view !== 'all';

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={styles.pageTitle} accessibilityRole="header">
            Customers
          </Text>
          <Text style={styles.pageSubtitle}>Manage your customers, credit and purchase history</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add Customer"
          onPress={() => setAdding(true)}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <PlusIcon size={16} color={colors.white} strokeWidth={2.4} />
          <Text style={styles.addText}>Add Customer</Text>
        </Pressable>
      </View>

      <View style={styles.banner}>
        <Gradient colors={['#031329', '#0b2a55', '#163f78']} direction="diagonal" borderRadius={radius.xl} />
        <View style={styles.bannerRing} />
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerTitle}>
            Know Your{'\n'}
            <Text style={styles.bannerAccent}>Customers Better.</Text>
          </Text>
          <Text style={styles.bannerText}>View details, purchase history, credit and more in one place.</Text>
        </View>
        <View style={styles.bannerArt}>
          <CustomersArt width={112} />
        </View>
      </View>

      <View style={styles.tiles}>
        <Tile icon={UsersIcon} tone={['#dcfce7', '#16a34a']} value={value(stats?.total)} label="Total Customers" />
        <Tile icon={UserPlusIcon} tone={['#eaf2fb', '#2563eb']} value={value(stats?.newThisMonth)} label="New (This Month)" />
        {showCredit ? (
          <>
            <Tile icon={LayersIcon} tone={['#fff1e6', '#ff6b00']} value={value(stats?.withCredit)} label="With Credit" />
            <Tile
              icon={RupeeIcon}
              tone={['#fff1e6', '#ff6b00']}
              value={value(stats?.creditOutstanding, n => formatRupees(Math.round(n)))}
              label="Total Credit"
            />
          </>
        ) : null}
      </View>

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

      <SearchBar value={query} onChange={setQuery} placeholder="Search by name, mobile or customer ID" />
    </View>
  );

  const footer =
    rows.length && total > PAGE_SIZE ? (
      <View style={styles.pager}>
        <Text style={styles.pagerText}>
          Showing{' '}
          <Text style={styles.pagerStrong}>
            {formatNumber(first)}–{formatNumber(last)}
          </Text>{' '}
          of <Text style={styles.pagerStrong}>{formatNumber(total)}</Text> customers
        </Text>
        <PageButton label="Previous page" disabled={page <= 1} onPress={() => goToPage(page - 1)} flip />
        <Text style={styles.pagerCount}>{`${page} / ${pages}`}</Text>
        <PageButton label="Next page" disabled={page >= pages} onPress={() => goToPage(page + 1)} />
      </View>
    ) : rows.length ? (
      <Text style={[styles.pagerText, styles.pagerAlone]}>
        Showing <Text style={styles.pagerStrong}>{formatNumber(total)}</Text> customer{total === 1 ? '' : 's'}
      </Text>
    ) : undefined;

  return (
    <View style={styles.screen}>
      <AppHeader brand />
      <FlatList
        ref={listRef}
        data={list.loading || (list.error && !list.data) ? [] : rows}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <CustomerCard customer={item} onPress={() => setSelected(item)} />}
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
              title={searching ? 'No customers match' : 'No customers yet'}
              text={
                debounced
                  ? 'Try another name, mobile number or customer ID.'
                  : view === 'credit'
                    ? 'No customer owes you money right now.'
                    : 'Customers show up here once they order from your store.'
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

      <CustomerSheet customer={selected} onClose={() => setSelected(null)} />

      {/* Customers are saved with their first order; there is no separate sign-up. */}
      <Sheet
        visible={adding}
        title="Add a customer"
        subtitle="Customers are saved when you bill them. Start a new order, choose New customer and enter their name and mobile number."
        onClose={() => setAdding(false)}
        footer={
          <Button
            title="Start a new order"
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

function Tile({ icon: Icon, tone, value, label }: { icon: ComponentType<IconProps>; tone: [string, string]; value: string; label: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.tileIcon, { backgroundColor: tone[0] }]}>
        <Icon size={20} color={tone[1]} />
      </View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
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
        Credit: <Text style={styles.pillStrong}>{formatRupees(owed)}</Text>
        {overdue > 0 ? ` (Overdue ${formatRupees(overdue)})` : owed > 0 ? ' (Due)' : ''}
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
  const name = customerName(customer);
  const phone = customerPhone(customer);
  const tone = avatarTone(customer.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, lifetime purchase ${formatRupees(customer.lifetimePurchase)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
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
        <CreditPill customer={customer} />
      </View>
      <View style={styles.spend}>
        <Text style={styles.spendValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {formatRupees(Math.round(customer.lifetimePurchase))}
        </Text>
        <Text style={styles.spendLabel}>Lifetime Purchase</Text>
      </View>
      <ChevronRightIcon size={18} color={colors.text} strokeWidth={2.2} />
    </Pressable>
  );
}

/** A customer's contact details and figures, with a call button. */
function CustomerSheet({ customer, onClose }: { customer: CustomerRow | null; onClose: () => void }) {
  // Keep the last customer while the sheet slides away.
  const last = useRef(customer);
  if (customer) last.current = customer;
  const shown = customer ?? last.current;
  if (!shown) return null;

  const phone = customerPhone(shown);
  const email = customerEmail(shown.email);
  const rows: [string, string][] = [
    ['Mobile', phone ?? '—'],
    ['Email', email ?? 'No email (store customer)'],
    ['Orders', formatNumber(shown.orderCount)],
    ['Lifetime purchase', formatRupees(shown.lifetimePurchase)],
    ['Last order', formatDay(shown.lastOrderAt)],
    ...(shown.creditOutstanding != null
      ? ([['Credit due', formatRupees(shown.creditOutstanding)]] as [string, string][])
      : []),
    ...(shown.creditOverdue ? ([['Overdue', formatRupees(shown.creditOverdue)]] as [string, string][]) : []),
    ['Customer since', formatDay(shown.createdAt)],
  ];

  return (
    <Sheet
      visible={!!customer}
      title={customerName(shown)}
      subtitle={shown.idd}
      onClose={onClose}
      footer={
        phone ? (
          <Button
            title="Call customer"
            icon={<PhoneIcon size={18} color={colors.white} />}
            onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)}
          />
        ) : undefined
      }
    >
      <View style={styles.details}>
        {rows.map(([label, text], i) => (
          <View key={label} style={[styles.detailRow, i > 0 && styles.detailDivider]}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {text}
            </Text>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flip: { transform: [{ rotate: '180deg' }] },
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 32 },
  headerBlock: { gap: 14, marginBottom: 14 },
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
  banner: {
    minHeight: 132,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
    paddingLeft: 20,
  },
  bannerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -50,
    top: -40,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bannerCopy: { flex: 1, paddingVertical: 18 },
  bannerTitle: { fontSize: 22, lineHeight: 26, fontFamily: fonts.extrabold, color: colors.white, letterSpacing: -0.4 },
  bannerAccent: { color: '#ffb020' },
  bannerText: { marginTop: 8, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.9)' },
  bannerArt: { paddingRight: 12, alignSelf: 'center' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileValue: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.text },
  tileLabel: { marginTop: 2, fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, color: colors.textSecondary, textAlign: 'center' },
  tabs: { gap: 8, paddingVertical: 2 },
  tab: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  tabText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  tabTextActive: { color: colors.white },
  separator: { height: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  cardPressed: { backgroundColor: '#fffaf5' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 18 },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  pill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12 },
  pillStrong: { fontFamily: fonts.bold },
  spend: {
    minWidth: 92,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#ecfdf3',
  },
  spendValue: { fontFamily: fonts.extrabold, fontSize: 15, color: '#15803d' },
  spendLabel: { marginTop: 1, fontFamily: fonts.regular, fontSize: 10.5, color: colors.textSecondary },
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
  details: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  detailLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  detailValue: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, textAlign: 'right' },
});
