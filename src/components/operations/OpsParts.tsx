import React, { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Alert as NativeAlert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import { pickImages } from '../../lib/pick-image';
import { ATTACHMENT_KIND_LABEL, dateTime, rangePresets, type OpsRange } from '../../lib/operations';
import { fileService } from '../../services/products-service';
import type { AttachmentKind, ExpenseAttachment } from '../../services/expenses-service';
import type { LogEntry } from '../../services/store-operations-service';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { DateField, Field, Input } from '../form/Fields';
import { ChevronRightIcon, CloseIcon, FileTextIcon, ImageIcon, type IconProps } from '../icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

// Building blocks shared by the Operations screens (the Seller Panel's ops-ui).

export const OPS_TONES = {
  orange: ['#fff7ed', '#ea580c'],
  emerald: ['#ecfdf5', '#059669'],
  blue: ['#eff6ff', '#2563eb'],
  violet: ['#f5f3ff', '#7c3aed'],
  red: ['#fef2f2', '#dc2626'],
  amber: ['#fffbeb', '#d97706'],
  sky: ['#f0f9ff', '#0284c7'],
  slate: ['#f1f5f9', '#475569'],
} as const;
export type OpsTone = keyof typeof OPS_TONES;

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text style={styles.pageTitle} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** "Restricted for your role", where profit would be. */
export const profitHidden = () => i18n.t('operations.restrictedForYourRole');

export function StatCard({
  icon: Icon,
  tone = 'slate',
  label,
  value,
  sub,
  delta,
  invertDelta,
  negative,
  loading,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  tone?: OpsTone;
  label: string;
  value: string;
  sub?: string | null;
  delta?: number | null;
  /** For costs: a rise is bad. */
  invertDelta?: boolean;
  negative?: boolean;
  loading?: boolean;
  onPress?: () => void;
}) {
  const good = delta != null && (invertDelta ? delta <= 0 : delta >= 0);
  const [bg, fg] = OPS_TONES[tone];
  const body = (
    <>
      <View style={styles.statHead}>
        <View style={[styles.statIcon, { backgroundColor: bg }]}>
          <Icon size={16} color={fg} />
        </View>
        <Text style={styles.statLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
      {loading ? (
        <View style={styles.statSkeleton} />
      ) : (
        <Text style={[styles.statValue, negative && styles.negative]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
      )}
      <Text style={styles.statSub} numberOfLines={2}>
        {delta != null && !loading ? (
          <Text style={[styles.delta, { color: good ? colors.success : colors.error }]}>{`${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% `}</Text>
        ) : null}
        {sub ?? ''}
      </Text>
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${loading ? 'loading' : value}`}>
      {body}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** A white section card with a title row. */
export function OpsCard({ title, description, action, children }: { title?: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.cardHead}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{title}</Text>
            {description ? <Text style={styles.cardDescription}>{description}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

export function NoData({ text }: { text: string }) {
  return <Text style={styles.noData}>{text}</Text>;
}

export function Placeholder({ height = 160 }: { height?: number }) {
  return <View style={[styles.placeholder, { height }]} />;
}

/** The panel's preset chips plus Custom, which opens a from / to picker. */
export function RangeChips({
  today,
  value,
  onChange,
  keys,
  allowCustom = true,
}: {
  today: string;
  value: OpsRange;
  onChange: (range: OpsRange) => void;
  /** Which presets to show (all when omitted). */
  keys?: string[];
  allowCustom?: boolean;
}) {
  const { t } = useTranslation();
  const presets = rangePresets(today).filter(p => !keys || keys.includes(p.key));
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const invalid = !draft.from || !draft.to || draft.from > draft.to || draft.to > today;
  const fromISO = (s: string) => new Date(`${s}T00:00:00`);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {presets.map(p => {
          const on = value.key === p.key;
          return (
            <Pressable
              key={p.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(p)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
            </Pressable>
          );
        })}
        {allowCustom ? (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: value.key === 'custom' }}
            onPress={() => {
              setDraft({ from: value.from, to: value.to });
              setPicking(true);
            }}
            style={[styles.chip, value.key === 'custom' && styles.chipOn]}
          >
            <Text style={[styles.chipText, value.key === 'custom' && styles.chipTextOn]}>{t('common.custom')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Sheet
        visible={picking}
        title={t('operations.customRange')}
        onClose={() => setPicking(false)}
        footer={
          <Button
            title={t('common.apply')}
            disabled={invalid}
            onPress={() => {
              onChange({ key: 'custom', label: t('common.custom'), ...draft });
              setPicking(false);
            }}
          />
        }
      >
        <DateField label={t('common.from')} required value={draft.from} onChange={from => setDraft(d => ({ ...d, from }))} maximumDate={fromISO(draft.to || today)} />
        <DateField label={t('common.to')} required value={draft.to} onChange={to => setDraft(d => ({ ...d, to }))} minimumDate={draft.from ? fromISO(draft.from) : undefined} maximumDate={fromISO(today)} />
        {draft.from && draft.to && draft.from > draft.to ? <Text style={styles.error}>{t('operations.theStartCanTBeAfter')}</Text> : null}
      </Sheet>
    </>
  );
}

/** Previous / next with "Showing 1–20 of 54". */
export function Pager({ page, total, limit, onPage, noun = 'items' }: { page: number; total: number; limit: number; onPage: (p: number) => void; noun?: string }) {
  const { t } = useTranslation();
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <View style={styles.pager}>
      <Text style={styles.pagerText}>{t('operations.showingCountMinOfTotalNoun', { count: (page - 1) * limit + 1, min: Math.min(page * limit, total), total, noun })}</Text>
      {pages > 1 ? (
        <>
          <PageButton label={t('common.previousPage')} disabled={page <= 1} onPress={() => onPage(page - 1)} flip />
          <Text style={styles.pagerCount}>{`${page} / ${pages}`}</Text>
          <PageButton label={t('common.nextPage')} disabled={page >= pages} onPress={() => onPage(page + 1)} />
        </>
      ) : null}
    </View>
  );
}

function PageButton({ label, disabled, onPress, flip }: { label: string; disabled: boolean; onPress: () => void; flip?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pageBtn, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={flip ? styles.flip : undefined}>
        <ChevronRightIcon size={18} color={colors.text} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const ACTION_LABEL: Record<string, string> = {
  get CREATE() { return i18n.t('common.created'); },
  get UPDATE() { return i18n.t('operations.edited'); },
  get STATUS() { return i18n.t('common.statusChanged'); },
  get DELETE() { return i18n.t('common.deleted'); },
  get CANCEL() { return i18n.t('common.cancelled'); },
  get PAYMENT() { return i18n.t('common.paymentRecorded'); },
  get VOID_PAYMENT() { return i18n.t('common.paymentVoided'); },
  get RETURN() { return i18n.t('common.returnRecorded'); },
};

/** Who changed what, newest first. */
export function HistoryList({ entries }: { entries: LogEntry[] | undefined }) {
  const { t } = useTranslation();
  if (!entries?.length) return <Text style={styles.muted}>{t('operations.noChangesYet')}</Text>;
  return (
    <View style={styles.history}>
      {entries.map(e => (
        <View key={e.id} style={styles.historyRow}>
          <View style={styles.historyDot} />
          <View style={styles.flex}>
            <Text style={styles.historyTitle}>{ACTION_LABEL[e.action] ?? e.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}</Text>
            <Text style={styles.historyMeta}>{`${e.userName ?? 'System'} · ${dateTime(e.createdAt)}`}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Asks before a change; resolves true when confirmed. */
export function confirmAction(title: string, message: string | undefined, confirmLabel: string, destructive = false): Promise<boolean> {
  return new Promise(resolve =>
    NativeAlert.alert(title, message, [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

/** A reason (cancel, void…) in a sheet, as the panel's promptDialog. */
export function ReasonSheet({
  visible,
  title,
  message,
  label = i18n.t('common.reason'),
  confirmLabel,
  required = true,
  maxLength = 500,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  label?: string;
  confirmLabel: string;
  required?: boolean;
  maxLength?: number;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);
  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={message}
      onClose={onClose}
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={busy || (required && !reason.trim())}
          onPress={async () => {
            setBusy(true);
            try {
              await onConfirm(reason.trim());
            } finally {
              setBusy(false);
            }
          }}
          style={({ pressed }) => [styles.danger, (pressed || busy) && styles.dangerPressed, required && !reason.trim() && styles.disabled]}
        >
          <Text style={styles.dangerText}>{busy ? t('common.saving') : confirmLabel}</Text>
        </Pressable>
      }
    >
      <Field label={label} required={required}>
        <Input value={reason} onChangeText={setReason} maxLength={maxLength} multiline accessibilityLabel={label} />
      </Field>
    </Sheet>
  );
}

export interface PendingFile {
  fileId: string;
  name: string;
  url: string | null;
  kind: AttachmentKind;
}

/** Bill / receipt photos, each uploaded as it's picked (the panel also takes PDFs). */
export function PhotoAttachments({
  value,
  onChange,
  label = i18n.t('common.attachments'),
  dirName,
  defaultKind = 'BILL',
  max = 10,
  kinds = true,
}: {
  value: PendingFile[];
  onChange: (files: PendingFile[]) => void;
  label?: string;
  dirName: string;
  defaultKind?: AttachmentKind;
  max?: number;
  /** Let each file be tagged Bill / Invoice / Receipt…. */
  kinds?: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function add() {
    try {
      const picked = await pickImages({ multiple: max - value.length > 1 });
      if (!picked.length) return;
      setUploading(true);
      const added: PendingFile[] = [];
      for (const file of picked.slice(0, max - value.length)) {
        const up = await fileService.upload(file, dirName);
        added.push({ fileId: String(up.id), name: (up.fileName as string | undefined) ?? file.name, url: up.url ?? null, kind: defaultKind });
      }
      onChange([...value, ...added]);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  }

  const kindKeys = Object.keys(ATTACHMENT_KIND_LABEL) as AttachmentKind[];
  return (
    <View style={styles.files}>
      <Text style={styles.filesLabel}>{label}</Text>
      {value.map((f, i) => (
        <View key={f.fileId} style={styles.fileRow}>
          <ImageIcon size={16} color={colors.textMuted} />
          <Text style={styles.fileName} numberOfLines={1}>
            {f.name}
          </Text>
          {kinds ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('operations.fileTypeAttachmentKindLabel', { ATTACHMENT_KIND_LABEL: ATTACHMENT_KIND_LABEL[f.kind] })}
              onPress={() => {
                const next = kindKeys[(kindKeys.indexOf(f.kind) + 1) % kindKeys.length];
                onChange(value.map((x, j) => (j === i ? { ...x, kind: next } : x)));
              }}
              style={styles.kind}
            >
              <Text style={styles.kindText}>{ATTACHMENT_KIND_LABEL[f.kind]}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.removeName', { name: f.name })} hitSlop={8} onPress={() => onChange(value.filter((_, j) => j !== i))}>
            <CloseIcon size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      {value.length < max ? (
        <Pressable accessibilityRole="button" disabled={uploading} onPress={add} style={({ pressed }) => [styles.addFile, pressed && styles.pressed]}>
          <ImageIcon size={16} color={colors.textSecondary} />
          <Text style={styles.addFileText}>{uploading ? t('common.uploading') : t('operations.addAPhotoOfTheBill')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Files already saved: tap to open. */
export function FileLinks({ files, onRemove }: { files: ExpenseAttachment[]; onRemove?: (f: ExpenseAttachment) => void }) {
  const { t } = useTranslation();
  if (!files.length) return null;
  return (
    <View style={styles.links}>
      {files.map(f => (
        <View key={f.id} style={styles.linkChip}>
          <FileTextIcon size={13} color={colors.textMuted} />
          <Pressable accessibilityRole="link" disabled={!f.url} onPress={() => f.url && Linking.openURL(f.url)} style={styles.flexShrink}>
            <Text style={styles.linkChipText} numberOfLines={1}>{`${f.fileName} · ${ATTACHMENT_KIND_LABEL[f.kind] ?? f.kind}`}</Text>
          </Pressable>
          {onRemove ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('operations.removeFilename', { fileName: f.fileName })} hitSlop={8} onPress={() => onRemove(f)}>
              <CloseIcon size={13} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** A label above its value, in a details card. */
export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' || value == null ? (
        <Text style={styles.detailValue}>{value === '' || value == null ? '—' : value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export const opsStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.6, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  listRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  meta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  amount: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  warn: { fontFamily: fonts.medium, fontSize: 12, color: colors.warningDark },
  danger: { color: colors.error },
  success: { color: colors.successDark },
  muted: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  smallBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    ...shadow.button,
  },
  primaryBtnText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  pressed: { opacity: 0.85 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, backgroundColor: colors.errorLight },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.errorDark },
});

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  flip: { transform: [{ rotate: '180deg' }] },
  pageTitle: { fontSize: 24, fontFamily: fonts.extrabold, color: colors.text, letterSpacing: -0.4 },
  pageSubtitle: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 15, color: colors.textSecondary },
  statValue: { marginTop: 10, fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, letterSpacing: -0.3 },
  statSkeleton: { marginTop: 12, height: 22, width: 90, borderRadius: 6, backgroundColor: colors.background },
  statSub: { marginTop: 2, minHeight: 15, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: colors.textSecondary },
  delta: { fontFamily: fonts.semibold },
  negative: { color: colors.error },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  cardDescription: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  cardBody: { padding: 16 },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.info },
  noData: { paddingVertical: 28, textAlign: 'center', fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  placeholder: { borderRadius: radius.md, backgroundColor: colors.background },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { height: 34, justifyContent: 'center', paddingHorizontal: 13, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  chipTextOn: { color: colors.white },
  error: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.error },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12 },
  pagerText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary },
  pagerCount: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.4 },
  muted: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  history: { gap: 10 },
  historyRow: { flexDirection: 'row', gap: 10 },
  historyDot: { width: 8, height: 8, marginTop: 5, borderRadius: 4, backgroundColor: colors.border },
  historyTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  historyMeta: { marginTop: 1, fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted },
  danger: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.error },
  dangerPressed: { backgroundColor: colors.errorDark },
  dangerText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  files: { gap: 8 },
  filesLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  fileName: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  kind: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.background },
  kindText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  addFile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addFileText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  linkChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.background },
  linkChipText: { fontFamily: fonts.regular, fontSize: 12, color: colors.text },
  detail: { gap: 2, paddingVertical: 4 },
  detailLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  detailValue: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
});
