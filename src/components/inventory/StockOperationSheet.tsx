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
        throw new Error('No stock record');
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
      toast(`${OPERATION_TITLES[operation!]} saved`);
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
        <Input value={values.quantity} onChangeText={v => set('quantity', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Quantity" />
      </Field>
      {unitChoices.length > 1 ? (
        <Field label="Unit">
          <Choices options={unitChoices} value={values.uom} onChange={v => set('uom', v)} />
        </Field>
      ) : null}
    </>
  );
  const reasonField = (placeholder: string, required = true) => (
    <Field label="Reason" required={required}>
      <Input value={values.reason} onChangeText={v => set('reason', v)} placeholder={placeholder} maxLength={255} accessibilityLabel="Reason" />
    </Field>
  );
  const lotSelect = activeLots.length ? (
    <SelectField
      label="Lot (optional)"
      hint="Leave empty to use lots by the product's FIFO / FEFO rule"
      value={values.lotId}
      allowClear="Automatic"
      placeholder="Automatic"
      options={activeLots.map(l => ({
        value: l.id,
        label: `${l.lotNumber ?? l.batchNumber ?? l.idd} · ${balance ? formatQty(l.remainingQty, balance) : l.remainingQty} left${l.expiryDate ? ` · exp ${l.expiryDate}` : ''}`,
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
          ? `${balance.productName} · ${balance.sku} · ${balance.warehouseTitle}\nOn hand ${formatQty(balance.onHand, balance)} · Reserved ${formatQty(balance.reserved, balance)} · Blocked ${formatQty(
              balance.blocked,
              balance,
            )} · Available ${formatQty(balance.available, balance)}`
          : undefined
      }
      onClose={onClose}
      footer={<Button title="Save" onPress={submit} loading={saving} disabled={noOtherWarehouse} />}
    >
      {operation === 'receive' ? (
        <>
          {!balance ? (
            <>
              <SelectField
                label="Product"
                required
                placeholder="Select product"
                value={productId}
                options={(products.data ?? []).map(p => ({ value: String(p.id), label: String(p.productName ?? 'Product') }))}
                onChange={v => {
                  setProductId(v);
                  setVariantId('');
                }}
              />
              <SelectField
                label="SKU"
                required
                placeholder={productId ? 'Select SKU' : 'Pick a product first'}
                value={variantId}
                options={variants.map(v => ({ value: v.id, label: `${v.label} · ${v.sku}` }))}
                onChange={setVariantId}
                disabled={!productId}
              />
              <SelectField
                label="Warehouse"
                required
                placeholder="Select warehouse"
                value={warehouseId}
                options={allWarehouses.map(w => ({ value: String(w.id), label: String(w.facilityTitle ?? 'Warehouse') }))}
                onChange={setWarehouseId}
              />
            </>
          ) : null}
          <Field label="Type">
            <Choices
              options={[
                { value: 'PURCHASE_RECEIPT', label: 'Purchase receipt' },
                { value: 'OPENING_STOCK', label: 'Opening stock' },
              ]}
              value={values.type}
              onChange={v => set('type', v)}
            />
          </Field>
          {quantityRow('Quantity received', units ? `Stored in ${units.baseUom}` : undefined)}
          <Field label="Cost per unit (optional)">
            <Input value={values.unitCost} onChangeText={v => set('unitCost', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
          </Field>
          <Field label="Receipt / PO reference" hint="The same reference is never received twice">
            <Input value={values.referenceId} onChangeText={v => set('referenceId', v)} maxLength={100} />
          </Field>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>
              {'Lot / batch '}
              {balance?.tracksLots ? <Text style={styles.required}>(tracked for this product)</Text> : '(optional)'}
            </Text>
            <Field label="Lot number" required={!!balance?.trackLot}>
              <Input value={values.lotNumber} onChangeText={v => set('lotNumber', v)} maxLength={100} />
            </Field>
            <Field label="Batch number" required={!!balance?.trackBatch}>
              <Input value={values.batchNumber} onChangeText={v => set('batchNumber', v)} maxLength={100} />
            </Field>
            <DateField label="Manufactured" value={values.manufactureDate} onChange={v => set('manufactureDate', v)} maximumDate={new Date()} />
            <DateField label="Expiry" required={!!balance?.trackExpiry} value={values.expiryDate} onChange={v => set('expiryDate', v)} />
          </View>
        </>
      ) : null}

      {operation === 'adjust' ? (
        <>
          <Field label="Mode">
            <Choices
              options={[
                { value: 'COUNT', label: 'Physical count' },
                { value: 'IN', label: 'Add' },
                { value: 'OUT', label: 'Remove' },
              ]}
              value={values.mode}
              onChange={v => set('mode', v)}
            />
          </Field>
          {quantityRow(
            values.mode === 'COUNT' ? 'Counted on hand' : values.mode === 'IN' ? 'Quantity to add' : 'Quantity to remove',
            values.mode === 'COUNT' ? 'On hand is brought to this number with an adjustment entry — never overwritten' : undefined,
          )}
          {values.mode === 'OUT' ? lotSelect : null}
          {reasonField('e.g. Physical stock count')}
        </>
      ) : null}

      {operation === 'block' ? (
        <>
          <Field label="Action">
            <Choices
              options={[
                { value: 'BLOCK', label: 'Block — not sellable' },
                { value: 'UNBLOCK', label: 'Unblock — sellable again' },
                { value: 'WRITE_OFF', label: 'Write off — removed for good' },
              ]}
              value={values.action}
              onChange={v => set('action', v)}
            />
          </Field>
          {quantityRow('Quantity')}
          {values.action === 'WRITE_OFF' ? lotSelect : null}
          {reasonField('e.g. Damaged in storage')}
        </>
      ) : null}

      {operation === 'transfer' ? (
        <>
          {noOtherWarehouse ? (
            <Text style={styles.warn}>
              {`There's no other active warehouse to move this stock to — ${balance?.warehouseTitle ?? 'this warehouse'} is the only one. Add a warehouse on the Seller Panel to transfer stock between locations.`}
            </Text>
          ) : (
            <SelectField
              label="To warehouse"
              required
              placeholder={warehouses.loading ? 'Loading warehouses…' : 'Select…'}
              value={values.toWarehouseId}
              options={otherWarehouses.map(w => ({ value: String(w.id), label: String(w.facilityTitle ?? 'Warehouse') }))}
              onChange={v => set('toWarehouseId', v)}
            />
          )}
          {quantityRow('Quantity', 'Lots move with their numbers and expiry dates')}
          <Field label="Transfer reference" hint="Optional — the same transfer is never processed twice">
            <Input value={values.referenceId} onChangeText={v => set('referenceId', v)} maxLength={100} />
          </Field>
          {reasonField('e.g. Restock branch', false)}
        </>
      ) : null}

      {operation === 'return' ? (
        <>
          <Field label="Type">
            <Choices
              options={[
                { value: 'CUSTOMER_RETURN', label: 'Customer return — back into stock' },
                { value: 'PURCHASE_RETURN', label: 'Purchase return — to the supplier' },
              ]}
              value={values.type}
              onChange={v => set('type', v)}
            />
          </Field>
          {quantityRow('Quantity')}
          {values.type === 'CUSTOMER_RETURN' ? (
            <Field label="Condition" hint="Damaged returns go to blocked stock, not back on sale">
              <Choices
                options={[
                  { value: 'yes', label: 'Sellable' },
                  { value: 'no', label: 'Damaged' },
                ]}
                value={values.sellable}
                onChange={v => set('sellable', v)}
              />
            </Field>
          ) : (
            lotSelect
          )}
          <Field label="Return reference" hint="The same return is never processed twice">
            <Input value={values.referenceId} onChangeText={v => set('referenceId', v)} maxLength={100} />
          </Field>
          {reasonField('e.g. Customer return RT-1001')}
        </>
      ) : null}

      {operation === 'levels' && balance ? (
        <>
          <Text style={styles.note}>{`In ${balance.salesUom}. At or below the minimum the stock shows as Low stock with a reorder suggestion.`}</Text>
          <Field label="Minimum">
            <Input value={values.minimum} onChangeText={v => set('minimum', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Minimum" />
          </Field>
          <Field label="Maximum">
            <Input value={values.maximum} onChangeText={v => set('maximum', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Maximum" />
          </Field>
          <Field label="Reorder quantity">
            <Input value={values.reorder} onChangeText={v => set('reorder', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" accessibilityLabel="Reorder quantity" />
          </Field>
        </>
      ) : null}

      {operation !== 'levels' ? (
        <Field label="Notes (optional)">
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
