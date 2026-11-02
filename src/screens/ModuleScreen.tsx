import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/layout/AppHeader';
import { ComingSoon } from '../components/layout/ComingSoon';
import { HelpCircleIcon } from '../components/icons';
import { findModule } from '../navigation/menu';
import type { ScreenProps } from '../navigation/types';

/** A page opened from the menu or header that has no screen of its own yet. */
export function ModuleScreen({ navigation, route }: ScreenProps<'Module'>) {
  const { hasPermission } = useAuth();
  const module = findModule(route.params.key);
  const label = module?.label ?? 'Page';
  const allowed = !module?.permission || hasPermission(module.permission);

  return (
    <View style={styles.screen}>
      <AppHeader title={label} onBack={navigation.goBack} />
      <ComingSoon label={label} icon={module?.icon ?? HelpCircleIcon} allowed={allowed} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
