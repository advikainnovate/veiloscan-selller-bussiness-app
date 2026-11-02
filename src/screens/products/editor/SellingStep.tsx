import React, { useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../../theme';
import { useToast } from '../../../context/ToastContext';
import { extractErrorMessage } from '../../../lib/api';
import {
  inventoryService,
  SELLING_TYPES,
  sellingConfigService,
  type SellingConfig,
  type SellingConfigView,
  type SellingMethod,
  type SellingPreview,
  type Uom,
} from '../../../services/products-service';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Choices, Field, Input, Section, SelectField } from '../../../components/form/Fields';
import { SwitchRow } from '../../../components/products/ProductEditors';
import { CloseIcon } from '../../../components/icons';
import type { StepHandle } from './VariantsStep';

type Draft = Omit<SellingConfig, 'id'>;

// The stock settings a scope is counted in: the SKU's own, else the product's.
function stockOf(view: SellingConfigView, scope: string) {
  return (scope && view.variants.find(v => v.id === scope)?.stock) || view.stock;
}

// Whether a saved configuration can be used for stock counted this way.
function fits(config: Draft, stockType: string, uoms: Uom[]) {
  const type = SELLING_TYPES.find(t => t.value === config.sellingType);
  const ofType = (code: string) => uoms.find(u => u.code === code)?.stockType === stockType;
  return !!type?.stock.includes(stockType) && ofType(config.sellingUom) && ofType(config.priceUom) && config.allowedUoms.every(ofType);
}

// Starting values for loose goods with nothing saved: steps of a small amount, priced per it (₹5 / 50 GM).
const LOOSE_DEFAULTS: Record<string, Partial<Draft>> = {
  WEIGHT: {
    sellingUom: 'GM',
    allowedUoms: ['KG'],
    minimumQuantity: 50,
    quantityStep: 50,
    priceUom: 'GM',
    priceQuantity: 50,
    quickSelect: [
      { quantity: 100, uom: 'GM' },
      { quantity: 250, uom: 'GM' },
      { quantity: 500, uom: 'GM' },
      { quantity: 1, uom: 'KG' },
    ],
  },
  VOLUME: {
    sellingUom: 'ML',
    allowedUoms: ['L'],
    minimumQuantity: 100,
    quantityStep: 50,
    priceUom: 'ML',
    priceQuantity: 100,
    quickSelect: [
      { quantity: 250, uom: 'ML' },
      { quantity: 500, uom: 'ML' },
      { quantity: 1, uom: 'L' },
    ],
  },
  LENGTH: {
    sellingUom: 'CM',
    allowedUoms: ['M'],
    minimumQuantity: 10,
    quantityStep: 10,
    priceUom: 'M',
    priceQuantity: 1,
    quickSelect: [
      { quantity: 50, uom: 'CM' },
      { quantity: 1, uom: 'M' },
      { quantity: 2, uom: 'M' },
    ],
  },
};

function defaultsFor(stockType: string, baseUom: string, variantId: string | null): Draft {
  const variable = SELLING_TYPES.find(t => t.method === 'VARIABLE' && t.stock.includes(stockType) && t.value !== 'VARIABLE_COUNT');
  return {
    productVariantId: variantId,
    sellingMethod: variable ? 'VARIABLE' : 'FIXED',
    sellingType: variable ? variable.value : stockType === 'PACK' ? 'PACK' : 'FIXED_UNIT',
    sellingUom: baseUom,
    allowedUoms: [],
    minimumQuantity: 1,
    maximumQuantity: null,
    quantityStep: 1,
    allowDecimal: false,
    decimalPrecision: 0,
    priceUom: baseUom,
    priceQuantity: 1,
    quickSelect: [],
  };
}

function defaults(stockType: string, baseUom: string, variantId: string | null, uoms: Uom[]): Draft {
  const generic = defaultsFor(stockType, baseUom, variantId);
  const loose = LOOSE_DEFAULTS[stockType];
  const draft = loose ? { ...generic, ...loose } : generic;
  // Only when those units exist.
  return loose && fits(draft, stockType, uoms) && draft.quickSelect.every(q => fits({ ...draft, sellingUom: q.uom }, stockType, uoms)) ? draft : generic;
}

const toNum = (v: string) => (v.trim() === '' ? null : Number(v));
const text = (v: number | null) => (v === null ? '' : String(v));
const clean = (t: string) => t.replace(/[^0-9.]/g, '');

/**
 * How customers buy the product (or one SKU), as the Seller Panel's Selling
 * step: fixed whole units or an amount they enter, the selling unit and the
 * units they may type in, min / max / step, decimals, quick-select amounts,
 * and the price basis. A preview checks and prices a quantity.
 */
export function SellingStep({ ref, productId }: { ref?: Ref<StepHandle>; productId: string | null }) {
  const toast = useToast();
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [view, setView] = useState<SellingConfigView | null>(null);
  const [scope, setScope] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [quick, setQuick] = useState({ quantity: '', uom: '' });
  const [preview, setPreview] = useState({ variantId: '', quantity: '', uom: '' });
  const [previewResult, setPreviewResult] = useState<SellingPreview | null>(null);

  function load(next: SellingConfigView, nextScope: string, units: Uom[] = uoms) {
    const stock = stockOf(next, nextScope);
    const own = next.configs.find(c => (c.productVariantId ?? '') === nextScope);
    const inherited = next.configs.find(c => c.productVariantId === null);
    // The saved row's id isn't part of the payload (the API rejects it).
    const source = [own, inherited]
      .map(c => {
        if (!c) return null;
        const { id: _id, ...fields } = c;
        return fields;
      })
      .find(c => c && fits(c, stock.stockType, units));
    setDraft(source ? { ...source, productVariantId: nextScope || null } : defaults(stock.stockType, stock.baseUom, nextScope || null, units));
    setQuick({ quantity: '', uom: '' });
    setDirty(false);
  }

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    Promise.all([sellingConfigService.get(productId), inventoryService.uoms()])
      .then(([next, units]) => {
        if (cancelled) return;
        // When no SKU is counted the product's way, the product-wide configuration can't apply: start on the first SKU.
        const start = next.variants.length && next.variants.every(v => v.stock.stockType !== next.stock.stockType) ? next.variants[0].id : '';
        setUoms(units);
        setView(next);
        setScope(start);
        load(next, start, units);
        setPreview(p => ({ ...p, variantId: start || next.variants[0]?.id || '' }));
      })
      .catch(err => !cancelled && setError(extractErrorMessage(err)));
    return () => {
      cancelled = true;
    };
    // `load` gets the units it needs; this runs when the product changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const stock = view ? stockOf(view, scope) : null;
  const stockType = stock?.stockType ?? 'PIECE';
  const units = useMemo(() => uoms.filter(u => u.stockType === stockType), [uoms, stockType]);
  const types = SELLING_TYPES.filter(t => t.stock.includes(stockType));

  function update(patch: Partial<Draft>) {
    setDraft(d => (d ? { ...d, ...patch } : d));
    setDirty(true);
  }

  function chooseMethod(method: SellingMethod) {
    const type = types.find(t => t.method === method)?.value;
    if (!type) return;
    update({ sellingMethod: method, sellingType: type, ...(method === 'FIXED' ? { allowDecimal: false, decimalPrecision: 0 } : {}) });
  }

  async function save() {
    if (!productId || !draft) return;
    setError(null);
    setSaving(true);
    try {
      const next = await sellingConfigService.save(productId, { ...draft, productVariantId: scope || null });
      setView(next);
      load(next, scope);
      toast('Selling configuration saved');
    } catch (err) {
      setError(extractErrorMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  // Saved when the wizard moves on, if changed.
  useImperativeHandle(ref, () => ({
    async save() {
      if (dirty) await save();
    },
  }));

  async function removeOwn() {
    const own = view?.configs.find(c => (c.productVariantId ?? '') === scope);
    if (!own || !productId || !scope) return;
    try {
      const next = await sellingConfigService.remove(productId, own.id);
      setView(next);
      load(next, scope);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function runPreview() {
    if (!productId || !preview.variantId || !preview.quantity) return;
    if (dirty) return setPreviewResult({ valid: false, message: 'Save the configuration first — the preview uses the saved rules.' });
    try {
      setPreviewResult(await sellingConfigService.preview(productId, { productVariantId: preview.variantId, quantity: Number(preview.quantity), uom: preview.uom || undefined }));
    } catch (err) {
      setPreviewResult({ valid: false, message: extractErrorMessage(err) });
    }
  }

  if (!productId) return <Section title="Selling" subtitle="Save the basic information first." children={null} />;
  if (error && !view) return <Alert message={error} />;
  if (!view || !draft) return <Section title="Selling" subtitle="Loading…" children={null} />;

  const variable = draft.sellingMethod === 'VARIABLE';
  const hasOwn = view.configs.some(c => (c.productVariantId ?? '') === scope);
  const unitOptions = units.map(u => ({ value: u.code, label: u.code }));
  const previewVariant = view.variants.find(v => v.id === preview.variantId);
  const previewUnits = uoms.filter(u => u.stockType === (previewVariant?.stock.stockType ?? stockType));

  return (
    <View style={styles.wrap}>
      <Section
        title="How customers buy it"
        subtitle={`Stock ${scope ? 'of this SKU ' : ''}is counted in ${stock?.baseUom} (${stockType.toLowerCase().replace('_', ' ')}) — change that in the Inventory step's stock settings.`}
      >
        {view.variants.length > 1 ? (
          <SelectField
            label="For"
            value={scope}
            allowClear="Every SKU of this product"
            options={view.variants.map(v => ({
              value: v.id,
              label: `Only ${v.label} · ${v.sku}${view.configs.some(c => c.productVariantId === v.id) ? ' (own)' : ''}`,
            }))}
            onChange={v => {
              setScope(v);
              load(view, v);
            }}
          />
        ) : null}
        {scope && hasOwn ? <Button title="Use the product's configuration for this SKU" variant="ghost" onPress={removeOwn} /> : null}

        <View style={styles.methods}>
          {(
            [
              ['FIXED', 'Fixed quantity', 'Whole units — 1, 2, 3 PCS / BOX'],
              ['VARIABLE', 'Variable quantity', 'Customer enters an amount — 500 GM, 1.5 KG'],
            ] as const
          ).map(([value, title, hint]) => {
            const possible = types.some(t => t.method === value);
            const on = draft.sellingMethod === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: !possible }}
                disabled={!possible}
                onPress={() => chooseMethod(value)}
                style={[styles.method, on && styles.methodOn, !possible && styles.disabled]}
              >
                <Text style={[styles.methodTitle, on && styles.methodTitleOn]}>{title}</Text>
                <Text style={styles.muted}>{hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Sold as">
          <Choices
            options={types.filter(t => t.method === draft.sellingMethod).map(t => ({ value: t.value, label: t.label }))}
            value={draft.sellingType}
            onChange={v => update({ sellingType: v as Draft['sellingType'] })}
          />
        </Field>
        <Field label="Selling unit">
          <Choices options={unitOptions} value={draft.sellingUom} onChange={sellingUom => update({ sellingUom, allowedUoms: draft.allowedUoms.filter(c => c !== sellingUom) })} />
        </Field>
        {variable && units.length > 1 ? (
          <Field label="Customers may also enter" hint="Other units they can type an amount in.">
            <View style={styles.chips}>
              {units
                .filter(u => u.code !== draft.sellingUom)
                .map(u => {
                  const on = draft.allowedUoms.includes(u.code);
                  return (
                    <Pressable
                      key={u.code}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      onPress={() => update({ allowedUoms: on ? draft.allowedUoms.filter(c => c !== u.code) : [...draft.allowedUoms, u.code] })}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{u.code}</Text>
                    </Pressable>
                  );
                })}
            </View>
          </Field>
        ) : null}

        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label={`Minimum (${draft.sellingUom})`}>
              <Input value={text(draft.minimumQuantity)} onChangeText={v => update({ minimumQuantity: toNum(clean(v)) })} keyboardType="decimal-pad" placeholder="—" />
            </Field>
          </View>
          <View style={styles.flex}>
            <Field label="Maximum">
              <Input value={text(draft.maximumQuantity)} onChangeText={v => update({ maximumQuantity: toNum(clean(v)) })} keyboardType="decimal-pad" placeholder="No limit" />
            </Field>
          </View>
          <View style={styles.flex}>
            <Field label="Step">
              <Input value={text(draft.quantityStep)} onChangeText={v => update({ quantityStep: toNum(clean(v)) })} keyboardType="decimal-pad" placeholder="—" />
            </Field>
          </View>
        </View>

        {variable ? (
          <>
            <SwitchRow label="Allow decimals" hint="e.g. 1.5 KG" value={draft.allowDecimal} onChange={allowDecimal => update({ allowDecimal, decimalPrecision: allowDecimal ? Math.max(1, draft.decimalPrecision) : 0 })} />
            {draft.allowDecimal ? (
              <Field label="Decimal places">
                <Choices options={['1', '2', '3'].map(v => ({ value: v, label: v }))} value={String(draft.decimalPrecision)} onChange={v => update({ decimalPrecision: Number(v) })} />
              </Field>
            ) : null}
          </>
        ) : null}

        <Field label="Prices are for" hint={`Each SKU's price is per ${draft.priceQuantity === 1 ? `1 ${draft.priceUom}` : `${draft.priceQuantity} ${draft.priceUom}`}.`}>
          <View style={styles.row}>
            <Input value={text(draft.priceQuantity)} onChangeText={v => update({ priceQuantity: Number(clean(v)) || 1 })} keyboardType="decimal-pad" style={styles.priceQty} />
            <View style={styles.flex}>
              <Choices options={unitOptions} value={draft.priceUom} onChange={priceUom => update({ priceUom })} />
            </View>
          </View>
        </Field>

        {variable ? (
          <Field label="Quick-select amounts" hint="Buttons customers tap instead of typing.">
            <View style={styles.chips}>
              {draft.quickSelect.map((q, i) => (
                <View key={`${q.quantity}${q.uom}${i}`} style={styles.quick}>
                  <Text style={styles.quickText}>
                    {q.quantity} {q.uom}
                  </Text>
                  <Pressable accessibilityLabel="Remove" hitSlop={8} onPress={() => update({ quickSelect: draft.quickSelect.filter((_, j) => j !== i) })}>
                    <CloseIcon size={11} color={colors.primary} />
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={styles.row}>
              <Input value={quick.quantity} onChangeText={v => setQuick(q => ({ ...q, quantity: clean(v) }))} keyboardType="decimal-pad" placeholder="Amount" style={styles.flex} />
              <Pressable
                disabled={!(Number(quick.quantity) > 0)}
                onPress={() => {
                  update({ quickSelect: [...draft.quickSelect, { quantity: Number(quick.quantity), uom: quick.uom || draft.sellingUom }] });
                  setQuick({ quantity: '', uom: '' });
                }}
                style={[styles.addBtn, !(Number(quick.quantity) > 0) && styles.disabled]}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
            {units.length > 1 ? <Choices options={unitOptions} value={quick.uom || draft.sellingUom} onChange={uom => setQuick(q => ({ ...q, uom }))} /> : null}
          </Field>
        ) : null}

        {error ? <Alert message={error} /> : null}
        <Button title={dirty ? 'Save configuration' : 'Saved'} loading={saving} disabled={!dirty} onPress={() => save().catch(() => {})} />
      </Section>

      <Section title="Prices per selling unit" subtitle="What each SKU costs as customers buy it.">
        {view.variants.map(v => (
          <View key={v.id} style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              {v.label} · {v.sku}
            </Text>
            <Text style={styles.priceValue}>{v.selling.priceLabel || `₹${v.price}`}</Text>
          </View>
        ))}
      </Section>

      {view.variants.length ? (
        <Section title="Check a quantity" subtitle="Checked and priced with the same rules as the shop.">
          {view.variants.length > 1 ? (
            <SelectField label="SKU" value={preview.variantId} options={view.variants.map(v => ({ value: v.id, label: `${v.label} · ${v.sku}` }))} onChange={variantId => setPreview(p => ({ ...p, variantId, uom: '' }))} />
          ) : null}
          <View style={styles.row}>
            <Input value={preview.quantity} onChangeText={v => setPreview(p => ({ ...p, quantity: clean(v) }))} keyboardType="decimal-pad" placeholder="Quantity" style={styles.flex} />
            <Pressable onPress={runPreview} style={styles.addBtn}>
              <Text style={styles.addBtnText}>Check & price</Text>
            </Pressable>
          </View>
          {previewUnits.length > 1 ? (
            <Choices
              options={previewUnits.map(u => ({ value: u.code, label: u.code }))}
              value={preview.uom || previewVariant?.selling.sellingUom || ''}
              onChange={uom => setPreview(p => ({ ...p, uom }))}
            />
          ) : null}
          {previewResult ? (
            previewResult.valid ? (
              <Alert
                variant="success"
                message={`${previewResult.quantity} = ${previewResult.baseQuantity} → ₹${previewResult.amount} (${previewResult.price})`}
              />
            ) : (
              <Alert message={previewResult.message} />
            )
          ) : null}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 14 },
  disabled: { opacity: 0.4 },
  muted: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, gap: 4, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  methodOn: { borderColor: colors.secondary, backgroundColor: '#fffaf5' },
  methodTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  methodTitleOn: { color: colors.secondaryDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  priceQty: { width: 80 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  quickText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.primary },
  addBtn: { height: 46, paddingHorizontal: 14, borderRadius: radius.md, justifyContent: 'center', backgroundColor: colors.primary },
  addBtnText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  priceLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  priceValue: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
});
