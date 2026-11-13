import React, { useEffect, useRef, type ComponentType } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { AlertCircleIcon, CloseIcon, SearchIcon, type IconProps } from '../icons';
import { useTranslation } from 'react-i18next';

/** The search box at the top of a list. */
export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (text: string) => void; placeholder: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.search}>
      <SearchIcon size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.secondary}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        style={styles.searchInput}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('ui.clearSearch')} hitSlop={10} onPress={() => onChange('')}>
          <CloseIcon size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

/** Horizontally scrolling filter chips; the selected one is orange. */
export function FilterChips({ options, value, onChange }: { options: ChipOption[]; value: string; onChange: (value: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            {option.count !== undefined ? (
              <View style={[styles.count, selected && styles.countSelected]}>
                <Text style={[styles.countText, selected && styles.countTextSelected]}>{option.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Nothing to show (or nothing matches). */
export function EmptyState({ icon: Icon, title, text }: { icon: ComponentType<IconProps>; title: string; text?: string }) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Icon size={28} color={colors.secondary} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {text ? <Text style={styles.stateText}>{text}</Text> : null}
    </View>
  );
}

/** A load failed; tap to try again. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, styles.stateIconError]}>
        <AlertCircleIcon size={28} color={colors.error} />
      </View>
      <Text style={styles.stateTitle}>{t('ui.couldnTLoadThis')}</Text>
      <Text style={styles.stateText}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>{t('ui.tryAgain')}</Text>
      </Pressable>
    </View>
  );
}

/** Placeholder cards while a list loads. */
export function ListSkeleton({ rows = 5, height = 92 }: { rows?: number; height?: number }) {
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={styles.skeletons} accessibilityLabel={t('ui.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <Animated.View key={i} style={[styles.skeleton, { height, opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, height: '100%', paddingVertical: 0, fontFamily: fonts.regular, fontSize: 14.5, color: colors.text },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  chipTextSelected: { color: colors.white },
  count: { minWidth: 20, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  countSelected: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countText: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary },
  countTextSelected: { color: colors.white },
  state: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryLight,
  },
  stateIconError: { backgroundColor: colors.errorLight },
  stateTitle: { marginTop: 14, fontSize: 16, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  stateText: { marginTop: 6, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  retry: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.secondary },
  retryText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  skeletons: { gap: 12 },
  skeleton: { borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
});
