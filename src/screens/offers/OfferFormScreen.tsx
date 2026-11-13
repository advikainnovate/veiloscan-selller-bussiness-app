import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { pickImages } from '../../lib/pick-image';
import { emptyOffer, OFFERS, offerFromRecord, offerPayload, offerProblem, statusField, type FieldSpec, type OfferForm } from '../../lib/offers';
import { offerService } from '../../services/offers-service';
import { fileService } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Choices, DateField, Field, Input } from '../../components/form/Fields';
import { FormFooter } from '../../components/form/FormFooter';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, ImageIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const fromDay = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
};

/** Create or edit a freebie / gift card / promotion, from its config. */
export function OfferFormScreen({ navigation, route }: ScreenProps<'OfferForm'>) {
  const { t } = useTranslation();
  const { kind, id } = route.params;
  const c = OFFERS[kind];
  const service = offerService(kind);
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission(c.permission);
  const record = useFetch(() => (allowed && id ? service.get(id) : Promise.resolve(null)), [allowed, kind, id]);
  const [form, setForm] = useState<OfferForm>(() => emptyOffer(c));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (record.data) setForm(offerFromRecord(c, record.data));
  }, [c, record.data]);

  async function pickImage() {
    try {
      const [file] = await pickImages({ multiple: false });
      if (!file) return;
      setUploading(true);
      const up = await fileService.upload(file, kind);
      setForm(f => ({ ...f, imageFileId: String(up.id), imageUrl: up.url ?? file.uri }));
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError('');
    const problem = offerProblem(c, form);
    if (problem) {
      setError(problem);
      return scroll.current?.scrollToEnd({ animated: true });
    }
    setSaving(true);
    try {
      if (id) await service.update(id, offerPayload(c, form, true));
      else await service.create(offerPayload(c, form, false));
      toast(`${c.singular} ${id ? 'updated' : 'created'}`);
      navigation.goBack();
    } catch (err) {
      setError(extractErrorMessage(err));
      scroll.current?.scrollToEnd({ animated: true });
    } finally {
      setSaving(false);
    }
  }

  const title = `${id ? 'Edit' : 'Create'} ${c.singular}`;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        <ComingSoon label={c.title} icon={c.icon} allowed={false} />
      </View>
    );
  }
  if (id && (record.loading || !record.data)) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={title} onBack={navigation.goBack} />
        {record.error ? <ErrorState message={record.error} onRetry={record.reload} /> : <ListSkeleton rows={3} height={140} />}
      </View>
    );
  }

  function render(f: FieldSpec) {
    const value = String(form[f.key] ?? '');
    switch (f.type) {
      case 'choice':
        return (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <Choices options={f.options ?? []} value={value} onChange={v => set(f.key, v)} />
          </Field>
        );
      case 'date':
        return (
          <DateField
            key={f.key}
            label={f.label}
            value={value}
            onChange={v => set(f.key, v)}
            minimumDate={f.key === 'endDate' && form.startDate ? fromDay(form.startDate) : undefined}
          />
        );
      case 'image':
        return (
          <Field key={f.key} label={f.label}>
            <View style={styles.imageRow}>
              <View style={styles.image}>{form.imageUrl ? <Image source={{ uri: form.imageUrl }} style={styles.fill} resizeMode="cover" /> : <ImageIcon size={22} color={colors.textMuted} />}</View>
              <View style={styles.imageActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.uploadLabel', { label: f.label })} disabled={uploading} onPress={pickImage} style={opsStyles.smallBtn}>
                  <Text style={opsStyles.smallBtnText}>{uploading ? t('common.uploading') : form.imageUrl ? t('common.change') : t('common.upload')}</Text>
                </Pressable>
                {form.imageUrl ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('common.removeLabel', { label: f.label })} onPress={() => setForm(x => ({ ...x, imageFileId: '', imageUrl: '' }))}>
                    <Text style={[opsStyles.smallBtnText, opsStyles.danger]}>{t('common.remove')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Field>
        );
      default: {
        const numeric = f.type === 'amount' || f.type === 'int';
        return (
          <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
            <Input
              value={value}
              onChangeText={v => set(f.key, f.type === 'amount' ? v.replace(/[^\d.]/g, '') : f.type === 'int' ? v.replace(/\D/g, '') : v)}
              keyboardType={f.type === 'amount' ? 'decimal-pad' : f.type === 'int' ? 'number-pad' : undefined}
              multiline={f.type === 'multiline'}
              style={f.type === 'multiline' ? styles.textArea : undefined}
              maxLength={f.maxLength ?? (numeric ? 12 : f.type === 'multiline' ? 2000 : 255)}
              placeholder={f.placeholder}
              accessibilityLabel={f.label}
            />
          </Field>
        );
      }
    }
  }

  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={title} subtitle={c.title} onBack={navigation.goBack} />
      <ScrollView ref={scroll} contentContainerStyle={[opsStyles.content, styles.content]} keyboardShouldPersistTaps="handled">
        {c.sections.map((s, i) => (
          <SectionCard key={s.title} icon={c.icon} title={s.title} subtitle={s.subtitle}>
            {s.fields.map(render)}
            {i === 0 && id ? render(statusField) : null}
          </SectionCard>
        ))}
        {!id ? (
          <View style={styles.tip}>
            <Text style={styles.tipText}>{c.tip}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={opsStyles.error}>
            <AlertCircleIcon size={16} color={colors.errorDark} />
            <Text style={opsStyles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FormFooter title={id ? t('common.saveChanges') : t('offers.createSingular', { singular: c.singular })} loading={saving} onSave={save} onCancel={navigation.goBack} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  content: { gap: 12, paddingBottom: 24 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  image: { width: 120, height: 76, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  imageActions: { gap: 8 },
  tip: { padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  tipText: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: '#4338ca' },
});
