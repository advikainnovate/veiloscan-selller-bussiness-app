import React, { useState, type ComponentType } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { addDaysISO, formatDay, formatWhen } from '../../lib/date';
import { formatNumber, formatRupees } from '../../lib/format';
import {
  addressText,
  canCancelPickup,
  isMeasured,
  isPickupOrder,
  isQuickSale,
  methodLabel,
  nextPickupAction,
  orderDiscountInfo,
  orderStatusLabel,
  orderStatusTone,
  PICKUP_STEPS,
  type OrderItem,
} from '../../lib/orders';
import { orderService } from '../../services/order-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, Row } from '../../components/ui/Card';
import { Sheet } from '../../components/ui/Sheet';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { CollectPaymentSheet } from '../../components/orders/CollectPaymentSheet';
import { OrderDocuments } from '../../components/orders/OrderDocuments';
import {
  AlertCircleIcon,
  BoxIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  WalletIcon,
  type IconProps,
} from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One order: where it stands, what's in it, who it's for, and the next step. */
export function OrderDetailScreen({ navigation, route }: ScreenProps<'OrderDetail'>) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const order = useFetch(() => orderService.get(id), [id]);
  const payments = useFetch(() => orderService.payments(id), [id]);
  const [saving, setSaving] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const reloadAll = async (asRefresh = false) => {
    await Promise.all([order.reload(asRefresh), payments.reload(asRefresh)]);
  };

  if (order.loading || (!order.data && !order.error)) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Order" onBack={navigation.goBack} />
        <View style={styles.content}>
          <ListSkeleton rows={4} height={120} />
        </View>
      </View>
    );
  }
  if (!order.data) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Order" onBack={navigation.goBack} />
        <ErrorState message={order.error ?? "This order couldn't be loaded."} onRetry={() => order.reload()} />
      </View>
    );
  }

  const o = order.data;
  const pay = payments.data;
  const items = o.items ?? [];
  const pickup = isPickupOrder(o);
  const status = o.orderStatus;
  const next = pickup ? nextPickupAction(status) : null;
  const cancellable = pickup && canCancelPickup(status);
  const currentStep = PICKUP_STEPS.findIndex(step => step.status === status);
  const amountDue = pay?.amountDue ?? 0;
  // Completing a pickup collects its payment first, unless it's already settled.
  // Until the payments load, assume there is something to collect.
  const collectsPayment = next?.status === 'DELIVERED' && (!pay || amountDue > 0);
  const canGiveCredit = collectsPayment && !!pay?.creditAllowed && !pay?.credit;
  const credit = pay?.credit && pay.credit.status !== 'CANCELLED' ? pay.credit : null;
  const paidTotal = pay ? round2(pay.payments.reduce((sum, p) => sum + p.amount, 0) || pay.paidAtOrder) : null;
  const pendingRequest = pay?.creditRequest?.status === 'PENDING' ? pay.creditRequest : null;

  const itemsTotal = round2(items.reduce((sum, item) => sum + Number(item.finalPrice) * item.quantity, 0));
  const itemsGross = round2(items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0));
  // The whole order is the seller's (a single-store order): show its discounts by kind.
  const wholeOrder = Math.abs(itemsTotal - Number(o.subtotal ?? NaN)) < 0.02;
  const couponOff = Number(o.couponDiscount ?? 0) || 0;
  const orderOff = Number(o.orderDiscountAmount ?? 0) || 0;
  const itemOff = round2(Math.max(0, itemsGross - itemsTotal - couponOff - orderOff));
  const discount = orderDiscountInfo(o);
  const units = items.reduce((sum, item) => sum + (isMeasured(item) ? 1 : item.quantity), 0);
  const address = addressText(o.customerAddress);

  async function run(key: string, action: () => Promise<unknown>, message: string) {
    setSaving(key);
    try {
      await action();
      toast(message);
      await reloadAll();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(null);
    }
  }

  const move = (nextStatus: string, reason?: string) =>
    run(
      nextStatus,
      () => orderService.updatePickupStatus(id, nextStatus, reason),
      nextStatus === 'CANCELLED'
        ? 'Order cancelled'
        : `Order marked ${orderStatusLabel({ orderStatus: nextStatus, fulfillmentType: 'PICKUP' }).toLowerCase()}`,
    );

  // Picked up on Customer Credit: nothing collected now; the whole balance is owed by the credit period.
  const giveOnCredit = () => {
    if (!pay) return;
    const dueDate = addDaysISO(pay.maxCreditDays);
    return run(
      'credit',
      () => orderService.recordPayment(id, { payments: [], credit: { amount: pay.amountDue, dueDate }, completeOrder: true }),
      `Picked up · ${formatRupees(pay.amountDue)} on credit until ${formatDay(dueDate)}`,
    );
  };

  const showActions = !!next || cancellable;

  return (
    <View style={styles.screen}>
      <AppHeader
        title={o.uniqueOrderId}
        subtitle={`${pickup ? 'Store pickup' : 'Delivery'}${o.store?.name ? ` · ${o.store.name}` : ''}`}
        onBack={navigation.goBack}
      />
      <ScrollView
        contentContainerStyle={[styles.content, showActions && { paddingBottom: 110 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={order.refreshing}
            onRefresh={() => reloadAll(true)}
            tintColor={colors.secondary}
            colors={[colors.secondary]}
          />
        }
      >
        {/* Where it stands */}
        <Card>
          <View style={styles.statusRow}>
            <Badge label={orderStatusLabel(o)} tone={orderStatusTone(status)} />
            {isQuickSale(o) ? <Badge label="Quick Sale" tone="orange" /> : null}
            {wholeOrder && discount ? (
              // "20% off · −₹60"; a flat discount already says its amount ("₹60 off").
              <Badge label={discount.label.includes('%') ? `${discount.label} · −${formatRupees(discount.amount)}` : discount.label} tone="green" />
            ) : null}
          </View>
          <Text style={styles.placed}>Placed {formatWhen(o.createdAt)}</Text>

          {pickup && status === 'CANCELLED' ? (
            <View style={styles.cancelled}>
              <AlertCircleIcon size={18} color={colors.error} />
              <View style={styles.flex}>
                <Text style={styles.cancelledTitle}>Cancelled {formatWhen(o.orderStatusTimestamp)}</Text>
                {o.cancellationReason ? <Text style={styles.cancelledText}>Reason: {o.cancellationReason}</Text> : null}
              </View>
            </View>
          ) : pickup ? (
            <View style={styles.steps}>
              {PICKUP_STEPS.map((step, index) => {
                const done = index < currentStep || status === 'DELIVERED';
                const current = index === currentStep && status !== 'DELIVERED';
                return (
                  <View key={step.status} style={styles.step}>
                    {index > 0 ? <View style={[styles.stepLine, (done || current) && styles.stepLineDone]} /> : null}
                    <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotCurrent]}>
                      {done ? (
                        <CheckIcon size={13} color={colors.white} strokeWidth={3} />
                      ) : (
                        <Text style={[styles.stepNum, current && styles.stepNumCurrent]}>{index + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.stepLabel, (done || current) && styles.stepLabelActive]}>{step.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </Card>

        {/* A customer asked to pay part later. */}
        {pendingRequest ? (
          <View style={styles.request}>
            <Text style={styles.requestTitle}>Customer asked for credit</Text>
            <Text style={styles.requestText}>
              Pay {formatRupees(pendingRequest.payNow)} now and {formatRupees(pendingRequest.creditAmount)} by{' '}
              {formatDay(pendingRequest.dueDate)}.{pendingRequest.note ? ` “${pendingRequest.note}”` : ''}
            </Text>
            <View style={styles.requestActions}>
              <Button
                title="Decline"
                variant="ghost"
                loading={saving === 'decline'}
                disabled={!!saving}
                onPress={() => run('decline', () => orderService.decideCreditRequest(id, false), 'Credit request declined')}
                style={styles.flex}
              />
              <Button
                title="Approve"
                loading={saving === 'approve'}
                disabled={!!saving}
                onPress={() => run('approve', () => orderService.decideCreditRequest(id, true), 'Credit request approved')}
                style={styles.flex}
              />
            </View>
          </View>
        ) : null}

        {/* At a glance */}
        <View style={styles.tiles}>
          <Tile icon={WalletIcon} tone={['#e0e7ff', '#4f46e5']} label="Order total" value={formatRupees(wholeOrder ? Number(o.totalAmount) : itemsTotal)} />
          <Tile
            icon={CheckCircleIcon}
            tone={['#dcfce7', '#16a34a']}
            label="Paid"
            value={paidTotal === null ? '…' : formatRupees(paidTotal)}
            hint={pay?.payments.length ? pay.payments.map(p => methodLabel(p.method)).join(' + ') : o.paymentMode === 'COD' ? 'Pay at store' : 'Online'}
          />
          {credit ? (
            <Tile icon={WalletIcon} tone={['#f3e8ff', '#9333ea']} label="On credit" value={formatRupees(credit.outstandingAmount)} hint={`Due ${formatDay(credit.dueDate)}`} />
          ) : (
            <Tile
              icon={ClockIcon}
              tone={amountDue > 0 ? ['#fff1e6', '#ff6b00'] : ['#f1f5f9', '#64748b']}
              label="Still due"
              value={pay ? formatRupees(amountDue) : '…'}
              hint={amountDue > 0 ? 'To collect' : 'Nothing to collect'}
            />
          )}
          <Tile icon={BoxIcon} tone={['#fef3c7', '#d97706']} label="Items" value={String(items.length)} hint={`${units} unit${units === 1 ? '' : 's'}`} />
        </View>

        <Card title={`Items (${items.length})`} icon={BoxIcon} padded={false}>
          {items.map((item, index) => (
            <ItemRow key={item.id} item={item} last={index === items.length - 1} />
          ))}
        </Card>

        <Card title="Bill" icon={FileTextIcon}>
          <Row label="Items" value={formatRupees(wholeOrder ? itemsGross : itemsTotal)} />
          {wholeOrder && itemOff > 0 ? <Row label="Item discounts" value={`−${formatRupees(itemOff)}`} tone={colors.successDark} /> : null}
          {wholeOrder && orderOff > 0 ? <Row label="Order discount" value={`−${formatRupees(orderOff)}`} tone={colors.successDark} /> : null}
          {wholeOrder && couponOff > 0 ? <Row label="Coupon" value={`−${formatRupees(couponOff)}`} tone={colors.successDark} /> : null}
          {wholeOrder && Number(o.taxAmount) > 0 ? <Row label="GST (included)" value={formatRupees(Number(o.taxAmount))} /> : null}
          <View style={styles.divider} />
          <Row label="Total" value={formatRupees(wholeOrder ? Number(o.totalAmount) : itemsTotal)} strong />
        </Card>

        <Card title="Customer" icon={UserIcon}>
          {isQuickSale(o) ? (
            <Text style={styles.muted}>Quick Sale — sold without customer details.</Text>
          ) : (
            <View style={styles.customer}>
              <Text style={styles.customerName}>{o.customerName || 'Registered customer'}</Text>
              {o.customerPhone ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${o.customerPhone}`}
                  onPress={() => Linking.openURL(`tel:${o.customerPhone}`)}
                  style={styles.line}
                >
                  <PhoneIcon size={16} color={colors.secondary} />
                  <Text style={styles.link}>{o.customerPhone}</Text>
                </Pressable>
              ) : null}
              {address ? (
                <View style={styles.line}>
                  <MapPinIcon size={16} color={colors.textMuted} />
                  <Text style={styles.lineText}>{address}</Text>
                </View>
              ) : null}
              {o.customerNote ? (
                <View style={styles.note}>
                  <Text style={styles.noteLabel}>Note from customer</Text>
                  <Text style={styles.noteText}>{o.customerNote}</Text>
                </View>
              ) : null}
            </View>
          )}
        </Card>

        {pay && (pay.payments.length > 0 || credit) ? (
          <Card title="Payments" icon={WalletIcon}>
            {pay.payments.map(p => (
              <Row
                key={p.id}
                label={`${methodLabel(p.method)}${p.referenceNumber ? ` · ${p.referenceNumber}` : ''}${p.paidAt ? `\n${formatWhen(p.paidAt)}` : ''}`}
                value={formatRupees(p.amount)}
              />
            ))}
            {credit ? (
              <Row
                label={`Customer Credit ${credit.idd}\nDue ${formatDay(credit.dueDate)} · ${credit.status.toLowerCase()}`}
                value={formatRupees(credit.outstandingAmount)}
                tone="#7c3aed"
              />
            ) : null}
          </Card>
        ) : null}

        <OrderDocuments orderId={id} delivered={status === 'DELIVERED'} />
      </ScrollView>

      {/* The next step, always in reach */}
      {showActions ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
          {cancellable ? (
            <Pressable
              accessibilityRole="button"
              disabled={!!saving}
              onPress={() => setCancelling(true)}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
          {next && collectsPayment ? (
            <>
              {canGiveCredit ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={!!saving}
                  onPress={giveOnCredit}
                  style={({ pressed }) => [styles.creditBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.creditText}>{saving === 'credit' ? 'Saving…' : 'On credit'}</Text>
                </Pressable>
              ) : null}
              <Button title="Collect payment" disabled={!!saving || !pay} onPress={() => setCollecting(true)} style={styles.flex} />
            </>
          ) : next ? (
            <Button
              title={next.label}
              loading={saving === next.status}
              disabled={!!saving}
              onPress={() => move(next.status)}
              style={styles.flex}
            />
          ) : null}
        </View>
      ) : null}

      {pay ? (
        <CollectPaymentSheet
          visible={collecting}
          orderId={id}
          summary={pay}
          onClose={() => setCollecting(false)}
          onDone={() => {
            setCollecting(false);
            reloadAll();
          }}
        />
      ) : null}

      <Sheet
        visible={cancelling}
        title="Cancel this order?"
        subtitle="The customer is told the order was cancelled. This can't be undone."
        onClose={() => setCancelling(false)}
        footer={
          <Button
            title="Cancel order"
            loading={saving === 'CANCELLED'}
            onPress={async () => {
              await move('CANCELLED', cancelReason.trim() || undefined);
              setCancelling(false);
              setCancelReason('');
            }}
          />
        }
      >
        <TextInput
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder="Reason (optional) — e.g. item out of stock"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.secondary}
          multiline
          style={styles.reason}
        />
      </Sheet>
    </View>
  );
}

function Tile({
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
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: tone[0] }]}>
        <Icon size={18} color={tone[1]} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.tileHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function ItemRow({ item, last }: { item: OrderItem; last: boolean }) {
  const measured = isMeasured(item);
  const qty = measured ? `${item.soldQuantity} ${item.soldUom}` : `${formatNumber(item.quantity)} × ${formatRupees(Number(item.finalPrice))}`;
  return (
    <View style={[styles.item, !last && styles.itemBorder]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, styles.itemImageEmpty]}>
          <BoxIcon size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.productName}
        </Text>
        {item.variantLabel ? <Text style={styles.itemMeta}>{item.variantLabel}</Text> : null}
        <Text style={styles.itemMeta}>
          {qty}
          {item.sku ? ` · ${item.sku}` : ''}
        </Text>
      </View>
      <Text style={styles.itemTotal}>{formatRupees(round2(Number(item.finalPrice) * item.quantity))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  placed: { marginTop: 8, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  cancelled: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
  },
  cancelledTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.errorDark },
  cancelledText: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, color: colors.errorDark },
  steps: { marginTop: 16, flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  stepLine: { position: 'absolute', top: 13, right: '50%', width: '100%', height: 2, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: '#4ade80' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  stepDotDone: { backgroundColor: colors.success },
  stepDotCurrent: { backgroundColor: colors.secondary, borderWidth: 4, borderColor: colors.secondaryLight, width: 32, height: 32, borderRadius: 16, marginTop: -2 },
  stepNum: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  stepNumCurrent: { color: colors.white },
  stepLabel: { marginTop: 6, fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted, textAlign: 'center' },
  stepLabelActive: { fontFamily: fonts.bold, color: colors.text },
  request: { padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: '#ddd6fe', backgroundColor: '#faf5ff', gap: 6 },
  requestTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: '#5b21b6' },
  requestText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#6d28d9' },
  requestActions: { marginTop: 6, flexDirection: 'row', gap: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  tileValue: { marginTop: 2, fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  tileHint: { marginTop: 2, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemImage: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.background },
  itemImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  itemMeta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  itemTotal: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  divider: { marginVertical: 6, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  muted: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  customer: { gap: 8 },
  customerName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.secondary },
  note: { marginTop: 4, padding: 10, borderRadius: radius.md, backgroundColor: colors.warningLight },
  noteLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.warningDark },
  noteText: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warningDark },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.raised,
  },
  pressed: { opacity: 0.7 },
  cancelBtn: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.error },
  creditBtn: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: '#faf5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditText: { fontFamily: fonts.bold, fontSize: 15, color: '#6d28d9' },
  reason: {
    minHeight: 96,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
});
