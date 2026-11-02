import { Platform } from 'react-native';

// The eshop backend. In development the Android emulator reaches the host
// machine at 10.0.2.2, the iOS simulator at localhost; on a real device use
// the machine's LAN IP. Release builds talk to the production API.
const DEV_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:5001' : 'http://localhost:5001';
const PROD_API_URL = 'https://api.veiloscan.com';

export const API_URL = __DEV__ ? DEV_HOST : PROD_API_URL;

// The marketplace site: legal pages and the Help Center live there.
export const SHOP_URL = __DEV__ ? 'http://localhost:3000' : 'https://veiloscan.com';

export const DEVICE_TYPE = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
