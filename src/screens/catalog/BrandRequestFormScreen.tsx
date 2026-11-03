import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { BrandRequestForm } from '../../components/catalog/BrandRequestForm';
import { opsStyles } from '../../components/operations/OpsParts';
import { ShieldCheckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

/** Request brand approval: which brand, where, and why the seller may sell it. */
export function BrandRequestFormScreen({ navigation, route }: ScreenProps<'BrandRequestForm'>) {
  const { hasPermission } = useAuth();
  if (!hasPermission('products-master:manage')) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Request brand approval" onBack={navigation.goBack} />
        <ComingSoon label="Brand Approvals" icon={ShieldCheckIcon} allowed={false} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title="Request brand approval" subtitle="Brand Approvals" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={opsStyles.content} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>Tell VeiloScan which brand you want to sell, where, and why you're allowed to.</Text>
        <BrandRequestForm
          initialCategoryId={route.params?.categoryId}
          initialBrandId={route.params?.brandId}
          onCancel={navigation.goBack}
          onDone={created => (created?.length === 1 ? navigation.replace('BrandRequestDetail', { id: created[0].id }) : navigation.goBack())}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
