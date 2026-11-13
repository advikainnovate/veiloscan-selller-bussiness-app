import React, { useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatWhen } from '../../lib/date';
import { formatRupees } from '../../lib/format';
import { priceText } from '../../lib/order-lines';
import type { CatalogItem } from '../../services/seller-order-service';
import {
  orderRequestService,
  requestQuantityLabel,
  requestStatusLabel,
  requestStatusTone,
  type OrderRequestStatus,
} from '../../services/order-request-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Sheet } from '../../components/ui/Sheet';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { ProductPicker } from '../../components/create-order/ProductPicker';
import { BoxIcon, CloseIcon, FileTextIcon, MapPinIcon, PhoneIcon, PlusIcon, UserIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const ACTIONS: Record<OrderRequestStatus, { label: string; tone: 'primary' | 'ghost' | 'danger'; needsReason?: boolean }> = {
  REQUESTED: { label: '', tone: 'ghost' },
  UNDER_REVIEW: { get label() { return i18n.t('orders.startReview'); }, tone: 'ghost' },
  CONFIRMED: { get label() { return i18n.t('orders.confirmRequest'); }, tone: 'primary' },
  COMPLETED: { get label() { return i18n.t('orders.markCompleted'); }, tone: 'primary' },
  REJECTED: { get label() { return i18n.t('orders.reject'); }, tone: 'danger', needsReason: true },
  CANCELLED: { get label() { return i18n.t('orders.cancelRequest'); }, tone: 'danger', needsReason: true },
};

/** How the item stands now: in stock, short, or not for sale. */
function availability(catalogItem: CatalogItem | null, sellingQuantity: number): { label: string; color: string } {
  if (!catalogItem) return { label: i18n.t('orders.canTBeSoldNowNo'), color: colors.error };
  if (catalogItem.stock === null) return { label: i18n.t('orders.stockNotTracked'), color: colors.textSecondary };
  if (catalogItem.stock <= 0) return { label: i18n.t('common.outOfStock2'), color: colors.error };
  if (catalogItem.stock < sellingQuantity) return { label: i18n.t('orders.onlyStockInStock', { stock: catalogItem.stock }), color: colors.warningDark };
  return { label: i18n.t('orders.inStockStock', { stock: catalogItem.stock }), color: colors.successDark };
}

interface DraftLine {
  key: string;
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string | null;
  quantity: string;
  /** Empty: the SKU's selling unit. */
  uom: string;
}

/** One order request: review its items, move its status, and bill it as an order. */
export function OrderRequestDetailScreen({ navigation, route }: ScreenProps<'OrderRequestDetail'>) {
  const { t } = useTranslation();
  const { id } = route.params;
  const toast = useToast();
  const { data: request, error, loading, refreshing, reload } = useFetch(() => orderRequestService.get(id), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<OrderRequestStatus | null>(null);
  const [reason, setReason] = useState('');
  // The items being edited (null: not editing).
  const [draft, setDraft] = useState<DraftLine[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Back from billing: the request is now completed.
  useFocusEffect(
    React.useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading || (!request && !error)) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('orders.orderRequest')} onBack={navigation.goBack} />
        <View style={styles.content}>
          <ListSkeleton rows={3} height={120} />
        </View>
      </View>
    );
  }
  if (!request) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('orders.orderRequest')} onBack={navigation.goBack} />
        <ErrorState message={error ?? t('orders.thisRequestCouldnTBeLoaded')} onRetry={() => reload()} />
      </View>
    );
  }

  const unbillable = request.items.filter(i => !i.catalogItem).length;
  const phoneDigits = `${request.customer.countryCode ?? ''}${request.customer.mobile ?? ''}`.replace(/\D/g, '');
  const statusActions = request.nextStatuses.filter(s => s !== 'COMPLETED' || request.bill);

  async function changeStatus(status: OrderRequestStatus, note?: string) {
    setBusy(status);
    setActionError(null);
    try {
      await orderRequestService.updateStatus(id, status, note);
      toast(t('orders.requestLowercase', { lowerCase: requestStatusLabel(status).toLowerCase() }));
      setReasonFor(null);
      setReason('');
      await reload();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function startEditing() {
    setActionError(null);
    setDraft(
      request!.items.map(item => ({
        key: item.id,
        productId: item.productId,
        variantId: item.variantId ?? '',
        name: item.name,
        variantLabel: item.variantLabel,
        quantity: String(item.quantity),
        uom: item.uom,
      })),
    );
  }

  function addFromCatalog(item: CatalogItem) {
    setDraft(lines => {
      const current = lines ?? [];
      const found = current.find(l => l.variantId === item.variantId);
      if (found) return current.map(l => (l === found ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l));
      return [
        ...current,
        { key: `new:${item.variantId}`, productId: item.productId, variantId: item.variantId, name: item.productName, variantLabel: item.variantLabel, quantity: '1', uom: '' },
      ];
    });
  }

  async function saveItems() {
    if (!draft) return;
    const lines = draft.filter(l => Number(l.quantity) > 0);
    if (!lines.length) {
      setActionError(t('orders.keepAtLeastOneItemReject'));
      return;
    }
    setBusy('items');
    setActionError(null);
    try {
      await orderRequestService.updateItems(
        id,
        lines.map(l => ({ productId: l.productId, variantId: l.variantId, quantity: Number(l.quantity), ...(l.uom ? { uom: l.uom } : {}) })),
      );
      toast(t('orders.itemsUpdated'));
      setDraft(null);
      await reload();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.screen}>
      <AppHeader title={request.requestNumber} subtitle={request.store.name} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        <Card>
          <View style={styles.statusRow}>
            <Badge label={requestStatusLabel(request.status)} tone={requestStatusTone(request.status)} />
            <Text style={styles.when}>{t('orders.sentCreatedat', { createdAt: formatWhen(request.createdAt) })}</Text>
          </View>
          {request.statusNote ? <Text style={styles.reason}>{t('orders.reasonStatusnote', { statusNote: request.statusNote })}</Text> : null}
          {statusActions.length || request.canEdit ? (
            <View style={styles.actions}>
              {request.canEdit && !draft ? (
                <Button
                  title={t('orders.generateFinalBill')}
                  disabled={!!busy || request.items.length === unbillable}
                  onPress={() => navigation.navigate('CreateOrder', { requestId: request.id })}
                  style={styles.fullWidth}
                />
              ) : null}
              <View style={styles.actionRow}>
                {statusActions.map(status => {
                  const action = ACTIONS[status];
                  if (!action.label) return null;
                  return (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      disabled={!!busy}
                      onPress={() => (action.needsReason ? setReasonFor(status) : changeStatus(status))}
                      style={[
                        styles.action,
                        action.tone === 'primary' && styles.actionPrimary,
                        action.tone === 'danger' && styles.actionDanger,
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          action.tone === 'primary' && styles.actionTextPrimary,
                          action.tone === 'danger' && styles.actionTextDanger,
                        ]}
                      >
                        {busy === status ? t('common.saving') : action.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {actionError ? (
            <View style={styles.errorGap}>
              <Alert message={actionError} />
            </View>
          ) : null}
        </Card>

        {request.bill ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('OrderDetail', { id: request.bill!.orderId })}
            style={styles.bill}
          >
            <FileTextIcon size={18} color={colors.successDark} />
            <Text style={styles.billText}>
              {t('orders.finalBillNumber', { number: request.bill.orderNumber })}
              {request.bill.totalAmount !== null ? ` · ${formatRupees(request.bill.totalAmount)}` : ''}
            </Text>
            <Text style={styles.billLink}>{t('common.view')}</Text>
          </Pressable>
        ) : null}

        <Card
          title={t('orders.itemsValue', { value: draft ? draft.length : request.items.length })}
          icon={BoxIcon}
          padded={false}
          action={
            request.canEdit && !draft ? (
              <Pressable onPress={startEditing} hitSlop={8}>
                <Text style={styles.link}>{t('common.edit')}</Text>
              </Pressable>
            ) : null
          }
        >
          {!draft ? (
            <>
              <Text style={styles.cardNote}>{t('orders.theCustomerSeesNoPricesCheck')}</Text>
              {request.items.map(item => {
                const avail = availability(item.catalogItem, item.sellingQuantity);
                return (
                  <View key={item.id} style={styles.item}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]}>
                        <BoxIcon size={18} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.flex}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {[item.variantLabel, item.sku].filter(Boolean).join(' · ')}
                      </Text>
                      <Text style={[styles.avail, { color: avail.color }]}>{avail.label}</Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.qty}>{requestQuantityLabel(item)}</Text>
                      {item.catalogItem ? <Text style={styles.itemMeta}>{priceText(item.catalogItem)}</Text> : null}
                    </View>
                  </View>
                );
              })}
              {unbillable ? (
                <Text style={styles.unbillable}>
                  {t('orders.productsCantBeBilled', { count: unbillable })}</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.editor}>
              {draft.map(line => (
                <View key={line.key} style={styles.editRow}>
                  <View style={styles.flex}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {line.name}
                    </Text>
                    {line.variantLabel ? <Text style={styles.itemMeta}>{line.variantLabel}</Text> : null}
                  </View>
                  <TextInput
                    value={line.quantity}
                    onChangeText={text => setDraft(d => d!.map(l => (l === line ? { ...l, quantity: text.replace(/[^0-9.]/g, '') } : l)))}
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('orders.quantityOfName', { name: line.name })}
                    style={styles.qtyInput}
                  />
                  <Text style={styles.uom}>{line.uom || 'unit'}</Text>
                  <Pressable accessibilityLabel={t('common.removeName', { name: line.name })} hitSlop={8} onPress={() => setDraft(d => d!.filter(l => l !== line))}>
                    <CloseIcon size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => setPickerOpen(true)} style={styles.addItem}>
                <PlusIcon size={16} color={colors.secondary} strokeWidth={2.4} />
                <Text style={styles.link}>{t('common.addAProduct')}</Text>
              </Pressable>
              <View style={styles.actionRow}>
                <Pressable onPress={() => setDraft(null)} style={styles.action}>
                  <Text style={styles.actionText}>{t('common.discard')}</Text>
                </Pressable>
                <Button title={t('orders.saveItems')} loading={busy === 'items'} onPress={saveItems} style={styles.flex} />
              </View>
            </View>
          )}
        </Card>

        <Card title={t('common.customer')} icon={UserIcon}>
          <Text style={styles.customerName}>{request.customer.name}</Text>
          <Pressable onPress={() => Linking.openURL(`tel:+${request.customer.countryCode}${request.customer.mobile}`)} style={styles.line}>
            <PhoneIcon size={16} color={colors.secondary} />
            <Text style={styles.link}>
              +{request.customer.countryCode} {request.customer.mobile}
            </Text>
          </Pressable>
          {request.customer.address ? (
            <View style={styles.line}>
              <MapPinIcon size={16} color={colors.textMuted} />
              <Text style={styles.lineText}>{request.customer.address}</Text>
            </View>
          ) : null}
          {request.customer.note ? (
            <View style={styles.note}>
              <Text style={styles.noteLabel}>{t('orders.customerNote')}</Text>
              <Text style={styles.noteText}>{request.customer.note}</Text>
            </View>
          ) : null}
          {/* As on the Seller Panel: call, WhatsApp or email the customer about their list. */}
          <View style={styles.contactRow}>
            <ContactButton label={t('common.call')} onPress={() => Linking.openURL(`tel:+${phoneDigits}`)} />
            <ContactButton
              label="WhatsApp"
              onPress={() =>
                Linking.openURL(
                  `https://wa.me/${phoneDigits}?text=${encodeURIComponent(
                    t('orders.hiNameAboutYourOrderRequest', { name: request.customer.name, requestNumber: request.requestNumber, name2: request.store.name }),
                  )}`,
                )
              }
            />
            {request.customer.email ? (
              <ContactButton
                label={t('common.email')}
                onPress={() =>
                  Linking.openURL(`mailto:${request.customer.email}?subject=${encodeURIComponent(t('orders.yourOrderRequestRequestnumber', { requestNumber: request.requestNumber }))}`)
                }
              />
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <Sheet
        visible={!!reasonFor}
        title={reasonFor === 'REJECTED' ? t('orders.rejectRequest') : t('orders.cancelRequest')}
        subtitle={t('orders.theCustomerSeesThisReason')}
        onClose={() => setReasonFor(null)}
        footer={
          <Button
            title={reasonFor === 'REJECTED' ? t('orders.reject') : t('orders.cancelRequest')}
            loading={!!reasonFor && busy === reasonFor}
            disabled={!reason.trim()}
            onPress={() => reasonFor && changeStatus(reasonFor, reason.trim())}
          />
        }
      >
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={t('orders.reasonEGItemsNotAvailable')}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.secondary}
          multiline
          style={styles.reasonInput}
        />
      </Sheet>

      <ProductPicker
        visible={pickerOpen}
        storeId={request.store.id}
        inOrder={new Map((draft ?? []).map(l => [l.variantId, Number(l.quantity) || 0]))}
        onAdd={addFromCatalog}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function ContactButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.contact, pressed && styles.contactPressed]}>
      <Text style={styles.contactText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  contact: { paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  contactPressed: { backgroundColor: colors.background },
  contactText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  flex: { flex: 1, minWidth: 0 },
  fullWidth: { alignSelf: 'stretch' },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  when: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  reason: { marginTop: 8, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  actions: { marginTop: 14, gap: 10 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { height: 44, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  actionPrimary: { borderColor: colors.primary, backgroundColor: colors.primary },
  actionDanger: { borderColor: '#fecaca' },
  actionText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  actionTextPrimary: { color: colors.white },
  actionTextDanger: { color: colors.error },
  errorGap: { marginTop: 12 },
  bill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: colors.successLight,
  },
  billText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.successDark },
  billLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.successDark },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.secondary },
  cardNote: { paddingHorizontal: 16, paddingTop: 12, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.background },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  itemMeta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  avail: { marginTop: 3, fontFamily: fonts.medium, fontSize: 12 },
  itemRight: { alignItems: 'flex-end' },
  qty: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  unbillable: { margin: 16, marginTop: 0, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningDark },
  editor: { padding: 16, gap: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyInput: {
    width: 64,
    height: 40,
    paddingVertical: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  uom: { width: 36, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  customerName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  line: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  note: { marginTop: 10, padding: 10, borderRadius: radius.md, backgroundColor: colors.warningLight },
  noteLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.warningDark },
  noteText: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warningDark },
  reasonInput: {
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
