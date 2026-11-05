import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { useRevealFocused } from '../layout/KeyboardScroll';
import { colors, radius, fonts } from '../../theme';

const LENGTH = 6;

/**
 * Six digit boxes backed by one hidden input, so paste and the iOS / Android
 * SMS code autofill work as usual.
 */
export function OtpInput({
  value,
  onChange,
  disabled,
  autoFocus,
  dark = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  dark?: boolean;
}) {
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const reveal = useRevealFocused();

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Sign-in code" style={styles.row}>
      {Array.from({ length: LENGTH }, (_, i) => {
        const active = focused && (i === value.length || (i === LENGTH - 1 && value.length === LENGTH));
        return (
          <View key={i} style={[styles.cell, dark && styles.cellDark, value[i] ? (dark ? styles.cellFilledDark : styles.cellFilled) : null, active && styles.cellActive]}>
            <Text style={[styles.digit, dark && styles.digitDark]}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        editable={!disabled}
        autoFocus={autoFocus}
        onFocus={() => {
          setFocused(true);
          reveal();
        }}
        onBlur={() => setFocused(false)}
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cell: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDark: { borderColor: '#cbd5e1', backgroundColor: colors.white },
  cellFilled: { borderColor: colors.secondarySoft, backgroundColor: colors.secondaryLight },
  cellFilledDark: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  cellActive: { borderColor: colors.secondary, borderWidth: 1.5 },
  digit: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  digitDark: { color: colors.primary },
  hiddenInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0.01 },
});
