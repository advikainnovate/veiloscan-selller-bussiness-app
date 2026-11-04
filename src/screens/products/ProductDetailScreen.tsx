import React, { useMemo, useState, type ComponentType } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { useProductActions } from '../../hooks/useProductActions';
import { extractErrorMessage } from '../../lib/api';
import { formatWhen } from '../../lib/date';
import { formatNumber, formatRupees, htmlToText } from '../../lib/format';
import { canPublish, canSubmitForApproval, productStage, type ProductStageKey } from '../../lib/product-approval';
import { productBuilderService } from '../../services/product-builder-service';
import {
  brandService,
  categoryService,
  productDocumentService,
  productImageService,
  productMeasuresService,
  productSeoService,
  productsService,
  productTagService,
  type Row,
} from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, Row as InfoRow } from '../../components/ui/Card';
import { ErrorState, FilterChips, ListSkeleton } from '../../components/list/ListParts';
import { ProductDocuments, ProductPhotos, VariantPhotoStrip } from '../../components/products/ProductMedia';
import { MeasuresSheet, SeoSheet, TagEditor } from '../../components/products/ProductEditors';
import { ShareProductSheet } from '../../components/products/ShareProduct';
import { BanIcon, BoxIcon, CheckCircleIcon, CheckIcon, CopyIcon, EditIcon, FileTextIcon, ShareIcon, TrashIcon, type IconProps } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'variants', label: 'Variants' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'specifications', label: 'Specifications' },
  { value: 'measurements', label: 'Measurements' },
  { value: 'seo', label: 'SEO' },
  { value: 'media', label: 'Media' },
  { value: 'activity', label: 'Activity' },
] as const;
type Tab = (typeof TABS)[number]['value'];

const BANNER_TONE: Record<ProductStageKey, { bg: string; border: string; fg: string }> = {
  draft: { bg: '#f0f9ff', border: '#bae6fd', fg: '#0369a1' },
  in_review: { bg: '#fffbeb', border: '#fde68a', fg: '#b45309' },
  changes_required: { bg: '#fff7ed', border: '#fdba74', fg: '#c2410c' },
  published: { bg: '#ecfdf5', border: '#a7f3d0', fg: '#047857' },
  unpublished: { bg: '#f8fafc', border: '#e2e8f0', fg: '#475569' },
};
const FLOW = ['Draft', 'In Review', 'Approved', 'Published'];
const flowIndex = (key: ProductStageKey) => (key === 'published' ? 3 : key === 'unpublished' ? 2 : key === 'in_review' ? 1 : 0);

const forProduct = (rows: Row[] | undefined, id: string) => (rows ?? []).filter(r => r.productId === id);
const text = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const yesNo = (v: unknown) => (v === null || v === undefined ? null : v ? 'Yes' : 'No');

/** One product, as the Seller Panel's product page: status, details, SKUs, stock, specs, media and activity. */
export function ProductDetailScreen({ navigation, route }: ScreenProps<'ProductDetail'>) {
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const allowed = hasPermission('products-master:manage');
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState<'measures' | 'seo' | 'share' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  const record = useFetch(() => (allowed ? productsService.get(id) : Promise.resolve(null)), [id, allowed]);
  const categories = useFetch(() => categoryService.list(), []);
  const brands = useFetch(() => brandService.list(), []);
  const variants = useFetch(() => productBuilderService.variants(id), [id]);
  const photos = useFetch(() => productBuilderService.photoOverview(id), [id]);
  const specs = useFetch(() => productBuilderService.specifications(id), [id]);
  const variantSpecs = useFetch(() => productBuilderService.variantSpecifications(id), [id]);
  const check = useFetch(() => productsService.submissionCheck(id), [id]);
  const images = useFetch(() => productImageService.list(), []);
  const tags = useFetch(() => productTagService.list(), []);
  const documents = useFetch(() => productDocumentService.list(), []);
  const seos = useFetch(() => productSeoService.list(), []);
  const measuresList = useFetch(() => productMeasuresService.list(), []);

  const reloadAll = async (asRefresh = false) => {
    await Promise.all([record.reload(asRefresh), variants.reload(), photos.reload(), specs.reload(), variantSpecs.reload(), check.reload(), images.reload(), tags.reload()]);
  };
  const actions = useProductActions(() => reloadAll());

  // Back from the editor: show what changed.
  useFocusEffect(
    React.useCallback(() => {
      if (record.data) reloadAll();
      // Only on focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const productImages = useMemo(
    () => forProduct(images.data, id).sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0)),
    [images.data, id],
  );
  const productTags = useMemo(() => forProduct(tags.data, id), [tags.data, id]);
  const productDocs = useMemo(() => forProduct(documents.data, id), [documents.data, id]);
  const seo = useMemo(() => forProduct(seos.data, id)[0], [seos.data, id]);
  const measures = useMemo(() => forProduct(measuresList.data, id)[0], [measuresList.data, id]);
  const skus = variants.data ?? [];

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Product" onBack={navigation.goBack} />
        <ComingSoon label="Products" icon={BoxIcon} allowed={false} />
      </View>
    );
  }
  if (record.loading || (!record.data && !record.error)) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Product" onBack={navigation.goBack} />
        <View style={styles.content}>
          <ListSkeleton rows={4} height={120} />
        </View>
      </View>
    );
  }
  if (!record.data) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Product" onBack={navigation.goBack} />
        <ErrorState message={record.error ?? 'Product not found.'} onRetry={() => record.reload()} />
      </View>
    );
  }

  const p = record.data;
  const stage = productStage(p);
  const tone = BANNER_TONE[stage.key];
  const name = String(p.productName ?? '');
  const categoryById = new Map((categories.data ?? []).map(c => [c.id, c]));
  const categoryPath = (() => {
    const titles: string[] = [];
    let current = categoryById.get(String(p.categoryId ?? ''));
    while (current && titles.length < 5) {
      titles.unshift(String(current.categoryTitle ?? ''));
      current = current.parentCategoryId ? categoryById.get(String(current.parentCategoryId)) : undefined;
    }
    return titles.join(' › ') || '—';
  })();
  const brand = p.brandId ? String((brands.data ?? []).find(b => b.id === p.brandId)?.title ?? '—') : 'No brand';
  const productType = skus.length > 1 || skus.some(s => s.options.length > 0) ? 'Variable product' : 'Simple product';

  // Pricing: the cheapest SKU's price, with its MRP and cost.
  const cheapest = skus.length ? skus.reduce((a, b) => (b.sellingPrice < a.sellingPrice ? b : a)) : null;
  const margin = cheapest?.costPrice && cheapest.sellingPrice ? ((cheapest.sellingPrice - cheapest.costPrice) / cheapest.sellingPrice) * 100 : null;
  const stockRows = skus.flatMap(s => s.inventory);
  const totals = {
    available: stockRows.reduce((n, r) => n + (Number(r.availableStock) || 0), 0),
    reserved: stockRows.reduce((n, r) => n + (Number(r.reservedStock) || 0), 0),
    outOfStock: skus.filter(s => s.inventory.reduce((n, r) => n + (Number(r.availableStock) || 0), 0) <= 0).length,
  };
  const gallery = productImages.length
    ? productImages.map(i => (i.file as { url?: string } | undefined)?.url).filter((u): u is string => !!u)
    : photos.data?.productImages ?? [];

  async function submit() {
    setSubmitting(true);
    try {
      await productsService.submitForApproval(id);
      toast('Product submitted for approval');
      await reloadAll();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const remarks = text(p.approvalRemarks)?.trim();
  const stageDate = stage.key === 'in_review' ? p.submittedAt : p.reviewedAt;
  const issues = check.data && !check.data.ready ? check.data.issues : [];

  return (
    <View style={styles.screen}>
      <AppHeader title={name} subtitle={`SKU ${text(p.skuItemNumber) ?? '—'} · ${productType}`} onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={record.refreshing} onRefresh={() => reloadAll(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
      >
        {/* The product at a glance: photos, price, stock */}
        <View style={styles.hero}>
          <Gallery urls={gallery} badges={<>
            <Badge label={stage.label} tone={stage.tone} />
            {canPublish(p) || stage.key === 'published' || stage.key === 'unpublished' ? (
              <Badge label={Number(p.status) === 1 ? 'Active' : 'Inactive'} tone={Number(p.status) === 1 ? 'green' : 'slate'} />
            ) : null}
          </>} />
          <View style={styles.heroBody}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta} numberOfLines={2}>
              {`${categoryPath} · ${brand}`}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.salePrice}>{cheapest ? formatRupees(cheapest.sellingPrice) : '—'}</Text>
              {cheapest?.mrp && cheapest.mrp > cheapest.sellingPrice ? (
                <>
                  <Text style={styles.mrp}>{formatRupees(cheapest.mrp)}</Text>
                  <Text style={styles.off}>{`${Math.round(((cheapest.mrp - cheapest.sellingPrice) / cheapest.mrp) * 100)}% off`}</Text>
                </>
              ) : null}
            </View>
            {skus.length > 1 ? <Text style={styles.from}>{`Lowest of ${skus.length} SKUs`}</Text> : null}
            <View style={styles.chips}>
              {margin !== null ? <Text style={[styles.chip, styles.chipGood]}>{`Margin ${margin.toFixed(1)}%`}</Text> : null}
              {cheapest?.costPrice ? <Text style={styles.chip}>{`Cost ${formatRupees(cheapest.costPrice)}`}</Text> : null}
              <Text style={styles.chip}>{productType}</Text>
            </View>
          </View>
          <View style={styles.stock}>
            <StockStat label="Available" value={formatNumber(totals.available)} color={totals.available > 0 ? '#047857' : colors.error} />
            <View style={styles.stockDivider} />
            <StockStat label="Reserved" value={formatNumber(totals.reserved)} color={colors.text} />
            <View style={styles.stockDivider} />
            <StockStat label="Out of stock" value={`${totals.outOfStock} SKU${totals.outOfStock === 1 ? '' : 's'}`} color={totals.outOfStock ? colors.error : colors.textSecondary} />
          </View>
        </View>

        {/* Where it is in the approval workflow */}
        <View style={[styles.card, { borderColor: tone.border }, styles.approval]}>
          <View style={styles.approvalHead}>
            <Text style={styles.cardTitle}>Approval</Text>
            {stageDate ? (
              <Text style={styles.metaSmall}>
                {stage.key === 'in_review' ? 'Submitted' : 'Reviewed'} {formatWhen(stageDate)}
              </Text>
            ) : null}
          </View>
          {stage.key !== 'changes_required' ? (
            <View style={styles.steps}>
              {FLOW.map((label, i) => {
                const at = flowIndex(stage.key);
                const done = i < at || stage.key === 'published';
                const current = i === at && stage.key !== 'published';
                return (
                  <View key={label} style={styles.step}>
                    {i > 0 ? <View style={[styles.stepLine, (done || current) && styles.stepLineDone]} /> : null}
                    <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotCurrent]}>
                      {done ? <CheckIcon size={11} color={colors.white} strokeWidth={3} /> : <Text style={[styles.stepNum, current && styles.stepNumCurrent]}>{i + 1}</Text>}
                    </View>
                    <Text style={[styles.stepLabel, (done || current) && styles.stepLabelActive]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          <Text style={[styles.bannerText, { color: tone.fg }]}>{stage.description}</Text>
          {remarks ? (
            <View style={[styles.remarks, { backgroundColor: tone.bg }]}>
              <Text style={styles.remarksLabel}>Reviewer note</Text>
              <Text style={styles.remarksText}>{remarks}</Text>
            </View>
          ) : null}
          {canSubmitForApproval(p) ? (
            <>
              {issues.length ? (
                <View style={styles.issues}>
                  <Text style={styles.issuesTitle}>Before you submit:</Text>
                  {issues.map(issue => (
                    <Text key={issue} style={styles.issue}>
                      • {issue}
                    </Text>
                  ))}
                </View>
              ) : check.data?.ready ? (
                <Text style={styles.ready}>✓ Ready to submit</Text>
              ) : null}
              <Button
                title={stage.key === 'changes_required' ? 'Resubmit for approval' : 'Submit for approval'}
                loading={submitting}
                disabled={issues.length > 0}
                onPress={submit}
                style={styles.bannerBtn}
              />
            </>
          ) : null}
        </View>

        {/* Quick actions */}
        <View style={styles.quick}>
          <QuickAction icon={ShareIcon} label="Share" onPress={() => setEditing('share')} />
          <QuickAction icon={CopyIcon} label="Duplicate" onPress={() => actions.duplicate({ id, productName: name })} />
          {canPublish(p) ? (
            <QuickAction
              icon={Number(p.status) === 1 ? BanIcon : CheckCircleIcon}
              label={Number(p.status) === 1 ? 'Deactivate' : 'Activate'}
              onPress={() => actions.toggleStatus({ id, productName: name, status: p.status })}
            />
          ) : null}
          <QuickAction
            icon={TrashIcon}
            label="Delete"
            danger
            onPress={async () => {
              await actions.remove({ id, productName: name });
            }}
          />
        </View>

        <FilterChips options={[...TABS]} value={tab} onChange={value => setTab(value as Tab)} />

        {tab === 'overview' ? (
          <>
            <Card title="Details">
              <InfoRow label="Category" value={categoryPath} />
              <InfoRow label="Brand" value={brand} />
              <InfoRow label="Type" value={productType} />
              <InfoRow label="SKUs" value={String(skus.length)} />
              <Text style={styles.tagsLabel}>Tags</Text>
              <TagEditor productId={id} tags={productTags} onChange={() => tags.reload()} />
            </Card>
            {text(p.productShortDescription) || text(p.productLongDescription) ? (
              <Card title="Description">
                {text(p.productShortDescription) ? <Text style={styles.short}>{htmlToText(text(p.productShortDescription))}</Text> : null}
                {text(p.productLongDescription) ? <Text style={styles.long}>{htmlToText(text(p.productLongDescription))}</Text> : null}
              </Card>
            ) : null}
            <ProductInformation record={p} />
          </>
        ) : null}

        {tab === 'variants' ? (
          skus.length ? (
            skus.map(s => (
              <Card key={s.id}>
                <View style={styles.skuTop}>
                  {s.primaryImageUrl || s.imageUrl ? (
                    <Image source={{ uri: (s.primaryImageUrl || s.imageUrl)! }} style={styles.skuImg} />
                  ) : (
                    <View style={[styles.skuImg, styles.skuImgEmpty]}>
                      <BoxIcon size={18} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.flex}>
                    <Text style={styles.skuLabel}>{s.label}</Text>
                    <Text style={styles.skuMeta}>
                      {s.sku}
                      {s.barcode ? ` · ${s.barcode}` : ''}
                    </Text>
                  </View>
                  <Badge label={s.status === 1 ? 'On sale' : 'Hidden'} tone={s.status === 1 ? 'green' : 'slate'} />
                </View>
                <View style={styles.skuPrices}>
                  <Price label="Price" value={formatRupees(s.sellingPrice)} />
                  <Price label="MRP" value={s.mrp ? formatRupees(s.mrp) : '—'} />
                  <Price label="Cost" value={s.costPrice ? formatRupees(s.costPrice) : '—'} />
                  <Price label="Stock" value={formatNumber(s.stock)} tone={s.stock <= 0 ? colors.error : undefined} />
                </View>
              </Card>
            ))
          ) : (
            <Empty text="No SKUs yet. Add variants from Edit product." />
          )
        ) : null}

        {tab === 'inventory' ? (
          skus.length ? (
            skus.map(s => (
              <Card key={s.id} title={s.label}>
                {s.inventory.length ? (
                  s.inventory.map(r => (
                    <View key={r.warehouseId} style={styles.invRow}>
                      <Text style={styles.invWarehouse}>{r.warehouseTitle}</Text>
                      <Text style={styles.invNumbers}>
                        {formatNumber(r.availableStock)} available · {formatNumber(r.reservedStock)} reserved
                        {r.minimumStock ? ` · min ${formatNumber(r.minimumStock)}` : ''}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>No stock recorded.</Text>
                )}
              </Card>
            ))
          ) : (
            <Empty text="No SKUs yet." />
          )
        ) : null}

        {tab === 'specifications' ? (
          <>
            {(specs.data ?? []).length ? (
              <Card title="Product specifications">
                {(specs.data ?? []).map(sv => (
                  <InfoRow key={sv.specificationId} label={sv.title} value={sv.value ?? sv.options.map(o => o.title).join(', ') ?? '—'} />
                ))}
              </Card>
            ) : (
              <Empty text="No specifications yet. Add them from Edit product." />
            )}
            {(variantSpecs.data ?? [])
              .filter(v => v.values.length)
              .map(v => (
                <Card key={v.variantId} title={`${v.sku} overrides`}>
                  {v.values.map(sv => (
                    <InfoRow key={sv.specificationId} label={sv.title} value={sv.value ?? sv.options.map(o => o.title).join(', ')} />
                  ))}
                </Card>
              ))}
          </>
        ) : null}

        {tab === 'measurements' ? (
          <Card title="Measurements" action={<Edit onPress={() => setEditing('measures')} />}>
            {measures ? (
              <>
                <InfoRow label="Product (L × W × H)" value={dims(measures, 'product')} />
                <InfoRow label="Product weight" value={weight(measures, 'product')} />
                <InfoRow label="Package (L × W × H)" value={dims(measures, 'package')} />
                <InfoRow label="Package weight" value={weight(measures, 'package')} />
                <InfoRow label="Items in a package" value={text(measures.packageQuantity) ?? '—'} />
                <InfoRow label="Condition" value={`${text(measures.itemCondition) ?? '—'}${text(measures.itemConditionNote) ? ` · ${text(measures.itemConditionNote)}` : ''}`} />
              </>
            ) : (
              <Text style={styles.muted}>No measurements yet.</Text>
            )}
          </Card>
        ) : null}

        {tab === 'seo' ? (
          <Card title="SEO" action={<Edit onPress={() => setEditing('seo')} />}>
            <InfoRow label="Meta title" value={text(p.metaTitle) ?? '—'} />
            <InfoRow label="Meta description" value={text(p.metaDescription) ?? '—'} />
            <InfoRow label="Share title" value={text(seo?.ogTitle) ?? '—'} />
            <InfoRow label="Share description" value={text(seo?.ogDescription) ?? '—'} />
            <InfoRow label="Canonical URL" value={text(seo?.canonicalUrl) ?? '—'} />
            <InfoRow label="Search engines" value={`${seo?.robotsIndex === false ? 'No index' : 'Index'} · ${seo?.robotsFollow === false ? 'No follow' : 'Follow'}`} />
          </Card>
        ) : null}

        {tab === 'media' ? (
          <>
            <ProductPhotos productId={id} images={productImages} onChange={() => Promise.all([images.reload(), photos.reload()])} />
            <VariantPhotoStrip overview={photos.data} />
            <ProductDocuments documents={productDocs} onChange={() => documents.reload()} />
          </>
        ) : null}

        {tab === 'activity' ? (
          <Card title="Activity">
            {[
              { label: 'Product created', at: p.createdAt },
              p.submittedAt ? { label: 'Submitted for approval', at: p.submittedAt } : null,
              p.reviewedAt ? { label: p.approvalStatus === 'CHANGES_REQUIRED' ? 'Changes requested' : 'Approved', at: p.reviewedAt } : null,
              p.updatedAt && p.updatedAt !== p.createdAt ? { label: 'Product updated', at: p.updatedAt } : null,
            ]
              .filter((e): e is { label: string; at: unknown } => !!e && !!e.at)
              .sort((a, b) => new Date(String(b.at)).getTime() - new Date(String(a.at)).getTime())
              .map(e => (
                <View key={e.label} style={styles.activity}>
                  <View style={styles.activityDot} />
                  <View style={styles.flex}>
                    <Text style={styles.activityLabel}>{e.label}</Text>
                    <Text style={styles.muted}>{formatWhen(e.at)}</Text>
                  </View>
                </View>
              ))}
          </Card>
        ) : null}
      </ScrollView>

      {/* Editing is the main thing to do here: always in reach */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={() => setEditing('share')} style={({ pressed }) => [styles.barIcon, pressed && styles.pressed]}>
          <ShareIcon size={20} color={colors.text} />
        </Pressable>
        <Button title="Edit product" icon={<EditIcon size={18} color={colors.white} />} onPress={() => navigation.navigate('ProductEditor', { id })} style={styles.flex} />
      </View>

      <MeasuresSheet
        visible={editing === 'measures'}
        productId={id}
        measures={measures}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          measuresList.reload();
        }}
      />
      <ShareProductSheet visible={editing === 'share'} product={p} variants={skus} onClose={() => setEditing(null)} />
      <SeoSheet
        visible={editing === 'seo'}
        productId={id}
        seo={seo}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          seos.reload();
        }}
      />
    </View>
  );
}

function dims(m: Row, prefix: 'product' | 'package') {
  const values = ['Length', 'Width', 'Height'].map(d => text(m[`${prefix}${d}`]));
  if (values.every(v => !v)) return '—';
  return `${values.map(v => v ?? '—').join(' × ')} ${text(m[`${prefix}LengthMeasuringUnit`]) ?? ''}`.trim();
}

function weight(m: Row, prefix: 'product' | 'package') {
  const v = text(m[`${prefix}Weight`]);
  return v ? `${v} ${text(m[`${prefix}WeightMeasuringUnit`]) ?? ''}`.trim() : '—';
}

/** Every product field the Seller Panel's Product Information panel shows, grouped. */
function ProductInformation({ record: p }: { record: Row }) {
  const groups: { title: string; rows: [string, string | null][] }[] = [
    {
      title: 'Identity',
      rows: [
        ['Product ID', text(p.idd)],
        ['Slug', text(p.productSlug)],
        ['ID type', text(p.productIdType)],
        ['Manufacturer', text(p.manufacturer)],
        ['Country of origin', text(p.countryOfOrigin)],
      ],
    },
    { title: 'Tax', rows: [['HSN code', text(p.hsnCode)], ['GST', text(p.gstPercentage) ? `${text(p.gstPercentage)}%` : null]] },
    {
      title: 'Ordering & delivery',
      rows: [
        ['Minimum order quantity', text(p.minimumOrderQuantity)],
        ['Maximum order quantity', text(p.maximumOrderQuantity)],
        ['Fulfilment', text(p.fulfillmentType)],
        ['Handling time', text(p.handlingTime)],
        ['Shipping charge', text(p.shippingAmount) ? formatRupees(Number(p.shippingAmount)) : null],
        ['Cash on delivery', yesNo(p.isCodAvailable)],
      ],
    },
    {
      title: 'Returns & warranty',
      rows: [
        ['Returnable', yesNo(p.isReturnable)],
        ['Return period', text(p.returnPeriod)],
        ['Warranty', text(p.warrantyPeriod)],
      ],
    },
    {
      title: 'Gifting',
      rows: [
        ['Can be a gift', yesNo(p.canBeGift)],
        ['Gift wrap', yesNo(p.isGiftWrapAvailable)],
        ['Gift wrap charge', text(p.giftWrapCharges) ? formatRupees(Number(p.giftWrapCharges)) : null],
      ],
    },
    {
      title: 'Labels',
      rows: [
        ['Featured', yesNo(p.isFeatured)],
        ['New arrival', yesNo(p.isNewArrival)],
        ['Best seller', yesNo(p.isBestSeller)],
        ['Has expiry dates', yesNo(p.requiresExpiry)],
      ],
    },
    {
      title: 'Sold in',
      rows: [['Stores', p.storeScope === 'SPECIFIC_STORES' ? `${((p.storeIds as unknown[]) ?? []).length} selected stores` : 'All your stores']],
    },
    {
      title: 'Highlights & search',
      rows: [
        ...[1, 2, 3, 4, 5].map(i => [`Highlight ${i}`, text(p[`productKeyFeature${i}`])] as [string, string | null]),
        ['Search keywords', text(p.searchKeywords)],
        ...[1, 2, 3, 4, 5].map(i => [`Search phrase ${i}`, text(p[`productSearchTerm${i}`])] as [string, string | null]),
      ],
    },
    {
      title: 'Policies',
      rows: [
        ['Terms & conditions', text(p.productTermsAndConditions)],
        ['Legal disclaimer', text(p.legalDisclaimerDescription)],
      ],
    },
  ];
  return (
    <Card title="Product information">
      {groups.map(group => {
        const rows = group.rows.filter(([, v]) => v);
        if (!rows.length) return null;
        return (
          <View key={group.title} style={styles.infoGroup}>
            <Text style={styles.infoTitle}>{group.title}</Text>
            {rows.map(([label, value]) => (
              <InfoRow key={label} label={label} value={value} />
            ))}
          </View>
        );
      })}
    </Card>
  );
}

/** Photos, one per page, with dots; the badges sit on top. */
function Gallery({ urls, badges }: { urls: string[]; badges: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const pageWidth = width - 32;
  const [page, setPage] = useState(0);
  return (
    <View style={styles.galleryWrap}>
      {urls.length ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
        >
          {urls.map(url => (
            <Image key={url} source={{ uri: url }} style={[styles.galleryImg, { width: pageWidth }]} resizeMode="contain" />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.galleryImg, styles.galleryEmpty]}>
          <BoxIcon size={36} color={colors.textMuted} />
          <Text style={styles.metaSmall}>No photos yet</Text>
        </View>
      )}
      <View style={styles.galleryBadges}>{badges}</View>
      {urls.length > 1 ? (
        <View style={styles.dots}>
          {urls.map((url, i) => (
            <View key={url} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
      ) : null}
      {urls.length ? <Text style={styles.galleryCount}>{`${page + 1}/${urls.length}`}</Text> : null}
    </View>
  );
}

function StockStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stockStat}>
      <Text style={[styles.stockValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
      <Text style={styles.stockLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon: Icon, label, onPress, danger }: { icon: ComponentType<IconProps>; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}>
      <View style={[styles.quickIcon, danger && styles.quickIconDanger]}>
        <Icon size={18} color={danger ? colors.error : colors.secondary} />
      </View>
      <Text style={[styles.quickText, danger && styles.quickTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function Edit({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={onPress} hitSlop={8}>
      <Text style={styles.edit}>Edit</Text>
    </Pressable>
  );
}

function Price({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.price}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function Empty({ text: message }: { text: string }) {
  return (
    <View style={styles.empty}>
      <FileTextIcon size={22} color={colors.textMuted} />
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.bold },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  pressed: { opacity: 0.7 },
  card: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: 'transparent', backgroundColor: colors.surface, ...shadow.card },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { marginTop: 4, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  metaSmall: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  hero: { overflow: 'hidden', borderRadius: 20, backgroundColor: colors.surface, ...shadow.card },
  galleryWrap: { backgroundColor: '#f8fafc' },
  galleryImg: { height: 240, backgroundColor: '#f8fafc' },
  galleryEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  galleryBadges: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galleryCount: { position: 'absolute', top: 12, right: 12, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontFamily: fonts.semibold, fontSize: 11, color: colors.white, backgroundColor: 'rgba(6,27,58,0.55)' },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(6,27,58,0.2)' },
  dotOn: { width: 16, backgroundColor: colors.secondary },
  heroBody: { paddingHorizontal: 16, paddingTop: 14 },
  name: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  salePrice: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.6, color: colors.text },
  mrp: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through' },
  off: { fontFamily: fonts.bold, fontSize: 13.5, color: '#047857' },
  from: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, backgroundColor: colors.background },
  chipGood: { color: '#047857', backgroundColor: '#ecfdf5' },
  stock: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginHorizontal: 12, marginBottom: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.background },
  stockStat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  stockValue: { fontFamily: fonts.extrabold, fontSize: 16 },
  stockLabel: { marginTop: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  stockDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
  approval: { gap: 10 },
  approvalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  steps: { flexDirection: 'row', marginTop: 2 },
  step: { flex: 1, alignItems: 'center' },
  stepLine: { position: 'absolute', top: 11, right: '50%', width: '100%', height: 2, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: '#4ade80' },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  stepDotDone: { backgroundColor: colors.success },
  stepDotCurrent: { width: 28, height: 28, borderRadius: 14, marginTop: -2, borderWidth: 4, borderColor: colors.secondaryLight, backgroundColor: colors.secondary },
  stepNum: { fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted },
  stepNumCurrent: { color: colors.white },
  stepLabel: { marginTop: 5, fontFamily: fonts.medium, fontSize: 11, textAlign: 'center', color: colors.textMuted },
  stepLabelActive: { fontFamily: fonts.semibold, color: colors.text },
  bannerText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  remarks: { gap: 2, padding: 10, borderRadius: 12 },
  remarksLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  remarksText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  issues: { gap: 3 },
  issuesTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.warningDark },
  issue: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warningDark },
  ready: { fontFamily: fonts.bold, fontSize: 13, color: colors.successDark },
  bannerBtn: { marginTop: 2 },
  quick: { flexDirection: 'row', gap: 8 },
  quickBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow.card },
  quickIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  quickIconDanger: { backgroundColor: colors.errorLight },
  quickText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  quickTextDanger: { color: colors.error },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, ...shadow.raised },
  barIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tagsLabel: { marginTop: 8, marginBottom: 6, fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  short: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  long: { marginTop: 8, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  infoGroup: { marginBottom: 10 },
  infoTitle: { marginBottom: 2, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.5, color: colors.textMuted, textTransform: 'uppercase' },
  skuTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skuImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.background },
  skuImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  skuLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  skuMeta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  skuPrices: { marginTop: 12, flexDirection: 'row', gap: 8 },
  price: { flex: 1 },
  priceLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  priceValue: { marginTop: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  invRow: { paddingVertical: 6 },
  invWarehouse: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  invNumbers: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  edit: { fontFamily: fonts.bold, fontSize: 14, color: colors.secondary },
  activity: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  activityDot: { marginTop: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  activityLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
});
