import React, { useEffect, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { EmptyState } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { BarChartIcon, ChartTrendIcon, ClipboardListIcon, LayersIcon, RefreshIcon, StoreIcon, TruckIcon, WalletIcon, type IconProps } from '../../components/icons';
import type { ExpenseTab, ScreenProps } from '../../navigation/types';
import { ExpenseDashboardTab, ExpenseReportsTab } from './ExpenseOverviewTabs';
import { CategoriesTab, ExpenseListTab, RecurringTab, SuppliersTab } from './ExpenseListTabs';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const TABS: { key: ExpenseTab; label: string; icon: ComponentType<IconProps> }[] = [
  { key: 'dashboard', get label() { return i18n.t('expenses.dashboard'); }, icon: ChartTrendIcon },
  { key: 'list', get label() { return i18n.t('expenses.allExpenses'); }, icon: ClipboardListIcon },
  { key: 'suppliers', get label() { return i18n.t('expenses.suppliers'); }, icon: TruckIcon },
  { key: 'recurring', get label() { return i18n.t('expenses.recurring'); }, icon: RefreshIcon },
  { key: 'reports', get label() { return i18n.t('common.reports'); }, icon: BarChartIcon },
  { key: 'categories', get label() { return i18n.t('common.categories'); }, icon: LayersIcon },
];

export interface ListPreset {
  status?: string;
  search?: string;
  supplierId?: string;
  sort?: string;
}

/** Operations › Expenses: what it costs to run the store, what's paid and what's owed to suppliers. */
export function ExpensesScreen({ navigation, route }: ScreenProps<'Expenses'>) {
  const { t: tr } = useTranslation();
  const { hasPermission } = useAuth();
  const allowed = hasPermission('store-expenses:view');
  const { current: store } = useStore();
  const [tab, setTab] = useState<ExpenseTab>(route.params?.tab ?? 'dashboard');
  // Opening All Expenses already filtered (from the dashboard, a recurring expense…).
  const [preset, setPreset] = useState<ListPreset>({});
  const [presetKey, setPresetKey] = useState(0);

  useEffect(() => {
    const p = route.params;
    if (!p) return;
    if (p.tab) setTab(p.tab);
    if (p.status || p.search || p.supplierId || p.sort) {
      setPreset({ status: p.status, search: p.search, supplierId: p.supplierId, sort: p.sort });
      setPresetKey(k => k + 1);
      setTab('list');
    }
  }, [route.params]);

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={tr('common.expenses')} onBack={navigation.goBack} />
        <ComingSoon label={tr('common.expenses')} icon={WalletIcon} allowed={false} />
      </View>
    );
  }

  const openList = (p: ListPreset) => {
    setPreset(p);
    setPresetKey(k => k + 1);
    setTab('list');
  };

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={tr('common.expenses')} subtitle={store?.name} onBack={navigation.goBack} />
      {!store ? (
        <EmptyState icon={StoreIcon} title={tr('common.youDonTHaveAStore')} />
      ) : (
        <>
          <View style={styles.tabsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {TABS.map(t => {
                const on = t.key === tab;
                const Icon = t.icon;
                return (
                  <Pressable
                    key={t.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      if (t.key === 'list') setPreset({});
                      setTab(t.key);
                    }}
                    style={[styles.tab, on && styles.tabOn]}
                  >
                    <Icon size={15} color={on ? colors.white : colors.textSecondary} />
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          {tab === 'dashboard' ? <ExpenseDashboardTab storeId={store.id} openList={openList} openTab={setTab} /> : null}
          {tab === 'list' ? <ExpenseListTab key={presetKey} storeId={store.id} preset={preset} /> : null}
          {tab === 'suppliers' ? <SuppliersTab storeId={store.id} /> : null}
          {tab === 'recurring' ? <RecurringTab storeId={store.id} openList={openList} /> : null}
          {tab === 'reports' ? <ExpenseReportsTab storeId={store.id} /> : null}
          {tab === 'categories' ? <CategoriesTab storeId={store.id} /> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsWrap: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tabs: { gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  tabTextOn: { color: colors.white },
});
