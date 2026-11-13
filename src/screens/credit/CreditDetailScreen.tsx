import React, { useState, type ReactNode } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { openPdf } from '../../lib/documents';
import { formatRupees } from '../../lib/format';
import { methodLabel, REMINDER_TYPES, type ReminderType } from '../../lib/orders';
import { creditStatus, dueHint, isOpenCredit, ORDER_PAYMENT_STATUS, REMINDER_STATUS, reminderTypeLabel } from '../../lib/customer-credit';
import { customerCreditService } from '../../services/customer-credit-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, Row } from '../../components/ui/Card';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { CancelCreditSheet, EditCreditSheet, ReceivePaymentSheet } from '../../components/credit/CreditSheets';
import {
  AlertCircleIcon,
  BellIcon,
  CalendarIcon,
  EditIcon,
  FileTextIcon,
  MailIcon,
  PhoneIcon,
  ShoppingBagIcon,
  UserIcon,
  WalletIcon,
} from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/** One credit: amounts, payment history, customer, order and reminders. */
export function CreditDetailScreen({ navigation, route }: ScreenProps<'CreditDetail'>) {
  const { t: tr } = useTranslation();
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('customer-credit:manage');
  const canOpenOrder = hasPermission('orders:manage');
  const { data: credit, error, loading, refreshing, reload } = useFetch(
    () => (allowed ? customerCreditService.get(id) : Promise.resolve(null)),
    [id, allowed],
  );

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reminderType, setReminderType] = useState<ReminderType>('IN_APP');
  const [busy, setBusy] = useState<string | null>(null);

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title={tr('common.customerCredit')} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.customerCredit')} icon={WalletIcon} allowed={false} />
      </View>
    );
  }
  if (loading || (error && !credit) || !credit) {
    return (
      <View style={styles.screen}>
        <AppHeader title={tr('common.credit')} onBack={navigation.goBack} />
        {loading ? (
          <View style={styles.content}>
            <ListSkeleton rows={4} height={140} />
          </View>
        ) : (
          <ErrorState message={error ?? tr('credit.itMayNotExistOrIt')} onRetry={() => reload()} />
        )}
      </View>
    );
  }

  const open = isOpenCredit(credit.status);
  const status = creditStatus(credit.status);
  const hint = dueHint(credit);
  const collectedPct = credit.creditAmount > 0 ? Math.min(100, Math.round((credit.paidAmount / credit.creditAmount) * 100)) : 0;
  const pendingReminder = credit.reminders.find(r => r.status === 'PENDING');
  const payment = ORDER_PAYMENT_STATUS[credit.order.paymentStatus] ?? { label: credit.order.paymentStatus, tone: 'slate' as const };
  const phone = credit.customer.phone;

  async function sendReminder() {
    setBusy('reminder');
    try {
      const updated = await customerCreditService.sendReminder(id, reminderType);
      const latest = updated?.reminders?.find(r => r.daysBeforeDue === null && r.notificationType === reminderType);
      if (latest?.status === 'FAILED') toast(tr('credit.reminderFailed', { reminderType: reminderTypeLabel(reminderType), reason: latest.failureReason ?? tr('credit.unknownError') }), 'error');
      else toast(tr('credit.remindertypeReminderSentToName', { reminderType: reminderTypeLabel(reminderType), name: credit!.customer.name }));
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function openReceipt(receiptId: string) {
    setBusy(receiptId);
    try {
      await openPdf(`/orders/${credit!.order.id}/receipts/${receiptId}/pdf`, `receipt-${credit!.idd}-${receiptId.slice(0, 8)}.pdf`);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  // Oldest first: order → paid at order → credit → payments.
  const timeline: { key: string; date: string; title: string; amount?: string; detail?: string; tone: string; receiptId?: string | null }[] = [
    { key: 'order', date: credit.order.orderDate, title: tr('common.orderPlaced'), amount: formatRupees(credit.order.totalAmount), detail: credit.order.orderNumber, tone: colors.textMuted },
    ...(credit.order.paidAtOrder > 0
      ? [{ key: 'paid', date: credit.createdAt, title: tr('credit.paidAtOrder'), amount: formatRupees(credit.order.paidAtOrder), tone: colors.success, receiptId: credit.order.receiptId }]
      : []),
    {
      key: 'credit',
      date: credit.createdAt,
      title: tr('credit.customerCreditCreated'),
      amount: formatRupees(credit.creditAmount),
      detail: tr('credit.dueDuedate', { dueDate: formatDay(credit.dueDate) }),
      tone: '#8b5cf6',
      // With nothing paid at order, the order receipt records the credit.
      receiptId: credit.order.paidAtOrder > 0 ? null : credit.order.receiptId,
    },
    ...[...credit.payments].reverse().map(p => ({
      key: p.id,
      date: p.paymentDate,
      title: tr('credit.paymentReceived'),
      amount: formatRupees(p.amount),
      detail: [methodLabel(p.paymentMethod), p.referenceNumber ? tr('common.refReferencenumber', { referenceNumber: p.referenceNumber }) : null, p.notes].filter(Boolean).join(' · '),
      tone: colors.success,
      receiptId: p.receiptId,
    })),
  ];

  return (
    <View style={styles.screen}>
      <AppHeader title={credit.customer.name} subtitle={credit.idd} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <View style={styles.head}>
          <View style={styles.headTop}>
            <Text style={styles.headName} numberOfLines={1}>
              {credit.customer.name}
            </Text>
            <Badge label={status.label} tone={status.tone} />
          </View>
          <Text style={styles.headMeta}>
            {tr('credit.iddOrderOrdernumber', { idd: credit.idd, orderNumber: credit.order.orderNumber })}
            {hint ? <Text style={credit.overdueDays > 0 ? styles.overdueText : undefined}>{` · ${hint}`}</Text> : null}
          </Text>
          <View style={styles.actions}>
            {phone ? <ActionButton icon={<PhoneIcon size={16} color={colors.text} />} label={tr('common.call')} onPress={() => Linking.openURL(`tel:${phone}`)} /> : null}
            {open ? <ActionButton icon={<EditIcon size={16} color={colors.text} />} label={tr('common.edit')} onPress={() => setEditOpen(true)} /> : null}
          </View>
          {open ? <Button title={tr('credit.receivePayment')} onPress={() => setReceiveOpen(true)} icon={<WalletIcon size={18} color={colors.white} />} /> : null}
        </View>

        {credit.status === 'OVERDUE' ? (
          <View style={styles.overdue}>
            <AlertCircleIcon size={20} color={colors.error} />
            <View style={styles.flex}>
              <Text style={styles.overdueTitle}>
                {`${tr('common.daysOverdue', { count: credit.overdueDays })} · ${tr('credit.amountOutstanding', { amount: formatRupees(credit.outstandingAmount) })}`}
              </Text>
              <Text style={styles.overdueBody}>
                {tr('credit.wasDueOnDuedateContactThe', { dueDate: formatDay(credit.dueDate) })}
              </Text>
            </View>
          </View>
        ) : null}

        <Card title={tr('credit.amounts')} icon={WalletIcon}>
          <View style={styles.tiles}>
            <Tile label={tr('common.credit')} value={formatRupees(credit.creditAmount)} bg="#f5f3ff" fg="#5b21b6" />
            <Tile label={tr('credit.totalPaid')} value={formatRupees(credit.paidAmount)} bg="#ecfdf5" fg="#065f46" />
            <Tile
              label={tr('common.outstanding')}
              value={formatRupees(credit.outstandingAmount)}
              bg={credit.status === 'OVERDUE' ? '#fef2f2' : '#fff7ed'}
              fg={credit.status === 'OVERDUE' ? '#991b1b' : '#9a3412'}
            />
            <Tile label={tr('credit.dueDate')} value={formatDay(credit.dueDate)} bg={colors.background} fg={colors.text} />
          </View>
          <View style={styles.progressHead}>
            <Text style={styles.progressLabel}>{tr('common.collected')}</Text>
            <Text style={styles.progressLabel}>{`${collectedPct}%`}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${collectedPct}%`, backgroundColor: collectedPct === 100 ? colors.success : colors.secondary }]} />
          </View>
          <View style={styles.rows}>
            <Row label={tr('common.orderTotal')} value={formatRupees(credit.order.totalAmount)} />
            <Row label={tr('credit.paidAtOrder')} value={formatRupees(credit.order.paidAtOrder)} />
            <Row label={tr('credit.creditAmount')} value={formatRupees(credit.creditAmount)} />
            <Row label={tr('credit.paidAgainstCredit')} value={formatRupees(credit.paidAmount)} />
            <Row label={tr('common.outstanding')} value={formatRupees(credit.outstandingAmount)} strong />
          </View>
          {credit.notes ? <Text style={styles.notes}>{credit.notes}</Text> : null}
        </Card>

        <Card title={tr('common.paymentHistory')} icon={CalendarIcon}>
          <View style={styles.timeline}>
            {timeline.map(entry => (
              <TimelineItem key={entry.key} tone={entry.tone}>
                <View style={styles.entryTop}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  {entry.amount ? <Text style={styles.entryAmount}>{entry.amount}</Text> : null}
                </View>
                <Text style={styles.entryMeta}>{`${formatDay(entry.date)}${entry.detail ? ` · ${entry.detail}` : ''}`}</Text>
                {entry.receiptId ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy === entry.receiptId}
                    onPress={() => openReceipt(entry.receiptId!)}
                    hitSlop={6}
                    style={styles.receipt}
                  >
                    <FileTextIcon size={13} color={colors.secondary} />
                    <Text style={styles.receiptText}>{busy === entry.receiptId ? tr('credit.opening') : tr('common.receipt')}</Text>
                  </Pressable>
                ) : null}
              </TimelineItem>
            ))}
            <TimelineItem tone={credit.outstandingAmount === 0 ? colors.successDark : colors.secondary} last>
              <View style={styles.entryTop}>
                <Text style={styles.entryTitle}>{tr('credit.outstandingOutstandingamount', { outstandingAmount: formatRupees(credit.outstandingAmount) })}</Text>
                <Badge label={status.label} tone={status.tone} />
              </View>
            </TimelineItem>
          </View>
          {!credit.payments.length ? <Text style={styles.muted}>{tr('credit.noPaymentsReceivedAgainstThisCredit')}</Text> : null}
        </Card>

        <Card title={tr('common.customer')} icon={UserIcon} action={credit.customer.registered ? null : <Text style={styles.muted}>{tr('credit.walkIn')}</Text>}>
          <Text style={styles.customerName}>{credit.customer.name}</Text>
          {phone ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.contact}>
              <PhoneIcon size={14} color={colors.secondary} />
              <Text style={styles.contactLink}>{phone}</Text>
            </Pressable>
          ) : null}
          {credit.customer.email ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${credit.customer.email}`)} style={styles.contact}>
              <MailIcon size={14} color={colors.textSecondary} />
              <Text style={styles.contactText}>{credit.customer.email}</Text>
            </Pressable>
          ) : null}
        </Card>

        <Card
          title={tr('common.order')}
          icon={ShoppingBagIcon}
          action={
            canOpenOrder ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => navigation.navigate('OrderDetail', { id: credit.order.id })}>
                <Text style={styles.link}>{tr('common.openOrder')}</Text>
              </Pressable>
            ) : null
          }
        >
          <Row label={tr('credit.orderId')} value={credit.order.orderNumber} />
          <Row label={tr('credit.orderDate')} value={formatDay(credit.order.orderDate)} />
          <Row label={tr('common.store')} value={credit.store.name ?? '—'} />
          <View style={styles.badgeRow}>
            <Text style={styles.badgeLabel}>{tr('common.payment')}</Text>
            <Badge label={payment.label} tone={payment.tone} />
          </View>
        </Card>

        <Card title={tr('credit.reminders')} icon={BellIcon}>
          <Row label={tr('common.reminder')} value={credit.reminderEnabled ? 'On' : 'Off'} />
          {credit.reminderEnabled ? (
            <>
              <Row
                label={tr('common.when')}
                value={credit.reminderDays === 0 ? tr('credit.onTheDueDate') : tr('orders.daysBefore', { count: credit.reminderDays })}
              />
              <Row label={tr('credit.channels')} value={credit.reminderChannels.map(reminderTypeLabel).join(', ')} />
              {pendingReminder ? <Row label={tr('credit.nextReminder')} value={formatDay(pendingReminder.reminderDate)} /> : null}
            </>
          ) : null}

          {open ? (
            <View style={styles.sendBlock}>
              <Text style={styles.sendLabel}>{tr('credit.sendAReminderNow')}</Text>
              <View style={styles.channels}>
                {REMINDER_TYPES.map(t => {
                  const on = t.value === reminderType;
                  return (
                    <Pressable
                      key={t.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setReminderType(t.value)}
                      style={[styles.channel, on && styles.channelOn]}
                    >
                      <Text style={[styles.channelText, on && styles.channelTextOn]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Button
                title={tr('credit.sendNow')}
                variant="ghost"
                loading={busy === 'reminder'}
                onPress={sendReminder}
                icon={<BellIcon size={16} color={colors.secondary} />}
                style={styles.sendBtn}
              />
            </View>
          ) : null}

          {credit.reminders.length ? (
            <View style={styles.reminders}>
              {credit.reminders.map(r => {
                const rs = REMINDER_STATUS[r.status] ?? REMINDER_STATUS.PENDING;
                return (
                  <View key={r.id} style={styles.reminder}>
                    <View style={styles.flex}>
                      <Text style={styles.reminderTitle}>{`${reminderTypeLabel(r.notificationType)} · ${formatDay(r.reminderDate)}`}</Text>
                      <Text style={styles.reminderMeta}>
                        {r.daysBeforeDue === null
                          ? tr('credit.sentManually')
                          : r.daysBeforeDue === 0
                            ? tr('credit.onDueDate')
                            : tr('credit.daysBeforeDue', { count: r.daysBeforeDue })}
                        {r.failureReason ? ` · ${r.failureReason}` : ''}
                      </Text>
                    </View>
                    <Badge label={rs.label} tone={rs.tone} />
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.muted}>{tr('credit.noReminders')}</Text>
          )}
        </Card>

        {/* A credit can be cancelled only before anything is paid against it. */}
        {open && credit.paidAmount === 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setCancelOpen(true)} hitSlop={8} style={styles.cancel}>
            <Text style={styles.cancelText}>{tr('credit.cancelThisCredit2')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <ReceivePaymentSheet
        credit={
          receiveOpen
            ? {
                id: credit.id,
                idd: credit.idd,
                customerName: credit.customer.name,
                orderNumber: credit.order.orderNumber,
                outstandingAmount: credit.outstandingAmount,
                dueDate: credit.dueDate,
              }
            : null
        }
        onClose={() => setReceiveOpen(false)}
        onReceived={() => {
          setReceiveOpen(false);
          reload();
        }}
      />
      <EditCreditSheet
        credit={editOpen ? credit : null}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          reload();
        }}
      />
      <CancelCreditSheet
        credit={cancelOpen ? credit : null}
        onClose={() => setCancelOpen(false)}
        onCancelled={() => {
          setCancelOpen(false);
          reload();
        }}
      />
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Tile({ label, value, bg, fg }: { label: string; value: string; bg: string; fg: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: bg }]}>
      <Text style={[styles.tileLabel, { color: fg }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function TimelineItem({ tone, last, children }: { tone: string; last?: boolean; children: ReactNode }) {
  return (
    <View style={styles.item}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        {last ? null : <View style={styles.line} />}
      </View>
      <View style={[styles.flex, !last && styles.itemBody]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  head: { gap: 10 },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headName: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  headMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  overdueText: { fontFamily: fonts.semibold, color: colors.error },
  actions: { flexDirection: 'row', gap: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionPressed: { backgroundColor: colors.background },
  actionText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  overdue: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  overdueTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: '#991b1b' },
  overdueBody: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.errorDark },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: radius.md },
  tileLabel: { fontFamily: fonts.regular, fontSize: 12, opacity: 0.85 },
  tileValue: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 17 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  progressLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  fill: { height: 8, borderRadius: 4 },
  rows: { marginTop: 12, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  notes: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: colors.background, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  timeline: { paddingLeft: 2 },
  item: { flexDirection: 'row', gap: 12 },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  line: { flex: 1, width: 2, marginTop: 2, backgroundColor: '#f1f5f9' },
  itemBody: { paddingBottom: 16 },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  entryTitle: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  entryAmount: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  entryMeta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start' },
  receiptText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
  muted: { marginTop: 6, fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  customerName: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  contactLink: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.secondary },
  contactText: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  badgeLabel: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  sendBlock: { marginTop: 12, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sendLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  channels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  channel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  channelOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  channelText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  channelTextOn: { color: colors.secondaryDark },
  sendBtn: { height: 44, borderWidth: 1, borderColor: colors.secondarySoft },
  reminders: { marginTop: 12, gap: 8 },
  reminder: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 8, backgroundColor: colors.background },
  reminderTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  reminderMeta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted },
  cancel: { alignSelf: 'flex-start', paddingVertical: 4 },
  cancelText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
});
