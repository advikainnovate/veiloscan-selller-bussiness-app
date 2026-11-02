// What the server requires of a new password (ResetPasswordDto).
export const PASSWORD_RULES: { label: string; test: (password: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'Upper & lowercase letters and a number', test: p => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) },
  { label: 'At least one symbol (e.g. ! @ # $ %)', test: p => /[^\da-zA-Z]/.test(p) },
];

export function meetsPasswordRules(password: string) {
  return PASSWORD_RULES.every(rule => rule.test(password));
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
