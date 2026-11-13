import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en/translation.json';
import hi from '../locales/hi/translation.json';

// The app's interface languages. Business data (product, brand, category,
// customer, supplier and store names, SKUs, barcodes, descriptions) is shown
// exactly as entered and never goes through t().
//
// Components:  const { t } = useTranslation();  t('orders.acceptOrder')
// Elsewhere:   import i18n from '../i18n';      i18n.t('orders.acceptOrder')
// Labels in module-level constants are getters (get label() { return i18n.t(...) }),
// so they read the current language each time they're used.
//
// Keys live in src/locales/<lang>/translation.json, one object per module
// (common, nav, orders, products…). A key missing in Hindi falls back to English.

export const LANGUAGES = [
  { code: 'en', nativeName: 'English', englishName: 'English', flag: '🇬🇧' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some(l => l.code === value);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map(l => l.code),
  // Resources are bundled, so start synchronously: the first render is already translated.
  initAsync: false,
  // React Native renders text, not HTML.
  interpolation: { escapeValue: false },
  // An empty or missing Hindi string shows the English one instead of nothing.
  returnNull: false,
  returnEmptyString: false,
  react: { useSuspense: false },
  missingKeyHandler: __DEV__
    ? (_lngs, _ns, key) => console.warn(`[i18n] missing key: ${key}`)
    : undefined,
  saveMissing: __DEV__,
});

export default i18n;
