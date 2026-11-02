import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/layout/AppHeader';
import { ComingSoon } from '../components/layout/ComingSoon';
import { TAB_META } from '../components/layout/BottomTabBar';
import { MENU_ITEMS } from '../navigation/menu';
import type { TabParamList } from '../navigation/types';

/** A bottom tab whose module comes later: Customers, Reports. */
export function makeTabPlaceholder(tab: keyof TabParamList, title: string) {
  return function TabPlaceholderScreen() {
    const { hasPermission } = useAuth();
    const permission = MENU_ITEMS.find(item => item.tab === tab)?.permission;
    const allowed = !permission || hasPermission(permission);
    return (
      <View style={styles.screen}>
        <AppHeader title={title} />
        <ComingSoon label={title} icon={TAB_META[tab].icon} allowed={allowed} />
      </View>
    );
  };
}

export const CustomersScreen = makeTabPlaceholder('Customers', 'Customers');
export const ReportsScreen = makeTabPlaceholder('Reports', 'Sales Reports');

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
