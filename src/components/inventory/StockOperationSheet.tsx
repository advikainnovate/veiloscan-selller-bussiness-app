import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { newKey } from '../../lib/operations';
import { formatQty, OPERATION_TITLES, operationProblem, type StockOperation } from '../../lib/stock';
import { inventoryService, productsService, warehouseService, type StockType } from '../../services/products-service';
import { productBuilderService } from '../../services/product-builder-service';
import { stockService, type Lot, type StockBalance } from '../../services/stock-service';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Choices, DateField, Field, Input, SelectField } from '../form/Fields';
import { useTranslation } from 'react-i18next';

const round = (v: number) => Math.round(v * 1000) / 1000;
const optional = (v: string) => (v.trim() ? v.trim() : undefined);

/**
 * One stock operation, as the Seller Panel's operation modal. Every change is
 * a ledger entry made by the server; nothing overwrites the balance. Receive
 * can start without a stock record (pick product → SKU → warehouse).
 */
export function StockOperationSheet({
  operation,
  balance,
  lots = [],
  onClose,
  onDone,
}: {
  operation: StockOperation | null;
  balance: StockBalance | null;
  lots?: Lot[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const visible = operation !== null;
  const uoms = useFetch(() => (visible ? inventoryService.uoms() : Promise.resolve([])), [visible]);
  const warehouses = useFetch(() => (visible ? warehouseService.list() : Promise.resolve([])), [visible]);
  const needsProducts = operation === 'receive' && !balance;
  const products = useFetch(() => (needsProducts ? productsService.list() : Promise.resolve([])), [needsProducts]);

  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [variants, setVariants] = useState<{ id: string; sku: string; label: string }[]>([]);
  const [units, setUnits] = useState<{ stockType: StockType; baseUom: string; salesUom: string; salesFactor: number } | null>(null);
  const blank = () => ({
    quantity: '',
    uom: balance?.salesUom ?? '',
    mode: 'COUNT',
    action: 'BLOCK',
    type: operation === 'return' ? 'CUSTOMER_RETURN' : 'PURCHASE_RECEIPT',
    sellable: 'yes',
    reason: '',
    referenceId: '',
    notes: '',
    unitCost: '',
    lotNumber: '',
    batchNumber: '',
    expiryDate: '',
    manufactureDate: '',
    lotId: '',
    toWarehouseId: '',
    minimum: balance ? String(round(balance.minimum / (balance.salesFactor || 1))) : '',
    maximum: balance && balance.maximum !== null ? String(round(balance.maximum / (balance.salesFactor || 1))) : '',
    reorder: balance ? String(round(balance.reorder / (balance.salesFactor || 1))) : '',
  });
  const [values, setValues] = useState(blank);
  const [key, setKey] = useState(newKey);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setValues(x => ({ ...x, [k]: v }));

  // A fresh form each time it opens.
  useEffect(() => {
    if (!operation) return;
    setValues(blank());
    setKey(newKey());
    setError('');
    setProductId(balance?.productId ?? '');
    setVariantId(balance?.productVariantId ?? '');
    setWarehouseId(balance?.warehouseId ?? '');
    setUnits(balance ? { stockType: balance.stockType, baseUom: balance.baseUom, salesUom: balance.salesUom, salesFactor: balance.salesFactor } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation, balance]);

  // Receive without a record: the chosen product's SKUs and how its stock is counted.
  useEffect(() => {
    if (balance || !productId || operation !== 'receive') return;
    let cancelled = false;
    Promise.all([productBuilderService.variants(productId), inventoryService.stockConfig(productId)])
      .then(([list, config]) => {
        if (cancelled) return;
        setVariants(list.map(v => ({ id: v.id, sku: v.sku, label: v.label })));
        if (list.length === 1) setVariantId(list[0].id);
        const c = config.configs.find(x => x.productVariantId === (variantId || list[0]?.id)) ?? config.configs.find(x => x.productVariantId === null);
        // Received in the base unit by default (any unit of the stock type can be picked).
        const next = c ? { stockType: c.stockType, baseUom: c.baseUom, salesUom: c.baseUom, salesFactor: 1 } : { stockType: 'PIECE', baseUom: 'PCS', salesUom: 'PCS', salesFactor: 1 };
        setUnits(next);
        setValues(v => ({ ...v, uom: next.salesUom }));
      })
      .catch(err => !cancelled && setError(extractErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [balance, productId, variantId, operation]);

  const unitOptions = useMemo(() => (uoms.data ?? []).filter(u => units && u.stockType === units.stockType), [uoms.data, units]);
  const activeLots = lots.filter(l => l.status === 'ACTIVE' && l.remainingQty > 0);
  const allWarehouses = warehouses.data ?? [];
  // Stock only moves between the same seller's active warehouses.
  const ownerId = allWarehouses.find(w => w.id === balance?.warehouseId)?.clientId ?? null;
  const otherWarehouses = allWarehouses.filter(
    w => w.id !== balance?.warehouseId && Number(w.status ?? 1) === 1 && w.isDeleted !== true && (!ownerId || !w.clientId || w.clientId === ownerId),
  );
  const noOtherWarehouse = operation === 'transfer' && !warehouses.loading && otherWarehouses.length === 0;

  if (!operation) return null;

  async function submit() {
    const problem = operationProblem(operation!, { ...values, variantId, warehouseId });
    if (problem) return setError(problem);
    setError('');
    setSaving(true);
    const meta = { referenceId: optional(values.referenceId), notes: optional(values.notes), idempotencyKey: key };
    const quantity = Number(values.quantity);
    const uom = values.uom || undefined;
    try {
      if (operation === 'receive') {
        await stockService.receive({
          ...meta,
          productVariantId: variantId,
          warehouseId,
          quantity,
          uom,
          type: values.type as 'PURCHASE_RECEIPT' | 'OPENING_STOCK',
          unitCost: values.unitCost ? Number(values.unitCost) : undefined,
          lotNumber: optional(values.lotNumber),
          batchNumber: optional(values.batchNumber),
          expiryDate: optional(values.expiryDate),
          manufactureDate: optional(values.manufactureDate),
        });
      } else if (!balance) {
        throw new Error(t('inventory.noStockRecord'));
      } else if (operation === 'adjust') {
        await stockService.adjust(balance.id, { ...meta, mode: values.mode as 'COUNT' | 'IN' | 'OUT', quantity, uom, reason: values.reason.trim(), lotId: optional(values.lotId) });
      } else if (operation === 'block') {
        await stockService.block(balance.id, { ...meta, action: values.action as 'BLOCK' | 'UNBLOCK' | 'WRITE_OFF', quantity, uom, reason: values.reason.trim(), lotId: optional(values.lotId) });
      } else if (operation === 'transfer') {
        await stockService.transfer({ ...meta, inventoryId: balance.id, toWarehouseId: values.toWarehouseId, quantity, uom, reason: optional(values.reason) });
      } else if (operation === 'return') {
        await stockService.returnStock(balance.id, {
          ...meta,
          type: values.type as 'CUSTOMER_RETURN' | 'PURCHASE_RETURN',
          quantity,
          uom,
          sellable: values.sellable === 'yes',
          reason: values.reason.trim(),
          lotId: optional(values.lotId),
        });
      } else {
        const num = (v: string) => (v.trim() === '' ? null : Number(v));
        await stockService.setLevels(balance.id, { minimum: num(values.minimum) ?? 0, maximum: num(values.maximum), reorder: num(values.reorder) ?? 0, uom: balance.salesUom });
      }
      toast(t('inventory.operationTitlesSaved', { OPERATION_TITLES: OPERATION_TITLES[operation!] }));
      onDone();
    } catch (err) {
      setError(err instanceof Error && !('response' in err) ? err.message : extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const unitChoices = unitOptions.map(u => ({ value: u.code, label: u.code }));
  const quantityRow = (label: string, hint?: string) => (
    <>
      <Field label={label} required hint={hint}>
        <Input value={values.quantity} onChangeText={v => set('quantity', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={t('common.quantity')} />
      </Field>
      {unitChoices.length > 1 ? (
        <Field label={t('inventory.unit')}>
          <Choices options={unitChoices} value={values.uom} onChange={v => set('uom', v)} />
        </Field>
      ) : null}
    </>
  );
  const reasonField = (placeholder: string, required = true) => (
    <Field label={t('common.reason')} required={required}>
      <Input value={values.reason} onChangeText={v => set('reason', v)} placeholder={placeholder} maxLength={255} accessibilityLabel={t('common.reason')} />
    </Field>
  );
  const lotSelect = activeLots.length ? (
    <SelectField
      label={t('inventory.lotOptional')}
      hint={t('inventory.leaveEmptyToUseLotsBy')}
      value={values.lotId}
      allowClear={t('inventory.automatic')}
      placeholder={t('inventory.automatic')}
      options={activeLots.map(l => ({
        value: l.id,
        label: [t('inventory.lotQuantityLeft', { lot: l.lotNumber ?? l.batchNumber ?? l.idd, quantity: balance ? formatQty(l.remainingQty, balance) : l.remainingQty }), l.expiryDate ? t('inventory.expiresShort', { date: l.expiryDate }) : null].filter(Boolean).join(' · '),
      }))}
      onChange={v => set('lotId', v)}
    />
  ) : null;

  return (
    <Sheet
      visible
      title={OPERATION_TITLES[operation]}
      subtitle={
        balance
          ? t('inventory.productnameSkuWarehousetitleOnHandOnhand', { productName: balance.productName, sku: balance.sku, warehouseTitle: balance.warehouseTitle, onHand: formatQty(balance.onHand, balance), reserved: formatQty(balance.reserved, balance), blocked: formatQty(
              balance.blocked,
              balance,
            ), available: formatQty(balance.available, balance) })
          : undefined
      }
      onClose={onClose}
      footer={<Button title={t('common.save')} onPress={submit} loading={saving} disabled={noOtherWarehouse} />}
    >
      {operation === 'receive' ? (
        <>
          {!balance ? (
            <>
              <SelectField
                label={t('common.product')}
                required
                placeholder={t('common.selectProduct')}
                value={productId}
                options={(products.data ?? []).map(p => ({ value: String(p.id), label: String(p.productName ?? t('common.product')) }))}
                onChange={v => {
                  setProductId(v);
                  setVariantId('');
                }}
              />
              <SelectField
                label="SKU"
                required
                placeholder={productId ? t('inventory.selectSku') : t('inventory.pickAProductFirst')}
                value={variantId}
                options={variants.map(v => ({ value: v.id, label: `${v.label} · ${v.sku}` }))}
                onChange={setVariantId}
                disabled={!productId}
              />
              <SelectField
                label={t('common.warehouse')}
                required
                placeholder={t('common.selectWarehouse')}
                value={warehouseId}
                options={allWarehouses.map(w => ({ value: String(w.id), label: String(w.facilityTitle ?? t('common.warehouse')) }))}
                onChange={setWarehouseId}
              />
            </>
          ) : null}
          <Field label={t('common.type')}>
            <Choices
              options={[
                { value: 'PURCHASE_RECEIPT', label: t('inventory.purchaseReceipt') },
                { value: 'OPENING_STOCK', label: t('common.openingStock') },
              ]}
              value={values.type}
              onChange={v => set('type', v)}
            />
          </Field>
          {quantityRow(t('inventory.quantityReceived'), units ? t('inventory.storedInBaseuom', { baseUom: units.baseUom }) : undefined)}
          <Field label={t('inventory.costPerUnitOptional')}>
            <Input value={values.unitCost} onChangeText={v => set('unitCost', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
          </Field>
          <Field label={t('inventory.receiptPoReference')} hint={t('inventory.theSameReferenceIsNeverReceived')}>
            <Input value={values.referenceId} onChangeText={v => set('referenceId', v)} maxLength={100} />
          </Field>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>
              {t('inventory.lotBatch')}
              {balance?.tracksLots ? <Text style={styles.required}>{t('inventory.trackedForThisProduct')}</Text> : t('common.optional')}
            </Text>
            <Field label={t('inventory.lotNumber')} required={!!balance?.trackLot}>
              <Input value={values.lotNumber} onChangeText={v => set('lotNumber', v)} maxLength={100} />
            </Field>
            <Field label={t('common.batchNumber')} required={!!balance?.trackBatch}>
              <Input value={values.batchNumber} onChangeText={v => set('batchNumber', v)} maxLength={100} />
            </Field>
            <DateField label={t('inventory.manufactured')} value={values.manufactureDate} onChange={v => set('manufactureDate', v)} maximumDate={new Date()} />
            <DateField label={t('inventory.expiry')} required={!!balance?.trackExpiry} value={values.expiryDate} onChange={v => set('expiryDate', v)} />
          </View>
        </>
      ) : null}

      {operation === 'adjust' ? (
        <>
          <Field label={t('inventory.mode')}>
            <Choices
              options={[
                { value: 'COUNT', label: t('inventory.physicalCount') },
                { value: 'IN', label: t('common.add') },
                { value: 'OUT', label: t('common.remove') },
              ]}
              value={values.mode}
              onChange={v => set('mode', v)}
            />
          </Field>
          {quantityRow(
            values.mode === 'COUNT' ? t('inventory.countedOnHand') : values.mode === 'IN' ? t('inventory.quantityToAdd') : t('inventory.quantityToRemove'),
            values.mode === 'COUNT' ? t('inventory.onHandIsBroughtToThis') : undefined,
          )}
          {values.mode === 'OUT' ? lotSelect : null}
          {reasonField('e.g. Physical stock count')}
        </>
      ) : null}

      {operation === 'block' ? (
        <>
          <Field label={t('inventory.action')}>
            <Choices
              options={[
                { value: 'BLOCK', label: t('inventory.blockNotSellable') },
                { value: 'UNBLOCK', label: t('inventory.unblockSellableAgain') },
                { value: 'WRITE_OFF', label: t('inventory.writeOffRemovedForGood') },
              ]}
              value={values.action}
              onChange={v => set('action', v)}
            />
          </Field>
          {quantityRow(t('common.quantity'))}
          {values.action === 'WRITE_OFF' ? lotSelect : null}
          {reasonField('e.g. Damaged in storage')}
        </>
      ) : null}

      {operation === 'transfer' ? (
        <>
          {noOtherWarehouse ? (
            <Text style={styles.warn}>
              {t('inventory.noOtherWarehouseToTransfer', { warehouse: balance?.warehouseTitle ?? t('inventory.thisWarehouse') })}
            </Text>
          ) : (
            <SelectField
              label={t('inventory.toWarehouse')}
              required
              placeholder={warehouses.loading ? t('inventory.loadingWarehouses') : t('common.select')}
              value={values.toWarehouseId}
              options={otherWarehouses.map(w => ({ value: String(w.id), label: String(w.facilityTitle ?? t('common.warehouse')) }))}
              onChange={v => set('toWarehouseId', v)}
            />
          )}
          {quantityRow(t('common.quantity'), t('inventory.lotsMoveWithTheirNumbersAnd'))}
          <Field label={t('inventory.transferReference')} hint={t('inventory.optionalTheSameTransferIsNever')}>
            <Input value={values.referenceId} onChangeText={v => set('referenceId', v)} maxLength={100} />
          </Field>
          {reasonField('e.g. Restock branch', false)}
        </>
      ) : null}

      {operation === 'return' ? (
        <>
          <Field label={t('common.type')}>
            <Choices
              options={[
                { value: 'CUSTOMER_RETURN', label: t('inventory.customerReturnBackIntoStock') },
                { value: 'PURCHASE_RETURN', label: t('inventory.purchaseReturnToTheSupplier') },
              ]}
              value={values.type}
              onChange={v => set('type', v)}
            />
          </Field>
          {quantityRow(t('common.quantity'))}
          {values.type === 'CUSTOMER_RETURN' ? (
            <Field label={t('common.condition')} hint={t('inventory.damagedReturnsGoToBlockedStock')}>
              <Choices
                options={[
                  { value: 'yes', label: t('inventory.sellable') },
                  { value: 'no', label: t('inventory.damaged') },
                ]}
                value={values.sellable}
                onChange={v => set('sellable', v)}
              />
            </Field>
          ) : (
            lotSelect
          )}
          <Field label={t('inventory.returnReference')} hint={t('inventory.theSameReturnIsNeverProcessed')}>
            <Input value={values.referenceId} onChangeText={v => set('referenceId', v)} maxLength={100} />
          </Field>
          {reasonField('e.g. Customer return RT-1001')}
        </>
      ) : null}

      {operation === 'levels' && balance ? (
        <>
          <Text style={styles.note}>{t('inventory.inSalesuomAtOrBelowThe', { salesUom: balance.salesUom })}</Text>
          <Field label={t('inventory.minimum')}>
            <Input value={values.minimum} onChangeText={v => set('minimum', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={t('inventory.minimum')} />
          </Field>
          <Field label={t('common.maximum')}>
            <Input value={values.maximum} onChangeText={v => set('maximum', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={t('common.maximum')} />
          </Field>
          <Field label={t('common.reorderQuantity')}>
            <Input value={values.reorder} onChangeText={v => set('reorder', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel={t('common.reorderQuantity')} />
          </Field>
        </>
      ) : null}

      {operation !== 'levels' ? (
        <Field label={t('inventory.notesOptional')}>
          <Input value={values.notes} onChangeText={v => set('notes', v)} maxLength={2000} />
        </Field>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  groupTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  required: { color: colors.error },
  warn: { padding: 12, borderRadius: radius.md, backgroundColor: colors.warningLight, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warningDark },
  note: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  error: { padding: 10, borderRadius: 8, backgroundColor: colors.errorLight, fontFamily: fonts.medium, fontSize: 13, color: colors.errorDark },
});
