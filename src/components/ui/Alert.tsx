import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, fonts } from '../../theme';
import { AlertCircleIcon, CheckCircleIcon } from '../icons';

const VARIANTS = {
  error: { bg: colors.errorLight, border: '#fecaca', text: colors.errorDark, Icon: AlertCircleIcon },
  success: { bg: colors.successLight, border: '#bbf7d0', text: colors.successDark, Icon: CheckCircleIcon },
} as const;

export function Alert({ variant = 'error', message }: { variant?: keyof typeof VARIANTS; message: string }) {
  const v = VARIANTS[variant];
  return (
    <View accessibilityRole="alert" style={[styles.box, { backgroundColor: v.bg, borderColor: v.border }]}>
      <v.Icon size={18} color={v.text} />
      <Text style={[styles.text, { color: v.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  text: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19 },
});
