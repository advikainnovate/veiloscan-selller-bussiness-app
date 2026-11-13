import React, { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Image, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { pickImages } from '../../lib/pick-image';
import { dateTime } from '../../lib/operations';
import {
  BUSINESS_CONSTITUTIONS,
  BUSINESS_TYPES,
  businessFromStore,
  businessProblem,
  CATEGORY_OPTIONS,
  COMMERCE_MODES,
  compact,
  configFromRecord,
  configPayload,
  configProblem,
  CONTACT_FIELDS,
  contactFromRecord,
  contactProblem,
  CURRENCIES,
  DEFAULT_DOCUMENT_REQUIREMENTS,
  DOCUMENT_TYPES,
  GST_STATUSES,
  gstFromRecord,
  gstPayload,
  gstProblem,
  hoursFromRecord,
  hoursProblem,
  isColor,
  labelFor,
  missingDocuments,
  requiredDocuments,
  STORE_IMAGE_RULES,
  storeImageProblem,
  TIMEZONES,
  VERIFICATION,
  WEEK_DAYS,
  type BusinessForm,
  type ContactForm,
  type GstForm,
  type HourRow,
} from '../../lib/store-manage';
import { fileService } from '../../services/products-service';
import { storeManageService, type Rec, type StoreRecord } from '../../services/store-manage-service';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { Choices, DateField, Field, Input, SelectField, TimeField } from '../form/Fields';
import { confirmAction } from '../operations/OpsParts';
import { AlertCircleIcon, ClockIcon, FileTextIcon, ImageIcon, MapPinIcon, RefreshIcon, SettingsIcon, ShieldCheckIcon, type IconProps } from '../icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

// The store page's editable sections, as the panel's store-edit-sections:
// each saves through its own endpoint, then the page reloads the store.

export function SectionCard({ icon: Icon, title, subtitle, action, children }: { icon: ComponentType<IconProps>; title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Icon size={17} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function ErrorLine({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <AlertCircleIcon size={16} color={colors.errorDark} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** Runs a save with its button spinner, error line and toast. */
function useSave() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(problem: string | null, work: () => Promise<unknown>, message: string, onDone: () => void) {
    if (problem) return setError(problem);
    setError('');
    setSaving(true);
    try {
      await work();
      toast(message);
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return { saving, error, setError, save };
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

// ── Address & contact ────────────────────────────────────────────────────

const CONTACT_LABELS: Record<keyof ContactForm, { label: string; required?: boolean; placeholder?: string; max: number; keyboard?: 'email-address' | 'phone-pad' | 'url' | 'decimal-pad' | 'numbers-and-punctuation' }> = {
  email: { get label() { return i18n.t('store.storeEmail'); }, required: true, max: 255, keyboard: 'email-address' },
  phone: { get label() { return i18n.t('store.storePhone'); }, required: true, placeholder: '+919876543210', max: 16, keyboard: 'phone-pad' },
  alternatePhone: { get label() { return i18n.t('store.alternatePhone'); }, placeholder: '+919876543211', max: 16, keyboard: 'phone-pad' },
  website: { get label() { return i18n.t('common.website'); }, placeholder: 'https://', max: 255, keyboard: 'url' },
  addressLine1: { get label() { return i18n.t('common.addressLine1'); }, required: true, max: 255 },
  addressLine2: { get label() { return i18n.t('common.addressLine2'); }, max: 255 },
  landmark: { get label() { return i18n.t('common.landmark'); }, max: 255 },
  city: { get label() { return i18n.t('common.city'); }, required: true, max: 100 },
  state: { get label() { return i18n.t('store.state'); }, required: true, max: 100 },
  country: { get label() { return i18n.t('common.country'); }, required: true, max: 100 },
  postalCode: { get label() { return i18n.t('store.postalCode'); }, required: true, max: 20, keyboard: 'numbers-and-punctuation' },
  latitude: { get label() { return i18n.t('store.latitude'); }, placeholder: '28.6139', max: 20, keyboard: 'numbers-and-punctuation' },
  longitude: { get label() { return i18n.t('store.longitude'); }, placeholder: '77.2090', max: 20, keyboard: 'numbers-and-punctuation' },
  openingTime: { get label() { return i18n.t('store.openingTime'); }, max: 5 },
  closingTime: { get label() { return i18n.t('store.closingTime'); }, max: 5 },
};

/** The address & contact inputs (store page and Add New Store). */
export function ContactFields({ form, setForm, withTimes = true }: { form: ContactForm; setForm: React.Dispatch<React.SetStateAction<ContactForm>>; withTimes?: boolean }) {
  const { t } = useTranslation();
  const text = CONTACT_FIELDS.filter(k => k !== 'openingTime' && k !== 'closingTime');
  return (
    <>
      {text.map(k => {
        const meta = CONTACT_LABELS[k];
        return (
          <Field key={k} label={meta.label} required={meta.required}>
            <Input
              value={form[k]}
              onChangeText={v => setForm(f => ({ ...f, [k]: v }))}
              placeholder={meta.placeholder}
              maxLength={meta.max}
              keyboardType={meta.keyboard}
              autoCapitalize={meta.keyboard === 'email-address' || meta.keyboard === 'url' ? 'none' : undefined}
              accessibilityLabel={meta.label}
            />
          </Field>
        );
      })}
      {withTimes ? (
        <View style={styles.row}>
          <TimeField label={t('store.openingTime')} value={form.openingTime} onChange={openingTime => setForm(f => ({ ...f, openingTime }))} />
          <TimeField label={t('store.closingTime')} value={form.closingTime} onChange={closingTime => setForm(f => ({ ...f, closingTime }))} />
        </View>
      ) : null}
    </>
  );
}

export function ContactSection({ storeId, settings, onChange }: { storeId: string; settings: Rec | null; onChange: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => contactFromRecord(settings));
  const { saving, error, save } = useSave();
  return (
    <SectionCard icon={MapPinIcon} title={t('store.addressAndContact')} subtitle={t('store.storeEmailPhoneAddressAndDefault')}>
      <ContactFields form={form} setForm={setForm} />
      {error ? <ErrorLine message={error} /> : null}
      <Button title={t('store.saveAddressAndContact')} loading={saving} onPress={() => save(contactProblem(form), () => storeManageService.updateSettings(storeId, compact(form)), t('store.addressAndContactUpdated'), onChange)} />
    </SectionCard>
  );
}

// ── Branding ─────────────────────────────────────────────────────────────

export function ImagePickRow({
  kind,
  storeId,
  url,
  hint,
  onUploaded,
  onRemove,
}: {
  kind: 'logo' | 'banner';
  storeId: string;
  url: string | null;
  /** Whether the image is required, above the size rules. */
  hint?: string;
  onUploaded: (fileId: string, url: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const label = kind === 'logo' ? t('store.logo') : t('store.banner');
  async function pick() {
    try {
      const [file] = await pickImages({ multiple: false });
      if (!file) return;
      const problem = storeImageProblem(kind, file);
      if (problem) return toast(problem, 'error');
      setUploading(true);
      const up = await fileService.upload(file, 'store-branding', { documentType: kind, documentId: storeId });
      onUploaded(String(up.id), file.uri);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  }
  return (
    <View style={styles.imageBlock}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.row}>
        <View style={[styles.imageBox, kind === 'banner' ? styles.bannerBox : styles.logoBox]}>
          {url ? <Image source={{ uri: url }} style={styles.fill} resizeMode="cover" /> : <ImageIcon size={22} color={colors.textMuted} />}
        </View>
        <View style={styles.imageActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('store.uploadLowercase', { lowerCase: label.toLowerCase() })} disabled={uploading} onPress={pick} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>{uploading ? t('common.uploading') : t('common.upload')}</Text>
          </Pressable>
          {url ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('store.removeLowercase', { lowerCase: label.toLowerCase() })} disabled={uploading} onPress={onRemove} style={styles.smallBtn}>
              <Text style={[styles.smallBtnText, styles.danger]}>{t('common.remove')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={styles.hint}>{STORE_IMAGE_RULES[kind].text}</Text>
      {kind === 'banner' ? <Text style={styles.hint}>{t('store.theShopShowsTheBannerCropped')}</Text> : null}
    </View>
  );
}

export function BrandingSection({ storeId, branding, onChange }: { storeId: string; branding: Rec | null; onChange: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    logoId: (branding?.logoId as string) ?? '',
    bannerId: (branding?.bannerId as string) ?? '',
    primaryColor: (branding?.primaryColor as string) ?? '#FF6A00',
    secondaryColor: (branding?.secondaryColor as string) ?? '',
    tagline: (branding?.tagline as string) ?? '',
  });
  const [logoUrl, setLogoUrl] = useState(((branding?.logo as Rec | null)?.url as string | undefined) ?? null);
  const [bannerUrl, setBannerUrl] = useState(((branding?.banner as Rec | null)?.url as string | undefined) ?? null);
  const { saving, error, save } = useSave();
  const problem = !isColor(form.primaryColor) || !isColor(form.secondaryColor) ? t('store.coloursAreAWith3Or') : null;
  return (
    <SectionCard icon={ImageIcon} title={t('store.branding')} subtitle={t('store.logoBannerAndBrandColors')}>
      <ImagePickRow
        kind="logo"
        storeId={storeId}
        url={logoUrl}
        onUploaded={(id, url) => {
          setForm(f => ({ ...f, logoId: id }));
          setLogoUrl(url);
        }}
        onRemove={() => {
          setForm(f => ({ ...f, logoId: '' }));
          setLogoUrl(null);
        }}
      />
      <ImagePickRow
        kind="banner"
        storeId={storeId}
        url={bannerUrl}
        onUploaded={(id, url) => {
          setForm(f => ({ ...f, bannerId: id }));
          setBannerUrl(url);
        }}
        onRemove={() => {
          setForm(f => ({ ...f, bannerId: '' }));
          setBannerUrl(null);
        }}
      />
      {(['primaryColor', 'secondaryColor'] as const).map(k => (
        <Field key={k} label={k === 'primaryColor' ? t('store.primaryColor') : t('store.secondaryColor')}>
          <View style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: isColor(form[k]) && form[k] ? form[k] : colors.background }]} />
            <View style={styles.flex}>
              <Input value={form[k]} onChangeText={v => setForm(f => ({ ...f, [k]: v }))} maxLength={20} autoCapitalize="characters" placeholder={k === 'primaryColor' ? '#FF6A00' : '#1A1A1A'} />
            </View>
          </View>
        </Field>
      ))}
      <Field label={t('store.tagline')}>
        <Input value={form.tagline} onChangeText={tagline => setForm(f => ({ ...f, tagline }))} maxLength={255} placeholder={t('store.fromFarmToYourHome')} />
      </Field>
      {error ? <ErrorLine message={error} /> : null}
      <Button
        title={t('store.saveBranding')}
        loading={saving}
        onPress={() =>
          save(
            problem,
            () =>
              storeManageService.updateBranding(storeId, {
                // null clears a removed image.
                logoId: form.logoId || null,
                bannerId: form.bannerId || null,
                primaryColor: form.primaryColor || undefined,
                secondaryColor: form.secondaryColor || undefined,
                tagline: form.tagline || undefined,
              }),
            t('store.brandingUpdated'),
            onChange,
          )
        }
      />
    </SectionCard>
  );
}

// ── Business hours ───────────────────────────────────────────────────────

/** Open / closed and times per day; "Apply to all days" copies Monday's. */
export function HoursEditor({ rows, setRows }: { rows: HourRow[]; setRows: React.Dispatch<React.SetStateAction<HourRow[]>> }) {
  const { t } = useTranslation();
  const update = (day: string, patch: Partial<HourRow>) => setRows(r => r.map(x => (x.dayOfWeek === day ? { ...x, ...patch } : x)));
  return (
    <>
      {rows.map(row => {
        const day = WEEK_DAYS.find(d => d.value === row.dayOfWeek)!.label;
        return (
          <View key={row.dayOfWeek} style={styles.hourRow}>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, styles.flex]}>{day}</Text>
              <Text style={styles.hint}>{row.isOpen ? t('common.open') : t('common.closed')}</Text>
              <Switch accessibilityLabel={t('store.dayOpen', { day })} value={row.isOpen} onValueChange={isOpen => update(row.dayOfWeek, { isOpen })} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} />
            </View>
            {row.isOpen ? (
              <View style={styles.row}>
                <TimeField compact label={t('store.dayOpeningTime', { day })} value={row.openTime} onChange={openTime => update(row.dayOfWeek, { openTime })} />
                <Text style={styles.hint}>{t('common.to2')}</Text>
                <TimeField compact label={t('store.dayClosingTime', { day })} value={row.closeTime} onChange={closeTime => update(row.dayOfWeek, { closeTime })} />
              </View>
            ) : null}
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        onPress={() => setRows(r => r.map(x => ({ ...x, isOpen: r[0].isOpen, openTime: r[0].openTime, closeTime: r[0].closeTime })))}
        style={[styles.smallBtn, styles.selfStart]}
      >
        <Text style={styles.smallBtnText}>{t('store.applyMondayToAllDays')}</Text>
      </Pressable>
    </>
  );
}

export function HoursSection({ storeId, hours, onChange }: { storeId: string; hours: Rec[]; onChange: () => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HourRow[]>(() => hoursFromRecord(hours));
  const { saving, error, save } = useSave();
  return (
    <SectionCard icon={ClockIcon} title={t('store.businessHours')} subtitle={t('store.openingAndClosingTimePerDay')}>
      <HoursEditor rows={rows} setRows={setRows} />
      {error ? <ErrorLine message={error} /> : null}
      <Button
        title={t('store.saveBusinessHours')}
        loading={saving}
        onPress={() =>
          save(
            hoursProblem(rows),
            () => storeManageService.updateBusinessHours(storeId, rows.map(r => (r.isOpen ? { ...r } : { dayOfWeek: r.dayOfWeek, isOpen: false }))),
            t('store.businessHoursUpdated'),
            onChange,
          )
        }
      />
    </SectionCard>
  );
}

// ── Operational settings ─────────────────────────────────────────────────

export function ConfigSection({ storeId, config, onChange }: { storeId: string; config: Rec | null; onChange: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => configFromRecord(config));
  const { saving, error, save } = useSave();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const savedMode = (config?.commerceMode as string | undefined) ?? 'STANDARD';
  return (
    <SectionCard icon={SettingsIcon} title={t('store.operationalSettings')} subtitle={t('store.ordersAndPaymentOptionsCurrencyAnd')}>
      <Text style={styles.label}>{t('store.howCustomersBuy')}</Text>
      <Text style={styles.hint}>{t('store.decidesWhatYourStorefrontShowsPrices')}</Text>
      {COMMERCE_MODES.map(mode => {
        const active = form.commerceMode === mode.value;
        return (
          <Pressable key={mode.value} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => set('commerceMode', mode.value)} style={[styles.mode, active && styles.modeOn]}>
            <Text style={[styles.modeTitle, active && styles.modeTitleOn]}>{mode.label}</Text>
            <Text style={styles.hint}>{mode.description}</Text>
            <Text style={styles.modeSees}>{mode.customerSees}</Text>
          </Pressable>
        );
      })}
      {form.commerceMode !== savedMode ? <Text style={styles.warn}>{t('store.yourStorefrontSwitchesWithinAFew')}</Text> : null}
      <Field label={t('store.currencySymbol')}>
        <Input value={form.currencySymbol} onChangeText={v => set('currencySymbol', v)} maxLength={5} />
      </Field>
      <Field label={t('store.orderPrefix')}>
        <Input value={form.orderPrefix} onChangeText={v => set('orderPrefix', v)} maxLength={10} placeholder="ORD" autoCapitalize="characters" />
      </Field>
      <Field label={t('store.minimumOrderAmount')}>
        <Input value={form.minOrderAmount} onChangeText={v => set('minOrderAmount', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
      </Field>
      <ToggleRow label={t('store.acceptOrders')} value={form.acceptOrders} onChange={v => set('acceptOrders', v)} />
      <ToggleRow label={t('store.guestCheckout')} value={form.guestCheckoutEnabled} onChange={v => set('guestCheckoutEnabled', v)} />
      <ToggleRow label={t('store.taxInclusivePricing')} value={form.taxInclusivePricing} onChange={v => set('taxInclusivePricing', v)} />
      <ToggleRow label={t('common.cashOnDelivery2')} value={form.codEnabled} onChange={v => set('codEnabled', v)} />
      <ToggleRow label={t('store.onlinePayments')} value={form.onlinePaymentEnabled} onChange={v => set('onlinePaymentEnabled', v)} />
      <ToggleRow label={t('store.autoAcceptNewOrders')} value={form.autoAcceptOrders} onChange={v => set('autoAcceptOrders', v)} />
      <View style={styles.box}>
        <ToggleRow
          label={t('store.allowCustomerCredit')}
          hint={t('store.letCustomersPayPartOfAn')}
          value={form.allowCustomerCredit}
          onChange={v => set('allowCustomerCredit', v)}
        />
        {form.allowCustomerCredit ? (
          <Field label={t('store.maximumCreditPeriodDaysFromThe')}>
            <Input value={form.maxCreditDays} onChangeText={v => set('maxCreditDays', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} accessibilityLabel={t('store.maximumCreditPeriodInDays')} />
          </Field>
        ) : null}
      </View>
      {error ? <ErrorLine message={error} /> : null}
      <Button title={t('store.saveSettings')} loading={saving} onPress={() => save(configProblem(form), () => storeManageService.updateConfig(storeId, configPayload(form)), t('store.settingsUpdated'), onChange)} />
    </SectionCard>
  );
}

// ── GST ──────────────────────────────────────────────────────────────────

export function TaxSection({ storeId, taxDetails, onChange }: { storeId: string; taxDetails: Rec | null; onChange: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<GstForm>(() => gstFromRecord(taxDetails));
  const { saving, error, save } = useSave();
  const set = <K extends keyof GstForm>(k: K, v: GstForm[K]) => setForm(f => ({ ...f, [k]: v }));
  const status = taxDetails?.verificationStatus as string | undefined;
  const v = status ? VERIFICATION[status] : null;
  return (
    <SectionCard icon={ShieldCheckIcon} title={t('store.gstTaxDetails')} subtitle={t('store.withGstOrWithoutGstThis')} action={v ? <Badge label={v.label} tone={v.tone} /> : null}>
      {taxDetails?.rejectionReason ? <ErrorLine message={t('store.rejectedRejectionreason', { rejectionReason: String(taxDetails.rejectionReason) })} /> : null}
      <GstFields form={form} set={set} />
      {error ? <ErrorLine message={error} /> : null}
      <Button title={t('store.saveGstDetails')} loading={saving} onPress={() => save(gstProblem(form), () => storeManageService.updateTaxDetails(storeId, gstPayload(form)), t('store.gstDetailsUpdated'), onChange)} />
    </SectionCard>
  );
}

/** With or without GST, and the GST registration fields. */
export function GstFields({ form, set }: { form: GstForm; set: <K extends keyof GstForm>(k: K, v: GstForm[K]) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Choices
        options={[
          { value: 'yes', label: t('store.yesGstRegistered') },
          { value: 'no', label: t('store.noNotGstRegistered') },
        ]}
        value={form.gstRegistered ? 'yes' : 'no'}
        onChange={x => set('gstRegistered', x === 'yes')}
      />
      {form.gstRegistered ? (
        <>
          <Field label="GSTIN" required>
            <Input value={form.gstin} onChangeText={x => set('gstin', x.toUpperCase())} maxLength={15} autoCapitalize="characters" placeholder="07AAACG1234A1Z5" accessibilityLabel="GSTIN" />
          </Field>
          <Field label={t('store.legalBusinessName')} required>
            <Input value={form.legalBusinessName} onChangeText={x => set('legalBusinessName', x)} maxLength={255} accessibilityLabel={t('store.legalBusinessName')} />
          </Field>
          <Field label={t('store.tradeName')}>
            <Input value={form.tradeName} onChangeText={x => set('tradeName', x)} maxLength={255} />
          </Field>
          <SelectField label={t('store.businessConstitution')} value={form.businessConstitution} options={BUSINESS_CONSTITUTIONS} onChange={x => set('businessConstitution', x)} allowClear={t('store.notSet')} />
          <DateField label={t('store.gstRegistrationDate')} value={form.gstRegistrationDate} onChange={x => set('gstRegistrationDate', x)} maximumDate={new Date()} />
          <SelectField label={t('store.gstStatus')} value={form.gstStatus} options={GST_STATUSES} onChange={x => set('gstStatus', x)} allowClear={t('store.notSet')} />
          <Text style={styles.hint}>{t('store.uploadTheGstCertificateUnderDocuments')}</Text>
        </>
      ) : (
        <Text style={styles.hint}>{t('store.gstInformationCanBeAddedLater')}</Text>
      )}
    </>
  );
}

// ── Documents ────────────────────────────────────────────────────────────

export function DocumentsSection({ storeId, documents, gstRegistered, onChange }: { storeId: string; documents: Rec[]; gstRegistered: boolean; onChange: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const reqs = useFetch(() => storeManageService.documentRequirements().catch(() => DEFAULT_DOCUMENT_REQUIREMENTS), []);
  const requirements = reqs.data?.length ? reqs.data : DEFAULT_DOCUMENT_REQUIREMENTS;
  const required = requiredDocuments(gstRegistered, requirements);
  const missing = missingDocuments(gstRegistered, documents, requirements);
  const unverified = documents.filter(d => d.verificationStatus !== 'VERIFIED').length;
  const [sheet, setSheet] = useState<{ replacing: Rec | null } | null>(null);

  async function remove(doc: Rec) {
    if (!(await confirmAction(t('common.removeThisDocument'), undefined, t('common.remove'), true))) return;
    try {
      await storeManageService.removeDocument(storeId, String(doc.id));
      toast(t('common.documentRemoved'));
      onChange();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <SectionCard icon={FileTextIcon} title={t('store.storeDocuments')} subtitle={t('store.panLicensesAddressAndBankProofs')}>
      <View style={styles.box}>
        <Text style={styles.label}>{gstRegistered ? t('store.requiredDocumentsWithGst') : t('store.requiredDocumentsWithoutGst')}</Text>
        <View style={styles.chips}>
          {required.map(slot => {
            const doc = documents.find(d => slot.types.includes(String(d.documentType)));
            const st = (doc?.verificationStatus as string | undefined) ?? 'MISSING';
            return (
              <Badge
                key={slot.key}
                label={`${slot.label} · ${st === 'MISSING' ? 'Not uploaded' : st === 'VERIFIED' ? 'Verified' : st === 'REJECTED' ? 'Rejected' : 'Pending'}`}
                tone={st === 'VERIFIED' ? 'green' : st === 'REJECTED' ? 'red' : st === 'MISSING' ? 'slate' : 'amber'}
              />
            );
          })}
        </View>
        {missing.length ? (
          <Text style={[styles.hint, styles.danger]}>{t('store.uploadJoinTheStoreCanT', { join: missing.join(', ') })}</Text>
        ) : unverified ? (
          <Text style={[styles.hint, styles.amber]}>{t('store.documentsAwaitingVerification', { count: unverified })}</Text>
        ) : (
          <Text style={[styles.hint, styles.ok]}>{t('store.allDocumentsAreVerified')}</Text>
        )}
      </View>
      <Button title={t('store.addDocument')} variant="ghost" onPress={() => setSheet({ replacing: null })} style={styles.ghostBtn} />
      {!documents.length ? (
        <Text style={[styles.hint, styles.center]}>{t('store.noDocumentsUploadedYet')}</Text>
      ) : (
        documents.map(doc => {
          const st = VERIFICATION[String(doc.verificationStatus)] ?? VERIFICATION.PENDING;
          return (
            <View key={String(doc.id)} style={styles.doc}>
              <View style={styles.row}>
                <View style={styles.docIcon}>
                  <FileTextIcon size={16} color={colors.secondaryDark} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {labelFor(DOCUMENT_TYPES, doc.documentType)}
                    {doc.documentNumber ? <Text style={styles.hint}>{`  ${String(doc.documentNumber)}`}</Text> : null}
                  </Text>
                  <Pressable accessibilityRole="link" disabled={!doc.fileUrl} onPress={() => Linking.openURL(String(doc.fileUrl))}>
                    <Text style={styles.link} numberOfLines={1}>
                      {(doc.fileName as string) || t('store.viewFile')}
                    </Text>
                  </Pressable>
                </View>
                <Badge label={st.label} tone={st.tone} />
              </View>
              {doc.rejectionReason ? <Text style={[styles.hint, styles.danger]}>{t('store.rejectedRejectionreason', { rejectionReason: String(doc.rejectionReason) })}</Text> : null}
              <View style={styles.row}>
                {doc.verificationStatus === 'REJECTED' ? (
                  <Pressable accessibilityRole="button" onPress={() => setSheet({ replacing: doc })} style={[styles.smallBtn, styles.reupload]}>
                    <RefreshIcon size={14} color={colors.white} />
                    <Text style={[styles.smallBtnText, styles.white]}>{t('store.reUpload')}</Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={t('store.removeLabelfor', { labelFor: labelFor(DOCUMENT_TYPES, doc.documentType) })} onPress={() => remove(doc)} style={styles.smallBtn}>
                  <Text style={[styles.smallBtnText, styles.danger]}>{t('common.remove')}</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
      <DocumentSheet
        storeId={storeId}
        open={!!sheet}
        replacing={sheet?.replacing ?? null}
        onClose={() => setSheet(null)}
        onSaved={() => {
          setSheet(null);
          onChange();
        }}
      />
    </SectionCard>
  );
}

function DocumentSheet({ storeId, open, replacing, onClose, onSaved }: { storeId: string; open: boolean; replacing: Rec | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ documentType: 'PAN', documentNumber: '', fileUrl: '' });
  const [file, setFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setForm({ documentType: (replacing?.documentType as string) ?? 'PAN', documentNumber: (replacing?.documentNumber as string) ?? '', fileUrl: '' });
    setFile(null);
    setError('');
  }, [open, replacing]);

  async function choose() {
    try {
      const [picked] = await pickImages({ multiple: false });
      if (picked) setFile(picked);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function submit() {
    setError('');
    if (!file && !form.fileUrl.trim()) return setError(t('store.uploadAFileOrPasteA'));
    if (!file && !/^https?:\/\/\S+/.test(form.fileUrl.trim())) return setError(t('store.theFileUrlMustStartWith'));
    setSaving(true);
    try {
      const payload: Rec = { documentType: form.documentType, ...compact({ documentNumber: form.documentNumber }) };
      if (file) {
        const up = await fileService.upload(file, 'store-documents', { documentType: form.documentType, documentId: storeId });
        Object.assign(payload, { fileId: up.id, fileName: file.name, mimeType: file.type || undefined });
      } else {
        payload.fileUrl = form.fileUrl.trim();
      }
      if (replacing) {
        // Same type as before: the re-upload only takes the file and number.
        await storeManageService.reuploadDocument(storeId, String(replacing.id), { ...payload, documentType: undefined, documentNumber: form.documentNumber.trim() });
        toast(t('store.newFileUploadedSentBackFor'));
      } else {
        await storeManageService.addDocument(storeId, payload);
        toast(t('store.documentAdded'));
      }
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={open}
      title={replacing ? t('store.reUploadDocument') : t('store.addDocument')}
      subtitle={
        replacing
          ? t('store.rejectedReplaceHint', { reason: (replacing.rejectionReason as string) || t('store.noReasonGiven') })
          : undefined
      }
      onClose={onClose}
      footer={<Button title={replacing ? t('store.uploadAndSendForReview') : t('store.saveDocument')} onPress={submit} loading={saving} />}
    >
      {replacing ? (
        <Field label={t('store.documentType')}>
          <Input value={labelFor(DOCUMENT_TYPES, form.documentType)} editable={false} />
        </Field>
      ) : (
        <SelectField label={t('store.documentType')} value={form.documentType} options={DOCUMENT_TYPES} onChange={documentType => setForm(f => ({ ...f, documentType }))} />
      )}
      <Field label={t('store.documentNumber')}>
        <Input value={form.documentNumber} onChangeText={documentNumber => setForm(f => ({ ...f, documentNumber }))} maxLength={100} />
      </Field>
      <Field label={t('store.file')} hint={t('store.aPhotoOfTheDocumentPdfs')}>
        <Pressable accessibilityRole="button" onPress={choose} style={styles.addFile}>
          <ImageIcon size={16} color={colors.textSecondary} />
          <Text style={styles.addFileText} numberOfLines={1}>
            {file ? file.name : t('store.takeOrChooseAPhoto')}
          </Text>
        </Pressable>
      </Field>
      {!file ? (
        <Field label={t('store.orFileUrl')}>
          <Input value={form.fileUrl} onChangeText={fileUrl => setForm(f => ({ ...f, fileUrl }))} placeholder="https://" autoCapitalize="none" keyboardType="url" maxLength={500} />
        </Field>
      ) : null}
      {error ? <ErrorLine message={error} /> : null}
    </Sheet>
  );
}

// ── Business details (the store's own fields) ───────────────────────────

export function BusinessDetailsSheet({ store, visible, onClose, onSaved }: { store: StoreRecord; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<BusinessForm>(() => businessFromStore(store));
  const { saving, error, setError, save } = useSave();
  useEffect(() => {
    if (visible) {
      setForm(businessFromStore(store));
      setError('');
    }
    // A fresh form each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, store]);
  const set = <K extends keyof BusinessForm>(k: K, v: BusinessForm[K]) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Sheet
      visible={visible}
      title={t('store.editBusinessDetails')}
      subtitle={t('store.theStoresDescriptionUsesFormattedText')}
      onClose={onClose}
      footer={
        <Button
          title={t('common.saveChanges')}
          loading={saving}
          onPress={() =>
            save(
              businessProblem(form),
              () =>
                storeManageService.update(store.id, {
                  name: form.name.trim(),
                  businessType: form.businessType,
                  businessCategory: form.businessCategory.trim(),
                  timezone: form.timezone,
                  currency: form.currency,
                  ...(form.slug.trim() && form.slug.trim() !== store.slug ? { slug: form.slug.trim() } : {}),
                }),
              t('store.storeUpdated'),
              onSaved,
            )
          }
        />
      }
    >
      <Field label={t('store.storeName')} required>
        <Input value={form.name} onChangeText={v => set('name', v)} maxLength={150} accessibilityLabel={t('store.storeName')} />
      </Field>
      <SelectField label={t('store.businessType')} required value={form.businessType} options={BUSINESS_TYPES} onChange={v => set('businessType', v)} />
      <SelectField
        label={t('store.businessCategory')}
        required
        value={form.businessCategory}
        options={CATEGORY_OPTIONS.some(o => o.value === form.businessCategory) || !form.businessCategory ? CATEGORY_OPTIONS : [{ value: form.businessCategory, label: form.businessCategory }, ...CATEGORY_OPTIONS]}
        onChange={v => set('businessCategory', v)}
      />
      <SelectField label={t('common.timezone')} required value={form.timezone} options={TIMEZONES} onChange={v => set('timezone', v)} />
      <SelectField label={t('store.currency')} required value={form.currency} options={CURRENCIES} onChange={v => set('currency', v)} />
      <Field label={t('store.storeSlug')} hint={t('store.partOfTheStorefrontUrlChanging')}>
        <Input value={form.slug} onChangeText={v => set('slug', v.toLowerCase())} maxLength={150} autoCapitalize="none" />
      </Field>
      {error ? <ErrorLine message={error} /> : null}
    </Sheet>
  );
}

// ── Approval history ─────────────────────────────────────────────────────

const ACTIONS: Record<string, { label: string; dot: string }> = {
  SUBMITTED: { get label() { return i18n.t('store.storeSubmittedForApproval'); }, dot: '#3b82f6' },
  RESUBMITTED: { get label() { return i18n.t('store.storeResubmittedWithChanges'); }, dot: '#3b82f6' },
  APPROVED: { get label() { return i18n.t('store.storeApproved'); }, dot: '#10b981' },
  REJECTED: { get label() { return i18n.t('common.storeChangesRequested'); }, dot: '#ef4444' },
  DOCUMENT_UPLOADED: { label: 'uploaded', dot: '#94a3b8' },
  DOCUMENT_REUPLOADED: { label: 're-uploaded for review', dot: '#f59e0b' },
  DOCUMENT_VERIFIED: { label: 'verified', dot: '#10b981' },
  DOCUMENT_REJECTED: { label: 'rejected', dot: '#ef4444' },
  DOCUMENT_REMOVED: { label: 'removed', dot: '#cbd5e1' },
};

export function ApprovalHistory({ storeId }: { storeId: string }) {
  const { t } = useTranslation();
  const { data, error, loading, reload } = useFetch(() => storeManageService.approvalHistory(storeId), [storeId]);
  const [filter, setFilter] = useState<'all' | 'store' | 'documents'>('all');
  if (loading) return <Text style={styles.hint}>{t('common.loading')}</Text>;
  if (error && !data) {
    return (
      <Pressable onPress={() => reload()}>
        <Text style={[styles.hint, styles.danger]}>{t('store.errorTapToTryAgain', { error })}</Text>
      </Pressable>
    );
  }
  const history = data ?? [];
  const isDoc = (l: Rec) => String(l.action).startsWith('DOCUMENT_');
  const docCount = history.filter(isDoc).length;
  const shown = history.filter(l => filter === 'all' || (filter === 'documents') === isDoc(l));
  return (
    <View style={styles.history}>
      <Choices
        options={[
          { value: 'all', label: t('store.allHistorycount', { historyCount: history.length }) },
          { value: 'store', label: t('store.storeReviewLength', { length: history.length - docCount }) },
          { value: 'documents', label: t('store.documentsDoccount', { docCount }) },
        ]}
        value={filter}
        onChange={v => setFilter(v as typeof filter)}
      />
      {!shown.length ? (
        <Text style={styles.hint}>{t('store.noHistoryYet')}</Text>
      ) : (
        shown.map((log, i) => {
          const action = String(log.action);
          const meta = ACTIONS[action] ?? { label: action, dot: '#94a3b8' };
          const actor = log.actor as Rec | null;
          const details = (log.details as Rec | null) ?? {};
          const doc = isDoc(log);
          const reason = (details.reason ?? details.rejectionReason ?? details.note) as string | undefined;
          return (
            <View key={String(log.id ?? i)} style={styles.event}>
              <View style={[styles.dot, { backgroundColor: meta.dot }]} />
              <View style={styles.flex}>
                <Text style={styles.eventTitle}>{doc ? `${labelFor(DOCUMENT_TYPES, log.documentType)} ${meta.label}` : meta.label}</Text>
                <Text style={styles.hint}>{`${dateTime(log.createdAt as string)}${actor ? ` · ${[actor.firstName, actor.lastName].filter(Boolean).join(' ')}` : ''}`}</Text>
                {doc && details.fileUrl ? (
                  <Pressable accessibilityRole="link" onPress={() => Linking.openURL(String(details.fileUrl))}>
                    <Text style={styles.link} numberOfLines={1}>
                      {t('store.fileName', { name: (details.fileName as string) || t('store.viewFile') })}
                    </Text>
                  </Pressable>
                ) : null}
                {reason ? <Text style={[styles.hint, action.includes('REJECTED') ? styles.danger : null]}>{reason}</Text> : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  center: { textAlign: 'center' },
  selfStart: { alignSelf: 'flex-start' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  cardSubtitle: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  cardBody: { gap: 14, padding: 14 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  warn: { fontFamily: fonts.regular, fontSize: 12, color: colors.warningDark },
  danger: { color: colors.error },
  amber: { color: colors.warningDark },
  ok: { color: colors.successDark },
  white: { color: colors.white },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, backgroundColor: colors.errorLight },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.errorDark },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  hourRow: { gap: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  box: { gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  mode: { gap: 3, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  modeOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  modeTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  modeTitleOn: { color: colors.secondaryDark },
  modeSees: { marginTop: 2, fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  imageBlock: { gap: 8 },
  imageBox: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  logoBox: { width: 64, height: 64 },
  bannerBox: { width: 170, height: 64 },
  fill: { width: '100%', height: '100%' },
  imageActions: { gap: 6 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  smallBtnText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  reupload: { backgroundColor: colors.error, borderColor: colors.error },
  swatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ghostBtn: { height: 44, borderWidth: 1, borderColor: colors.secondarySoft },
  doc: { gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  docIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  docTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  link: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.secondary },
  addFile: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  addFileText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  history: { gap: 12 },
  event: { flexDirection: 'row', gap: 10 },
  dot: { width: 10, height: 10, marginTop: 5, borderRadius: 5 },
  eventTitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
});
