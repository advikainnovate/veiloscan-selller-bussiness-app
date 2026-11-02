import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { CheckIcon } from '../icons';

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={8}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <CheckIcon size={13} color={colors.white} strokeWidth={3} /> : null}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  label: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
});
