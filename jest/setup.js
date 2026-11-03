/* eslint-env jest */
// Native modules have no implementation under Jest: in-memory stand-ins.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async key => store.get(key) ?? null),
      setItem: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async key => {
        store.delete(key);
      }),
      clear: jest.fn(async () => store.clear()),
    },
  };
});

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly' },
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: { dirs: { CacheDir: '/tmp' }, unlink: jest.fn(async () => {}) },
    config: jest.fn(() => ({ fetch: jest.fn(async () => ({ info: () => ({ status: 200 }) })) })),
    ios: { previewDocument: jest.fn() },
    android: { actionViewIntent: jest.fn(async () => true) },
  },
}));

// The seller's stores: none unless a test says otherwise (lists then span all stores).
jest.mock('../src/services/store-service', () => ({
  storeService: { list: jest.fn(async () => []) },
}));

// The seller's plan: everything included unless a test says otherwise.
jest.mock('../src/services/subscription-service', () => ({
  subscriptionService: { mine: jest.fn(async () => ({ plan: null, consolidatedDashboard: true })) },
}));
