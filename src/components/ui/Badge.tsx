import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, radius } from '../../theme';

// The Seller Panel's status pill colours.
export const BADGE_TONES = {
  orange: { bg: '#fff1e6', fg: '#c2410c', border: '#ffd3b3' },
  amber: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  blue: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  violet: { bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe' },
  green: { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
  red: { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  slate: { bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0' },
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ label, tone, style }: { label: string; tone: BadgeTone; style?: StyleProp<ViewStyle> }) {
  const t = BADGE_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  text: { fontFamily: fonts.semibold, fontSize: 11.5 },
});
