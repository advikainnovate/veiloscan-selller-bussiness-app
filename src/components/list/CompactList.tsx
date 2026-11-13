import React, { type ComponentType, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '../../theme';
import { Sheet } from '../ui/Sheet';
import { PlusIcon, type IconProps } from '../icons';
import { useTranslation } from 'react-i18next';

// The compact, app-native list layout (Quantity Discount Slabs, the catalog
// pages): search and count tiles fixed on top, tight row cards, and a
// floating button to add one.

export interface Tile {
  key: string;
  label: string;
  count: number | string;
  color: string;
  tint: string;
  /** A figure only: it doesn't filter. */
  info?: boolean;
}

export const TILE_COLORS = {
  green: { color: '#059669', tint: '#ecfdf5' },
  blue: { color: '#0284c7', tint: '#f0f9ff' },
  slate: { color: '#64748b', tint: '#f1f5f9' },
  amber: { color: '#d97706', tint: '#fffbeb' },
  red: { color: '#dc2626', tint: '#fef2f2' },
  orange: { color: '#ea580c', tint: '#fff7ed' },
  violet: { color: '#7c3aed', tint: '#f5f3ff' },
};

/** Counts that double as filters: tap one to filter to it, again to clear. Without onSelect (or marked info) a tile is just a figure. */
export function CountTiles({ tiles, value, onSelect, loading }: { tiles: Tile[]; value?: string; onSelect?: (key: string) => void; loading?: boolean }) {
  return (
    <View style={styles.tiles}>
      {tiles.map(t => {
        const on = value === t.key;
        const body = (
          <>
            <Text style={[styles.tileCount, { color: t.color }]} numberOfLines={1} adjustsFontSizeToFit>
              {loading ? '–' : String(t.count)}
            </Text>
            <Text style={styles.tileLabel} numberOfLines={1}>
              {t.label}
            </Text>
          </>
        );
        return onSelect && !t.info ? (
          <Pressable
            key={t.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t.label}: ${t.count}`}
            onPress={() => onSelect(on ? '' : t.key)}
            style={[styles.tile, { backgroundColor: t.tint }, on && { borderColor: t.color }]}
          >
            {body}
          </Pressable>
        ) : (
          <View key={t.key} style={[styles.tile, { backgroundColor: t.tint }]}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** The fixed block above a list: search, tiles, a summary line. */
export function ListTop({ children }: { children: ReactNode }) {
  return <View style={styles.top}>{children}</View>;
}

/** "3 warehouses" or, while filtering, "Clear · 2 of 5". */
export function SummaryLine({ hint, filtered, shown, total, noun, onClear, extra }: { hint?: string; filtered: boolean; shown: number; total: number; noun: string; onClear: () => void; extra?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={styles.summary}>
      <Text style={[styles.hint, styles.flex]} numberOfLines={2}>
        {hint ?? ''}
      </Text>
      {extra}
      {filtered ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onClear}>
          <Text style={styles.clear}>{t('ui.clearShownOfTotal', { shown, total })}</Text>
        </Pressable>
      ) : (
        <Text style={styles.hint}>{`${total} ${noun}${total === 1 ? '' : 's'}`}</Text>
      )}
    </View>
  );
}

/** The floating add button, bottom right. */
export function Fab({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel?: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && styles.pressed]}
    >
      <PlusIcon size={18} color={colors.white} strokeWidth={2.6} />
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

/** Room under a list for the floating button. */
export function useListPadding() {
  const insets = useSafeAreaInsets();
  return [styles.list, { paddingBottom: insets.bottom + 96 }];
}

export function Separator() {
  return <View style={styles.separator} />;
}

/** One tight row card. */
export function RowCard({ label, onPress, children }: { label: string; onPress?: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {children}
    </Pressable>
  );
}

export interface SheetAction {
  label: string;
  icon: ComponentType<IconProps>;
  danger?: boolean;
  hidden?: boolean;
  onPress: () => void;
}

/** A row's actions, as a bottom sheet. */
export function ActionSheet({ visible, title, subtitle, actions, onClose }: { visible: boolean; title: string; subtitle?: string; actions: SheetAction[]; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      {actions
        .filter(a => !a.hidden)
        .map(a => {
          const Icon = a.icon;
          return (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={styles.action}
            >
              <Icon size={18} color={a.danger ? colors.error : colors.text} />
              <Text style={[styles.actionText, a.danger && styles.danger]}>{a.label}</Text>
            </Pressable>
          );
        })}
    </Sheet>
  );
}

export const compactStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb: { width: 36, height: 36, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  thumbImage: { width: '100%', height: '100%' },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  line: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  chip: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, backgroundColor: colors.background },
  more: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dots: { fontFamily: fonts.bold, fontSize: 18, color: colors.textMuted },
  empty: { minHeight: 300 },
});

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  top: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
  tileCount: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 22 },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  clear: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
  list: { padding: 12 },
  separator: { height: 8 },
  row: { gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.card },
  rowPressed: { backgroundColor: colors.background },
  fab: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, height: 50, paddingHorizontal: 18, borderRadius: 25, backgroundColor: colors.secondary, ...shadow.button },
  fabText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.white },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  actionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  danger: { color: colors.error },
});
