import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View, type ScrollViewInstance } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import {
  canResubmit,
  canToggle,
  EMPTY_WAREHOUSE,
  WAREHOUSE_STATUS,
  WAREHOUSE_TYPES,
  warehouseFromRecord,
  warehouseLifecycle,
  warehousePayload,
  warehouseProblem,
  type WarehouseForm,
  type WarehouseLifecycle,
} from '../../lib/catalog';
import { warehouseMasterService } from '../../services/catalog-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Button } from '../../components/ui/Button';
import { Field, Input, SelectField } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles, ReasonSheet } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, MapPinIcon, SettingsIcon, WarehouseIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

type TextKey = Exclude<keyof WarehouseForm, 'isActive' | 'inboundEnabled' | 'outboundEnabled' | 'returnEnabled' | 'isDefault'>;
type FieldSpec = { key: TextKey; label: string; placeholder?: string; required?: boolean; hint?: string; keyboard?: 'email-address' | 'phone-pad' | 'numbers-and-punctuation' };

const BASIC: FieldSpec[] = [
  { key: 'facilityTitle', get label() { return i18n.t('catalog.warehouseName'); }, required: true, get placeholder() { return i18n.t('catalog.enterWarehouseName'); }, get hint() { return i18n.t('catalog.thisNameWillBeUsedInternally'); } },
  { key: 'facilityCode', get label() { return i18n.t('catalog.warehouseCode'); }, required: true, get placeholder() { return i18n.t('catalog.enterUniqueWarehouseCode'); }, get hint() { return i18n.t('catalog.uniqueCodeForThisWarehouse'); } },
  { key: 'contactPerson', get label() { return i18n.t('catalog.contactPerson'); }, get placeholder() { return i18n.t('catalog.personResponsibleForThisWarehouse'); } },
];
const LOCATION: FieldSpec[] = [
  { key: 'addressLine1', get label() { return i18n.t('common.addressLine1'); }, get placeholder() { return i18n.t('catalog.enterAddressLine1'); } },
  { key: 'addressLine2', get label() { return i18n.t('common.addressLine2'); }, get placeholder() { return i18n.t('catalog.enterAddressLine2Optional'); } },
  { key: 'landmark', get label() { return i18n.t('common.landmark'); }, get placeholder() { return i18n.t('catalog.nearbyLandmark'); } },
  { key: 'area', get label() { return i18n.t('common.area'); }, get placeholder() { return i18n.t('catalog.localityArea'); } },
  { key: 'city', get label() { return i18n.t('common.city'); }, get placeholder() { return i18n.t('catalog.enterCity'); } },
  { key: 'state', get label() { return i18n.t('catalog.stateProvince'); }, get placeholder() { return i18n.t('catalog.enterState'); } },
  { key: 'pincode', get label() { return i18n.t('catalog.postalZipCode'); }, get placeholder() { return i18n.t('catalog.enterPostalCode'); }, keyboard: 'numbers-and-punctuation' },
  { key: 'country', get label() { return i18n.t('common.country'); }, get placeholder() { return i18n.t('catalog.enterCountry'); } },
  { key: 'region', get label() { return i18n.t('catalog.region'); }, placeholder: 'e.g. South' },
  { key: 'phone', get label() { return i18n.t('common.phone'); }, get placeholder() { return i18n.t('catalog.enterPhoneNumber'); }, keyboard: 'phone-pad' },
  { key: 'email', get label() { return i18n.t('common.email'); }, get placeholder() { return i18n.t('catalog.enterEmailAddress'); }, keyboard: 'email-address' },
  { key: 'latitude', get label() { return i18n.t('catalog.latitudeOptional'); }, get placeholder() { return i18n.t('catalog.enterLatitude'); }, keyboard: 'numbers-and-punctuation' },
  { key: 'longitude', get label() { return i18n.t('catalog.longitudeOptional'); }, get placeholder() { return i18n.t('catalog.enterLongitude'); }, keyboard: 'numbers-and-punctuation' },
];
const ADDITIONAL: FieldSpec[] = [
  { key: 'timezone', get label() { return i18n.t('common.timezone'); }, placeholder: 'Asia/Kolkata' },
  { key: 'customField1', get label() { return i18n.t('catalog.customField1'); }, placeholder: 'e.g. zone-a' },
  { key: 'customField2', get label() { return i18n.t('catalog.customField2'); }, placeholder: 'e.g. rack-1' },
];
const SWITCHES: { key: 'inboundEnabled' | 'outboundEnabled' | 'returnEnabled' | 'isDefault'; label: string; hint: string }[] = [
  { key: 'inboundEnabled', get label() { return i18n.t('catalog.inboundEnabled'); }, get hint() { return i18n.t('catalog.allowStockInTransactions'); } },
  { key: 'outboundEnabled', get label() { return i18n.t('catalog.outboundEnabled'); }, get hint() { return i18n.t('catalog.allowStockOutTransactions'); } },
  { key: 'returnEnabled', get label() { return i18n.t('catalog.returnEnabled'); }, get hint() { return i18n.t('catalog.allowReturnTransactions'); } },
  { key: 'isDefault', get label() { return i18n.t('catalog.isDefaultWarehouse'); }, get hint() { return i18n.t('catalog.setAsDefaultForNewTransactions'); } },
];

/** Add or edit a warehouse, as the panel's form; new ones (and address changes) go to VeiloScan for approval. */
export function WarehouseFormScreen({ navigation, route }: ScreenProps<'WarehouseForm'>) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('warehouse-master:manage');
  const [form, setForm] = useState<WarehouseForm>(EMPTY_WAREHOUSE);
  const [approval, setApproval] = useState<{ status: WarehouseLifecycle; note: string | null } | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const set = <K extends keyof WarehouseForm>(k: K, v: WarehouseForm[K]) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!id || !allowed) return;
    let cancelled = false;
    setLoading(true);
    warehouseMasterService
      .get(id)
      .then(r => {
        if (cancelled) return;
        setForm(warehouseFromRecord(r));
        setApproval({ status: warehouseLifecycle(r), note: (r.reviewNote as string) ?? null });
        setLoadError('');
      })
      .catch(err => !cancelled && setLoadError(extractErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, allowed, reloadKey]);

  const fail = (message: string) => {
    setError(message);
    scroll.current?.scrollToEnd({ animated: true });
  };

  async function save() {
    setError('');
    const problem = warehouseProblem(form);
    if (problem) return fail(problem);
    setSaving(true);
    try {
      const payload = warehousePayload(form);
      const status = form.isActive ? 1 : 0;
      if (id) {
        const saved = await warehouseMasterService.update(id, { ...payload, status });
        toast(approval?.status === 'ACTIVE' && warehouseLifecycle(saved) === 'PENDING_APPROVAL' ? t('catalog.savedTheNewAddressNeedsVeiloscans') : t('catalog.warehouseUpdated'));
      } else {
        let created = await warehouseMasterService.create(payload);
        if (status !== 1) created = await warehouseMasterService.update(created.id, { status });
        const after = warehouseLifecycle(created);
        toast(after === 'ACTIVE' ? t('catalog.warehouseAddedAndApprovedItsReady') : after === 'INACTIVE' ? t('catalog.warehouseAddedSwitchedOff') : t('catalog.warehouseSubmittedYouCanStockIt'));
      }
      navigation.goBack();
    } catch (err) {
      fail(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const title = id ? t('catalog.editWarehouse') : t('catalog.addNewWarehouse');
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={t('catalog.warehouses')} icon={WarehouseIcon} allowed={false} />
      </View>
    );
  }
  if (loading || loadError) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        {loadError ? <ErrorState message={loadError} onRetry={() => setReloadKey(k => k + 1)} /> : <ListSkeleton rows={3} height={160} />}
      </View>
    );
  }

  const fields = (list: FieldSpec[]) =>
    list.map(f => (
      <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
        <Input
          value={form[f.key]}
          onChangeText={v => set(f.key, v)}
          placeholder={f.placeholder}
          keyboardType={f.keyboard}
          autoCapitalize={f.keyboard === 'email-address' ? 'none' : undefined}
          maxLength={255}
          accessibilityLabel={f.label}
        />
      </Field>
    ));

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={title} subtitle={t('catalog.warehouses')} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>{t('catalog.enterWarehouseDetailsAndConfigureBasic')}</Text>
        {approval && approval.status !== 'ACTIVE' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{`${WAREHOUSE_STATUS[approval.status].label} — ${WAREHOUSE_STATUS[approval.status].hint}`}</Text>
            {approval.note ? <Text style={opsStyles.meta}>{t('catalog.veiloscanNote', { note: approval.note })}</Text> : null}
            {canResubmit(approval.status) ? <Button title={t('catalog.resubmitForReview')} variant="ghost" onPress={() => setResubmitting(true)} style={styles.ghost} /> : null}
          </View>
        ) : null}
        {!id ? (
          <View style={[styles.notice, styles.info]}>
            <Text style={styles.infoText}>
              {t('catalog.veiloscanChecksNewWarehousesBeforeThey')}</Text>
          </View>
        ) : null}

        <SectionCard icon={WarehouseIcon} title={t('common.basicInformation')}>
          {fields(BASIC.slice(0, 2))}
          <SelectField label={t('catalog.warehouseType')} required hint={t('catalog.primarySecondaryRegionalEtc')} value={form.facilityType} options={WAREHOUSE_TYPES} onChange={v => set('facilityType', v)} />
          {fields(BASIC.slice(2))}
        </SectionCard>
        <SectionCard icon={MapPinIcon} title={t('catalog.locationDetails')} subtitle={t('catalog.addingCoordinatesHelpsWithDistanceCalculation')}>
          {fields(LOCATION)}
        </SectionCard>
        <SectionCard icon={SettingsIcon} title={t('catalog.additionalInformation')}>
          {fields(ADDITIONAL)}
        </SectionCard>
        <SectionCard icon={SettingsIcon} title={t('catalog.warehouseSettings')}>
          <SwitchRow
            label={t('catalog.activeWarehouse')}
            hint={approval && !canToggle(approval.status) ? t('catalog.availableOnceTheWarehouseIsApproved') : t('catalog.switchOffToStopNewStock')}
            value={form.isActive}
            disabled={!!approval && !canToggle(approval.status)}
            onChange={v => set('isActive', v)}
          />
          {SWITCHES.map(s => (
            <SwitchRow key={s.key} label={s.label} hint={s.hint} value={form[s.key]} onChange={v => set(s.key, v)} />
          ))}
          <Text style={opsStyles.muted}>{t('catalog.tipAssignStockToThisWarehouse')}</Text>
        </SectionCard>

        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={id ? t('common.saveChanges') : t('catalog.saveWarehouse')} loading={saving} onSave={save} onCancel={navigation.goBack} />

      <ReasonSheet
        visible={resubmitting}
        title={t('catalog.resubmitForReview2')}
        message={t('catalog.saveYourChangesFirstThenResubmit')}
        label={t('catalog.noteForTheReviewerOptional')}
        confirmLabel={t('catalog.resubmit')}
        required={false}
        maxLength={1000}
        onClose={() => setResubmitting(false)}
        onConfirm={async note => {
          try {
            await warehouseMasterService.resubmit(id!, note);
            toast(t('catalog.warehouseResubmittedForReview'));
            setResubmitting(false);
            navigation.goBack();
          } catch (err) {
            setResubmitting(false);
            fail(extractErrorMessage(err));
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

function SwitchRow({ label, hint, value, disabled, onChange }: { label: string; hint: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={opsStyles.rowBetween}>
      <View style={styles.flex}>
        <Text style={opsStyles.title}>{label}</Text>
        <Text style={opsStyles.muted}>{hint}</Text>
      </View>
      <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { gap: 12, paddingBottom: 24 },
  notice: { gap: 6, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  noticeTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  info: { borderColor: '#bae6fd', backgroundColor: '#f0f9ff' },
  infoText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: '#075985' },
  ghost: { height: 42, borderWidth: 1, borderColor: colors.secondarySoft },
});
