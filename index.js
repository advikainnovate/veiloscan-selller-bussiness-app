/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/lib/push';

// Before the app mounts, as Firebase requires for pushes in the background.
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
