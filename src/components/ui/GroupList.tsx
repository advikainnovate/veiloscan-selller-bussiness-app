import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';

// Settings-style grouped lists (My Profile, Subscription): a small caps
// title with an optional action, then a white card of label / value rows.

export function Group({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode }) {
  return (
    <View style={groupStyles.group}>
      <View style={groupStyles.head}>
        <Text style={groupStyles.title}>{title.toUpperCase()}</Text>
        {action ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={action.onPress}>
            <Text style={groupStyles.link}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={groupStyles.body}>{children}</View>
    </View>
  );
}

/** A label and its value; `last` drops the divider under the final row. */
export function Row({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <View style={[groupStyles.row, !last && groupStyles.line]}>
      <Text style={groupStyles.label}>{label}</Text>
      {typeof value === 'string' || value == null ? (
        <Text style={groupStyles.value} numberOfLines={2}>
          {value || '—'}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

export const groupStyles = StyleSheet.create({
  group: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  title: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  body: { overflow: 'hidden', paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 46, paddingVertical: 10 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  value: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  muted: { color: colors.textMuted },
  ok: { color: colors.successDark },
});
