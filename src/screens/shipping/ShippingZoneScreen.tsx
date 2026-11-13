import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { isActiveRow } from '../../lib/catalog';
import { coveredLabel, EMPTY_METHOD, etaLabel, methodFromRecord, methodPayload, methodProblem, RATE_TYPES, rateLabel, slugify, type MethodForm, type RateType } from '../../lib/shipping';
import { shippingMethodService, shippingZoneService } from '../../services/shipping-service';
import type { Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Choices, Field, Input } from '../../components/form/Fields';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, Detail, opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { AlertCircleIcon, BanIcon, CheckCircleIcon, ClockIcon, EditIcon, PlusIcon, TrashIcon, TruckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/** One shipping zone: its details and its shipping methods, added and edited here. */
export function ShippingZoneScreen({ navigation, route }: ScreenProps<'ShippingZone'>) {
  const { t } = useTranslation();
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('shipping:manage');
  const zone = useFetch(() => (allowed ? shippingZoneService.get(id) : Promise.resolve(null)), [allowed, id]);
  const all = useFetch(() => (allowed ? shippingMethodService.list() : Promise.resolve([])), [allowed]);
  const methods = useMemo(() => (all.data ?? []).filter(m => m.zoneId === id), [all.data, id]);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);

  const header = <AppHeader title={String(zone.data?.zoneTitle ?? t('shipping.shippingZone'))} subtitle={t('shipping.shipping')} onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label={t('shipping.shipping')} icon={TruckIcon} allowed={false} />
      </View>
    );
  }
  if (zone.loading && !zone.data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton rows={3} height={120} />
      </View>
    );
  }
  if (!zone.data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={zone.error || t('common.notFound')} onRetry={zone.reload} />
      </View>
    );
  }

  const z = zone.data;
  const on = isActiveRow(z);

  async function toggleZone() {
    if (!(await confirmAction(on ? t('shipping.deactivateThisZone') : t('shipping.activateThisZone'), undefined, on ? t('common.deactivate') : t('common.activate'), on))) return;
    try {
      await shippingZoneService.update(id, { status: on ? 0 : 1 });
      toast(on ? t('shipping.zoneDeactivated') : t('shipping.zoneActivated'));
      zone.reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function toggleMethod(m: Row) {
    const mOn = isActiveRow(m);
    try {
      await shippingMethodService.update(m.id, { status: mOn ? 0 : 1 });
      toast(mOn ? t('shipping.methodDeactivated') : t('shipping.methodActivated'));
      all.reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function removeMethod(m: Row) {
    if (!(await confirmAction(t('shipping.deleteShippingMethod'), t('shipping.methodtitleWillBeRemovedFromThis', { methodTitle: String(m.methodTitle) }), t('common.delete'), true))) return;
    try {
      await shippingMethodService.remove(m.id);
      toast(t('shipping.shippingMethodDeleted'));
      all.reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={opsStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={zone.loading}
            onRefresh={() => {
              zone.reload();
              all.reload();
            }}
          />
        }
      >
        <View style={styles.head}>
          <View style={styles.flex}>
            <Badge label={on ? t('common.active') : t('common.inactive')} tone={on ? 'green' : 'slate'} />
            <Text style={[opsStyles.meta, styles.count]}>{t('shipping.shippingMethodCount', { count: methods.length })}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={toggleZone} style={opsStyles.smallBtn}>
            {on ? <BanIcon size={14} color={colors.text} /> : <CheckCircleIcon size={14} color={colors.text} />}
            <Text style={opsStyles.smallBtnText}>{on ? t('common.deactivate') : t('common.activate')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('shipping.editZone')} onPress={() => navigation.navigate('ShippingZoneForm', { id })} style={opsStyles.smallBtn}>
            <EditIcon size={14} color={colors.text} />
            <Text style={opsStyles.smallBtnText}>{t('common.edit')}</Text>
          </Pressable>
        </View>

        <SectionCard icon={TruckIcon} title={t('common.details')}>
          <Detail label={t('common.slug')} value={String(z.zoneSlug ?? '')} />
          <Detail label={t('shipping.coveredStates')} value={coveredLabel(z.coveredStates)} />
          <Detail label={t('common.created')} value={formatDay(z.createdAt)} />
          <Detail label={t('common.updated')} value={formatDay(z.updatedAt)} />
          {z.description ? <Text style={opsStyles.meta}>{String(z.description)}</Text> : null}
        </SectionCard>

        <SectionCard
          icon={ClockIcon}
          title={t('shipping.shippingMethods')}
          subtitle={t('shipping.eachMethodCanUseAFixed')}
          action={
            <Pressable accessibilityRole="button" accessibilityLabel={t('shipping.addMethod')} onPress={() => setEditing('new')} style={styles.add}>
              <PlusIcon size={14} color={colors.white} strokeWidth={2.4} />
              <Text style={styles.addText}>{t('common.add')}</Text>
            </Pressable>
          }
        >
          {methods.length ? (
            methods.map(m => {
              const mOn = isActiveRow(m);
              const eta = etaLabel(m);
              return (
                <View key={m.id} style={styles.method}>
                  <View style={styles.methodHead}>
                    <View style={styles.flex}>
                      <Text style={opsStyles.title}>{String(m.methodTitle)}</Text>
                      <Text style={opsStyles.muted}>{String(m.methodSlug ?? '')}</Text>
                    </View>
                    <Badge label={mOn ? t('common.active') : t('common.inactive')} tone={mOn ? 'green' : 'slate'} />
                  </View>
                  <View style={styles.facts}>
                    <Fact label={t('shipping.rate')} value={rateLabel(m)} strong />
                    <Fact label={t('shipping.freeAbove')} value={m.freeAboveOrderValue ? `₹${Number(m.freeAboveOrderValue).toLocaleString('en-IN')}` : '—'} />
                    <Fact label={t('common.delivery')} value={eta ?? '—'} />
                  </View>
                  <View style={styles.methodActions}>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('shipping.editMethodtitle', { methodTitle: String(m.methodTitle) })} onPress={() => setEditing(m)} style={[opsStyles.smallBtn, styles.grow]}>
                      <EditIcon size={13} color={colors.text} />
                      <Text style={opsStyles.smallBtnText}>{t('common.edit')}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${mOn ? 'Deactivate' : 'Activate'} ${String(m.methodTitle)}`} onPress={() => toggleMethod(m)} style={[opsStyles.smallBtn, styles.grow]}>
                      <Text style={opsStyles.smallBtnText}>{mOn ? t('common.deactivate') : t('common.activate')}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('shipping.deleteMethodtitle', { methodTitle: String(m.methodTitle) })} onPress={() => removeMethod(m)} style={opsStyles.smallBtn}>
                      <TrashIcon size={14} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.empty}>
              <Text style={[opsStyles.muted, styles.center]}>{t('shipping.noShippingMethodsYetAddThe')}</Text>
              <Button title={t('shipping.addShippingMethod')} onPress={() => setEditing('new')} />
            </View>
          )}
        </SectionCard>
      </ScrollView>

      <MethodSheet
        visible={!!editing}
        zoneId={id}
        method={editing && editing !== 'new' ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          all.reload();
        }}
      />
    </View>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.flex}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, strong && styles.strong]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Add or edit one shipping method of the zone. */
function MethodSheet({ visible, zoneId, method, onClose, onSaved }: { visible: boolean; zoneId: string; method: Row | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState<MethodForm>(EMPTY_METHOD);
  // The slug follows the title until it's typed in by hand.
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof MethodForm>(k: K, v: MethodForm[K]) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!visible) return;
    setForm(method ? methodFromRecord(method) : EMPTY_METHOD);
    setSlugTouched(!!method);
    setError('');
  }, [visible, method]);

  async function save() {
    setError('');
    const problem = methodProblem(form);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      const payload = methodPayload(form, zoneId);
      if (method) await shippingMethodService.update(method.id, { ...payload, status: Number(form.status) });
      else await shippingMethodService.create(payload);
      toast(method ? t('shipping.shippingMethodUpdated') : t('shipping.shippingMethodAdded'));
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const rate = RATE_TYPES.find(r => r.value === form.rateType)!;
  return (
    <Sheet visible={visible} title={method ? t('shipping.editShippingMethod') : t('shipping.addShippingMethod')} onClose={onClose} footer={<Button title={method ? t('common.saveChanges') : t('shipping.addMethod2')} loading={saving} onPress={save} />}>
      <Field label={t('shipping.methodTitle')} required>
        <Input
          value={form.methodTitle}
          onChangeText={v => setForm(f => ({ ...f, methodTitle: v, methodSlug: slugTouched ? f.methodSlug : slugify(v) }))}
          placeholder="e.g. Standard Delivery"
          maxLength={255}
          accessibilityLabel={t('shipping.methodTitle')}
        />
      </Field>
      <Field label={t('common.slug')} required>
        <Input
          value={form.methodSlug}
          onChangeText={v => {
            setSlugTouched(true);
            set('methodSlug', v);
          }}
          autoCapitalize="none"
          maxLength={255}
          accessibilityLabel={t('shipping.methodSlug')}
        />
      </Field>
      <Field label={t('shipping.rateType')} hint={rate.hint}>
        <Choices options={RATE_TYPES.map(r => ({ value: r.value, label: r.label }))} value={form.rateType} onChange={v => set('rateType', v as RateType)} />
      </Field>
      <Field label={form.rateType === 'PERCENTAGE_OF_ORDER' ? t('shipping.ratePercent') : form.rateType === 'PER_KG' ? t('shipping.rateRsPerKg') : t('shipping.rateRs')} required>
        <Input value={form.rate} onChangeText={v => set('rate', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="49.00" accessibilityLabel={t('shipping.rate')} />
      </Field>
      <Field label={t('shipping.freeAboveOrderValueRs')} hint={t('shipping.ordersWorthThisOrMoreShip')}>
        <Input value={form.freeAboveOrderValue} onChangeText={v => set('freeAboveOrderValue', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="999.00" accessibilityLabel={t('shipping.freeAbove2')} />
      </Field>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label={t('shipping.minDays')}>
            <Input value={form.estimatedDaysMin} onChangeText={v => set('estimatedDaysMin', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="3" accessibilityLabel={t('shipping.minDays')} />
          </Field>
        </View>
        <View style={styles.flex}>
          <Field label={t('shipping.maxDays')}>
            <Input value={form.estimatedDaysMax} onChangeText={v => set('estimatedDaysMax', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="5" accessibilityLabel={t('shipping.maxDays')} />
          </Field>
        </View>
      </View>
      {method ? (
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
      {error ? (
        <View style={opsStyles.error}>
          <AlertCircleIcon size={16} color={colors.errorDark} />
          <Text style={opsStyles.errorText}>{error}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { marginTop: 4 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.secondary },
  addText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  method: { gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  methodHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  facts: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.background },
  factLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textMuted },
  factValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  strong: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  methodActions: { flexDirection: 'row', gap: 8 },
  empty: { gap: 12, paddingVertical: 8 },
});
