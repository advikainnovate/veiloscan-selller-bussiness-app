import React, { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, fonts } from '../../theme';
import { Gradient } from './Gradient';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  loadingTitle?: string;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Seller Panel's call to action: an orange gradient, white label and a
 * soft orange glow. `outline` sits on dark backgrounds, `ghost` is text only.
 */
export function Button({ title, onPress, variant = 'primary', loading, loadingTitle, disabled, icon, style }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;
  const textColor = isPrimary ? colors.white : variant === 'outline' ? colors.white : colors.secondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        isPrimary && shadow.button,
        variant === 'outline' && styles.outline,
        { opacity: inactive ? 0.7 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      {isPrimary ? <Gradient colors={[colors.secondary, colors.secondaryDark]} borderRadius={radius.md} /> : null}
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
        <Text style={[styles.label, { color: textColor }]}>{loading && loadingTitle ? loadingTitle : title}</Text>
        {!loading && icon ? icon : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  outline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontFamily: fonts.bold },
});
