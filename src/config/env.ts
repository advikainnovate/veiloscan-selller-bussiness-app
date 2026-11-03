import { NativeModules, Platform } from 'react-native';

// The eshop backend. In development the Android emulator reaches the host
// machine at 10.0.2.2, the iOS simulator at localhost; on a real device use
// the machine's LAN IP. Release builds talk to the production API.
const DEV_HOST = Platform.OS === 'android' ? 'https://asapi.advikainnovate.cloud' : 'https://asapi.advikainnovate.cloud';
const PROD_API_URL = 'https://api.veiloscan.com';

export const API_URL = NativeModules.AppEnvironment?.apiUrl ?? (__DEV__ ? DEV_HOST : PROD_API_URL);

// The marketplace site: legal pages and the Help Center live there.
export const SHOP_URL = __DEV__ ? 'https://store.advikainnovate.cloud' : 'https://store.veiloscan.com';

export const DEVICE_TYPE = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
