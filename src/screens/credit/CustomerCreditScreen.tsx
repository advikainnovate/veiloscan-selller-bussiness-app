import React, { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatNumber, formatRupees } from '../../lib/format';
import { formatDay } from '../../lib/date';
import { shortRupees } from '../../lib/sales-report';
import { CREDIT_FILTERS, creditStatus, dueHint, isOpenCredit, type CreditFilter } from '../../lib/customer-credit';
import { customerCreditService, type CreditRow } from '../../services/customer-credit-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { ReceivePaymentSheet, type ReceivableCredit } from '../../components/credit/CreditSheets';
import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  PhoneIcon,
  PlusIcon,
  UsersIcon,
  WalletIcon,
  type IconProps,
} from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

const AVATAR_TONES = [
  ['#ede9fe', '#6d28d9'],
  ['#e0f2fe', '#0369a1'],
  ['#ffe4e6', '#be123c'],
  ['#d1fae5', '#047857'],
  ['#fef3c7', '#b45309'],
  ['#e0e7ff', '#4338ca'],
  ['#ccfbf1', '#0f766e'],
];

/** Initials on a colour picked from the name, so a customer keeps one colour (as on the panel). */
function CreditAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const [bg, fg] = AVATAR_TONES[hash % AVATAR_TONES.length];
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { color: fg }]}>{initials}</Text>
    </View>
  );
}

/** Sales › Customer Credit: what customers owe, collecting it and following up. */
export function CustomerCreditScreen({ navigation }: ScreenProps<'CustomerCredit'>) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('customer-credit:manage');
  const canCreateOrder = hasPermission('orders:manage');

  const [filter, setFilter] = useState<CreditFilter>('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [receiving, setReceiving] = useState<ReceivableCredit | null>(null);
  const listRef = useRef<FlatList<CreditRow>>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => setPage(1), [filter, search]);

  const summary = useFetch(() => (allowed ? customerCreditService.summary() : Promise.resolve(null)), [allowed]);
  const list = useFetch(
    () =>
      allowed
        ? customerCreditService.list({ filter, page, limit: PAGE_SIZE, ...(search ? { search } : {}) })
        : Promise.resolve({ items: [], total: 0 }),
    [allowed, filter, search, page],
  );
  // Tab counts for the current search (one tiny request per tab, as on the panel).
  const counts = useFetch(
    () =>
      allowed
        ? Promise.all(
            CREDIT_FILTERS.map(f =>
              customerCreditService.list({ filter: f.value, page: 1, limit: 1, ...(search ? { search } : {}) }).then(res => [f.value, res.total] as const),
            ),
          ).then(entries => Object.fromEntries(entries) as Record<CreditFilter, number>)
        : Promise.resolve(null),
    [allowed, search],
  );

  const { reload: reloadSummary } = summary;
  const { reload: reloadList } = list;
  const { reload: reloadCounts } = counts;
  const reloadAll = useCallback(
    (asRefresh = false) => {
      reloadSummary();
      reloadList(asRefresh);
      reloadCounts();
    },
    [reloadSummary, reloadList, reloadCounts],
  );

  // Payments may have been recorded on a credit's page.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current && allowed) reloadAll();
      focused.current = true;
    }, [allowed, reloadAll]),
  );

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('common.customerCredit')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.customerCredit')} icon={WalletIcon} allowed={false} />
      </View>
    );
  }

  const s = summary.data;
  const collectedPct = s && s.totalCredit > 0 ? Math.round((s.totalCollected / s.totalCredit) * 100) : 0;
  const owing = s?.customersWithOutstanding ?? 0;
  const v = (n: number | undefined) => (summary.loading ? '…' : n == null ? '—' : shortRupees(n));
  const dueSoon = counts.data?.due_soon ?? 0;

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goToPage = (next: number) => {
    setPage(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const openReceive = (row: CreditRow) =>
    setReceiving({
      id: row.id,
      idd: row.idd,
      customerName: row.customerName,
      orderNumber: row.orderNumber,
      outstandingAmount: row.outstandingAmount,
      dueDate: row.dueDate,
    });

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={styles.pageTitle} accessibilityRole="header">
            {t('common.customerCredit')}</Text>
          <Text style={styles.pageSubtitle}>{t('credit.manageCustomerCreditCollectPaymentsTrack')}</Text>
        </View>
      </View>
      {canCreateOrder ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('credit.addCreditSale')}
          onPress={() => navigation.navigate('CreateOrder')}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        >
          <PlusIcon size={16} color={colors.white} strokeWidth={2.4} />
          <Text style={styles.addText}>{t('credit.addCreditSale')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.cards}>
        <SummaryCard icon={WalletIcon} tone={['#f5f3ff', '#7c3aed']} label={t('credit.totalCredit')} value={v(s?.totalCredit)} hint={t('credit.allCreditGiven')} />
        <SummaryCard icon={CheckCircleIcon} tone={['#ecfdf5', '#059669']} label={t('common.collected')} value={v(s?.totalCollected)} hint={s ? t('credit.collectedpctPercentOfTotalCredit', { collectedPct }) : undefined} />
        <SummaryCard
          icon={ClockIcon}
          tone={['#fff7ed', '#ea580c']}
          label={t('common.outstanding')}
          value={v(s?.totalOutstanding)}
          hint={s ? t('common.customerCount', { count: owing }) : undefined}
        />
        <SummaryCard
          icon={CalendarIcon}
          tone={['#fffbeb', '#d97706']}
          label={t('credit.dueThisWeek')}
          value={v(s?.dueThisWeek)}
          hint={counts.data ? t('credit.creditCount', { count: dueSoon }) : undefined}
        />
        <SummaryCard
          icon={AlertCircleIcon}
          tone={['#fef2f2', '#dc2626']}
          label={t('common.overdue')}
          value={v(s?.overdueAmount)}
          hint={s ? t('credit.creditCount', { count: s.overdueCount }) : undefined}
        />
        <SummaryCard
          icon={UsersIcon}
          tone={['#f0f9ff', '#0284c7']}
          label={t('credit.customersOwing')}
          value={summary.loading ? '…' : String(owing)}
          hint={t('credit.activeCreditCustomers')}
        />
      </View>

      <SearchBar value={query} onChange={setQuery} placeholder={t('credit.searchCustomerPhoneOrderIdOr')} />
      <FilterChips
        options={CREDIT_FILTERS.map(f => ({ value: f.value, label: f.label, count: counts.data?.[f.value] }))}
        value={filter}
        onChange={value => setFilter(value as CreditFilter)}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title={t('common.customerCredit')} onBack={navigation.goBack} />
      <FlatList
        ref={listRef}
        data={list.loading || (list.error && !list.data) ? [] : rows}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CreditCard
            row={item}
            onPress={() => navigation.navigate('CreditDetail', { id: item.id })}
            onCollect={() => openReceive(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          list.loading ? (
            <ListSkeleton height={150} />
          ) : list.error && !list.data ? (
            <ErrorState message={list.error} onRetry={() => list.reload()} />
          ) : (
            <EmptyState
              icon={WalletIcon}
              title={search || filter !== 'all' ? t('credit.noCreditsMatch') : t('credit.noCustomerCreditYet')}
              text={
                search || filter !== 'all'
                  ? t('common.tryAnotherFilterOrSearchTerm')
                  : t('credit.whenACustomerPaysPartOf')
              }
            />
          )
        }
        ListFooterComponent={
          rows.length ? (
            <View style={styles.pager}>
              <Text style={styles.pagerText}>
                {t('credit.showingRangeOfCredits', { count: total, from: formatNumber((page - 1) * PAGE_SIZE + 1), to: formatNumber(Math.min(page * PAGE_SIZE, total)), total: formatNumber(total) })}
              </Text>
              {pages > 1 ? (
                <>
                  <PageButton label={t('common.previousPage')} disabled={page <= 1} onPress={() => goToPage(page - 1)} flip />
                  <Text style={styles.pagerCount}>{`${page} / ${pages}`}</Text>
                  <PageButton label={t('common.nextPage')} disabled={page >= pages} onPress={() => goToPage(page + 1)} />
                </>
              ) : null}
            </View>
          ) : undefined
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={list.refreshing} onRefresh={() => reloadAll(true)} tintColor={colors.secondary} colors={[colors.secondary]} />
        }
      />

      <ReceivePaymentSheet
        credit={receiving}
        onClose={() => setReceiving(null)}
        onReceived={() => {
          setReceiving(null);
          reloadAll();
        }}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
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
  hint?: string;
}) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { backgroundColor: tone[0] }]}>
          <Icon size={16} color={tone[1]} />
        </View>
        <Text style={styles.cardLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
      <Text style={styles.cardHint} numberOfLines={1}>
        {hint ?? ' '}
      </Text>
    </View>
  );
}

function CreditCard({ row, onPress, onCollect }: { row: CreditRow; onPress: () => void; onCollect: () => void }) {
  const { t } = useTranslation();
  const status = creditStatus(row.status);
  const hint = dueHint(row);
  const open = row.outstandingAmount > 0 && isOpenCredit(row.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('credit.customernameLabelOutstandingamountOutstanding', { customerName: row.customerName, label: status.label, outstandingAmount: formatRupees(row.outstandingAmount) })}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowTop}>
        <CreditAvatar name={row.customerName} />
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>
            {row.customerName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {`${row.orderNumber} · ${row.idd}`}
          </Text>
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>

      <View style={styles.amounts}>
        <Amount label={t('common.credit')} value={row.creditAmount} bg={colors.background} fg={colors.text} />
        <Amount label={t('common.paid')} value={row.paidAmount} bg="#ecfdf5" fg="#047857" />
        <Amount label={t('common.due')} value={row.outstandingAmount} bg="#fff7ed" fg="#c2410c" strong />
      </View>

      <View style={styles.rowBottom}>
        <View style={styles.flex}>
          {row.status === 'PAID' || row.status === 'CANCELLED' ? (
            <Text style={styles.due}>{row.lastPaymentDate ? t('credit.lastPaidLastpaymentdate', { lastPaymentDate: formatDay(row.lastPaymentDate) }) : '—'}</Text>
          ) : (
            <>
              <Text style={styles.due}>{t('credit.dueDuedate', { dueDate: formatDay(row.dueDate) })}</Text>
              {hint ? (
                <Text style={[styles.hint, (row.overdueDays > 0 || (row.dueInDays ?? 99) <= 7) && styles.hintUrgent]}>{hint}</Text>
              ) : null}
            </>
          )}
        </View>
        {row.customerPhone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('credit.callCustomername', { customerName: row.customerName })}
            hitSlop={6}
            onPress={() => Linking.openURL(`tel:${row.customerPhone}`)}
            style={styles.iconBtn}
          >
            <PhoneIcon size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {open ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('credit.collectFromCustomername', { customerName: row.customerName })}
            onPress={onCollect}
            style={({ pressed }) => [styles.collect, pressed && styles.addBtnPressed]}
          >
            <Text style={styles.collectText}>{t('credit.collect')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function Amount({ label, value, bg, fg, strong }: { label: string; value: number; bg: string; fg: string; strong?: boolean }) {
  return (
    <View style={[styles.amount, { backgroundColor: bg }]}>
      <Text style={[styles.amountLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.amountValue, { color: fg }, strong && styles.amountStrong]} numberOfLines={1} adjustsFontSizeToFit>
        {shortRupees(value)}
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
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    ...shadow.button,
  },
  addBtnPressed: { backgroundColor: colors.secondaryDark },
  addText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 15, color: colors.text },
  cardValue: { marginTop: 10, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, letterSpacing: -0.3 },
  cardHint: { marginTop: 2, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary },
  separator: { height: 10 },
  row: { padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  rowPressed: { backgroundColor: '#fffaf5' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, fontSize: 14 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  meta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  amounts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  amount: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 8 },
  amountLabel: { fontFamily: fonts.regular, fontSize: 11.5, opacity: 0.85 },
  amountValue: { marginTop: 1, fontFamily: fonts.semibold, fontSize: 14 },
  amountStrong: { fontFamily: fonts.extrabold },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  due: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  hintUrgent: { fontFamily: fonts.semibold, color: colors.error },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  collect: { height: 36, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  collectText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
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
});
