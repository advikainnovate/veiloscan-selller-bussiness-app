import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, shadow } from '../theme';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../lib/api';
import { bySection, groupLabel, notificationGroup, notificationLook, openNotification, relativeTime } from '../lib/notifications';
import { notificationService, type NotificationPage } from '../services/notification-service';
import { AppHeader } from '../components/layout/AppHeader';
import { Gradient } from '../components/ui/Gradient';
import { EmptyState, ErrorState, FilterChips, ListSkeleton } from '../components/list/ListParts';
import { opsStyles } from '../components/operations/OpsParts';
import { BellIcon, CheckIcon } from '../components/icons';
import type { ScreenProps } from '../navigation/types';

type Item = NotificationPage['items'][number];
type Tab = 'all' | 'unread';
const PAGE = 20;

/**
 * Notifications, as the Seller Panel's bell: newest first, unread ones
 * tinted, tap to open what it's about (and mark it read), mark all as read.
 * All / Unread, a filter by kind, by day, and more as you scroll.
 */
export function NotificationsScreen({ navigation }: ScreenProps<'Notifications'>) {
  const toast = useToast();
  const { refresh: refreshBell } = useNotifications();
  const [tab, setTab] = useState<Tab>('all');
  const [group, setGroup] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (mode: 'first' | 'refresh' | 'more') => {
      const id = ++request.current;
      const next = mode === 'more' ? page + 1 : 1;
      if (mode === 'first') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const res = await notificationService.page({ page: next, limit: PAGE, ...(tab === 'unread' ? { isRead: false } : {}) });
        if (id !== request.current) return;
        setItems(prev => (mode === 'more' ? [...prev, ...res.items.filter(n => !prev.some(p => p.id === n.id))] : res.items));
        setUnread(res.unreadCount);
        setTotal(res.total);
        setPage(next);
        setError(null);
      } catch (err) {
        if (id === request.current && mode !== 'more') setError(extractErrorMessage(err));
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [page, tab],
  );

  // A new tab starts over.
  useEffect(() => {
    setGroup('');
    load('first');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  // Back from an order: what was opened is read now.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) load('refresh');
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const groups = useMemo(() => [...new Set(items.map(notificationGroup))], [items]);
  const shown = useMemo(() => (group ? items.filter(n => notificationGroup(n) === group) : items), [items, group]);
  const sections = useMemo(() => bySection(shown), [shown]);
  const now = Date.now();

  function markLocally(ids: 'all' | string) {
    const at = new Date().toISOString();
    setItems(prev => (tab === 'unread' ? prev.filter(n => ids !== 'all' && n.id !== ids) : prev.map(n => (n.readAt || (ids !== 'all' && n.id !== ids) ? n : { ...n, readAt: at }))));
  }

  async function open(n: Item) {
    if (!n.readAt) {
      markLocally(n.id);
      setUnread(c => Math.max(0, c - 1));
      notificationService.markRead(n.id).then(refreshBell, () => load('refresh'));
    }
    if (!openNotification(n)) toast(n.title);
  }

  async function markAll() {
    const before = unread;
    markLocally('all');
    setUnread(0);
    try {
      await notificationService.markAllRead();
      toast(`${before} notification${before === 1 ? '' : 's'} marked as read`);
      refreshBell();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
      load('refresh');
    }
  }

  const hasMore = items.length < total;

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Notifications" subtitle={unread ? `${unread} unread` : 'All caught up'} onBack={navigation.canGoBack() ? navigation.goBack : undefined} />

      <View style={styles.top}>
        {/* Where things stand */}
        <View style={styles.summary}>
          <Gradient colors={[colors.primary, '#0b2a52']} direction="diagonal" borderRadius={20} />
          <View style={styles.summaryGlow} />
          <View style={styles.summaryIcon}>
            <BellIcon size={20} color={colors.white} />
            {unread ? <View style={styles.summaryDot} /> : null}
          </View>
          <View style={styles.flex}>
            <Text style={styles.summaryTitle}>{unread ? `${unread} unread` : 'All caught up'}</Text>
            <Text style={styles.summaryText} numberOfLines={1}>
              {unread ? 'Orders, requests and reminders waiting for you' : 'Nothing new right now'}
            </Text>
          </View>
          {unread ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Mark all as read" hitSlop={8} onPress={markAll} style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}>
              <CheckIcon size={14} color={colors.primary} strokeWidth={2.6} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {(
            [
              ['all', 'All'],
              ['unread', unread ? `Unread · ${unread}` : 'Unread'],
            ] as const
          ).map(([key, label]) => {
            const on = tab === key;
            return (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(key)} style={[styles.tab, on && styles.tabOn]}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {groups.length > 1 ? <FilterChips options={[{ value: '', label: 'Everything' }, ...groups.map(g => ({ value: g, label: groupLabel(g), count: items.filter(n => notificationGroup(n) === g).length }))]} value={group} onChange={setGroup} /> : null}
      </View>

      {error && !items.length ? (
        <ErrorState message={error} onRetry={() => load('first')} />
      ) : loading && !items.length ? (
        <ListSkeleton rows={6} height={76} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={n => n.id}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          onEndReached={() => (hasMore && !loadingMore && !group ? load('more') : undefined)}
          onEndReachedThreshold={0.4}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionWrap}>
              <Text style={styles.section}>{section.title.toUpperCase()}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const look = notificationLook(item);
            const Icon = look.icon;
            const isUnread = !item.readAt;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${item.title}`}
                accessibilityHint={item.message}
                onPress={() => open(item)}
                style={({ pressed }) => [styles.row, isUnread && styles.rowUnread, pressed && styles.rowPressed]}
              >
                {isUnread ? <View style={styles.stripe} /> : null}
                <View style={[styles.icon, { backgroundColor: look.tint }]}>
                  <Icon size={18} color={look.color} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.title, !isUnread && styles.titleRead]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.time}>{relativeTime(item.createdAt, now)}</Text>
                  </View>
                  {item.message ? (
                    <Text style={styles.message} numberOfLines={2}>
                      {item.message}
                    </Text>
                  ) : null}
                </View>
                {isUnread ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={Gap}
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                icon={BellIcon}
                title={tab === 'unread' || group ? 'Nothing here' : "You're all caught up"}
                text={tab === 'unread' ? 'No unread notifications.' : 'New orders, order requests and note reminders show here.'}
              />
            </View>
          }
          ListFooterComponent={
            items.length ? (
              <View style={styles.footer}>
                {loadingMore ? <ActivityIndicator color={colors.secondary} /> : null}
                {!hasMore && items.length > PAGE ? <Text style={opsStyles.muted}>That's everything.</Text> : null}
                <View style={styles.tip}>
                  <BellIcon size={14} color={colors.textSecondary} />
                  <Text style={[opsStyles.muted, styles.flex]}>New orders and order requests vibrate and show a banner while the app is open.</Text>
                </View>
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },
  top: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  summary: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: colors.primary, ...shadow.raised },
  summaryGlow: { position: 'absolute', top: -60, right: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,138,51,0.06)' },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  summaryDot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.secondary },
  summaryTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.white },
  summaryText: { marginTop: 1, fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.white },
  markAllText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  tabs: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 14, backgroundColor: colors.surface, ...shadow.card },
  tab: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  tabTextOn: { color: colors.white },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 14, paddingBottom: 8, backgroundColor: colors.background },
  section: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
  sectionCount: { overflow: 'hidden', minWidth: 18, paddingHorizontal: 5, borderRadius: 9, textAlign: 'center', fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary, backgroundColor: colors.primaryLight },
  gap: { height: 8 },
  row: { overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow.card },
  // The panel's unread tint (orange-50/50).
  rowUnread: { backgroundColor: '#fffaf5' },
  rowPressed: { backgroundColor: colors.background },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.secondary },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.text },
  titleRead: { fontFamily: fonts.semibold, color: colors.textSecondary },
  message: { marginTop: 3, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textSecondary },
  time: { marginTop: 2, fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  dot: { width: 8, height: 8, marginTop: 6, borderRadius: 4, backgroundColor: colors.secondary },
  empty: { minHeight: 380 },
  footer: { alignItems: 'center', gap: 12, paddingTop: 16 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', padding: 12, borderRadius: 14, backgroundColor: colors.surface },
});
