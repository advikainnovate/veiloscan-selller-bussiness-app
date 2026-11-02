import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert as NativeAlert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { extractErrorMessage } from '../../../lib/api';
import { approvalStatusOf, canPublish, canSubmitForApproval, productStage } from '../../../lib/product-approval';
import { skuError } from '../../../lib/sku';
import { productBuilderService } from '../../../services/product-builder-service';
import {
  brandService,
  categoryService,
  productExpiryService,
  productImageService,
  productMeasuresService,
  productsService,
  productTagService,
  type Row,
} from '../../../services/products-service';
import { AppHeader } from '../../../components/layout/AppHeader';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ErrorState, ListSkeleton } from '../../../components/list/ListParts';
import { CheckIcon } from '../../../components/icons';
import type { ScreenProps } from '../../../navigation/types';
import { BasicStep, scopeError, type ProductScope } from './BasicStep';
import { toSkuRow, VariantsStep, type StepHandle } from './VariantsStep';
import { SpecificationsStep } from './SpecificationsStep';
import { ExpiryBatches, InventoryStep } from './InventoryStep';
import { SellingStep } from './SellingStep';
import { MeasurementsStep, ReviewStep } from './OtherSteps';
import {
  EMPTY_MEASURES,
  EMPTY_PRODUCT,
  extraDetailsFrom,
  extraDetailsPayload,
  type BusinessVariantRow,
  type MeasuresValues,
  type MediaItem,
  type ProductFormValues,
  type SpecificationRow,
  type TagItem,
} from './types';

const STEPS = [
  { key: 'basic', label: 'Basic' },
  { key: 'variants', label: 'Variants' },
  { key: 'specifications', label: 'Specs' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'selling', label: 'Selling' },
  { key: 'measurements', label: 'Measures' },
  { key: 'review', label: 'Review' },
] as const;

const s = (v: unknown, d = '') => (v === null || v === undefined ? d : String(v));
const pickApproval = (r: Row): Row => ({
  id: r.id,
  approvalStatus: r.approvalStatus,
  approvalRemarks: r.approvalRemarks,
  submittedAt: r.submittedAt,
  reviewedAt: r.reviewedAt,
  isActive: r.isActive,
});

/**
 * Add / edit a product, as the Seller Panel's product wizard: Basic →
 * Variants → Specifications → Inventory → Selling → Measurements → Review.
 * Each step is saved when moving on; the last step submits it for approval
 * (or publishes an approved product).
 */
export function ProductEditorScreen({ navigation, route }: ScreenProps<'ProductEditor'>) {
  const editId = route.params?.id;
  const isEdit = !!editId;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('products-master:manage');

  const [step, setStep] = useState(0);
  const [highest, setHighest] = useState(isEdit ? STEPS.length - 1 : 0);
  const [productId, setProductId] = useState<string | null>(editId ?? null);
  const [product, setProduct] = useState<ProductFormValues>(EMPTY_PRODUCT);
  const [scope, setScope] = useState<ProductScope>({ storeScope: 'ALL_STORES', storeIds: [] });
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [skus, setSkus] = useState<BusinessVariantRow[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [specifications, setSpecifications] = useState<SpecificationRow[]>([]);
  const [measures, setMeasures] = useState<MeasuresValues>(EMPTY_MEASURES);
  const [approval, setApproval] = useState<Row>({ id: '', approvalStatus: 'DRAFT' });
  const [labels, setLabels] = useState<{ brand?: string; category?: string }>({});
  const [hydrating, setHydrating] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  // What's saved, to find photos / tags removed in the form.
  const savedMedia = useRef<MediaItem[]>([]);
  const savedTags = useRef<TagItem[]>([]);
  const variantsStep = useRef<StepHandle>(null);
  const specificationsStep = useRef<StepHandle>(null);
  const inventoryStep = useRef<StepHandle>(null);
  const sellingStep = useRef<StepHandle>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (!editId || !allowed) return;
    let cancelled = false;
    (async () => {
      try {
        const [record, images, allTags, measureRows, variants] = await Promise.all([
          productsService.get(editId),
          productImageService.list(),
          productTagService.list(),
          productMeasuresService.list(),
          productBuilderService.variants(editId).catch(() => []),
        ]);
        if (cancelled) return;
        setApproval(pickApproval(record));
        setScope({ storeScope: record.storeScope === 'SPECIFIC_STORES' ? 'SPECIFIC_STORES' : 'ALL_STORES', storeIds: (record.storeIds as string[]) ?? [] });
        setProduct({
          productName: s(record.productName),
          productSlug: s(record.productSlug),
          slugTouched: true,
          brandId: s(record.brandId),
          categoryId: s(record.categoryId),
          manufacturer: s(record.manufacturer),
          productIdType: s(record.productIdType, 'SKU'),
          skuItemNumber: s(record.skuItemNumber),
          productShortDescription: s(record.productShortDescription),
          productLongDescription: s(record.productLongDescription),
          isFeatured: Boolean(record.isFeatured),
          isNewArrival: Boolean(record.isNewArrival),
          isBestSeller: Boolean(record.isBestSeller),
          requiresExpiry: Boolean(record.requiresExpiry),
          status: Number(record.status ?? 0),
          ...extraDetailsFrom(record),
        });
        const productMedia = images
          .filter(m => m.productId === editId)
          .sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0))
          .map(m => ({ id: m.id, fileId: m.fileId as string, url: (m.file as { url?: string } | undefined)?.url, altText: s(m.altText), isPrimary: Boolean(m.isPrimary) }));
        setMedia(productMedia);
        savedMedia.current = productMedia;
        const productTags = allTags.filter(t => t.productId === editId).map(t => ({ id: t.id, tagTitle: s(t.tagTitle), tagSlug: s(t.tagSlug) }));
        setTags(productTags);
        savedTags.current = productTags;
        setSkus(variants.map(toSkuRow));
        const m = measureRows.find(r => r.productId === editId);
        if (m) {
          setMeasures({
            id: m.id,
            packageLength: s(m.packageLength),
            packageWidth: s(m.packageWidth),
            packageHeight: s(m.packageHeight),
            packageWeight: s(m.packageWeight),
            packageLengthMeasuringUnit: s(m.packageLengthMeasuringUnit, 'CM'),
            packageWeightMeasuringUnit: s(m.packageWeightMeasuringUnit, 'KG'),
            packageQuantity: s(m.packageQuantity, '1'),
            productLength: s(m.productLength),
            productWidth: s(m.productWidth),
            productHeight: s(m.productHeight),
            productWeight: s(m.productWeight),
            productLengthMeasuringUnit: s(m.productLengthMeasuringUnit, 'CM'),
            productWeightMeasuringUnit: s(m.productWeightMeasuringUnit, 'KG'),
            itemCondition: s(m.itemCondition, 'NEW'),
            itemConditionNote: s(m.itemConditionNote),
          });
        }
      } catch (err) {
        if (!cancelled) setLoadError(extractErrorMessage(err));
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, allowed]);

  // Category / brand names for the Review step.
  useEffect(() => {
    if (step !== STEPS.length - 1) return;
    Promise.all([categoryService.list(), brandService.list()]).then(
      ([cats, brands]) =>
        setLabels({
          category: s(cats.find(c => c.id === product.categoryId)?.categoryTitle) || undefined,
          brand: s(brands.find(b => b.id === product.brandId)?.title) || undefined,
        }),
      () => {},
    );
  }, [step, product.categoryId, product.brandId]);

  const update = useCallback(<K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => {
    setTouched(true);
    setProduct(prev => ({ ...prev, [field]: value }));
  }, []);
  const updateMeasures = useCallback(<K extends keyof MeasuresValues>(field: K, value: MeasuresValues[K]) => {
    setTouched(true);
    setMeasures(prev => ({ ...prev, [field]: value }));
  }, []);

  const approvalRecord: Row = { ...approval, status: product.status };
  const isApproved = canPublish(approvalRecord);
  const awaitingReview = approvalStatusOf(approvalRecord) === 'PENDING_APPROVAL';
  const stage = productStage(approvalRecord);

  async function persistBasic(requestedStatus: number): Promise<string> {
    // Only approved products can be live; everything else is saved as a draft.
    const statusValue = isApproved ? requestedStatus : 0;
    if (!product.productName.trim() || !product.skuItemNumber || !product.categoryId || !product.productSlug) {
      throw new Error('Fill in the product name, SKU, slug and category.');
    }
    const badSku = skuError(product.skuItemNumber);
    if (badSku) throw new Error(badSku);
    const badScope = scopeError(scope);
    if (badScope) throw new Error(badScope);

    const payload: Record<string, unknown> = {
      storeScope: scope.storeScope,
      storeIds: scope.storeScope === 'SPECIFIC_STORES' ? scope.storeIds : [],
      productName: product.productName.trim(),
      productSlug: product.productSlug,
      brandId: product.brandId || null,
      categoryId: product.categoryId,
      manufacturer: product.manufacturer || undefined,
      productIdType: product.productIdType || undefined,
      skuItemNumber: product.skuItemNumber,
      productShortDescription: product.productShortDescription || undefined,
      productLongDescription: product.productLongDescription || undefined,
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
      isBestSeller: product.isBestSeller,
      requiresExpiry: product.requiresExpiry,
      ...extraDetailsPayload(product),
    };

    let id = productId;
    if (id) {
      await productsService.update(id, { ...payload, status: statusValue });
    } else {
      const created = await productsService.create(payload);
      id = created.id;
      setProductId(id);
      setApproval(pickApproval(created));
      if (statusValue !== 1) await productsService.update(id, { status: statusValue });
    }

    // Photos: new ones added, removed ones deleted, and the cover kept in step.
    const keptIds = new Set(media.filter(m => m.id).map(m => String(m.id)));
    for (const old of savedMedia.current) if (old.id && !keptIds.has(String(old.id))) await productImageService.remove(String(old.id));
    const nextMedia: MediaItem[] = [];
    for (const m of media) {
      if (m.id) {
        const before = savedMedia.current.find(o => o.id === m.id);
        if (before && before.isPrimary !== m.isPrimary) await productImageService.update(String(m.id), { isPrimary: m.isPrimary });
        nextMedia.push(m);
      } else {
        const created = await productImageService.create({ productId: id, fileId: m.fileId, altText: m.altText || undefined, isPrimary: m.isPrimary });
        nextMedia.push({ ...m, id: created.id });
      }
    }
    setMedia(nextMedia);
    savedMedia.current = nextMedia;

    // Tags: the same.
    const keptTags = new Set(tags.filter(t => t.id).map(t => String(t.id)));
    for (const old of savedTags.current) if (old.id && !keptTags.has(String(old.id))) await productTagService.remove(String(old.id));
    const nextTags: TagItem[] = [];
    for (const t of tags) {
      if (t.id) nextTags.push(t);
      else {
        const created = await productTagService.create({ productId: id, tagTitle: t.tagTitle, tagSlug: t.tagSlug });
        nextTags.push({ ...t, id: created.id });
      }
    }
    setTags(nextTags);
    savedTags.current = nextTags;

    setProduct(prev => ({ ...prev, status: statusValue }));
    return id;
  }

  async function persistMeasures(id: string | null) {
    if (!id) return;
    const payload: Record<string, unknown> = {
      productId: id,
      packageLength: measures.packageLength || undefined,
      packageWidth: measures.packageWidth || undefined,
      packageHeight: measures.packageHeight || undefined,
      packageWeight: measures.packageWeight || undefined,
      packageLengthMeasuringUnit: measures.packageLengthMeasuringUnit || undefined,
      packageWeightMeasuringUnit: measures.packageWeightMeasuringUnit || undefined,
      packageQuantity: measures.packageQuantity ? Number(measures.packageQuantity) : undefined,
      productLength: measures.productLength || undefined,
      productWidth: measures.productWidth || undefined,
      productHeight: measures.productHeight || undefined,
      productWeight: measures.productWeight || undefined,
      productLengthMeasuringUnit: measures.productLengthMeasuringUnit || undefined,
      productWeightMeasuringUnit: measures.productWeightMeasuringUnit || undefined,
      itemCondition: measures.itemCondition || undefined,
      itemConditionNote: measures.itemConditionNote || undefined,
    };
    const hasValue = Object.entries(payload).some(([k, v]) => k !== 'productId' && v !== undefined && v !== '');
    if (!hasValue) return;
    if (measures.id) await productMeasuresService.update(String(measures.id), payload);
    else {
      const created = await productMeasuresService.create(payload);
      setMeasures(prev => ({ ...prev, id: created.id }));
    }
  }

  async function persistStep(statusValue?: number) {
    let id = productId;
    const key = STEPS[step].key;
    if (key === 'basic') id = await persistBasic(statusValue ?? product.status ?? 0);
    else if (key === 'variants') await variantsStep.current?.save();
    else if (key === 'specifications') await specificationsStep.current?.save();
    else if (key === 'inventory') await inventoryStep.current?.save();
    else if (key === 'selling') await sellingStep.current?.save();
    else if (key === 'measurements') await persistMeasures(id);
    return id;
  }

  // A perishable product needs at least one expiry batch.
  async function assertExpiryBatches(id: string | null) {
    if (!product.requiresExpiry || !id) return;
    const batches = await productExpiryService.list({ productId: id });
    if (!batches.length) throw new Error('This product has an expiry date: add at least one expiry batch in the Inventory step.');
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setSaving(true);
    try {
      await action();
    } catch (err) {
      setError(extractErrorMessage(err));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  }

  const next = () =>
    run(async () => {
      const id = await persistStep();
      if (STEPS[step].key === 'inventory') await assertExpiryBatches(id);
      const to = Math.min(step + 1, STEPS.length - 1);
      setStep(to);
      setHighest(h => Math.max(h, to));
      setTouched(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });

  const saveDraft = () =>
    run(async () => {
      await persistStep(isApproved ? undefined : 0);
      toast(isApproved ? 'Product saved' : 'Product saved as draft');
      navigation.goBack();
    });

  const publish = () =>
    run(async () => {
      if (!productId) return;
      await assertExpiryBatches(productId);
      await productsService.update(productId, { status: 1 });
      toast('Product published');
      navigation.goBack();
    });

  const submit = () =>
    run(async () => {
      if (!productId) return;
      await assertExpiryBatches(productId);
      await productsService.submitForApproval(productId);
      toast('Product submitted for approval');
      navigation.goBack();
    });

  function leave() {
    if (!touched) return navigation.goBack();
    NativeAlert.alert('Leave without saving?', 'Changes on this step will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }

  const title = isEdit ? 'Edit product' : 'Add product';
  if (!allowed) {
    return (
      <View style={styles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ErrorState message="You don't have permission to manage products." onRetry={navigation.goBack} />
      </View>
    );
  }
  if (hydrating) {
    return (
      <View style={styles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <View style={styles.content}>
          <ListSkeleton rows={4} height={120} />
        </View>
      </View>
    );
  }
  if (loadError) {
    return (
      <View style={styles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ErrorState message={loadError} onRetry={() => navigation.replace('ProductEditor', { id: editId })} />
      </View>
    );
  }

  const key = STEPS[step].key;
  const last = step === STEPS.length - 1;

  return (
    <View style={styles.screen}>
      <AppHeader title={title} subtitle={product.productName || stage.label} onBack={leave} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepsBar} contentContainerStyle={styles.steps}>
        {STEPS.map((st, i) => {
          const current = i === step;
          const done = i < step || (isEdit && i <= highest && !current);
          const locked = i > highest;
          return (
            <Pressable
              key={st.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: current, disabled: locked }}
              disabled={locked || saving}
              onPress={() => {
                setError(null);
                setStep(i);
              }}
              style={[styles.step, current && styles.stepOn, locked && styles.stepLocked]}
            >
              <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotOn]}>
                {done ? <CheckIcon size={11} color={colors.white} strokeWidth={3} /> : <Text style={[styles.stepNum, current && styles.stepNumOn]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, current && styles.stepLabelOn]}>{st.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Alert message={error} /> : null}
          {key === 'basic' ? (
            <BasicStep
              product={product}
              update={update}
              scope={scope}
              setScope={value => {
                setTouched(true);
                setScope(value);
              }}
              media={media}
              setMedia={v => {
                setTouched(true);
                setMedia(v);
              }}
              tags={tags}
              setTags={v => {
                setTouched(true);
                setTags(v);
              }}
            />
          ) : null}
          {key === 'variants' ? <VariantsStep ref={variantsStep} productId={productId} categoryId={product.categoryId} media={media} onSkusChange={setSkus} /> : null}
          {key === 'specifications' ? <SpecificationsStep ref={specificationsStep} productId={productId} categoryId={product.categoryId} onSummaryChange={setSpecifications} /> : null}
          {key === 'inventory' ? (
            <>
              <InventoryStep ref={inventoryStep} productId={productId} skus={skus} warehouseId={warehouseId} setWarehouseId={setWarehouseId} />
              <ExpiryBatches productId={productId} scope={scope} skus={skus} required={product.requiresExpiry} />
            </>
          ) : null}
          {key === 'selling' ? <SellingStep ref={sellingStep} productId={productId} /> : null}
          {key === 'measurements' ? <MeasurementsStep measures={measures} update={updateMeasures} /> : null}
          {key === 'review' ? (
            <ReviewStep
              product={product}
              brandLabel={labels.brand}
              categoryLabel={labels.category}
              media={media}
              tags={tags}
              skus={skus}
              warehouseId={warehouseId}
              specifications={specifications}
              measures={measures}
              productId={productId}
              stage={stage}
            />
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable accessibilityRole="button" onPress={saveDraft} disabled={saving} style={styles.draftBtn}>
            <Text style={styles.draftText}>{isApproved ? 'Save' : 'Save draft'}</Text>
          </Pressable>
          {!last ? (
            <Button title={`Next: ${STEPS[step + 1].label}`} loading={saving} loadingTitle="Saving…" onPress={next} style={styles.flex} />
          ) : isApproved ? (
            <Button title={Number(product.status) === 1 ? 'Save & close' : 'Publish'} loading={saving} disabled={!productId} onPress={publish} style={styles.flex} />
          ) : awaitingReview ? (
            <Button title="Awaiting approval" disabled onPress={() => {}} style={styles.flex} />
          ) : (
            <Button
              title={approvalStatusOf(approvalRecord) === 'CHANGES_REQUIRED' ? 'Resubmit for approval' : 'Submit for approval'}
              loading={saving}
              disabled={!productId || !canSubmitForApproval(approvalRecord)}
              onPress={submit}
              style={styles.flex}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  stepsBar: { flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  steps: { gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full },
  stepOn: { backgroundColor: colors.secondaryLight },
  stepLocked: { opacity: 0.45 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  stepDotDone: { backgroundColor: colors.success },
  stepDotOn: { backgroundColor: colors.secondary },
  stepNum: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textMuted },
  stepNumOn: { color: colors.white },
  stepLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  stepLabelOn: { color: colors.secondaryDark },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.raised,
  },
  draftBtn: { height: 52, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  draftText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
});
