import React, { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { formatDay, formatWhen } from '../../lib/date';
import { dateTime } from '../../lib/operations';
import { shortRupees } from '../../lib/sales-report';
import { formatQty, movementLabel, signed, stockStatus } from '../../lib/stock';
import { canResubmit, canToggle, WAREHOUSE_HISTORY, WAREHOUSE_STATUS, warehouseAddress, warehouseLifecycle, warehouseTypeLabel } from '../../lib/catalog';
import { recentMovements, warehouseMasterService } from '../../services/catalog-service';
import { stockService } from '../../services/stock-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge } from '../../components/ui/Badge';
import { ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { CountTiles, TILE_COLORS } from '../../components/list/CompactList';
import { confirmAction, opsStyles, ReasonSheet } from '../../components/operations/OpsParts';
import { SectionCard } from '../../components/store/StoreSections';
import { BoxIcon, ClockIcon, EditIcon, MapPinIcon, RefreshIcon, SettingsIcon, TruckIcon, WarehouseIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

/** One warehouse: approval state, its stock, recent movements, location, operations and approval history. */
export function WarehouseDetailScreen({ navigation, route }: ScreenProps<'WarehouseDetail'>) {
  const { t } = useTranslation();
  const { id } = route.params;
  const { hasPermission } = useAuth();
  const toast = useToast();
  const allowed = hasPermission('warehouse-master:manage');
  const w = useFetch(() => (allowed ? warehouseMasterService.get(id) : Promise.resolve(null)), [allowed, id]);
  const stock = useFetch(() => (allowed ? stockService.list({ warehouseId: id }).catch(() => []) : Promise.resolve([])), [allowed, id]);
  const ledger = useFetch(() => (allowed ? recentMovements(id).catch(() => []) : Promise.resolve([])), [allowed, id]);
  const history = useFetch(() => (allowed ? warehouseMasterService.history(id).catch(() => []) : Promise.resolve([])), [allowed, id]);
  const [busy, setBusy] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  const rows = useMemo(() => stock.data ?? [], [stock.data]);
  const totals = useMemo(
    () => ({
      skus: rows.length,
      units: rows.reduce((s, r) => s + (r.salesFactor ? r.onHand / r.salesFactor : r.onHand), 0),
      reserved: rows.filter(r => r.reserved > 0).length,
      low: rows.filter(r => r.stockStatus === 'LOW_STOCK' || r.stockStatus === 'OUT_OF_STOCK').length,
      value: rows.reduce((s, r) => s + r.onHand * (r.costPrice ?? 0), 0),
    }),
    [rows],
  );

  const header = <AppHeader title={String(w.data?.facilityTitle ?? t('common.warehouse'))} subtitle={t('catalog.warehouses')} onBack={navigation.goBack} />;
  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ComingSoon label={t('catalog.warehouses')} icon={WarehouseIcon} allowed={false} />
      </View>
    );
  }
  if (w.loading && !w.data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ListSkeleton rows={3} height={140} />
      </View>
    );
  }
  if (!w.data) {
    return (
      <View style={opsStyles.screen}>
        {header}
        <ErrorState message={w.error || t('catalog.thisWarehouseCouldnTBeLoaded')} onRetry={w.reload} />
      </View>
    );
  }

  const r = w.data;
  const lifecycle = warehouseLifecycle(r);
  const status = WAREHOUSE_STATUS[lifecycle];
  const address = warehouseAddress(r);
  const mapUrl = r.latitude && r.longitude ? `https://www.google.com/maps?q=${String(r.latitude)},${String(r.longitude)}` : address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
  const operations = [
    { label: t('catalog.receivesStock'), detail: t('catalog.purchaseReceiptsAndTransfersIn'), on: Boolean(r.inboundEnabled) },
    { label: t('catalog.dispatchesOrders'), detail: t('catalog.stockIsUsedToFulfilOrders'), on: Boolean(r.outboundEnabled) },
    { label: t('catalog.acceptsReturns'), detail: t('catalog.customerReturnsComeBackHere'), on: Boolean(r.returnEnabled) },
  ];
  const steps = [...(history.data ?? [])].reverse();
  const refresh = () => {
    w.reload();
    history.reload();
  };

  async function toggle() {
    const off = lifecycle === 'ACTIVE';
    const ok = await confirmAction(
      off ? t('catalog.switchThisWarehouseOff') : t('catalog.switchThisWarehouseBackOn'),
      off
        ? t('catalog.itStopsReceivingAndDispatchingStock')
        : t('catalog.itGoesBackIntoUseStraight'),
      off ? t('catalog.switchOff') : t('catalog.switchOn'),
      off,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const saved = await warehouseMasterService.update(id, { status: off ? 0 : 1 });
      toast(off ? t('catalog.warehouseSwitchedOff') : warehouseLifecycle(saved) === 'ACTIVE' ? t('catalog.warehouseIsActiveAgain') : t('catalog.sentToVeiloscanForApproval'));
      refresh();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={opsStyles.screen}>
      {header}
      <ScrollView contentContainerStyle={opsStyles.content} refreshControl={<RefreshControl refreshing={w.loading} onRefresh={refresh} />}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <WarehouseIcon size={22} color="#4f46e5" />
          </View>
          <View style={styles.flex}>
            <View style={styles.wrap}>
              <Badge label={status.label} tone={status.tone} />
              {r.isDefault ? <Badge label={t('common.default')} tone="amber" /> : null}
            </View>
            <Text style={opsStyles.meta}>{[r.facilityCode, warehouseTypeLabel(r.facilityType), r.city].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {canResubmit(lifecycle) ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setResubmitting(true)} style={[opsStyles.primaryBtn, styles.grow]}>
              <RefreshIcon size={14} color={colors.white} />
              <Text style={opsStyles.primaryBtnText}>{t('catalog.resubmitForReview')}</Text>
            </Pressable>
          ) : null}
          {lifecycle === 'ACTIVE' ? (
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Inventory', { tab: 'stock' })} style={[opsStyles.smallBtn, styles.grow]}>
              <BoxIcon size={14} color={colors.text} />
              <Text style={opsStyles.smallBtnText}>{t('catalog.manageStock')}</Text>
            </Pressable>
          ) : null}
          {canToggle(lifecycle) ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={toggle} style={[opsStyles.smallBtn, styles.grow]}>
              <Text style={opsStyles.smallBtnText}>{lifecycle === 'ACTIVE' ? t('catalog.switchOff') : t('catalog.switchOn')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.edit')} onPress={() => navigation.navigate('WarehouseForm', { id })} style={[opsStyles.smallBtn, styles.grow]}>
            <EditIcon size={14} color={colors.text} />
            <Text style={opsStyles.smallBtnText}>{t('common.edit')}</Text>
          </Pressable>
        </View>

        {lifecycle !== 'ACTIVE' ? (
          <View style={[styles.notice, status.tone === 'red' ? styles.noticeRed : status.tone === 'slate' ? styles.noticeSlate : null]}>
            <Text style={styles.noticeTitle}>{status.hint}</Text>
            {r.reviewNote ? <Text style={styles.noticeText}>{t('catalog.veiloscanReviewnote', { reviewNote: String(r.reviewNote) })}</Text> : null}
            {r.submittedAt && (lifecycle === 'PENDING_APPROVAL' || lifecycle === 'UNDER_REVIEW') ? <Text style={styles.noticeText}>{t('catalog.submittedDatetime', { dateTime: dateTime(String(r.submittedAt)) })}</Text> : null}
          </View>
        ) : null}

        <CountTiles
          tiles={[
            { key: 'skus', label: 'SKUs', count: totals.skus, ...TILE_COLORS.violet },
            { key: 'units', label: t('common.units'), count: Math.round(totals.units).toLocaleString('en-IN'), ...TILE_COLORS.orange },
            { key: 'low', label: t('catalog.lowOut'), count: totals.low, ...TILE_COLORS.amber },
            { key: 'value', label: t('catalog.valueCost'), count: shortRupees(totals.value), ...TILE_COLORS.green },
          ]}
          loading={stock.loading && !stock.data}
        />
        {totals.reserved ? <Text style={opsStyles.muted}>{t('catalog.skusHaveStockReserved', { count: totals.reserved })}</Text> : null}

        <SectionCard icon={BoxIcon} title={t('catalog.stockInThisWarehouse')} subtitle={rows.length ? t('common.skuCount', { count: rows.length }) : undefined}>
          {rows.length ? (
            <>
              {rows.slice(0, 10).map(s => {
                const st = stockStatus(s.stockStatus);
                return (
                  <Pressable key={s.id} accessibilityRole="button" onPress={() => navigation.navigate('StockDetail', { id: s.id })} style={styles.stock}>
                    <View style={styles.flex}>
                      <Text style={opsStyles.title} numberOfLines={1}>
                        {s.productName}
                      </Text>
                      <Text style={opsStyles.muted} numberOfLines={1}>
                        {[s.sku, s.variantLabel, t('common.onHandQuantity', { quantity: formatQty(s.onHand, s) }), s.reserved ? t('common.reservedQuantity', { quantity: formatQty(s.reserved, s) }) : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={styles.right}>
                      <Text style={opsStyles.amount}>{formatQty(s.available, s)}</Text>
                      <Badge label={st.label} tone={st.tone} />
                    </View>
                  </Pressable>
                );
              })}
              {rows.length > 10 ? <Text style={opsStyles.muted}>{t('catalog.showing10OfRowscountSeeAll', { rowsCount: rows.length })}</Text> : null}
            </>
          ) : (
            <Text style={[opsStyles.muted, styles.center]}>{stock.loading ? t('common.loading') : lifecycle === 'ACTIVE' ? t('catalog.noStockHereYet') : t('catalog.stockCanBeAddedOnceThe')}</Text>
          )}
        </SectionCard>

        <SectionCard
          icon={TruckIcon}
          title={t('catalog.recentStockMovements')}
          action={
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Inventory', { tab: 'ledger' })}>
              <Text style={styles.link}>{t('catalog.fullLedger')}</Text>
            </Pressable>
          }
        >
          {(ledger.data ?? []).length ? (
            (ledger.data ?? []).map(e => {
              const delta = Number(e.onHandDelta) || 0;
              return (
                <View key={String(e.id)} style={styles.stock}>
                  <View style={styles.flex}>
                    <Text style={opsStyles.title} numberOfLines={1}>
                      {String(e.productName ?? '—')}
                    </Text>
                    <Text style={opsStyles.muted}>{`${movementLabel(String(e.type))} · ${formatWhen(e.createdAt)}${e.performedBy ? ` · ${String(e.performedBy)}` : ''}`}</Text>
                  </View>
                  <Text style={[opsStyles.amount, delta > 0 ? opsStyles.success : delta < 0 ? opsStyles.danger : null]}>{`${signed(delta)}${e.baseUom && delta ? ` ${String(e.baseUom)}` : ''}`}</Text>
                </View>
              );
            })
          ) : (
            <Text style={[opsStyles.muted, styles.center]}>{ledger.loading ? t('common.loading') : t('catalog.noStockMovementsYet')}</Text>
          )}
        </SectionCard>

        <SectionCard
          icon={MapPinIcon}
          title={t('catalog.locationAndContact')}
          action={
            mapUrl ? (
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(mapUrl)}>
                <Text style={styles.link}>{t('catalog.openMap')}</Text>
              </Pressable>
            ) : null
          }
        >
          <Text style={opsStyles.title}>{address || t('catalog.noAddress')}</Text>
          {r.contactPerson ? <Text style={opsStyles.meta}>{String(r.contactPerson)}</Text> : null}
          {r.phone ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${String(r.phone)}`)}>
              <Text style={styles.link}>{String(r.phone)}</Text>
            </Pressable>
          ) : null}
          {r.email ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${String(r.email)}`)}>
              <Text style={styles.link}>{String(r.email)}</Text>
            </Pressable>
          ) : null}
          <Text style={opsStyles.muted}>{`${String(r.timezone ?? 'Asia/Kolkata')}${r.region ? ` · ${t('catalog.regionNamed', { region: String(r.region) })}` : ''}`}</Text>
        </SectionCard>

        <SectionCard icon={SettingsIcon} title={t('common.operations')} subtitle={lifecycle === 'ACTIVE' ? t('catalog.whatThisWarehouseIsUsedFor') : t('catalog.theseStartOnceTheWarehouseIs')}>
          {operations.map(o => (
            <View key={o.label} style={opsStyles.rowBetween}>
              <View style={styles.flex}>
                <Text style={opsStyles.title}>{o.label}</Text>
                <Text style={opsStyles.muted}>{o.detail}</Text>
              </View>
              <Badge label={o.on ? (lifecycle === 'ACTIVE' ? t('common.on') : t('catalog.onWhenApproved')) : t('common.off')} tone={o.on && lifecycle === 'ACTIVE' ? 'green' : 'slate'} />
            </View>
          ))}
        </SectionCard>

        <SectionCard icon={ClockIcon} title={t('catalog.approvalHistory')} subtitle={t('catalog.everyStepOfVeiloscansReview')}>
          {steps.length ? (
            steps.map(h => {
              const to = WAREHOUSE_STATUS[h.toStatus as keyof typeof WAREHOUSE_STATUS];
              return (
                <View key={h.id} style={styles.event}>
                  <View style={styles.dot} />
                  <View style={styles.flex}>
                    <View style={styles.wrap}>
                      <Text style={opsStyles.title}>{WAREHOUSE_HISTORY[h.action] ?? h.action}</Text>
                      {h.fromStatus !== h.toStatus && to ? <Badge label={to.label} tone={to.tone} /> : null}
                    </View>
                    <Text style={opsStyles.muted}>{`${dateTime(h.createdAt)} · ${h.actor ? h.actor.name : 'Automatic'}`}</Text>
                    {h.note ? <Text style={styles.histNote}>{h.note}</Text> : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={opsStyles.muted}>{history.loading ? t('common.loading') : t('catalog.noApprovalHistoryThisWarehouseWas')}</Text>
          )}
          <Text style={opsStyles.muted}>{[t('common.addedOn', { date: formatDay(r.createdAt) }), r.approvedAt ? t('catalog.approvedOn', { date: formatDay(r.approvedAt) }) : null].filter(Boolean).join(' · ')}</Text>
        </SectionCard>
      </ScrollView>

      <ReasonSheet
        visible={resubmitting}
        title={t('catalog.resubmitForReview2')}
        message={t('catalog.makeSureYouVeUpdatedThe')}
        label={t('catalog.noteForTheReviewerOptional')}
        confirmLabel={t('catalog.resubmit')}
        required={false}
        maxLength={1000}
        onClose={() => setResubmitting(false)}
        onConfirm={async note => {
          try {
            await warehouseMasterService.resubmit(id, note);
            toast(t('catalog.warehouseResubmittedForReview'));
            setResubmitting(false);
            refresh();
          } catch (err) {
            toast(extractErrorMessage(err), 'error');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { gap: 4, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  noticeRed: { borderColor: '#fecaca', backgroundColor: colors.errorLight },
  noticeSlate: { borderColor: colors.border, backgroundColor: colors.background },
  noticeTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  noticeText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  right: { alignItems: 'flex-end', gap: 4 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
  event: { flexDirection: 'row', gap: 10 },
  dot: { width: 10, height: 10, marginTop: 5, borderRadius: 5, backgroundColor: colors.textMuted },
  histNote: { marginTop: 4, padding: 8, borderRadius: 8, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, backgroundColor: colors.background },
});
