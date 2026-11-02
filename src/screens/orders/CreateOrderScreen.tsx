import React, { useEffect, useMemo, useState } from 'react';
import { Alert as NativeAlert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { formatRupees } from '../../lib/format';
import { addAmount, itemCount, lineProblem, startOf, stockShortfall, type OrderLine } from '../../lib/order-lines';
import { methodLabel, PAYMENT_METHODS, type PaymentMethod } from '../../lib/orders';
import { priceOrder, type OrderDiscountType } from '../../lib/seller-order-pricing';
import {
  sellerOrderService,
  type CatalogItem,
  type CreateSellerOrderPayload,
  type SellerCoupon,
  type SellerOrderResult,
  type SellerPaymentOption,
  type SellerStore,
  type StoreCustomer,
} from '../../services/seller-order-service';
import { orderRequestService, type OrderRequestDetail } from '../../services/order-request-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, Row } from '../../components/ui/Card';
import { Checkbox } from '../../components/ui/Checkbox';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { ProductPicker } from '../../components/create-order/ProductPicker';
import { LineCard } from '../../components/create-order/LineCard';
import {
  CustomerNote,
  customerProblem,
  EMPTY_CUSTOMER,
  ExistingCustomerPicker,
  NewCustomerForm,
  type CustomerDraft,
} from '../../components/create-order/CustomerStep';
import { CreditTermsForm, creditPayload, creditTermsProblem, defaultCreditTerms, type CreditTerms } from '../../components/orders/CreditTermsForm';
import { CartIcon, CheckCircleIcon, PlusIcon, SearchIcon, StoreIcon, TagIcon, UserIcon, WalletIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

type Stage = 1 | 2 | 3;
type SaleType = 'QUICK_SALE' | 'EXISTING' | 'NEW';
interface PaymentLine {
  method: PaymentMethod;
  amount: string;
  reference: string;
}

const STAGES: { value: Stage; label: string }[] = [
  { value: 1, label: 'Products' },
  { value: 2, label: 'Customer' },
  { value: 3, label: 'Payment' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const paise = (n: number) => Math.round(n * 100);
const newLine = (method: PaymentMethod = 'CASH'): PaymentLine => ({ method, amount: '', reference: '' });

/**
 * "Add Self Orders" from the Seller Panel: a seller places an order for a
 * customer — at the counter or over the phone — and takes payment in one go.
 * With `requestId` it's an order request's final bill (store, customer and
 * items filled in; saving links the order to the request).
 */
export function CreateOrderScreen({ navigation, route }: ScreenProps<'CreateOrder'>) {
  const requestId = route.params?.requestId;
  const insets = useSafeAreaInsets();
  const { hasPermission } = useAuth();

  const [stores, setStores] = useState<SellerStore[] | null>(null);
  const [request, setRequest] = useState<OrderRequestDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState('');

  const [stage, setStage] = useState<Stage>(1);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [coupon, setCoupon] = useState<SellerCoupon | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [confirmedShort, setConfirmedShort] = useState('');
  const [stockNotice, setStockNotice] = useState<string | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);

  const [saleType, setSaleType] = useState<SaleType | null>(null);
  const [existing, setExisting] = useState<StoreCustomer | null>(null);
  const [customer, setCustomer] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [customerNote, setCustomerNote] = useState('');

  const [discountType, setDiscountType] = useState<OrderDiscountType>('NONE');
  const [discountValue, setDiscountValue] = useState('');
  const [option, setOption] = useState<SellerPaymentOption>('PAY_NOW');
  const [split, setSplit] = useState(false);
  const [payments, setPayments] = useState<PaymentLine[]>([newLine()]);
  const [received, setReceived] = useState('');
  const [upfront, setUpfront] = useState<PaymentLine>(newLine());
  const [terms, setTerms] = useState<CreditTerms>(defaultCreditTerms(15));
  const [handOverNow, setHandOverNow] = useState(true);
  const [remarks, setRemarks] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SellerOrderResult | null>(null);

  // The stores the seller can sell from; a request is billed at its own store, with its customer and items.
  useEffect(() => {
    (async () => {
      try {
        const list = await sellerOrderService.stores();
        setStores(list);
        if (requestId) {
          const req = await orderRequestService.get(requestId);
          setRequest(req);
          setStoreId(req.store.id);
          setSaleType('NEW');
          setCustomer({
            ...EMPTY_CUSTOMER,
            countryCode: req.customer.countryCode || '91',
            phone: req.customer.mobile,
            name: req.customer.name,
            email: req.customer.email ?? '',
            address: req.customer.address ?? '',
          });
          setCustomerNote(req.customer.note ?? '');
          setLines(
            req.items
              .filter(item => item.catalogItem)
              .map(item => ({ item: item.catalogItem!, quantity: item.quantity, uom: item.uom, discount: '' })),
          );
        } else if (list.length === 1) {
          setStoreId(list[0].id);
        }
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      }
    })();
  }, [requestId]);

  const store = stores?.find(s => s.id === storeId) ?? null;
  useEffect(() => {
    if (store) setTerms(defaultCreditTerms(store.maxCreditDays));
  }, [store]);

  // Same arithmetic as the server.
  const pricing = priceOrder(
    lines.map(l => ({ item: l.item, quantity: l.quantity, uom: l.uom, discount: Number(l.discount) || 0 })),
    coupon,
    store?.taxInclusive ?? true,
    { type: discountType, value: discountValue.trim() === '' ? 0 : Number(discountValue) },
  );
  const inOrder = useMemo(() => new Map(lines.map(l => [l.item.variantId, itemCount([l])])), [lines]);
  const units = itemCount(lines);

  const quickSale = saleType === 'QUICK_SALE' && !request;
  const existingMode = saleType === 'EXISTING';
  const method = payments[0].method;
  const paidNow =
    option === 'PAY_NOW'
      ? split
        ? payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        : pricing.total
      : Number(upfront.amount) || 0;
  const remaining = round2(pricing.total - paidNow);
  const cashReceived = option === 'PAY_NOW' && !split && method === 'CASH' && received.trim() ? Number(received) || 0 : null;

  const shortLines = lines.filter(l => stockShortfall(l));
  const shortKey = shortLines.map(l => l.item.variantId).sort().join(',');
  const shortConfirmed = !shortLines.length || confirmedShort === shortKey;
  const badLine = lines.find((l, i) => lineProblem(l, pricing.quantityDiscounts[i]?.discount ?? 0) !== null);

  // Why a step can't be left yet (first reason only), as the Seller Panel checks.
  const itemsBlocker = !store
    ? 'Choose the store'
    : !lines.length
      ? 'Add at least one item'
      : badLine
        ? `Check the quantity and discount of ${badLine.item.productName}`
        : pricing.couponProblem
          ? pricing.couponProblem
          : !shortConfirmed
            ? `Confirm the out-of-stock item${shortLines.length === 1 ? '' : 's'} to continue`
            : null;
  const customerBlocker = quickSale
    ? null
    : !saleType
      ? 'Choose who is buying'
      : customerProblem(customer, existing, existingMode ? 'EXISTING' : 'NEW');
  const reachable: Stage = itemsBlocker ? 1 : customerBlocker ? 2 : 3;
  const paymentBlocker = !store
    ? 'Choose the store'
    : option === 'PAY_NOW' && split && paise(paidNow) !== paise(pricing.total)
      ? `Payments must add up to ${formatRupees(pricing.total)} (${remaining > 0 ? `${formatRupees(remaining)} left` : `${formatRupees(-remaining)} too much`})`
      : cashReceived !== null && paise(cashReceived) < paise(pricing.total)
        ? `Received amount is ${formatRupees(round2(pricing.total - cashReceived))} short`
        : option === 'PAY_CREDIT' && quickSale
          ? 'A Quick Sale is paid now — choose a customer to sell on credit'
          : option === 'PAY_CREDIT' && !store.creditAllowed
            ? 'Customer Credit is turned off for this store'
            : option === 'PAY_CREDIT' && creditTermsProblem(terms, store.maxCreditDays)
              ? creditTermsProblem(terms, store.maxCreditDays)
              : option === 'PAY_CREDIT' && paise(paidNow) >= paise(pricing.total)
                ? 'The upfront payment covers the whole order — use Pay now'
                : null;
  const blocker = itemsBlocker ?? customerBlocker ?? pricing.orderDiscountProblem ?? paymentBlocker;

  // ── Products ──
  function addItem(item: CatalogItem) {
    const start = startOf(item);
    setLines(prev => {
      const found = prev.find(l => l.item.variantId === item.variantId);
      if (found) return prev.map(l => (l === found ? { ...l, quantity: addAmount(item, l, start.quantity, start.uom) } : l));
      // Beyond the stock is allowed: the seller orders it anyway (and confirms it).
      return [...prev, { item, quantity: start.quantity, uom: start.uom, discount: '' }];
    });
  }
  const updateLine = (variantId: string, patch: Partial<OrderLine>) =>
    setLines(prev => prev.map(l => (l.item.variantId === variantId ? { ...l, ...patch } : l)));

  function changeStore(id: string) {
    if (id === storeId) return;
    setStoreId(id);
    setLines([]);
    setCoupon(null);
    setExisting(null);
    setOption('PAY_NOW');
    setStage(1);
  }

  async function applyCoupon() {
    if (!store || !couponCode.trim()) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const phoneOk = /^\d{10}$/.test(customer.phone);
      setCoupon(await sellerOrderService.coupon(store.id, couponCode.trim().toUpperCase(), !quickSale && phoneOk ? customer.phone : undefined));
      setCouponCode('');
    } catch (err) {
      setCouponError(extractErrorMessage(err));
    } finally {
      setCouponBusy(false);
    }
  }

  /**
   * Leaving the products step: price and stock are fetched again (stock moves
   * while the order is taken), so anything now out of stock is shown here.
   */
  async function productsNext() {
    if (!store || itemsBlocker) return;
    setCheckingStock(true);
    setStockNotice(null);
    try {
      const fresh = await sellerOrderService.catalog(store.id, undefined, undefined, lines.map(l => l.item.variantId));
      const byVariant = new Map(fresh.map(i => [i.variantId, i]));
      const gone = lines.filter(l => !byVariant.has(l.item.variantId));
      const updated = lines.filter(l => byVariant.has(l.item.variantId)).map(l => ({ ...l, item: byVariant.get(l.item.variantId)! }));
      const newlyShort = updated.filter(l => stockShortfall(l) && !stockShortfall(lines.find(o => o.item.variantId === l.item.variantId)!));
      setLines(updated);
      if (gone.length || newlyShort.length) {
        setStockNotice(
          [
            gone.length ? `No longer for sale here, removed: ${gone.map(l => l.item.productName).join(', ')}.` : '',
            newlyShort.length ? `Stock changed — now out of stock: ${newlyShort.map(l => l.item.productName).join(', ')}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
        );
        return;
      }
      setStage(2);
    } catch {
      // Couldn't refresh: carry on; the server checks again when the order is placed.
      setStage(2);
    } finally {
      setCheckingStock(false);
    }
  }

  function chooseSaleType(type: SaleType) {
    setSaleType(type);
    if (type === 'QUICK_SALE') {
      setOption('PAY_NOW');
      setStage(3);
    }
    if (type !== 'EXISTING') setExisting(null);
  }

  function pickExisting(c: StoreCustomer | null) {
    setExisting(c);
    if (c) setCustomer({ ...customer, countryCode: '91', phone: c.phone, name: c.name, email: c.email ?? '' });
  }

  function addNewFromSearch(query: string) {
    setSaleType('NEW');
    setExisting(null);
    setCustomer({ ...EMPTY_CUSTOMER, ...(/^\d+$/.test(query) ? { phone: query.slice(0, 10) } : { name: query }) });
  }

  // ── Placing the order ──
  async function submit() {
    if (blocker || !store) return;
    setSubmitting(true);
    setError(null);
    try {
      const line = (p: PaymentLine, withAmount: boolean) => ({
        method: p.method,
        ...(withAmount ? { amount: Number(p.amount) } : {}),
        ...(p.reference.trim() ? { referenceNumber: p.reference.trim() } : {}),
      });
      const discounts = lines.filter(l => Number(l.discount) > 0).map(l => ({ variantId: l.item.variantId, amount: round2(Number(l.discount)) }));
      const common = {
        storeId: store.id,
        ...(shortLines.length ? { allowOutOfStock: true } : {}),
        items: lines.map(l => ({ productId: l.item.productId, variantId: l.item.variantId, quantity: l.quantity, uom: l.uom })),
        ...(discounts.length ? { discounts } : {}),
        ...(coupon ? { couponCode: coupon.code } : {}),
        ...(discountType !== 'NONE' && pricing.orderDiscountOff > 0 ? { orderDiscountType: discountType, orderDiscountValue: Number(discountValue) } : {}),
        handOverNow,
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      };
      const nowPayments = split ? payments.filter(p => Number(p.amount) > 0).map(p => line(p, true)) : [line(payments[0], false)];
      const payload: CreateSellerOrderPayload & { allowOutOfStock?: boolean } = quickSale
        ? { ...common, orderType: 'QUICK_SALE', paymentOption: 'PAY_NOW', payments: nowPayments }
        : {
            ...common,
            customerName: existingMode ? existing?.name.trim() ?? '' : customer.name.trim(),
            customerPhone: customer.phone,
            ...(customer.email.trim() ? { customerEmail: customer.email.trim() } : {}),
            countryCode: existingMode ? '91' : customer.countryCode,
            customerType: customer.customerType,
            ...(!existingMode && customer.address.trim() ? { customerAddress: customer.address.trim() } : {}),
            ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
            // A picked customer is already saved.
            saveCustomer: existingMode || customer.saveCustomer,
            paymentOption: option,
            payments: option === 'PAY_NOW' ? nowPayments : Number(upfront.amount) > 0 ? [line(upfront, true)] : [],
            ...(option === 'PAY_CREDIT' ? { credit: creditPayload(terms) } : {}),
          };
      const created = request ? await orderRequestService.bill(request.id, payload) : await sellerOrderService.create(payload);
      setResult(created);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setResult(null);
    setLines([]);
    setCoupon(null);
    setDiscountType('NONE');
    setDiscountValue('');
    setCustomer(EMPTY_CUSTOMER);
    setCustomerNote('');
    setExisting(null);
    setPayments([newLine()]);
    setUpfront(newLine());
    setReceived('');
    setSplit(false);
    setOption('PAY_NOW');
    setRemarks('');
    setError(null);
    setHandOverNow(true);
    // Back-to-back quick sales stay quick sales.
    setSaleType(quickSale ? 'QUICK_SALE' : null);
    setStage(1);
  }

  function leave() {
    if (!lines.length || result) return navigation.goBack();
    NativeAlert.alert('Discard this order?', 'The items and details you entered will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }

  const title = request ? `Final bill · ${request.requestNumber}` : 'New order';

  if (!hasPermission('orders:manage')) {
    return (
      <View style={styles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ErrorState message="You don't have permission to create orders." onRetry={navigation.goBack} />
      </View>
    );
  }
  if (loadError) {
    return (
      <View style={styles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ErrorState message={loadError} onRetry={() => navigation.replace('CreateOrder', route.params)} />
      </View>
    );
  }
  if (!stores || (requestId && !request)) {
    return (
      <View style={styles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <View style={styles.content}>
          <ListSkeleton rows={3} height={110} />
        </View>
      </View>
    );
  }

  if (result) {
    const p = result.payment;
    const credit = p.onCredit > 0 && p.credit ? p.credit : null;
    const customerName = quickSale ? null : existingMode ? existing?.name : customer.name.trim();
    return (
      <View style={styles.screen}>
        <AppHeader title="Order placed" onBack={navigation.goBack} />
        <ScrollView contentContainerStyle={[styles.content, styles.placed]}>
          <View style={styles.placedIcon}>
            <CheckCircleIcon size={44} color={colors.success} />
          </View>
          <Text style={styles.placedTitle}>Order placed</Text>
          <Text style={styles.placedText}>
            #{result.orderNumber} {customerName ? `for ${customerName}` : '· Quick Sale'} at {store?.name} ·{' '}
            {handOverNow ? 'completed and invoiced' : 'accepted, waiting for pickup'}
          </Text>
          <Card style={styles.placedCard}>
            <Row label="Total" value={formatRupees(result.totalAmount)} strong />
            <Row label="Paid now" value={formatRupees(p.paidAtOrder)} />
            {credit ? <Row label="On Customer Credit" value={`${formatRupees(p.onCredit)} · due ${formatDay(credit.dueDate)}`} tone="#7c3aed" /> : null}
          </Card>
          <Button title="View order" onPress={() => navigation.replace('OrderDetail', { id: result.orderId })} style={styles.fullWidth} />
          {request ? (
            <Button title="Back to request" variant="ghost" onPress={() => navigation.goBack()} style={styles.fullWidth} />
          ) : (
            <Button title={quickSale ? 'New quick sale' : 'New order'} variant="ghost" onPress={startOver} style={styles.fullWidth} />
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title={title} subtitle={store ? store.name : 'Choose the store'} onBack={leave} />

      {/* 1 Products → 2 Customer → 3 Payment; earlier steps, and the next once ready, can be opened. */}
      <View style={styles.stages}>
        {STAGES.map(s => {
          const open = s.value <= reachable || s.value < stage;
          const current = s.value === stage;
          const done = s.value < stage;
          return (
            <Pressable
              key={s.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: current, disabled: !open }}
              disabled={!open || (s.value === 2 && quickSale)}
              onPress={() => setStage(s.value)}
              style={[styles.stage, current && styles.stageCurrent]}
            >
              <View style={[styles.stageDot, done && styles.stageDotDone, current && styles.stageDotCurrent]}>
                <Text style={[styles.stageNum, (done || current) && styles.stageNumOn]}>{s.value}</Text>
              </View>
              <Text style={[styles.stageLabel, current && styles.stageLabelCurrent]}>
                {s.value === 2 && quickSale ? 'Quick Sale' : s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {stage === 1 ? (
            <>
              {stores.length > 1 && !request ? (
                <Card title="Store" icon={StoreIcon}>
                  <View style={styles.choices}>
                    {stores.map(s => (
                      <Pressable
                        key={s.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: s.id === storeId }}
                        onPress={() => changeStore(s.id)}
                        style={[styles.choice, s.id === storeId && styles.choiceOn]}
                      >
                        <Text style={[styles.choiceText, s.id === storeId && styles.choiceTextOn]}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              ) : null}

              {store ? (
                <Pressable accessibilityRole="button" onPress={() => setPickerOpen(true)} style={styles.addProducts}>
                  <PlusIcon size={20} color={colors.secondary} strokeWidth={2.4} />
                  <Text style={styles.addProductsText}>Add products</Text>
                  <SearchIcon size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}

              {request && request.items.some(i => !i.catalogItem) ? (
                <Alert
                  message={`Not for sale now, left out: ${request.items
                    .filter(i => !i.catalogItem)
                    .map(i => i.name)
                    .join(', ')}.`}
                />
              ) : null}

              {lines.map((l, i) => (
                <LineCard
                  key={l.item.variantId}
                  line={l}
                  total={pricing.lineTotals[i] ?? 0}
                  quantityDiscount={pricing.quantityDiscounts[i] ?? null}
                  onQuantity={(quantity, uom) => updateLine(l.item.variantId, { quantity, uom })}
                  onDiscount={discount => updateLine(l.item.variantId, { discount })}
                  onRemove={() => setLines(prev => prev.filter(x => x !== l))}
                />
              ))}

              {lines.length ? (
                <Card title="Coupon" icon={TagIcon}>
                  {coupon ? (
                    <View style={styles.couponApplied}>
                      <Text style={styles.couponCode}>{coupon.code}</Text>
                      <Text style={styles.couponText} numberOfLines={2}>
                        {pricing.couponProblem ?? `−${formatRupees(pricing.couponOff)} · ${coupon.title}`}
                      </Text>
                      <Pressable onPress={() => setCoupon(null)} hitSlop={8}>
                        <Text style={styles.link}>Remove</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.couponRow}>
                      <TextInput
                        value={couponCode}
                        onChangeText={text => setCouponCode(text.toUpperCase())}
                        placeholder="Coupon code"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                        selectionColor={colors.secondary}
                        style={styles.couponInput}
                      />
                      <Pressable onPress={applyCoupon} disabled={couponBusy || !couponCode.trim()} style={styles.applyBtn}>
                        <Text style={styles.applyText}>{couponBusy ? 'Checking…' : 'Apply'}</Text>
                      </Pressable>
                    </View>
                  )}
                  {couponError ? <Text style={styles.problem}>{couponError}</Text> : null}
                </Card>
              ) : null}

              {shortLines.length ? (
                <View style={styles.short}>
                  <Text style={styles.shortTitle}>Not enough stock</Text>
                  {shortLines.map(l => (
                    <Text key={l.item.variantId} style={styles.shortText}>
                      {l.item.productName}: {stockShortfall(l)}
                    </Text>
                  ))}
                  <Checkbox
                    label="Sell anyway — the stock goes below 0"
                    checked={shortConfirmed}
                    onChange={on => setConfirmedShort(on ? shortKey : '')}
                  />
                </View>
              ) : null}
              {stockNotice ? <Alert message={stockNotice} /> : null}
            </>
          ) : null}

          {stage === 2 ? (
            <>
              {!request ? (
                <View style={styles.saleTypes}>
                  {(
                    [
                      ['QUICK_SALE', 'Quick Sale', 'No customer details', CartIcon],
                      ['EXISTING', 'Existing', 'Search customers', SearchIcon],
                      ['NEW', 'New customer', 'Enter details', UserIcon],
                    ] as const
                  ).map(([value, label, hint, Icon]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: saleType === value }}
                      onPress={() => chooseSaleType(value)}
                      style={[styles.saleType, saleType === value && styles.saleTypeOn]}
                    >
                      <Icon size={22} color={saleType === value ? colors.secondary : colors.textSecondary} />
                      <Text style={styles.saleTypeLabel}>{label}</Text>
                      <Text style={styles.saleTypeHint}>{hint}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {saleType === 'EXISTING' && store ? (
                <Card title="Customer" icon={UserIcon}>
                  <ExistingCustomerPicker storeId={store.id} selected={existing} onSelect={pickExisting} onAddNew={addNewFromSearch} />
                </Card>
              ) : null}
              {saleType === 'NEW' ? (
                <Card title={request ? "Customer (from the request)" : 'New customer'} icon={UserIcon}>
                  <NewCustomerForm value={customer} onChange={setCustomer} />
                </Card>
              ) : null}
              {saleType === 'EXISTING' || saleType === 'NEW' ? (
                <Card>
                  <CustomerNote value={customerNote} onChange={setCustomerNote} />
                  <View style={styles.gap} />
                  <Checkbox
                    label="Phone order — the customer picks it up later"
                    checked={!handOverNow}
                    onChange={later => setHandOverNow(!later)}
                  />
                </Card>
              ) : null}
            </>
          ) : null}

          {stage === 3 ? (
            <>
              <Card title="Discount" icon={TagIcon}>
                <View style={styles.choices}>
                  {(
                    [
                      ['NONE', 'None'],
                      ['FLAT', '₹ Flat'],
                      ['PERCENTAGE', '% Percent'],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: discountType === value }}
                      onPress={() => setDiscountType(value)}
                      style={[styles.choice, discountType === value && styles.choiceOn]}
                    >
                      <Text style={[styles.choiceText, discountType === value && styles.choiceTextOn]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                {discountType !== 'NONE' ? (
                  <TextInput
                    value={discountValue}
                    onChangeText={text => setDiscountValue(text.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder={discountType === 'FLAT' ? 'Amount off (₹)' : 'Percent off'}
                    placeholderTextColor={colors.textMuted}
                    selectionColor={colors.secondary}
                    style={[styles.input, styles.inputGap]}
                  />
                ) : null}
                {pricing.orderDiscountProblem ? <Text style={styles.problem}>{pricing.orderDiscountProblem}</Text> : null}
              </Card>

              <Card title="Payment" icon={WalletIcon}>
                {!quickSale && store?.creditAllowed ? (
                  <View style={[styles.choices, styles.inputGapBottom]}>
                    {(
                      [
                        ['PAY_NOW', 'Pay now'],
                        ['PAY_CREDIT', 'Customer Credit'],
                      ] as const
                    ).map(([value, label]) => (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityLabel={`Payment option: ${label}`}
                        accessibilityState={{ selected: option === value }}
                        onPress={() => setOption(value)}
                        style={[styles.choice, styles.choiceWide, option === value && styles.choiceOn]}
                      >
                        <Text style={[styles.choiceText, option === value && styles.choiceTextOn]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {option === 'PAY_NOW' ? (
                  <>
                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>Split across methods</Text>
                      <Switch value={split} onValueChange={setSplit} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} />
                    </View>
                    {!split ? (
                      <>
                        <MethodChips value={method} onChange={m => setPayments([{ ...payments[0], method: m }])} />
                        {method === 'CASH' ? (
                          <>
                            <TextInput
                              value={received}
                              onChangeText={text => setReceived(text.replace(/[^0-9.]/g, ''))}
                              keyboardType="decimal-pad"
                              placeholder={`Cash received (₹${pricing.total})`}
                              placeholderTextColor={colors.textMuted}
                              selectionColor={colors.secondary}
                              style={[styles.input, styles.inputGap]}
                            />
                            {cashReceived !== null && cashReceived > pricing.total ? (
                              <Text style={styles.change}>Give back {formatRupees(round2(cashReceived - pricing.total))}</Text>
                            ) : null}
                          </>
                        ) : (
                          <TextInput
                            value={payments[0].reference}
                            onChangeText={reference => setPayments([{ ...payments[0], reference }])}
                            placeholder="Reference / transaction ID (optional)"
                            placeholderTextColor={colors.textMuted}
                            selectionColor={colors.secondary}
                            maxLength={100}
                            style={[styles.input, styles.inputGap]}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        {payments.map((p, i) => (
                          <View key={i} style={styles.splitLine}>
                            <MethodChips value={p.method} onChange={m => setPayments(prev => prev.map((x, j) => (j === i ? { ...x, method: m } : x)))} />
                            <View style={styles.splitInputs}>
                              <TextInput
                                value={p.amount}
                                onChangeText={amount => setPayments(prev => prev.map((x, j) => (j === i ? { ...x, amount: amount.replace(/[^0-9.]/g, '') } : x)))}
                                keyboardType="decimal-pad"
                                placeholder="Amount"
                                placeholderTextColor={colors.textMuted}
                                selectionColor={colors.secondary}
                                accessibilityLabel={`Payment ${i + 1} amount`}
                                style={[styles.input, styles.flex]}
                              />
                              {p.method !== 'CASH' ? (
                                <TextInput
                                  value={p.reference}
                                  onChangeText={reference => setPayments(prev => prev.map((x, j) => (j === i ? { ...x, reference } : x)))}
                                  placeholder="Reference"
                                  placeholderTextColor={colors.textMuted}
                                  selectionColor={colors.secondary}
                                  style={[styles.input, styles.flex]}
                                />
                              ) : null}
                            </View>
                            {payments.length > 1 ? (
                              <Pressable onPress={() => setPayments(prev => prev.filter((_, j) => j !== i))} hitSlop={6}>
                                <Text style={styles.removeLine}>Remove</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ))}
                        <Pressable onPress={() => setPayments(prev => [...prev, newLine('UPI')])} style={styles.addLine}>
                          <Text style={styles.link}>+ Add a payment method</Text>
                        </Pressable>
                        <Text style={styles.splitLeft}>
                          {remaining === 0 ? 'Fully paid' : remaining > 0 ? `${formatRupees(remaining)} left` : `${formatRupees(-remaining)} too much`}
                        </Text>
                      </>
                    )}
                  </>
                ) : store ? (
                  <View style={styles.creditBox}>
                    <Text style={styles.creditTitle}>Paid now (optional)</Text>
                    <MethodChips value={upfront.method} onChange={m => setUpfront({ ...upfront, method: m })} />
                    <TextInput
                      value={upfront.amount}
                      onChangeText={amount => setUpfront({ ...upfront, amount: amount.replace(/[^0-9.]/g, '') })}
                      keyboardType="decimal-pad"
                      placeholder="₹0"
                      placeholderTextColor={colors.textMuted}
                      selectionColor={colors.secondary}
                      style={styles.input}
                    />
                    <Text style={styles.creditTitle}>On credit: {formatRupees(Math.max(0, remaining))}</Text>
                    <CreditTermsForm value={terms} onChange={setTerms} maxDays={store.maxCreditDays} />
                  </View>
                ) : null}
              </Card>

              <Card>
                <View style={styles.switchRow}>
                  <View style={styles.flex}>
                    <Text style={styles.switchLabel}>Hand over now</Text>
                    <Text style={styles.switchHint}>
                      {handOverNow ? 'Completed and invoiced when placed' : 'Accepted; the customer picks it up later'}
                    </Text>
                  </View>
                  <Switch value={handOverNow} onValueChange={setHandOverNow} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} />
                </View>
                <TextInput
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Remarks for the store (optional)"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.secondary}
                  style={[styles.input, styles.inputGap]}
                />
              </Card>

              <Card title="Summary">
                <Row label={`Items (${units})`} value={formatRupees(pricing.gross)} />
                {pricing.quantityOff > 0 ? <Row label="Quantity discounts" value={`−${formatRupees(pricing.quantityOff)}`} tone={colors.successDark} /> : null}
                {pricing.lineDiscounts > 0 ? <Row label="Item discounts" value={`−${formatRupees(pricing.lineDiscounts)}`} tone={colors.successDark} /> : null}
                {pricing.orderDiscountOff > 0 ? <Row label="Order discount" value={`−${formatRupees(pricing.orderDiscountOff)}`} tone={colors.successDark} /> : null}
                {pricing.couponOff > 0 ? <Row label={`Coupon ${coupon?.code ?? ''}`} value={`−${formatRupees(pricing.couponOff)}`} tone={colors.successDark} /> : null}
                <Row label={store?.taxInclusive === false ? 'GST' : 'GST (included)'} value={formatRupees(pricing.tax)} />
                <View style={styles.divider} />
                <Row label="Total" value={formatRupees(pricing.total)} strong />
                {option === 'PAY_NOW' && !split ? <Row label="Paid by" value={methodLabel(method)} /> : null}
              </Card>
              {error ? <Alert message={error} /> : null}
            </>
          ) : null}
        </ScrollView>

        {/* Total, what's still needed, and the next step. */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.footerTop}>
            <Text style={styles.footerItems}>
              {units} item{units === 1 ? '' : 's'}
            </Text>
            <Text style={styles.footerTotal}>{formatRupees(pricing.total)}</Text>
          </View>
          {(stage === 1 ? itemsBlocker : stage === 2 ? customerBlocker : blocker) && lines.length ? (
            <Text style={styles.footerHint}>{stage === 1 ? itemsBlocker : stage === 2 ? customerBlocker : blocker}</Text>
          ) : null}
          <View style={styles.footerButtons}>
            {stage > 1 ? (
              <Pressable onPress={() => setStage(stage === 3 && quickSale ? 1 : ((stage - 1) as Stage))} style={styles.backBtn}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : null}
            {stage === 1 ? (
              <Button title="Continue" loading={checkingStock} loadingTitle="Checking stock…" disabled={!!itemsBlocker} onPress={productsNext} style={styles.flex} />
            ) : stage === 2 ? (
              <Button title="Continue to payment" disabled={!!customerBlocker} onPress={() => setStage(3)} style={styles.flex} />
            ) : (
              <Button
                title={request ? 'Save bill & create order' : `Place order · ${formatRupees(pricing.total)}`}
                loading={submitting}
                loadingTitle="Placing order…"
                disabled={!!blocker}
                onPress={submit}
                style={styles.flex}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {store ? (
        <ProductPicker visible={pickerOpen} storeId={store.id} inOrder={inOrder} onAdd={addItem} onClose={() => setPickerOpen(false)} />
      ) : null}
    </View>
  );
}

function MethodChips({ value, onChange }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  return (
    <View style={styles.choices}>
      {PAYMENT_METHODS.map(m => (
        <Pressable
          key={m.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === m.value }}
          onPress={() => onChange(m.value)}
          style={[styles.choice, value === m.value && styles.choiceOn]}
        >
          <Text style={[styles.choiceText, value === m.value && styles.choiceTextOn]}>{m.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fullWidth: { alignSelf: 'stretch' },
  gap: { height: 12 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  stages: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stage: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, borderRadius: radius.full },
  stageCurrent: { backgroundColor: colors.secondaryLight },
  stageDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  stageDotDone: { backgroundColor: colors.success },
  stageDotCurrent: { backgroundColor: colors.secondary },
  stageNum: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textMuted },
  stageNumOn: { color: colors.white },
  stageLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  stageLabelCurrent: { color: colors.secondaryDark },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingHorizontal: 14, height: 38, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  choiceWide: { flex: 1, alignItems: 'center' },
  choiceOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  choiceText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary },
  choiceTextOn: { color: colors.secondaryDark },
  addProducts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.secondarySoft,
    backgroundColor: '#fffaf5',
  },
  addProductsText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.secondary },
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  applyBtn: { paddingHorizontal: 16, height: 44, borderRadius: radius.md, justifyContent: 'center', backgroundColor: colors.primary },
  applyText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  couponApplied: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  couponCode: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.successLight,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.successDark,
  },
  couponText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.secondary },
  problem: { marginTop: 6, fontFamily: fonts.medium, fontSize: 12.5, color: colors.error },
  short: { gap: 6, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningLight },
  shortTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.warningDark },
  shortText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.warningDark },
  saleTypes: { flexDirection: 'row', gap: 8 },
  saleType: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  saleTypeOn: { borderColor: colors.secondary, backgroundColor: '#fffaf5' },
  saleTypeLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, textAlign: 'center' },
  saleTypeHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
  inputGap: { marginTop: 10 },
  inputGapBottom: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  switchLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  switchHint: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  change: { marginTop: 8, fontFamily: fonts.bold, fontSize: 14, color: colors.successDark },
  splitLine: { gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  splitInputs: { flexDirection: 'row', gap: 8 },
  removeLine: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.error },
  addLine: { paddingVertical: 10 },
  splitLeft: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  creditBox: { gap: 10 },
  creditTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: '#5b21b6' },
  divider: { marginVertical: 6, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  footer: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.raised,
  },
  footerTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  footerItems: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  footerTotal: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text },
  footerHint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningDark },
  footerButtons: { flexDirection: 'row', gap: 10 },
  backBtn: { height: 52, paddingHorizontal: 20, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  placed: { alignItems: 'center', paddingTop: 32 },
  placedIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successLight },
  placedTitle: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.text },
  placedText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  placedCard: { alignSelf: 'stretch' },
});
