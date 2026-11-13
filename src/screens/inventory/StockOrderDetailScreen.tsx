import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { CREDIT_TERMS, dateTime, day, dueText, expenseStatus, money, PAYMENT_MODES, todayDay, toAmount } from '../../lib/operations';
import { OPEN_STATUSES, qty, receiptLines, receiptProblem, STOCK_ORDER_STATUS } from '../../lib/stock-orders';
import { storeOperationsService, type StockOrderDetail } from '../../services/store-operations-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Choices, DateField, Field, Input, SelectField } from '../../components/form/Fields';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { HistoryList, opsStyles, ReasonSheet } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, BanIcon, BoxIcon, ClockIcon, FileTextIcon, PhoneIcon, TruckIcon, WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/** One stock order, as the panel's dialog: what was ordered and what's arrived, receive, status, expected date, cancel, supplier bill, deliveries and history. */
export function StockOrderDetailScreen({ navigation, route }: ScreenProps<'StockOrderDetail'>) {
  const { t } = useTranslation();
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const { current } = useStore();
  const toast = useToast();
  const allowed = hasPermission('pending-stock:manage');
  const storeId = allowed ? current?.id ?? '' : '';
  const today = todayDay();
  const { data, error, loading, reload } = useFetch(() => (storeId ? storeOperationsService.stockOrder(storeId, id) : Promise.resolve(null)), [storeId, id]);
  const [receiving, setReceiving] = useState<Record<string, string> | null>(null);
  const [receivedDate, setReceivedDate] = useState(today);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [dating, setDating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const header = <AppHeader title={data ? t('inventory.stockOrderIdd', { idd: data.idd }) : t('inventory.stockOrder')} subtitle={t('common.pendingStock')} onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label={t('common.pendingStock')} icon={TruckIcon} allowed={false} />
      </View>
    );
  }
  if (loading && !data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton rows={3} height={130} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={error || t('inventory.stockOrderNotFound')} onRetry={reload} />
      </View>
    );
  }

  const o = data;
  const st = STOCK_ORDER_STATUS[o.status];
  const open = OPEN_STATUSES.includes(o.status);

  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setFormError('');
    try {
      await work();
      toast(message);
      reload();
      return true;
    } catch (err) {
      setFormError(extractErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function receive() {
    if (!receiving) return;
    const problem = receiptProblem(receiving, o.items);
    if (problem) return setFormError(problem);
    if (receivedDate > today) return setFormError(t('inventory.theReceivedDateCanTBe'));
    const ok = await run(() => storeOperationsService.receiveStockOrder(storeId, id, { lines: receiptLines(receiving), receivedDate, notes: receiptNotes.trim() || undefined }), t('inventory.stockReceivedAndAddedToInventory'));
    if (ok) {
      setReceiving(null);
      setReceiptNotes('');
    }
  }

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={opsStyles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={styles.flex}>
            <Text style={styles.supplier}>{o.supplierName}</Text>
            <Text style={opsStyles.meta}>{[o.referenceNumber ? t('common.refReferencenumber', { referenceNumber: o.referenceNumber }) : null, t('inventory.intoWarehouse', { warehouse: o.warehouse.title ?? t('inventory.warehouseLower') })].filter(Boolean).join(' · ')}</Text>
            {o.supplierPhone ? (
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${o.supplierPhone}`)} style={styles.phone}>
                <PhoneIcon size={13} color={colors.secondary} />
                <Text style={styles.link}>{o.supplierPhone}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.right}>
            <Badge label={st.label} tone={st.tone} />
            {o.delayed ? (
              <View style={styles.inline}>
                <AlertCircleIcon size={13} color={colors.error} />
                <Text style={styles.delayed}>{t('inventory.delayed')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.stats}>
          {[
            [t('inventory.ordered'), day(o.orderDate)],
            [t('inventory.expected'), o.expectedDate ? day(o.expectedDate) : '—'],
            [t('common.amount'), money(o.orderAmount)],
            [t('common.units'), `${qty(o.totals.receivedUnits)} / ${qty(o.totals.orderedUnits)}`],
          ].map(([k, v]) => (
            <View key={k} style={styles.stat}>
              <Text style={styles.statLabel}>{k}</Text>
              <Text style={[styles.statValue, k === t('inventory.expected') && o.delayed && opsStyles.danger]} numberOfLines={1}>
                {v}
              </Text>
            </View>
          ))}
        </View>

        <SectionCard icon={BoxIcon} title={t('common.products')} subtitle={`${t('common.productCount', { count: o.totals.products })} · ${t('inventory.quantityPending', { quantity: qty(o.totals.pendingUnits) })}`}>
          {o.items.map(i => (
            <View key={i.id} style={styles.item}>
              <View style={styles.flex}>
                <Text style={opsStyles.title} numberOfLines={1}>
                  {i.productName}
                </Text>
                <Text style={opsStyles.muted}>{[i.sku ?? '', t('inventory.orderedQuantity', { quantity: `${qty(i.orderedQty)} ${i.uom}` }), i.unitCost != null && !receiving ? t('inventory.amountEach', { amount: money(i.unitCost) }) : null].filter(v => v !== null).join(' · ')}</Text>
                <Text style={opsStyles.meta}>
                  <Text style={styles.got}>{t('inventory.receivedqtyReceived', { receivedQty: qty(i.receivedQty) })}</Text>
                  {` · `}
                  <Text style={styles.pending}>{t('inventory.pendingqtyPending', { pendingQty: qty(i.pendingQty) })}</Text>
                </Text>
              </View>
              {receiving ? (
                <View style={styles.arrived}>
                  <Input
                    value={receiving[i.id] ?? ''}
                    onChangeText={v => setReceiving(r => ({ ...r, [i.id]: v.replace(/[^\d.]/g, '') }))}
                    editable={i.pendingQty > 0}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    accessibilityLabel={t('inventory.arrivedQuantityForProductname', { productName: i.productName })}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </SectionCard>

        {receiving ? (
          <View style={styles.receive}>
            <View style={opsStyles.rowBetween}>
              <Text style={opsStyles.title}>{t('inventory.whatArrived')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setReceiving(Object.fromEntries(o.items.filter(i => i.pendingQty > 0).map(i => [i.id, String(i.pendingQty)])))}>
                <Text style={styles.all}>{t('inventory.everythingPendingArrived')}</Text>
              </Pressable>
            </View>
            <DateField label={t('inventory.receivedOn')} value={receivedDate} onChange={setReceivedDate} maximumDate={new Date()} required />
            <Field label={t('inventory.deliveryNotes')}>
              <Input value={receiptNotes} onChangeText={setReceiptNotes} maxLength={1000} multiline accessibilityLabel={t('inventory.deliveryNotes')} />
            </Field>
            <Text style={opsStyles.muted}>{t('inventory.receivedQuantitiesAreAddedToThe')}</Text>
            {formError ? <ErrorLine message={formError} /> : null}
            <View style={styles.row}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setReceiving(null)} style={[opsStyles.smallBtn, styles.grow]}>
                <Text style={opsStyles.smallBtnText}>{t('common.cancel')}</Text>
              </Pressable>
              <View style={styles.flex}>
                <Button title={t('inventory.receiveStock2')} loading={busy} onPress={receive} />
              </View>
            </View>
          </View>
        ) : open ? (
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setReceiving({})} style={[opsStyles.primaryBtn, styles.receiveBtn]}>
              <TruckIcon size={15} color={colors.white} />
              <Text style={opsStyles.primaryBtnText}>{t('inventory.receiveStock2')}</Text>
            </Pressable>
            <View style={styles.row}>
              {o.status !== 'PARTIALLY_RECEIVED' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => run(() => storeOperationsService.updateStockOrder(storeId, id, { status: o.status === 'IN_TRANSIT' ? 'ORDERED' : 'IN_TRANSIT' }), o.status === 'IN_TRANSIT' ? t('inventory.markedAsOrdered') : t('inventory.markedInTransit'))}
                  style={[opsStyles.smallBtn, styles.grow]}
                >
                  <Text style={opsStyles.smallBtnText}>{o.status === 'IN_TRANSIT' ? t('inventory.backToOrdered') : t('inventory.markInTransit')}</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDating(true)} style={[opsStyles.smallBtn, styles.grow]}>
                <ClockIcon size={14} color={colors.text} />
                <Text style={opsStyles.smallBtnText}>{t('inventory.expectedDate')}</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setCancelling(true)} style={[opsStyles.smallBtn, styles.cancelBtn]}>
              <BanIcon size={14} color={colors.error} />
              <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>{t('inventory.cancelOrder')}</Text>
            </Pressable>
            {formError ? <ErrorLine message={formError} /> : null}
          </View>
        ) : null}

        {o.cancelReason ? <Text style={styles.cancelled}>{t('common.cancelledCancelreason', { cancelReason: o.cancelReason })}</Text> : null}
        {o.notes ? <Text style={styles.notes}>{o.notes}</Text> : null}

        <PurchaseBill storeId={storeId} order={o} today={today} canRecord={allowed} onSaved={reload} onOpen={billId => navigation.navigate('ExpenseDetail', { id: billId })} />

        {o.receipts.length ? (
          <SectionCard icon={TruckIcon} title={t('inventory.deliveries')}>
            {o.receipts.map(r => (
              <View key={r.id} style={styles.receipt}>
                <View style={opsStyles.rowBetween}>
                  <Text style={styles.idd}>{r.idd}</Text>
                  <Text style={opsStyles.muted}>{t('inventory.receiveddateTotalunitsUnits', { receivedDate: day(r.receivedDate), totalUnits: qty(r.totalUnits) })}</Text>
                </View>
                <Text style={opsStyles.meta}>{r.lines.map(l => `${l.productName} × ${qty(l.quantity)}`).join(', ')}</Text>
                {r.notes ? <Text style={opsStyles.muted}>{r.notes}</Text> : null}
                <Text style={opsStyles.muted}>{t('inventory.byCreatedbyname', { createdByName: r.createdByName ?? '—' })}</Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <SectionCard icon={FileTextIcon} title={t('common.history')}>
          <HistoryList entries={o.history} />
          <Text style={opsStyles.muted}>{t('inventory.createdByCreatedbynameCreatedat', { createdByName: o.createdByName ?? '—', createdAt: dateTime(o.createdAt) })}</Text>
        </SectionCard>
      </ScrollView>

      <ExpectedDateSheet
        visible={dating}
        value={o.expectedDate ?? today}
        minimum={o.orderDate}
        onClose={() => setDating(false)}
        onSave={async next => {
          setDating(false);
          await run(() => storeOperationsService.updateStockOrder(storeId, id, { expectedDate: next }), t('inventory.expectedDateUpdated'));
        }}
      />
      <ReasonSheet
        visible={cancelling}
        title={o.totals.receivedUnits > 0 ? t('inventory.cancelWhatHasnTArrived') : t('inventory.cancelThisStockOrder')}
        message={o.totals.receivedUnits > 0 ? t('inventory.stockAlreadyReceivedStaysInInventory') : t('inventory.theOrderIsClosedAndNothing')}
        label={t('common.reasonOptional')}
        confirmLabel={t('common.cancelOrder')}
        required={false}
        maxLength={250}
        onClose={() => setCancelling(false)}
        onConfirm={async reason => {
          setCancelling(false);
          await run(() => storeOperationsService.cancelStockOrder(storeId, id, reason || undefined), t('inventory.stockOrderCancelled'));
        }}
      />
    </KeyboardAvoidingView>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <View style={opsStyles.error}>
      <AlertCircleIcon size={16} color={colors.errorDark} />
      <Text style={opsStyles.errorText}>{message}</Text>
    </View>
  );
}

function ExpectedDateSheet({ visible, value, minimum, onClose, onSave }: { visible: boolean; value: string; minimum: string; onClose: () => void; onSave: (date: string) => void }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(value);
  React.useEffect(() => {
    if (visible) setDate(value);
  }, [visible, value]);
  const [y, m, d] = minimum.slice(0, 10).split('-').map(Number);
  return (
    <Sheet visible={visible} title={t('inventory.changeExpectedDate')} subtitle={t('inventory.whenDoYouExpectThisStock')} onClose={onClose} footer={<Button title={t('inventory.updateDate')} disabled={!date} onPress={() => onSave(date)} />}>
      <DateField label={t('inventory.expectedDate2')} required value={date} onChange={setDate} minimumDate={new Date(y, m - 1, d)} />
    </Sheet>
  );
}

/** The supplier's bill for the order: paid or on credit; owed like any bill, kept out of operating expenses. */
function PurchaseBill({ storeId, order, today, canRecord, onSaved, onOpen }: { storeId: string; order: StockOrderDetail; today: string; canRecord: boolean; onSaved: () => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ amount: order.orderAmount ? String(order.orderAmount) : '', paymentType: 'CREDIT', method: 'BANK_TRANSFER', transactionReference: '', terms: '30', referenceNumber: order.referenceNumber ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const bill = order.purchaseBill;

  async function save() {
    const amount = toAmount(form.amount);
    if (!(amount > 0)) return setError(t('inventory.enterTheBillAmount'));
    setError('');
    setSaving(true);
    try {
      await storeOperationsService.createPurchaseBill(storeId, order.id, {
        baseAmount: amount,
        referenceNumber: form.referenceNumber.trim() || undefined,
        billDate: order.orderDate > today ? today : order.orderDate,
        paymentType: form.paymentType,
        payment: form.paymentType === 'PAID' ? { method: form.method, transactionReference: form.transactionReference.trim() || undefined, paymentDate: today } : undefined,
        credit: form.paymentType === 'CREDIT' ? { creditTermsDays: Number(form.terms) } : undefined,
      });
      toast(t('inventory.supplierBillRecorded'));
      setAdding(false);
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard icon={WalletIcon} title={t('inventory.supplierBill')}>
      {bill ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('inventory.openSupplierBillIdd', { idd: bill.idd })} onPress={() => onOpen(bill.id)} style={styles.bill}>
          <View style={styles.flex}>
            <Text style={opsStyles.title}>{`${bill.idd} · ${money(bill.amount)}`}</Text>
            <Text style={opsStyles.muted}>
              {[bill.supplierName, day(bill.expenseDate), bill.outstandingAmount ? t('inventory.outstandingamountOwed', { outstandingAmount: money(bill.outstandingAmount) }) : null, dueText(bill.dueInDays, bill.dueDate)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Badge label={expenseStatus(bill.status).label} tone={expenseStatus(bill.status).tone} />
        </Pressable>
      ) : adding ? (
        <>
          <Field label={t('inventory.billAmountRs')} required>
            <Input value={form.amount} onChangeText={v => set('amount', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={t('inventory.billAmount')} />
          </Field>
          <Field label={t('inventory.supplierBillNo')}>
            <Input value={form.referenceNumber} onChangeText={v => set('referenceNumber', v)} maxLength={100} />
          </Field>
          <Field label={t('common.payment')}>
            <Choices
              options={[
                { value: 'CREDIT', label: t('common.onCredit') },
                { value: 'PAID', label: t('inventory.paidInFull') },
              ]}
              value={form.paymentType}
              onChange={v => set('paymentType', v)}
            />
          </Field>
          {form.paymentType === 'CREDIT' ? (
            <SelectField label={t('common.dueAfter')} value={form.terms} options={CREDIT_TERMS.map(d => ({ value: String(d), label: t('common.dDays', { d }) }))} onChange={v => set('terms', v)} />
          ) : (
            <>
              <SelectField label={t('common.paidBy')} value={form.method} options={PAYMENT_MODES} onChange={v => set('method', v)} />
              <Field label={t('common.transactionReference')}>
                <Input value={form.transactionReference} onChangeText={v => set('transactionReference', v)} maxLength={100} />
              </Field>
            </>
          )}
          {error ? <ErrorLine message={error} /> : null}
          <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setAdding(false)} style={[opsStyles.smallBtn, styles.grow]}>
              <Text style={opsStyles.smallBtnText}>{t('common.cancel')}</Text>
            </Pressable>
            <View style={styles.flex}>
              <Button title={t('inventory.saveBill')} loading={saving} onPress={save} />
            </View>
          </View>
          <Text style={opsStyles.muted}>{t('inventory.paymentsReturnsAndTheSuppliersBalance')}</Text>
        </>
      ) : (
        <View style={styles.noBill}>
          <Text style={[opsStyles.muted, styles.flex]}>{t('inventory.noBillRecordedForThisOrder')}</Text>
          {canRecord ? (
            <Pressable accessibilityRole="button" onPress={() => setAdding(true)}>
              <Text style={styles.link}>{t('inventory.recordSupplierBill')}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  supplier: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  right: { alignItems: 'flex-end', gap: 4 },
  delayed: { fontFamily: fonts.semibold, fontSize: 12, color: colors.error },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexBasis: '47%', flexGrow: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted },
  statValue: { marginTop: 2, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  got: { color: colors.successDark },
  pending: { fontFamily: fonts.semibold, color: colors.text },
  arrived: { width: 84 },
  receive: { gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
  all: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#047857', textDecorationLine: 'underline' },
  actions: { gap: 8 },
  receiveBtn: { alignSelf: 'stretch', justifyContent: 'center', height: 48, backgroundColor: '#059669' },
  cancelBtn: { alignSelf: 'stretch', justifyContent: 'center', borderColor: '#fecaca' },
  cancelled: { padding: 10, borderRadius: radius.md, fontFamily: fonts.medium, fontSize: 12.5, color: colors.errorDark, backgroundColor: colors.errorLight },
  notes: { padding: 12, borderRadius: radius.md, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary, backgroundColor: colors.surface },
  receipt: { gap: 3, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  idd: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  bill: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  noBill: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
});
