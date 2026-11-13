import i18n from '../i18n';
// What the server requires of a new password (ResetPasswordDto).
export const PASSWORD_RULES: { label: string; test: (password: string) => boolean }[] = [
  { get label() { return i18n.t('common.atLeast8Characters'); }, test: p => p.length >= 8 },
  { get label() { return i18n.t('auth.upperAndLowercaseLettersAndA'); }, test: p => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) },
  { get label() { return i18n.t('auth.atLeastOneSymbolEG'); }, test: p => /[^\da-zA-Z]/.test(p) },
];

export function meetsPasswordRules(password: string) {
  return PASSWORD_RULES.every(rule => rule.test(password));
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
