import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { isActiveRow, specValueLabel, specValues } from '../../lib/catalog';
import { productSpecificationService } from '../../services/catalog-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, Detail, opsStyles } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { BanIcon, CheckCircleIcon, EditIcon, SlidersIcon } from '../../components/icons';
import { useSpecLookups } from './ProductSpecsScreen';
import type { ScreenProps } from '../../navigation/types';

/** One product specification: its details and values, with Activate / Deactivate and Edit. */
export function ProductSpecDetailScreen({ navigation, route }: ScreenProps<'ProductSpecDetail'>) {
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('product-specifications:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? productSpecificationService.get(id) : Promise.resolve(null)), [allowed, id]);
  const look = useSpecLookups(allowed);

  const title = data ? `${look.productName(data.productId) || '—'} — ${look.specTitle(data.specificationId) || '—'}` : 'Product Specification';
  const header = <AppHeader title={look.specTitle(data?.specificationId) || 'Product Specification'} subtitle="Product Specs" onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label="Product Specs" icon={SlidersIcon} allowed={false} />
      </View>
    );
  }
  if (loading && !data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton rows={2} height={140} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={error || 'Not found.'} onRetry={reload} />
      </View>
    );
  }

  const active = isActiveRow(data);
  const spec = look.spec(data.specificationId);
  const values = specValues(data, look.values);

  async function toggle() {
    if (!(await confirmAction(`${active ? 'Deactivate' : 'Activate'} this specification assignment?`, undefined, active ? 'Deactivate' : 'Activate', active))) return;
    try {
      await productSpecificationService.update(id, { status: active ? 0 : 1 });
      toast(active ? 'Deactivated' : 'Activated');
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      {header}
      <ScrollView contentContainerStyle={opsStyles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <View style={opsStyles.row}>
            <Badge label={active ? 'Active' : 'Inactive'} tone={active ? 'green' : 'slate'} />
            <Text style={opsStyles.muted}>{`${values.length} value${values.length === 1 ? '' : 's'}`}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={toggle} style={[opsStyles.smallBtn, styles.grow]}>
            {active ? <BanIcon size={14} color={colors.text} /> : <CheckCircleIcon size={14} color={colors.text} />}
            <Text style={opsStyles.smallBtnText}>{active ? 'Deactivate' : 'Activate'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={() => navigation.navigate('ProductSpecForm', { id })} style={[opsStyles.primaryBtn, styles.grow]}>
            <EditIcon size={14} color={colors.white} />
            <Text style={opsStyles.primaryBtnText}>Edit</Text>
          </Pressable>
        </View>
        <SectionCard icon={SlidersIcon} title="Details">
          <Detail label="Product" value={look.productName(data.productId)} />
          <Detail label="Specification" value={look.specTitle(data.specificationId)} />
          <Detail label="Type" value={String(spec?.type ?? '')} />
          <Detail label="Required" value={spec?.isRequired ? 'Yes' : 'No'} />
          <Detail label="Created" value={formatDay(data.createdAt)} />
          <Detail label="Updated" value={formatDay(data.updatedAt)} />
        </SectionCard>
        <SectionCard
          icon={SlidersIcon}
          title="Values"
          action={
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ProductSpecForm', { id })}>
              <Text style={styles.link}>Manage Values</Text>
            </Pressable>
          }
        >
          {values.length ? (
            values.map((v, i) => (
              <View key={String(v.id)} style={styles.value}>
                <Text style={styles.seq}>{String(v.sequence ?? i + 1)}</Text>
                <Text style={[opsStyles.title, styles.flex]}>{specValueLabel(v, look.optionTitle) || '—'}</Text>
                <Badge label={v.status === undefined || isActiveRow(v) ? 'Active' : 'Inactive'} tone={v.status === undefined || isActiveRow(v) ? 'green' : 'slate'} />
              </View>
            ))
          ) : (
            <Text style={opsStyles.muted}>No values added yet.</Text>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  head: { gap: 6 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  link: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary },
  value: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  seq: { width: 22, fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
});
