import React, { useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { colors, radius, fonts } from '../../theme';
import { useRevealFocused } from '../layout/KeyboardScroll';

export interface TextFieldProps extends TextInputProps {
  label: string;
  icon?: ReactNode;
  /** Shown at the right of the label row, e.g. "Forgot Password?". */
  labelExtra?: ReactNode;
  /** Shown inside the field, at the right, e.g. the show-password toggle. */
  trailing?: ReactNode;
  error?: string | null;
  ref?: Ref<TextInputInstance>;
}

/** A labelled input with a leading icon; the border turns orange on focus. */
export function TextField({ label, icon, labelExtra, trailing, error, style, onFocus, onBlur, ref, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const reveal = useRevealFocused();
  const borderColor = error ? colors.error : focused ? colors.borderFocus : colors.border;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelExtra}
      </View>
      <View style={[styles.field, { borderColor }, focused && styles.fieldFocused]}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.secondary}
          style={[styles.input, style]}
          onFocus={e => {
            setFocused(true);
            // Inside a KeyboardScroll: keep the field above the keyboard.
            reveal();
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />
        {trailing}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  field: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    gap: 10,
  },
  fieldFocused: { backgroundColor: colors.white, borderWidth: 1.5 },
  icon: { width: 20, alignItems: 'center' },
  input: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 15, color: colors.text, paddingVertical: 0 },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.error },
});
