import React, { useCallback, useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { DrawerProvider } from '../context/DrawerContext';
import { NotificationProvider } from '../context/NotificationContext';
import { hasOnboarded } from '../lib/session';
import { SplashScreen } from '../screens/SplashScreen';
import { GetStartedScreen } from '../screens/GetStartedScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { ModuleScreen } from '../screens/ModuleScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { CreateOrderScreen } from '../screens/orders/CreateOrderScreen';
import { OrderRequestsScreen } from '../screens/orders/OrderRequestsScreen';
import { OrderRequestDetailScreen } from '../screens/orders/OrderRequestDetailScreen';
import { ProductDetailScreen } from '../screens/products/ProductDetailScreen';
import { ProductEditorScreen } from '../screens/products/editor/ProductEditorScreen';
import { AppDrawer } from '../components/layout/AppDrawer';
import { OrderAlerts } from '../components/orders/OrderAlerts';
import { MainTabs } from './MainTabs';
import { menuKeyForTab } from './menu';
import { navigationRef, ROUTE_MENU_KEYS } from './navigationRef';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.secondary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

/**
 * Splash → Get Started (first launch only) → Login (→ Forgot / Reset Password) → the app. A remembered
 * sign-in goes straight from the splash to the app: bottom tabs, module pages, and the menu drawer over both.
 */
export function RootNavigator() {
  const { status } = useAuth();
  const [onboarded, setOnboardedState] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  // The menu key of the page on screen, so the drawer can highlight it.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const trackActivePage = useCallback(() => {
    const route = navigationRef.getCurrentRoute();
    if (!route) return setActiveKey(null);
    // Detail pages highlight their module in the menu.
    const moduleKey =
      ROUTE_MENU_KEYS[route.name as keyof typeof ROUTE_MENU_KEYS];
    if (moduleKey) return setActiveKey(moduleKey);
    if (route.name === 'Module')
      setActiveKey((route.params as { key: string }).key);
    else setActiveKey(menuKeyForTab(route.name as keyof TabParamList));
  }, []);

  useEffect(() => {
    hasOnboarded().then(setOnboardedState, () => setOnboardedState(false));
  }, []);

  // Anyone who has signed in has seen Get Started; after a sign out the app opens on login.
  useEffect(() => {
    if (status === 'signedIn') setOnboardedState(true);
  }, [status]);

  const ready = status !== 'loading' && onboarded !== null;
  if (!splashDone || !ready) {
    return <SplashScreen ready={ready} onFinish={() => setSplashDone(true)} />;
  }

  return (
    <NotificationProvider enabled={status === 'signedIn'}>
      <DrawerProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={theme}
          onReady={trackActivePage}
          onStateChange={trackActivePage}
        >
          <Stack.Navigator
            // initialRouteName is read only when the navigator mounts, so signing in
            // or out mounts a fresh one; otherwise sign out would land on the first
            // screen (Get Started) instead of Login.
            key={status === 'signedIn' ? 'app' : 'auth'}
            initialRouteName={
              status === 'signedIn'
                ? 'Main'
                : onboarded
                ? 'Login'
                : 'GetStarted'
            }
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
            }}
          >
            {status === 'signedIn' ? (
              <>
                <Stack.Screen name="Main" component={MainTabs} />
                <Stack.Screen
                  name="Module"
                  component={ModuleScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="OrderDetail"
                  component={OrderDetailScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="CreateOrder"
                  component={CreateOrderScreen}
                  options={{ animation: 'slide_from_bottom' }}
                />
                <Stack.Screen
                  name="OrderRequests"
                  component={OrderRequestsScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="OrderRequestDetail"
                  component={OrderRequestDetailScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="ProductDetail"
                  component={ProductDetailScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="ProductEditor"
                  component={ProductEditorScreen}
                  options={{ animation: 'slide_from_bottom' }}
                />
              </>
            ) : (
              <>
                <Stack.Screen name="GetStarted" component={GetStartedScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
                  <Stack.Screen
                    name="ForgotPassword"
                    component={ForgotPasswordScreen}
                  />
                  <Stack.Screen
                    name="ResetPassword"
                    component={ResetPasswordScreen}
                  />
                </Stack.Group>
              </>
            )}
          </Stack.Navigator>
          {status === 'signedIn' ? <AppDrawer activeKey={activeKey} /> : null}
          {status === 'signedIn' ? <OrderAlerts /> : null}
        </NavigationContainer>
      </DrawerProvider>
    </NotificationProvider>
  );
}
