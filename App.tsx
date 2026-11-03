/**
 * VeiloScan Business — the seller app.
 *
 * @format
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { StoreProvider } from './src/context/StoreContext';
import { ToastProvider } from './src/context/ToastContext';
import { RootNavigator } from './src/navigation/RootNavigator';

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StoreProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
