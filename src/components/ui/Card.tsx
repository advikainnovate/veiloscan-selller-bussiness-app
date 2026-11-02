import React, { type ComponentType, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import type { IconProps } from '../icons';

/** A white section card, optionally titled. */
export function Card({
  title,
  icon: Icon,
  action,
  children,
  style,
  padded = true,
}: {
  title?: string;
  icon?: ComponentType<IconProps>;
  /** Shown at the right of the title. */
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** false for edge-to-edge rows. */
  padded?: boolean;
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          {Icon ? <Icon size={18} color={colors.secondary} /> : null}
          <Text style={styles.title}>{title}</Text>
          {action}
        </View>
      ) : null}
      <View style={padded ? styles.body : null}>{children}</View>
    </View>
  );
}

/** A label / value line inside a card. */
export function Row({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { flex: 1, fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  body: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  rowLabel: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  rowValue: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, textAlign: 'right' },
  rowStrong: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.text },
});
