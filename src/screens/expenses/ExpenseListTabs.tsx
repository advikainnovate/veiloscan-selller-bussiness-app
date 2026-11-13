import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { openPdf } from '../../lib/documents';
import {
  CREDIT_TERMS,
  day,
  dueText,
  EXPENSE_STATUS,
  expenseStatus,
  FREQUENCY_LABEL,
  money,
  PAYMENT_MODES,
  paymentModeLabel,
  presetRange,
  rangeLabel,
  toAmount,
  todayDay,
  type OpsRange,
} from '../../lib/operations';
import { expensesService, type Expense, type ExpenseStatus, type RecurringExpense, type RecurringFrequency } from '../../services/expenses-service';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Choices, DateField, Field, Input, SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { confirmAction, LinkButton, opsStyles, Pager, RangeChips, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { SupplierFormSheet } from '../../components/expenses/SupplierFormSheet';
import { AlertCircleIcon, FileTextIcon, FilterIcon, PlusIcon, RefreshIcon, TruckIcon, WalletIcon } from '../../components/icons';
import type { RootStackParamList } from '../../navigation/types';
import type { ListPreset } from './ExpensesScreen';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

const SORTS = [
  { value: 'date_desc', get label() { return i18n.t('expenses.newestFirst'); } },
  { value: 'date_asc', get label() { return i18n.t('expenses.oldestFirst'); } },
  { value: 'amount_desc', get label() { return i18n.t('expenses.highestAmount'); } },
  { value: 'amount_asc', get label() { return i18n.t('expenses.lowestAmount'); } },
  { value: 'outstanding_desc', get label() { return i18n.t('expenses.mostOutstanding'); } },
  { value: 'due_asc', get label() { return i18n.t('expenses.dueSoonest'); } },
];

interface Filters {
  categoryId: string;
  supplierId: string;
  paymentMode: string;
  createdBy: string;
  minAmount: string;
  maxAmount: string;
}
const NO_FILTERS: Filters = { categoryId: '', supplierId: '', paymentMode: '', createdBy: '', minAmount: '', maxAmount: '' };

const useStackNav = () => useNavigation<NavigationProp<RootStackParamList>>();

/** Expenses › All Expenses: search, filters, sort and the period's totals. */
export function ExpenseListTab({ storeId, preset }: { storeId: string; preset: ListPreset }) {
  const { t: tr } = useTranslation();
  const navigation = useStackNav();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('store-expenses:create');
  const today = todayDay();
  // Opened for what's owed or a search: every date.
  const [range, setRange] = useState<OpsRange | null>(() => (preset.status || preset.supplierId || preset.search ? null : presetRange(today, 'month')));
  const [status, setStatus] = useState(preset.status ?? '');
  const [paymentType, setPaymentType] = useState('');
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, supplierId: preset.supplierId ?? '' });
  const [draft, setDraft] = useState<Filters>(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState(preset.sort ?? (preset.status === 'OPEN' ? 'due_asc' : 'date_desc'));
  const [queryText, setQueryText] = useState(preset.search ?? '');
  const [search, setSearch] = useState(preset.search ?? '');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const listRef = useRef<FlatList<Expense>>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(queryText.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [queryText]);

  const minAmount = filters.minAmount ? Number(filters.minAmount) : undefined;
  const maxAmount = filters.maxAmount ? Number(filters.maxAmount) : undefined;
  const query = {
    from: range?.from,
    to: range?.to,
    categoryId: filters.categoryId || undefined,
    supplierId: filters.supplierId || undefined,
    status: status || undefined,
    paymentType: paymentType || undefined,
    paymentMode: filters.paymentMode || undefined,
    createdBy: filters.createdBy || undefined,
    minAmount,
    maxAmount,
    search: search || undefined,
    sort,
  };
  const key = JSON.stringify(query);
  useEffect(() => setPage(1), [key]);

  const categories = useFetch(() => expensesService.categories(storeId), [storeId]);
  const suppliers = useFetch(() => expensesService.suppliers(storeId, { includeInactive: 'true' }), [storeId]);
  const contributors = useFetch(() => expensesService.contributors(storeId).catch(() => []), [storeId]);
  const list = useFetch(() => expensesService.list(storeId, { ...query, page, limit: PAGE_SIZE }), [storeId, key, page]);

  // Coming back from an expense that was paid or edited.
  const nav = useNavigation();
  useEffect(() => nav.addListener('focus', () => list.reload()), [nav, list.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterCount = Object.values(filters).filter(Boolean).length;
  const filtered = !!(search || status || paymentType || filterCount);
  const items = list.data?.items ?? [];
  const amountProblem = draft.minAmount && draft.maxAmount && Number(draft.maxAmount) < Number(draft.minAmount) ? tr('expenses.maxCanTBeBelowMin') : '';

  async function exportPdf() {
    setExporting(true);
    try {
      await openPdf(expensesService.listPdfPath(storeId, query), 'expenses.pdf');
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  }

  const header = (
    <View style={styles.headerBlock}>
      <View style={opsStyles.row}>
        {canCreate ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tr('expenses.addExpense')} onPress={() => navigation.navigate('ExpenseForm', {})} style={opsStyles.primaryBtn}>
            <PlusIcon size={15} color={colors.white} strokeWidth={2.4} />
            <Text style={opsStyles.primaryBtnText}>{tr('expenses.addExpense')}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" disabled={exporting || !list.data?.total} onPress={exportPdf} style={[opsStyles.smallBtn, !list.data?.total && styles.disabled]}>
          <FileTextIcon size={15} color={colors.text} />
          <Text style={opsStyles.smallBtnText}>{exporting ? tr('expenses.exporting') : 'PDF'}</Text>
        </Pressable>
      </View>
      {range ? <RangeChips today={today} value={range} onChange={setRange} /> : null}
      <Pressable accessibilityRole="button" onPress={() => setRange(range ? null : presetRange(today, 'month'))} style={[styles.allDates, !range && styles.allDatesOn]}>
        <Text style={[styles.allDatesText, !range && styles.allDatesTextOn]}>{range ? tr('expenses.showAllDates') : tr('expenses.allDatesPickARange')}</Text>
      </Pressable>
      <View style={opsStyles.row}>
        <View style={styles.flex}>
          <SearchBar value={queryText} onChange={setQueryText} placeholder={tr('expenses.searchTitleSupplierBillNoId')} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filterCount ? tr('expenses.filtersFiltercountApplied', { filterCount }) : tr('common.filters')}
          onPress={() => {
            setDraft(filters);
            setFiltersOpen(true);
          }}
          style={[styles.filterBtn, filterCount ? styles.filterBtnOn : null]}
        >
          <FilterIcon size={18} color={filterCount ? colors.secondaryDark : colors.text} />
          {filterCount ? <View style={styles.filterDot} /> : null}
        </Pressable>
      </View>
      <FilterChips
        options={[
          { value: '', label: tr('common.allStatuses') },
          { value: 'OPEN', label: tr('expenses.stillOwed') },
          ...(Object.keys(EXPENSE_STATUS) as ExpenseStatus[]).map(s => ({ value: s, label: EXPENSE_STATUS[s].label })),
        ]}
        value={status}
        onChange={setStatus}
      />
      <FilterChips
        options={[
          { value: '', label: tr('expenses.paidAndCredit') },
          { value: 'PAID', label: tr('common.paid') },
          { value: 'CREDIT', label: tr('common.credit') },
        ]}
        value={paymentType}
        onChange={setPaymentType}
      />
      <FilterChips options={SORTS} value={sort} onChange={setSort} />
      <View style={opsStyles.rowBetween}>
        <Text style={[opsStyles.meta, styles.flex]}>
          {`${range ? rangeLabel(range) : 'All dates'} · `}
          {list.data ? (
            <>
              <Text style={styles.strong}>{`${tr('expenses.expenseCount', { count: list.data.total })} · ${money(list.data.netAmount)}`}</Text>
              {' · '}
              <Trans
                i18nKey="expenses.paidAndOutstanding"
                values={{ paid: money(list.data.paidAmount), outstanding: money(list.data.outstandingAmount) }}
                components={{ owed: <Text style={list.data.outstandingAmount ? styles.owed : undefined} /> }}
              />
            </>
          ) : (
            '…'
          )}
        </Text>
        {filtered ? (
          <LinkButton
            label={tr('expenses.clearFilters')}
            onPress={() => {
              setFilters(NO_FILTERS);
              setStatus('');
              setPaymentType('');
              setQueryText('');
            }}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        ref={listRef}
        data={list.loading || (list.error && !list.data) ? [] : items}
        keyExtractor={e => e.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <ExpenseRow expense={item} onPress={() => navigation.navigate('ExpenseDetail', { id: item.id })} />}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          list.loading ? (
            <ListSkeleton height={84} />
          ) : list.error && !list.data ? (
            <ErrorState message={list.error} onRetry={() => list.reload()} />
          ) : (
            <EmptyState
              icon={WalletIcon}
              title={filtered ? tr('expenses.noExpensesMatch') : tr('expenses.noExpensesInThisPeriod')}
              text={filtered ? tr('expenses.tryOtherFilters') : tr('expenses.recordRentSalariesBillsAndSupplier')}
            />
          )
        }
        ListFooterComponent={
          list.data ? (
            <Pager
              page={page}
              total={list.data.total}
              limit={PAGE_SIZE}
              noun="expenses"
              onPage={p => {
                setPage(p);
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
            />
          ) : undefined
        }
        contentContainerStyle={opsStyles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => list.reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      />
      <Sheet
        visible={filtersOpen}
        title={tr('common.filters')}
        onClose={() => setFiltersOpen(false)}
        footer={
          <View style={opsStyles.row}>
            <Button title={tr('common.reset')} variant="ghost" onPress={() => setDraft(NO_FILTERS)} style={styles.flex} />
            <Button
              title={tr('common.apply')}
              disabled={!!amountProblem}
              onPress={() => {
                setFilters(draft);
                setFiltersOpen(false);
              }}
              style={styles.flex2}
            />
          </View>
        }
      >
        <SelectField
          label={tr('common.category')}
          value={draft.categoryId}
          options={(categories.data ?? []).map(c => ({ value: c.id, label: c.name }))}
          onChange={v => setDraft(d => ({ ...d, categoryId: v }))}
          placeholder={tr('common.allCategories')}
          allowClear={tr('common.allCategories')}
        />
        <SelectField
          label={tr('common.supplier')}
          value={draft.supplierId}
          options={(suppliers.data?.items ?? []).map(s => ({ value: s.id, label: s.name }))}
          onChange={v => setDraft(d => ({ ...d, supplierId: v }))}
          placeholder={tr('expenses.allSuppliers')}
          allowClear={tr('expenses.allSuppliers')}
        />
        <Field label={tr('expenses.paymentMethod')}>
          <Choices options={[{ value: '', label: tr('expenses.any') }, ...PAYMENT_MODES]} value={draft.paymentMode} onChange={v => setDraft(d => ({ ...d, paymentMode: v }))} />
        </Field>
        <SelectField
          label={tr('expenses.addedBy2')}
          value={draft.createdBy}
          options={(contributors.data ?? []).map(u => ({ value: u.id, label: u.name }))}
          onChange={v => setDraft(d => ({ ...d, createdBy: v }))}
          placeholder={tr('expenses.anyone')}
          allowClear={tr('expenses.anyone')}
        />
        <View style={opsStyles.row}>
          <View style={styles.flex}>
            <Field label={tr('expenses.minRs')}>
              <Input value={draft.minAmount} onChangeText={v => setDraft(d => ({ ...d, minAmount: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" accessibilityLabel={tr('expenses.minimumAmount')} />
            </Field>
          </View>
          <View style={styles.flex}>
            <Field label={tr('expenses.maxRs')} error={amountProblem || null}>
              <Input value={draft.maxAmount} onChangeText={v => setDraft(d => ({ ...d, maxAmount: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" accessibilityLabel={tr('expenses.maximumAmount')} />
            </Field>
          </View>
        </View>
      </Sheet>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function ExpenseRow({ expense: e, onPress }: { expense: Expense; onPress: () => void }) {
  const { t } = useTranslation();
  const s = expenseStatus(e.status);
  const due = dueText(e.dueInDays, e.dueDate);
  const cancelled = e.status === 'CANCELLED';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${e.title || e.description || e.categoryName}, ${money(e.amount)}`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={opsStyles.rowBetween}>
        <Text style={[opsStyles.title, styles.flex, cancelled && styles.struck]} numberOfLines={1}>
          {e.title || e.description || e.categoryName}
        </Text>
        <Text style={[opsStyles.amount, cancelled && styles.struck]}>{money(e.amount)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Badge label={s.label} tone={s.tone} />
        <Text style={[opsStyles.meta, styles.flex]} numberOfLines={1}>
          {`${day(e.expenseDate)} · ${e.categoryName}${e.supplierName || e.paidTo ? ` · ${e.supplierName ?? e.paidTo}` : ''}`}
        </Text>
        {e.recurringId ? <RefreshIcon size={12} color={colors.textMuted} /> : null}
        {e.attachmentCount ? <FileTextIcon size={12} color={colors.textMuted} /> : null}
      </View>
      <Text style={opsStyles.meta}>{`${e.idd} · ${e.paymentType === 'CREDIT' ? t('common.credit') : e.paymentMode ? paymentModeLabel(e.paymentMode) : t('common.paid')}${e.returnedAmount ? ` · ${t('expenses.amountReturned', { amount: money(e.returnedAmount) })}` : ''}`}</Text>
      {e.outstandingAmount > 0 ? (
        <Text style={[styles.owedLine, e.dueInDays !== null && e.dueInDays < 0 && opsStyles.danger]}>{[t('expenses.amountOwed', { amount: money(e.outstandingAmount) }), due].filter(Boolean).join(' · ')}</Text>
      ) : null}
      {e.refundDue ? <Text style={[styles.owedLine, opsStyles.success]}>{t('expenses.refunddueRefundDue', { refundDue: money(e.refundDue) })}</Text> : null}
    </Pressable>
  );
}

/** Expenses › Suppliers: what's owed to each, and their ledgers. */
export function SuppliersTab({ storeId }: { storeId: string }) {
  const { t: tr } = useTranslation();
  const navigation = useStackNav();
  const { hasPermission } = useAuth();
  const [queryText, setQueryText] = useState('');
  const [search, setSearch] = useState('');
  const [owing, setOwing] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSearch(queryText.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [queryText]);
  const { data, error, loading, refreshing, reload } = useFetch(
    () => expensesService.suppliers(storeId, { ...(search ? { search } : {}), ...(owing ? { owing: 'true' as const } : {}), ...(inactive ? { includeInactive: 'true' as const } : {}) }),
    [storeId, search, owing, inactive],
  );
  const items = data?.items ?? [];

  return (
    <>
      <FlatList
        data={loading || (error && !data) ? [] : items}
        keyExtractor={s => s.id}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <StatGrid>
              <StatCard icon={WalletIcon} tone="amber" label={tr('expenses.owedToSuppliers')} value={money(data?.totals.outstanding)} sub={tr('expenses.expensesAndStockBills')} loading={loading} />
              <StatCard icon={AlertCircleIcon} tone="red" label={tr('common.overdue')} value={money(data?.totals.overdue)} loading={loading} />
              <StatCard icon={TruckIcon} tone="sky" label={tr('expenses.suppliersOwed')} value={String(data?.totals.owing ?? '—')} loading={loading} />
              <StatCard icon={WalletIcon} tone="emerald" label={tr('expenses.refundsDueToYou')} value={money(data?.totals.refundDue)} sub={tr('expenses.returnsOnPaidBills')} loading={loading} />
            </StatGrid>
            {hasPermission('store-expenses:create') ? (
              <Pressable accessibilityRole="button" accessibilityLabel={tr('expenses.addSupplier')} onPress={() => setAdding(true)} style={[opsStyles.primaryBtn, styles.selfStart]}>
                <PlusIcon size={15} color={colors.white} strokeWidth={2.4} />
                <Text style={opsStyles.primaryBtnText}>{tr('expenses.addSupplier')}</Text>
              </Pressable>
            ) : null}
            <SearchBar value={queryText} onChange={setQueryText} placeholder={tr('expenses.searchNamePhoneGst')} />
            <ToggleRow label={tr('expenses.onlyOwed')} value={owing} onChange={setOwing} />
            <ToggleRow label={tr('expenses.showInactive')} value={inactive} onChange={setInactive} />
          </View>
        }
        renderItem={({ item: s }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('expenses.nameOutstandingOutstanding', { name: s.name, outstanding: money(s.outstanding) })}
            onPress={() => navigation.navigate('SupplierLedger', { id: s.id })}
            style={({ pressed }) => [styles.row, !s.isActive && styles.inactive, pressed && styles.pressed]}
          >
            <View style={opsStyles.rowBetween}>
              <View style={styles.flex}>
                <Text style={opsStyles.title} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={opsStyles.meta} numberOfLines={1}>{[s.idd, s.gstNumber ? tr('expenses.gstNumber', { gst: s.gstNumber }) : null, !s.isActive ? tr('expenses.inactiveLower') : null, s.phone].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={styles.right}>
                <Text style={[opsStyles.amount, s.outstanding ? styles.owed : styles.mutedText]}>{money(s.outstanding)}</Text>
                {s.overdue ? <Text style={[styles.small, opsStyles.danger]}>{tr('expenses.overdueOverdue', { overdue: money(s.overdue) })}</Text> : null}
              </View>
            </View>
            <Text style={opsStyles.meta}>
              {[tr('expenses.billCount', { count: s.bills }), tr('expenses.creditAmount', { amount: money(s.creditTotal) }), tr('expenses.paidAmount', { amount: money(s.paid) }), tr('expenses.returnsAmount', { amount: money(s.returned) }), tr('expenses.lastBillOn', { date: s.lastBillDate ? day(s.lastBillDate) : '—' })].join(' · ')}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          loading ? (
            <ListSkeleton height={80} />
          ) : error && !data ? (
            <ErrorState message={error} onRetry={() => reload()} />
          ) : (
            <EmptyState icon={TruckIcon} title={tr('expenses.noSuppliersYet')} text={tr('expenses.suppliersAreAddedWhenYouRecord')} />
          )
        }
        contentContainerStyle={opsStyles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      />
      <SupplierFormSheet
        storeId={storeId}
        visible={adding}
        supplier={null}
        onClose={() => setAdding(false)}
        onSaved={s => {
          setAdding(false);
          navigation.navigate('SupplierLedger', { id: s.id });
        }}
      />
    </>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={opsStyles.rowBetween}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

const PER_MONTH: Record<RecurringFrequency, number> = { WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };

/** Expenses › Recurring: rent, salaries, electricity… recorded each time they come round. */
export function RecurringTab({ storeId, openList }: { storeId: string; openList: (p: ListPreset) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { data, error, loading, refreshing, reload } = useFetch(() => expensesService.recurring(storeId), [storeId]);
  const [editing, setEditing] = useState<RecurringExpense | 'new' | null>(null);

  async function run(work: () => Promise<unknown>, message: string) {
    try {
      await work();
      toast(message);
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const items = data ?? [];
  const monthly = items.filter(r => r.isActive).reduce((s, r) => s + r.amount * (PER_MONTH[r.frequency] ?? 1), 0);

  return (
    <>
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <View style={styles.intro}>
          <Text style={opsStyles.title}>{t('expenses.recurringExpenses')}</Text>
          <Text style={opsStyles.meta}>
            <Trans i18nKey="expenses.recurringEachRecordedAboutMonthly" values={{ amount: money(Math.round(monthly)) }} components={{ b: <Text style={styles.strong} /> }} />
          </Text>
          {hasPermission('store-expenses:create') ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('expenses.addRecurring')} onPress={() => setEditing('new')} style={[opsStyles.primaryBtn, styles.selfStart]}>
              <PlusIcon size={15} color={colors.white} strokeWidth={2.4} />
              <Text style={opsStyles.primaryBtnText}>{t('expenses.addRecurring')}</Text>
            </Pressable>
          ) : null}
        </View>
        {error && !data ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : loading ? (
          <ListSkeleton height={150} />
        ) : !items.length ? (
          <EmptyState icon={RefreshIcon} title={t('expenses.noRecurringExpenses')} text={t('expenses.setUpMonthlyRentSalariesOr')} />
        ) : (
          items.map(r => (
            <View key={r.id} style={[styles.row, !r.isActive && styles.inactive]}>
              <View style={opsStyles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={opsStyles.title} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={opsStyles.meta}>{`${r.categoryName}${r.supplierName ? ` · ${r.supplierName}` : ''}`}</Text>
                </View>
                <Text style={styles.big}>{money(r.amount)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Badge label={FREQUENCY_LABEL[r.frequency]} tone="orange" />
                <Badge
                  label={r.paymentType === 'CREDIT' ? t('expenses.creditDueInCredittermsdaysDays', { creditTermsDays: r.creditTermsDays ?? 0 }) : t('expenses.paidValue', { value: r.paymentMethod ? paymentModeLabel(r.paymentMethod) : '' })}
                  tone={r.paymentType === 'CREDIT' ? 'blue' : 'green'}
                />
                {!r.isActive ? <Badge label={t('common.paused')} tone="slate" /> : null}
              </View>
              <Text style={opsStyles.meta}>
                {[
                  t('expenses.nextRun', { when: r.isActive && r.nextRunDate ? day(r.nextRunDate) : r.nextRunDate ? t('expenses.pausedLower') : t('expenses.endedLower') }),
                  t('expenses.recordedTimes', { count: r.occurrences, amount: money(r.totalRecorded) }),
                  t('expenses.fromDate', { date: day(r.startDate) }),
                  t('expenses.endsOn', { date: r.endDate ? day(r.endDate) : t('expenses.never') }),
                ].join(' · ')}
              </Text>
              <View style={styles.actions}>
                <LinkButton label={t('common.history')} onPress={() => openList({ search: r.title })} />
                {hasPermission('store-expenses:edit') ? (
                  <>
                    <LinkButton label={t('common.edit')} onPress={() => setEditing(r)} />
                    <LinkButton
                      label={r.isActive ? t('expenses.pause') : t('expenses.resume')}
                      onPress={() => run(() => expensesService.updateRecurring(storeId, r.id, { isActive: !r.isActive }), r.isActive ? t('common.paused') : t('expenses.resumed'))}
                    />
                  </>
                ) : null}
                {hasPermission('store-expenses:delete') ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={async () =>
                      (await confirmAction(t('expenses.deleteTitle', { title: r.title }), t('expenses.expensesAlreadyRecordedStay'), t('common.delete'), true)) &&
                      run(() => expensesService.removeRecurring(storeId, r.id), t('expenses.recurringExpenseDeleted'))
                    }
                    style={styles.pushRight}
                  >
                    <Text style={[styles.actionText, opsStyles.danger]}>{t('common.delete')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <RecurringFormSheet
        storeId={storeId}
        recurring={editing === 'new' ? null : editing}
        visible={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    </>
  );
}

function RecurringFormSheet({
  storeId,
  recurring,
  visible,
  onClose,
  onSaved,
}: {
  storeId: string;
  recurring: RecurringExpense | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const today = todayDay();
  const categories = useFetch(() => (visible ? expensesService.categories(storeId) : Promise.resolve([])), [storeId, visible]);
  const suppliers = useFetch(() => (visible ? expensesService.suppliers(storeId) : Promise.resolve(null)), [storeId, visible]);
  const blank = () => ({
    title: recurring?.title ?? '',
    categoryId: recurring?.categoryId ?? '',
    supplierId: recurring?.supplierId ?? '',
    baseAmount: recurring ? String(recurring.baseAmount) : '',
    taxRate: recurring?.taxRate != null ? String(recurring.taxRate) : '',
    paymentType: recurring?.paymentType ?? 'PAID',
    paymentMethod: recurring?.paymentMethod ?? 'BANK_TRANSFER',
    accountLabel: recurring?.accountLabel ?? '',
    creditTermsDays: String(recurring?.creditTermsDays ?? 7),
    frequency: recurring?.frequency ?? 'MONTHLY',
    startDate: recurring?.startDate ?? today,
    endDate: recurring?.endDate ?? '',
  });
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (visible) {
      setForm(blank());
      setError('');
    }
    // A fresh form each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, recurring]);
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setForm(f => ({ ...f, [k]: v }));
  const isCredit = form.paymentType === 'CREDIT';
  const base = toAmount(form.baseAmount);
  const total = base > 0 ? Math.round(base * 100 + Math.round(base * 100 * (Number(form.taxRate) || 0)) / 100) / 100 : 0;

  async function save() {
    if (!form.title.trim()) return setError(t('expenses.giveItANameEG'));
    if (!form.categoryId) return setError(t('common.pickACategory'));
    if (!(base > 0)) return setError(t('expenses.enterTheAmount'));
    if (form.endDate && form.endDate < form.startDate) return setError(t('common.theEndDateCanTBe'));
    setError('');
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      categoryId: form.categoryId,
      supplierId: form.supplierId || (recurring ? null : undefined),
      baseAmount: base,
      taxRate: form.taxRate ? Number(form.taxRate) : recurring ? null : undefined,
      paymentType: form.paymentType,
      paymentMethod: isCredit ? undefined : form.paymentMethod,
      accountLabel: form.accountLabel.trim() || undefined,
      creditTermsDays: isCredit ? Number(form.creditTermsDays) : undefined,
      endDate: form.endDate || (recurring ? null : undefined),
    };
    try {
      if (recurring) await expensesService.updateRecurring(storeId, recurring.id, payload);
      else await expensesService.createRecurring(storeId, { ...payload, frequency: form.frequency, startDate: form.startDate });
      toast(recurring ? t('expenses.recurringExpenseUpdated') : form.startDate <= today ? t('expenses.setUpDueDatesUpTo') : t('expenses.recurringExpenseSetUp'));
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const fromISO = (s: string) => new Date(`${s}T00:00:00`);
  return (
    <Sheet visible={visible} title={recurring ? t('expenses.editRecurringExpense') : t('expenses.addRecurringExpense')} onClose={onClose} footer={<Button title={t('common.save')} onPress={save} loading={saving} />}>
      <Field label={t('common.name')} required>
        <Input value={form.title} onChangeText={v => set('title', v)} placeholder="e.g. Shop rent, Staff salary – Ravi" maxLength={150} />
      </Field>
      <SelectField label={t('common.category')} required value={form.categoryId} options={(categories.data ?? []).map(c => ({ value: c.id, label: c.name }))} onChange={v => set('categoryId', v)} />
      <SelectField
        label={t('expenses.supplierOptional')}
        value={form.supplierId}
        options={(suppliers.data?.items ?? []).map(s => ({ value: s.id, label: s.name }))}
        onChange={v => set('supplierId', v)}
        placeholder={t('common.none')}
        allowClear={t('expenses.noSupplier')}
      />
      <Field label={t('expenses.amountBeforeGstRs')} required hint={total ? t('expenses.eachTimeTotal', { total: money(total) }) : undefined}>
        <Input value={form.baseAmount} onChangeText={v => set('baseAmount', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={t('expenses.amountBeforeGst')} />
      </Field>
      <Field label="GST">
        <Choices
          options={[{ value: '', label: t('expenses.noGst') }, ...['5', '12', '18', '28'].map(r => ({ value: r, label: `${r}%` }))]}
          value={form.taxRate}
          onChange={v => set('taxRate', v)}
        />
      </Field>
      <Field label={t('expenses.repeats')} hint={recurring ? t('expenses.canTBeChangedOnceSet') : undefined}>
        <Choices
          options={(Object.keys(FREQUENCY_LABEL) as RecurringFrequency[]).map(f => ({ value: f, label: FREQUENCY_LABEL[f] }))}
          value={form.frequency}
          onChange={v => set('frequency', v)}
          disabled={!!recurring}
        />
      </Field>
      <Field label={t('expenses.recordedAs')}>
        <Choices
          options={[
            { value: 'PAID', label: t('expenses.paidAutomatically') },
            { value: 'CREDIT', label: t('expenses.creditBillToPayLater') },
          ]}
          value={form.paymentType}
          onChange={v => set('paymentType', v)}
        />
      </Field>
      {isCredit ? (
        <Field label={t('common.dueAfter')}>
          <Choices options={[0, ...CREDIT_TERMS].map(d => ({ value: String(d), label: d === 0 ? t('expenses.sameDay') : t('common.dDays', { d }) }))} value={form.creditTermsDays} onChange={v => set('creditTermsDays', v)} />
        </Field>
      ) : (
        <Field label={t('common.paidBy')}>
          <Choices options={PAYMENT_MODES} value={form.paymentMethod} onChange={v => set('paymentMethod', v)} />
        </Field>
      )}
      <Field label={t('expenses.paymentAccount')}>
        <Input value={form.accountLabel} onChangeText={v => set('accountLabel', v)} placeholder={t('common.optional2')} maxLength={100} />
      </Field>
      {recurring ? null : (
        <DateField label={t('expenses.firstDate')} required value={form.startDate} onChange={v => set('startDate', v || today)} hint={form.startDate <= today ? t('expenses.datesUpToTodayAreRecorded') : undefined} />
      )}
      <DateField label={t('expenses.endDateOptional')} value={form.endDate} onChange={v => set('endDate', v)} minimumDate={fromISO(form.startDate)} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

/** Expenses › Categories: the store's own, next to the built-in ones. */
export function CategoriesTab({ storeId }: { storeId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { data, error, loading, refreshing, reload } = useFetch(() => expensesService.categories(storeId), [storeId]);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await work();
      toast(message);
      reload();
      return true;
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const categories = data ?? [];
  const own = categories.filter(c => !c.isSystem);
  return (
    <ScrollView
      contentContainerStyle={opsStyles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
    >
      {error && !data ? <ErrorState message={error} onRetry={() => reload()} /> : null}
      <View style={styles.card}>
        <Text style={opsStyles.title}>{t('expenses.yourCategories')}</Text>
        <Text style={opsStyles.meta}>{t('expenses.addCategoriesThatFitYourShop')}</Text>
        {hasPermission('store-expenses:create') ? (
          <View style={[opsStyles.row, styles.addRow]}>
            <View style={styles.flex}>
              <Input value={name} onChangeText={setName} placeholder={t('expenses.newCategoryEGSecurityGuard')} maxLength={80} accessibilityLabel={t('expenses.newCategoryName')} />
            </View>
            <Button
              title={t('common.add')}
              disabled={busy || !name.trim()}
              onPress={async () => {
                if (await run(() => expensesService.createCategory(storeId, name.trim()), t('expenses.categoryAdded'))) setName('');
              }}
              style={styles.addBtn}
            />
          </View>
        ) : null}
        {loading ? (
          <ListSkeleton rows={2} height={44} />
        ) : !own.length ? (
          <Text style={opsStyles.muted}>{t('expenses.noneYet')}</Text>
        ) : (
          own.map((c, i) => (
            <View key={c.id} style={[opsStyles.rowBetween, i > 0 && opsStyles.listRow, styles.catRow]}>
              <Text style={[styles.flex, styles.catName]}>
                {c.name}
                <Text style={opsStyles.muted}>{` · ${t('expenses.expenseCount', { count: c.expenseCount })}`}</Text>
              </Text>
              {hasPermission('store-expenses:edit') ? <LinkButton label={t('expenses.rename')} onPress={() => setRenaming({ id: c.id, name: c.name })} /> : null}
              {hasPermission('store-expenses:delete') ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('expenses.deleteName', { name: c.name })}
                  disabled={busy || c.expenseCount > 0}
                  onPress={async () => (await confirmAction(t('expenses.deleteName2', { name: c.name }), undefined, t('common.delete'), true)) && run(() => expensesService.removeCategory(storeId, c.id), t('expenses.categoryDeleted'))}
                  style={c.expenseCount > 0 ? styles.disabled : undefined}
                >
                  <Text style={[styles.actionText, opsStyles.danger]}>{t('common.delete')}</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
        {own.some(c => c.expenseCount > 0) ? <Text style={opsStyles.muted}>{t('expenses.aCategoryInUseCanT')}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={opsStyles.title}>{t('expenses.builtInCategories')}</Text>
        <Text style={opsStyles.meta}>{t('expenses.sharedByEveryStoreManagedBy')}</Text>
        <View style={[opsStyles.chipRow, styles.addRow]}>
          {categories
            .filter(c => c.isSystem)
            .map(c => (
              <View key={c.id} style={styles.builtIn}>
                <Text style={styles.builtInText}>{`${c.name}${c.expenseCount ? ` · ${c.expenseCount}` : ''}`}</Text>
              </View>
            ))}
        </View>
        <Text style={opsStyles.muted}>{t('expenses.stockBoughtForResaleIsnT')}</Text>
      </View>

      <Sheet
        visible={!!renaming}
        title={t('expenses.renameCategory')}
        onClose={() => setRenaming(null)}
        footer={
          <Button
            title={t('expenses.rename')}
            disabled={!renaming?.name.trim()}
            onPress={async () => {
              const r = renaming!;
              if (await run(() => expensesService.renameCategory(storeId, r.id, r.name.trim()), t('expenses.categoryRenamed'))) setRenaming(null);
            }}
          />
        }
      >
        <Field label={t('expenses.categoryName')} required>
          <Input value={renaming?.name ?? ''} onChangeText={v => setRenaming(r => (r ? { ...r, name: v } : r))} maxLength={80} accessibilityLabel={t('expenses.categoryName')} />
        </Field>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flex2: { flex: 2 },
  headerBlock: { gap: 12, marginBottom: 4 },
  separator: { height: 10 },
  disabled: { opacity: 0.4 },
  selfStart: { alignSelf: 'flex-start' },
  allDates: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  allDatesOn: { backgroundColor: colors.secondary },
  allDatesText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  allDatesTextOn: { color: colors.white },
  filterBtn: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterBtnOn: { borderColor: colors.secondarySoft, backgroundColor: colors.secondaryLight },
  filterDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  strong: { fontFamily: fonts.semibold, color: colors.text },
  owed: { color: colors.warningDark, fontFamily: fonts.semibold },
  mutedText: { color: colors.textMuted },
  row: { gap: 4, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  pressed: { backgroundColor: '#fffaf5' },
  inactive: { opacity: 0.6 },
  struck: { color: colors.textMuted, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  owedLine: { fontFamily: fonts.medium, fontSize: 12, color: colors.warningDark },
  right: { alignItems: 'flex-end' },
  small: { fontFamily: fonts.medium, fontSize: 11.5 },
  toggleLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  intro: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  big: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pushRight: { marginLeft: 'auto' },
  actionText: { fontFamily: fonts.semibold, fontSize: 13 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
  card: { gap: 6, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  addRow: { marginTop: 8, marginBottom: 4 },
  addBtn: { height: 46, paddingHorizontal: 18 },
  catRow: { paddingVertical: 10 },
  catName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  builtIn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.background },
  builtInText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
});
