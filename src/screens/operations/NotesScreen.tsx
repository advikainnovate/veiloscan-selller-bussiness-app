import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { dateTime, day, todayDay } from '../../lib/operations';
import { storeOperationsService, type NotePriority, type NoteStatus, type StoreNote } from '../../services/store-operations-service';
import { AppHeader } from '../../components/layout/AppHeader';
import { ComingSoon } from '../../components/layout/ComingSoon';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { Choices, DateField, Field, Input } from '../../components/form/Fields';
import { EmptyState, ErrorState, FilterChips, ListSkeleton, SearchBar } from '../../components/list/ListParts';
import { confirmAction, HistoryList, opsStyles, Pager, PageTitle, PhotoAttachments, type PendingFile } from '../../components/operations/OpsParts';
import { BellIcon, ClipboardListIcon, FileTextIcon, PlusIcon, StoreIcon } from '../../components/icons';
import type { ScreenProps } from '../../navigation/types';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

const PRIORITY: Record<NotePriority, { label: string; tone: BadgeTone; bar: string }> = {
  NORMAL: { label: 'Normal', tone: 'slate', bar: '#e2e8f0' },
  IMPORTANT: { label: 'Important', tone: 'amber', bar: '#fbbf24' },
  URGENT: { label: 'Urgent', tone: 'red', bar: '#ef4444' },
};
const STATUS_TABS: { value: NoteStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
];
type ReminderChoice = 'none' | 'today' | 'tomorrow' | 'custom';

/** Today / Tomorrow remind at 10:00 (or in an hour if today's 10:00 has passed), as on the panel. */
export function reminderTime(choice: ReminderChoice, customDate: string, customTime: string, now = new Date()): string | null {
  if (choice === 'none') return null;
  if (choice === 'custom') {
    if (!customDate || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(customTime)) return null;
    const [h, m] = customTime.split(':').map(Number);
    const [y, mo, d] = customDate.split('-').map(Number);
    return new Date(y, mo - 1, d, h, m).toISOString();
  }
  const at = new Date(now);
  if (choice === 'tomorrow') at.setDate(at.getDate() + 1);
  at.setHours(10, 0, 0, 0);
  if (at <= now) return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  return at.toISOString();
}

/** Operations › Notes: the shop diary — reminders, supplier visits, things to remember. */
export function NotesScreen({ navigation }: ScreenProps<'Notes'>) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('store-notes:view');
  const canCreate = hasPermission('store-notes:create');
  const canEdit = hasPermission('store-notes:edit');
  const canDelete = hasPermission('store-notes:delete');
  const toast = useToast();
  const { current: store } = useStore();
  const storeId = allowed ? store?.id ?? '' : '';
  const today = todayDay();

  const [status, setStatus] = useState<NoteStatus>('ACTIVE');
  const [priority, setPriority] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<StoreNote | 'new' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const listRef = useRef<FlatList<StoreNote>>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setPage(1), [status, priority, search]);

  const list = useFetch(
    () =>
      storeId
        ? storeOperationsService.notes(storeId, { status, page, limit: PAGE_SIZE, ...(priority ? { priority } : {}), ...(search ? { search } : {}) })
        : Promise.resolve(null),
    [storeId, status, priority, search, page],
  );

  if (!allowed) {
    return (
      <View style={opsStyles.screen}>
        <AppHeader title="Notes" onBack={navigation.goBack} />
        <ComingSoon label="Notes" icon={ClipboardListIcon} allowed={false} />
      </View>
    );
  }

  async function setNoteStatus(note: StoreNote, next: NoteStatus, message: string) {
    try {
      await storeOperationsService.setNoteStatus(storeId, note.id, next);
      toast(message);
      list.reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  async function remove(note: StoreNote) {
    if (!(await confirmAction(`Delete the note "${note.title}"?`, undefined, 'Delete', true))) return;
    try {
      await storeOperationsService.removeNote(storeId, note.id);
      toast('Note deleted');
      list.reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    }
  }

  const counts = list.data?.counts;
  const items = list.data?.items ?? [];
  const filtered = !!(search || priority);

  const header = (
    <View style={styles.headerBlock}>
      <View style={opsStyles.rowBetween}>
        <View style={styles.flex}>
          <PageTitle title="Notes" subtitle="Your shop diary: reminders, supplier visits, things to remember." />
        </View>
        {canCreate && store ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Add Note" onPress={() => setEditing('new')} style={opsStyles.primaryBtn}>
            <PlusIcon size={15} color={colors.white} strokeWidth={2.4} />
            <Text style={opsStyles.primaryBtnText}>Add Note</Text>
          </Pressable>
        ) : null}
      </View>
      <FilterChips
        options={STATUS_TABS.map(t => ({
          value: t.value,
          label: t.value === 'ACTIVE' && counts?.urgent ? `${t.label} · ${counts.urgent} urgent` : t.label,
          count: counts?.[t.value.toLowerCase() as 'active' | 'completed' | 'archived'],
        }))}
        value={status}
        onChange={v => setStatus(v as NoteStatus)}
      />
      <SearchBar value={query} onChange={setQuery} placeholder="Search notes…" />
      <FilterChips
        options={[{ value: '', label: 'All priorities' }, ...(Object.keys(PRIORITY) as NotePriority[]).map(p => ({ value: p, label: PRIORITY[p].label }))]}
        value={priority}
        onChange={setPriority}
      />
    </View>
  );

  return (
    <View style={opsStyles.screen}>
      <AppHeader title="Notes" onBack={navigation.goBack} />
      {!store ? (
        <EmptyState icon={StoreIcon} title="You don't have a store yet" />
      ) : (
        <FlatList
          ref={listRef}
          data={list.loading || (list.error && !list.data) ? [] : items}
          keyExtractor={n => n.id}
          ListHeaderComponent={header}
          renderItem={({ item: n }) => (
            <NoteCard
              note={n}
              canEdit={canEdit}
              canDelete={canDelete}
              onOpen={() => setViewing(n.id)}
              onComplete={() => setNoteStatus(n, 'COMPLETED', 'Marked complete')}
              onReopen={() => setNoteStatus(n, 'ACTIVE', 'Note reopened')}
              onArchive={() => setNoteStatus(n, 'ARCHIVED', 'Note archived')}
              onEdit={() => setEditing(n)}
              onDelete={() => remove(n)}
            />
          )}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            list.loading ? (
              <ListSkeleton height={120} />
            ) : list.error && !list.data ? (
              <ErrorState message={list.error} onRetry={() => list.reload()} />
            ) : (
              <EmptyState
                icon={ClipboardListIcon}
                title={filtered ? 'No notes match' : `No ${status.toLowerCase()} notes`}
                text={status === 'ACTIVE' && !filtered ? 'Your shop diary: supplier visits, things to reorder, reminders for the team.' : undefined}
              />
            )
          }
          ListFooterComponent={
            list.data ? (
              <Pager
                page={page}
                total={list.data.total}
                limit={PAGE_SIZE}
                noun="notes"
                onPage={p => {
                  setPage(p);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
              />
            ) : undefined
          }
          contentContainerStyle={opsStyles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => list.reload(true)} tintColor={colors.secondary} colors={[colors.secondary]} />}
        />
      )}

      <NoteFormSheet
        storeId={storeId}
        today={today}
        note={editing === 'new' ? null : editing}
        visible={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          list.reload();
        }}
      />
      <NoteViewSheet storeId={storeId} id={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function NoteCard({
  note: n,
  canEdit,
  canDelete,
  onOpen,
  onComplete,
  onReopen,
  onArchive,
  onEdit,
  onDelete,
}: {
  note: StoreNote;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onArchive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = PRIORITY[n.priority] ?? PRIORITY.NORMAL;
  const reminderDue = n.reminderAt && !n.reminderSentAt && new Date(n.reminderAt) > new Date();
  return (
    <View style={styles.card}>
      <View style={[styles.bar, { backgroundColor: meta.bar }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Note: ${n.title}`} onPress={onOpen} style={styles.cardBody}>
        <View style={opsStyles.rowBetween}>
          <Text style={[styles.noteTitle, n.status === 'COMPLETED' && styles.done]} numberOfLines={2}>
            {n.title}
          </Text>
          <Badge label={meta.label} tone={meta.tone} />
        </View>
        {n.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {n.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={opsStyles.meta}>{day(n.noteDate)}</Text>
          {n.reminderAt ? (
            <View style={styles.reminder}>
              <BellIcon size={13} color={reminderDue ? '#7c3aed' : colors.textMuted} />
              <Text style={[opsStyles.meta, reminderDue ? styles.reminderDue : null]}>{`${dateTime(n.reminderAt)}${n.reminderSentAt ? ' · sent' : ''}`}</Text>
            </View>
          ) : null}
          {n.attachmentUrl ? <FileTextIcon size={13} color={colors.textMuted} /> : null}
          {n.createdByName ? <Text style={opsStyles.meta}>{`by ${n.createdByName}`}</Text> : null}
        </View>
      </Pressable>
      {canEdit || canDelete ? (
        <View style={styles.actions}>
          {canEdit && n.status === 'ACTIVE' ? <Action label="Complete" tone={colors.successDark} onPress={onComplete} /> : null}
          {canEdit && n.status !== 'ACTIVE' ? <Action label="Reopen" onPress={onReopen} /> : null}
          {canEdit && n.status !== 'ARCHIVED' ? <Action label="Archive" onPress={onArchive} /> : null}
          {canEdit ? <Action label="Edit" onPress={onEdit} /> : null}
          {canDelete ? <Action label="Delete" tone={colors.error} onPress={onDelete} last /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Action({ label, onPress, tone, last }: { label: string; onPress: () => void; tone?: string; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={4} style={[styles.action, last && styles.actionLast]}>
      <Text style={[styles.actionText, tone ? { color: tone } : null]}>{label}</Text>
    </Pressable>
  );
}

/** Add / edit a note: the panel's fields, reminder choices and one photo. */
function NoteFormSheet({
  storeId,
  today,
  note,
  visible,
  onClose,
  onSaved,
}: {
  storeId: string;
  today: string;
  note: StoreNote | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', description: '', noteDate: today, priority: 'NORMAL' as NotePriority });
  const [reminder, setReminder] = useState<ReminderChoice>('none');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('10:00');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setForm({ title: note?.title ?? '', description: note?.description ?? '', noteDate: note?.noteDate ?? today, priority: note?.priority ?? 'NORMAL' });
    const at = note?.reminderAt ? new Date(note.reminderAt) : null;
    setReminder(at ? 'custom' : 'none');
    setCustomDate(at ? `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}` : '');
    setCustomTime(at ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '10:00');
    setFiles(note?.attachmentFileId ? [{ fileId: note.attachmentFileId, name: note.attachmentName ?? 'Attachment', url: note.attachmentUrl, kind: 'OTHER' }] : []);
    setError('');
  }, [visible, note, today]);

  async function save() {
    if (!form.title.trim()) return setError('Give the note a title');
    if (reminder === 'custom' && !reminderTime('custom', customDate, customTime)) return setError('Pick the reminder date and time');
    setError('');
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description,
      noteDate: form.noteDate,
      priority: form.priority,
      reminderAt: reminderTime(reminder, customDate, customTime),
      attachmentFileId: files[0]?.fileId ?? null,
    };
    try {
      if (note) await storeOperationsService.updateNote(storeId, note.id, payload);
      else await storeOperationsService.createNote(storeId, payload);
      toast(note ? 'Note updated' : 'Note added');
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} title={note ? 'Edit Note' : 'Add Note'} onClose={onClose} footer={<Button title={note ? 'Save Changes' : 'Add Note'} onPress={save} loading={saving} />}>
      <Field label="Title" required>
        <Input value={form.title} onChangeText={title => setForm(f => ({ ...f, title }))} placeholder="e.g. Supplier ABC will visit tomorrow" maxLength={200} />
      </Field>
      <Field label="Description">
        <Input value={form.description} onChangeText={description => setForm(f => ({ ...f, description }))} maxLength={5000} multiline />
      </Field>
      <DateField label="Date" value={form.noteDate} onChange={noteDate => setForm(f => ({ ...f, noteDate: noteDate || today }))} />
      <Field label="Priority">
        <Choices
          options={(Object.keys(PRIORITY) as NotePriority[]).map(p => ({ value: p, label: PRIORITY[p].label }))}
          value={form.priority}
          onChange={v => setForm(f => ({ ...f, priority: v as NotePriority }))}
        />
      </Field>
      <Field label="Reminder" hint={reminder !== 'none' ? "You'll get a notification in the bell when it's due." : undefined}>
        <Choices
          options={[
            { value: 'none', label: 'No Reminder' },
            { value: 'today', label: 'Today' },
            { value: 'tomorrow', label: 'Tomorrow' },
            { value: 'custom', label: 'Specific Date/Time' },
          ]}
          value={reminder}
          onChange={v => setReminder(v as ReminderChoice)}
        />
      </Field>
      {reminder === 'custom' ? (
        <>
          <DateField label="Reminder date" required value={customDate} onChange={setCustomDate} />
          <Field label="Reminder time" hint="24-hour, e.g. 09:30 or 16:00">
            <Input value={customTime} onChangeText={setCustomTime} keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Reminder time" />
          </Field>
        </>
      ) : null}
      <PhotoAttachments label="Attachment" value={files} onChange={setFiles} dirName="store-notes" max={1} kinds={false} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

function NoteViewSheet({ storeId, id, onClose }: { storeId: string; id: string | null; onClose: () => void }) {
  const { data, error, loading } = useFetch(() => (id ? storeOperationsService.note(storeId, id) : Promise.resolve(null)), [storeId, id]);
  const note = data && data.id === id ? data : null;
  return (
    <Sheet visible={!!id} title={note?.title ?? 'Note'} onClose={onClose}>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : loading || !note ? (
        <ListSkeleton rows={2} height={60} />
      ) : (
        <View style={styles.view}>
          <View style={styles.metaRow}>
            <Badge label={PRIORITY[note.priority]?.label ?? note.priority} tone={PRIORITY[note.priority]?.tone ?? 'slate'} />
            <Badge label={note.status.charAt(0) + note.status.slice(1).toLowerCase()} tone="slate" />
            <Text style={opsStyles.meta}>{day(note.noteDate)}</Text>
          </View>
          {note.description ? <Text style={styles.viewText}>{note.description}</Text> : null}
          {note.reminderAt ? (
            <View style={styles.reminder}>
              <BellIcon size={15} color="#6d28d9" />
              <Text style={styles.viewReminder}>{`Reminder ${dateTime(note.reminderAt)}${note.reminderSentAt ? ` · sent ${dateTime(note.reminderSentAt)}` : ''}`}</Text>
            </View>
          ) : null}
          {note.attachmentUrl ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(note.attachmentUrl!)} style={styles.attachment}>
              <FileTextIcon size={15} color={colors.text} />
              <Text style={styles.attachmentText}>{note.attachmentName ?? 'View attachment'}</Text>
            </Pressable>
          ) : null}
          <Text style={opsStyles.sectionLabel}>HISTORY</Text>
          <HistoryList entries={note.history} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  headerBlock: { gap: 12, marginBottom: 4 },
  separator: { height: 10 },
  card: { overflow: 'hidden', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, ...shadow.card },
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 4 },
  cardBody: { paddingLeft: 18, paddingRight: 14, paddingTop: 12, paddingBottom: 10 },
  noteTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  done: { color: colors.textMuted, textDecorationLine: 'line-through' },
  description: { marginTop: 4, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, marginTop: 8 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reminderDue: { color: '#7c3aed' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  action: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  actionLast: { marginLeft: 'auto' },
  actionText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
  view: { gap: 12 },
  viewText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  viewReminder: { fontFamily: fonts.medium, fontSize: 13, color: '#6d28d9' },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.background },
  attachmentText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
});
