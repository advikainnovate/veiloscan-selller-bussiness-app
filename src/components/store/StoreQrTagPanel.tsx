import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import { dateTime } from '../../lib/operations';
import { openMenuKey } from '../../navigation/navigationRef';
import { qrTagService, type QrTagStatus, type StoreQrTagView } from '../../services/qr-tag-service';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/form/Fields';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/list/ListParts';
import { opsStyles } from '../../components/operations/OpsParts';
import { AlertCircleIcon, CheckCircleIcon, FileTextIcon, ImageIcon, LockIcon, QrCodeIcon, RefreshIcon } from '../../components/icons';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const PREVIEW_DELAY_MS = 350;

const STATUS: Record<QrTagStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { get label() { return i18n.t('common.pending'); }, tone: 'slate' },
  GENERATING: { get label() { return i18n.t('store.generating'); }, tone: 'blue' },
  COMPLETED: { get label() { return i18n.t('common.ready'); }, tone: 'green' },
  FAILED: { get label() { return i18n.t('common.failed'); }, tone: 'red' },
};

interface Selection {
  frame: string;
  themeId: string;
}


/**
 * The store page's QR Store Tag tab: the store's printable tag (4 × 6 in).
 * Pick a design and colour theme (the plan decides how many are open), see
 * a live preview, then generate; the backend reuses the saved tag while
 * nothing has changed.
 */
export function StoreQrTagPanel({ storeId, storeName, storeStatus, canEdit }: { storeId: string; storeName: string; storeStatus: string; canEdit: boolean }) {
  const { t: tr } = useTranslation();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch(() => qrTagService.get(storeId), [storeId]);
  const [view, setView] = useState<StoreQrTagView | null>(null);
  // Picked here; until then the saved tag's design and theme (or the first open ones).
  const [picked, setPicked] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ image: string | null; loading: boolean; error: string | null }>({ image: null, loading: false, error: null });

  // A new store, or fresh data, starts from what's saved.
  useEffect(() => {
    setView(null);
    setPicked(null);
    setPreview({ image: null, loading: false, error: null });
  }, [data]);

  const current = view ?? data ?? null;
  const tag = current?.tag ?? null;
  const ready = !!tag?.tagImageUrl;
  const selection: Selection | null = picked ?? (current?.frame && current.themeId ? { frame: current.frame, themeId: current.themeId } : null);
  const matchesSaved = !!(ready && selection && tag?.frame === selection.frame && tag?.themeId === selection.themeId);
  // The saved tag when it matches the picked design and is current; otherwise a live preview.
  const showingSaved = matchesSaved && !current?.isOutdated;
  const wantPreview = !!(canEdit && current?.enabled && selection && !showingSaved);
  const previewKey = wantPreview && selection ? `${selection.frame}|${selection.themeId}` : null;

  const requestRef = useRef(0);
  useEffect(() => {
    if (!previewKey || !storeId) return;
    const [frame, themeId] = previewKey.split('|');
    const request = ++requestRef.current;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPreview(p => ({ ...p, loading: true, error: null }));
      qrTagService
        .preview(storeId, { frame, themeId }, controller.signal)
        .then(result => {
          if (request === requestRef.current) setPreview({ image: result.image, loading: false, error: null });
        })
        .catch(err => {
          if (axios.isCancel(err) || request !== requestRef.current) return;
          setPreview(p => ({ ...p, loading: false, error: extractErrorMessage(err) }));
        });
    }, PREVIEW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [previewKey, storeId]);

  async function generate(regenerate: boolean) {
    if (!selection) return;
    setBusy(true);
    try {
      const result = await qrTagService.generate(storeId, { ...selection, regenerate });
      setView(result);
      setPicked(null);
      toast(result.generated ? tr('store.storeTagGenerated') : tr('store.yourStoreTagIsAlreadyUp'));
      if (result.warnings?.length) toast(result.warnings.join('. '), 'error');
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function open(url: string | null | undefined) {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      toast(tr('store.couldnTOpenTheFileOn'), 'error');
    }
  }

  async function shareLink(url: string) {
    try {
      await Share.share({ message: tr('store.shopWithStorenameOnVeiloscanUrl', { storeName, url }), url });
    } catch {
      // Dismissed.
    }
  }

  let body: ReactNode;
  if (loading) {
    body = <ListSkeleton rows={3} height={160} />;
  } else if (error && !current) {
    body = <ErrorState message={error} onRetry={() => reload()} />;
  } else if (!current?.enabled) {
    body = <EmptyState icon={QrCodeIcon} title={tr('store.notAvailableYet')} text={tr('store.qrStoreTagsAreNotAvailable')} />;
  } else {
    const { designs, themes, plan } = current;
    const design = designs.find(d => d.key === selection?.frame);
    const status = tag ? STATUS[tag.status] : null;
    const shownImage = showingSaved || !canEdit ? tag?.tagImageUrl ?? null : preview.image;
    const hasLocked = designs.some(d => d.locked) || themes.some(t => t.locked);

    body = (
      <>
        <View style={styles.tagWrap}>
          <View style={styles.tag}>
            {shownImage ? (
              <Image
                source={{ uri: shownImage }}
                style={[styles.tagImage, preview.loading && !showingSaved && styles.dim]}
                resizeMode="contain"
                accessibilityLabel={showingSaved ? tr('store.storeQrTag') : tr('store.storeQrTagPreview')}
              />
            ) : (
              <View style={styles.tagEmpty}>
                <QrCodeIcon size={40} color={colors.textMuted} />
                <Text style={opsStyles.muted}>{!selection ? tr('common.notIncludedInYourPlan') : canEdit ? tr('store.preparingPreview') : tr('store.noTagGeneratedYet')}</Text>
              </View>
            )}
            {preview.loading && !showingSaved ? (
              <View style={styles.spinner}>
                <ActivityIndicator size="small" color={colors.secondary} />
              </View>
            ) : null}
          </View>
          <Text style={[opsStyles.muted, styles.center]}>
            {showingSaved || !canEdit ? (ready ? tr('store.yourCurrentTag') : '') : selection ? tr('store.previewGenerateTheTagToSave') : ''}
          </Text>
          {preview.error && !showingSaved ? <Text style={[styles.errorText, styles.center]}>{preview.error}</Text> : null}
        </View>

        <Text style={opsStyles.meta}>
          {tr('store.printThisTagAndPlaceIt')}</Text>

        {plan.designLimit !== null || plan.themeLimit !== null ? (
          <View style={styles.plan}>
            <Text style={styles.planText}>
              {tr('store.planIncludesDesignsAndThemes', {
                plan: plan.name ? tr('store.yourNamedPlan', { name: plan.name }) : tr('store.yourPlan'),
                designs: plan.designLimit === null ? tr('store.everyDesign') : tr('store.tagDesignCount', { count: plan.designLimit }),
                themes: plan.themeLimit === null ? tr('store.everyColourTheme') : tr('store.colourThemeCount', { count: plan.themeLimit }),
              })}
            </Text>
            {hasLocked ? (
              <Pressable accessibilityRole="link" onPress={() => openMenuKey('subscription')} hitSlop={6}>
                <Text style={styles.planLink}>{tr('store.upgradeForMore')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {canEdit && !selection ? (
          <Notice tone="amber">
            <Trans i18nKey="store.planDoesNotIncludeQrUpgrade" components={{ link: <Text style={styles.noticeLink} onPress={() => openMenuKey('subscription')} /> }} />
          </Notice>
        ) : null}

        {canEdit && selection ? (
          <View style={styles.box}>
            <SelectField
              label={tr('store.tagDesign')}
              hint={design?.description ?? undefined}
              value={selection.frame}
              // A locked design can't be picked: the panel disables it.
              options={designs.map(d => ({ value: d.key, label: d.locked ? tr('store.nameUpgradeToUnlock', { name: d.name }) : d.name }))}
              onChange={frame => {
                if (designs.find(d => d.key === frame)?.locked) return toast(tr('store.upgradeYourPlanToUseThis'), 'error');
                setPicked({ ...selection, frame });
              }}
            />
            <Text style={styles.label}>{tr('store.colourTheme')}</Text>
            <View style={styles.themes}>
              {themes.map(theme => {
                const active = theme.id === selection.themeId;
                return (
                  <Pressable
                    key={theme.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: theme.locked }}
                    accessibilityLabel={theme.locked ? tr('store.nameUpgradeYourPlanToUse', { name: theme.name }) : theme.name}
                    disabled={theme.locked}
                    onPress={() => setPicked({ ...selection, themeId: theme.id })}
                    style={[styles.theme, active && styles.themeOn, theme.locked && styles.locked]}
                  >
                    <View style={styles.swatches}>
                      <View style={[styles.swatch, { backgroundColor: theme.accentColor }]} />
                      <View style={[styles.swatch, styles.swatchOverlap, { backgroundColor: theme.darkColor }]} />
                    </View>
                    <Text style={[styles.themeText, active && styles.themeTextOn]}>{theme.name}</Text>
                    {theme.locked ? <LockIcon size={12} color={colors.textMuted} /> : null}
                  </Pressable>
                );
              })}
            </View>
            {showingSaved ? (
              <View style={opsStyles.row}>
                <CheckCircleIcon size={16} color={colors.successDark} />
                <Text style={styles.saved}>{tr('store.yourTagUsesThisDesignAnd')}</Text>
              </View>
            ) : (
              <Button title={ready ? tr('store.saveAndGenerateTag') : tr('store.generateStoreTag')} loading={busy} onPress={() => generate(false)} icon={<QrCodeIcon size={18} color={colors.white} />} />
            )}
            <View style={opsStyles.chipRow}>
              {ready && !matchesSaved && picked ? (
                <Pressable accessibilityRole="button" onPress={() => setPicked(null)} style={opsStyles.smallBtn}>
                  <Text style={opsStyles.smallBtnText}>{tr('store.backToCurrentDesign')}</Text>
                </Pressable>
              ) : null}
              {showingSaved ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => generate(true)} style={opsStyles.smallBtn}>
                  <RefreshIcon size={15} color={colors.text} />
                  <Text style={opsStyles.smallBtnText}>{busy ? tr('store.regenerating') : tr('store.regenerate')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {storeStatus !== 'ACTIVE' ? <Notice tone="amber">{tr('store.theQrCodeOpensYourShop')}</Notice> : null}
        {current.isOutdated ? <Notice tone="amber">{tr('store.yourStoreDetailsTheTagDesign')}</Notice> : null}
        {tag?.status === 'FAILED' && tag.errorMessage ? <Notice tone="red">{tr('store.lastAttemptFailedErrormessage', { errorMessage: tag.errorMessage })}</Notice> : null}

        {ready && tag ? (
          <View style={styles.box}>
            <View style={opsStyles.rowBetween}>
              <Text style={opsStyles.title}>{tr('store.currentTag')}</Text>
              {status ? <Badge label={status.label} tone={status.tone} /> : null}
            </View>
            {tag.qrCodeUrl ? (
              <View style={styles.detail}>
                <Text style={opsStyles.muted}>{tr('store.qrOpens')}</Text>
                <Pressable accessibilityRole="link" onPress={() => open(tag.qrCodeUrl)}>
                  <Text style={styles.url} numberOfLines={1}>
                    {tag.qrCodeUrl.replace(/^https?:\/\//, '')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {tag.generatedAt ? (
              <View style={styles.detail}>
                <Text style={opsStyles.muted}>{tr('store.generated')}</Text>
                <Text style={opsStyles.title}>{dateTime(tag.generatedAt)}</Text>
              </View>
            ) : null}
            <Button title={tr('store.downloadPdfPrint')} onPress={() => open(tag.tagPdfDownloadUrl ?? tag.tagPdfUrl)} icon={<FileTextIcon size={18} color={colors.white} />} />
            <View style={opsStyles.chipRow}>
              <Pressable accessibilityRole="button" onPress={() => open(tag.tagImageDownloadUrl ?? tag.tagImageUrl)} style={opsStyles.smallBtn}>
                <ImageIcon size={15} color={colors.text} />
                <Text style={opsStyles.smallBtnText}>{tr('store.downloadPng')}</Text>
              </Pressable>
              {tag.tagPdfUrl ? (
                <Pressable accessibilityRole="button" onPress={() => open(tag.tagPdfUrl)} style={opsStyles.smallBtn}>
                  <FileTextIcon size={15} color={colors.text} />
                  <Text style={opsStyles.smallBtnText}>{tr('store.openToPrint')}</Text>
                </Pressable>
              ) : null}
              {tag.qrCodeUrl ? (
                <Pressable accessibilityRole="button" onPress={() => shareLink(tag.qrCodeUrl!)} style={opsStyles.smallBtn}>
                  <QrCodeIcon size={15} color={colors.text} />
                  <Text style={opsStyles.smallBtnText}>{tr('store.shareShopLink')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </>
    );
  }

  return <View style={styles.panel}>{body}</View>;
}

function Notice({ tone, children }: { tone: 'amber' | 'red'; children: ReactNode }) {
  const red = tone === 'red';
  return (
    <View style={[styles.notice, red ? styles.noticeRed : styles.noticeAmber]}>
      <AlertCircleIcon size={16} color={red ? colors.errorDark : colors.warningDark} />
      <Text style={[styles.noticeText, { color: red ? colors.errorDark : colors.warningDark }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 14 },
  center: { textAlign: 'center' },
  tagWrap: { gap: 8, alignItems: 'center' },
  // The tag is 4 × 6 in: 2 : 3.
  tag: {
    width: '78%',
    aspectRatio: 2 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tagImage: { width: '100%', height: '100%' },
  dim: { opacity: 0.6 },
  tagEmpty: { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  spinner: { position: 'absolute', top: 10, right: 10, padding: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)' },
  errorText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.error },
  plan: { gap: 4, padding: 12, borderRadius: radius.md, backgroundColor: colors.secondaryLight },
  planText: { fontFamily: fonts.regular, fontSize: 12.5, color: '#9a3412' },
  planLink: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.secondaryDark },
  box: { gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  theme: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  themeOn: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  locked: { opacity: 0.5 },
  swatches: { flexDirection: 'row' },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.white },
  swatchOverlap: { marginLeft: -6 },
  themeText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  themeTextOn: { color: colors.secondaryDark, fontFamily: fonts.semibold },
  saved: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.successDark },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: radius.md },
  noticeAmber: { backgroundColor: colors.warningLight },
  noticeRed: { backgroundColor: colors.errorLight },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18 },
  noticeLink: { fontFamily: fonts.semibold, textDecorationLine: 'underline' },
  detail: { gap: 2 },
  url: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.info },
});
