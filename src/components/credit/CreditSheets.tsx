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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
  const decimalsError = /\.\d{3,}$/.test(form.amount.trim()) ? t('credit.useAtMost2DecimalPlaces') : '';
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
      toast(remaining === 0 ? t('credit.paymentReceivedIddIsFullyPaid', { idd: credit!.idd }) : t('credit.paymentOfAmountReceived', { amount: formatRupees(amountPaise / 100) }));
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
      title={confirming ? t('credit.confirmPayment') : t('credit.receivePayment')}
      subtitle={`${credit.customerName} · ${credit.idd}${credit.orderNumber ? ` · ${credit.orderNumber}` : ''}`}
      onClose={onClose}
      footer={
        confirming ? (
          <View style={styles.footerRow}>
            <Button title={t('common.back')} variant="ghost" onPress={() => setConfirming(false)} disabled={saving} style={styles.flex} />
            <Button title={t('credit.confirmAmount', { amount: formatRupees(amountPaise / 100) })} onPress={submit} loading={saving} style={styles.flex2} />
          </View>
        ) : (
          <Button title={t('common.continue')} onPress={() => setConfirming(true)} disabled={!valid} />
        )
      }
    >
      <View style={styles.owed}>
        <Text style={styles.owedLabel}>{t('common.outstanding')}</Text>
        <Text style={styles.owedValue}>{formatRupees(credit.outstandingAmount)}</Text>
        {credit.dueDate ? <Text style={styles.owedHint}>{t('credit.dueDuedate', { dueDate: formatDay(credit.dueDate) })}</Text> : null}
      </View>

      {confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.note}>{t('credit.recordThisPaymentItCanT')}</Text>
          <View style={styles.box}>
            <Line label={t('common.amount')} value={formatRupees(amountPaise / 100)} strong />
            <Line label={t('credit.method')} value={methodLabel(form.method)} />
            <Line label={t('common.date')} value={formatDay(form.date)} />
            {form.reference.trim() ? <Line label={t('common.reference')} value={form.reference.trim()} /> : null}
            <Line label={t('credit.outstandingAfter')} value={formatRupees(remaining)} strong tone={remaining === 0 ? colors.success : undefined} />
          </View>
          {remaining === 0 ? (
            <View style={styles.inline}>
              <CheckCircleIcon size={15} color={colors.successDark} />
              <Text style={styles.settles}>{t('credit.thisSettlesTheCreditItWill')}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Field label={t('credit.paymentAmount')} required error={amountError || decimalsError || null}>
            <Input
              value={form.amount}
              onChangeText={amount => set({ amount: amount.replace(/[^\d.]/g, '') })}
              keyboardType="decimal-pad"
              accessibilityLabel={t('common.paymentAmount')}
            />
            <View style={styles.quick}>
              <QuickChip label={t('credit.payFullOutstandingamount', { outstandingAmount: formatRupees(credit.outstandingAmount) })} onPress={() => set({ amount: String(credit.outstandingAmount) })} />
              {credit.outstandingAmount >= 2 ? (
                <QuickChip label={t('credit.half')} onPress={() => set({ amount: String(Math.round(credit.outstandingAmount * 50) / 100) })} />
              ) : null}
            </View>
          </Field>
          <Field label={t('common.paymentMethod')} required>
            <Choices options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))} value={form.method} onChange={v => set({ method: v as PaymentMethod })} />
          </Field>
          <DateField label={t('common.paymentDate')} required value={form.date} onChange={date => set({ date })} maximumDate={new Date()} />
          <Field label={t('credit.referenceNumber')}>
            <Input
              value={form.reference}
              onChangeText={reference => set({ reference })}
              placeholder={form.method === 'CASH' ? t('common.optional2') : t('credit.upiCardBankRef')}
              maxLength={100}
            />
          </Field>
          <Field label={t('common.notes')}>
            <Input value={form.notes} onChangeText={notes => set({ notes })} placeholder={t('common.optional2')} maxLength={1000} multiline />
          </Field>
        </>
      )}
      {error ? <ErrorLine message={error} /> : null}
    </Sheet>
  );
}

/** Due date, reminder and notes; amounts change only through payments. */
export function EditCreditSheet({ credit, onClose, onSaved }: { credit: CreditDetail | null; onClose: () => void; onSaved: () => void }) {
  const { t: tr } = useTranslation();
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
  const daysError = form.reminderEnabled && (!/^\d+$/.test(form.reminderDays) || days > 365) ? tr('credit.enter0To365Days') : '';
  const reminderOn = form.dueDate && !daysError ? formatDay(shiftISO(form.dueDate, -days)) : null;

  async function save() {
    if (!form.dueDate) return setError(tr('credit.chooseADueDate'));
    if (form.dueDate < todayISO()) return setError(tr('credit.theDueDateCanTBe'));
    if (daysError) return setError(daysError);
    if (form.reminderEnabled && !form.channels.length) return setError(tr('credit.chooseAtLeastOneReminderChannel'));
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
      toast(tr('credit.creditUpdated'));
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible title={tr('credit.editCredit')} subtitle={credit.idd} onClose={onClose} footer={<Button title={tr('common.save')} onPress={save} loading={saving} />}>
      <DateField label={tr('credit.dueDate')} required value={form.dueDate} onChange={dueDate => set({ dueDate })} minimumDate={fromISO(todayISO())} />

      <View style={styles.reminder}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.reminderTitle}>{tr('credit.paymentReminder')}</Text>
            <Text style={styles.reminderHint}>{tr('credit.remindTheCustomerBeforeTheDue')}</Text>
          </View>
          <Switch
            accessibilityLabel={tr('credit.paymentReminder')}
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
                accessibilityLabel={tr('credit.daysBeforeDueDate')}
                style={styles.daysInput}
              />
              <Text style={styles.daysText}>{reminderOn ? tr('credit.daysBeforeDueDateOn', { date: reminderOn }) : tr('credit.daySBeforeTheDueDate')}</Text>
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
              <Text style={styles.warn}>{tr('credit.smsAndPushArenTConnected')}</Text>
            ) : null}
          </>
        ) : null}
      </View>

      <Field label={tr('common.notes')}>
        <Input value={form.notes} onChangeText={notes => set({ notes })} maxLength={1000} multiline />
      </Field>
      {error ? <ErrorLine message={error} /> : null}
    </Sheet>
  );
}

/** Cancel a credit with no payments (one created by mistake). */
export function CancelCreditSheet({ credit, onClose, onCancelled }: { credit: CreditDetail | null; onClose: () => void; onCancelled: () => void }) {
  const { t } = useTranslation();
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
      toast(t('credit.creditIddCancelled', { idd: credit!.idd }));
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
      title={t('credit.cancelThisCredit')}
      subtitle={t('credit.outstandingamountWillNoLongerBeOwed', { outstandingAmount: formatRupees(credit.outstandingAmount), orderNumber: credit.order.orderNumber })}
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          <Button title={t('credit.keepCredit')} variant="ghost" onPress={onClose} style={styles.flex} />
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={confirm}
            style={({ pressed }) => [styles.danger, (pressed || saving) && styles.dangerPressed, styles.flex2]}
          >
            <Text style={styles.dangerText}>{saving ? t('credit.cancelling') : t('credit.cancelCredit')}</Text>
          </Pressable>
        </View>
      }
    >
      <Input value={reason} onChangeText={setReason} placeholder={t('common.reasonOptional')} maxLength={1000} multiline />
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
