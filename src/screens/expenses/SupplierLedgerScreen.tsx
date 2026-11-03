import React, { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { day, expenseStatus, money } from '../../lib/operations';
import { expensesService } from '../../services/expenses-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { ErrorState, FilterChips, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, Detail, HistoryList, OpsCard, opsStyles } from '../../components/operations/OpsParts';
import { SupplierFormSheet } from '../../components/expenses/SupplierFormSheet';
import { TruckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const TYPE_META: Record<'BILL' | 'PAYMENT' | 'RETURN', { label: string; tone: BadgeTone; sign: string }> = {
  BILL: { label: 'Bill', tone: 'slate', sign: '+' },
  PAYMENT: { label: 'Payment', tone: 'green', sign: '−' },
  RETURN: { label: 'Return', tone: 'violet', sign: '−' },
};

/** A supplier's ledger: totals, every bill, and all money in and out. */
export function SupplierLedgerScreen({ navigation, route }: ScreenProps<'SupplierLedger'>) {
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const allowed = hasPermission('store-expenses:view');
  const { current: store } = useStore();
  const storeId = allowed ? store?.id ?? '' : '';
  const toast = useToast();
  const { data: s, error, loading, refreshing, reload } = useFetch(() => (storeId ? expensesService.supplier(storeId, id) : Promise.resolve(null)), [storeId, id]);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'bills' | 'transactions'>('bills');

  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Supplier" onBack={navigation.goBack} />
        <ComingSoon label="Expenses" icon={TruckIcon} allowed={false} />
      </View>
    );
  }
  if (loading || !s) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Supplier" onBack={navigation.goBack} />
        {loading ? (
          <View style={opsStyles.content}>
            <ListSkeleton rows={4} height={110} />
          </View>
        ) : (
          <ErrorState message={error ?? 'Not found.'} onRetry={() => reload()} />
        )}
      </View>
    );
  }

  async function toggleActive() {
    try {
      await expensesService.updateSupplier(storeId, s!.id, { isActive: !s!.isActive });
      toast(s!.isActive ? 'Supplier marked inactive' : 'Supplier active again');
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove() {
    if (!(await confirmAction(`Delete ${s!.name}?`, 'Only a supplier with no bills can be deleted.', 'Delete', true))) return;
    try {
      await expensesService.removeSupplier(storeId, s!.id);
      toast('Supplier deleted');
      navigation.goBack();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={s.name} subtitle={s.idd} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <View style={styles.head}>
          <View style={opsStyles.row}>
            <Text style={styles.name}>{s.name}</Text>
            {!s.isActive ? <Badge label="Inactive" tone="slate" /> : null}
          </View>
          <Text style={opsStyles.meta}>{`${s.idd}${s.phone ? ` · ${s.phone}` : ''}${s.gstNumber ? ` · GST ${s.gstNumber}` : ''}`}</Text>
        </View>
        <View style={opsStyles.chipRow}>
          {hasPermission('store-expenses:create') ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Add Expense" onPress={() => navigation.navigate('ExpenseForm', { supplierId: s.id })} style={opsStyles.primaryBtn}>
              <Text style={opsStyles.primaryBtnText}>Add Expense</Text>
            </Pressable>
          ) : null}
          {hasPermission('store-expenses:edit') ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={opsStyles.smallBtn}>
                <Text style={opsStyles.smallBtnText}>Edit</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={toggleActive} style={opsStyles.smallBtn}>
                <Text style={opsStyles.smallBtnText}>{s.isActive ? 'Mark inactive' : 'Mark active'}</Text>
              </Pressable>
            </>
          ) : null}
          {hasPermission('store-expenses:delete') && !s.bills.length ? (
            <Pressable accessibilityRole="button" onPress={remove} style={opsStyles.smallBtn}>
              <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>Delete</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.totals}>
          <Total label="Credit Expenses" value={money(s.creditTotal)} />
          <Total label="Total Payments" value={money(s.paid)} color={colors.successDark} />
          <Total label="Returns / Credit Notes" value={money(s.returned)} color="#6d28d9" />
          <Total label="Outstanding Balance" value={money(s.outstanding)} color={s.outstanding ? colors.warningDark : undefined} />
          <Total
            label="Overdue Balance"
            value={money(s.overdue)}
            color={s.overdue ? colors.error : undefined}
            sub={s.refundDue ? `${money(s.refundDue)} refund due to you` : undefined}
          />
        </View>

        <FilterChips
          options={[
            { value: 'bills', label: 'Bills', count: s.bills.length },
            { value: 'transactions', label: 'Transaction History', count: s.transactions.length },
          ]}
          value={tab}
          onChange={v => setTab(v as 'bills' | 'transactions')}
        />
        <OpsCard>
          {tab === 'bills' ? (
            !s.bills.length ? (
              <Text style={opsStyles.muted}>No bills from this supplier.</Text>
            ) : (
              s.bills.map((b, i) => {
                const st = expenseStatus(b.status);
                return (
                  <Pressable key={b.id} accessibilityRole="button" onPress={() => navigation.navigate('ExpenseDetail', { id: b.id })} style={[i > 0 && opsStyles.listRow, styles.entry]}>
                    <View style={opsStyles.rowBetween}>
                      <Text style={[opsStyles.title, styles.flex]} numberOfLines={1}>
                        {b.title}
                      </Text>
                      <Badge label={st.label} tone={st.tone} />
                    </View>
                    <Text style={opsStyles.meta}>
                      {`${b.idd} · ${day(b.expenseDate)}${b.kind === 'PURCHASE' ? ' · stock purchase' : ''}${b.referenceNumber ? ` · bill ${b.referenceNumber}` : ''}`}
                    </Text>
                    <Text style={opsStyles.meta}>
                      {`${money(b.amount)} · paid ${money(b.paidAmount)} · returned ${money(b.returnedAmount)} · `}
                      <Text style={b.outstandingAmount ? styles.owed : undefined}>{`owed ${money(b.outstandingAmount)}`}</Text>
                      {b.dueDate ? <Text style={b.status === 'OVERDUE' ? opsStyles.danger : undefined}>{` · due ${day(b.dueDate)}`}</Text> : null}
                    </Text>
                  </Pressable>
                );
              })
            )
          ) : !s.transactions.length ? (
            <Text style={opsStyles.muted}>Nothing recorded yet.</Text>
          ) : (
            s.transactions.map((t, i) => {
              const meta = TYPE_META[t.type];
              return (
                <Pressable
                  key={`${t.type}-${t.reference}-${i}`}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('ExpenseDetail', { id: t.expenseId })}
                  style={[i > 0 && opsStyles.listRow, styles.entry, t.void && styles.voided]}
                >
                  <View style={opsStyles.rowBetween}>
                    <View style={opsStyles.row}>
                      <Badge label={meta.label} tone={meta.tone} />
                      <Text style={opsStyles.meta}>{day(t.date)}</Text>
                    </View>
                    <Text style={[opsStyles.amount, t.void && styles.struck]}>{`${meta.sign} ${money(t.amount)}`}</Text>
                  </View>
                  <Text style={opsStyles.title} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text style={opsStyles.meta} numberOfLines={1}>
                    {`${t.reference}${t.detail ? ` · ${t.detail.replace('BANK_TRANSFER', 'Bank transfer')}` : ''}${t.void ? ' · not counted' : ''}`}
                  </Text>
                  <Text style={styles.balance}>{`Balance owed ${money(t.balance)}`}</Text>
                </Pressable>
              );
            })
          )}
        </OpsCard>

        <OpsCard title="Supplier Details">
          <Detail label="Mobile" value={s.phone} />
          <Detail label="Email" value={s.email} />
          <Detail label="GST Number" value={s.gstNumber} />
          <Detail label="Address" value={s.address} />
          <Detail label="Notes" value={s.notes} />
          <Detail label="Last Bill" value={s.lastBillDate ? day(s.lastBillDate) : null} />
        </OpsCard>
        <OpsCard title="Changes">
          <HistoryList entries={s.history} />
        </OpsCard>
      </ScrollView>
      <SupplierFormSheet
        storeId={storeId}
        visible={editing}
        supplier={s}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          reload();
        }}
      />
    </View>
  );
}

function Total({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={[opsStyles.meta, opsStyles.success]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { gap: 4 },
  name: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  total: { flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  totalLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  totalValue: { marginTop: 4, fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  entry: { gap: 3, paddingVertical: 4 },
  owed: { color: colors.warningDark, fontFamily: fonts.semibold },
  voided: { opacity: 0.55 },
  struck: { textDecorationLine: 'line-through' },
  balance: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
});
