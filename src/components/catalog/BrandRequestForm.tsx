import React, { useMemo, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { pickImages } from '../../lib/pick-image';
import { BRAND_STATUS_LABEL, brandChecklist, childCategoryOptions, SALES_CHANNELS, toggleChannel } from '../../lib/catalog';
import { brandRequestService, categorywiseBrands } from '../../services/catalog-service';
import { brandService, categoryService, fileService, type PickedFile, type Row } from '../../services/products-service';
import { DateField, Field, Input, SelectField } from '../form/Fields';
import { opsStyles } from '../operations/OpsParts';
import { SectionCard } from '../store/StoreSections';
import { AlertCircleIcon, CheckCircleIcon, CheckIcon, FileTextIcon, ImageIcon, ShieldCheckIcon, StoreIcon, TagIcon } from '../icons';
import { useTranslation } from 'react-i18next';

type DocKey = 'mrpTag1' | 'mrpTag2' | 'logo' | 'registeredDocument';
const NO_FILES: Record<DocKey, PickedFile | null> = { mrpTag1: null, mrpTag2: null, logo: null, registeredDocument: null };
const fileUrl = (r: Row | undefined, key: string) => ((r?.[key] as Row | null | undefined)?.url as string | undefined) ?? undefined;

export function Choice({ checked, type = 'radio', title, body, onPress }: { checked: boolean; type?: 'radio' | 'checkbox'; title: string; body?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole={type}
      accessibilityState={{ checked }}
      accessibilityLabel={title}
      onPress={onPress}
      style={[styles.choice, checked && styles.choiceOn]}
    >
      <View style={[styles.mark, type === 'radio' ? styles.round : styles.square, checked && styles.markOn]}>
        {checked ? type === 'radio' ? <View style={styles.dot} /> : <CheckIcon size={11} color={colors.white} strokeWidth={3} /> : null}
      </View>
      <View style={styles.flex}>
        <Text style={opsStyles.title}>{title}</Text>
        {body ? <Text style={opsStyles.muted}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

function UploadBox({ title, required, file, currentUrl, onFile, onRemove }: { title: string; required?: boolean; file: PickedFile | null; currentUrl?: string; onFile: (f: PickedFile) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const uri = file?.uri ?? currentUrl;
  async function pick() {
    try {
      const [picked] = await pickImages({ multiple: false });
      if (picked) onFile(picked);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }
  return (
    <View style={styles.upload}>
      <View style={styles.uploadThumb}>{uri && !/\.pdf($|\?)/i.test(uri) ? <Image source={{ uri }} style={styles.fill} resizeMode="cover" /> : uri ? <FileTextIcon size={20} color={colors.secondary} /> : <ImageIcon size={20} color={colors.textMuted} />}</View>
      <View style={styles.flex}>
        <Text style={opsStyles.title}>
          {title}
          {required ? <Text style={opsStyles.danger}> *</Text> : <Text style={opsStyles.muted}>{' '}{t('common.optional')}</Text>}
        </Text>
        <Text style={opsStyles.muted} numberOfLines={1}>
          {file ? file.name : currentUrl ? t('catalog.uploadedPickAPhotoToReplace') : t('catalog.aPhotoOfTheDocument')}
        </Text>
      </View>
      <View style={styles.uploadActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.uploadTitle', { title })} onPress={pick} style={opsStyles.smallBtn}>
          <Text style={opsStyles.smallBtnText}>{uri ? t('common.change') : t('common.upload')}</Text>
        </Pressable>
        {file ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('catalog.removeTitle', { title })} hitSlop={6} onPress={onRemove}>
            <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>{t('common.remove')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Step({ n, title, subtitle, children }: { n: number; title: string; subtitle: string; children: ReactNode }) {
  return (
    <SectionCard icon={n === 1 ? TagIcon : n === 2 ? StoreIcon : ShieldCheckIcon} title={`${n} · ${title}`} subtitle={subtitle}>
      {children}
    </SectionCard>
  );
}

/**
 * A new brand approval request, or (with `existing`) the update of a
 * rejected one before it's resubmitted. As the panel's form; documents are
 * photos here.
 */
export function BrandRequestForm({
  existing,
  initialCategoryId = '',
  initialBrandId = '',
  onDone,
  onCancel,
}: {
  existing?: Row;
  initialCategoryId?: string;
  initialBrandId?: string;
  /** Created ids (new) or nothing (resubmitted). */
  onDone: (created?: Row[]) => void;
  onCancel?: () => void;
}) {
  const { t: tr } = useTranslation();
  const { hasPermission } = useAuth();
  const { current } = useStore();
  const toast = useToast();
  const allowed = hasPermission('products-master:manage');
  const isResubmit = !!existing;
  const load = allowed && !isResubmit;

  const storesQ = useFetch(() => (load ? brandRequestService.options() : Promise.resolve([])), [load]);
  const categoriesQ = useFetch(() => (load ? categoryService.list() : Promise.resolve([])), [load]);
  const brandsQ = useFetch(() => (load ? brandService.list() : Promise.resolve([])), [load]);
  const requestsQ = useFetch(() => (load ? brandRequestService.list() : Promise.resolve([])), [load]);

  const stores = useMemo(() => storesQ.data ?? [], [storesQ.data]);
  const mappedIds = useMemo(() => new Set(stores.flatMap(s => s.categoryIds)), [stores]);
  const categoryOptions = useMemo(() => childCategoryOptions(categoriesQ.data ?? []).filter(o => mappedIds.has(o.value)), [categoriesQ.data, mappedIds]);
  const brands = useMemo(() => (brandsQ.data ?? []).filter(b => b.status === 1), [brandsQ.data]);

  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [brandMode, setBrandMode] = useState<'existing' | 'new'>('existing');
  const [brandId, setBrandId] = useState(initialBrandId);
  const [newBrandTitle, setNewBrandTitle] = useState('');
  const [pickedStores, setPickedStores] = useState<string[] | null>(null);
  const [salesChannels, setSalesChannels] = useState<string[]>((existing?.salesChannels as string[]) ?? []);
  const [isBrandOwner, setIsBrandOwner] = useState<boolean | null>((existing?.isBrandOwner as boolean | null) ?? null);
  const [applicationNumber, setApplicationNumber] = useState(String(existing?.registeredApplicationNumber ?? ''));
  const [registeredClass, setRegisteredClass] = useState(String(existing?.registeredClass ?? ''));
  const [registeredDate, setRegisteredDate] = useState(existing?.registeredApplicationDate ? String(existing.registeredApplicationDate).slice(0, 10) : '');
  const [files, setFiles] = useState(NO_FILES);
  const [submitting, setSubmitting] = useState(false);

  // Only brands offered in the category (Categorywise Brands).
  const linked = useFetch(() => (load && categoryId ? categorywiseBrands(categoryId) : Promise.resolve([])), [load, categoryId]);
  const linkedIds = useMemo(() => new Set((linked.data ?? []).filter(m => m.status === 1).map(m => String(m.brandId))), [linked.data]);
  const brandOptions = useMemo(
    () => brands.filter(b => linkedIds.has(b.id)).sort((a, b) => String(a.title).localeCompare(String(b.title))).map(b => ({ value: b.id, label: String(b.title) })),
    [brands, linkedIds],
  );
  const selectedBrand = linkedIds.has(brandId) ? brands.find(b => b.id === brandId) : undefined;
  const isNewBrand = isResubmit ? !!existing?.isNewBrand : brandMode === 'new';
  const brandLogoUrl = isNewBrand ? undefined : isResubmit ? fileUrl(existing?.brand as Row, 'logoImageFile') : fileUrl(selectedBrand, 'logoImageFile');

  // Stores that already have a request for this brand in this category.
  const taken = useMemo(() => {
    const map = new Map<string, number>();
    if (brandMode !== 'existing' || !brandId || !categoryId) return map;
    (requestsQ.data ?? []).filter(r => r.brandId === brandId && r.categoryId === categoryId).forEach(r => map.set(String(r.storeId), r.status as number));
    return map;
  }, [requestsQ.data, brandMode, brandId, categoryId]);
  const eligible = useMemo(() => new Set(stores.filter(s => s.categoryIds.includes(categoryId)).map(s => s.id)), [stores, categoryId]);
  const defaultStores = useMemo(() => {
    const candidates = stores.filter(s => eligible.has(s.id));
    const preferred = candidates.find(s => s.id === current?.id) ?? (candidates.length === 1 ? candidates[0] : undefined);
    return preferred ? [preferred.id] : [];
  }, [stores, eligible, current?.id]);
  const storeIds = (pickedStores ?? defaultStores).filter(sid => eligible.has(sid) && !taken.has(sid));
  const toggleStore = (sid: string) => setPickedStores(cur => {
    const base = cur ?? defaultStores;
    return base.includes(sid) ? base.filter(x => x !== sid) : [...base, sid];
  });

  const checklist = brandChecklist({
    isResubmit,
    categoryId,
    brandMode,
    hasBrand: !!selectedBrand,
    newBrandTitle,
    storeCount: storeIds.length,
    salesChannels,
    isBrandOwner,
    applicationNumber,
    registeredClass,
    registeredDate,
    hasDocument: !!(files.registeredDocument || existing?.registeredDocumentFileId),
    hasLogo: !!(files.logo || brandLogoUrl || existing?.logoFileId),
  });
  const ready = checklist.every(c => c.done);

  async function submit() {
    setSubmitting(true);
    try {
      const uploaded: Partial<Record<DocKey, string>> = {};
      for (const key of Object.keys(files) as DocKey[]) {
        const file = files[key];
        if (!file) continue;
        const up = await fileService.upload(file, 'brand-approvals', { documentType: `brand-approval-${key}` });
        uploaded[key] = String(up.id);
      }
      const details = {
        salesChannels,
        isBrandOwner,
        registeredApplicationNumber: applicationNumber.trim() || undefined,
        registeredClass: registeredClass.trim() || undefined,
        registeredApplicationDate: registeredDate ? new Date(`${registeredDate}T00:00:00`).toISOString() : undefined,
        mrpTag1FileId: uploaded.mrpTag1,
        mrpTag2FileId: uploaded.mrpTag2,
        logoFileId: uploaded.logo,
        registeredDocumentFileId: uploaded.registeredDocument,
      };
      if (existing) {
        await brandRequestService.resubmit(existing.id, details);
        toast(tr('catalog.requestResubmittedForReview'));
        setFiles(NO_FILES);
        return onDone();
      }
      const created = await brandRequestService.create({ categoryId, storeIds, ...(brandMode === 'existing' ? { brandId } : { newBrandTitle: newBrandTitle.trim() }), ...details });
      toast(created.length > 1 ? tr('catalog.requestedForCreatedcountStores', { createdCount: created.length }) : tr('catalog.brandApprovalRequested'));
      onDone(created);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  let step = 0;
  return (
    <View style={styles.wrap}>
      {!isResubmit ? (
        <>
          <Step n={++step} title={tr('catalog.brandAndCategory')} subtitle={tr('catalog.theChildCategoryYouLlList')}>
            <SelectField
              label={tr('common.childCategory')}
              required
              value={categoryId}
              options={categoryOptions}
              onChange={v => {
                setCategoryId(v);
                setPickedStores(null);
              }}
              hint={tr('catalog.onlyCategoriesMappedToYourStores')}
              placeholder={storesQ.loading ? tr('catalog.loadingYourCategories') : tr('catalog.selectAChildCategory')}
              emptyText={tr('catalog.noCategoriesAreMappedToYour')}
            />
            <Choice checked={brandMode === 'existing'} onPress={() => setBrandMode('existing')} title={tr('catalog.aListedBrand')} body={tr('catalog.oneOfTheBrandsOfferedIn')} />
            <Choice checked={brandMode === 'new'} onPress={() => setBrandMode('new')} title={tr('catalog.aBrandThatIsnTListed')} body={tr('catalog.itsAddedOnceVeiloscanApprovesYour')} />
            {brandMode === 'existing' ? (
              <>
                <SelectField
                  label={tr('common.brand')}
                  required
                  value={selectedBrand ? brandId : ''}
                  options={brandOptions}
                  onChange={setBrandId}
                  disabled={!categoryId}
                  placeholder={!categoryId ? tr('catalog.selectAChildCategoryFirst') : linked.loading ? tr('catalog.loadingBrands') : tr('catalog.selectABrand')}
                  emptyText={tr('catalog.notListedChooseABrandThat')}
                  hint={tr('catalog.onlyBrandsOfferedInThisCategory')}
                />
                {categoryId && !linked.loading && !brandOptions.length ? (
                  <Pressable accessibilityRole="button" onPress={() => setBrandMode('new')}>
                    <Text style={styles.warnText}>{tr('catalog.noBrandsAreOfferedInThis')}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Field label={tr('catalog.brandName')} required>
                <Input value={newBrandTitle} onChangeText={setNewBrandTitle} placeholder={tr('catalog.asPrintedOnTheProductAnd')} maxLength={150} accessibilityLabel={tr('catalog.brandName')} />
              </Field>
            )}
          </Step>

          <Step n={++step} title={tr('common.stores')} subtitle={tr('catalog.approvalIsGivenPerStorePick')}>
            {storesQ.loading ? (
              <Text style={opsStyles.muted}>{tr('catalog.loadingYourStores')}</Text>
            ) : !categoryId ? (
              <Text style={[opsStyles.muted, styles.dashed]}>{tr('catalog.pickAChildCategoryFirstOnly')}</Text>
            ) : (
              stores.map(s => {
                const t = taken.get(s.id);
                const unavailable = !eligible.has(s.id) ? tr('catalog.categoryNotMappedToThisStore') : t !== undefined ? tr('catalog.alreadyRequestedLabel', { label: BRAND_STATUS_LABEL[t]?.label }) : null;
                return unavailable ? (
                  <View key={s.id} style={[styles.choice, styles.unavailable]}>
                    <StoreIcon size={16} color={colors.textMuted} />
                    <View style={styles.flex}>
                      <Text style={[opsStyles.title, styles.mutedTitle]}>{s.name}</Text>
                      <Text style={opsStyles.muted}>{unavailable}</Text>
                    </View>
                  </View>
                ) : (
                  <Choice key={s.id} type="checkbox" checked={storeIds.includes(s.id)} onPress={() => toggleStore(s.id)} title={s.name} body={s.code || undefined} />
                );
              })
            )}
          </Step>
        </>
      ) : null}

      <Step n={++step} title={tr('catalog.distributionAndOwnership')} subtitle={tr('catalog.whereTheBrandsProductsAreSold')}>
        <Text style={styles.label}>{tr('catalog.soldTodayThrough')}</Text>
        {SALES_CHANNELS.map(c => (
          <Choice key={c.value} type="checkbox" checked={salesChannels.includes(c.value)} onPress={() => setSalesChannels(cur => toggleChannel(cur, c.value))} title={c.label} />
        ))}
        <Text style={styles.label}>{tr('catalog.areYouTheBrandOwner')}</Text>
        <Choice checked={isBrandOwner === true} onPress={() => setIsBrandOwner(true)} title={tr('catalog.yesIOwnIt')} body={tr('catalog.aTrademarkIsAppliedForOr')} />
        <Choice checked={isBrandOwner === false} onPress={() => setIsBrandOwner(false)} title={tr('catalog.noIResellIt')} body={tr('catalog.iMAnAuthorisedDistributorOr')} />
      </Step>

      {isBrandOwner ? (
        <Step n={++step} title={tr('catalog.trademarkDetails')} subtitle={tr('catalog.fromYourTrademarkApplicationOrRegistration')}>
          <Field label={tr('catalog.applicationNumber')} required>
            <Input value={applicationNumber} onChangeText={setApplicationNumber} placeholder="e.g. 3143253" maxLength={50} accessibilityLabel={tr('catalog.applicationNumber')} />
          </Field>
          <Field label={tr('catalog.class')} required>
            <Input value={registeredClass} onChangeText={setRegisteredClass} placeholder="e.g. 25" maxLength={20} accessibilityLabel={tr('catalog.class')} />
          </Field>
          <DateField label={tr('catalog.applicationDate')} required value={registeredDate} onChange={setRegisteredDate} maximumDate={new Date()} />
        </Step>
      ) : null}

      <Step n={++step} title={tr('common.documents')} subtitle={tr('catalog.proofThatYouMaySellThe')}>
        <UploadBox
          title={tr('catalog.registeredDocument')}
          required
          file={files.registeredDocument}
          currentUrl={fileUrl(existing, 'registeredDocumentFile')}
          onFile={f => setFiles(s => ({ ...s, registeredDocument: f }))}
          onRemove={() => setFiles(s => ({ ...s, registeredDocument: null }))}
        />
        <Text style={[opsStyles.muted, styles.tight]}>{tr('catalog.trademarkCertificateRegisteredOrAppliedOr')}</Text>
        {brandLogoUrl ? (
          <View style={styles.upload}>
            <Image source={{ uri: brandLogoUrl }} style={styles.uploadThumb} resizeMode="contain" />
            <Text style={[opsStyles.muted, styles.flex]}>{tr('catalog.theBrandsOwnLogoIsUsed')}</Text>
          </View>
        ) : (
          <UploadBox title={tr('catalog.brandLogo')} required={isNewBrand} file={files.logo} currentUrl={fileUrl(existing, 'logoFile')} onFile={f => setFiles(s => ({ ...s, logo: f }))} onRemove={() => setFiles(s => ({ ...s, logo: null }))} />
        )}
        <UploadBox title={tr('catalog.mrpTag1')} file={files.mrpTag1} currentUrl={fileUrl(existing, 'mrpTag1File')} onFile={f => setFiles(s => ({ ...s, mrpTag1: f }))} onRemove={() => setFiles(s => ({ ...s, mrpTag1: null }))} />
        <UploadBox title={tr('catalog.mrpTag2')} file={files.mrpTag2} currentUrl={fileUrl(existing, 'mrpTag2File')} onFile={f => setFiles(s => ({ ...s, mrpTag2: f }))} onRemove={() => setFiles(s => ({ ...s, mrpTag2: null }))} />
        <Text style={opsStyles.muted}>{tr('catalog.filesAreOnlySharedWithVeiloscan')}</Text>
      </Step>

      <View style={styles.checklist}>
        <Text style={opsStyles.title}>{isResubmit ? tr('catalog.readyToResubmit') : tr('catalog.yourRequest')}</Text>
        {!isResubmit && (selectedBrand || newBrandTitle.trim()) ? (
          <Text style={opsStyles.meta}>{`${brandMode === 'existing' ? String(selectedBrand?.title ?? '') : newBrandTitle.trim()} · ${categoryOptions.find(o => o.value === categoryId)?.label ?? 'No category yet'}`}</Text>
        ) : null}
        <View style={styles.checks}>
          {checklist.map(c => (
            <View key={c.label} style={styles.check}>
              {c.done ? <CheckCircleIcon size={15} color={colors.success} /> : <View style={styles.open} />}
              <Text style={c.done ? opsStyles.meta : opsStyles.muted}>{c.label}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || submitting }}
          disabled={!ready || submitting}
          onPress={submit}
          style={[opsStyles.primaryBtn, styles.submit, (!ready || submitting) && styles.disabled]}
        >
          <Text style={opsStyles.primaryBtnText}>{submitting ? tr('common.sending') : isResubmit ? tr('catalog.resubmitForReview') : storeIds.length > 1 ? tr('catalog.requestForStoreidscountStores', { storeIdsCount: storeIds.length }) : tr('catalog.submitRequest')}</Text>
        </Pressable>
        {onCancel ? (
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
            <Text style={opsStyles.smallBtnText}>{tr('common.cancel')}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.next}>
        <Text style={opsStyles.title}>{tr('catalog.whatHappensNext')}</Text>
        <Text style={opsStyles.meta}>{tr('catalog.n1VeiloscanChecksYourDocumentsUsually')}</Text>
        <Text style={opsStyles.meta}>{tr('catalog.n2YouGetANotificationAnd')}</Text>
        <Text style={opsStyles.meta}>{tr('catalog.n3OnceApprovedTheBrandAppears')}</Text>
      </View>
      {isNewBrand && !isResubmit ? (
        <View style={styles.warn}>
          <AlertCircleIcon size={15} color={colors.warningDark} />
          <Text style={[styles.warnText, styles.flex]}>{tr('catalog.newBrandsAreCheckedMoreClosely')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  tight: { marginTop: -8 },
  wrap: { gap: 12 },
  label: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.5, color: colors.textSecondary },
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  choiceOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  unavailable: { borderStyle: 'dashed', backgroundColor: colors.background },
  mutedTitle: { color: colors.textMuted },
  mark: { width: 18, height: 18, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  round: { borderRadius: 9 },
  square: { borderRadius: 4 },
  markOn: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  dashed: { padding: 12, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, textAlign: 'center' },
  upload: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  uploadThumb: { width: 48, height: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.background },
  uploadActions: { alignItems: 'flex-end', gap: 6 },
  checklist: { gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  checks: { gap: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  open: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: colors.border },
  submit: { justifyContent: 'center', marginTop: 4 },
  disabled: { opacity: 0.5 },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  next: { gap: 4, padding: 14, borderRadius: radius.lg, backgroundColor: colors.background },
  warn: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  warnText: { fontFamily: fonts.medium, fontSize: 12, color: colors.warningDark },
});
