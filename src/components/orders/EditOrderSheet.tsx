import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import { isPickupOrder, orderStatusLabel, type OrderRow } from '../../lib/orders';
import { orderService } from '../../services/order-service';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Field, Input, SelectField } from '../form/Fields';
import { confirmAction } from '../operations/OpsParts';
import { useTranslation } from 'react-i18next';

// The Seller Panel's order edit form (src/app/dashboard/orders/_config.ts).
const DELIVERY_STATUSES = ['CREATED', 'CONFIRMED', 'PACKED', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REPLACED'];
const PICKUP_STATUSES = ['CREATED', 'CONFIRMED', 'PACKED', 'DELIVERED', 'CANCELLED'];
const PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'CREDIT', 'OVERDUE', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];

const titleCase = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());

/** Edit an order's status, payment status and remarks. */
export function EditOrderSheet({ order, visible, onClose, onSaved }: { order: OrderRow; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState(order.orderStatus);
  const [payment, setPayment] = useState(order.paymentStatus ?? '');
  const [remarks, setRemarks] = useState(order.remarks ?? '');
  const [saving, setSaving] = useState(false);
  // Start from the order as it is each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setStatus(order.orderStatus);
    setPayment(order.paymentStatus ?? '');
    setRemarks(order.remarks ?? '');
  }, [visible, order.orderStatus, order.paymentStatus, order.remarks]);

  const pickup = isPickupOrder(order);
  const statuses = pickup ? PICKUP_STATUSES : DELIVERY_STATUSES;
  const statusOptions = [...new Set([...statuses, order.orderStatus])].map(v => ({ value: v, label: orderStatusLabel({ orderStatus: v, fulfillmentType: order.fulfillmentType }) }));
  const paymentOptions = [...new Set([...PAYMENT_STATUSES, ...(order.paymentStatus ? [order.paymentStatus] : [])])].map(v => ({ value: v, label: titleCase(v) }));
  const statusChanged = status !== order.orderStatus;
  const paymentChanged = !!payment && payment !== (order.paymentStatus ?? '');
  const remarksChanged = remarks.trim() !== (order.remarks ?? '').trim();
  const changed = statusChanged || paymentChanged || remarksChanged;

  async function save() {
    if (!changed) return onClose();
    if (statusChanged) {
      const label = orderStatusLabel({ orderStatus: status, fulfillmentType: order.fulfillmentType });
      const ok = await confirmAction(
        t('orders.changeTheStatusToLabel', { label }),
        t('orders.thisSetsTheStatusDirectlyWithout'),
        t('common.changeStatus'),
        status === 'CANCELLED',
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      await orderService.update(order.id, {
        ...(statusChanged ? { orderStatus: status } : {}),
        ...(paymentChanged ? { paymentStatus: payment } : {}),
        ...(remarksChanged ? { remarks: remarks.trim() || null } : {}),
      });
      toast(t('orders.orderUpdated'));
      onSaved();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title={t('orders.editOrder')}
      subtitle={order.uniqueOrderId}
      onClose={onClose}
      footer={<Button title={changed ? t('common.saveChanges2') : t('common.done')} loading={saving} onPress={save} />}
    >
      <View style={styles.body}>
        <SelectField label={t('orders.orderStatus')} value={status} options={statusOptions} onChange={setStatus} />
        {statusChanged ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              {pickup ? t('orders.forPickupOrdersTheAcceptReady') : t('orders.changingTheStatusHereSkipsThe')}
            </Text>
          </View>
        ) : null}
        <SelectField label={t('orders.paymentStatus')} value={payment} options={paymentOptions} onChange={setPayment} placeholder={t('orders.selectPaymentStatus')} />
        <Field label={t('orders.remarks')} hint={t('orders.internalNoteTheCustomerDoesnT')}>
          <Input value={remarks} onChangeText={setRemarks} placeholder="e.g. Customer will collect after 6 pm" multiline maxLength={1000} accessibilityLabel={t('orders.remarks')} />
        </Field>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 4 },
  warn: { marginBottom: 8, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningLight },
  warnText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.warningDark },
});
