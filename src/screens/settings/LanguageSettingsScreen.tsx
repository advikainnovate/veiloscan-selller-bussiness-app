import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, shadow } from '../../theme';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { AppHeader } from '../../components/layout/AppHeader';
import { CHOOSE_LANGUAGE_TITLE, LanguageSelector } from '../../components/settings/LanguageSelector';
import { Group, Row } from '../../components/ui/GroupList';
import { CheckCircleIcon, ClockIcon } from '../../components/icons';
import { formatNumber, formatRupees } from '../../lib/format';
import { formatDay, formatTime } from '../../lib/date';
import type { LanguageCode } from '../../i18n';
import type { ScreenProps } from '../../navigation/types';

/** Settings › Language & Region: the interface language, and how numbers, money and dates are shown. */
export function LanguageSettingsScreen({ navigation }: ScreenProps<'LanguageSettings'>) {
  const { t } = useTranslation();
  const toast = useToast();
  const { language, sync, setLanguage } = useLanguage();
  const now = new Date();

  const choose = async (code: LanguageCode) => {
    if (code === language) return;
    await setLanguage(code);
    // Shown in the new language.
    toast(t('settings.languageChanged'));
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('nav.languageAndRegion')} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            {CHOOSE_LANGUAGE_TITLE}
          </Text>
          <Text style={styles.hint}>{t('settings.languageHint')}</Text>
          <LanguageSelector value={language} onChange={choose} />
          <View style={styles.sync}>
            {sync === 'pending' ? <ClockIcon size={16} color={colors.warningDark} /> : <CheckCircleIcon size={16} color={colors.successDark} />}
            <Text style={[styles.syncText, sync === 'pending' && styles.syncPending]}>
              {sync === 'pending' ? t('settings.savedOnDevicePending') : sync === 'synced' ? t('settings.savedToAccount') : t('settings.savedOnDevice')}
            </Text>
          </View>
        </View>

        <Group title={t('settings.region')}>
          <Row label={t('settings.country')} value={t('settings.india')} />
          <Row label={t('settings.currency')} value={t('settings.currencyValue')} />
          <Row label={t('settings.numberFormat')} value={formatNumber(1234567.5)} />
          <Row label={t('settings.moneyFormat')} value={formatRupees(12500)} />
          <Row label={t('settings.dateFormat')} value={`${formatDay(now)}, ${formatTime(now)}`} last />
        </Group>
        <Text style={styles.footnote}>{t('settings.businessDataNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 18, padding: 16, paddingBottom: 40 },
  card: { gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary },
  sync: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  syncText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.successDark },
  syncPending: { color: colors.warningDark },
  footnote: { paddingHorizontal: 4, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
});
