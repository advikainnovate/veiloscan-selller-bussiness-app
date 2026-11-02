// The VeiloScan seller palette, taken from the Seller Panel (src/app/globals.css)
// so the app and the web panel look like one product.
export const colors = {
  // Navy
  primary: '#061b3a',
  primaryDark: '#031329',
  primaryDeep: '#03172f', // The brand story panel behind login / get started.
  primaryLight: '#eaf2fb',

  // Orange
  secondary: '#ff6b00',
  secondaryDark: '#e85d00',
  secondaryLight: '#fff1e6',
  secondarySoft: '#ffd3b3',
  peach: '#fdf7f2', // The login screen background.

  background: '#f7f9fc',
  surface: '#ffffff',
  text: '#061b3a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#dce4ef',
  borderFocus: '#ff6b00',
  inputFill: '#eaf2fb',

  success: '#16a34a',
  successDark: '#15803d',
  successLight: '#dcfce7',
  warning: '#f59e0b',
  warningDark: '#92400e',
  warningLight: '#fffbeb',
  warningBorder: '#fde68a',
  error: '#dc2626',
  errorDark: '#b91c1c',
  errorLight: '#fee2e2',
  info: '#2563eb',

  white: '#ffffff',
  black: '#000000',
} as const;

// Gradient pairs for the feature tiles, as on the Seller Panel login.
export const featureTones = {
  orange: ['#ff6b00', '#e85d00'],
  green: ['#22c55e', '#15803d'],
  blue: ['#38bdf8', '#2563eb'],
  violet: ['#a78bfa', '#7c3aed'],
} as const;

export type FeatureTone = keyof typeof featureTones;
