import React, { useState } from 'react';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

/** Expenses › Dashboard: the period's totals, what's owed now, trend, categories and what's due. */
export function ExpenseDashboardTab({ storeId, openList, openTab }: { storeId: string; openList: (p: ListPreset) => void; openTab: (t: ExpenseTab) => void }) {
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
            <Text style={opsStyles.smallBtnText}>Recurring</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Add Expense" onPress={() => navigation.navigate('ExpenseForm', {})} style={opsStyles.primaryBtn}>
            <PlusIcon size={15} color={colors.white} strokeWidth={2.4} />
            <Text style={opsStyles.primaryBtnText}>Add Expense</Text>
          </Pressable>
        </View>
      ) : null}
      <RangeChips today={today} value={range} onChange={setRange} />
      {error && !data ? <ErrorState message={error} onRetry={() => reload()} /> : null}

      <Text style={opsStyles.sectionLabel}>{rangeLabel(range).toUpperCase()}</Text>
      <StatGrid>
        <StatCard icon={WalletIcon} tone="orange" label="Total Expenses" value={money(t?.totalExpenses)} sub={t ? `${t.count} bill${t.count === 1 ? '' : 's'} · net of returns` : null} loading={loading} />
        <StatCard icon={WalletIcon} tone="emerald" label="Paid Expenses" value={money(t?.paidExpenses)} sub="Paid when recorded" loading={loading} />
        <StatCard icon={CreditCardIcon} tone="sky" label="Credit Expenses" value={money(t?.creditExpenses)} sub="Bought on credit" loading={loading} />
        <StatCard icon={LayersIcon} tone="slate" label="Returns" value={money(t?.returns)} sub="Credit notes" loading={loading} />
      </StatGrid>

      <Text style={opsStyles.sectionLabel}>OWED RIGHT NOW</Text>
      <StatGrid>
        <StatCard
          icon={WalletIcon}
          tone="amber"
          label="Outstanding"
          value={money(o?.outstanding)}
          sub={o ? `${o.openCount} open bill${o.openCount === 1 ? '' : 's'}` : null}
          loading={loading}
          onPress={() => openList({ status: 'OPEN' })}
        />
        <StatCard
          icon={AlertCircleIcon}
          tone="red"
          label="Overdue"
          value={money(o?.overdue)}
          negative={!!o?.overdue}
          sub={o ? `${o.overdueCount} bill${o.overdueCount === 1 ? '' : 's'}` : null}
          loading={loading}
          onPress={() => openList({ status: 'OVERDUE' })}
        />
        <StatCard
          icon={ClockIcon}
          tone="sky"
          label="Partially Paid"
          value={money(o?.partiallyPaid)}
          sub={o ? `${o.partiallyPaidCount} bill${o.partiallyPaidCount === 1 ? '' : 's'} · still owed` : null}
          loading={loading}
          onPress={() => openList({ status: 'PARTIALLY_PAID' })}
        />
        <StatCard
          icon={CalendarIcon}
          tone="violet"
          label="Due in 7 Days"
          value={money(o?.dueThisWeek)}
          sub={o?.refundsDue ? `${money(o.refundsDue)} refunds due to you` : 'Upcoming payments'}
          loading={loading}
        />
      </StatGrid>
      {o?.stockBillsOutstanding ? (
        <Text style={opsStyles.meta}>
          {`Plus ${money(o.stockBillsOutstanding)} owed on stock purchase bills (Pending Stock) — see `}
          <Text style={styles.inlineLink} onPress={() => openTab('suppliers')}>
            Suppliers
          </Text>
          .
        </Text>
      ) : null}

      <OpsCard title="Monthly Expense Summary" description="Last 12 months: expenses (net of returns) and payments made">
        {loading ? (
          <Placeholder height={240} />
        ) : (
          <ComboChart
            labels={months.map(m => monthLabel(m.month))}
            fullLabels={months.map(m => `${monthLabel(m.month)} · ${m.count} bill${m.count === 1 ? '' : 's'}`)}
            lines={[
              { key: 'total', label: 'Expenses', color: CHART_COLORS[0], values: months.map(m => m.total) },
              { key: 'payments', label: 'Payments made', color: CHART_COLORS[1], values: months.map(m => m.payments) },
              { key: 'credit', label: 'On credit', color: CHART_COLORS[3], values: months.map(m => m.credit) },
            ]}
          />
        )}
      </OpsCard>

      <OpsCard title="By Category" description={rangeLabel(range)}>
        {loading ? (
          <Placeholder />
        ) : data?.byCategory.length ? (
          <BarList rows={data.byCategory.map(c => ({ label: c.name, value: c.amount, sub: `${c.count}` }))} />
        ) : (
          <NoData text="No expenses in this period." />
        )}
      </OpsCard>

      <OpsCard
        title="Upcoming & Overdue Payments"
        description="Credit bills with a due date, most urgent first"
        action={<LinkButton label="View all" onPress={() => openList({ status: 'OPEN', sort: 'due_asc' })} />}
      >
        {loading ? (
          <Placeholder height={120} />
        ) : !data?.upcoming.length ? (
          <NoData text="Nothing to pay. Credit expenses with a due date show up here." />
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
  { value: 'daily', label: 'Daily', range: 'This month' },
  { value: 'weekly', label: 'Weekly', range: 'Last 12 weeks' },
  { value: 'monthly', label: 'Monthly', range: 'Last 12 months' },
  { value: 'yearly', label: 'Yearly', range: 'Last 5 years' },
];

function bucketLabel(bucket: string, period: ReportPeriod, full = false) {
  const [y, m, d] = bucket.split('-');
  if (period === 'yearly') return y;
  if (period === 'monthly') return `${MONTHS[Number(m) - 1]} ${full ? y : y.slice(2)}`;
  if (period === 'weekly') return full ? `Week of ${day(bucket)}` : `${Number(d)} ${MONTHS[Number(m) - 1]}`;
  return full ? day(bucket) : String(Number(d));
}
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Expenses › Reports: by period, with trend, methods, categories, suppliers and statuses. */
export function ExpenseReportsTab({ storeId }: { storeId: string }) {
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
        {custom ? <LinkButton label="Reset range" onPress={() => setCustom(null)} /> : null}
      </View>
      <RangeChips today={today} value={custom ?? { key: 'none', label: '', from: today, to: today }} onChange={setCustom} keys={['month', 'last-month', '3m']} />
      <Pressable accessibilityRole="button" disabled={exporting || !t?.count} onPress={exportPdf} style={[opsStyles.smallBtn, styles.export, !t?.count && styles.disabled]}>
        <FileTextIcon size={15} color={colors.text} />
        <Text style={opsStyles.smallBtnText}>{exporting ? 'Exporting…' : 'Export PDF'}</Text>
      </Pressable>

      {error && !r ? <ErrorState message={error} onRetry={() => reload()} /> : null}
      <StatGrid>
        <StatCard icon={WalletIcon} tone="orange" label="Total Expenses" value={money(t?.net)} sub="After returns" loading={loading} />
        <StatCard icon={FileTextIcon} tone="blue" label="Bills Recorded" value={t ? t.count.toLocaleString('en-IN') : '—'} sub={t?.count ? `Avg ${money(Math.round(t.net / t.count))} each` : undefined} loading={loading} />
        <StatCard icon={WalletIcon} tone="emerald" label="Paid" value={money(t?.paid)} sub="Payments made in the period" loading={loading} />
        <StatCard icon={CreditCardIcon} tone="amber" label="Bought on Credit" value={money(t?.credit)} sub={t?.gross ? `${pct(t.credit, t.gross).toFixed(0)}% of bills` : undefined} loading={loading} />
        <StatCard icon={RefreshIcon} tone="violet" label="Returns" value={money(t?.returned)} sub="Credit notes approved" loading={loading} />
        <StatCard icon={PercentIcon} tone="red" label="GST Paid" value={money(t?.tax)} sub={t?.gross ? `${pct(t.tax, t.gross).toFixed(1)}% of bills` : undefined} loading={loading} />
      </StatGrid>

      <OpsCard title="Expense Trend" description="Expenses by bill date · payments by payment date">
        {loading ? (
          <Placeholder height={240} />
        ) : !points.length ? (
          <NoData text="Nothing in this period" />
        ) : (
          <ComboChart
            labels={points.map(p => bucketLabel(p.bucket, r!.period))}
            fullLabels={points.map(p => bucketLabel(p.bucket, r!.period, true))}
            lines={[
              { key: 'net', label: 'Expenses', color: CHART_COLORS[0], values: points.map(p => p.net) },
              { key: 'paid', label: 'Paid', color: CHART_COLORS[1], values: points.map(p => p.paid) },
              { key: 'credit', label: 'On credit', color: CHART_COLORS[3], values: points.map(p => p.credit) },
            ]}
          />
        )}
      </OpsCard>

      <OpsCard title="Payments by Method">
        {loading ? (
          <Placeholder />
        ) : !methods.length ? (
          <NoData text="Nothing in this period" />
        ) : (
          <View style={styles.ring}>
            <Ring
              segments={methods.map((m, i) => ({ key: m.method, value: m.amount, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              centerValue={money(methodTotal)}
              centerLabel="Paid"
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

      <OpsCard title="Top Categories">
        {loading ? <Placeholder /> : r?.byCategory.length ? <BarList rows={r.byCategory.slice(0, 8).map(c => ({ label: c.name, value: c.amount, sub: `${c.count}` }))} /> : <NoData text="Nothing in this period" />}
      </OpsCard>

      <OpsCard title="Top Suppliers" description="Expenses and how much of it is paid">
        {loading ? (
          <Placeholder />
        ) : r?.bySupplier.length ? (
          <BarList rows={r.bySupplier.slice(0, 8).map(s => ({ label: s.name, value: s.amount, sub: `${money(s.paid)} paid` }))} color={CHART_COLORS[0]} />
        ) : (
          <NoData text="Nothing in this period" />
        )}
      </OpsCard>

      <OpsCard title="Bills by Status" description="Bills dated in the period, as they stand today">
        {loading ? (
          <Placeholder height={100} />
        ) : !r?.byStatus.length ? (
          <NoData text="Nothing in this period" />
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

      <OpsCard title="Period Breakdown" description={r ? `${PERIODS.find(p => p.value === r.period)?.label} · periods with activity, newest first` : undefined}>
        {loading ? (
          <Placeholder />
        ) : !points.length ? (
          <NoData text="Nothing in this period" />
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
                  {`${p.count} bill${p.count === 1 ? '' : 's'} · gross ${money(p.gross)}${p.returned ? ` · returns −${money(p.returned)}` : ''}${p.credit ? ` · credit ${money(p.credit)}` : ''}${
                    p.tax ? ` · GST ${money(p.tax)}` : ''
                  } · paid ${money(p.paid)}`}
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
