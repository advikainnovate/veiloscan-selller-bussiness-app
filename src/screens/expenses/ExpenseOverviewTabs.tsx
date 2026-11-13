import React, { useState } from 'react';
import { monthShort } from '../../lib/date';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { openPdf } from '../../lib/documents';
import { CHART_COLORS } from '../../lib/sales-report';
import { day, dueText, expenseStatus, money, paymentModeLabel, presetRange, rangeLabel, todayDay, type OpsRange } from '../../lib/operations';
import { expensesService, type ReportPeriod } from '../../services/expenses-service';
import { Badge } from '../../components/ui/Badge';
import { ErrorState } from '../../components/list/ListParts';
import { Ring } from '../../components/reports/SalesCharts';
import { BarList, ComboChart } from '../../components/operations/OpsCharts';
import { LinkButton, NoData, OpsCard, opsStyles, Placeholder, RangeChips, StatCard, StatGrid } from '../../components/operations/OpsParts';
import { AlertCircleIcon, CalendarIcon, ClockIcon, CreditCardIcon, FileTextIcon, LayersIcon, PercentIcon, PlusIcon, RefreshIcon, WalletIcon } from '../../components/icons';
import type { ExpenseTab, RootStackParamList } from '../../navigation/types';
import type { ListPreset } from './ExpensesScreen';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const monthLabel = (ym: string) => `${monthShort(Number(ym.slice(5, 7)) - 1)} ${ym.slice(2, 4)}`;

/** Expenses › Dashboard: the period's totals, what's owed now, trend, categories and what's due. */
export function ExpenseDashboardTab({ storeId, openList, openTab }: { storeId: string; openList: (p: ListPreset) => void; openTab: (t: ExpenseTab) => void }) {
  const { t: tr } = useTranslation();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { hasPermission } = useAuth();
  const today = todayDay();
  const [range, setRange] = useState<OpsRange>(() => presetRange(today, 'month'));
  const { data, error, loading, refreshing, reload } = useFetch(() => expensesService.dashboard(storeId, { from: range.from, to: range.to }), [storeId, range.from, range.to]);

  const t = data?.totals;
  const o = data?.owed;
  const months = data?.months ?? [];

  return (
    <ScrollView
      contentContainerStyle={opsStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
    >
      {hasPermission('store-expenses:create') ? (
        <View style={opsStyles.row}>
          <Pressable accessibilityRole="button" onPress={() => openTab('recurring')} style={opsStyles.smallBtn}>
            <CalendarIcon size={15} color={colors.text} />
            <Text style={opsStyles.smallBtnText}>{tr('expenses.recurring')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('expenses.addExpense')} onPress={() => navigation.navigate('ExpenseForm', {})} style={opsStyles.primaryBtn}>
            <PlusIcon size={15} color={colors.white} strokeWidth={2.4} />
            <Text style={opsStyles.primaryBtnText}>{tr('expenses.addExpense')}</Text>
          </Pressable>
        </View>
      ) : null}
      <RangeChips today={today} value={range} onChange={setRange} />
      {error && !data ? <ErrorState message={error} onRetry={() => reload()} /> : null}

      <Text style={opsStyles.sectionLabel}>{rangeLabel(range).toUpperCase()}</Text>
      <StatGrid>
        <StatCard icon={WalletIcon} tone="orange" label={tr('common.totalExpenses')} value={money(t?.totalExpenses)} sub={t ? `${tr('expenses.billCount', { count: t.count })} · ${tr('expenses.netOfReturns')}` : null} loading={loading} />
        <StatCard icon={WalletIcon} tone="emerald" label={tr('expenses.paidExpenses')} value={money(t?.paidExpenses)} sub={tr('expenses.paidWhenRecorded')} loading={loading} />
        <StatCard icon={CreditCardIcon} tone="sky" label={tr('expenses.creditExpenses')} value={money(t?.creditExpenses)} sub={tr('expenses.boughtOnCredit')} loading={loading} />
        <StatCard icon={LayersIcon} tone="slate" label={tr('common.returns')} value={money(t?.returns)} sub={tr('expenses.creditNotes')} loading={loading} />
      </StatGrid>

      <Text style={opsStyles.sectionLabel}>{tr('expenses.owedRightNow')}</Text>
      <StatGrid>
        <StatCard
          icon={WalletIcon}
          tone="amber"
          label={tr('common.outstanding')}
          value={money(o?.outstanding)}
          sub={o ? tr('expenses.openBillCount', { count: o.openCount }) : null}
          loading={loading}
          onPress={() => openList({ status: 'OPEN' })}
        />
        <StatCard
          icon={AlertCircleIcon}
          tone="red"
          label={tr('common.overdue')}
          value={money(o?.overdue)}
          negative={!!o?.overdue}
          sub={o ? tr('expenses.billCount', { count: o.overdueCount }) : null}
          loading={loading}
          onPress={() => openList({ status: 'OVERDUE' })}
        />
        <StatCard
          icon={ClockIcon}
          tone="sky"
          label={tr('expenses.partiallyPaid')}
          value={money(o?.partiallyPaid)}
          sub={o ? `${tr('expenses.billCount', { count: o.partiallyPaidCount })} · ${tr('expenses.stillOwed')}` : null}
          loading={loading}
          onPress={() => openList({ status: 'PARTIALLY_PAID' })}
        />
        <StatCard
          icon={CalendarIcon}
          tone="violet"
          label={tr('expenses.dueIn7Days')}
          value={money(o?.dueThisWeek)}
          sub={o?.refundsDue ? tr('expenses.refundsdueRefundsDueToYou', { refundsDue: money(o.refundsDue) }) : tr('expenses.upcomingPayments')}
          loading={loading}
        />
      </StatGrid>
      {o?.stockBillsOutstanding ? (
        <Text style={opsStyles.meta}>
          <Trans
            i18nKey="expenses.plusOwedOnStockBillsSeeSuppliers"
            values={{ amount: money(o.stockBillsOutstanding) }}
            components={{ link: <Text style={styles.inlineLink} onPress={() => openTab('suppliers')} /> }}
          />
        </Text>
      ) : null}

      <OpsCard title={tr('expenses.monthlyExpenseSummary')} description={tr('expenses.last12MonthsExpensesNetOf')}>
        {loading ? (
          <Placeholder height={240} />
        ) : (
          <ComboChart
            labels={months.map(m => monthLabel(m.month))}
            fullLabels={months.map(m => `${monthLabel(m.month)} · ${tr('expenses.billCount', { count: m.count })}`)}
            lines={[
              { key: 'total', label: tr('common.expenses'), color: CHART_COLORS[0], values: months.map(m => m.total) },
              { key: 'payments', label: tr('expenses.paymentsMade'), color: CHART_COLORS[1], values: months.map(m => m.payments) },
              { key: 'credit', label: tr('common.onCredit'), color: CHART_COLORS[3], values: months.map(m => m.credit) },
            ]}
          />
        )}
      </OpsCard>

      <OpsCard title={tr('common.byCategory')} description={rangeLabel(range)}>
        {loading ? (
          <Placeholder />
        ) : data?.byCategory.length ? (
          <BarList rows={data.byCategory.map(c => ({ label: c.name, value: c.amount, sub: `${c.count}` }))} />
        ) : (
          <NoData text={tr('expenses.noExpensesInThisPeriod2')} />
        )}
      </OpsCard>

      <OpsCard
        title={tr('expenses.upcomingAndOverduePayments')}
        description={tr('expenses.creditBillsWithADueDate')}
        action={<LinkButton label={tr('expenses.viewAll')} onPress={() => openList({ status: 'OPEN', sort: 'due_asc' })} />}
      >
        {loading ? (
          <Placeholder height={120} />
        ) : !data?.upcoming.length ? (
          <NoData text={tr('expenses.nothingToPayCreditExpensesWith')} />
        ) : (
          data.upcoming.map((e, i) => {
            const s = expenseStatus(e.status);
            return (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate('ExpenseDetail', { id: e.id })}
                style={[opsStyles.rowBetween, i > 0 && opsStyles.listRow]}
              >
                <View style={styles.flex}>
                  <Text style={opsStyles.title} numberOfLines={1}>
                    {e.title || e.categoryName}
                  </Text>
                  <Text style={opsStyles.meta} numberOfLines={1}>{`${e.supplierName ?? e.paidTo ?? '—'} · ${e.idd}`}</Text>
                  <Text style={[opsStyles.meta, e.dueInDays !== null && e.dueInDays < 0 && opsStyles.danger]}>{dueText(e.dueInDays, e.dueDate)}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={opsStyles.amount}>{money(e.outstandingAmount)}</Text>
                  <Badge label={s.label} tone={s.tone} />
                </View>
              </Pressable>
            );
          })
        )}
      </OpsCard>
    </ScrollView>
  );
}

const PERIODS: { value: ReportPeriod; label: string; range: string }[] = [
  { value: 'daily', get label() { return i18n.t('common.daily'); }, range: 'This month' },
  { value: 'weekly', get label() { return i18n.t('common.weekly'); }, range: 'Last 12 weeks' },
  { value: 'monthly', get label() { return i18n.t('common.monthly'); }, range: 'Last 12 months' },
  { value: 'yearly', get label() { return i18n.t('common.yearly'); }, range: 'Last 5 years' },
];

function bucketLabel(bucket: string, period: ReportPeriod, full = false) {
  const [y, m, d] = bucket.split('-');
  if (period === 'yearly') return y;
  if (period === 'monthly') return `${monthShort(Number(m) - 1)} ${full ? y : y.slice(2)}`;
  if (period === 'weekly') return full ? i18n.t('expenses.weekOfBucket', { bucket: day(bucket) }) : `${Number(d)} ${monthShort(Number(m) - 1)}`;
  return full ? day(bucket) : String(Number(d));
}
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Expenses › Reports: by period, with trend, methods, categories, suppliers and statuses. */
export function ExpenseReportsTab({ storeId }: { storeId: string }) {
  const { t: tr } = useTranslation();
  const toast = useToast();
  const today = todayDay();
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [custom, setCustom] = useState<OpsRange | null>(null);
  const query = { period, ...(custom ? { from: custom.from, to: custom.to } : {}) };
  const { data: r, error, loading, refreshing, reload } = useFetch(() => expensesService.report(storeId, query), [storeId, period, custom?.from, custom?.to]);
  const [exporting, setExporting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  async function exportPdf() {
    setExporting(true);
    try {
      await openPdf(expensesService.reportPdfPath(storeId, query), `expense-report-${period}.pdf`);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  }

  const t = r?.totals;
  const points = r?.points ?? [];
  const methods = r?.byPaymentMethod ?? [];
  const methodTotal = methods.reduce((s, m) => s + m.amount, 0);
  const statusCount = (r?.byStatus ?? []).reduce((s, x) => s + x.count, 0);

  return (
    <ScrollView
      contentContainerStyle={opsStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
    >
      <View style={styles.periods}>
        {PERIODS.map(p => {
          const on = p.value === period;
          return (
            <Pressable key={p.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setPeriod(p.value)} style={[styles.period, on && styles.periodOn]}>
              <Text style={[styles.periodText, on && styles.periodTextOn]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={opsStyles.rowBetween}>
        <Text style={[opsStyles.meta, styles.flex]}>{custom ? rangeLabel(custom) : PERIODS.find(p => p.value === period)?.range}</Text>
        {custom ? <LinkButton label={tr('expenses.resetRange')} onPress={() => setCustom(null)} /> : null}
      </View>
      <RangeChips today={today} value={custom ?? { key: 'none', label: '', from: today, to: today }} onChange={setCustom} keys={['month', 'last-month', '3m']} />
      <Pressable accessibilityRole="button" disabled={exporting || !t?.count} onPress={exportPdf} style={[opsStyles.smallBtn, styles.export, !t?.count && styles.disabled]}>
        <FileTextIcon size={15} color={colors.text} />
        <Text style={opsStyles.smallBtnText}>{exporting ? tr('expenses.exporting') : tr('expenses.exportPdf')}</Text>
      </Pressable>

      {error && !r ? <ErrorState message={error} onRetry={() => reload()} /> : null}
      <StatGrid>
        <StatCard icon={WalletIcon} tone="orange" label={tr('common.totalExpenses')} value={money(t?.net)} sub={tr('expenses.afterReturns')} loading={loading} />
        <StatCard icon={FileTextIcon} tone="blue" label={tr('expenses.billsRecorded')} value={t ? t.count.toLocaleString('en-IN') : '—'} sub={t?.count ? tr('expenses.avgAmountEach', { amount: money(Math.round(t.net / t.count)) }) : undefined} loading={loading} />
        <StatCard icon={WalletIcon} tone="emerald" label={tr('common.paid')} value={money(t?.paid)} sub={tr('expenses.paymentsMadeInThePeriod')} loading={loading} />
        <StatCard icon={CreditCardIcon} tone="amber" label={tr('expenses.boughtOnCredit2')} value={money(t?.credit)} sub={t?.gross ? tr('expenses.fixedPercentOfBills', { fixed: pct(t.credit, t.gross).toFixed(0) }) : undefined} loading={loading} />
        <StatCard icon={RefreshIcon} tone="violet" label={tr('common.returns')} value={money(t?.returned)} sub={tr('expenses.creditNotesApproved')} loading={loading} />
        <StatCard icon={PercentIcon} tone="red" label={tr('expenses.gstPaid')} value={money(t?.tax)} sub={t?.gross ? tr('expenses.fixedPercentOfBills', { fixed: pct(t.tax, t.gross).toFixed(1) }) : undefined} loading={loading} />
      </StatGrid>

      <OpsCard title={tr('expenses.expenseTrend')} description={tr('expenses.expensesByBillDatePaymentsBy')}>
        {loading ? (
          <Placeholder height={240} />
        ) : !points.length ? (
          <NoData text={tr('expenses.nothingInThisPeriod')} />
        ) : (
          <ComboChart
            labels={points.map(p => bucketLabel(p.bucket, r!.period))}
            fullLabels={points.map(p => bucketLabel(p.bucket, r!.period, true))}
            lines={[
              { key: 'net', label: tr('common.expenses'), color: CHART_COLORS[0], values: points.map(p => p.net) },
              { key: 'paid', label: tr('common.paid'), color: CHART_COLORS[1], values: points.map(p => p.paid) },
              { key: 'credit', label: tr('common.onCredit'), color: CHART_COLORS[3], values: points.map(p => p.credit) },
            ]}
          />
        )}
      </OpsCard>

      <OpsCard title={tr('expenses.paymentsByMethod')}>
        {loading ? (
          <Placeholder />
        ) : !methods.length ? (
          <NoData text={tr('expenses.nothingInThisPeriod')} />
        ) : (
          <View style={styles.ring}>
            <Ring
              segments={methods.map((m, i) => ({ key: m.method, value: m.amount, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              centerValue={money(methodTotal)}
              centerLabel={tr('common.paid')}
              selected={selectedMethod}
            />
            <View style={styles.legend}>
              {methods.map((m, i) => (
                <Pressable key={m.method} accessibilityRole="button" onPress={() => setSelectedMethod(s => (s === m.method ? null : m.method))} style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} />
                  <Text style={styles.legendName}>{paymentModeLabel(m.method)}</Text>
                  <Text style={styles.legendPct}>{`${pct(m.amount, methodTotal).toFixed(1)}%`}</Text>
                  <Text style={styles.legendValue}>{money(m.amount)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </OpsCard>

      <OpsCard title={tr('expenses.topCategories')}>
        {loading ? <Placeholder /> : r?.byCategory.length ? <BarList rows={r.byCategory.slice(0, 8).map(c => ({ label: c.name, value: c.amount, sub: `${c.count}` }))} /> : <NoData text={tr('expenses.nothingInThisPeriod')} />}
      </OpsCard>

      <OpsCard title={tr('expenses.topSuppliers')} description={tr('expenses.expensesAndHowMuchOfIt')}>
        {loading ? (
          <Placeholder />
        ) : r?.bySupplier.length ? (
          <BarList rows={r.bySupplier.slice(0, 8).map(s => ({ label: s.name, value: s.amount, sub: tr('expenses.paidPaid', { paid: money(s.paid) }) }))} color={CHART_COLORS[0]} />
        ) : (
          <NoData text={tr('expenses.nothingInThisPeriod')} />
        )}
      </OpsCard>

      <OpsCard title={tr('expenses.billsByStatus')} description={tr('expenses.billsDatedInThePeriodAs')}>
        {loading ? (
          <Placeholder height={100} />
        ) : !r?.byStatus.length ? (
          <NoData text={tr('expenses.nothingInThisPeriod')} />
        ) : (
          r.byStatus.map((s, i) => {
            const meta = expenseStatus(s.status);
            return (
              <View key={s.status} style={[opsStyles.rowBetween, i > 0 && opsStyles.listRow]}>
                <Badge label={meta.label} tone={meta.tone} />
                <Text style={opsStyles.meta}>{`${s.count} · ${pct(s.count, statusCount).toFixed(0)}%`}</Text>
                <Text style={[opsStyles.amount, s.status === 'CANCELLED' && styles.struck]}>{money(s.amount)}</Text>
              </View>
            );
          })
        )}
      </OpsCard>

      <OpsCard title={tr('expenses.periodBreakdown')} description={r ? tr('expenses.labelPeriodsWithActivityNewestFirst', { label: PERIODS.find(p => p.value === r.period)?.label }) : undefined}>
        {loading ? (
          <Placeholder />
        ) : !points.length ? (
          <NoData text={tr('expenses.nothingInThisPeriod')} />
        ) : (
          [...points]
            .filter(p => p.count || p.paid)
            .reverse()
            .map((p, i) => (
              <View key={p.bucket} style={[i > 0 && opsStyles.listRow, styles.breakdown]}>
                <View style={opsStyles.rowBetween}>
                  <Text style={opsStyles.title}>{bucketLabel(p.bucket, r!.period, true)}</Text>
                  <Text style={opsStyles.amount}>{money(p.net)}</Text>
                </View>
                <Text style={opsStyles.meta}>
                  {[
                    tr('expenses.billCount', { count: p.count }),
                    tr('expenses.grossAmount', { amount: money(p.gross) }),
                    p.returned ? tr('expenses.returnsAmount', { amount: `−${money(p.returned)}` }) : null,
                    p.credit ? tr('expenses.creditAmount', { amount: money(p.credit) }) : null,
                    p.tax ? tr('expenses.gstAmount', { amount: money(p.tax) }) : null,
                    tr('expenses.paidAmount', { amount: money(p.paid) }),
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))
        )}
      </OpsCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 4 },
  inlineLink: { fontFamily: fonts.semibold, color: colors.secondary },
  periods: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  period: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  periodOn: { backgroundColor: colors.secondary },
  periodText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  periodTextOn: { color: colors.white },
  export: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.5 },
  ring: { alignItems: 'center', gap: 12 },
  legend: { alignSelf: 'stretch' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.text },
  legendPct: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  legendValue: { minWidth: 70, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  struck: { color: colors.textMuted, textDecorationLine: 'line-through' },
  breakdown: { gap: 2 },
});
