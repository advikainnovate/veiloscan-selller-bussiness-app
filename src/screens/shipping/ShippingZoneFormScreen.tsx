import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { EMPTY_ZONE, INDIAN_STATES, slugify, zoneFromRecord, zonePayload, zoneProblem, type ZoneForm } from '../../lib/shipping';
import { shippingZoneService } from '../../services/shipping-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Choices, Field, Input } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, CheckIcon, MapPinIcon, TruckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/** Create or edit a shipping zone: its title and the states it covers. Methods are added on the zone's page. */
export function ShippingZoneFormScreen({ navigation, route }: ScreenProps<'ShippingZoneForm'>) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('shipping:manage');
  const record = useFetch(() => (allowed && id ? shippingZoneService.get(id) : Promise.resolve(null)), [allowed, id]);
  const [form, setForm] = useState<ZoneForm>(EMPTY_ZONE);
  // The slug follows the title until it's typed in by hand.
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [stateSearch, setStateSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ZoneForm>(k: K, v: ZoneForm[K]) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (record.data) setForm(zoneFromRecord(record.data));
  }, [record.data]);

  // Saved states not in the list (typed on the panel) stay choosable.
  const allStates = useMemo(() => [...INDIAN_STATES, ...form.coveredStates.filter(s => !INDIAN_STATES.includes(s))], [form.coveredStates]);
  const shown = allStates.filter(s => s.toLowerCase().includes(stateSearch.trim().toLowerCase()));
  const toggleState = (s: string) => set('coveredStates', form.coveredStates.includes(s) ? form.coveredStates.filter(x => x !== s) : [...form.coveredStates, s]);

  async function save() {
    setError('');
    const problem = zoneProblem(form);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      if (id) {
        await shippingZoneService.update(id, { ...zonePayload(form), coveredStates: form.coveredStates, status: Number(form.status) });
        toast(t('shipping.shippingZoneUpdated'));
        navigation.goBack();
      } else {
        const created = await shippingZoneService.create(zonePayload(form));
        toast(t('shipping.shippingZoneCreatedNowAddIts'));
        navigation.replace('ShippingZone', { id: created.id });
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const title = id ? t('shipping.editShippingZone') : t('shipping.createShippingZone');
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={t('shipping.shipping')} icon={TruckIcon} allowed={false} />
      </View>
    );
  }
  if (id && (record.loading || !record.data)) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        {record.error ? <ErrorState message={record.error} onRetry={record.reload} /> : <ListSkeleton rows={2} height={140} />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={title} subtitle={t('shipping.shipping')} onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        <SectionCard icon={TruckIcon} title={t('common.basicInformation')} subtitle={t('shipping.titleAndStateCoverageForThis')}>
          <Field label={t('shipping.zoneTitle')} required>
            <Input
              value={form.zoneTitle}
              onChangeText={v => setForm(f => ({ ...f, zoneTitle: v, zoneSlug: slugTouched ? f.zoneSlug : slugify(v) }))}
              placeholder="e.g. South India"
              maxLength={255}
              accessibilityLabel={t('shipping.zoneTitle')}
            />
          </Field>
          <Field label={t('common.slug')} required>
            <Input
              value={form.zoneSlug}
              onChangeText={v => {
                setSlugTouched(true);
                set('zoneSlug', v);
              }}
              autoCapitalize="none"
              maxLength={255}
              accessibilityLabel={t('shipping.zoneSlug')}
            />
          </Field>
          {id ? (
            <Field label={t('common.status')}>
              <Choices
                options={[
                  { value: '1', label: t('common.active') },
                  { value: '0', label: t('common.inactive') },
                ]}
                value={form.status}
                onChange={v => set('status', v)}
              />
            </Field>
          ) : null}
          <Field label={t('common.description')}>
            <Input value={form.description} onChangeText={v => set('description', v)} multiline maxLength={1000} style={styles.textArea} accessibilityLabel={t('common.description')} />
          </Field>
        </SectionCard>

        <SectionCard
          icon={MapPinIcon}
          title={t('shipping.coveredStates')}
          subtitle={form.coveredStates.length ? t('shipping.coveredstatescountSelected', { coveredStatesCount: form.coveredStates.length }) : t('shipping.noneSelectedTheZoneCoversAll')}
          action={
            form.coveredStates.length ? (
              <Pressable accessibilityRole="button" onPress={() => set('coveredStates', [])}>
                <Text style={styles.link}>{t('common.clear')}</Text>
              </Pressable>
            ) : null
          }
        >
          <SearchBar value={stateSearch} onChange={setStateSearch} placeholder={t('shipping.searchStates')} />
          <View style={styles.states}>
            {shown.map(s => {
              const on = form.coveredStates.includes(s);
              return (
                <Pressable key={s} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={s} onPress={() => toggleState(s)} style={[styles.state, on && styles.stateOn]}>
                  {on ? <CheckIcon size={12} color={colors.white} strokeWidth={3} /> : null}
                  <Text style={[styles.stateText, on && styles.stateTextOn]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        {!id ? <Text style={[opsStyles.muted, styles.tip]}>{t('shipping.saveTheZoneFirstThenAdd')}</Text> : null}
        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={id ? t('common.saveChanges') : t('shipping.createZone')} loading={saving} onSave={save} onCancel={navigation.goBack} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 24 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  states: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  stateOn: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  stateText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  stateTextOn: { color: colors.white },
  tip: { paddingHorizontal: 4 },
});
