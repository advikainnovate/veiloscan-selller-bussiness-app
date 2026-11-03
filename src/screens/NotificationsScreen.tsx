import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, radius, shadow } from '../theme';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../lib/api';
import { bySection, groupLabel, notificationGroup, notificationLook, openNotification, relativeTime } from '../lib/notifications';
import { notificationService, type NotificationPage } from '../services/notification-service';
import { AppHeader } from '../components/layout/AppHeader';
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
        <View style={styles.tabsRow}>
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
          {unread ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Mark all as read" hitSlop={8} onPress={markAll} style={styles.markAll}>
              <CheckIcon size={14} color={colors.secondary} strokeWidth={2.4} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          ) : null}
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
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title.toUpperCase()}</Text>}
          renderItem={({ item, index, section }) => {
            const look = notificationLook(item);
            const Icon = look.icon;
            const isUnread = !item.readAt;
            const first = index === 0;
            const last = index === section.data.length - 1;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${isUnread ? 'Unread. ' : ''}${item.title}`}
                accessibilityHint={item.message}
                onPress={() => open(item)}
                style={({ pressed }) => [styles.row, first && styles.rowFirst, last && styles.rowLast, !last && styles.rowLine, isUnread && styles.rowUnread, pressed && styles.rowPressed]}
              >
                <View style={[styles.icon, { backgroundColor: look.tint }]}>
                  <Icon size={18} color={look.color} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.title, !isUnread && styles.titleRead]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.message ? (
                    <Text style={styles.message} numberOfLines={2}>
                      {item.message}
                    </Text>
                  ) : null}
                  <Text style={styles.time}>{relativeTime(item.createdAt, now)}</Text>
                </View>
                {isUnread ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
              </Pressable>
            );
          }}
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

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tabs: { flex: 1, flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  tab: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabOn: { backgroundColor: colors.white, ...shadow.card },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  tabTextOn: { color: colors.text },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markAllText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondary },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  section: { paddingTop: 16, paddingBottom: 8, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary, backgroundColor: colors.background },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface },
  rowFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  rowLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  // The panel's unread tint (orange-50/50).
  rowUnread: { backgroundColor: '#fff8f1' },
  rowPressed: { backgroundColor: colors.background },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  title: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.text },
  titleRead: { fontFamily: fonts.semibold, color: colors.textSecondary },
  message: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textSecondary },
  time: { marginTop: 4, fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  dot: { width: 9, height: 9, marginTop: 6, borderRadius: 5, backgroundColor: colors.secondary },
  empty: { minHeight: 380 },
  footer: { alignItems: 'center', gap: 12, paddingTop: 16 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', padding: 12, borderRadius: radius.md, backgroundColor: colors.surface },
});
