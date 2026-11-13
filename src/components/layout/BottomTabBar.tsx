import React, { type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, fonts } from '../../theme';
import { BarChartIcon, BoxIcon, HomeIcon, ShoppingBagIcon, UsersIcon, type IconProps } from '../icons';
import type { TabParamList } from '../../navigation/types';
import i18n from '../../i18n';

export const TAB_META: Record<keyof TabParamList, { label: string; icon: ComponentType<IconProps> }> = {
  Home: { get label() { return i18n.t('layout.home'); }, icon: HomeIcon },
  Orders: { get label() { return i18n.t('common.orders'); }, icon: ShoppingBagIcon },
  Products: { get label() { return i18n.t('common.products'); }, icon: BoxIcon },
  Customers: { get label() { return i18n.t('common.customers'); }, icon: UsersIcon },
  Reports: { get label() { return i18n.t('common.reports'); }, icon: BarChartIcon },
};

/** Five quick pages; the active one's icon sits in an orange pill. */
export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { label, icon: Icon } = TAB_META[route.name as keyof TabParamList];

        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <Icon size={22} color={focused ? colors.secondary : colors.textSecondary} strokeWidth={focused ? 2.1 : 1.7} />
            </View>
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.surface,
    // A soft shadow upwards, in place of a border.
    ...Platform.select({
      ios: { shadowColor: '#061b3a', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      default: { elevation: 12 },
    }),
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2, borderRadius: radius.lg },
  tabPressed: { opacity: 0.7 },
  pill: { width: 52, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.secondaryLight },
  label: { fontSize: 11.5, fontFamily: fonts.medium, color: colors.textSecondary },
  labelActive: { color: colors.secondary, fontFamily: fonts.bold },
});
