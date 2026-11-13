/**
 * VeiloScan Business — the seller app.
 *
 * @format
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/i18n';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { StoreProvider } from './src/context/StoreContext';
import { ToastProvider } from './src/context/ToastContext';
import { RootNavigator } from './src/navigation/RootNavigator';

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LanguageProvider>
          <StoreProvider>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </StoreProvider>
        </LanguageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
