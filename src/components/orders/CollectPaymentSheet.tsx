import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import { addDaysISO, formatDay } from '../../lib/date';
import {
  CreditTermsForm,
  creditPayload,
  creditTermsProblem,
  defaultCreditTerms,
  type CreditTerms,
} from './CreditTermsForm';
import { formatRupees } from '../../lib/format';
import { PAYMENT_METHODS, type PaymentMethod } from '../../lib/orders';
import {
  orderService,
  type OrderPaymentSummary,
} from '../../services/order-service';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

type Amounts = Record<PaymentMethod, string>;
const EMPTY: Amounts = {
  CASH: '',
  UPI: '',
  CARD: '',
  BANK_TRANSFER: '',
  OTHER: '',
};
// Methods whose transaction reference is worth noting.
const HAS_REFERENCE: PaymentMethod[] = ['UPI', 'CARD', 'BANK_TRANSFER'];

const paise = (value: string) => {
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

/**
 * The Seller Panel's order payment screen: how the customer pays now (per
 * method), and optionally the rest on Customer Credit. Completing also marks
 * the pickup order picked up.
 */
export function CollectPaymentSheet({
  visible,
  orderId,
  summary,
  onClose,
  onDone,
}: {
  visible: boolean;
  orderId: string;
  summary: OrderPaymentSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const request =
    summary.creditRequest?.status === 'APPROVED' ? summary.creditRequest : null;
  const [amounts, setAmounts] = useState<Amounts>(EMPTY);
  const [references, setReferences] = useState<Partial<Amounts>>({});
  const [useCredit, setUseCredit] = useState(false);
  const [terms, setTerms] = useState<CreditTerms>(() =>
    defaultCreditTerms(summary.maxCreditDays),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start with what the customer asked to pay now (else the whole amount) in cash.
  useEffect(() => {
    if (!visible) return;
    setAmounts({
      ...EMPTY,
      CASH: String(request ? request.payNow : summary.amountDue),
    });
    setReferences({});
    setUseCredit(!!request);
    setTerms(defaultCreditTerms(summary.maxCreditDays));
    setError(null);
  }, [visible, request, summary.amountDue, summary.maxCreditDays]);

  const duePaise = Math.round(summary.amountDue * 100);
  const paidNowPaise = PAYMENT_METHODS.reduce(
    (sum, m) => sum + paise(amounts[m.value]),
    0,
  );
  const remainingPaise = duePaise - paidNowPaise;
  const creditPaise = useCredit ? Math.max(0, remainingPaise) : 0;
  const dueDate = addDaysISO(terms.days);

  let problem: string | null = null;
  if (remainingPaise < 0)
    problem = `Payments are ${formatRupees(
      -remainingPaise / 100,
    )} more than the amount due.`;
  else if (useCredit && creditPaise === 0)
    problem = 'Nothing is left to put on credit.';
  else if (useCredit && creditTermsProblem(terms, summary.maxCreditDays))
    problem = creditTermsProblem(terms, summary.maxCreditDays);
  else if (!useCredit && remainingPaise > 0)
    problem = `${formatRupees(
      remainingPaise / 100,
    )} is still unpaid — collect it, or put it on Customer Credit.`;

  async function submit() {
    if (problem || saving) return;
    setSaving(true);
    setError(null);
    try {
      await orderService.recordPayment(orderId, {
        payments: PAYMENT_METHODS.filter(m => paise(amounts[m.value]) > 0).map(
          m => ({
            method: m.value,
            amount: paise(amounts[m.value]) / 100,
            ...(references[m.value]?.trim()
              ? { referenceNumber: references[m.value]!.trim() }
              : {}),
          }),
        ),
        ...(useCredit
          ? {
              credit: { amount: creditPaise / 100, ...creditPayload(terms) },
            }
          : {}),
        completeOrder: true,
      });
      toast(
        useCredit
          ? `${formatRupees(paidNowPaise / 100)} received · ${formatRupees(
              creditPaise / 100,
            )} on credit until ${formatDay(dueDate)}`
          : 'Payment recorded · order picked up',
      );
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Collect payment"
      subtitle={`${formatRupees(summary.amountDue)} due for ${
        summary.orderNumber
      }. Enter what the customer pays by each method.`}
      onClose={onClose}
      footer={
        <>
          {error ? (
            <Alert message={error} />
          ) : problem && paidNowPaise + creditPaise > 0 ? (
            <Text style={styles.problem}>{problem}</Text>
          ) : null}
          <Button
            title={useCredit ? 'Record & complete' : 'Paid · mark picked up'}
            loadingTitle="Saving..."
            loading={saving}
            disabled={!!problem}
            onPress={submit}
          />
        </>
      }
    >
      {PAYMENT_METHODS.map(method => {
        const value = amounts[method.value];
        return (
          <View key={method.value} style={styles.method}>
            <Text style={styles.methodLabel}>{method.label}</Text>
            <View style={styles.amountBox}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                value={value}
                onChangeText={text =>
                  setAmounts({
                    ...amounts,
                    [method.value]: text.replace(/[^0-9.]/g, ''),
                  })
                }
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.secondary}
                style={styles.amountInput}
                accessibilityLabel={`${method.label} amount`}
              />
            </View>
            {HAS_REFERENCE.includes(method.value) && paise(value) > 0 ? (
              <View style={styles.referenceRow}>
                <TextInput
                  value={references[method.value] ?? ''}
                  onChangeText={text =>
                    setReferences({ ...references, [method.value]: text })
                  }
                  placeholder="Reference no. (optional)"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.secondary}
                  autoCapitalize="characters"
                  style={styles.reference}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.summary}>
        <SummaryLine
          label="Amount due"
          value={formatRupees(summary.amountDue)}
        />
        <SummaryLine
          label="Paying now"
          value={formatRupees(paidNowPaise / 100)}
        />
        <SummaryLine
          label={useCredit ? 'On Customer Credit' : 'Still unpaid'}
          value={formatRupees(Math.max(0, remainingPaise) / 100)}
          strong
        />
      </View>

      {summary.creditAllowed && !summary.credit ? (
        <View style={styles.credit}>
          <View style={styles.creditRow}>
            <View style={styles.flex}>
              <Text style={styles.creditTitle}>
                Put the rest on Customer Credit
              </Text>
              <Text style={styles.creditText}>
                The customer takes the order now and pays the balance later.
              </Text>
            </View>
            <Switch
              value={useCredit}
              onValueChange={setUseCredit}
              trackColor={{ true: colors.secondary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
          {useCredit ? (
            <CreditTermsForm
              value={terms}
              onChange={setTerms}
              maxDays={summary.maxCreditDays}
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

function SummaryLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  method: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  methodLabel: {
    width: 110,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  amountBox: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rupee: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textSecondary,
  },
  amountInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  referenceRow: { width: '100%', paddingLeft: 120 },
  reference: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.text,
  },
  summary: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    gap: 4,
  },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontFamily: fonts.semibold,
    fontSize: 13.5,
    color: colors.text,
  },
  summaryStrong: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  credit: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: '#faf5ff',
    gap: 12,
  },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creditTitle: { fontFamily: fonts.bold, fontSize: 14, color: '#5b21b6' },
  creditText: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#6d28d9',
  },
  problem: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.errorDark,
  },
});
