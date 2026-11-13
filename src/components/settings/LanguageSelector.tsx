import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { LANGUAGES, type LanguageCode } from '../../i18n';
import { CheckIcon } from '../icons';

// Always shown in both scripts, whatever the current language, so anyone can
// find their own language.
export const CHOOSE_LANGUAGE_EN = 'Choose Your Language';
export const CHOOSE_LANGUAGE_HI = 'अपनी भाषा चुनें';
export const CHOOSE_LANGUAGE_TITLE = `${CHOOSE_LANGUAGE_EN} / ${CHOOSE_LANGUAGE_HI}`;

interface Props {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  /** 'dark' on the navy Get Started screen. */
  tone?: 'light' | 'dark';
}

/** One card per language, named in its own script; the picked one is outlined and ticked. */
export function LanguageSelector({ value, onChange, tone = 'light' }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 600;
  const dark = tone === 'dark';

  return (
    <View style={[styles.list, wide && styles.listWide]} accessibilityRole="radiogroup">
      {LANGUAGES.map(language => {
        const selected = language.code === value;
        return (
          <Pressable
            key={language.code}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={language.nativeName === language.englishName ? language.nativeName : `${language.nativeName}, ${language.englishName}`}
            testID={`language-${language.code}`}
            onPress={() => onChange(language.code)}
            style={({ pressed }) => [
              styles.option,
              dark && styles.optionDark,
              selected && (dark ? styles.selectedDark : styles.selected),
              wide && styles.optionWide,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.flag, dark && styles.flagDark]}>
              <Text style={styles.flagText}>{language.flag}</Text>
            </View>
            <View style={styles.names}>
              <Text style={[styles.native, dark && styles.nativeDark]}>{language.nativeName}</Text>
              {language.nativeName !== language.englishName ? (
                <Text style={[styles.english, dark && styles.englishDark]}>{language.englishName}</Text>
              ) : null}
            </View>
            <View style={[styles.radio, dark && styles.radioDark, selected && styles.radioOn]}>
              {selected ? <CheckIcon size={15} color={colors.white} strokeWidth={3} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  listWide: { flexDirection: 'row' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionWide: { flex: 1 },
  optionDark: { borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.06)' },
  selected: { borderWidth: 2, borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  selectedDark: { borderWidth: 2, borderColor: colors.secondary, backgroundColor: 'rgba(255,107,0,0.16)' },
  pressed: { opacity: 0.85 },
  flag: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  flagDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  flagText: { fontSize: 24 },
  names: { flex: 1, gap: 2 },
  // Devanagari needs more room above and below than Latin text: no fixed lineHeight here.
  native: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  nativeDark: { color: colors.white },
  english: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  englishDark: { color: '#c8d3ea' },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioDark: { borderColor: 'rgba(255,255,255,0.4)' },
  radioOn: { borderColor: colors.secondary, backgroundColor: colors.secondary },
});
