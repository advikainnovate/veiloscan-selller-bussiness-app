import React, { type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, fonts } from '../../theme';
import { BarChartIcon, BoxIcon, HomeIcon, ShoppingBagIcon, UsersIcon, type IconProps } from '../icons';
import type { TabParamList } from '../../navigation/types';

export const TAB_META: Record<keyof TabParamList, { label: string; icon: ComponentType<IconProps> }> = {
  Home: { label: 'Home', icon: HomeIcon },
  Orders: { label: 'Orders', icon: ShoppingBagIcon },
  Products: { label: 'Products', icon: BoxIcon },
  Customers: { label: 'Customers', icon: UsersIcon },
  Reports: { label: 'Reports', icon: BarChartIcon },
};

/** Five quick pages; the active one sits in a peach block. */
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
            style={[styles.tab, focused && styles.tabActive]}
          >
            <Icon size={23} color={focused ? colors.secondary : colors.textSecondary} strokeWidth={focused ? 2 : 1.7} />
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
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // The active tab sits in a soft peach block, icon and label together.
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: radius.lg },
  tabActive: { backgroundColor: colors.secondaryLight },
  label: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  labelActive: { color: colors.secondary, fontFamily: fonts.bold },
});
