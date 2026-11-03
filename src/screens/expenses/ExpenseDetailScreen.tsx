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

const REMINDER_LABEL: Record<string, string> = { DUE_SOON: '3 days before', DUE: 'On the due date', OVERDUE: 'When overdue', CUSTOM: 'Your reminder' };
const fromISO = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`);

type Reason = { kind: 'cancel' } | { kind: 'void'; paymentId: string; label: string } | { kind: 'cancelReturn'; returnId: string; label: string };

/** One expense: what was billed, paid, returned and still owed, with its history. */
export function ExpenseDetailScreen({ navigation, route }: ScreenProps<'ExpenseDetail'>) {
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
        <AppHeader title="Expense" onBack={navigation.goBack} />
        <ComingSoon label="Expenses" icon={WalletIcon} allowed={false} />
      </View>
    );
  }
  if (loading || !e) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Expense" onBack={navigation.goBack} />
        {loading ? (
          <View style={opsStyles.content}>
            <ListSkeleton rows={4} height={120} />
          </View>
        ) : (
          <ErrorState message={error ?? 'Not found.'} onRetry={() => reload()} />
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
    if (!(await confirmAction(`Delete ${e!.idd}?`, 'It was entered by mistake and nothing was paid. It stays in the audit log.', 'Delete', true))) return;
    setBusy(true);
    try {
      await expensesService.remove(storeId, e!.id);
      toast('Expense deleted');
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
      toast('Copied to today');
      navigation.replace('ExpenseDetail', { id: copy.id });
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
      setBusy(false);
    }
  }

  async function confirmReason(text: string) {
    if (!reason) return;
    let ok = false;
    if (reason.kind === 'cancel') ok = await run(() => expensesService.cancel(storeId, e!.id, text), 'Expense cancelled');
    else if (reason.kind === 'void') ok = await run(() => expensesService.voidPayment(storeId, e!.id, reason.paymentId, text), 'Payment voided');
    else ok = await run(() => expensesService.cancelReturn(storeId, e!.id, reason.returnId, text || undefined), 'Return cancelled');
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
            <Badge label={isCredit ? 'Credit' : 'Paid'} tone={isCredit ? 'blue' : 'slate'} />
            {e.kind === 'PURCHASE' ? <Badge label="Stock purchase" tone="violet" /> : null}
          </View>
          <Text style={opsStyles.meta}>
            {`${e.idd} · ${e.categoryName} · ${day(e.expenseDate)}${e.stockOrderIdd ? ` · stock order ${e.stockOrderIdd}` : ''}${e.recurringTitle ? ` · from recurring "${e.recurringTitle}"` : ''}`}
          </Text>
        </View>

        {!cancelled ? (
          <View style={styles.actions}>
            {canCreate && open ? <Button title="Add Payment" onPress={() => setSheet('pay')} style={styles.fullBtn} /> : null}
            <View style={opsStyles.chipRow}>
              {canCreate && e.status !== 'RETURNED' ? <SmallButton label="Record Return" onPress={() => setSheet('return')} /> : null}
              {canEdit ? <SmallButton label="Edit" onPress={() => navigation.navigate('ExpenseForm', { id: e.id })} /> : null}
              {canCreate && e.kind === 'OPERATING' ? <SmallButton label="Duplicate" disabled={busy} onPress={duplicate} /> : null}
              {canEdit ? <SmallButton label="Cancel" danger disabled={busy} onPress={() => setReason({ kind: 'cancel' })} /> : null}
              {canDelete && !e.payments.length && !e.returns.length ? <SmallButton label="Delete" danger disabled={busy} onPress={remove} /> : null}
            </View>
          </View>
        ) : (
          <View style={styles.cancelledBox}>
            <Text style={styles.cancelledText}>
              {`Cancelled ${e.cancelledAt ? dateTime(e.cancelledAt) : ''} by ${e.cancelledByName ?? 'someone'} — ${e.cancelReason ?? ''}. It doesn't count in any total.`}
            </Text>
          </View>
        )}

        <View style={styles.figures}>
          <Figure label="Original Amount" value={money(e.amount)} sub={e.taxAmount ? `incl. ${money(e.taxAmount)} GST` : undefined} />
          <Figure label="Paid" value={money(e.paidAmount)} sub={`${livePayments} payment(s)`} color={colors.successDark} />
          <Figure label="Returns" value={money(e.returnedAmount)} sub={pendingReturns ? `${money(pendingReturns)} awaiting supplier` : 'Approved credit notes'} color="#6d28d9" />
          {e.refundDue ? (
            <Figure label="Refund Due to You" value={money(e.refundDue)} sub="Returned after paying" color={colors.successDark} />
          ) : (
            <Figure
              label="Outstanding"
              value={money(e.outstandingAmount)}
              sub={due ?? (open ? 'No due date' : 'Nothing owed')}
              color={e.status === 'OVERDUE' ? colors.error : open ? colors.warningDark : colors.text}
            />
          )}
        </View>
        <Text style={opsStyles.muted}>Outstanding = original amount − approved returns − payments. Payments and returns never change the original amount.</Text>

        <OpsCard title="Details">
          <Detail label="Category" value={e.categoryName} />
          <Detail label="Expense Date" value={day(e.expenseDate)} />
          <Detail label="Invoice / Bill No." value={e.referenceNumber} />
          <Detail label="Invoice Date" value={e.invoiceDate ? day(e.invoiceDate) : null} />
          <Detail label="Base Amount" value={money(e.baseAmount)} />
          <Detail label="Discount" value={e.discountAmount ? money(e.discountAmount) : null} />
          <Detail label="GST" value={e.taxAmount ? `${money(e.taxAmount)}${e.taxRate !== null ? ` (${e.taxRate}%)` : ''}` : null} />
          <Detail label="Final Amount" value={money(e.amount)} />
          {!isCredit ? <Detail label="Paid To" value={e.paidTo ?? e.supplier?.name} /> : null}
          <Detail label="Description" value={e.description} />
          {e.notes ? <Detail label="Notes" value={e.notes} /> : null}
          <Detail label="Added By" value={`${e.createdByName ?? '—'} · ${dateTime(e.createdAt)}`} />
        </OpsCard>

        {isCredit || e.supplier ? (
          <OpsCard title={isCredit ? 'Credit Details' : 'Supplier'}>
            {e.supplier ? (
              <Detail
                label="Supplier"
                value={
                  <View>
                    <LinkButton label={e.supplier.name} onPress={() => navigation.navigate('SupplierLedger', { id: e.supplier!.id })} />
                    {[e.supplier.phone, e.supplier.gstNumber ? `GST ${e.supplier.gstNumber}` : null, e.supplier.address].filter(Boolean).map(line => (
                      <Text key={line} style={opsStyles.meta}>
                        {line}
                      </Text>
                    ))}
                  </View>
                }
              />
            ) : (
              <Detail label="Owed To" value={e.paidTo ?? 'No supplier linked'} />
            )}
            {isCredit ? (
              <>
                <Detail label="Credit Date" value={e.creditDate ? day(e.creditDate) : null} />
                <Detail label="Credit Terms" value={e.creditTermsDays !== null ? `${e.creditTermsDays} days` : 'Custom'} />
                <Detail label="Payment Due Date" value={`${e.dueDate ? day(e.dueDate) : 'No due date'}${due ? ` · ${due}` : ''}`} />
                <Detail label="Reminder Date" value={e.reminderDate ? day(e.reminderDate) : null} />
              </>
            ) : null}
            {e.reminders.length ? (
              <View style={[opsStyles.divider, styles.reminders]}>
                <Text style={opsStyles.sectionLabel}>REMINDERS</Text>
                {e.reminders.map(r => (
                  <View key={r.type} style={opsStyles.rowBetween}>
                    <Text style={opsStyles.meta}>{`${REMINDER_LABEL[r.type] ?? r.type} · ${day(r.remindOn)}`}</Text>
                    <Text style={[opsStyles.meta, r.status === 'SENT' ? opsStyles.success : r.status === 'PENDING' ? styles.amber : null]}>
                      {r.status === 'PENDING' ? 'Scheduled' : r.status === 'SENT' ? 'Sent' : 'Not needed'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </OpsCard>
        ) : null}

        <OpsCard title="Payment History" description="Every payment against this expense; a mistake is voided, never edited">
          {!e.payments.length ? (
            <Text style={opsStyles.muted}>No payments yet.</Text>
          ) : (
            e.payments.map((p, i) => (
              <View key={p.id} style={[i > 0 && opsStyles.listRow, styles.entry, p.voidedAt ? styles.voided : null]}>
                <View style={opsStyles.rowBetween}>
                  <Text style={[opsStyles.amount, p.voidedAt ? styles.struck : null]}>{money(p.amount)}</Text>
                  {p.voidedAt ? (
                    <Badge label="Void" tone="red" />
                  ) : !cancelled && canEdit ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Void payment ${p.idd}`} disabled={busy} onPress={() => setReason({ kind: 'void', paymentId: p.id, label: p.idd })}>
                      <Text style={[styles.actionText, opsStyles.danger]}>Void</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={opsStyles.meta}>
                  {`${day(p.paymentDate)} · ${paymentModeLabel(p.method)} · ${p.idd}${p.accountLabel ? ` · ${p.accountLabel}` : ''}${p.transactionReference ? ` · Ref ${p.transactionReference}` : ''}`}
                </Text>
                {p.notes ? <Text style={opsStyles.meta}>{p.notes}</Text> : null}
                {p.voidedAt ? <Text style={[opsStyles.meta, opsStyles.danger]}>{`Voided by ${p.voidedByName ?? 'someone'}: ${p.voidReason ?? ''}`}</Text> : null}
                <Text style={opsStyles.muted}>{`${p.createdByName ?? 'Automatic'} · ${dateTime(p.createdAt)}`}</Text>
                <FileLinks files={p.attachments} />
              </View>
            ))
          )}
        </OpsCard>

        <OpsCard title="Returns & Credit Notes" description="Lower what is owed to the supplier — not recorded as payments">
          {!e.returns.length ? (
            <Text style={opsStyles.muted}>No returns.</Text>
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
                          <LinkButton label="Approve" onPress={() => run(() => expensesService.approveReturn(storeId, e.id, r.id), 'Return approved')} />
                        ) : null}
                        <Pressable accessibilityRole="button" accessibilityLabel={`Cancel return ${r.idd}`} disabled={busy} onPress={() => setReason({ kind: 'cancelReturn', returnId: r.id, label: r.idd })}>
                          <Text style={[styles.actionText, opsStyles.danger]}>Cancel</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  <Text style={opsStyles.meta}>
                    {`${day(r.returnDate)} · ${r.idd}${r.creditNoteNumber ? ` · credit note ${r.creditNoteNumber}` : ''}${r.referenceNumber ? ` · ref ${r.referenceNumber}` : ''}${r.quantity ? ` · qty ${r.quantity}` : ''}`}
                  </Text>
                  {r.reason || r.description ? <Text style={opsStyles.meta}>{[r.reason, r.description].filter(Boolean).join(' — ')}</Text> : null}
                  {r.cancelReason ? <Text style={[opsStyles.meta, opsStyles.danger]}>{`Cancelled: ${r.cancelReason}`}</Text> : null}
                  <FileLinks files={r.attachments} />
                </View>
              );
            })
          )}
        </OpsCard>

        <OpsCard title="Attachments" description="Bills, invoices and receipts">
          <FileLinks files={e.attachments} onRemove={canEdit && !cancelled ? f => run(() => expensesService.removeAttachment(storeId, e.id, f.id), 'Attachment removed') : undefined} />
          {!e.attachments.length ? <Text style={opsStyles.muted}>No files on the expense itself.</Text> : null}
          {canEdit && !cancelled ? (
            <View style={styles.addFiles}>
              <PhotoAttachments label="Add files" value={newFiles} onChange={setNewFiles} dirName="store-expenses" />
              {newFiles.length ? (
                <Button
                  title={`Attach ${newFiles.length} file${newFiles.length === 1 ? '' : 's'}`}
                  loading={busy}
                  onPress={async () => {
                    if (await run(() => expensesService.addAttachments(storeId, e.id, newFiles.map(f => ({ fileId: f.fileId, kind: f.kind }))), 'Files attached')) setNewFiles([]);
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </OpsCard>

        <OpsCard title="Audit Trail">
          <HistoryList entries={e.history} />
        </OpsCard>
      </ScrollView>

      <PaymentSheet
        storeId={storeId}
        expense={sheet === 'pay' ? e : null}
        onClose={() => setSheet(null)}
        onSaved={() => {
          setSheet(null);
          toast('Payment recorded');
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
          toast('Return recorded');
          reload();
        }}
      />
      <ReasonSheet
        visible={!!reason}
        title={reason?.kind === 'cancel' ? `Cancel ${e.idd}` : reason?.kind === 'void' ? `Void payment ${reason.label}` : `Cancel return ${reason?.label ?? ''}`}
        message={
          reason?.kind === 'cancel'
            ? 'Its payments are voided and returns cancelled, so it no longer counts anywhere. It stays in the history.'
            : reason?.kind === 'void'
              ? 'The payment stays in the history, marked void, and the amount is owed again.'
              : undefined
        }
        label={reason?.kind === 'cancelReturn' ? 'Reason (optional)' : 'Reason'}
        required={reason?.kind !== 'cancelReturn'}
        confirmLabel={reason?.kind === 'cancel' ? 'Cancel expense' : reason?.kind === 'void' ? 'Void payment' : 'Cancel return'}
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
    if (!(amount > 0)) return setError('Enter an amount above ₹0');
    if (amount > expense!.outstandingAmount) return setError(`Only ${money(expense!.outstandingAmount)} is outstanding`);
    if (!form.paymentDate || form.paymentDate > today) return setError('Pick a payment date up to today');
    if (form.paymentDate < expense!.expenseDate.slice(0, 10)) return setError("The payment can't be before the expense date");
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
    <Sheet visible title={`Add Payment · ${expense.idd}`} onClose={onClose} footer={<Button title="Record Payment" onPress={save} loading={saving} />}>
      <View style={styles.summary}>
        <SummaryCell label="Outstanding" value={money(expense.outstandingAmount)} />
        <SummaryCell label="Paying" value={money(amount || 0)} color={colors.successDark} />
        <SummaryCell label="Left after" value={money(after)} color={colors.warningDark} />
      </View>
      <Field label="Payment Amount (₹)" required>
        <Input value={form.amount} onChangeText={v => set('amount', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Payment amount" />
        <View style={styles.quick}>
          <LinkButton label="Full" onPress={() => set('amount', expense.outstandingAmount.toFixed(2))} />
        </View>
      </Field>
      <DateField label="Payment Date" required value={form.paymentDate} onChange={v => set('paymentDate', v)} minimumDate={fromISO(expense.expenseDate)} maximumDate={new Date()} />
      <Field label="Payment Method">
        <Choices options={PAYMENT_MODES} value={form.method} onChange={v => set('method', v)} />
      </Field>
      <Field label="Payment Account">
        <Input value={form.accountLabel} onChangeText={v => set('accountLabel', v)} placeholder="e.g. Cash drawer, HDFC current" maxLength={100} />
      </Field>
      <Field label="Transaction Reference">
        <Input value={form.transactionReference} onChangeText={v => set('transactionReference', v)} placeholder="UTR / UPI / cheque no." maxLength={100} />
      </Field>
      <Field label="Notes">
        <Input value={form.notes} onChangeText={v => set('notes', v)} maxLength={1000} multiline />
      </Field>
      <PhotoAttachments label="Receipt" value={files} onChange={setFiles} dirName="store-expenses" defaultKind="RECEIPT" max={5} kinds={false} />
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
    if (!(amount > 0)) return setError('Enter the return amount');
    if (amount > room) return setError(`At most ${money(room)} can still be returned`);
    if (form.quantity && !(Number(form.quantity) > 0)) return setError('The quantity must be above 0');
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
      title={`Record Return · ${expense.idd}`}
      subtitle={`A return lowers what you owe ${expense.supplierName ?? 'the supplier'}; it isn't a payment. Up to ${money(room)} can still be returned.`}
      onClose={onClose}
      footer={<Button title="Record Return" onPress={save} loading={saving} />}
    >
      {refund ? <Text style={[opsStyles.meta, opsStyles.success]}>{`${money(refund)} of it is more than you owe — the supplier owes you that back.`}</Text> : null}
      <Field label="Return Amount (₹)" required>
        <Input value={form.amount} onChangeText={v => set('amount', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Return amount" />
        <View style={styles.quick}>
          <LinkButton label="Full" onPress={() => set('amount', room.toFixed(2))} />
        </View>
      </Field>
      <DateField label="Return Date" value={form.returnDate} onChange={v => set('returnDate', v)} minimumDate={fromISO(expense.expenseDate)} maximumDate={new Date()} />
      <Field label="Return Quantity (optional)">
        <Input value={form.quantity} onChangeText={v => set('quantity', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
      </Field>
      <Field label="Return Reference No.">
        <Input value={form.referenceNumber} onChangeText={v => set('referenceNumber', v)} maxLength={100} />
      </Field>
      <Field label="Supplier Credit Note No.">
        <Input value={form.creditNoteNumber} onChangeText={v => set('creditNoteNumber', v)} maxLength={100} />
      </Field>
      <Field label="Adjustment Status">
        <Choices
          options={[
            { value: 'APPROVED', label: 'Approved — lower the balance now' },
            { value: 'PENDING', label: 'Awaiting supplier — approve later' },
          ]}
          value={form.status}
          onChange={v => set('status', v)}
        />
      </Field>
      <Field label="Return Reason">
        <Input value={form.reason} onChangeText={v => set('reason', v)} placeholder="e.g. Damaged on arrival" maxLength={500} />
      </Field>
      <Field label="Description">
        <Input value={form.description} onChangeText={v => set('description', v)} placeholder="What was returned" maxLength={500} multiline />
      </Field>
      <PhotoAttachments label="Supporting Documents" value={files} onChange={setFiles} dirName="store-expenses" defaultKind="CREDIT_NOTE" max={5} />
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
