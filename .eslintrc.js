module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Allow `_`-prefixed names for values that are destructured away on purpose.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
};
