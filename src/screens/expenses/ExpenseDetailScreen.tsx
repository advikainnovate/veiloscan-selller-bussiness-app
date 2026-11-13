import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { dateTime, day, dueText, expenseStatus, money, newKey, PAYMENT_MODES, paymentModeLabel, RETURN_STATUS, toAmount, todayDay } from '../../lib/operations';
import { expensesService, type ExpenseDetail, type PaymentMode } from '../../services/expenses-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Choices, DateField, Field, Input } from '../../components/form/Fields';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, Detail, FileLinks, HistoryList, LinkButton, OpsCard, opsStyles, PhotoAttachments, ReasonSheet, type PendingFile } from '../../components/operations/OpsParts';
import { WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const REMINDER_LABEL: Record<string, string> = { get DUE_SOON() { return i18n.t('expenses.n3DaysBefore'); }, get DUE() { return i18n.t('expenses.onTheDueDate'); }, get OVERDUE() { return i18n.t('expenses.whenOverdue'); }, get CUSTOM() { return i18n.t('expenses.yourReminder'); } };
const fromISO = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`);

type Reason = { kind: 'cancel' } | { kind: 'void'; paymentId: string; label: string } | { kind: 'cancelReturn'; returnId: string; label: string };

/** One expense: what was billed, paid, returned and still owed, with its history. */
export function ExpenseDetailScreen({ navigation, route }: ScreenProps<'ExpenseDetail'>) {
  const { t } = useTranslation();
  const { id, action } = route.params;
  const { hasPermission } = useAuth();
  const allowed = hasPermission('store-expenses:view');
  const canCreate = hasPermission('store-expenses:create');
  const canEdit = hasPermission('store-expenses:edit');
  const canDelete = hasPermission('store-expenses:delete');
  const { current: store } = useStore();
  const storeId = allowed ? store?.id ?? '' : '';
  const toast = useToast();
  const { data: e, error, loading, refreshing, reload } = useFetch(() => (storeId ? expensesService.get(storeId, id) : Promise.resolve(null)), [storeId, id]);
  const [sheet, setSheet] = useState<'pay' | 'return' | null>(action ?? null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [newFiles, setNewFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);

  // Edited on the form screen.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

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

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('common.expense')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.expenses')} icon={WalletIcon} allowed={false} />
      </View>
    );
  }
  if (loading || !e) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('common.expense')} onBack={navigation.goBack} />
        {loading ? (
          <View style={opsStyles.content}>
            <ListSkeleton rows={4} height={120} />
          </View>
        ) : (
          <ErrorState message={error ?? t('common.notFound')} onRetry={() => reload()} />
        )}
      </View>
    );
  }

  const cancelled = e.status === 'CANCELLED';
  const open = e.outstandingAmount > 0;
  const isCredit = e.paymentType === 'CREDIT';
  const due = dueText(e.dueInDays, e.dueDate);
  const status = expenseStatus(e.status);
  const pendingReturns = e.returns.filter(r => r.status === 'PENDING').reduce((s, r) => s + r.amount, 0);
  const livePayments = e.payments.filter(p => !p.voidedAt).length;

  async function remove() {
    if (!(await confirmAction(t('expenses.deleteIdd', { idd: e!.idd }), t('expenses.itWasEnteredByMistakeAnd'), t('common.delete'), true))) return;
    setBusy(true);
    try {
      await expensesService.remove(storeId, e!.id);
      toast(t('expenses.expenseDeleted'));
      navigation.goBack();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const copy = await expensesService.duplicate(storeId, e!.id);
      toast(t('expenses.copiedToToday'));
      navigation.replace('ExpenseDetail', { id: copy.id });
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
      setBusy(false);
    }
  }

  async function confirmReason(text: string) {
    if (!reason) return;
    let ok = false;
    if (reason.kind === 'cancel') ok = await run(() => expensesService.cancel(storeId, e!.id, text), t('expenses.expenseCancelled'));
    else if (reason.kind === 'void') ok = await run(() => expensesService.voidPayment(storeId, e!.id, reason.paymentId, text), t('common.paymentVoided'));
    else ok = await run(() => expensesService.cancelReturn(storeId, e!.id, reason.returnId, text || undefined), t('expenses.returnCancelled'));
    if (ok) setReason(null);
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={e.title || e.description || e.categoryName} subtitle={e.idd} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <View style={styles.head}>
          <Text style={[styles.headTitle, cancelled && styles.struck]}>{e.title || e.description || e.categoryName}</Text>
          <View style={styles.badges}>
            <Badge label={status.label} tone={status.tone} />
            <Badge label={isCredit ? t('common.credit') : t('common.paid')} tone={isCredit ? 'blue' : 'slate'} />
            {e.kind === 'PURCHASE' ? <Badge label={t('expenses.stockPurchase')} tone="violet" /> : null}
          </View>
          <Text style={opsStyles.meta}>
            {[e.idd, e.categoryName, day(e.expenseDate), e.stockOrderIdd ? t('expenses.stockOrderRef', { ref: e.stockOrderIdd }) : null, e.recurringTitle ? t('expenses.fromRecurring', { title: e.recurringTitle }) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {!cancelled ? (
          <View style={styles.actions}>
            {canCreate && open ? <Button title={t('expenses.addPayment')} onPress={() => setSheet('pay')} style={styles.fullBtn} /> : null}
            <View style={opsStyles.chipRow}>
              {canCreate && e.status !== 'RETURNED' ? <SmallButton label={t('expenses.recordReturn')} onPress={() => setSheet('return')} /> : null}
              {canEdit ? <SmallButton label={t('common.edit')} onPress={() => navigation.navigate('ExpenseForm', { id: e.id })} /> : null}
              {canCreate && e.kind === 'OPERATING' ? <SmallButton label={t('common.duplicate')} disabled={busy} onPress={duplicate} /> : null}
              {canEdit ? <SmallButton label={t('common.cancel')} danger disabled={busy} onPress={() => setReason({ kind: 'cancel' })} /> : null}
              {canDelete && !e.payments.length && !e.returns.length ? <SmallButton label={t('common.delete')} danger disabled={busy} onPress={remove} /> : null}
            </View>
          </View>
        ) : (
          <View style={styles.cancelledBox}>
            <Text style={styles.cancelledText}>
              {t('expenses.cancelledByReason', { when: e.cancelledAt ? dateTime(e.cancelledAt) : '', name: e.cancelledByName ?? t('expenses.someone'), reason: e.cancelReason ?? '' })}
            </Text>
          </View>
        )}

        <View style={styles.figures}>
          <Figure label={t('expenses.originalAmount')} value={money(e.amount)} sub={e.taxAmount ? t('expenses.inclGstAmount', { amount: money(e.taxAmount) }) : undefined} />
          <Figure label={t('common.paid')} value={money(e.paidAmount)} sub={t('expenses.livepaymentsPaymentS', { livePayments })} color={colors.successDark} />
          <Figure label={t('common.returns')} value={money(e.returnedAmount)} sub={pendingReturns ? t('expenses.pendingreturnsAwaitingSupplier', { pendingReturns: money(pendingReturns) }) : t('expenses.approvedCreditNotes')} color="#6d28d9" />
          {e.refundDue ? (
            <Figure label={t('expenses.refundDueToYou')} value={money(e.refundDue)} sub={t('expenses.returnedAfterPaying')} color={colors.successDark} />
          ) : (
            <Figure
              label={t('common.outstanding')}
              value={money(e.outstandingAmount)}
              sub={due ?? (open ? t('expenses.noDueDate') : t('expenses.nothingOwed'))}
              color={e.status === 'OVERDUE' ? colors.error : open ? colors.warningDark : colors.text}
            />
          )}
        </View>
        <Text style={opsStyles.muted}>{t('expenses.outstandingOriginalAmountApprovedReturnsPayments')}</Text>

        <OpsCard title={t('common.details')}>
          <Detail label={t('common.category')} value={e.categoryName} />
          <Detail label={t('expenses.expenseDate')} value={day(e.expenseDate)} />
          <Detail label={t('expenses.invoiceBillNo')} value={e.referenceNumber} />
          <Detail label={t('expenses.invoiceDate')} value={e.invoiceDate ? day(e.invoiceDate) : null} />
          <Detail label={t('expenses.baseAmount')} value={money(e.baseAmount)} />
          <Detail label={t('common.discount')} value={e.discountAmount ? money(e.discountAmount) : null} />
          <Detail label="GST" value={e.taxAmount ? `${money(e.taxAmount)}${e.taxRate !== null ? ` (${e.taxRate}%)` : ''}` : null} />
          <Detail label={t('expenses.finalAmount')} value={money(e.amount)} />
          {!isCredit ? <Detail label={t('expenses.paidTo')} value={e.paidTo ?? e.supplier?.name} /> : null}
          <Detail label={t('common.description')} value={e.description} />
          {e.notes ? <Detail label={t('common.notes')} value={e.notes} /> : null}
          <Detail label={t('expenses.addedBy')} value={`${e.createdByName ?? '—'} · ${dateTime(e.createdAt)}`} />
        </OpsCard>

        {isCredit || e.supplier ? (
          <OpsCard title={isCredit ? t('expenses.creditDetails') : t('common.supplier')}>
            {e.supplier ? (
              <Detail
                label={t('common.supplier')}
                value={
                  <View>
                    <LinkButton label={e.supplier.name} onPress={() => navigation.navigate('SupplierLedger', { id: e.supplier!.id })} />
                    {[e.supplier.phone, e.supplier.gstNumber ? t('expenses.gstGstnumber', { gstNumber: e.supplier.gstNumber }) : null, e.supplier.address].filter(Boolean).map(line => (
                      <Text key={line} style={opsStyles.meta}>
                        {line}
                      </Text>
                    ))}
                  </View>
                }
              />
            ) : (
              <Detail label={t('expenses.owedTo')} value={e.paidTo ?? 'No supplier linked'} />
            )}
            {isCredit ? (
              <>
                <Detail label={t('expenses.creditDate')} value={e.creditDate ? day(e.creditDate) : null} />
                <Detail label={t('expenses.creditTerms')} value={e.creditTermsDays !== null ? t('common.dayCount', { count: e.creditTermsDays }) : t('common.custom')} />
                <Detail label={t('expenses.paymentDueDate')} value={`${e.dueDate ? day(e.dueDate) : 'No due date'}${due ? ` · ${due}` : ''}`} />
                <Detail label={t('expenses.reminderDate')} value={e.reminderDate ? day(e.reminderDate) : null} />
              </>
            ) : null}
            {e.reminders.length ? (
              <View style={[opsStyles.divider, styles.reminders]}>
                <Text style={opsStyles.sectionLabel}>{t('expenses.reminders')}</Text>
                {e.reminders.map(r => (
                  <View key={r.type} style={opsStyles.rowBetween}>
                    <Text style={opsStyles.meta}>{`${REMINDER_LABEL[r.type] ?? r.type} · ${day(r.remindOn)}`}</Text>
                    <Text style={[opsStyles.meta, r.status === 'SENT' ? opsStyles.success : r.status === 'PENDING' ? styles.amber : null]}>
                      {r.status === 'PENDING' ? t('common.scheduled') : r.status === 'SENT' ? t('common.sent') : t('expenses.notNeeded')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </OpsCard>
        ) : null}

        <OpsCard title={t('common.paymentHistory')} description={t('expenses.everyPaymentAgainstThisExpenseA')}>
          {!e.payments.length ? (
            <Text style={opsStyles.muted}>{t('expenses.noPaymentsYet')}</Text>
          ) : (
            e.payments.map((p, i) => (
              <View key={p.id} style={[i > 0 && opsStyles.listRow, styles.entry, p.voidedAt ? styles.voided : null]}>
                <View style={opsStyles.rowBetween}>
                  <Text style={[opsStyles.amount, p.voidedAt ? styles.struck : null]}>{money(p.amount)}</Text>
                  {p.voidedAt ? (
                    <Badge label={t('expenses.void')} tone="red" />
                  ) : !cancelled && canEdit ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t('expenses.voidPaymentIdd', { idd: p.idd })} disabled={busy} onPress={() => setReason({ kind: 'void', paymentId: p.id, label: p.idd })}>
                      <Text style={[styles.actionText, opsStyles.danger]}>{t('expenses.void')}</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={opsStyles.meta}>
                  {`${day(p.paymentDate)} · ${paymentModeLabel(p.method)} · ${p.idd}${p.accountLabel ? ` · ${p.accountLabel}` : ''}${p.transactionReference ? ` · ${t('common.refNumber', { ref: p.transactionReference })}` : ''}`}
                </Text>
                {p.notes ? <Text style={opsStyles.meta}>{p.notes}</Text> : null}
                {p.voidedAt ? <Text style={[opsStyles.meta, opsStyles.danger]}>{t('expenses.voidedBy', { name: p.voidedByName ?? t('expenses.someone'), reason: p.voidReason ?? '' })}</Text> : null}
                <Text style={opsStyles.muted}>{`${p.createdByName ?? 'Automatic'} · ${dateTime(p.createdAt)}`}</Text>
                <FileLinks files={p.attachments} />
              </View>
            ))
          )}
        </OpsCard>

        <OpsCard title={t('expenses.returnsAndCreditNotes')} description={t('expenses.lowerWhatIsOwedToThe')}>
          {!e.returns.length ? (
            <Text style={opsStyles.muted}>{t('expenses.noReturns')}</Text>
          ) : (
            e.returns.map((r, i) => {
              const rs = RETURN_STATUS[r.status];
              return (
                <View key={r.id} style={[i > 0 && opsStyles.listRow, styles.entry, r.status === 'CANCELLED' ? styles.voided : null]}>
                  <View style={opsStyles.rowBetween}>
                    <View style={opsStyles.row}>
                      <Text style={opsStyles.amount}>{money(r.amount)}</Text>
                      <Badge label={rs.label} tone={rs.tone} />
                    </View>
                    {!cancelled && canEdit && r.status !== 'CANCELLED' ? (
                      <View style={opsStyles.row}>
                        {r.status === 'PENDING' ? (
                          <LinkButton label={t('common.approve')} onPress={() => run(() => expensesService.approveReturn(storeId, e.id, r.id), t('expenses.returnApproved'))} />
                        ) : null}
                        <Pressable accessibilityRole="button" accessibilityLabel={t('expenses.cancelReturnIdd', { idd: r.idd })} disabled={busy} onPress={() => setReason({ kind: 'cancelReturn', returnId: r.id, label: r.idd })}>
                          <Text style={[styles.actionText, opsStyles.danger]}>{t('common.cancel')}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  <Text style={opsStyles.meta}>
                    {`${day(r.returnDate)} · ${r.idd}${r.creditNoteNumber ? ` · ${t('expenses.creditNoteRef', { ref: r.creditNoteNumber })}` : ''}${r.referenceNumber ? ` · ${t('expenses.refLower', { ref: r.referenceNumber })}` : ''}${r.quantity ? ` · ${t('expenses.qtyValue', { quantity: r.quantity })}` : ''}`}
                  </Text>
                  {r.reason || r.description ? <Text style={opsStyles.meta}>{[r.reason, r.description].filter(Boolean).join(' — ')}</Text> : null}
                  {r.cancelReason ? <Text style={[opsStyles.meta, opsStyles.danger]}>{t('common.cancelledCancelreason', { cancelReason: r.cancelReason })}</Text> : null}
                  <FileLinks files={r.attachments} />
                </View>
              );
            })
          )}
        </OpsCard>

        <OpsCard title={t('common.attachments')} description={t('expenses.billsInvoicesAndReceipts')}>
          <FileLinks files={e.attachments} onRemove={canEdit && !cancelled ? f => run(() => expensesService.removeAttachment(storeId, e.id, f.id), t('expenses.attachmentRemoved')) : undefined} />
          {!e.attachments.length ? <Text style={opsStyles.muted}>{t('expenses.noFilesOnTheExpenseItself')}</Text> : null}
          {canEdit && !cancelled ? (
            <View style={styles.addFiles}>
              <PhotoAttachments label={t('expenses.addFiles')} value={newFiles} onChange={setNewFiles} dirName="store-expenses" />
              {newFiles.length ? (
                <Button
                  title={t('expenses.attachFiles', { count: newFiles.length })}
                  loading={busy}
                  onPress={async () => {
                    if (await run(() => expensesService.addAttachments(storeId, e.id, newFiles.map(f => ({ fileId: f.fileId, kind: f.kind }))), t('expenses.filesAttached'))) setNewFiles([]);
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </OpsCard>

        <OpsCard title={t('expenses.auditTrail')}>
          <HistoryList entries={e.history} />
        </OpsCard>
      </ScrollView>

      <PaymentSheet
        storeId={storeId}
        expense={sheet === 'pay' ? e : null}
        onClose={() => setSheet(null)}
        onSaved={() => {
          setSheet(null);
          toast(t('common.paymentRecorded'));
          reload();
        }}
      />
      <ReturnSheet
        storeId={storeId}
        expense={sheet === 'return' ? e : null}
        pendingReturns={pendingReturns}
        onClose={() => setSheet(null)}
        onSaved={() => {
          setSheet(null);
          toast(t('common.returnRecorded'));
          reload();
        }}
      />
      <ReasonSheet
        visible={!!reason}
        title={reason?.kind === 'cancel' ? t('expenses.cancelIdd', { idd: e.idd }) : reason?.kind === 'void' ? t('expenses.voidPaymentLabel', { label: reason.label }) : t('expenses.cancelReturnLabel', { label: reason?.label ?? '' })}
        message={
          reason?.kind === 'cancel'
            ? t('expenses.itsPaymentsAreVoidedAndReturns')
            : reason?.kind === 'void'
              ? t('expenses.thePaymentStaysInTheHistory')
              : undefined
        }
        label={reason?.kind === 'cancelReturn' ? t('common.reasonOptional') : t('common.reason')}
        required={reason?.kind !== 'cancelReturn'}
        confirmLabel={reason?.kind === 'cancel' ? t('expenses.cancelExpense') : reason?.kind === 'void' ? t('expenses.voidPayment') : t('expenses.cancelReturn')}
        onClose={() => setReason(null)}
        onConfirm={confirmReason}
      />
    </View>
  );
}

function SmallButton({ label, onPress, danger, disabled }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [opsStyles.smallBtn, pressed && opsStyles.pressed, disabled && styles.disabled]}>
      <Text style={[opsStyles.smallBtnText, danger && opsStyles.danger]}>{label}</Text>
    </Pressable>
  );
}

function Figure({ label, value, sub, color = colors.text }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={opsStyles.muted} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Add a payment: never more than is outstanding; the key stops a double tap recording two. */
function PaymentSheet({ storeId, expense, onClose, onSaved }: { storeId: string; expense: ExpenseDetail | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const today = todayDay();
  const [key, setKey] = useState(newKey);
  const [form, setForm] = useState({ amount: '', paymentDate: today, method: 'CASH' as PaymentMode, accountLabel: '', transactionReference: '', notes: '' });
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!expense) return;
    setKey(newKey());
    setForm({
      amount: expense.outstandingAmount.toFixed(2),
      paymentDate: today,
      method: (expense.payments.find(p => !p.voidedAt)?.method ?? 'CASH') as PaymentMode,
      accountLabel: '',
      transactionReference: '',
      notes: '',
    });
    setFiles([]);
    setError('');
  }, [expense, today]);
  if (!expense) return null;
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const amount = toAmount(form.amount);
  const after = Math.max(Math.round((expense.outstandingAmount - (amount || 0)) * 100) / 100, 0);

  async function save() {
    if (!(amount > 0)) return setError(t('common.enterAnAmountAboveRs0'));
    if (amount > expense!.outstandingAmount) return setError(t('expenses.onlyOutstandingamountIsOutstanding', { outstandingAmount: money(expense!.outstandingAmount) }));
    if (!form.paymentDate || form.paymentDate > today) return setError(t('expenses.pickAPaymentDateUpTo'));
    if (form.paymentDate < expense!.expenseDate.slice(0, 10)) return setError(t('expenses.thePaymentCanTBeBefore'));
    setError('');
    setSaving(true);
    try {
      await expensesService.addPayment(storeId, expense!.id, {
        amount,
        paymentDate: form.paymentDate,
        method: form.method,
        accountLabel: form.accountLabel.trim() || undefined,
        transactionReference: form.transactionReference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        attachments: files.map(f => ({ fileId: f.fileId, kind: f.kind })),
        idempotencyKey: key,
      });
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible title={t('expenses.addPaymentIdd', { idd: expense.idd })} onClose={onClose} footer={<Button title={t('expenses.recordPayment')} onPress={save} loading={saving} />}>
      <View style={styles.summary}>
        <SummaryCell label={t('common.outstanding')} value={money(expense.outstandingAmount)} />
        <SummaryCell label={t('expenses.paying')} value={money(amount || 0)} color={colors.successDark} />
        <SummaryCell label={t('expenses.leftAfter')} value={money(after)} color={colors.warningDark} />
      </View>
      <Field label={t('expenses.paymentAmountRs')} required>
        <Input value={form.amount} onChangeText={v => set('amount', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={t('common.paymentAmount')} />
        <View style={styles.quick}>
          <LinkButton label={t('expenses.full')} onPress={() => set('amount', expense.outstandingAmount.toFixed(2))} />
        </View>
      </Field>
      <DateField label={t('common.paymentDate')} required value={form.paymentDate} onChange={v => set('paymentDate', v)} minimumDate={fromISO(expense.expenseDate)} maximumDate={new Date()} />
      <Field label={t('common.paymentMethod')}>
        <Choices options={PAYMENT_MODES} value={form.method} onChange={v => set('method', v)} />
      </Field>
      <Field label={t('expenses.paymentAccount')}>
        <Input value={form.accountLabel} onChangeText={v => set('accountLabel', v)} placeholder="e.g. Cash drawer, HDFC current" maxLength={100} />
      </Field>
      <Field label={t('common.transactionReference')}>
        <Input value={form.transactionReference} onChangeText={v => set('transactionReference', v)} placeholder={t('expenses.utrUpiChequeNo')} maxLength={100} />
      </Field>
      <Field label={t('common.notes')}>
        <Input value={form.notes} onChangeText={v => set('notes', v)} maxLength={1000} multiline />
      </Field>
      <PhotoAttachments label={t('common.receipt')} value={files} onChange={setFiles} dirName="store-expenses" defaultKind="RECEIPT" max={5} kinds={false} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

function SummaryCell({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.flex}>
      <Text style={opsStyles.muted}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

/** Record a full or partial return / credit note. */
function ReturnSheet({
  storeId,
  expense,
  pendingReturns,
  onClose,
  onSaved,
}: {
  storeId: string;
  expense: ExpenseDetail | null;
  pendingReturns: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const today = todayDay();
  const [key, setKey] = useState(newKey);
  const blank = { amount: '', returnDate: today, quantity: '', referenceNumber: '', creditNoteNumber: '', reason: '', description: '', status: 'APPROVED' as 'APPROVED' | 'PENDING' };
  const [form, setForm] = useState(blank);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!expense) return;
    setKey(newKey());
    setForm({ ...blank, returnDate: today });
    setFiles([]);
    setError('');
    // A fresh form for each opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, today]);
  if (!expense) return null;
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const room = Math.round((expense.amount - expense.returnedAmount - pendingReturns) * 100) / 100;
  const amount = toAmount(form.amount);
  const refund = form.status === 'APPROVED' && amount > 0 ? Math.max(Math.round((amount - expense.outstandingAmount) * 100) / 100, 0) : 0;

  async function save() {
    if (!(amount > 0)) return setError(t('expenses.enterTheReturnAmount'));
    if (amount > room) return setError(t('expenses.atMostRoomCanStillBe', { room: money(room) }));
    if (form.quantity && !(Number(form.quantity) > 0)) return setError(t('expenses.theQuantityMustBeAbove0'));
    setError('');
    setSaving(true);
    try {
      await expensesService.addReturn(storeId, expense!.id, {
        amount,
        returnDate: form.returnDate || undefined,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        referenceNumber: form.referenceNumber.trim() || undefined,
        creditNoteNumber: form.creditNoteNumber.trim() || undefined,
        reason: form.reason.trim() || undefined,
        description: form.description.trim() || undefined,
        status: form.status,
        attachments: files.map(f => ({ fileId: f.fileId, kind: f.kind })),
        idempotencyKey: key,
      });
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible
      title={t('expenses.recordReturnIdd', { idd: expense.idd })}
      subtitle={t('expenses.returnLowersOwed', { supplier: expense.supplierName ?? t('expenses.theSupplier'), amount: money(room) })}
      onClose={onClose}
      footer={<Button title={t('expenses.recordReturn')} onPress={save} loading={saving} />}
    >
      {refund ? <Text style={[opsStyles.meta, opsStyles.success]}>{t('expenses.refundOfItIsMoreThan', { refund: money(refund) })}</Text> : null}
      <Field label={t('expenses.returnAmountRs')} required>
        <Input value={form.amount} onChangeText={v => set('amount', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={t('expenses.returnAmount')} />
        <View style={styles.quick}>
          <LinkButton label={t('expenses.full')} onPress={() => set('amount', room.toFixed(2))} />
        </View>
      </Field>
      <DateField label={t('expenses.returnDate')} value={form.returnDate} onChange={v => set('returnDate', v)} minimumDate={fromISO(expense.expenseDate)} maximumDate={new Date()} />
      <Field label={t('expenses.returnQuantityOptional')}>
        <Input value={form.quantity} onChangeText={v => set('quantity', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
      </Field>
      <Field label={t('expenses.returnReferenceNo')}>
        <Input value={form.referenceNumber} onChangeText={v => set('referenceNumber', v)} maxLength={100} />
      </Field>
      <Field label={t('expenses.supplierCreditNoteNo')}>
        <Input value={form.creditNoteNumber} onChangeText={v => set('creditNoteNumber', v)} maxLength={100} />
      </Field>
      <Field label={t('expenses.adjustmentStatus')}>
        <Choices
          options={[
            { value: 'APPROVED', label: t('expenses.approvedLowerTheBalanceNow') },
            { value: 'PENDING', label: t('expenses.awaitingSupplierApproveLater') },
          ]}
          value={form.status}
          onChange={v => set('status', v)}
        />
      </Field>
      <Field label={t('expenses.returnReason')}>
        <Input value={form.reason} onChangeText={v => set('reason', v)} placeholder="e.g. Damaged on arrival" maxLength={500} />
      </Field>
      <Field label={t('common.description')}>
        <Input value={form.description} onChangeText={v => set('description', v)} placeholder={t('expenses.whatWasReturned')} maxLength={500} multiline />
      </Field>
      <PhotoAttachments label={t('expenses.supportingDocuments')} value={files} onChange={setFiles} dirName="store-expenses" defaultKind="CREDIT_NOTE" max={5} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { gap: 6 },
  headTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  struck: { color: colors.textMuted, textDecorationLine: 'line-through' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { gap: 10 },
  fullBtn: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  cancelledBox: { padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  cancelledText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  figure: { flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  figureLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  figureValue: { marginTop: 6, fontFamily: fonts.extrabold, fontSize: 20 },
  reminders: { gap: 6, marginTop: 8, paddingTop: 10 },
  amber: { color: colors.warningDark },
  entry: { gap: 3 },
  voided: { opacity: 0.6 },
  actionText: { fontFamily: fonts.semibold, fontSize: 13 },
  addFiles: { gap: 10, marginTop: 10 },
  summary: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.background },
  summaryValue: { marginTop: 2, fontFamily: fonts.bold, fontSize: 15 },
  quick: { flexDirection: 'row', marginTop: 6 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
});
