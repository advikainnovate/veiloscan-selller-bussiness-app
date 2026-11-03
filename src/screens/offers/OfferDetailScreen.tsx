import React from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay } from '../../lib/date';
import { isActiveRow } from '../../lib/catalog';
import { discountLabel, displayValue, isExpired, OFFERS, offerTitle } from '../../lib/offers';
import { offerService } from '../../services/offers-service';
import type { Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { Group, Row as InfoRow } from '../../components/ui/GroupList';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { confirmAction, opsStyles } from '../../components/operations/OpsParts';
import { BanIcon, CheckCircleIcon, EditIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

/** One freebie / gift card / promotion: its details by section, with Activate / Deactivate and Edit. */
export function OfferDetailScreen({ navigation, route }: ScreenProps<'OfferDetail'>) {
  const { kind, id } = route.params;
  const c = OFFERS[kind];
  const service = offerService(kind);
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission(c.permission);
  const { data, error, loading, reload } = useFetch(() => (allowed ? service.get(id) : Promise.resolve(null)), [allowed, kind, id]);

  const header = <AppHeader title={data ? offerTitle(c, data) : c.singular} subtitle={c.title} onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label={c.title} icon={c.icon} allowed={false} />
      </View>
    );
  }
  if (loading && !data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton rows={3} height={130} />
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

  const r = data;
  const on = isActiveRow(r);
  const expired = isExpired(r);
  const image = kind === 'gift-cards' ? ((r.imageFile as Row | undefined)?.url as string | undefined) : undefined;
  const description = String(r.description ?? r.gcDescription ?? '');
  const Icon = c.icon;

  async function toggle() {
    if (!(await confirmAction(`${on ? 'Deactivate' : 'Activate'} this ${c.singular.toLowerCase()}?`, undefined, on ? 'Deactivate' : 'Activate', on))) return;
    try {
      await service.update(id, { status: on ? 0 : 1 });
      toast(`${c.singular} ${on ? 'deactivated' : 'activated'}`);
      reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  return (
    <View style={opsStyles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>{image ? <Image source={{ uri: image }} style={styles.fill} resizeMode="cover" /> : <Icon size={26} color={colors.secondary} />}</View>
          <View style={styles.flex}>
            <Text style={styles.title}>{offerTitle(c, r)}</Text>
            <View style={styles.wrap}>
              <Badge label={on ? 'Active' : 'Inactive'} tone={on ? 'green' : 'slate'} />
              {expired ? <Badge label="Expired" tone="amber" /> : null}
              {kind === 'promotions' && r.discountValue ? <Badge label={discountLabel(r)} tone="blue" /> : null}
            </View>
          </View>
        </View>
        {description && kind !== 'gift-cards' ? <Text style={styles.description}>{description}</Text> : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={toggle} style={[opsStyles.smallBtn, styles.grow]}>
            {on ? <BanIcon size={14} color={colors.text} /> : <CheckCircleIcon size={14} color={colors.text} />}
            <Text style={opsStyles.smallBtnText}>{on ? 'Deactivate' : 'Activate'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={() => navigation.navigate('OfferForm', { kind, id })} style={[opsStyles.primaryBtn, styles.grow]}>
            <EditIcon size={14} color={colors.white} />
            <Text style={opsStyles.primaryBtnText}>Edit</Text>
          </Pressable>
        </View>

        {c.sections.map(s => {
          // Long text reads better as a paragraph than in a row.
          const rows = s.fields.filter(f => f.type !== 'multiline' && f.type !== 'image' && f.key !== c.titleKey);
          const texts = s.fields.filter(f => f.type === 'multiline' && r[f.key] && !(f.key === 'description' && kind !== 'gift-cards'));
          if (!rows.length && !texts.length) return null;
          return (
            <Group key={s.title} title={s.title}>
              {rows.map((f, i) => (
                <InfoRow key={f.key} label={f.label.replace(/ \(.*\)$/, '')} value={f.key === 'discountValue' ? discountLabel(r) : displayValue(f, r)} last={i === rows.length - 1 && !texts.length} />
              ))}
              {texts.map(f => (
                <View key={f.key} style={styles.text}>
                  <Text style={styles.textLabel}>{f.label}</Text>
                  <Text style={opsStyles.meta}>{String(r[f.key])}</Text>
                </View>
              ))}
            </Group>
          );
        })}

        <Group title="Record">
          <InfoRow label="Created" value={formatDay(r.createdAt)} />
          <InfoRow label="Updated" value={formatDay(r.updatedAt)} last />
        </Group>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  grow: { flexGrow: 1, justifyContent: 'center' },
  content: { gap: 14, padding: 16, paddingBottom: 40 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 56, height: 56, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#fff7ed' },
  title: { marginBottom: 6, fontFamily: fonts.extrabold, fontSize: 19, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  description: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: 8 },
  text: { gap: 4, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, borderRadius: radius.sm },
  textLabel: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
});
