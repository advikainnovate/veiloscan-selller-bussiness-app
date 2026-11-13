import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../../theme';
import { useFetch } from '../../../hooks/useFetch';
import { formatRupees } from '../../../lib/format';
import { ITEM_CONDITION_OPTIONS, LENGTH_UNIT_OPTIONS, WEIGHT_UNIT_OPTIONS } from '../../../lib/product-wizard-helpers';
import type { ProductStage } from '../../../lib/product-approval';
import { productsService } from '../../../services/products-service';
import { Choices, Field, Input, Section } from '../../../components/form/Fields';
import { Row } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import type { BusinessVariantRow, MeasuresValues, MediaItem, ProductFormValues, SpecificationRow, TagItem } from './types';
import { useTranslation } from 'react-i18next';

const num = (t: string) => t.replace(/[^0-9.]/g, '');

// Length / Width / Height are also the field-name suffixes, so they stay English in code.
const DIM_LABEL_KEYS = { Length: 'products.length', Width: 'products.width', Height: 'products.height' } as const;

/** Product and package size, weight and condition (the Seller Panel's Measurements step). */
export function MeasurementsStep({ measures, update }: { measures: MeasuresValues; update: <K extends keyof MeasuresValues>(field: K, value: MeasuresValues[K]) => void }) {
  const { t } = useTranslation();
  const dims = (prefix: 'product' | 'package') => (
    <>
      <View style={styles.row}>
        {(['Length', 'Width', 'Height'] as const).map(d => {
          const key = `${prefix}${d}` as const;
          return (
            <View key={key} style={styles.flex}>
              <Field label={t(DIM_LABEL_KEYS[d])}>
                <Input value={String(measures[key] ?? '')} onChangeText={v => update(key, num(v))} keyboardType="decimal-pad" placeholder="—" accessibilityLabel={t(prefix === 'product' ? 'products.productDimension' : 'products.packageDimension', { dimension: t(DIM_LABEL_KEYS[d]) })} />
              </Field>
            </View>
          );
        })}
      </View>
      <Choices options={LENGTH_UNIT_OPTIONS.map(u => ({ value: u, label: u }))} value={measures[`${prefix}LengthMeasuringUnit`]} onChange={v => update(`${prefix}LengthMeasuringUnit`, v)} />
      <Field label={t('products.weight')}>
        <Input value={String(measures[`${prefix}Weight`] ?? '')} onChangeText={v => update(`${prefix}Weight`, num(v))} keyboardType="decimal-pad" placeholder="—" />
      </Field>
      <Choices options={WEIGHT_UNIT_OPTIONS.map(u => ({ value: u, label: u }))} value={measures[`${prefix}WeightMeasuringUnit`]} onChange={v => update(`${prefix}WeightMeasuringUnit`, v)} />
    </>
  );
  return (
    <View style={styles.wrap}>
      <Section title={t('products.productSize')} subtitle={t('products.theProductItself')}>
        {dims('product')}
      </Section>
      <Section title={t('products.packageSize')} subtitle={t('products.asShippedUsedForDeliveryCharges')}>
        {dims('package')}
        <Field label={t('products.itemsInAPackage')}>
          <Input value={String(measures.packageQuantity ?? '')} onChangeText={v => update('packageQuantity', v.replace(/\D/g, ''))} keyboardType="number-pad" />
        </Field>
      </Section>
      <Section title={t('common.condition')}>
        <Choices options={ITEM_CONDITION_OPTIONS} value={measures.itemCondition} onChange={v => update('itemCondition', v)} />
        <Field label={t('products.conditionNote')}>
          <Input value={measures.itemConditionNote} onChangeText={v => update('itemConditionNote', v)} placeholder={t('common.optional2')} />
        </Field>
      </Section>
    </View>
  );
}

/** Review & Submit: everything at a glance, the SKU prices, and the server's readiness check. */
export function ReviewStep({
  product,
  brandLabel,
  categoryLabel,
  media,
  tags,
  skus,
  warehouseId,
  specifications,
  measures,
  productId,
  stage,
}: {
  product: ProductFormValues;
  brandLabel?: string;
  categoryLabel?: string;
  media: MediaItem[];
  tags: TagItem[];
  skus: BusinessVariantRow[];
  warehouseId: string;
  specifications: SpecificationRow[];
  measures: MeasuresValues;
  productId: string | null;
  stage: ProductStage;
}) {
  const { t: tr } = useTranslation();
  const check = useFetch(() => (productId ? productsService.submissionCheck(productId) : Promise.resolve(null)), [productId]);
  const needsReview = stage.key === 'draft' || stage.key === 'changes_required';
  const cover = media.find(m => m.isPrimary)?.url ?? media[0]?.url;

  return (
    <View style={styles.wrap}>
      <Section title={tr('products.review')} subtitle={needsReview ? tr('products.doubleCheckEverythingBeforeSubmittingIt') : tr('products.doubleCheckEverythingBeforeSaving')}>
        <View style={styles.head}>
          {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : null}
          <View style={styles.flex}>
            <Text style={styles.name}>{product.productName || '—'}</Text>
            <Badge label={stage.label} tone={stage.tone} />
          </View>
        </View>
        <Row label="SKU" value={product.skuItemNumber || '—'} />
        <Row label={tr('common.category')} value={categoryLabel || '—'} />
        <Row label={tr('common.brand')} value={brandLabel || 'No brand'} />
        <Row label={tr('products.photos')} value={`${media.length}`} />
        <Row label={tr('products.tags')} value={tags.length ? tags.map(t => t.tagTitle).join(', ') : 'None'} />
        <Row label="SKUs" value={`${skus.length}`} />
        <Row label={tr('common.inventory')} value={warehouseId ? 'Warehouse chosen' : 'Not set'} />
        <Row label={tr('products.specifications')} value={`${specifications.length}`} />
        <Row label={tr('products.measurements')} value={measures.productLength || measures.packageLength ? 'Set' : 'Not set'} />
      </Section>

      <Section title={tr('products.skuPrices')}>
        {skus.length ? (
          skus.map(s => (
            <Row
              key={String(s.id ?? s.skuItemNumber)}
              label={`${Object.values(s.combo).map(c => c.variantDataValue).join(' / ') || 'Default'} · ${s.skuItemNumber}`}
              value={`${s.businessPrice !== '' ? formatRupees(Number(s.businessPrice)) : '—'}${s.mrp !== '' && s.mrp !== null ? ` (${tr('products.mrpAmount', { amount: formatRupees(Number(s.mrp)) })})` : ''}`}
            />
          ))
        ) : (
          <Text style={styles.muted}>{tr('products.noSkusAdded')}</Text>
        )}
      </Section>

      {productId ? (
        <Section title={tr('products.readyForReview')} subtitle={tr('products.theSameChecksTheServerRuns')}>
          {check.loading ? (
            <Text style={styles.muted}>{tr('common.checking')}</Text>
          ) : check.error ? (
            <Text style={styles.error}>{check.error}</Text>
          ) : check.data?.ready ? (
            <Text style={styles.ok}>{tr('products.allChecksPassed')}</Text>
          ) : (
            (check.data?.issues ?? []).map(issue => (
              <Text key={issue} style={styles.issue}>
                • {issue}
              </Text>
            ))
          )}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 14 },
  row: { flexDirection: 'row', gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 60, height: 60, borderRadius: radius.md },
  name: { marginBottom: 6, fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
  ok: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.successDark },
  issue: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.warningDark },
});
