import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { CREDIT_TERMS, expenseProblem, expenseTotals, GST_RATES, money, PAYMENT_MODES, shiftDay, todayDay } from '../../lib/operations';
import { formatRupees } from '../../lib/format';
import { expensesService, type ExpenseDetail, type ExpensePaymentType, type PaymentMode } from '../../services/expenses-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Button } from '../../components/ui/Button';
import { Choices, DateField, Field, Input, Section, SelectField } from '../../components/form/Fields';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles, PhotoAttachments, type PendingFile } from '../../components/operations/OpsParts';
import { AlertCircleIcon, WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { Trans, useTranslation } from 'react-i18next';

interface FormState {
  expenseDate: string;
  categoryId: string;
  title: string;
  description: string;
  notes: string;
  referenceNumber: string;
  invoiceDate: string;
  paidTo: string;
  baseAmount: string;
  discountAmount: string;
  /** '' none, a rate, or 'custom' (tax typed in rupees). */
  gst: string;
  taxAmount: string;
  paymentType: ExpensePaymentType;
  paymentDate: string;
  method: PaymentMode;
  accountLabel: string;
  transactionReference: string;
  paymentNotes: string;
  initialPaid: string;
  /** An existing supplier, '' none, or 'new'. */
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  supplierGst: string;
  creditDate: string;
  terms: string;
  dueDate: string;
  reminderDate: string;
}

function initial(today: string, supplierId = ''): FormState {
  return {
    expenseDate: today,
    categoryId: '',
    title: '',
    description: '',
    notes: '',
    referenceNumber: '',
    invoiceDate: '',
    paidTo: '',
    baseAmount: '',
    discountAmount: '',
    gst: '',
    taxAmount: '',
    paymentType: supplierId ? 'CREDIT' : 'PAID',
    paymentDate: today,
    method: 'CASH',
    accountLabel: '',
    transactionReference: '',
    paymentNotes: '',
    initialPaid: '',
    supplierId,
    supplierName: '',
    supplierPhone: '',
    supplierAddress: '',
    supplierGst: '',
    creditDate: today,
    terms: '15',
    dueDate: shiftDay(today, 15),
    reminderDate: '',
  };
}

function fromExpense(e: ExpenseDetail, asCopy: boolean, today: string): FormState {
  const gst = e.taxRate === null ? (e.taxAmount ? 'custom' : '') : GST_RATES.includes(String(e.taxRate)) ? String(e.taxRate) : 'custom';
  const terms = e.creditTermsDays === null ? 'custom' : String(e.creditTermsDays);
  return {
    ...initial(today),
    expenseDate: asCopy ? today : e.expenseDate.slice(0, 10),
    categoryId: e.categoryId,
    title: e.title ?? '',
    description: e.description ?? '',
    notes: e.notes ?? '',
    referenceNumber: asCopy ? '' : e.referenceNumber ?? '',
    invoiceDate: asCopy ? '' : e.invoiceDate?.slice(0, 10) ?? '',
    paidTo: e.paidTo ?? '',
    baseAmount: String(e.baseAmount),
    discountAmount: e.discountAmount ? String(e.discountAmount) : '',
    gst,
    taxAmount: gst === 'custom' ? String(e.taxAmount) : '',
    paymentType: e.paymentType,
    method: e.payments[0]?.method ?? 'CASH',
    accountLabel: e.payments[0]?.accountLabel ?? '',
    supplierId: e.supplierId ?? '',
    creditDate: asCopy ? today : (e.creditDate ?? e.expenseDate).slice(0, 10),
    terms: CREDIT_TERMS.includes(Number(terms)) ? terms : 'custom',
    dueDate: asCopy ? (e.creditTermsDays !== null ? shiftDay(today, e.creditTermsDays) : '') : e.dueDate?.slice(0, 10) ?? '',
    reminderDate: asCopy ? '' : e.reminderDate?.slice(0, 10) ?? '',
  };
}

/** Record or edit an expense: PAID shows the payment, CREDIT the supplier and terms. */
export function ExpenseFormScreen({ navigation, route }: ScreenProps<'ExpenseForm'>) {
  const { t } = useTranslation();
  const expenseId = route.params?.id;
  const sourceId = expenseId ?? route.params?.copyOf ?? null;
  const { hasPermission } = useAuth();
  const allowed = hasPermission(expenseId ? 'store-expenses:edit' : 'store-expenses:create');
  const { current: store } = useStore();
  const storeId = allowed ? store?.id ?? '' : '';
  const source = useFetch(() => (storeId && sourceId ? expensesService.get(storeId, sourceId) : Promise.resolve(null)), [storeId, sourceId]);
  const title = expenseId ? t('expenses.editExpense') : t('expenses.addExpense');

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={t('common.expenses')} icon={WalletIcon} allowed={false} />
      </View>
    );
  }
  if (!storeId || (sourceId && (source.loading || !source.data)) || (expenseId && source.data?.status === 'CANCELLED')) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        {source.error ? (
          <ErrorState message={source.error} onRetry={() => source.reload()} />
        ) : expenseId && source.data?.status === 'CANCELLED' ? (
          <ErrorState message={t('expenses.aCancelledExpenseCanTBe')} onRetry={navigation.goBack} />
        ) : (
          <View style={opsStyles.content}>
            <ListSkeleton rows={4} height={140} />
          </View>
        )}
      </View>
    );
  }
  return <ExpenseFormBody key={sourceId ?? 'new'} storeId={storeId} expenseId={expenseId} source={source.data ?? null} supplierId={route.params?.supplierId} navigation={navigation} />;
}

function ExpenseFormBody({
  storeId,
  expenseId,
  source,
  supplierId,
  navigation,
}: {
  storeId: string;
  expenseId?: string;
  source: ExpenseDetail | null;
  supplierId?: string;
  navigation: ScreenProps<'ExpenseForm'>['navigation'];
}) {
  const { t: tr } = useTranslation();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const today = todayDay();
  const editing = !!expenseId;
  const categories = useFetch(() => expensesService.categories(storeId), [storeId]);
  const suppliers = useFetch(() => expensesService.suppliers(storeId), [storeId]);
  const [form, setForm] = useState<FormState>(() => (source ? fromExpense(source, !editing, today) : initial(today, supplierId)));
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [receipts, setReceipts] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollViewInstance>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const isCredit = form.paymentType === 'CREDIT';
  const newSupplier = form.supplierId === 'new';
  const totals = useMemo(
    () => expenseTotals({ baseAmount: form.baseAmount, discountAmount: form.discountAmount, gst: form.gst, taxAmount: form.taxAmount, initialPaid: form.initialPaid, isCredit }),
    [form.baseAmount, form.discountAmount, form.gst, form.taxAmount, form.initialPaid, isCredit],
  );
  const purchase = source?.kind === 'PURCHASE' && editing;
  const fromISO = (s: string) => new Date(`${s}T00:00:00`);
  const amountInput = (v: string) => v.replace(/[^\d.]/g, '');

  function setTerms(terms: string) {
    setForm(f => ({ ...f, terms, dueDate: terms === 'custom' ? f.dueDate : shiftDay(f.creditDate || f.expenseDate, Number(terms)) }));
  }

  async function save() {
    const problem = expenseProblem(
      {
        categoryId: form.categoryId,
        expenseDate: form.expenseDate,
        baseAmount: form.baseAmount,
        isCredit,
        newSupplier,
        supplierName: form.supplierName,
        supplierGst: form.supplierGst,
        creditDate: form.creditDate,
        dueDate: form.dueDate,
      },
      totals,
      editing ? { settled: (source?.paidAmount ?? 0) + (source?.returnedAmount ?? 0) } : null,
      formatRupees,
    );
    if (problem) {
      setError(problem);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setError('');
    setSaving(true);
    const credit = isCredit
      ? {
          creditDate: form.creditDate || undefined,
          creditTermsDays: form.terms === 'custom' ? undefined : Number(form.terms),
          dueDate: form.dueDate || undefined,
          reminderDate: form.reminderDate || undefined,
        }
      : undefined;
    const tax = form.gst === 'custom' ? { taxAmount: totals.tax, taxRate: null } : form.gst ? { taxRate: Number(form.gst) } : { taxRate: null, taxAmount: 0 };
    const common: Record<string, unknown> = {
      expenseDate: form.expenseDate,
      categoryId: form.categoryId,
      title: form.title.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
      referenceNumber: form.referenceNumber.trim(),
      invoiceDate: form.invoiceDate || (editing ? null : undefined),
      paidTo: form.paidTo.trim(),
      baseAmount: totals.base,
      discountAmount: totals.discount,
      ...tax,
    };
    const supplierInput = {
      name: form.supplierName.trim(),
      phone: form.supplierPhone.trim() || undefined,
      address: form.supplierAddress.trim() || undefined,
      gstNumber: form.supplierGst.trim().toUpperCase() || undefined,
    };
    const payment = {
      paymentDate: form.paymentDate || undefined,
      method: form.method,
      accountLabel: form.accountLabel.trim() || undefined,
      transactionReference: form.transactionReference.trim() || undefined,
      notes: form.paymentNotes.trim() || undefined,
      attachments: receipts.map(f => ({ fileId: f.fileId, kind: f.kind })),
    };
    try {
      let saved: ExpenseDetail;
      if (editing && expenseId) {
        if (newSupplier) {
          // The edit endpoint takes a supplier id: add the supplier first.
          const created = await expensesService.createSupplier(storeId, supplierInput);
          common.supplierId = created.id;
        } else if (form.supplierId || !isCredit) {
          common.supplierId = form.supplierId || null;
        }
        saved = await expensesService.update(storeId, expenseId, { ...common, credit });
        if (files.length) await expensesService.addAttachments(storeId, expenseId, files.map(f => ({ fileId: f.fileId, kind: f.kind })));
      } else {
        saved = await expensesService.create(storeId, {
          ...common,
          ...(newSupplier ? { supplier: supplierInput } : form.supplierId ? { supplierId: form.supplierId } : {}),
          paymentType: form.paymentType,
          payment: isCredit ? (totals.paid > 0 ? { ...payment, amount: totals.paid } : undefined) : payment,
          credit,
          attachments: files.map(f => ({ fileId: f.fileId, kind: f.kind })),
        });
      }
      toast(editing ? tr('expenses.expenseUpdated') : tr('expenses.expenseRecorded'));
      navigation.replace('ExpenseDetail', { id: saved.id });
    } catch (err) {
      setError(extractErrorMessage(err));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={opsStyles.screen}>
      <AppHeader
        title={editing ? tr('expenses.editNamed', { name: source?.idd ?? tr('expenses.expenseLower') }) : tr('expenses.addExpense')}
        subtitle={editing ? tr('expenses.paymentsAndReturnsAreRecordedOn') : tr('expenses.theExpenseNumberIsGivenWhen')}
        onBack={navigation.goBack}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={opsStyles.content} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={opsStyles.error}>
              <AlertCircleIcon size={16} color={colors.errorDark} />
              <Text style={opsStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Section title={tr('common.expense')}>
            <DateField label={tr('expenses.expenseDate')} required value={form.expenseDate} onChange={v => set('expenseDate', v)} maximumDate={new Date()} />
            {purchase ? (
              <Field label={tr('common.category')}>
                <Input value="Stock Purchases" editable={false} />
              </Field>
            ) : (
              <SelectField
                label={tr('common.category')}
                required
                value={form.categoryId}
                options={(categories.data ?? []).map(c => ({ value: c.id, label: c.name }))}
                onChange={v => set('categoryId', v)}
              />
            )}
            <Field label={tr('expenses.expenseTitle')}>
              <Input value={form.title} onChangeText={v => set('title', v)} placeholder="e.g. November shop rent" maxLength={150} />
            </Field>
            <Field label={tr('common.description')}>
              <Input value={form.description} onChangeText={v => set('description', v)} maxLength={500} multiline />
            </Field>
            <Field label={tr('expenses.invoiceBillNumber')}>
              <Input value={form.referenceNumber} onChangeText={v => set('referenceNumber', v)} maxLength={100} />
            </Field>
            <DateField label={tr('expenses.invoiceDate')} value={form.invoiceDate} onChange={v => set('invoiceDate', v)} maximumDate={new Date()} />
            {!editing && !purchase ? (
              <Text style={styles.tip}>{tr('expenses.buyingStockToResellRecordIt')}</Text>
            ) : null}
          </Section>

          <Section title={tr('common.amount')} subtitle={tr('expenses.finalAmountBaseDiscountGst')}>
            <Field label={tr('expenses.baseAmountRs')} required>
              <Input value={form.baseAmount} onChangeText={v => set('baseAmount', amountInput(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel={tr('expenses.baseAmount2')} />
            </Field>
            <Field label={tr('expenses.discountRs')}>
              <Input value={form.discountAmount} onChangeText={v => set('discountAmount', amountInput(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel={tr('common.discount')} />
            </Field>
            <Field label="GST">
              <Choices
                options={[{ value: '', label: tr('expenses.noGst') }, ...GST_RATES.map(r => ({ value: r, label: `${r}%` })), { value: 'custom', label: tr('expenses.enterTaxAmount') }]}
                value={form.gst}
                onChange={v => set('gst', v)}
              />
            </Field>
            {form.gst === 'custom' ? (
              <Field label={tr('expenses.taxAmountRs')}>
                <Input value={form.taxAmount} onChangeText={v => set('taxAmount', amountInput(v))} keyboardType="decimal-pad" accessibilityLabel={tr('expenses.taxAmount')} />
              </Field>
            ) : null}
            <View style={styles.totals}>
              <Total label={tr('expenses.base')} value={money(totals.base)} />
              <Total label={tr('common.discount')} value={`− ${money(totals.discount)}`} />
              <Total label="GST" value={`+ ${money(totals.tax)}`} />
              <Total label={tr('expenses.finalAmount')} value={formatRupees(totals.amount)} strong />
            </View>
          </Section>

          {!editing ? (
            <Section title={tr('common.payment')}>
              <View style={styles.typeRow}>
                {(
                  [
                    { value: 'PAID', label: tr('common.paid'), hint: tr('expenses.paidInFullNow') },
                    { value: 'CREDIT', label: tr('common.credit'), hint: tr('expenses.payTheSupplierLater') },
                  ] as const
                ).map(o => {
                  const on = form.paymentType === o.value;
                  return (
                    <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => set('paymentType', o.value)} style={[styles.type, on && styles.typeOn]}>
                      <Text style={styles.typeLabel}>{o.label}</Text>
                      <Text style={opsStyles.meta}>{o.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {isCredit ? (
                <>
                  <Field label={tr('expenses.initialPaidAmountRs')} hint={tr('expenses.leaveEmptyIfNothingIsPaid')}>
                    <Input value={form.initialPaid} onChangeText={v => set('initialPaid', amountInput(v))} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel={tr('expenses.initialPaidAmount')} />
                  </Field>
                  <View style={styles.outstanding}>
                    <Text style={styles.outstandingLabel}>{tr('expenses.outstandingWorkedOut')}</Text>
                    <Text style={styles.outstandingValue}>{formatRupees(totals.outstanding)}</Text>
                  </View>
                </>
              ) : null}
              {!isCredit || totals.paid > 0 ? (
                <>
                  <DateField label={tr('common.paymentDate')} value={form.paymentDate} onChange={v => set('paymentDate', v)} minimumDate={fromISO(form.expenseDate)} maximumDate={new Date()} />
                  <Field label={tr('common.paymentMethod')}>
                    <Choices options={PAYMENT_MODES} value={form.method} onChange={v => set('method', v as PaymentMode)} />
                  </Field>
                  <Field label={tr('expenses.paymentAccount')}>
                    <Input value={form.accountLabel} onChangeText={v => set('accountLabel', v)} placeholder="e.g. Cash drawer, HDFC current" maxLength={100} />
                  </Field>
                  <Field label={tr('common.transactionReference')}>
                    <Input value={form.transactionReference} onChangeText={v => set('transactionReference', v)} placeholder={tr('expenses.utrUpiChequeNo')} maxLength={100} />
                  </Field>
                  {!isCredit ? (
                    <Field label={tr('expenses.paidTo')}>
                      <Input value={form.paidTo} onChangeText={v => set('paidTo', v)} placeholder={tr('expenses.landlordStaffShopOptional')} maxLength={150} />
                    </Field>
                  ) : null}
                  <Field label={tr('expenses.paymentRemarks')}>
                    <Input value={form.paymentNotes} onChangeText={v => set('paymentNotes', v)} maxLength={1000} />
                  </Field>
                  <PhotoAttachments label={tr('expenses.paymentReceipt')} value={receipts} onChange={setReceipts} dirName="store-expenses" defaultKind="RECEIPT" max={5} kinds={false} />
                </>
              ) : null}
            </Section>
          ) : null}

          {isCredit || form.supplierId || !editing ? (
            <Section
              title={isCredit ? tr('expenses.supplierAndCredit') : tr('expenses.supplierOptional')}
              subtitle={isCredit ? tr('expenses.whoThisIsOwedToAnd') : tr('expenses.linkASupplierToSeeIt')}
            >
              <SelectField
                label={tr('expenses.supplierOptional')}
                value={form.supplierId}
                options={[
                  ...(suppliers.data?.items ?? []).map(s => ({ value: s.id, label: s.name, hint: s.outstanding ? tr('expenses.owedAmount', { amount: money(s.outstanding) }) : undefined })),
                  { value: 'new', label: tr('expenses.addANewSupplier') },
                ]}
                onChange={v => set('supplierId', v)}
                placeholder={tr('expenses.noSupplier')}
                allowClear={tr('expenses.noSupplier')}
              />
              {isCredit && !form.supplierId ? (
                <Field label={tr('expenses.owedTo')}>
                  <Input value={form.paidTo} onChangeText={v => set('paidTo', v)} placeholder={tr('expenses.shopOrPersonYouLlPay')} maxLength={150} />
                </Field>
              ) : null}
              {newSupplier ? (
                <>
                  <Field label={tr('expenses.supplierName')} required>
                    <Input value={form.supplierName} onChangeText={v => set('supplierName', v)} maxLength={150} accessibilityLabel={tr('expenses.supplierName2')} />
                  </Field>
                  <Field label={tr('expenses.mobileNumber')}>
                    <Input value={form.supplierPhone} onChangeText={v => set('supplierPhone', v)} maxLength={20} keyboardType="phone-pad" />
                  </Field>
                  <Field label={tr('expenses.gstNumber')} hint={tr('expenses.n15Characters')}>
                    <Input value={form.supplierGst} onChangeText={v => set('supplierGst', v.toUpperCase())} maxLength={15} autoCapitalize="characters" accessibilityLabel={tr('expenses.gstNumber2')} />
                  </Field>
                  <Field label={tr('common.address')}>
                    <Input value={form.supplierAddress} onChangeText={v => set('supplierAddress', v)} maxLength={500} />
                  </Field>
                </>
              ) : null}
              {isCredit ? (
                <>
                  <DateField
                    label={tr('expenses.creditDate')}
                    value={form.creditDate}
                    maximumDate={new Date()}
                    onChange={creditDate => setForm(f => ({ ...f, creditDate, dueDate: f.terms === 'custom' || !creditDate ? f.dueDate : shiftDay(creditDate, Number(f.terms)) }))}
                  />
                  <Field label={tr('expenses.creditTerms')}>
                    <Choices options={[...CREDIT_TERMS.map(t => ({ value: String(t), label: tr('expenses.tDays', { t }) })), { value: 'custom', label: tr('common.custom') }]} value={form.terms} onChange={setTerms} />
                  </Field>
                  <DateField
                    label={tr('expenses.paymentDueDate')}
                    hint={tr('expenses.remindersGoOut3DaysBefore')}
                    value={form.dueDate}
                    minimumDate={fromISO(form.creditDate || form.expenseDate)}
                    onChange={dueDate => setForm(f => ({ ...f, dueDate, terms: 'custom' }))}
                  />
                  <DateField label={tr('expenses.reminderDate')} hint={tr('expenses.anExtraReminderOptional')} value={form.reminderDate} onChange={v => set('reminderDate', v)} />
                </>
              ) : null}
            </Section>
          ) : null}

          <Section title={tr('common.attachments')} subtitle={tr('expenses.billInvoiceOrReceiptPhotos')}>
            <PhotoAttachments value={files} onChange={setFiles} dirName="store-expenses" />
            {editing && source?.attachmentCount ? <Text style={opsStyles.muted}>{tr('expenses.filesAlreadyAttachedStayNewOnes')}</Text> : null}
          </Section>
          <Section title={tr('common.notes')}>
            <Input value={form.notes} onChangeText={v => set('notes', v)} maxLength={2000} multiline placeholder={tr('expenses.anythingToRememberAboutThisExpense')} />
          </Section>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.footerText} numberOfLines={1}>
            <Trans i18nKey="expenses.finalAmount" values={{ amount: formatRupees(totals.amount) }} components={{ b: <Text style={styles.footerStrong} /> }} />
            {isCredit && !editing ? (
              <>
                {' · '}
                <Trans i18nKey="expenses.outstandingAmount" values={{ amount: formatRupees(totals.outstanding) }} components={{ owed: <Text style={styles.footerOwed} /> }} />
              </>
            ) : null}
          </Text>
          <View style={opsStyles.row}>
            <Button title={tr('common.cancel')} variant="ghost" onPress={navigation.goBack} style={styles.flex} />
            <Button title={editing ? tr('common.saveChanges') : tr('expenses.saveExpense')} onPress={save} loading={saving} style={styles.flex2} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.total}>
      <Text style={opsStyles.muted}>{label}</Text>
      <Text style={strong ? styles.totalStrong : styles.totalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  tip: { padding: 10, borderRadius: 8, backgroundColor: colors.background, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.background },
  total: { flexBasis: '45%', flexGrow: 1 },
  totalValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  totalStrong: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  typeRow: { flexDirection: 'row', gap: 10 },
  type: { flex: 1, gap: 2, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  typeOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  typeLabel: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  outstanding: { padding: 12, borderRadius: radius.md, backgroundColor: colors.warningLight },
  outstandingLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark },
  outstandingValue: { marginTop: 2, fontFamily: fonts.extrabold, fontSize: 20, color: colors.warningDark },
  footer: { gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
  footerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  footerStrong: { fontFamily: fonts.bold, color: colors.text },
  footerOwed: { fontFamily: fonts.bold, color: colors.warningDark },
});
