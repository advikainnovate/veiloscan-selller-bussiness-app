module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-screens|react-native-safe-area-context)/)',
  ],
};
