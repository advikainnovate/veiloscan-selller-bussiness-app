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

type TextKey = Exclude<keyof WarehouseForm, 'isActive' | 'inboundEnabled' | 'outboundEnabled' | 'returnEnabled' | 'isDefault'>;
type FieldSpec = { key: TextKey; label: string; placeholder?: string; required?: boolean; hint?: string; keyboard?: 'email-address' | 'phone-pad' | 'numbers-and-punctuation' };

const BASIC: FieldSpec[] = [
  { key: 'facilityTitle', label: 'Warehouse Name', required: true, placeholder: 'Enter warehouse name', hint: 'This name will be used internally.' },
  { key: 'facilityCode', label: 'Warehouse Code', required: true, placeholder: 'Enter unique warehouse code', hint: 'Unique code for this warehouse.' },
  { key: 'contactPerson', label: 'Contact Person', placeholder: 'Person responsible for this warehouse' },
];
const LOCATION: FieldSpec[] = [
  { key: 'addressLine1', label: 'Address Line 1', placeholder: 'Enter address line 1' },
  { key: 'addressLine2', label: 'Address Line 2', placeholder: 'Enter address line 2 (optional)' },
  { key: 'landmark', label: 'Landmark', placeholder: 'Nearby landmark' },
  { key: 'area', label: 'Area', placeholder: 'Locality / area' },
  { key: 'city', label: 'City', placeholder: 'Enter city' },
  { key: 'state', label: 'State / Province', placeholder: 'Enter state' },
  { key: 'pincode', label: 'Postal / ZIP Code', placeholder: 'Enter postal code', keyboard: 'numbers-and-punctuation' },
  { key: 'country', label: 'Country', placeholder: 'Enter country' },
  { key: 'region', label: 'Region', placeholder: 'e.g. South' },
  { key: 'phone', label: 'Phone', placeholder: 'Enter phone number', keyboard: 'phone-pad' },
  { key: 'email', label: 'Email', placeholder: 'Enter email address', keyboard: 'email-address' },
  { key: 'latitude', label: 'Latitude (Optional)', placeholder: 'Enter latitude', keyboard: 'numbers-and-punctuation' },
  { key: 'longitude', label: 'Longitude (Optional)', placeholder: 'Enter longitude', keyboard: 'numbers-and-punctuation' },
];
const ADDITIONAL: FieldSpec[] = [
  { key: 'timezone', label: 'Timezone', placeholder: 'Asia/Kolkata' },
  { key: 'customField1', label: 'Custom Field 1', placeholder: 'e.g. zone-a' },
  { key: 'customField2', label: 'Custom Field 2', placeholder: 'e.g. rack-1' },
];
const SWITCHES: { key: 'inboundEnabled' | 'outboundEnabled' | 'returnEnabled' | 'isDefault'; label: string; hint: string }[] = [
  { key: 'inboundEnabled', label: 'Inbound Enabled', hint: 'Allow stock-in transactions.' },
  { key: 'outboundEnabled', label: 'Outbound Enabled', hint: 'Allow stock-out transactions.' },
  { key: 'returnEnabled', label: 'Return Enabled', hint: 'Allow return transactions.' },
  { key: 'isDefault', label: 'Is Default Warehouse', hint: 'Set as default for new transactions.' },
];

/** Add or edit a warehouse, as the panel's form; new ones (and address changes) go to VeiloScan for approval. */
export function WarehouseFormScreen({ navigation, route }: ScreenProps<'WarehouseForm'>) {
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
        toast(approval?.status === 'ACTIVE' && warehouseLifecycle(saved) === 'PENDING_APPROVAL' ? "Saved. The new address needs VeiloScan's approval before you can use this warehouse again." : 'Warehouse updated');
      } else {
        let created = await warehouseMasterService.create(payload);
        if (status !== 1) created = await warehouseMasterService.update(created.id, { status });
        const after = warehouseLifecycle(created);
        toast(after === 'ACTIVE' ? "Warehouse added and approved — it's ready to use" : after === 'INACTIVE' ? 'Warehouse added (switched off)' : 'Warehouse submitted. You can stock it once VeiloScan approves it.');
      }
      navigation.goBack();
    } catch (err) {
      fail(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const title = id ? 'Edit Warehouse' : 'Add New Warehouse';
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label="Warehouses" icon={WarehouseIcon} allowed={false} />
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
      <AppHeader title={title} subtitle="Warehouses" onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>Enter warehouse details and configure basic settings.</Text>
        {approval && approval.status !== 'ACTIVE' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{`${WAREHOUSE_STATUS[approval.status].label} — ${WAREHOUSE_STATUS[approval.status].hint}`}</Text>
            {approval.note ? <Text style={opsStyles.meta}>{`VeiloScan: “${approval.note}”`}</Text> : null}
            {canResubmit(approval.status) ? <Button title="Resubmit for review" variant="ghost" onPress={() => setResubmitting(true)} style={styles.ghost} /> : null}
          </View>
        ) : null}
        {!id ? (
          <View style={[styles.notice, styles.info]}>
            <Text style={styles.infoText}>
              VeiloScan checks new warehouses before they can hold stock. Your first warehouse is always reviewed by our team; later ones with a complete, verifiable address are usually approved straight away.
            </Text>
          </View>
        ) : null}

        <SectionCard icon={WarehouseIcon} title="Basic Information">
          {fields(BASIC.slice(0, 2))}
          <SelectField label="Warehouse Type" required hint="Primary, Secondary, Regional, etc." value={form.facilityType} options={WAREHOUSE_TYPES} onChange={v => set('facilityType', v)} />
          {fields(BASIC.slice(2))}
        </SectionCard>
        <SectionCard icon={MapPinIcon} title="Location Details" subtitle="Adding coordinates helps with distance calculation and location mapping.">
          {fields(LOCATION)}
        </SectionCard>
        <SectionCard icon={SettingsIcon} title="Additional Information">
          {fields(ADDITIONAL)}
        </SectionCard>
        <SectionCard icon={SettingsIcon} title="Warehouse Settings">
          <SwitchRow
            label="Active Warehouse"
            hint={approval && !canToggle(approval.status) ? 'Available once the warehouse is approved.' : 'Switch off to stop new stock operations here.'}
            value={form.isActive}
            disabled={!!approval && !canToggle(approval.status)}
            onChange={v => set('isActive', v)}
          />
          {SWITCHES.map(s => (
            <SwitchRow key={s.key} label={s.label} hint={s.hint} value={form[s.key]} onChange={v => set(s.key, v)} />
          ))}
          <Text style={opsStyles.muted}>Tip: assign stock to this warehouse from Inventory once it's created.</Text>
        </SectionCard>

        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={id ? 'Save Changes' : 'Save Warehouse'} loading={saving} onSave={save} onCancel={navigation.goBack} />

      <ReasonSheet
        visible={resubmitting}
        title="Resubmit for review?"
        message="Save your changes first, then resubmit so VeiloScan reviews the latest details."
        label="Note for the reviewer (optional)"
        confirmLabel="Resubmit"
        required={false}
        maxLength={1000}
        onClose={() => setResubmitting(false)}
        onConfirm={async note => {
          try {
            await warehouseMasterService.resubmit(id!, note);
            toast('Warehouse resubmitted for review');
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
