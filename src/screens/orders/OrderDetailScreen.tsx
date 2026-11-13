import React, { useState } from 'react';
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
import { Gradient } from '../../components/ui/Gradient';
import { Sheet } from '../../components/ui/Sheet';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { CollectPaymentSheet } from '../../components/orders/CollectPaymentSheet';
import { OrderDocuments } from '../../components/orders/OrderDocuments';
import { EditOrderSheet } from '../../components/orders/EditOrderSheet';
import {
  AlertCircleIcon,
  BoxIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  EditIcon,
  FileTextIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  WalletIcon,
} from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One order: where it stands, what's in it, who it's for, and the next step. */
export function OrderDetailScreen({ navigation, route }: ScreenProps<'OrderDetail'>) {
  const { t } = useTranslation();
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const order = useFetch(() => orderService.get(id), [id]);
  const payments = useFetch(() => orderService.payments(id), [id]);
  const [saving, setSaving] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [editing, setEditing] = useState(false);

  const reloadAll = async (asRefresh = false) => {
    await Promise.all([order.reload(asRefresh), payments.reload(asRefresh)]);
  };

  if (order.loading || (!order.data && !order.error)) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('common.order')} onBack={navigation.goBack} />
        <View style={styles.content}>
          <ListSkeleton rows={4} height={120} />
        </View>
      </View>
    );
  }
  if (!order.data) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('common.order')} onBack={navigation.goBack} />
        <ErrorState message={order.error ?? t('orders.thisOrderCouldnTBeLoaded')} onRetry={() => order.reload()} />
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
        ? t('orders.orderCancelled')
        : t('orders.orderMarkedStatus', { status: orderStatusLabel({ orderStatus: nextStatus, fulfillmentType: 'PICKUP' }).toLowerCase() }),
    );

  // Picked up on Customer Credit: nothing collected now; the whole balance is owed by the credit period.
  const giveOnCredit = () => {
    if (!pay) return;
    const dueDate = addDaysISO(pay.maxCreditDays);
    return run(
      'credit',
      () => orderService.recordPayment(id, { payments: [], credit: { amount: pay.amountDue, dueDate }, completeOrder: true }),
      t('orders.pickedUpAmountdueOnCreditUntil', { amountDue: formatRupees(pay.amountDue), dueDate: formatDay(dueDate) }),
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
        contentContainerStyle={[styles.content, { paddingBottom: (showActions ? 110 : 24) + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={order.refreshing}
            onRefresh={() => reloadAll(true)}
            tintColor={colors.secondary}
            colors={[colors.secondary]}
          />
        }
      >
        {/* Where it stands: the total, what's paid and due, and the pickup steps */}
        <View style={styles.hero}>
          <Gradient colors={[colors.primary, '#0b2a52']} direction="diagonal" borderRadius={22} />
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <Badge label={orderStatusLabel(o)} tone={orderStatusTone(status)} />
            {isQuickSale(o) ? <Badge label={t('orders.quickSale2')} tone="orange" /> : null}
            {wholeOrder && discount ? (
              // "20% off · −₹60"; a flat discount already says its amount ("₹60 off").
              <Badge label={discount.label.includes('%') ? `${discount.label} · −${formatRupees(discount.amount)}` : discount.label} tone="green" />
            ) : null}
          </View>
          <Text style={styles.heroLabel}>{t('common.orderTotal')}</Text>
          <Text style={styles.heroTotal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatRupees(wholeOrder ? Number(o.totalAmount) : itemsTotal)}
          </Text>
          <Text style={styles.heroMeta}>
            {[t('orders.placedOn', { when: formatWhen(o.createdAt) }), t('common.itemCount', { count: items.length }), units !== items.length ? t('common.unitsValue', { units }) : null].filter(Boolean).join(' · ')}
          </Text>

          <View style={styles.heroStats}>
            <HeroStat label={t('common.paid')} value={paidTotal === null ? '…' : formatRupees(paidTotal)} dot="#4ade80" />
            {credit ? (
              <HeroStat label={t('orders.creditDueDuedate', { dueDate: formatDay(credit.dueDate) })} value={formatRupees(credit.outstandingAmount)} dot="#c084fc" />
            ) : (
              <HeroStat label={amountDue > 0 ? t('orders.toCollect') : t('common.due')} value={pay ? formatRupees(amountDue) : '…'} dot={amountDue > 0 ? '#ff8a33' : '#94a3b8'} />
            )}
            <HeroStat
              label={t('common.payment')}
              value={pay?.payments.length ? pay.payments.map(p => methodLabel(p.method)).join(' + ') : o.paymentMode === 'COD' ? 'At store' : 'Online'}
            />
          </View>

          {pickup && status === 'CANCELLED' ? (
            <View style={styles.cancelled}>
              <AlertCircleIcon size={18} color="#fca5a5" />
              <View style={styles.flex}>
                <Text style={styles.cancelledTitle}>{t('orders.cancelledOrderstatustimestamp', { orderStatusTimestamp: formatWhen(o.orderStatusTimestamp) })}</Text>
                {o.cancellationReason ? <Text style={styles.cancelledText}>{t('orders.reasonCancellationreason', { cancellationReason: o.cancellationReason })}</Text> : null}
              </View>
            </View>
          ) : pickup ? (
            <View style={styles.steps}>
              {PICKUP_STEPS.map((step, index) => {
                const done = index < currentStep || status === 'DELIVERED';
                const current = index === currentStep && status !== 'DELIVERED';
                // The step reaching the next one is lit once that one is reached.
                const nextReached = index + 1 <= currentStep || status === 'DELIVERED';
                return (
                  <View key={step.status} style={styles.step}>
                    {/* Each step draws its own half of the connectors, before its
                        circle, so a line never runs over a circle. */}
                    {index > 0 ? (
                      <View style={[styles.stepLine, styles.stepLineLeft, (done || current) && styles.stepLineDone]} />
                    ) : null}
                    {index < PICKUP_STEPS.length - 1 ? (
                      <View style={[styles.stepLine, styles.stepLineRight, nextReached && styles.stepLineDone]} />
                    ) : null}
                    <View style={[styles.stepDotMask, current && styles.stepDotMaskCurrent]}>
                      <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotCurrent]}>
                        {done ? (
                          <CheckIcon size={12} color={colors.white} strokeWidth={3} />
                        ) : (
                          <Text style={[styles.stepNum, current && styles.stepNumCurrent]}>{index + 1}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.stepLabel, (done || current) && styles.stepLabelActive]} numberOfLines={2}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* A customer asked to pay part later. */}
        {pendingRequest ? (
          <View style={styles.request}>
            <View style={styles.requestHead}>
              <View style={styles.requestIcon}>
                <WalletIcon size={16} color="#7c3aed" />
              </View>
              <Text style={styles.requestTitle}>{t('orders.customerAskedForCredit')}</Text>
            </View>
            <Text style={styles.requestText}>
              {t('orders.payNowAndCreditBy', { payNow: formatRupees(pendingRequest.payNow), credit: formatRupees(pendingRequest.creditAmount), date: formatDay(pendingRequest.dueDate) })}
              {pendingRequest.note ? ` “${pendingRequest.note}”` : ''}
            </Text>
            <View style={styles.requestActions}>
              <Button
                title={t('orders.decline')}
                variant="ghost"
                loading={saving === 'decline'}
                disabled={!!saving}
                onPress={() => run('decline', () => orderService.decideCreditRequest(id, false), t('orders.creditRequestDeclined'))}
                style={styles.flex}
              />
              <Button
                title={t('common.approve')}
                loading={saving === 'approve'}
                disabled={!!saving}
                onPress={() => run('approve', () => orderService.decideCreditRequest(id, true), t('orders.creditRequestApproved'))}
                style={styles.flex}
              />
            </View>
          </View>
        ) : null}

        {/* Who it's for */}
        <View style={styles.card}>
          {isQuickSale(o) ? (
            <View style={styles.customerRow}>
              <View style={[styles.avatar, styles.avatarMuted]}>
                <UserIcon size={18} color={colors.textMuted} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.customerName}>{t('common.walkInCustomer')}</Text>
                <Text style={styles.meta}>{t('orders.quickSaleSoldWithoutCustomerDetails')}</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.customerRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(o.customerName)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.customerName} numberOfLines={1}>
                    {o.customerName || t('orders.registeredCustomer')}
                  </Text>
                  <Text style={styles.meta}>{o.customerPhone || t('common.customer')}</Text>
                </View>
                {o.customerPhone ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={t('orders.callCustomerphone', { customerPhone: o.customerPhone })}
                    hitSlop={6}
                    onPress={() => Linking.openURL(`tel:${o.customerPhone}`)}
                    style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
                  >
                    <PhoneIcon size={18} color={colors.secondary} />
                  </Pressable>
                ) : null}
              </View>
              {address ? (
                <View style={styles.addressRow}>
                  <MapPinIcon size={15} color={colors.textMuted} />
                  <Text style={styles.addressText}>{address}</Text>
                </View>
              ) : null}
              {o.customerNote ? (
                <View style={styles.note}>
                  <Text style={styles.noteLabel}>{t('orders.noteFromCustomer')}</Text>
                  <Text style={styles.noteText}>{o.customerNote}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* What's in it, and the bill */}
        <View style={[styles.card, styles.flush]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('orders.items')}</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{items.length}</Text>
            </View>
          </View>
          {items.map((item, index) => (
            <ItemRow key={item.id} item={item} last={index === items.length - 1} />
          ))}
          <View style={styles.bill}>
            <BillLine label={t('orders.items')} value={formatRupees(wholeOrder ? itemsGross : itemsTotal)} />
            {wholeOrder && itemOff > 0 ? <BillLine label={t('orders.itemDiscounts')} value={`−${formatRupees(itemOff)}`} good /> : null}
            {wholeOrder && orderOff > 0 ? <BillLine label={t('orders.orderDiscount')} value={`−${formatRupees(orderOff)}`} good /> : null}
            {wholeOrder && couponOff > 0 ? <BillLine label={t('common.coupon')} value={`−${formatRupees(couponOff)}`} good /> : null}
            {wholeOrder && Number(o.taxAmount) > 0 ? <BillLine label={t('orders.gstIncluded')} value={formatRupees(Number(o.taxAmount))} /> : null}
            <View style={styles.billTotal}>
              <Text style={styles.billTotalLabel}>{t('common.total')}</Text>
              <Text style={styles.billTotalValue}>{formatRupees(wholeOrder ? Number(o.totalAmount) : itemsTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Money received, and any credit */}
        {pay && (pay.payments.length > 0 || credit) ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, styles.cardTitleSpaced]}>{t('common.payments')}</Text>
            {pay.payments.map(p => (
              <View key={p.id} style={styles.payRow}>
                <View style={[styles.payIcon, styles.payIconPaid]}>
                  <CheckCircleIcon size={15} color="#16a34a" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.payTitle}>{`${methodLabel(p.method)}${p.referenceNumber ? ` · ${p.referenceNumber}` : ''}`}</Text>
                  {p.paidAt ? <Text style={styles.meta}>{formatWhen(p.paidAt)}</Text> : null}
                </View>
                <Text style={styles.payAmount}>{formatRupees(p.amount)}</Text>
              </View>
            ))}
            {credit ? (
              <View style={styles.payRow}>
                <View style={[styles.payIcon, styles.payIconCredit]}>
                  <ClockIcon size={15} color="#7c3aed" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.payTitle}>{t('orders.customerCreditIdd', { idd: credit.idd })}</Text>
                  <Text style={styles.meta}>{t('orders.dueDuedateLowercase', { dueDate: formatDay(credit.dueDate), lowerCase: credit.status.toLowerCase() })}</Text>
                </View>
                <Text style={[styles.payAmount, styles.credit]}>{formatRupees(credit.outstandingAmount)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* The seller's own note, and the panel's edit (status, payment status, remarks) */}
        <View style={styles.card}>
          <View style={styles.remarksHead}>
            <FileTextIcon size={16} color={colors.textSecondary} />
            <Text style={styles.remarksTitle}>{t('orders.remarks')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('orders.editOrder')}
              hitSlop={8}
              onPress={() => setEditing(true)}
              style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
            >
              <EditIcon size={14} color={colors.secondary} />
              <Text style={styles.editText}>{t('orders.editOrder')}</Text>
            </Pressable>
          </View>
          <Text style={o.remarks ? styles.remarksText : styles.meta}>{o.remarks || t('orders.noRemarksTapEditOrderTo')}</Text>
        </View>

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
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
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
                  <Text style={styles.creditText}>{saving === 'credit' ? t('common.saving') : t('common.onCredit')}</Text>
                </Pressable>
              ) : null}
              <Button title={t('orders.collectPayment')} disabled={!!saving || !pay} onPress={() => setCollecting(true)} style={styles.flex} />
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

      <EditOrderSheet
        order={o}
        visible={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          reloadAll();
        }}
      />

      <Sheet
        visible={cancelling}
        title={t('orders.cancelThisOrder')}
        subtitle={t('orders.theCustomerIsToldTheOrder')}
        onClose={() => setCancelling(false)}
        footer={
          <Button
            title={t('common.cancelOrder')}
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
          placeholder={t('orders.reasonOptionalEGItemOut')}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.secondary}
          multiline
          style={styles.reason}
        />
      </Sheet>
    </View>
  );
}

/** "Asha Rao" → "AR". */
const initials = (name: string | null | undefined) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('') || '?';

function HeroStat({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <View style={styles.heroStat}>
      <View style={styles.heroStatHead}>
        {dot ? <View style={[styles.heroDot, { backgroundColor: dot }]} /> : null}
        <Text style={styles.heroStatLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}

function BillLine({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <View style={styles.billLine}>
      <Text style={styles.billLabel}>{label}</Text>
      <Text style={[styles.billValue, good && styles.billGood]}>{value}</Text>
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
        <View style={styles.itemMetaRow}>
          <Text style={styles.qtyChip}>{qty}</Text>
          {item.sku ? (
            <Text style={styles.itemMeta} numberOfLines={1}>
              {item.sku}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.itemTotal}>{formatRupees(round2(Number(item.finalPrice) * item.quantity))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  remarksHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  remarksTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  remarksText: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.text },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.secondarySoft },
  editText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  hero: { overflow: 'hidden', padding: 18, borderRadius: 22, backgroundColor: colors.primary, ...shadow.raised },
  heroGlow: { position: 'absolute', top: -70, right: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,138,51,0.06)' },
  heroTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heroLabel: { marginTop: 16, fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.65)' },
  heroTotal: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 32, letterSpacing: -0.8, color: colors.white },
  heroMeta: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.7)' },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroStat: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroStatHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroDot: { width: 7, height: 7, borderRadius: 4 },
  heroStatLabel: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  heroStatValue: { marginTop: 3, fontFamily: fonts.bold, fontSize: 14.5, color: colors.white },
  cancelled: { marginTop: 14, flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.16)' },
  cancelledTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: '#fecaca' },
  cancelledText: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, color: '#fecaca' },
  steps: { marginTop: 18, flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  stepLine: { position: 'absolute', top: 12, width: '50%', height: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepLineLeft: { left: 0 },
  stepLineRight: { right: 0 },
  stepLineDone: { backgroundColor: '#4ade80' },
  // Opaque backing (the hero's colour) so the translucent circles hide the line.
  stepDotMask: { borderRadius: 15, backgroundColor: colors.primary },
  stepDotMaskCurrent: { marginTop: -2 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  stepDotDone: { backgroundColor: colors.success },
  stepDotCurrent: { width: 30, height: 30, borderRadius: 15, borderWidth: 4, borderColor: 'rgba(255,107,0,0.35)', backgroundColor: colors.secondary },
  stepNum: { fontFamily: fonts.bold, fontSize: 11.5, color: 'rgba(255,255,255,0.55)' },
  stepNumCurrent: { color: colors.white },
  stepLabel: { marginTop: 6, paddingHorizontal: 2, fontFamily: fonts.medium, fontSize: 11, textAlign: 'center', color: 'rgba(255,255,255,0.5)' },
  stepLabelActive: { fontFamily: fonts.semibold, color: colors.white },
  request: { gap: 8, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#ddd6fe', backgroundColor: '#faf5ff' },
  requestHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ede9fe' },
  requestTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: '#5b21b6' },
  requestText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#6d28d9' },
  requestActions: { marginTop: 4, flexDirection: 'row', gap: 10 },
  card: { padding: 14, borderRadius: 18, backgroundColor: colors.surface, ...shadow.card },
  flush: { paddingHorizontal: 0, paddingBottom: 0, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 4 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  cardTitleSpaced: { marginBottom: 4 },
  countPill: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  countText: { fontFamily: fonts.bold, fontSize: 12, color: colors.secondaryDark },
  meta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  avatarMuted: { backgroundColor: colors.background },
  avatarText: { fontFamily: fonts.bold, fontSize: 15, color: colors.secondaryDark },
  customerName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  callBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.secondarySoft, backgroundColor: colors.secondaryLight },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  addressText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  note: { marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: colors.warningLight },
  noteLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.warningDark },
  noteText: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warningDark },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemImage: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.background },
  itemImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.text },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  qtyChip: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, fontFamily: fonts.semibold, fontSize: 11.5, color: colors.text, backgroundColor: colors.background },
  itemMeta: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  itemTotal: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  bill: { gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, backgroundColor: '#f8fafc', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  billLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  billLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  billValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  billGood: { color: colors.successDark },
  billTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' },
  billTotalLabel: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  billTotalValue: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  payIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  payIconPaid: { backgroundColor: '#dcfce7' },
  payIconCredit: { backgroundColor: '#f3e8ff' },
  payTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  payAmount: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  credit: { color: '#7c3aed' },
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
