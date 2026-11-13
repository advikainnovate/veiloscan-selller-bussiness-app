import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDay } from '../../lib/date';
import { BRAND_STATUS, BRAND_STATUS_LABEL, filterBrandRequests } from '../../lib/catalog';
import { brandRequestService } from '../../services/catalog-service';
import type { Row } from '../../services/products-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { compactStyles, CountTiles, Fab, ListTop, RowCard, Separator, SummaryLine, TILE_COLORS, useListPadding } from '../../components/list/CompactList';
import { opsStyles } from '../../components/operations/OpsParts';
import { AlertCircleIcon, ShieldCheckIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 10;

/** A brand's logo, or its initial. */
export function BrandLogo({ brand, size = 36 }: { brand: Row | undefined; size?: number }) {
  const url = (brand?.logoImageFile as Row | null | undefined)?.url as string | undefined;
  const box = { width: size, height: size, borderRadius: size / 4 };
  return url ? (
    <Image source={{ uri: url }} style={[styles.logo, box]} resizeMode="contain" />
  ) : (
    <View style={[styles.initial, box]}>
      <Text style={styles.initialText}>{String(brand?.title ?? '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** Catalog › Brand Approvals: ask VeiloScan to approve a brand so products can use it. */
export function BrandApprovalsScreen({ navigation }: ScreenProps<'BrandApprovals'>) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const listPadding = useListPadding();
  const allowed = hasPermission('products-master:manage');
  const { data, error, loading, reload } = useFetch(() => (allowed ? brandRequestService.list() : Promise.resolve([])), [allowed]);
  const [status, setStatus] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);

  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => filterBrandRequests(rows, status, search), [rows, status, search]);
  const count = (s: number) => rows.filter(r => r.status === s).length;
  const isFiltered = status !== null || !!search.trim();

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title={t('common.brandApprovals')} onBack={navigation.goBack} />
        <ComingSoon label={t('common.brandApprovals')} icon={ShieldCheckIcon} allowed={false} />
      </View>
    );
  }

  const create = () => navigation.navigate('BrandRequestForm');

  return (
    <View style={opsStyles.screen}>
      <AppHeader title={t('common.brandApprovals')} subtitle={t('common.catalog')} onBack={navigation.goBack} />
      <ListTop>
        <SearchBar
          value={search}
          onChange={v => {
            setSearch(v);
            setShown(PAGE_SIZE);
          }}
          placeholder={t('catalog.searchBrandCategoryOrStore')}
        />
        <CountTiles
          tiles={[
            { key: String(BRAND_STATUS.PENDING), label: t('catalog.awaiting'), count: count(BRAND_STATUS.PENDING), ...TILE_COLORS.amber },
            { key: String(BRAND_STATUS.REJECTED), label: t('catalog.changesNeeded'), count: count(BRAND_STATUS.REJECTED), ...TILE_COLORS.red },
            { key: String(BRAND_STATUS.APPROVED), label: t('common.approved'), count: count(BRAND_STATUS.APPROVED), ...TILE_COLORS.green },
          ]}
          value={status === null ? '' : String(status)}
          onSelect={k => {
            setStatus(k === '' ? null : Number(k));
            setShown(PAGE_SIZE);
          }}
          loading={loading && !data}
        />
        <SummaryLine
          hint={status !== null ? BRAND_STATUS_LABEL[status].hint : t('catalog.askVeiloscanToApproveABrand')}
          filtered={isFiltered}
          shown={filtered.length}
          total={rows.length}
          noun="request"
          onClear={() => {
            setStatus(null);
            setSearch('');
          }}
        />
      </ListTop>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={loading && !data ? [] : filtered.slice(0, shown)}
          keyExtractor={r => r.id}
          contentContainerStyle={listPadding}
          ItemSeparatorComponent={Separator}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
          onEndReached={() => setShown(n => (n < filtered.length ? n + PAGE_SIZE : n))}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            count(BRAND_STATUS.REJECTED) && status !== BRAND_STATUS.REJECTED ? (
              <Pressable accessibilityRole="button" onPress={() => setStatus(BRAND_STATUS.REJECTED)} style={styles.alert}>
                <AlertCircleIcon size={16} color={colors.errorDark} />
                <Text style={styles.alertText}>
                  {t('catalog.requestsNeedChanges', { count: count(BRAND_STATUS.REJECTED) })}
                </Text>
                <Text style={styles.alertShow}>{t('common.show')}</Text>
              </Pressable>
            ) : undefined
          }
          ListEmptyComponent={
            loading && !data ? (
              <ListSkeleton rows={4} height={84} />
            ) : (
              <View style={compactStyles.empty}>
                <EmptyState
                  icon={ShieldCheckIcon}
                  title={isFiltered ? t('common.noRequestsMatch') : t('catalog.noBrandRequestsYet')}
                  text={isFiltered ? t('common.tryAnotherFilterOrSearchTerm') : t('catalog.productsCanOnlyUseABrand')}
                />
              </View>
            )
          }
          renderItem={({ item }) => <RequestCard row={item} onOpen={() => navigation.navigate('BrandRequestDetail', { id: item.id })} />}
        />
      )}

      <Fab label={t('catalog.requestBrand')} accessibilityLabel={t('catalog.requestBrandApproval')} onPress={create} />
    </View>
  );
}

function RequestCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const { t } = useTranslation();
  const brand = row.brand as Row | undefined;
  const s = BRAND_STATUS_LABEL[row.status as number] ?? BRAND_STATUS_LABEL[0];
  const rejected = row.status === BRAND_STATUS.REJECTED;
  return (
    <RowCard label={t('catalog.openNamed', { name: String(brand?.title ?? t('catalog.request')) })} onPress={onOpen}>
      <View style={compactStyles.head}>
        <BrandLogo brand={brand} />
        <View style={styles.flex}>
          <Text style={compactStyles.name} numberOfLines={1}>
            {String(brand?.title ?? '—')}
          </Text>
          <Text style={compactStyles.meta} numberOfLines={1}>
            {`${String(row.idd ?? '')}${row.isNewBrand ? ' · New brand' : ''} · ${formatDay(row.createdAt)}`}
          </Text>
        </View>
        <Badge label={s.label} tone={s.tone} />
      </View>
      <Text style={compactStyles.line} numberOfLines={1}>
        {`${String((row.category as Row | undefined)?.categoryTitle ?? '—')}`}
        <Text style={compactStyles.meta}>{` · ${String((row.store as Row | undefined)?.name ?? '—')}`}</Text>
      </Text>
      {rejected && row.remarks ? (
        <Text style={[compactStyles.meta, opsStyles.danger]} numberOfLines={2}>
          {String(row.remarks)}
        </Text>
      ) : null}
      {rejected ? <Text style={styles.fix}>{t('catalog.fixAndResubmit')}</Text> : null}
    </RowCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  logo: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.white },
  initial: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryLight },
  initialText: { fontFamily: fonts.bold, fontSize: 15, color: colors.secondaryDark },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#fecaca', backgroundColor: colors.errorLight },
  alertText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.errorDark },
  alertShow: { fontFamily: fonts.semibold, fontSize: 12, color: colors.errorDark },
  fix: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
});
