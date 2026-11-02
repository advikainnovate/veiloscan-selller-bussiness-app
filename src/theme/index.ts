import { Platform } from 'react-native';

export { colors, featureTones } from './colors';
export type { FeatureTone } from './colors';

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// The card shadow from the Seller Panel (--shadow-card).
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#061b3a',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
    },
    default: { elevation: 3 },
  }),
  raised: Platform.select({
    ios: {
      shadowColor: '#78350f',
      shadowOffset: { width: 0, height: 24 },
      shadowOpacity: 0.16,
      shadowRadius: 32,
    },
    default: { elevation: 8 },
  }),
  button: Platform.select({
    ios: {
      shadowColor: '#ff6b00',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
    },
    default: { elevation: 4 },
  }),
};

export { fonts } from './fonts';
