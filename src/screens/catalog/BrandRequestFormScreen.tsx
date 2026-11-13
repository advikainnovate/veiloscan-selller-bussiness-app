import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { BrandRequestForm } from '../../components/catalog/BrandRequestForm';
import { opsStyles } from '../../components/operations/OpsParts';
import { ShieldCheckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/** Request brand approval: which brand, where, and why the seller may sell it. */
export function BrandRequestFormScreen({ navigation, route }: ScreenProps<'BrandRequestForm'>) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  if (!hasPermission('products-master:manage')) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('catalog.requestBrandApproval')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.brandApprovals')} icon={ShieldCheckIcon} allowed={false} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView style={opsStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title={t('catalog.requestBrandApproval')} subtitle={t('common.brandApprovals')} onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={opsStyles.content} keyboardShouldPersistTaps="handled">
        <Text style={opsStyles.meta}>{t('catalog.tellVeiloscanWhichBrandYouWant')}</Text>
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
