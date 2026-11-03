import React from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '../components/layout/BottomTabBar';
import { HomeScreen } from '../screens/HomeScreen';
import { OrdersScreen } from '../screens/orders/OrdersScreen';
import { ProductsScreen } from '../screens/products/ProductsScreen';
import { CustomersScreen } from '../screens/customers/CustomersScreen';
import { SalesReportsScreen } from '../screens/reports/SalesReportsScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <BottomTabBar {...props} />;

/** The signed-in app's five quick pages; every screen draws its own header. */
export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Products" component={ProductsScreen} />
      <Tab.Screen name="Customers" component={CustomersScreen} />
      <Tab.Screen name="Reports" component={SalesReportsScreen} />
    </Tab.Navigator>
  );
}
