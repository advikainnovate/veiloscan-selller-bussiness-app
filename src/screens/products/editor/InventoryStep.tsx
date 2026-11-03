import React, { useCallback, useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { Alert as NativeAlert, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, radius } from '../../../theme';
import { useFetch } from '../../../hooks/useFetch';
import { extractErrorMessage } from '../../../lib/api';
import { formatDay } from '../../../lib/date';
import { formatQuantity } from '../../../lib/inventory';
import {
  inventoryService,
  productExpiryService,
  productsService,
  sellingConfigService,
  STOCK_TYPES,
  warehouseService,
  type InventoryBalance,
  type Row,
  type SellingConfigView,
  type StockConfig,
  type Uom,
} from '../../../services/products-service';
import { Alert } from '../../../components/ui/Alert';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Sheet } from '../../../components/ui/Sheet';
import { Choices, DateField, Field, Input, Section, SelectField } from '../../../components/form/Fields';
import { SwitchRow } from '../../../components/products/ProductEditors';
import type { StepHandle } from './VariantsStep';
import type { ProductScope } from './BasicStep';
import type { BusinessVariantRow } from './types';

interface Draft {
  quantity: string;
  uom: string;
  lotNumber: string;
  batchNumber: string;
  expiryDate: string;
  // null: not typed in — the SKU's cost price (Variants step) is used.
  unitCost: string | null;
  minimum: string;
  reorder: string;
  // Idempotency key of this entry: a retried save doesn't receive it twice.
  key: string;
}
const EMPTY: Draft = { quantity: '', uom: '', lotNumber: '', batchNumber: '', expiryDate: '', unitCost: null, minimum: '', reorder: '', key: '' };
const AUTO_COST_KEY = 'inventory.costFromSku';
const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const num = (t: string) => t.replace(/[^0-9.]/g, '');

type Settings = Pick<StockConfig, 'stockType' | 'baseUom' | 'trackLot' | 'trackBatch' | 'trackExpiry' | 'consumptionRule'>;

// A SKU's effective settings: its own, else the product's, else pieces.
function settingsFor(configs: StockConfig[], variantId: string): Settings {
  return (
    configs.find(c => c.productVariantId === variantId) ??
    configs.find(c => c.productVariantId === null) ?? { stockType: 'PIECE', baseUom: 'PCS', trackLot: false, trackBatch: false, trackExpiry: false, consumptionRule: 'FIFO' }
  );
}

const formatQty = (base: number, b: Pick<InventoryBalance, 'baseUom' | 'salesUom' | 'salesFactor'>) =>
  b.salesUom && b.salesUom !== b.baseUom && b.salesFactor ? `${formatQuantity(base / b.salesFactor)} ${b.salesUom}` : `${formatQuantity(base)} ${b.baseUom}`;

/**
 * The product's stock, as the Seller Panel's Inventory step: how it's counted,
 * opening stock received per SKU into a warehouse (any unit, with lot
 * details), low-stock levels, and the live balances. Every change is a ledger entry.
 */
export function InventoryStep({
  ref,
  productId,
  skus,
  warehouseId,
  setWarehouseId,
}: {
  ref?: Ref<StepHandle>;
  productId: string | null;
  skus: BusinessVariantRow[];
  warehouseId: string;
  setWarehouseId: (id: string) => void;
}) {
  const warehouses = useFetch(() => warehouseService.list(), []);
  const uoms = useFetch(() => inventoryService.uoms(), []);
  const [configs, setConfigs] = useState<StockConfig[]>([]);
  const [pricing, setPricing] = useState<SellingConfigView['variants']>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoCost, setAutoCostState] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const saved = skus.filter(s => s.id);

  useEffect(() => {
    AsyncStorage.getItem(AUTO_COST_KEY).then(v => setAutoCostState(v !== 'false'));
  }, []);
  const setAutoCost = (auto: boolean) => {
    setAutoCostState(auto);
    AsyncStorage.setItem(AUTO_COST_KEY, String(auto));
  };

  const load = useCallback(async () => {
    if (!productId) return;
    try {
      const [config, list, selling] = await Promise.all([
        inventoryService.stockConfig(productId),
        inventoryService.list({ productId }),
        sellingConfigService.get(productId).catch(() => null),
      ]);
      setConfigs(config.configs);
      setBalances(list);
      setPricing(selling?.variants ?? []);
      setLoadError(null);
      // Default warehouse: where the product already has stock.
      if (!warehouseId && list.length) setWarehouseId(list[0].warehouseId);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    }
  }, [productId, warehouseId, setWarehouseId]);

  useEffect(() => {
    load();
    // Loaded when the product changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const balanceOf = (variantId: string) => balances.find(b => b.productVariantId === variantId && b.warehouseId === warehouseId);
  const unitsOf = (stockType: string) => (uoms.data ?? []).filter(u => u.stockType === stockType && u.factorToBase !== null);

  // The SKU's cost price for one `uom` of stock, converted from the unit it's priced per.
  const skuCost = (variantId: string, uom: string): string => {
    const v = pricing.find(p => p.id === variantId);
    if (!v || v.costPrice === null || v.costPrice === undefined || !uom) return '';
    const priceUom = v.selling?.priceUom || uom;
    const priceQuantity = Number(v.selling?.priceQuantity) || 1;
    const factor = (code: string) => Number((uoms.data ?? []).find(u => u.code === code)?.factorToBase ?? NaN);
    const perUnit = uom === priceUom ? Number(v.costPrice) / priceQuantity : (Number(v.costPrice) / (priceQuantity * factor(priceUom))) * factor(uom);
    return Number.isFinite(perUnit) ? String(Math.round(perUnit * 10000) / 10000) : '';
  };

  const draft = (id: string, baseUom: string): Draft => {
    const d = drafts[id] ?? EMPTY;
    return { ...d, uom: d.uom || baseUom };
  };
  const costOf = (id: string, d: Draft) => d.unitCost ?? (autoCost ? skuCost(id, d.uom) : '');
  const setDraft = (id: string, baseUom: string, patch: Partial<Draft>) =>
    setDrafts(prev => {
      const current = { ...(prev[id] ?? EMPTY), uom: prev[id]?.uom || baseUom };
      return { ...prev, [id]: { ...current, ...patch, key: current.key || newKey() } };
    });

  useImperativeHandle(ref, () => ({
    // Receives the entered stock and saves the levels (on Next / Save).
    async save() {
      if (!productId) return;
      const entered = saved.filter(s => {
        const d = drafts[String(s.id)];
        return d && (d.quantity.trim() !== '' || d.minimum.trim() !== '' || d.reorder.trim() !== '');
      });
      if (!entered.length) return;
      if (!warehouseId) throw new Error('Choose the warehouse the stock is kept in.');
      const errors: Record<string, string> = {};
      for (const sku of entered) {
        const id = String(sku.id);
        const s = settingsFor(configs, id);
        const d = draft(id, s.baseUom);
        try {
          if (d.quantity.trim() !== '' && Number(d.quantity) > 0) {
            const existing = balanceOf(id);
            const cost = costOf(id, d);
            await inventoryService.receive({
              productVariantId: id,
              warehouseId,
              quantity: Number(d.quantity),
              uom: d.uom || s.baseUom,
              type: existing && existing.onHand > 0 ? 'PURCHASE_RECEIPT' : 'OPENING_STOCK',
              unitCost: cost ? Number(cost) : undefined,
              lotNumber: d.lotNumber.trim() || undefined,
              batchNumber: d.batchNumber.trim() || undefined,
              expiryDate: d.expiryDate || undefined,
              idempotencyKey: `app:${d.key}:${warehouseId}`,
            });
          }
          if (d.minimum.trim() !== '' || d.reorder.trim() !== '') {
            const fresh = await inventoryService.list({ productId, warehouseId });
            const row = fresh.find(b => b.productVariantId === id);
            if (row) {
              await inventoryService.setLevels(row.id, {
                ...(d.minimum.trim() !== '' ? { minimum: Number(d.minimum) } : {}),
                ...(d.reorder.trim() !== '' ? { reorder: Number(d.reorder) } : {}),
                uom: row.salesUom,
              });
            }
          }
          setDrafts(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } catch (err) {
          errors[id] = extractErrorMessage(err);
        }
      }
      setRowErrors(errors);
      await load();
      const failed = Object.keys(errors).length;
      if (failed) throw new Error(`${failed} SKU${failed === 1 ? '' : 's'} couldn't be stocked — see the highlighted SKUs.`);
    },
  }));

  if (!productId) return <Section title="Inventory" subtitle="Save the basic information first." children={null} />;

  const product = configs.find(c => c.productVariantId === null);
  const typeLabel = STOCK_TYPES.find(t => t.value === (product?.stockType ?? 'PIECE'))?.label ?? 'Pieces';
  const tracking = product ? [product.trackLot && 'lot', product.trackBatch && 'batch', product.trackExpiry && 'expiry'].filter(Boolean).join(' · ') : '';
  const warehouseList = warehouses.data ?? [];

  return (
    <View style={styles.wrap}>
      {loadError ? <Alert message={loadError} /> : null}
      <Section title="Stock settings" subtitle="How this product's stock is counted." action={<Edit onPress={() => setSettingsOpen(true)} />}>
        <View style={styles.summary}>
          <Fact label="Stock type" value={typeLabel} />
          <Fact label="Stored in" value={product?.baseUom ?? 'PCS'} />
          <Fact label="Tracks" value={tracking || 'nothing'} />
          <Fact label="Goes out" value={product?.consumptionRule === 'FEFO' ? 'earliest expiry first' : 'oldest first'} />
        </View>
      </Section>

      <Section title="Opening stock" subtitle="Received into the warehouse when you continue. Leave a SKU blank to skip it.">
        <SelectField
          label="Warehouse"
          required
          value={warehouseId}
          placeholder="Select warehouse"
          options={warehouseList.map(w => ({ value: w.id, label: String(w.facilityTitle ?? w.title ?? 'Warehouse') }))}
          emptyText="You don't have a warehouse yet — add stock later from Inventory once one is set up."
          onChange={setWarehouseId}
        />
        <Field label="Cost / unit starts at">
          <Choices
            options={[
              { value: 'auto', label: 'SKU cost price' },
              { value: 'manual', label: 'Enter manually' },
            ]}
            value={autoCost ? 'auto' : 'manual'}
            onChange={v => setAutoCost(v === 'auto')}
          />
        </Field>
      </Section>

      {!saved.length ? <Alert message="Generate the SKUs in the Variants step first." /> : null}
      {saved.map(sku => {
        const id = String(sku.id);
        const s = settingsFor(configs, id);
        const d = draft(id, s.baseUom);
        const bal = balanceOf(id);
        const tracked = s.trackLot || s.trackBatch || s.trackExpiry;
        const label = Object.values(sku.combo).map(c => c.variantDataValue).join(' / ') || 'Default';
        return (
          <View key={id} style={[styles.sku, rowErrors[id] ? styles.skuError : null]}>
            <View style={styles.skuHead}>
              <View style={styles.flex}>
                <Text style={styles.skuLabel}>{label}</Text>
                <Text style={styles.muted}>{sku.skuItemNumber}</Text>
              </View>
              <Text style={styles.onHand}>{bal ? `On hand ${formatQty(bal.onHand, bal)}${bal.reserved ? ` · reserved ${formatQty(bal.reserved, bal)}` : ''}` : 'No stock yet'}</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.small}>Add quantity</Text>
                <Input value={d.quantity} onChangeText={v => setDraft(id, s.baseUom, { quantity: num(v) })} keyboardType="decimal-pad" placeholder="0" accessibilityLabel={`${label} quantity`} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.small}>Cost / unit (₹)</Text>
                <Input value={costOf(id, d)} onChangeText={v => setDraft(id, s.baseUom, { unitCost: num(v) })} keyboardType="decimal-pad" placeholder="—" />
              </View>
            </View>
            {unitsOf(s.stockType).length > 1 ? (
              <Choices options={unitsOf(s.stockType).map((u: Uom) => ({ value: u.code, label: u.code }))} value={d.uom} onChange={uom => setDraft(id, s.baseUom, { uom })} />
            ) : null}
            {tracked ? (
              <View style={styles.row}>
                {s.trackLot ? (
                  <View style={styles.flex}>
                    <Text style={styles.small}>Lot no.</Text>
                    <Input value={d.lotNumber} onChangeText={v => setDraft(id, s.baseUom, { lotNumber: v })} autoCapitalize="characters" />
                  </View>
                ) : null}
                {s.trackBatch ? (
                  <View style={styles.flex}>
                    <Text style={styles.small}>Batch no.</Text>
                    <Input value={d.batchNumber} onChangeText={v => setDraft(id, s.baseUom, { batchNumber: v })} autoCapitalize="characters" />
                  </View>
                ) : null}
              </View>
            ) : null}
            {s.trackExpiry ? <DateField label="Expiry date" value={d.expiryDate} onChange={v => setDraft(id, s.baseUom, { expiryDate: v })} minimumDate={new Date()} /> : null}
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.small}>Low-stock level</Text>
                <Input value={d.minimum} onChangeText={v => setDraft(id, s.baseUom, { minimum: num(v) })} keyboardType="decimal-pad" placeholder={bal?.minimum ? String(bal.minimum) : '—'} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.small}>Reorder quantity</Text>
                <Input value={d.reorder} onChangeText={v => setDraft(id, s.baseUom, { reorder: num(v) })} keyboardType="decimal-pad" placeholder="—" />
              </View>
            </View>
            {rowErrors[id] ? <Text style={styles.error}>{rowErrors[id]}</Text> : null}
          </View>
        );
      })}

      {settingsOpen ? (
        <StockSettingsSheet
          productId={productId}
          skus={saved.map(s => ({ id: String(s.id), label: Object.values(s.combo).map(c => c.variantDataValue).join(' / ') || s.skuItemNumber }))}
          uoms={uoms.data ?? []}
          onClose={() => setSettingsOpen(false)}
          onSaved={view => {
            setConfigs(view.configs);
            setSettingsOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

type SettingsDraft = Omit<StockConfig, 'id'>;
const PIECES: SettingsDraft = {
  productVariantId: null,
  stockType: 'PIECE',
  baseUom: 'PCS',
  packConversions: {},
  trackLot: false,
  trackBatch: false,
  trackExpiry: false,
  consumptionRule: 'FIFO',
  allowNegativeStock: false,
};

/** How the product's (or one SKU's) stock is counted, as the Seller Panel's stock settings. */
export function StockSettingsSheet({
  productId,
  skus,
  uoms,
  initialScope = '',
  onClose,
  onSaved,
}: {
  productId: string;
  /** The SKUs that can have their own settings. */
  skus: { id: string; label: string }[];
  uoms: Uom[];
  /** Opens on this SKU's settings. */
  initialScope?: string;
  onClose: () => void;
  onSaved: (view: { configs: StockConfig[] }) => void;
}) {
  const [configs, setConfigs] = useState<StockConfig[] | null>(null);
  const [scope, setScope] = useState(initialScope);
  const [draft, setDraft] = useState<SettingsDraft>(PIECES);
  const [packFactor, setPackFactor] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadScope(list: StockConfig[], nextScope: string) {
    const own = list.find(c => (c.productVariantId ?? '') === nextScope);
    const source = own ?? list.find(c => c.productVariantId === null);
    // The saved row's id isn't part of the payload.
    const { id: _id, ...fields } = source ?? { ...PIECES, id: '' };
    setDraft({ ...fields, productVariantId: nextScope || null });
    setPackFactor(Object.fromEntries(Object.entries(source?.packConversions ?? {}).map(([k, v]) => [k, String(v)])));
  }

  useEffect(() => {
    inventoryService.stockConfig(productId).then(
      view => {
        setConfigs(view.configs);
        loadScope(view.configs, initialScope);
      },
      err => setError(extractErrorMessage(err)),
    );
    // Loaded once per product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const ofType = uoms.filter(u => u.stockType === draft.stockType);
  const packUnits = ofType.filter(u => u.factorToBase === null);
  const ownConfig = configs?.find(c => (c.productVariantId ?? '') === scope);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const packConversions = Object.fromEntries(Object.entries(packFactor).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]));
      onSaved(await inventoryService.saveStockConfig(productId, { ...draft, productVariantId: scope || null, packConversions }));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeOwn() {
    if (!ownConfig || !scope) return;
    try {
      const view = await inventoryService.removeStockConfig(productId, ownConfig.id);
      setConfigs(view.configs);
      loadScope(view.configs, scope);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <Sheet visible title="Stock settings" subtitle="How stock is counted. How customers buy it is set in the Selling step." onClose={onClose} footer={<Button title="Save settings" loading={saving} onPress={save} />}>
      {error ? <Alert message={error} /> : null}
      {skus.length > 1 ? (
        <SelectField
          label="For"
          value={scope}
          allowClear="The whole product"
          options={skus.map(s => ({ value: s.id, label: `Only ${s.label}` }))}
          onChange={v => {
            setScope(v);
            if (configs) loadScope(configs, v);
          }}
        />
      ) : null}
      {scope && ownConfig ? <Button title="Use the product's settings for this SKU" variant="ghost" onPress={removeOwn} /> : null}
      <Field label="Stock type">
        <Choices
          options={STOCK_TYPES.map(t => ({ value: t.value, label: t.label }))}
          value={draft.stockType}
          onChange={stockType => {
            const base = uoms.find(u => u.stockType === stockType && u.isBase)?.code ?? 'PCS';
            setDraft(d => ({ ...d, stockType, baseUom: base }));
          }}
        />
      </Field>
      <Field label="Stored in" hint="Stock is counted in this unit.">
        <Choices options={ofType.filter(u => u.factorToBase !== null).map(u => ({ value: u.code, label: u.code }))} value={draft.baseUom} onChange={baseUom => setDraft(d => ({ ...d, baseUom }))} />
      </Field>
      {packUnits.length ? (
        <Field label="Pack sizes" hint={`${draft.baseUom} in one of each pack.`}>
          {packUnits.map(u => (
            <View key={u.code} style={styles.packRow}>
              <Text style={styles.packLabel}>{u.code}</Text>
              <Input value={packFactor[u.code] ?? ''} onChangeText={v => setPackFactor(p => ({ ...p, [u.code]: num(v) }))} keyboardType="decimal-pad" placeholder="—" style={styles.flex} />
            </View>
          ))}
        </Field>
      ) : null}
      <SwitchRow label="Track lot numbers" value={draft.trackLot} onChange={trackLot => setDraft(d => ({ ...d, trackLot }))} />
      <SwitchRow label="Track batch numbers" value={draft.trackBatch} onChange={trackBatch => setDraft(d => ({ ...d, trackBatch }))} />
      <SwitchRow label="Track expiry dates" value={draft.trackExpiry} onChange={trackExpiry => setDraft(d => ({ ...d, trackExpiry }))} />
      <Field label="Stock goes out">
        <Choices
          options={[
            { value: 'FIFO', label: 'Oldest first (FIFO)' },
            { value: 'FEFO', label: 'Earliest expiry first (FEFO)' },
          ]}
          value={draft.consumptionRule}
          onChange={v => setDraft(d => ({ ...d, consumptionRule: v as 'FIFO' | 'FEFO' }))}
        />
      </Field>
      <SwitchRow label="Allow selling below zero" value={draft.allowNegativeStock} onChange={allowNegativeStock => setDraft(d => ({ ...d, allowNegativeStock }))} />
    </Sheet>
  );
}

// ── Expiry batches ──

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysUntil = (date: string) => Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayISO()}T00:00:00`).getTime()) / 86400000);

/** Where a batch stands today, from its dates. */
function expiryState(batch: Row): { label: string; tone: BadgeTone } {
  if (batch.status === 'DISPOSED') return { label: 'Disposed', tone: 'slate' };
  if (batch.status === 'INACTIVE') return { label: 'Inactive', tone: 'slate' };
  const days = daysUntil(String(batch.expiryDate));
  if (days < 0) return { label: 'Expired', tone: 'red' };
  const window = batch.reminderEnabled ? Number(batch.reminderDays ?? 30) : -1;
  if (days <= window) return { label: days === 0 ? 'Expires today' : `Expires in ${days}d`, tone: 'amber' };
  return { label: 'Active', tone: 'green' };
}

const EMPTY_BATCH = { storeId: '', skuId: '', batchNumber: '', manufacturingDate: '', expiryDate: '', reminderEnabled: true, reminderDays: '30' };

/**
 * Expiry batches (batch number, manufacturing & expiry date per store,
 * optionally per SKU). Required when the product "has an expiry date".
 */
export function ExpiryBatches({ productId, scope, skus, required }: { productId: string | null; scope: ProductScope; skus: BusinessVariantRow[]; required: boolean }) {
  const stores = useFetch(() => productsService.stores(), []);
  const batches = useFetch(() => (productId ? productExpiryService.list({ productId }) : Promise.resolve([])), [productId]);
  const [draft, setDraft] = useState(EMPTY_BATCH);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeOptions = (stores.data ?? []).filter(s => scope.storeScope === 'ALL_STORES' || scope.storeIds.includes(s.id));
  const storeId = draft.storeId || (storeOptions.length === 1 ? storeOptions[0].id : '');
  const list = batches.data ?? [];

  async function add() {
    if (!productId) return;
    if (!storeId) return setError('Choose the store for this batch.');
    if (!draft.expiryDate) return setError('Enter the expiry date.');
    if (draft.manufacturingDate && draft.manufacturingDate > draft.expiryDate) return setError('Expiry date must be on or after the manufacturing date.');
    setError(null);
    setSaving(true);
    try {
      await productExpiryService.create({
        productId,
        storeId,
        skuId: draft.skuId || null,
        batchNumber: draft.batchNumber.trim() || null,
        manufacturingDate: draft.manufacturingDate || null,
        expiryDate: draft.expiryDate,
        reminderEnabled: draft.reminderEnabled,
        reminderDays: draft.reminderEnabled && draft.reminderDays !== '' ? Number(draft.reminderDays) : null,
      });
      setDraft({ ...EMPTY_BATCH, storeId: draft.storeId });
      batches.reload();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function act(batch: Row, kind: 'dispose' | 'remove') {
    const label = `${String(batch.batchNumber || 'without number')} (expires ${formatDay(batch.expiryDate)})`;
    NativeAlert.alert(kind === 'dispose' ? `Mark batch ${label} disposed?` : `Remove batch ${label}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: kind === 'dispose' ? 'Disposed' : 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            if (kind === 'dispose') await productExpiryService.update(batch.id, { status: 'DISPOSED' });
            else await productExpiryService.remove(batch.id);
            batches.reload();
          } catch (err) {
            setError(extractErrorMessage(err));
          }
        },
      },
    ]);
  }

  if (!productId) return null;
  return (
    <Section title={`Expiry batches${required ? ' *' : ''}`} subtitle={required ? 'This product has an expiry date: add at least one batch.' : 'Optional: track batches and get reminded before they expire.'}>
      {list.map(batch => {
        const state = expiryState(batch);
        const sku = skus.find(s => s.id === batch.skuId);
        return (
          <View key={batch.id} style={styles.batch}>
            <View style={styles.flex}>
              <Text style={styles.batchTitle}>{String(batch.batchNumber || 'No batch number')}</Text>
              <Text style={styles.muted}>
                Expires {formatDay(batch.expiryDate)}
                {batch.manufacturingDate ? ` · made ${formatDay(batch.manufacturingDate)}` : ''}
                {sku ? ` · ${sku.skuItemNumber}` : ''}
              </Text>
            </View>
            <Badge label={state.label} tone={state.tone} />
            <View style={styles.batchActions}>
              {batch.status !== 'DISPOSED' ? (
                <Pressable onPress={() => act(batch, 'dispose')} hitSlop={6}>
                  <Text style={styles.link}>Dispose</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => act(batch, 'remove')} hitSlop={6}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {storeOptions.length > 1 ? (
        <SelectField label="Store" required value={draft.storeId} options={storeOptions.map(s => ({ value: s.id, label: s.name }))} onChange={v => setDraft(d => ({ ...d, storeId: v }))} />
      ) : null}
      {skus.length > 1 ? (
        <SelectField
          label="SKU"
          value={draft.skuId}
          allowClear="All SKUs"
          options={skus.filter(s => s.id).map(s => ({ value: String(s.id), label: s.skuItemNumber }))}
          onChange={v => setDraft(d => ({ ...d, skuId: v }))}
        />
      ) : null}
      <Field label="Batch number">
        <Input value={draft.batchNumber} onChangeText={v => setDraft(d => ({ ...d, batchNumber: v }))} autoCapitalize="characters" placeholder="Optional" />
      </Field>
      <DateField label="Manufacturing date" value={draft.manufacturingDate} onChange={v => setDraft(d => ({ ...d, manufacturingDate: v }))} />
      <DateField label="Expiry date" required value={draft.expiryDate} onChange={v => setDraft(d => ({ ...d, expiryDate: v }))} />
      <SwitchRow label="Remind me before it expires" value={draft.reminderEnabled} onChange={reminderEnabled => setDraft(d => ({ ...d, reminderEnabled }))} />
      {draft.reminderEnabled ? (
        <Field label="Days before">
          <Input value={draft.reminderDays} onChangeText={v => setDraft(d => ({ ...d, reminderDays: v.replace(/\D/g, '') }))} keyboardType="number-pad" />
        </Field>
      ) : null}
      {error ? <Alert message={error} /> : null}
      <Button title="Add batch" variant="ghost" loading={saving} onPress={add} />
    </Section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.small}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function Edit({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>Change</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 14 },
  muted: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  small: { marginBottom: 4, fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.secondary },
  remove: { fontFamily: fonts.bold, fontSize: 13, color: colors.error },
  error: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.error },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { flexBasis: '45%', flexGrow: 1 },
  factValue: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  sku: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface },
  skuError: { borderWidth: 1.5, borderColor: colors.error },
  skuHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skuLabel: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  onHand: { maxWidth: '50%', fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, textAlign: 'right' },
  row: { flexDirection: 'row', gap: 8 },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  packLabel: { width: 60, fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  batch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  batchTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  batchActions: { flexDirection: 'row', gap: 14, width: '100%' },
});
