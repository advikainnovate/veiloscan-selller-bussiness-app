import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { formatRupees } from '../../lib/format';
import { methodLabel, PAYMENT_METHODS, REMINDER_TYPES, type PaymentMethod, type ReminderType } from '../../lib/orders';
import { paise, paymentAmountProblem, shiftISO, todayISO } from '../../lib/customer-credit';
import { customerCreditService, type CreditDetail } from '../../services/customer-credit-service';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Choices, DateField, Field, Input } from '../form/Fields';
import { AlertCircleIcon, CheckCircleIcon } from '../icons';

const fromISO = (s: string) => new Date(`${s}T00:00:00`);

export interface ReceivableCredit {
  id: string;
  idd: string;
  customerName: string;
  orderNumber?: string;
  outstandingAmount: number;
  dueDate?: string;
}

/**
 * Receive Payment, as on the Seller Panel: the amount can't exceed what's
 * outstanding, and a confirmation step comes before it's saved.
 */
export function ReceivePaymentSheet({
  credit,
  onClose,
  onReceived,
}: {
  credit: ReceivableCredit | null;
  onClose: () => void;
  onReceived: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ amount: '', method: 'CASH' as PaymentMethod, date: todayISO(), reference: '', notes: '' });
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // A fresh form for each credit, starting at the full amount owed.
  useEffect(() => {
    if (!credit) return;
    setForm({ amount: String(credit.outstandingAmount), method: 'CASH', date: todayISO(), reference: '', notes: '' });
    setConfirming(false);
    setError('');
  }, [credit]);

  if (!credit) return null;
  const amountPaise = paise(form.amount);
  const amountError = paymentAmountProblem(form.amount, credit.outstandingAmount, formatRupees);
  const decimalsError = /\.\d{3,}$/.test(form.amount.trim()) ? 'Use at most 2 decimal places' : '';
  const remaining = Math.max(0, paise(credit.outstandingAmount) - amountPaise) / 100;
  const valid = amountPaise > 0 && !amountError && !decimalsError && !!form.date && form.date <= todayISO();
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await customerCreditService.receivePayment(credit!.id, {
        amount: amountPaise / 100,
        paymentMethod: form.method,
        paymentDate: form.date,
        ...(form.reference.trim() ? { referenceNumber: form.reference.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      toast(remaining === 0 ? `Payment received · ${credit!.idd} is fully paid` : `Payment of ${formatRupees(amountPaise / 100)} received`);
      onReceived();
    } catch (err) {
      setError(extractErrorMessage(err));
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible
      title={confirming ? 'Confirm payment' : 'Receive Payment'}
      subtitle={`${credit.customerName} · ${credit.idd}${credit.orderNumber ? ` · ${credit.orderNumber}` : ''}`}
      onClose={onClose}
      footer={
        confirming ? (
          <View style={styles.footerRow}>
            <Button title="Back" variant="ghost" onPress={() => setConfirming(false)} disabled={saving} style={styles.flex} />
            <Button title={`Confirm ${formatRupees(amountPaise / 100)}`} onPress={submit} loading={saving} style={styles.flex2} />
          </View>
        ) : (
          <Button title="Continue" onPress={() => setConfirming(true)} disabled={!valid} />
        )
      }
    >
      <View style={styles.owed}>
        <Text style={styles.owedLabel}>Outstanding</Text>
        <Text style={styles.owedValue}>{formatRupees(credit.outstandingAmount)}</Text>
        {credit.dueDate ? <Text style={styles.owedHint}>Due {formatDay(credit.dueDate)}</Text> : null}
      </View>

      {confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.note}>Record this payment? It can't be edited afterwards.</Text>
          <View style={styles.box}>
            <Line label="Amount" value={formatRupees(amountPaise / 100)} strong />
            <Line label="Method" value={methodLabel(form.method)} />
            <Line label="Date" value={formatDay(form.date)} />
            {form.reference.trim() ? <Line label="Reference" value={form.reference.trim()} /> : null}
            <Line label="Outstanding after" value={formatRupees(remaining)} strong tone={remaining === 0 ? colors.success : undefined} />
          </View>
          {remaining === 0 ? (
            <View style={styles.inline}>
              <CheckCircleIcon size={15} color={colors.successDark} />
              <Text style={styles.settles}>This settles the credit — it will be marked Paid.</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Field label="Payment Amount" required error={amountError || decimalsError || null}>
            <Input
              value={form.amount}
              onChangeText={amount => set({ amount: amount.replace(/[^\d.]/g, '') })}
              keyboardType="decimal-pad"
              accessibilityLabel="Payment amount"
            />
            <View style={styles.quick}>
              <QuickChip label={`Pay full ${formatRupees(credit.outstandingAmount)}`} onPress={() => set({ amount: String(credit.outstandingAmount) })} />
              {credit.outstandingAmount >= 2 ? (
                <QuickChip label="Half" onPress={() => set({ amount: String(Math.round(credit.outstandingAmount * 50) / 100) })} />
              ) : null}
            </View>
          </Field>
          <Field label="Payment Method" required>
            <Choices options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))} value={form.method} onChange={v => set({ method: v as PaymentMethod })} />
          </Field>
          <DateField label="Payment Date" required value={form.date} onChange={date => set({ date })} maximumDate={new Date()} />
          <Field label="Reference Number">
            <Input
              value={form.reference}
              onChangeText={reference => set({ reference })}
              placeholder={form.method === 'CASH' ? 'Optional' : 'UPI / card / bank ref'}
              maxLength={100}
            />
          </Field>
          <Field label="Notes">
            <Input value={form.notes} onChangeText={notes => set({ notes })} placeholder="Optional" maxLength={1000} multiline />
          </Field>
        </>
      )}
      {error ? <ErrorLine message={error} /> : null}
    </Sheet>
  );
}

/** Due date, reminder and notes; amounts change only through payments. */
export function EditCreditSheet({ credit, onClose, onSaved }: { credit: CreditDetail | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ dueDate: '', reminderEnabled: false, reminderDays: '1', channels: [] as ReminderType[], notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!credit) return;
    setForm({
      dueDate: credit.dueDate.slice(0, 10),
      reminderEnabled: credit.reminderEnabled,
      reminderDays: String(credit.reminderDays),
      channels: credit.reminderChannels,
      notes: credit.notes ?? '',
    });
    setError('');
  }, [credit]);

  if (!credit) return null;
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));
  const days = Number(form.reminderDays);
  const daysError = form.reminderEnabled && (!/^\d+$/.test(form.reminderDays) || days > 365) ? 'Enter 0 to 365 days' : '';
  const reminderOn = form.dueDate && !daysError ? formatDay(shiftISO(form.dueDate, -days)) : null;

  async function save() {
    if (!form.dueDate) return setError('Choose a due date.');
    if (form.dueDate < todayISO()) return setError("The due date can't be in the past.");
    if (daysError) return setError(daysError);
    if (form.reminderEnabled && !form.channels.length) return setError('Choose at least one reminder channel.');
    setSaving(true);
    setError('');
    try {
      await customerCreditService.update(credit!.id, {
        dueDate: form.dueDate,
        reminderEnabled: form.reminderEnabled,
        reminderDays: days || 0,
        reminderChannels: form.channels,
        notes: form.notes,
      });
      toast('Credit updated');
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible title="Edit credit" subtitle={credit.idd} onClose={onClose} footer={<Button title="Save" onPress={save} loading={saving} />}>
      <DateField label="Due Date" required value={form.dueDate} onChange={dueDate => set({ dueDate })} minimumDate={fromISO(todayISO())} />

      <View style={styles.reminder}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>Payment reminder</Text>
            <Text style={styles.reminderHint}>Remind the customer before the due date.</Text>
          </View>
          <Switch
            accessibilityLabel="Payment reminder"
            value={form.reminderEnabled}
            onValueChange={reminderEnabled => set({ reminderEnabled })}
            trackColor={{ true: colors.secondary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
        {form.reminderEnabled ? (
          <>
            <View style={styles.daysRow}>
              <Input
                value={form.reminderDays}
                onChangeText={reminderDays => set({ reminderDays: reminderDays.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel="Days before due date"
                style={styles.daysInput}
              />
              <Text style={styles.daysText}>day(s) before the due date{reminderOn ? ` · on ${reminderOn}` : ''}</Text>
            </View>
            {daysError ? <Text style={styles.fieldError}>{daysError}</Text> : null}
            <View style={styles.quick}>
              {REMINDER_TYPES.map(t => {
                const on = form.channels.includes(t.value);
                return (
                  <Pressable
                    key={t.value}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => set({ channels: on ? form.channels.filter(c => c !== t.value) : [...form.channels, t.value] })}
                    style={[styles.channel, on && styles.channelOn]}
                  >
                    {on ? <CheckCircleIcon size={13} color={colors.secondaryDark} /> : null}
                    <Text style={[styles.channelText, on && styles.channelTextOn]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {form.channels.some(c => c === 'SMS' || c === 'PUSH') ? (
              <Text style={styles.warn}>SMS and Push aren't connected to a provider yet — those reminders will show as Failed.</Text>
            ) : null}
          </>
        ) : null}
      </View>

      <Field label="Notes">
        <Input value={form.notes} onChangeText={notes => set({ notes })} maxLength={1000} multiline />
      </Field>
      {error ? <ErrorLine message={error} /> : null}
    </Sheet>
  );
}

/** Cancel a credit with no payments (one created by mistake). */
export function CancelCreditSheet({ credit, onClose, onCancelled }: { credit: CreditDetail | null; onClose: () => void; onCancelled: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setReason('');
    setError('');
  }, [credit]);
  if (!credit) return null;

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      await customerCreditService.cancel(credit!.id, reason.trim() || undefined);
      toast(`Credit ${credit!.idd} cancelled`);
      onCancelled();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible
      title="Cancel this credit?"
      subtitle={`${formatRupees(credit.outstandingAmount)} will no longer be owed on order ${credit.order.orderNumber}, and its reminders stop. Use this for a credit created by mistake — the order goes back to unpaid so you can record its payment again.`}
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          <Button title="Keep credit" variant="ghost" onPress={onClose} style={styles.flex} />
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={confirm}
            style={({ pressed }) => [styles.danger, (pressed || saving) && styles.dangerPressed, styles.flex2]}
          >
            <Text style={styles.dangerText}>{saving ? 'Cancelling…' : 'Cancel credit'}</Text>
          </Pressable>
        </View>
      }
    >
      <Input value={reason} onChangeText={setReason} placeholder="Reason (optional)" maxLength={1000} multiline />
      {error ? <ErrorLine message={error} /> : null}
    </Sheet>
  );
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.lineStrong, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <AlertCircleIcon size={16} color={colors.errorDark} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  footerRow: { flexDirection: 'row', gap: 10 },
  owed: { padding: 14, borderRadius: radius.md, backgroundColor: colors.background },
  owedLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  owedValue: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  owedHint: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  confirm: { gap: 10 },
  note: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  box: { padding: 14, gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineLabel: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  lineValue: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, textAlign: 'right' },
  lineStrong: { fontFamily: fonts.extrabold },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settles: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.successDark },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  quickChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background },
  quickChipPressed: { backgroundColor: colors.border },
  quickText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  reminder: { padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reminderTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  reminderHint: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  daysInput: { width: 72 },
  daysText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  fieldError: { marginTop: 4, fontFamily: fonts.medium, fontSize: 12, color: colors.error },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  channelOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  channelText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  channelTextOn: { color: colors.secondaryDark },
  warn: { marginTop: 8, fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, backgroundColor: colors.errorLight },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.errorDark },
  danger: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.error },
  dangerPressed: { backgroundColor: colors.errorDark },
  dangerText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
