import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { todayDay } from '../../lib/operations';
import { lineFrom, linesTotal, qty, stockOrderPayload, stockOrderProblem, variantLabel, type OrderLine, type StockOrderForm } from '../../lib/stock-orders';
import { warehouseService } from '../../services/products-service';
import { storeOperationsService, type SkuOption } from '../../services/store-operations-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { DateField, Field, Input, SelectField } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { SearchBar } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, BoxIcon, PlusIcon, TrashIcon, TruckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const SEARCH_DELAY_MS = 250;
const fromDay = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
};

/** New Stock Order, as the panel's form: the supplier, the warehouse it arrives into, dates, products and their cost. */
export function StockOrderFormScreen({ navigation, route }: ScreenProps<'StockOrderForm'>) {
  const { t: tr } = useTranslation();
  const { hasPermission } = useAuth();
  const { current } = useStore();
  const toast = useToast();
  const allowed = hasPermission('pending-stock:manage');
  const storeId = allowed ? current?.id ?? '' : '';
  const today = todayDay();
  const prefill = route.params?.variantIds ?? [];
  const warehouses = useFetch(() => (storeId ? warehouseService.list() : Promise.resolve([])), [storeId]);
  const options = useMemo(() => (warehouses.data ?? []).filter(w => Number(w.status ?? 1) === 1).map(w => ({ value: String(w.id), label: String(w.facilityTitle ?? tr('common.warehouse')) })), [warehouses.data, tr]);
  const fallback = useMemo(() => {
    const list = (warehouses.data ?? []).filter(w => Number(w.status ?? 1) === 1);
    return list.length ? String((list.find(w => w.isDefault) ?? list[0]).id) : '';
  }, [warehouses.data]);

  const [form, setForm] = useState<StockOrderForm>({ warehouseId: '', supplierName: '', supplierPhone: '', referenceNumber: '', orderDate: today, expectedDate: '', orderAmount: '', notes: '' });
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SkuOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);
  const set = <K extends keyof StockOrderForm>(k: K, v: StockOrderForm[K]) => setForm(f => ({ ...f, [k]: v }));
  const warehouseId = form.warehouseId || fallback;

  // Low / out-of-stock SKUs handed over from Stock Health.
  const prefillKey = prefill.join(',');
  useEffect(() => {
    if (!storeId || !prefillKey) return;
    storeOperationsService
      .skus(storeId, { ids: prefillKey })
      .then(skus => setLines(skus.map(lineFrom)))
      .catch(err => setError(extractErrorMessage(err)));
  }, [storeId, prefillKey]);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2 || !storeId) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      storeOperationsService
        .skus(storeId, { search: q })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [storeId, term]);

  const computed = linesTotal(lines);
  const setLine = (i: number, patch: Partial<OrderLine>) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function save() {
    const f = { ...form, warehouseId };
    const problem = stockOrderProblem(f, lines, today);
    if (problem) {
      setError(problem);
      return scroll.current?.scrollToEnd({ animated: true });
    }
    setError('');
    setSaving(true);
    try {
      const order = await storeOperationsService.createStockOrder(storeId, stockOrderPayload(f, lines));
      toast(tr('inventory.stockOrderIddCreated', { idd: order.idd }));
      navigation.replace('StockOrderDetail', { id: order.id });
    } catch (err) {
      setError(extractErrorMessage(err));
      scroll.current?.scrollToEnd({ animated: true });
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={tr('inventory.newStockOrder')} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.pendingStock')} icon={TruckIcon} allowed={false} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={tr('inventory.newStockOrder')} subtitle={tr('common.pendingStock')} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <SectionCard icon={TruckIcon} title={tr('inventory.supplierAndDelivery')}>
          <Field label={tr('common.supplier')} required>
            <Input value={form.supplierName} onChangeText={v => set('supplierName', v)} placeholder="e.g. ABC Garments" maxLength={150} accessibilityLabel={tr('common.supplier')} />
          </Field>
          <Field label={tr('inventory.supplierPhone')}>
            <Input value={form.supplierPhone} onChangeText={v => set('supplierPhone', v)} keyboardType="phone-pad" maxLength={20} accessibilityLabel={tr('inventory.supplierPhone')} />
          </Field>
          <SelectField
            label={tr('inventory.receiveIntoWarehouse')}
            required
            value={warehouseId}
            options={options}
            onChange={v => set('warehouseId', v)}
            placeholder={warehouses.loading ? tr('common.loading') : tr('common.select')}
            emptyText={tr('inventory.noActiveWarehousesAddOneUnder')}
          />
          <Field label={tr('inventory.supplierPoInvoiceNo')}>
            <Input value={form.referenceNumber} onChangeText={v => set('referenceNumber', v)} maxLength={100} accessibilityLabel={tr('common.reference')} />
          </Field>
          <DateField label={tr('inventory.orderDate')} value={form.orderDate} onChange={v => set('orderDate', v)} maximumDate={new Date()} />
          <DateField label={tr('inventory.expectedDate')} value={form.expectedDate} onChange={v => set('expectedDate', v)} minimumDate={form.orderDate ? fromDay(form.orderDate) : undefined} />
        </SectionCard>

        <SectionCard icon={BoxIcon} title={tr('common.products')} subtitle={lines.length ? tr('common.productCount', { count: lines.length }) : undefined}>
          <SearchBar value={term} onChange={setTerm} placeholder={tr('inventory.searchProductOrSkuToAdd')} />
          {term.trim().length >= 2 ? (
            <View style={styles.results}>
              {searching && !results.length ? (
                <Text style={[opsStyles.muted, styles.pad]}>{tr('common.searching')}</Text>
              ) : !results.length ? (
                <Text style={[opsStyles.muted, styles.pad]}>{tr('common.noProductsFound')}</Text>
              ) : (
                results.map(s => {
                  const added = lines.some(l => l.sku.id === s.id);
                  return (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      accessibilityLabel={tr('inventory.addProductname', { productName: s.productName })}
                      disabled={added}
                      onPress={() => {
                        setLines(ls => [...ls, lineFrom(s)]);
                        setTerm('');
                      }}
                      style={[styles.result, added && styles.disabled]}
                    >
                      <View style={styles.flex}>
                        <Text style={opsStyles.title} numberOfLines={1}>
                          {s.productName}
                        </Text>
                        <Text style={opsStyles.muted} numberOfLines={1}>
                          {variantLabel(s.combination) || s.sku}
                        </Text>
                      </View>
                      <Text style={opsStyles.muted}>{added ? tr('common.added') : tr('inventory.availableUomInStock', { available: qty(s.available), uom: s.uom })}</Text>
                      {!added ? <PlusIcon size={16} color={colors.secondary} /> : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : null}
          {lines.length ? (
            lines.map((l, i) => (
              <View key={l.sku.id} style={styles.line}>
                <View style={styles.lineHead}>
                  <View style={styles.flex}>
                    <Text style={opsStyles.title} numberOfLines={1}>
                      {l.sku.productName}
                    </Text>
                    <Text style={opsStyles.muted} numberOfLines={1}>{tr('inventory.countAvailableUomNow', { count: variantLabel(l.sku.combination) || l.sku.sku, available: qty(l.sku.available), uom: l.sku.uom })}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={tr('common.removeProductname', { productName: l.sku.productName })} hitSlop={8} onPress={() => setLines(ls => ls.filter((_, j) => j !== i))}>
                    <TrashIcon size={17} color={colors.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.small}>{tr('inventory.quantityUom', { uom: l.sku.uom })}</Text>
                    <Input value={l.quantity} onChangeText={v => setLine(i, { quantity: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" placeholder="0" accessibilityLabel={tr('inventory.quantityForProductname', { productName: l.sku.productName })} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.small}>{tr('inventory.unitCostRs')}</Text>
                    <Input value={l.unitCost} onChangeText={v => setLine(i, { unitCost: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" placeholder="0.00" accessibilityLabel={tr('inventory.unitCostForProductname', { productName: l.sku.productName })} />
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={opsStyles.muted}>{tr('inventory.noProductsYetSearchAboveTo')}</Text>
          )}
        </SectionCard>

        <SectionCard icon={TruckIcon} title={tr('inventory.amountAndNotes')}>
          <Field label={tr('inventory.orderAmountRs')} hint={tr('inventory.leaveEmptyToUseQuantityUnit')}>
            <Input
              value={form.orderAmount}
              onChangeText={v => set('orderAmount', v.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={computed > 0 ? tr('inventory.fixedQtyCost', { fixed: computed.toFixed(2) }) : '0.00'}
              accessibilityLabel={tr('inventory.orderAmount')}
            />
          </Field>
          <Field label={tr('common.notes')}>
            <Input value={form.notes} onChangeText={v => set('notes', v)} maxLength={2000} multiline style={styles.notes} accessibilityLabel={tr('common.notes')} />
          </Field>
        </SectionCard>

        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter
        summary={lines.length ? `${tr('common.productCount', { count: lines.length })}${computed > 0 ? ` · ₹${computed.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : ''}` : tr('inventory.addAtLeastOneProduct')}
        title={tr('inventory.createStockOrder')}
        loading={saving}
        onSave={save}
        onCancel={navigation.goBack}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { gap: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', gap: 10 },
  pad: { padding: 12 },
  disabled: { opacity: 0.45 },
  results: { overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  line: { gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  lineHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  small: { marginBottom: 4, fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  notes: { minHeight: 70, textAlignVertical: 'top' },
});
