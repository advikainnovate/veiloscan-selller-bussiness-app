import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View, type ScrollViewInstance } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { pickImages } from '../../lib/pick-image';
import {
  addressLines,
  BACKEND_REVIEW_STEP,
  BUSINESS_TYPES,
  CATEGORY_OPTIONS,
  compact,
  contactFromRecord,
  contactProblem,
  countWords,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  DEFAULT_BRANDING_REQUIREMENTS,
  DEFAULT_DOCUMENT_REQUIREMENTS,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN_WORDS,
  descriptionHtml,
  brandingHint,
  DOCUMENT_TYPES,
  gstFromRecord,
  gstPayload,
  gstProblem,
  hoursProblem,
  labelFor,
  missingBranding,
  missingDocuments,
  NEW_STORE_INITIAL,
  newStoreFromRecord,
  newStoreProblem,
  plainText,
  requiredDocuments,
  TIMEZONES,
  VERIFICATION,
  WEEK_DAYS,
  WIZARD_STEPS,
  wizardHours,
  wizardStepFor,
  DEFAULT_HOURS,
  type ContactForm,
  type GstForm,
  type HourRow,
  type NewStoreForm,
} from '../../lib/store-manage';
import { fileService } from '../../services/products-service';
import { storeManageService, type OnboardingProgress, type Rec } from '../../services/store-manage-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Field, Input, SelectField } from '../../components/form/Fields';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, Detail, opsStyles } from '../../components/operations/OpsParts';
import { ContactFields, ErrorLine, GstFields, HoursEditor, ImagePickRow, SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, EditIcon, FileTextIcon, ImageIcon, PlusIcon, RefreshIcon, SettingsIcon, StoreIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

type Busy = 'next' | 'draft' | 'review' | null;
interface Img {
  id: string;
  url: string;
}
const imageFrom = (file: unknown): Img | null => {
  const r = file as Rec | null | undefined;
  return r?.id && r.url ? { id: String(r.id), url: String(r.url) } : null;
};

const NEXT_STEPS = [
  'Your store will be submitted for review.',
  'Our team will verify the details (if required).',
  'The owner will receive an email once approved.',
  'After approval, you can configure domain, products and other settings.',
];
const NOTES = [
  'Required documents depend on the With GST / Without GST choice.',
  'Every uploaded document is verified before approval.',
  'The store will be reviewed before activation.',
  'You can edit any section before submitting.',
];

/**
 * Add New Store, as the panel's onboarding wizard: four screens over the
 * backend's six steps. The draft store is created when Business Details is
 * first saved; every later screen saves to it, and Continue Onboarding
 * resumes it. stores:create to start, stores:edit to continue.
 */
export function CreateStoreScreen({ navigation, route }: ScreenProps<'CreateStore'>) {
  const { t } = useTranslation();
  const { hasPermission, user } = useAuth();
  const { refresh } = useStore();
  const toast = useToast();
  const resumeId = route.params?.storeId;
  const allowed = resumeId ? hasPermission('stores:edit') : hasPermission('stores:create');

  const loaded = useFetch(() => (allowed && resumeId ? storeManageService.getOnboarding(resumeId) : Promise.resolve(null)), [allowed, resumeId]);
  const docRules = useFetch(() => storeManageService.documentRequirements().catch(() => DEFAULT_DOCUMENT_REQUIREMENTS), []);
  const brandRules = useFetch(() => storeManageService.brandingRequirements().catch(() => DEFAULT_BRANDING_REQUIREMENTS), []);
  const documentRules = docRules.data?.length ? docRules.data : DEFAULT_DOCUMENT_REQUIREMENTS;
  const brandingRules = brandRules.data?.length ? brandRules.data : DEFAULT_BRANDING_REQUIREMENTS;

  // Every save returns fresh progress; it wins over the first load.
  const [saved, setSaved] = useState<OnboardingProgress | null>(null);
  const progress = saved ?? loaded.data ?? null;
  const store = progress?.store ?? null;

  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState<NewStoreForm>(NEW_STORE_INITIAL);
  const [contact, setContact] = useState<ContactForm>(() => contactFromRecord(null));
  const [hours, setHours] = useState<HourRow[]>(DEFAULT_HOURS);
  const [toggles, setToggles] = useState({ acceptOrders: true, onlinePaymentEnabled: true, guestCheckoutEnabled: true });
  const [logo, setLogo] = useState<Img | null>(null);
  const [banner, setBanner] = useState<Img | null>(null);
  const [gst, setGst] = useState<GstForm>(() => gstFromRecord(null));
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  // The description as loaded: unchanged, the saved formatting is kept.
  const seededDescription = useRef<{ text: string; html: string } | null>(null);

  // Fill the forms once from the draft being resumed.
  useEffect(() => {
    const s = loaded.data?.store;
    if (!s) return;
    const form = newStoreFromRecord(s);
    setBusiness(form);
    seededDescription.current = { text: form.description, html: s.description ?? '' };
    setContact(contactFromRecord(s.settings));
    setHours(wizardHours(s.businessHours));
    setToggles({
      acceptOrders: s.config?.acceptOrders !== false,
      onlinePaymentEnabled: s.config?.onlinePaymentEnabled !== false,
      guestCheckoutEnabled: s.config?.guestCheckoutEnabled !== false,
    });
    setLogo(imageFrom(s.branding?.logo));
    setBanner(imageFrom(s.branding?.banner));
    setGst(gstFromRecord(s.taxDetails));
    setStep(wizardStepFor(Number(s.onboardingStep) || 1));
  }, [loaded.data]);

  const title = t('common.addNewStore');
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={title} icon={StoreIcon} allowed={false} />
      </View>
    );
  }
  if (resumeId && loaded.loading && !loaded.data) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ListSkeleton />
      </View>
    );
  }
  if (resumeId && !store) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ErrorState message={loaded.error || t('store.storeNotFound')} onRetry={loaded.reload} />
      </View>
    );
  }

  if (store?.onboardingStatus === 'COMPLETED') {
    const approved = store.approvalStatus === 'APPROVED';
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <View style={[styles.done, approved ? styles.doneOk : styles.doneWait]}>
          <View style={[styles.doneIcon, { backgroundColor: approved ? colors.success : colors.warning }]}>
            {approved ? <CheckCircleIcon size={24} color={colors.white} /> : <ClockIcon size={24} color={colors.white} />}
          </View>
          <Text style={styles.doneTitle}>{approved ? t('store.thisStoreHasBeenApprovedAnd') : t('store.submittedWaitingForApproval')}</Text>
          {!approved ? (
            <Text style={styles.doneText}>
              {store.submittedAt ? t('store.reviewingDetailsSubmittedOn', { date: formatDay(store.submittedAt) }) : t('store.reviewingDetails')}
            </Text>
          ) : null}
          <Button title={t('store.openStore')} onPress={() => navigation.replace('StoreSettings', { storeId: store.id })} />
        </View>
      </View>
    );
  }

  const owner = store?.owner ?? (user as Rec | null) ?? {};
  const ownerInfo = {
    name: [owner.firstName, owner.lastName].filter(Boolean).join(' '),
    email: String(owner.email ?? ''),
    phone: [owner.countryCode, owner.phoneNumber].filter(Boolean).join(' '),
  };
  const backendStep = Number(store?.onboardingStep) || 1;
  const hasSettings = !!store?.settings;
  const documents = store?.documents ?? [];
  const gstTouched = !!store?.taxDetails || documents.length > 0;
  const furthest = store ? Math.max(wizardStepFor(backendStep), step) : 1;
  const resubmission = store?.approvalStatus === 'REJECTED';
  // The saved GST choice (null before GST & Documents); on that step the one being picked counts.
  const gstChoice = store?.taxDetails ? gst.gstRegistered : null;
  const liveGst = step >= 3 ? gst.gstRegistered : gstChoice;
  const missingImages = missingBranding(brandingRules, liveGst, { logo, banner });

  function goTo(to: number) {
    setError('');
    setStep(to);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  async function run(action: Busy, fn: () => Promise<void>) {
    setError('');
    setBusy(action);
    try {
      await fn();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  const fail = (message: string | null) => {
    if (message) throw new Error(message);
  };

  const description = () => (seededDescription.current && business.description === seededDescription.current.text ? seededDescription.current.html : descriptionHtml(business.description));

  /** Saves Business Details, creating the draft the first time. */
  async function saveBusiness(): Promise<string> {
    fail(newStoreProblem(business));
    const details = { name: business.name.trim(), description: description(), timezone: business.timezone, currency: business.currency };
    if (!store) {
      const started = await storeManageService.startOnboarding({
        name: details.name,
        businessType: business.businessType,
        businessCategory: business.businessCategory,
        description: details.description,
      });
      const id = started.store.id;
      setSaved(await storeManageService.saveStoreDetails(id, details));
      seededDescription.current = { text: business.description, html: details.description };
      toast(t('store.draftStoreCreated'));
      // The switcher lists it from now on.
      refresh();
      return id;
    }
    await storeManageService.saveBusinessDetails(store.id, { businessType: business.businessType, businessCategory: business.businessCategory });
    setSaved(await storeManageService.saveStoreDetails(store.id, details));
    return store.id;
  }

  async function saveSetup(id: string) {
    fail(contactProblem(contact));
    fail(hoursProblem(hours));
    if (!!contact.latitude.trim() !== !!contact.longitude.trim()) fail(t('store.enterBothLatitudeAndLongitudeOr'));
    // Hours, config and branding aren't onboarding steps; the address goes last so its progress counts them all.
    await Promise.all([
      storeManageService.updateBusinessHours(
        id,
        hours.map(h => ({ dayOfWeek: h.dayOfWeek, isOpen: h.isOpen, ...(h.isOpen ? { openTime: h.openTime, closeTime: h.closeTime } : {}) })),
      ),
      storeManageService.updateConfig(id, { ...toggles, currencySymbol: CURRENCY_SYMBOLS[business.currency] ?? undefined }),
      storeManageService.updateBranding(id, { logoId: logo?.id ?? null, bannerId: banner?.id ?? null }),
    ]);
    const { openingTime: _o, closingTime: _c, ...address } = contact;
    setSaved(await storeManageService.saveAddressContact(id, compact(address)));
  }

  function next() {
    return run('next', async () => {
      if (step === 1) {
        await saveBusiness();
        return goTo(2);
      }
      const id = store!.id;
      if (step === 2) {
        await saveSetup(id);
        if (missingImages.length) fail(t(gstChoice === null ? 'store.addImagesEveryStore' : gstChoice ? 'store.addImagesWithGst' : 'store.addImagesWithoutGst', { images: missingImages.join(t('store.andJoiner')) }));
        return goTo(3);
      }
      if (step === 3) {
        const missing = missingDocuments(gst.gstRegistered, documents, documentRules);
        if (missing.length) fail(t('store.uploadTheRequiredDocumentsJoin', { join: missing.join(', ') }));
        fail(gstProblem(gst));
        await storeManageService.saveGstDetails(id, gstPayload(gst));
        setSaved(await storeManageService.setOnboardingStep(id, BACKEND_REVIEW_STEP));
        if (missingImages.length) fail(t(gst.gstRegistered ? 'store.gstStoresNeedImages' : 'store.nonGstStoresNeedImages', { images: missingImages.join(t('store.andJoiner')).toLowerCase() }));
        return goTo(4);
      }
      if (!terms) fail(t('store.pleaseAcceptTheTermsAndConditions'));
      // Submitted stores stay drafts until approved.
      await storeManageService.completeOnboarding(id);
      toast(resubmission ? t('store.storeResubmittedForApproval') : t('store.storeSubmittedForApproval'));
      await refresh();
      navigation.replace('StoreSettings', { storeId: id });
    });
  }

  function saveDraft() {
    return run('draft', async () => {
      if (step === 1) await saveBusiness();
      toast(t('store.draftSaved'));
      navigation.goBack();
    });
  }

  function jumpToReview() {
    return run('review', async () => {
      const id = await saveBusiness();
      setSaved(await storeManageService.setOnboardingStep(id, BACKEND_REVIEW_STEP));
      goTo(4);
    });
  }

  async function cancel() {
    if (!store && (business.name || business.description) && !(await confirmAction(t('store.discardThisStore'), t('store.nothingHasBeenSavedYet'), t('common.discard'), true))) return;
    navigation.goBack();
  }

  const completed = (s: number) => (s === 1 ? !!store : s === 2 ? hasSettings : s === 3 ? backendStep >= BACKEND_REVIEW_STEP || gstTouched : false);
  const reachable = (s: number) => s === 1 || (!!store && s <= furthest && (s < 3 || hasSettings));
  const nextLabel = step === 4 ? (resubmission ? t('store.resubmitForApproval') : t('store.submitForApproval')) : t('common.nextLabel', { label: WIZARD_STEPS[step].label });

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={title} subtitle={store?.name || t('common.stores')} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={opsStyles.content} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>
          {step === 4
            ? t('store.reviewYourInformationBeforeSubmittingYou')
            : t('store.registerANewStoreOnThe')}
        </Text>

        {resubmission ? (
          <View style={styles.rejected}>
            <AlertCircleIcon size={18} color={colors.error} />
            <View style={styles.flex}>
              <Text style={styles.rejectedTitle}>{store?.reviewedAt ? t('store.changesRequestedOn', { date: formatDay(store.reviewedAt) }) : t('store.changesRequested')}</Text>
              <Text style={styles.rejectedText}>{store?.rejectionReason}</Text>
              <Text style={styles.rejectedHint}>{t('store.updateTheSectionsBelowThenResubmit')}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.stepper}>
          {WIZARD_STEPS.map(s => {
            const on = s.step === step;
            const done = completed(s.step);
            const can = reachable(s.step);
            return (
              <Pressable
                key={s.step}
                accessibilityRole="tab"
                accessibilityState={{ selected: on, disabled: !can }}
                accessibilityLabel={t('store.stepStepLabel', { step: s.step, label: s.label })}
                disabled={!can || busy !== null}
                onPress={() => goTo(s.step)}
                style={styles.stepItem}
              >
                <View style={[styles.stepDot, done && styles.stepDone, on && styles.stepOn]}>
                  {done && !on ? <CheckCircleIcon size={14} color={colors.white} /> : <Text style={[styles.stepNum, (on || done) && styles.white]}>{s.step}</Text>}
                </View>
                <Text style={[styles.stepLabel, on && styles.stepLabelOn, !can && styles.stepLabelOff]} numberOfLines={2}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {(step === 3 || step === 4) && store && (step === 4 ? progress?.missingBranding ?? missingImages : missingImages).length ? (
          <Pressable accessibilityRole="button" onPress={() => goTo(2)} style={styles.notice}>
            <AlertCircleIcon size={16} color={colors.warningDark} />
            <Text style={styles.noticeText}>
              {t(liveGst ? 'store.gstStoresNeedImagesTap' : 'store.nonGstStoresNeedImagesTap', { images: (step === 4 ? progress?.missingBranding ?? missingImages : missingImages).join(t('store.andJoiner')).toLowerCase() })}
            </Text>
          </Pressable>
        ) : null}

        {step === 1 ? <BusinessStep value={business} onChange={setBusiness} owner={ownerInfo} /> : null}
        {step === 2 && store ? (
          <SetupStep
            storeId={store.id}
            contact={contact}
            setContact={setContact}
            hours={hours}
            setHours={setHours}
            toggles={toggles}
            setToggles={setToggles}
            logo={logo}
            setLogo={setLogo}
            banner={banner}
            setBanner={setBanner}
            logoHint={brandingHint(brandingRules.find(r => r.key === 'STORE_LOGO'), gstChoice)}
            bannerHint={brandingHint(brandingRules.find(r => r.key === 'STORE_BANNER'), gstChoice)}
          />
        ) : null}
        {step === 3 && store ? (
          <GstStep
            storeId={store.id}
            gst={gst}
            setGst={setGst}
            documents={documents}
            rules={documentRules}
            onProgress={setSaved}
            reload={async () => setSaved(await storeManageService.getOnboarding(store.id))}
          />
        ) : null}
        {step === 4 && store ? <ReviewStep progress={progress!} owner={ownerInfo} onEdit={goTo} terms={terms} setTerms={setTerms} gstTouched={gstTouched} /> : null}

        {error ? <ErrorLine message={error} /> : null}

        {step === 1 ? (
          <View style={styles.actions}>
            <Button title={t('store.saveAsDraft')} variant="ghost" onPress={saveDraft} loading={busy === 'draft'} disabled={busy !== null} style={styles.ghost} />
            {hasSettings ? <Button title={t('store.reviewAndSubmit')} variant="ghost" onPress={jumpToReview} loading={busy === 'review'} disabled={busy !== null} style={styles.ghost} /> : null}
          </View>
        ) : null}
        {step === 4 ? <Button title={t('store.saveAsDraft')} variant="ghost" onPress={saveDraft} loading={busy === 'draft'} disabled={busy !== null} style={styles.ghost} /> : null}
        <Button title={nextLabel} onPress={next} loading={busy === 'next'} disabled={busy !== null || (step === 4 && (!terms || !progress?.canComplete))} />
        <Button title={step === 1 ? t('common.cancel') : t('store.previous')} variant="ghost" onPress={step === 1 ? cancel : () => goTo(step - 1)} disabled={busy !== null} style={styles.ghost} />
      </ScrollView>
    </View>
  );
}

// ── 1 · Business details ─────────────────────────────────────────────────

function BusinessStep({ value, onChange, owner }: { value: NewStoreForm; onChange: (v: NewStoreForm) => void; owner: { name: string; email: string; phone: string } }) {
  const { t } = useTranslation();
  const set = <K extends keyof NewStoreForm>(k: K, v: NewStoreForm[K]) => onChange({ ...value, [k]: v });
  const words = countWords(value.description);
  const chars = plainText(value.description).length;
  return (
    <SectionCard icon={StoreIcon} title={t('store.businessDetails')} subtitle={t('store.enterTheBasicInformationAboutThe')}>
      <Field label={t('store.storeName')} required hint={t('store.thisWillBeVisibleToCustomers')}>
        <Input value={value.name} onChangeText={v => set('name', v)} placeholder={t('store.freshBasket')} maxLength={150} accessibilityLabel={t('store.storeName')} />
      </Field>
      <SelectField label={t('store.businessType')} required value={value.businessType} options={BUSINESS_TYPES} onChange={v => set('businessType', v)} placeholder={t('store.selectBusinessType')} />
      <SelectField label={t('store.businessCategory')} required value={value.businessCategory} options={CATEGORY_OPTIONS} onChange={v => set('businessCategory', v)} placeholder={t('store.selectCategory')} />
      <Field label={t('common.description')} required hint={t('store.whatYouSellWhatMakesThe')}>
        <Input
          value={value.description}
          onChangeText={v => set('description', v)}
          placeholder={t('store.tellUsAboutTheStore')}
          multiline
          maxLength={DESCRIPTION_MAX + 200}
          style={styles.textArea}
          accessibilityLabel={t('common.description')}
        />
      </Field>
      <Text style={[styles.counter, words >= DESCRIPTION_MIN_WORDS ? opsStyles.success : null, chars > DESCRIPTION_MAX ? opsStyles.danger : null]}>
        {t('store.wordsDescriptionMinWordsWordsChars', { words, DESCRIPTION_MIN_WORDS, chars, DESCRIPTION_MAX })}
      </Text>
      <Detail label={t('store.ownerName')} value={owner.name} />
      <Detail label={t('store.ownerEmail')} value={owner.email} />
      <Detail label={t('store.ownerPhone')} value={owner.phone} />
      <Text style={opsStyles.muted}>{t('store.filledFromTheOwnerAccount')}</Text>
      <SelectField label={t('common.timezone')} required value={value.timezone} options={TIMEZONES} onChange={v => set('timezone', v)} />
      <SelectField label={t('store.currency')} required value={value.currency} options={CURRENCIES} onChange={v => set('currency', v)} />
    </SectionCard>
  );
}

// ── 2 · Store setup ──────────────────────────────────────────────────────

function SetupStep(p: {
  storeId: string;
  contact: ContactForm;
  setContact: React.Dispatch<React.SetStateAction<ContactForm>>;
  hours: HourRow[];
  setHours: React.Dispatch<React.SetStateAction<HourRow[]>>;
  toggles: { acceptOrders: boolean; onlinePaymentEnabled: boolean; guestCheckoutEnabled: boolean };
  setToggles: React.Dispatch<React.SetStateAction<{ acceptOrders: boolean; onlinePaymentEnabled: boolean; guestCheckoutEnabled: boolean }>>;
  logo: Img | null;
  setLogo: (v: Img | null) => void;
  banner: Img | null;
  setBanner: (v: Img | null) => void;
  logoHint?: string;
  bannerHint?: string;
}) {
  const { t: tr } = useTranslation();
  const toggles: { key: keyof typeof p.toggles; label: string }[] = [
    { key: 'acceptOrders', label: tr('store.acceptOrders') },
    { key: 'onlinePaymentEnabled', label: tr('store.onlinePayments') },
    { key: 'guestCheckoutEnabled', label: tr('store.guestCheckout') },
  ];
  return (
    <>
      <SectionCard icon={SettingsIcon} title={tr('store.storeSetup')} subtitle={tr('store.yourStoreAddressContactDetailsAnd')}>
        <ContactFields form={p.contact} setForm={p.setContact} withTimes={false} />
      </SectionCard>
      <SectionCard icon={ImageIcon} title={tr('store.storeImages')}>
        <ImagePickRow kind="logo" storeId={p.storeId} url={p.logo?.url ?? null} hint={p.logoHint} onUploaded={(id, url) => p.setLogo({ id, url })} onRemove={() => p.setLogo(null)} />
        <ImagePickRow kind="banner" storeId={p.storeId} url={p.banner?.url ?? null} hint={p.bannerHint} onUploaded={(id, url) => p.setBanner({ id, url })} onRemove={() => p.setBanner(null)} />
      </SectionCard>
      <SectionCard icon={ClockIcon} title={tr('store.businessHours')} subtitle={tr('store.openingAndClosingTimePerDay')}>
        <HoursEditor rows={p.hours} setRows={p.setHours} />
      </SectionCard>
      <SectionCard icon={SettingsIcon} title={tr('common.storeSettings')}>
        {toggles.map(t => (
          <View key={t.key} style={opsStyles.rowBetween}>
            <Text style={opsStyles.title}>{t.label}</Text>
            <Switch
              accessibilityLabel={t.label}
              value={p.toggles[t.key]}
              onValueChange={v => p.setToggles(x => ({ ...x, [t.key]: v }))}
              trackColor={{ true: colors.secondary, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
        ))}
      </SectionCard>
    </>
  );
}

// ── 3 · GST & documents ──────────────────────────────────────────────────

function GstStep({
  storeId,
  gst,
  setGst,
  documents,
  rules,
  onProgress,
  reload,
}: {
  storeId: string;
  gst: GstForm;
  setGst: React.Dispatch<React.SetStateAction<GstForm>>;
  documents: Rec[];
  rules: typeof DEFAULT_DOCUMENT_REQUIREMENTS;
  onProgress: (p: OnboardingProgress) => void;
  reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const [otherType, setOtherType] = useState('OTHER');
  const set = <K extends keyof GstForm>(k: K, v: GstForm[K]) => setGst(f => ({ ...f, [k]: v }));
  const required = requiredDocuments(gst.gstRegistered, rules);
  // Slots shown: what's required for this choice, then the optional ones (GST-only slots only with GST).
  const slots = [...required, ...rules.filter(r => !required.includes(r) && (!r.gstOnly || gst.gstRegistered))];
  const slotted = new Set(slots.flatMap(s => s.types));

  async function upload(documentType: string, replacing?: Rec) {
    try {
      const [file] = await pickImages({ multiple: false });
      if (!file) return;
      setUploading(replacing ? String(replacing.id) : documentType);
      const up = await fileService.upload(file, 'store-documents', { documentType, documentId: storeId });
      const payload = { fileId: up.id, fileName: file.name, mimeType: file.type || undefined };
      if (replacing) {
        await storeManageService.reuploadDocument(storeId, String(replacing.id), payload);
        await reload();
        toast(t('store.newFileUploadedSentBackFor'));
      } else {
        onProgress(await storeManageService.addOnboardingDocument(storeId, { documentType, ...payload }));
        toast(t('store.documentUploaded'));
      }
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setUploading(null);
    }
  }

  async function remove(doc: Rec) {
    if (!(await confirmAction(t('common.removeThisDocument'), undefined, t('common.remove'), true))) return;
    try {
      onProgress(await storeManageService.removeOnboardingDocument(storeId, String(doc.id)));
      toast(t('common.documentRemoved'));
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const docRow = (doc: Rec) => {
    const st = VERIFICATION[String(doc.verificationStatus)] ?? VERIFICATION.PENDING;
    return (
      <View key={String(doc.id)} style={styles.doc}>
        <View style={opsStyles.row}>
          <FileTextIcon size={15} color={colors.secondaryDark} />
          <Pressable accessibilityRole="link" disabled={!doc.fileUrl} onPress={() => Linking.openURL(String(doc.fileUrl))} style={styles.flex}>
            <Text style={styles.link} numberOfLines={1}>
              {(doc.fileName as string) || t('store.viewFile')}
            </Text>
          </Pressable>
          <Badge label={st.label} tone={st.tone} />
        </View>
        {doc.rejectionReason ? <Text style={[opsStyles.meta, opsStyles.danger]}>{t('store.rejectedRejectionreason', { rejectionReason: String(doc.rejectionReason) })}</Text> : null}
        <View style={opsStyles.row}>
          {doc.verificationStatus === 'REJECTED' ? (
            <Pressable accessibilityRole="button" disabled={!!uploading} onPress={() => upload(String(doc.documentType), doc)} style={opsStyles.smallBtn}>
              <RefreshIcon size={14} color={colors.text} />
              <Text style={opsStyles.smallBtnText}>{uploading === String(doc.id) ? t('common.uploading') : 'Re-upload'}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('store.removeLabelfor', { labelFor: labelFor(DOCUMENT_TYPES, doc.documentType) })} onPress={() => remove(doc)} style={opsStyles.smallBtn}>
            <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>{t('common.remove')}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <>
      <SectionCard icon={FileTextIcon} title={t('store.gstAndDocuments')} subtitle={t('store.chooseWhetherTheStoreRegistersWith')}>
        <GstFields form={gst} set={set} />
      </SectionCard>
      <SectionCard icon={FileTextIcon} title={t('store.businessDocuments')} subtitle={t('store.photosOfTheDocumentsEveryDocument')}>
        {slots.map(slot => {
          const docs = documents.filter(d => slot.types.includes(String(d.documentType)));
          const isRequired = required.includes(slot);
          return (
            <View key={slot.key} style={styles.slot}>
              <View style={opsStyles.rowBetween}>
                <Text style={opsStyles.title}>
                  {slot.label}
                  {isRequired ? <Text style={opsStyles.danger}> *</Text> : <Text style={opsStyles.muted}>{' '}{t('common.optional')}</Text>}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.uploadLabel', { label: slot.label })} disabled={!!uploading} onPress={() => upload(slot.types[0])} style={opsStyles.smallBtn}>
                  <PlusIcon size={14} color={colors.text} />
                  <Text style={opsStyles.smallBtnText}>{uploading === slot.types[0] ? t('common.uploading') : docs.length ? t('common.add') : t('common.upload')}</Text>
                </Pressable>
              </View>
              {docs.map(docRow)}
            </View>
          );
        })}
        {documents.filter(d => !slotted.has(String(d.documentType))).map(docRow)}
        <SelectField label={t('store.anotherDocument')} value={otherType} options={DOCUMENT_TYPES} onChange={setOtherType} />
        <Button title={t('store.uploadDocument')} variant="ghost" onPress={() => upload(otherType)} disabled={!!uploading} style={styles.ghost} />
        <Text style={opsStyles.muted}>{t('store.withGstGstCertificatePanCard')}</Text>
      </SectionCard>
    </>
  );
}

// ── 4 · Review & submit ──────────────────────────────────────────────────

function ReviewStep({
  progress,
  owner,
  onEdit,
  terms,
  setTerms,
  gstTouched,
}: {
  progress: OnboardingProgress;
  owner: { name: string; email: string; phone: string };
  onEdit: (step: number) => void;
  terms: boolean;
  setTerms: (v: boolean) => void;
  gstTouched: boolean;
}) {
  const { t } = useTranslation();
  const store = progress.store;
  const settings = store.settings ?? null;
  const tax = store.taxDetails ?? null;
  const hours = store.businessHours ?? [];
  const edit = (step: number) => (
    <Pressable accessibilityRole="button" accessibilityLabel={t('store.editLabel', { label: WIZARD_STEPS[step - 1].label })} hitSlop={6} onPress={() => onEdit(step)} style={styles.editLink}>
      <EditIcon size={15} color={colors.secondary} />
    </Pressable>
  );
  return (
    <>
      {progress.missingSteps.length || progress.missingDocuments?.length ? (
        <View style={styles.notice}>
          <AlertCircleIcon size={16} color={colors.warningDark} />
          <Text style={styles.noticeText}>
            {[
              progress.missingSteps.length ? t('store.stillToCompleteJoin', { join: progress.missingSteps.map(k => k.replace(/_/g, ' ').toLowerCase()).join(', ') }) : '',
              progress.missingDocuments?.length ? t('store.uploadJoin', { join: progress.missingDocuments.join(', ') }) : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
        </View>
      ) : null}
      <SectionCard icon={StoreIcon} title={t('store.businessDetails')} subtitle={t('store.basicInformationAboutYourStore')} action={edit(1)}>
        <Detail label={t('store.storeName')} value={store.name} />
        <Detail label={t('store.owner')} value={[owner.name, owner.email, owner.phone].filter(Boolean).join(' · ')} />
        <Detail label={t('store.businessType')} value={labelFor(BUSINESS_TYPES, store.businessType)} />
        <Detail label={t('store.businessCategory')} value={store.businessCategory} />
        <Detail label={t('common.timezone')} value={labelFor(TIMEZONES, store.timezone)} />
        <Detail label={t('store.currency')} value={labelFor(CURRENCIES, store.currency)} />
        <Detail label={t('common.description')} value={plainText(store.description)} />
      </SectionCard>
      <SectionCard icon={SettingsIcon} title={t('store.storeSetup')} subtitle={t('store.locationContactDetailsAndHours')} action={edit(2)}>
        {settings ? (
          <>
            <Detail label={t('store.storeEmail')} value={settings.email as string} />
            <Detail label={t('store.storePhone')} value={settings.phone as string} />
            {settings.alternatePhone ? <Detail label={t('store.alternatePhone')} value={settings.alternatePhone as string} /> : null}
            <Detail label={t('common.website')} value={settings.website as string} />
            <Detail label={t('common.address')} value={addressLines(settings).join('\n')} />
          </>
        ) : (
          <Text style={opsStyles.muted}>{t('store.notAddedYet')}</Text>
        )}
        {hours.length ? (
          <Detail
            label={t('store.businessHours')}
            value={WEEK_DAYS.map(d => {
              const h = hours.find(x => x.dayOfWeek === d.value);
              return `${d.label.slice(0, 3)}: ${h?.isOpen ? `${String(h.openTime).slice(0, 5)} – ${String(h.closeTime).slice(0, 5)}` : 'Closed'}`;
            }).join('\n')}
          />
        ) : null}
      </SectionCard>
      <SectionCard icon={FileTextIcon} title={t('store.gstAndDocuments')} subtitle={t('store.gstDetailsAndUploadedBusinessDocuments')} action={edit(3)}>
        <Detail label={t('store.gstRegistration')} value={tax ? (tax.gstRegistered ? 'Yes' : 'No') : 'Not chosen yet'} />
        {tax?.gstRegistered ? (
          <>
            <Detail label="GSTIN" value={tax.gstin as string} />
            <Detail label={t('store.businessName')} value={tax.legalBusinessName as string} />
            <Detail label={t('store.tradeName')} value={tax.tradeName as string} />
          </>
        ) : null}
        {(store.documents ?? []).length ? (
          (store.documents ?? []).map(d => (
            <View key={String(d.id)} style={opsStyles.rowBetween}>
              <Text style={opsStyles.title}>{labelFor(DOCUMENT_TYPES, d.documentType)}</Text>
              <Badge {...(VERIFICATION[String(d.verificationStatus)] ?? VERIFICATION.PENDING)} />
            </View>
          ))
        ) : (
          <Text style={opsStyles.muted}>{t('store.noDocumentsUploaded')}</Text>
        )}
      </SectionCard>
      <SectionCard icon={CheckCircleIcon} title={t('store.reviewAndSubmit')}>
        <View style={opsStyles.row}>
          <CheckCircleIcon size={16} color={gstTouched ? colors.success : colors.border} />
          <Text style={opsStyles.meta}>{gstTouched ? t('store.gstAndDocumentsCompleted') : t('store.gstAndDocumentsRequired')}</Text>
        </View>
        <Text style={opsStyles.title}>{t('store.whatHappensNext')}</Text>
        {NEXT_STEPS.map((s, i) => (
          <Text key={s} style={opsStyles.meta}>{`${i + 1}. ${s}`}</Text>
        ))}
        <Text style={opsStyles.title}>{t('store.importantNotes')}</Text>
        {NOTES.map(n => (
          <Text key={n} style={opsStyles.meta}>{`• ${n}`}</Text>
        ))}
        <View style={styles.terms}>
          <Checkbox label={t('common.termsAndConditions')} checked={terms} onChange={setTerms} />
          <Text style={opsStyles.meta}>{t('store.iConfirmThatTheInformationProvided')}</Text>
        </View>
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  white: { color: colors.white },
  ghost: { height: 46, borderWidth: 1, borderColor: colors.secondarySoft },
  actions: { flexDirection: 'row', gap: 10 },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.secondary },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  counter: { marginTop: -8, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: 'right' },
  stepper: { flexDirection: 'row', gap: 6, padding: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, ...shadow.card },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  stepDone: { borderColor: colors.success, backgroundColor: colors.success },
  stepOn: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  stepNum: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary },
  stepLabel: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textSecondary, textAlign: 'center' },
  stepLabelOn: { fontFamily: fonts.bold, color: colors.secondary },
  stepLabelOff: { color: colors.textMuted },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.warningLight },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningDark },
  rejected: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: '#fecaca', backgroundColor: colors.errorLight },
  rejectedTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.errorDark },
  rejectedText: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, color: colors.errorDark },
  rejectedHint: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12, color: colors.error },
  slot: { gap: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  doc: { gap: 6, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  editLink: { padding: 6, borderRadius: 8, backgroundColor: colors.secondaryLight },
  terms: { gap: 6, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  done: { margin: 16, alignItems: 'center', gap: 12, padding: 24, borderRadius: radius.lg, borderWidth: 1 },
  doneOk: { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
  doneWait: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  doneIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, textAlign: 'center' },
  doneText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center' },
});
