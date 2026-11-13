import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { openPdf } from '../../lib/documents';
import { formatRupees } from '../../lib/format';
import { orderService, type OrderInvoice, type OrderReceipt } from '../../services/order-service';
import { Card } from '../ui/Card';
import { FileTextIcon, WalletIcon } from '../icons';
import { useTranslation } from 'react-i18next';

/**
 * The order's documents: each seller's tax invoice (issued on delivery) and a
 * payment receipt for every payment. Tapping one opens its PDF.
 */
export function OrderDocuments({ orderId, delivered }: { orderId: string; delivered: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [opening, setOpening] = useState<string | null>(null);
  const invoices = useFetch(() => (delivered ? orderService.invoices(orderId) : Promise.resolve([])), [orderId, delivered]);
  const receipts = useFetch(() => orderService.receipts(orderId), [orderId, delivered]);

  async function open(id: string, path: string, fileName: string) {
    setOpening(id);
    try {
      await openPdf(path, fileName);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setOpening(null);
    }
  }

  const invoiceRows = invoices.data ?? [];
  const receiptRows = receipts.data ?? [];

  return (
    <Card title={t('orders.invoicesAndReceipts')} icon={FileTextIcon} padded={false}>
      {!delivered ? (
        <Text style={styles.note}>{t('orders.theTaxInvoiceIsIssuedOnce')}</Text>
      ) : invoices.loading ? (
        <Text style={styles.note}>{t('orders.loadingInvoices')}</Text>
      ) : invoices.error ? (
        <Text style={styles.note}>{invoices.error}</Text>
      ) : !invoiceRows.length ? (
        <Text style={styles.note}>{t('orders.noInvoiceYet')}</Text>
      ) : null}
      {invoiceRows.map((invoice: OrderInvoice) => (
        <DocRow
          key={invoice.id}
          kind="invoice"
          title={invoice.invoiceNumber}
          subtitle={`${invoice.seller?.name ?? 'Tax invoice'} · ${formatRupees(Number(invoice.totals?.total) || 0)}`}
          busy={opening === invoice.id}
          onPress={() => open(invoice.id, `/orders/${orderId}/invoices/${invoice.id}/pdf`, `invoice-${invoice.invoiceNumber}.pdf`)}
        />
      ))}
      {receiptRows.map((receipt: OrderReceipt) => {
        const balance = Number(receipt.balanceAfter) || 0;
        return (
          <DocRow
            key={receipt.id}
            kind="receipt"
            title={receipt.receiptNumber}
            subtitle={[t(receipt.receiptType === 'CREDIT_PAYMENT' ? 'orders.creditPaymentAmount' : 'orders.paidAtOrderAmount', { amount: formatRupees(Number(receipt.amount) || 0) }), formatDay(receipt.paymentDate), balance > 0 ? t('orders.amountDue', { amount: formatRupees(balance) }) : t('orders.settled')].join(' · ')}
            busy={opening === receipt.id}
            onPress={() => open(receipt.id, `/orders/${orderId}/receipts/${receipt.id}/pdf`, `receipt-${receipt.receiptNumber}.pdf`)}
          />
        );
      })}
    </Card>
  );
}

function DocRow({
  kind,
  title,
  subtitle,
  busy,
  onPress,
}: {
  kind: 'invoice' | 'receipt';
  title: string;
  subtitle: string;
  busy: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const Icon = kind === 'invoice' ? FileTextIcon : WalletIcon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('orders.openKindTitle', { kind, title })}
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, kind === 'receipt' && styles.iconReceipt]}>
        <Icon size={18} color={kind === 'invoice' ? colors.secondary : colors.success} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {busy ? <ActivityIndicator color={colors.secondary} /> : <Text style={styles.pdf}>{t('orders.pdf')}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  note: { paddingHorizontal: 16, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: { backgroundColor: colors.background },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  iconReceipt: { backgroundColor: colors.successLight },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  subtitle: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  pdf: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.secondarySoft,
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.secondary,
  },
});
