import React, { useState } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, shadow } from '../theme';
import { Logo } from '../components/ui/Logo';
import { Gradient } from '../components/ui/Gradient';
import { ArrowRightIcon, CheckIcon } from '../components/icons';
import { BottomWaves } from '../components/auth/LoginArt';
import { setOnboarded } from '../lib/session';
import { useLanguage } from '../context/LanguageContext';
import { CHOOSE_LANGUAGE_EN, CHOOSE_LANGUAGE_HI, LanguageSelector } from '../components/settings/LanguageSelector';
import type { ScreenProps } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

const slides = [
  {
    image: require('../assets/onboarding/store.jpg'),
    get title() { return i18n.t('auth.manageYourStore'); },
    get description() { return i18n.t('auth.addProductsUpdateInventoryAndHandle'); },
  },
  {
    image: require('../assets/onboarding/orders.jpg'),
    get title() { return i18n.t('auth.trackOrders'); },
    get description() { return i18n.t('auth.stayUpdatedWithNewOrdersPayments'); },
  },
  {
    image: require('../assets/onboarding/growth.jpg'),
    get title() { return i18n.t('common.growYourBusiness'); },
    get description() { return i18n.t('auth.seeSalesCustomersAndReportsTo'); },
  },
];

export function GetStartedScreen({ navigation }: ScreenProps<'GetStarted'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // First launch starts with the language, so everything after it is in that language.
  const { language, setLanguage } = useLanguage();
  const [pickingLanguage, setPickingLanguage] = useState(true);
  const compact = height < 760;
  const slide = slides[index];
  const artWidth = Math.min(width - 28, height * (compact ? 0.34 : 0.43) * (670 / 600));
  const artHeight = artWidth * (600 / 670);

  async function finishOnboarding() {
    await setOnboarded();
    navigation.replace('Login');
  }

  function next() {
    if (index === slides.length - 1) {
      void finishOnboarding();
      return;
    }
    setIndex(current => current + 1);
  }

  const brandHeader = (
    <View style={[styles.header, { paddingTop: insets.top + (compact ? 5 : 12) }]}>
      <Logo variant="white" layout="stacked" size={compact ? 54 : 62} tagline={null} />
      <View style={styles.appTitleRow}>
        <View style={styles.headerRule} />
        <Text style={styles.appTitle}>{t('auth.sellerApp')}</Text>
        <View style={styles.headerRule} />
      </View>
    </View>
  );

  if (pickingLanguage) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />
        {brandHeader}
        <View style={styles.languageStage}>
          <View style={styles.languageTitles}>
            <Text style={[styles.languageTitle, compact && styles.titleCompact]} accessibilityRole="header">
              {CHOOSE_LANGUAGE_EN}
            </Text>
            <Text style={[styles.languageTitle, styles.languageTitleHi, compact && styles.titleCompact]}>{CHOOSE_LANGUAGE_HI}</Text>
          </View>
          <LanguageSelector tone="dark" value={language} onChange={setLanguage} />
          <Text style={styles.languageHint}>{t('settings.changeAnytime')}</Text>
        </View>
        <View style={[styles.actions, styles.actionsEnd, { marginBottom: compact ? 8 : 14 }]}>
          <Pressable accessibilityRole="button" onPress={() => setPickingLanguage(false)} style={styles.nextButton}>
            <Gradient colors={['#ff9c00', '#ff5b00']} borderRadius={32} />
            <View style={styles.nextContent}>
              <Text style={styles.nextText}>{t('common.continue')}</Text>
              <ArrowRightIcon size={22} color={colors.white} strokeWidth={2.4} />
            </View>
          </Pressable>
        </View>
        <BottomWaves height={(compact ? 45 : 58) + insets.bottom} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {brandHeader}

      <View style={styles.artStage}>
        <Image source={slide.image} style={{ width: artWidth, height: artHeight }} resizeMode="contain" />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
          {slide.title}
        </Text>
        <Text style={[styles.description, compact && styles.descriptionCompact]}>{slide.description}</Text>
      </View>

      <View style={styles.dots} accessibilityLabel={t('auth.onboardingPageIndexOfSlidescount', { index: index + 1, slidesCount: slides.length })}>
        {slides.map((item, dotIndex) => (
          <View key={item.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.actions, { marginBottom: compact ? 8 : 14 }]}>
        <Pressable accessibilityRole="button" onPress={() => { void finishOnboarding(); }} hitSlop={12} style={styles.skip}>
          <Text style={styles.skipText}>{t('auth.skip')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={next} style={styles.nextButton}>
          <Gradient colors={['#ff9c00', '#ff5b00']} borderRadius={32} />
          <View style={styles.nextContent}>
            <Text style={styles.nextText}>{index === slides.length - 1 ? t('auth.getStarted') : t('auth.next')}</Text>
            {index === slides.length - 1
              ? <CheckIcon size={22} color={colors.white} strokeWidth={2.8} />
              : <ArrowRightIcon size={22} color={colors.white} strokeWidth={2.4} />}
          </View>
        </Pressable>
      </View>

      <BottomWaves height={(compact ? 45 : 58) + insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#031b43' },
  header: { alignItems: 'center', paddingHorizontal: 20 },
  appTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5 },
  headerRule: { width: 28, height: 1.5, backgroundColor: 'rgba(255,255,255,0.82)' },
  appTitle: { color: colors.white, fontFamily: fonts.semibold, fontSize: 19, letterSpacing: -0.3 },
  artStage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  copy: { alignItems: 'center', paddingHorizontal: 26 },
  title: { color: colors.white, fontFamily: fonts.bold, fontSize: 31, lineHeight: 38, textAlign: 'center', letterSpacing: -0.6 },
  titleCompact: { fontSize: 27, lineHeight: 33 },
  description: { marginTop: 8, color: '#d4def4', fontFamily: fonts.regular, fontSize: 17, lineHeight: 23, textAlign: 'center' },
  descriptionCompact: { fontSize: 15, lineHeight: 20, marginTop: 5 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#536b9f' },
  dotActive: { backgroundColor: '#ff7900' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26 },
  skip: { paddingVertical: 14, paddingRight: 18 },
  skipText: { color: '#d9e2f7', fontFamily: fonts.medium, fontSize: 19 },
  nextButton: { minWidth: 174, height: 58, borderRadius: 32, overflow: 'hidden', justifyContent: 'center', ...shadow.button },
  nextContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  nextText: { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  languageStage: { flex: 1, justifyContent: 'center', gap: 22, paddingHorizontal: 22, width: '100%', maxWidth: 640, alignSelf: 'center' },
  languageTitles: { alignItems: 'center', gap: 4 },
  languageTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 27, textAlign: 'center', letterSpacing: -0.4 },
  // Devanagari: no letter-spacing (it breaks the joined headline) and room for the matras.
  languageTitleHi: { color: '#ffb366', letterSpacing: 0, paddingTop: 4 },
  languageHint: { color: '#c8d3ea', fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  actionsEnd: { justifyContent: 'flex-end' },
});
