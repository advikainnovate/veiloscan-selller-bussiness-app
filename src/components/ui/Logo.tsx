import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '../../theme';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const markColor = require('../../assets/brand/logo-mark-color.png');
const markWhite = require('../../assets/brand/logo-mark-white.png');

interface LogoProps {
  variant?: 'color' | 'white';
  layout?: 'horizontal' | 'stacked';
  size?: number;
  showWordmark?: boolean;
  tagline?: string | null;
  style?: StyleProp<ViewStyle>;
}

/** The VeiloScan mark and wordmark, as in the Seller Panel. */
export function Logo({
  variant = 'color',
  layout = 'horizontal',
  size = 40,
  showWordmark = true,
  tagline = i18n.t('ui.d2cECommercePlatform'),
  style,
}: LogoProps) {
  const { t } = useTranslation();
  const isWhite = variant === 'white';
  const isStacked = layout === 'stacked';
  const wordSize = Math.max(20, Math.round(size * 0.55));

  return (
    <View style={[isStacked ? styles.stacked : styles.horizontal, style]}>
      <Image source={isWhite ? markWhite : markColor} style={{ width: size, height: size }} resizeMode="contain" />
      {showWordmark ? (
        <View style={isStacked ? styles.center : null}>
          <Text style={[styles.wordmark, { fontSize: wordSize, color: isWhite ? colors.white : colors.text }]}>
            {t('common.veilo')}<Text style={styles.accent}>{t('common.scan')}</Text>
          </Text>
          {tagline ? (
            <Text style={[styles.tagline, isWhite ? styles.taglineWhite : null]}>
              {tagline.toUpperCase()}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  horizontal: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stacked: { alignItems: 'center', gap: 12 },
  center: { alignItems: 'center' },
  wordmark: { fontFamily: fonts.extrabold, letterSpacing: -0.5 },
  accent: { color: colors.secondary },
  tagline: { marginTop: 2, fontSize: 10, fontFamily: fonts.semibold, letterSpacing: 2, color: colors.textMuted },
  taglineWhite: { color: 'rgba(255,255,255,0.6)' },
});
