import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { extractErrorMessage } from '../../lib/api';
import {
  approvalOf,
  buildTree,
  pathOf,
  productCounts,
  searchCategories,
  selectionCounts,
  setChecked,
  type Rec,
} from '../../lib/store-categories';
import { categoryService, productsService } from '../../services/products-service';
import { storeManageService } from '../../services/store-manage-service';
import { Button } from '../ui/Button';
import { SearchBar } from '../list/ListParts';
import { confirmAction, opsStyles, StatCard, StatGrid } from '../operations/OpsParts';
import { AlertCircleIcon, ArrowLeftIcon, CheckIcon, ChevronRightIcon, ClockIcon, FolderIcon, LayersIcon, RefreshIcon } from '../icons';
import { useTranslation } from 'react-i18next';

/**
 * The store page's Categories tab, as the panel's StoreCategoriesManager:
 * the main, sub and child categories the store sells in. Map Categories
 * opens the picker (one level at a time, or search across all); the whole
 * selection saves at once and new categories go to the platform for
 * approval. Each mapped category can be switched off for this store.
 */
export function StoreCategoriesPanel({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const master = useFetch(() => categoryService.list(), []);
  const tree = useMemo(() => buildTree((master.data ?? []) as Rec[]), [master.data]);
  // Without access to products the counts stay at 0.
  const products = useFetch(() => productsService.list({ storeId }).catch(() => []), [storeId]);
  const counts = useMemo(() => productCounts(tree, (products.data ?? []) as Rec[]), [tree, products.data]);
  const mapped = useFetch(() => storeManageService.categories(storeId), [storeId]);
  const assigned = useMemo(() => mapped.data ?? [], [mapped.data]);
  const mappingOf = useMemo(() => new Map(assigned.map(a => [String(a.categoryId), a])), [assigned]);
  const savedIds = useMemo(() => new Set(mappingOf.keys()), [mappingOf]);

  // The unsaved selection; null while it matches what's saved.
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [picking, setPicking] = useState(false);
  // The picker's trail: [] mains, [main] its subs, [main, sub] its children.
  const [trail, setTrail] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selected = draft ?? savedIds;
  const added = [...selected].filter(id => !savedIds.has(id));
  const removed = [...savedIds].filter(id => !selected.has(id));
  const dirty = added.length > 0 || removed.length > 0;
  const sel = selectionCounts(tree, selected);
  const pending = assigned.filter(a => approvalOf(a) === 'pending').length;
  const inactive = assigned.filter(a => a.status === 'inactive').length;
  const rejected = assigned.filter(a => approvalOf(a) === 'rejected');
  const title = (id: string) => String(tree.byId.get(id)?.categoryTitle ?? t('common.category'));

  const check = (ids: string[], on: boolean) => setDraft(setChecked(tree, selected, ids, on));

  async function save() {
    if (!dirty) return toast(t('store.noChangesToSave'));
    if (removed.length) {
      const names = removed.slice(0, 5).map(title).join(', ');
      const more = removed.length > 5 ? ` ${t('common.andCountMore', { count: removed.length - 5 })}` : '';
      if (!(await confirmAction(t('store.removeCategoriesFromStore', { count: removed.length, storeName }), `${names}${more}`, t('common.remove'), true))) return;
    }
    setSaving(true);
    try {
      await storeManageService.syncCategories(storeId, [...selected]);
      toast(added.length ? t('store.savedNewCategoriesWereSentFor') : t('store.storeCategoriesSaved'));
      setDraft(null);
      setPicking(false);
      mapped.reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function closePicker() {
    if (dirty && !(await confirmAction(t('store.discardYourUnsavedCategoryChanges'), undefined, t('common.discard'), true))) return;
    setDraft(null);
    setPicking(false);
  }

  async function busy(mapping: Rec, work: () => Promise<unknown>, done?: string) {
    setBusyId(String(mapping.id));
    try {
      await work();
      if (done) toast(done);
      mapped.reload();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }
  const toggle = (mapping: Rec, active: boolean) => busy(mapping, () => storeManageService.setCategoryStatus(storeId, String(mapping.id), active ? 'active' : 'inactive'));
  const resubmit = (mapping: Rec) => busy(mapping, () => storeManageService.resubmitCategory(storeId, String(mapping.id)), t('store.categorySentForApprovalAgain'));

  if (master.loading || mapped.loading) return <Text style={styles.loading}>{t('store.loadingCategories')}</Text>;
  if (mapped.error && !mapped.data) {
    return (
      <Pressable onPress={() => mapped.reload()}>
        <Text style={[opsStyles.meta, opsStyles.danger]}>{t('store.errorTapToTryAgain', { error: mapped.error })}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <StatGrid>
        <StatCard icon={FolderIcon} tone="orange" label={t('store.mainCategories')} value={String(sel.main)} sub={t('common.selected')} />
        <StatCard icon={LayersIcon} tone="blue" label={t('store.subCategories')} value={String(sel.sub)} sub={t('common.selected')} />
        <StatCard icon={LayersIcon} tone="emerald" label={t('store.childCategories')} value={String(sel.child)} sub={t('common.selected')} />
        <StatCard icon={ClockIcon} tone="red" label={t('store.awaitingApproval')} value={String(pending)} sub={t('store.inactiveInactive', { inactive })} />
      </StatGrid>

      {pending || rejected.length ? (
        <View style={styles.notice}>
          {pending ? (
            <Text style={styles.noticeText}>
              {t('store.categoriesAwaitingApproval', { count: pending })}
            </Text>
          ) : null}
          {rejected.map(m => (
            <View key={String(m.id)} style={styles.rejected}>
              <AlertCircleIcon size={15} color={colors.error} />
              <Text style={[opsStyles.meta, styles.flex]}>
                <Text style={styles.rejectedName}>{t('store.valueWasRejected', { value: String((m.category as Rec | undefined)?.categoryTitle ?? title(String(m.categoryId))) })}</Text>
                {m.approvalRemarks ? t('store.reasonApprovalremarks', { approvalRemarks: String(m.approvalRemarks) }) : ''}
              </Text>
              <Pressable accessibilityRole="button" disabled={busyId === m.id} onPress={() => resubmit(m)} style={opsStyles.smallBtn}>
                <Text style={opsStyles.smallBtnText}>{busyId === m.id ? '…' : t('common.requestAgain')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {!picking ? (
        <Associated tree={tree} savedIds={savedIds} mappingOf={mappingOf} counts={counts} busyId={busyId} storeName={storeName} onToggle={toggle} onMap={() => setPicking(true)} />
      ) : (
        <View style={styles.picker}>
          <SearchBar value={search} onChange={setSearch} placeholder={t('store.searchCategoriesByNameTagOr')} />
          {search.trim() ? (
            <SearchResults tree={tree} search={search} selected={selected} mappingOf={mappingOf} counts={counts} onCheck={check} />
          ) : (
            <Level tree={tree} trail={trail} setTrail={setTrail} selected={selected} mappingOf={mappingOf} counts={counts} busyId={busyId} onCheck={check} onToggle={toggle} />
          )}
          <View style={styles.saveBar}>
            <View style={opsStyles.row}>
              <View style={styles.saveIcon}>
                <CheckIcon size={13} color={colors.white} strokeWidth={3} />
              </View>
              <View style={styles.flex}>
                <Text style={opsStyles.title}>{t('store.mainMainSubSubChildChild', { main: sel.main, sub: sel.sub, child: sel.child })}</Text>
                <Text style={opsStyles.meta}>{t('store.newlyAddedCategoriesAreSentTo')}</Text>
              </View>
            </View>
            <Button title={added.length ? t('store.saveAndRequestApproval') : t('store.saveCategories')} loading={saving} onPress={save} />
            <View style={opsStyles.row}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={closePicker} style={[opsStyles.smallBtn, styles.grow]}>
                <Text style={opsStyles.smallBtnText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => setDraft(null)} style={[opsStyles.smallBtn, styles.grow]}>
                <RefreshIcon size={14} color={colors.text} />
                <Text style={opsStyles.smallBtnText}>{t('common.reset')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

type Counts = Map<string, number>;

function CategoryIcon({ category, small }: { category: Rec | undefined; small?: boolean }) {
  const url = category?.iconUrl as string | null | undefined;
  return (
    <View style={[styles.icon, small && styles.iconSmall]}>
      {url ? <Image source={{ uri: url }} style={small ? styles.imgSmall : styles.img} resizeMode="contain" /> : <FolderIcon size={small ? 14 : 17} color={colors.textMuted} />}
    </View>
  );
}

function ApprovalTag({ mapping }: { mapping: Rec | undefined }) {
  const { t } = useTranslation();
  const status = approvalOf(mapping);
  if (!mapping || status === 'approved') return null;
  return status === 'pending' ? (
    <View style={[styles.tag, styles.tagPending]}>
      <ClockIcon size={11} color={colors.warningDark} />
      <Text style={[styles.tagText, styles.pendingText]}>{t('common.awaitingApproval')}</Text>
    </View>
  ) : (
    <View style={[styles.tag, styles.tagRejected]}>
      <AlertCircleIcon size={11} color={colors.error} />
      <Text style={[styles.tagText, opsStyles.danger]}>{t('common.rejected')}</Text>
    </View>
  );
}

function StatusSwitch({ mapping, busyId, onToggle }: { mapping: Rec | undefined; busyId: string | null; onToggle: (m: Rec, active: boolean) => void }) {
  const { t } = useTranslation();
  if (!mapping) return null;
  const on = mapping.status !== 'inactive';
  return (
    <Switch
      accessibilityLabel={t('store.categoryActiveInStore', { category: String((mapping.category as Rec | undefined)?.categoryTitle ?? t('common.category')) })}
      value={on}
      disabled={busyId === mapping.id}
      onValueChange={v => onToggle(mapping, v)}
      trackColor={{ true: colors.success, false: colors.border }}
      thumbColor={colors.white}
    />
  );
}

/** What the store is mapped to (saved), main → sub → child. */
function Associated({
  tree,
  savedIds,
  mappingOf,
  counts,
  busyId,
  storeName,
  onToggle,
  onMap,
}: {
  tree: ReturnType<typeof buildTree>;
  savedIds: Set<string>;
  mappingOf: Map<string, Rec>;
  counts: Counts;
  busyId: string | null;
  storeName: string;
  onToggle: (m: Rec, active: boolean) => void;
  onMap: () => void;
}) {
  const { t } = useTranslation();
  const mains = tree.mains.filter(m => savedIds.has(String(m.id)));
  const under = (id: string) => (tree.childrenOf.get(id) ?? []).filter(c => savedIds.has(String(c.id)));
  const row = (c: Rec, small?: boolean) => {
    const id = String(c.id);
    const m = mappingOf.get(id);
    const off = m?.status === 'inactive';
    const n = counts.get(id) ?? 0;
    return (
      <View style={opsStyles.row}>
        <CategoryIcon category={c} small={small} />
        <View style={styles.flex}>
          <Text style={[small ? styles.subName : styles.mainName, off && styles.off]} numberOfLines={1}>
            {String(c.categoryTitle)}
          </Text>
          {off ? <Text style={styles.offText}>{t('store.inactiveInThisStore')}</Text> : null}
        </View>
        <ApprovalTag mapping={m} />
        <Text style={styles.count}>{t('common.productCount', { count: n })}</Text>
        <StatusSwitch mapping={m} busyId={busyId} onToggle={onToggle} />
      </View>
    );
  };
  return (
    <View style={styles.card}>
      <Text style={opsStyles.title}>{t('store.associatedCategories')}</Text>
      <Text style={opsStyles.meta}>{savedIds.size ? t('store.categoriesStorenameSellsInItsProducts', { storeName }) : t('store.storenameIsnTMappedToAny', { storeName })}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('store.mapCategories')} onPress={onMap} style={[opsStyles.primaryBtn, styles.selfStart]}>
        <FolderIcon size={15} color={colors.white} />
        <Text style={opsStyles.primaryBtnText}>{t('store.mapCategories')}</Text>
      </Pressable>
      {mains.length ? (
        mains.map(main => (
          <View key={String(main.id)} style={styles.mainBlock}>
            {row(main)}
            {under(String(main.id)).map(sub => (
              <View key={String(sub.id)} style={styles.subBlock}>
                {row(sub, true)}
                <View style={styles.chips}>
                  {under(String(sub.id)).map(child => {
                    const m = mappingOf.get(String(child.id));
                    const approval = approvalOf(m);
                    const off = m?.status === 'inactive';
                    return (
                      <View
                        key={String(child.id)}
                        style={[styles.chip, approval === 'pending' ? styles.chipPending : approval === 'rejected' || off ? styles.chipRejected : styles.chipOk]}
                      >
                        <Text style={[styles.chipText, off && styles.off]}>{String(child.categoryTitle)}</Text>
                        <Text style={styles.chipCount}>{String(counts.get(String(child.id)) ?? 0)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ))
      ) : (
        <View style={styles.empty}>
          <FolderIcon size={28} color={colors.border} />
          <Text style={opsStyles.title}>{t('store.noCategoriesMapped')}</Text>
          <Text style={[opsStyles.meta, styles.center]}>{t('store.mapTheMainSubAndChild')}</Text>
        </View>
      )}
    </View>
  );
}

function CheckBox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} hitSlop={8} onPress={onPress} style={[styles.box, checked && styles.boxOn]}>
      {checked ? <CheckIcon size={12} color={colors.white} strokeWidth={3} /> : null}
    </Pressable>
  );
}

const STEP_TITLE_KEYS = ['store.selectMainCategories', 'store.selectSubCategories', 'store.selectChildCategories'] as const;
const STEP_HINT_KEYS = ['store.chooseMainCategoriesHint', 'store.chooseSubCategoriesHint', 'store.chooseChildCategoriesHint'] as const;

/** One level of the picker: tick a row, or open it to see what's under it. */
function Level({
  tree,
  trail,
  setTrail,
  selected,
  mappingOf,
  counts,
  busyId,
  onCheck,
  onToggle,
}: {
  tree: ReturnType<typeof buildTree>;
  trail: string[];
  setTrail: (t: string[]) => void;
  selected: Set<string>;
  mappingOf: Map<string, Rec>;
  counts: Counts;
  busyId: string | null;
  onCheck: (ids: string[], on: boolean) => void;
  onToggle: (m: Rec, active: boolean) => void;
}) {
  const { t } = useTranslation();
  const level = trail.length;
  const items = level ? tree.childrenOf.get(trail[level - 1]) ?? [] : tree.mains;
  const ids = items.map(c => String(c.id));
  const all = ids.length > 0 && ids.every(id => selected.has(id));
  return (
    <View style={styles.card}>
      <View style={opsStyles.row}>
        <View style={[styles.step, level === 2 && styles.stepChild]}>
          <Text style={styles.stepText}>{level + 1}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={opsStyles.title}>{t(STEP_TITLE_KEYS[level])}</Text>
          <Text style={opsStyles.meta}>{t(STEP_HINT_KEYS[level])}</Text>
        </View>
      </View>
      {level ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => setTrail(trail.slice(0, -1))} style={styles.trail}>
          <ArrowLeftIcon size={15} color={colors.textSecondary} />
          <Text style={styles.trailText} numberOfLines={1}>
            {trail.map(id => String(tree.byId.get(id)?.categoryTitle ?? '')).join(' › ')}
          </Text>
        </Pressable>
      ) : null}
      {level && ids.length ? (
        <Pressable accessibilityRole="button" onPress={() => onCheck(ids, !all)} style={opsStyles.row}>
          <CheckBox checked={all} label={t('common.selectAll')} onPress={() => onCheck(ids, !all)} />
          <Text style={opsStyles.meta}>{t('store.selectAll')}</Text>
        </Pressable>
      ) : null}
      {items.length ? (
        items.map(c => {
          const id = String(c.id);
          const checked = selected.has(id);
          const m = checked ? mappingOf.get(id) : undefined;
          const hasChildren = level < 2 && (tree.childrenOf.get(id)?.length ?? 0) > 0;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={hasChildren ? t('store.openCategorytitle', { categoryTitle: String(c.categoryTitle) }) : t('store.selectCategorytitle', { categoryTitle: String(c.categoryTitle) })}
              onPress={() => (hasChildren ? setTrail([...trail, id]) : onCheck([id], !checked))}
              style={[styles.pickRow, checked && styles.pickRowOn]}
            >
              <CheckBox checked={checked} label={t('store.selectCategorytitle', { categoryTitle: String(c.categoryTitle) })} onPress={() => onCheck([id], !checked)} />
              <CategoryIcon category={c} />
              <View style={styles.flex}>
                <Text style={[styles.subName, m?.status === 'inactive' && styles.off]} numberOfLines={1}>
                  {String(c.categoryTitle)}
                </Text>
                {m?.status === 'inactive' ? <Text style={styles.offText}>{t('store.inactiveInThisStore')}</Text> : null}
              </View>
              <ApprovalTag mapping={m} />
              <StatusSwitch mapping={m} busyId={busyId} onToggle={onToggle} />
              <Text style={styles.count}>{String(counts.get(id) ?? 0)}</Text>
              {hasChildren ? <ChevronRightIcon size={16} color={checked ? colors.secondary : colors.textMuted} /> : null}
            </Pressable>
          );
        })
      ) : (
        <Text style={[opsStyles.muted, styles.center]}>
          {level ? t(level === 1 ? 'store.categoryHasNoSubCategories' : 'store.categoryHasNoChildCategories', { category: String(tree.byId.get(trail[level - 1])?.categoryTitle ?? '') }) : t('store.noMainCategoriesInTheMaster')}
        </Text>
      )}
    </View>
  );
}

function SearchResults({
  tree,
  search,
  selected,
  mappingOf,
  counts,
  onCheck,
}: {
  tree: ReturnType<typeof buildTree>;
  search: string;
  selected: Set<string>;
  mappingOf: Map<string, Rec>;
  counts: Counts;
  onCheck: (ids: string[], on: boolean) => void;
}) {
  const { t } = useTranslation();
  const found = searchCategories(tree, search);
  return (
    <View style={styles.card}>
      {found.length ? (
        found.map(c => {
          const id = String(c.id);
          const checked = selected.has(id);
          return (
            <Pressable key={id} accessibilityRole="button" accessibilityLabel={t('store.selectCategorytitle', { categoryTitle: String(c.categoryTitle) })} onPress={() => onCheck([id], !checked)} style={[styles.pickRow, checked && styles.pickRowOn]}>
              <CheckBox checked={checked} label={t('store.selectCategorytitle', { categoryTitle: String(c.categoryTitle) })} onPress={() => onCheck([id], !checked)} />
              <View style={styles.flex}>
                <Text style={styles.subName} numberOfLines={1}>
                  {String(c.categoryTitle)}
                </Text>
                <Text style={opsStyles.meta} numberOfLines={1}>
                  {pathOf(tree, id)}
                </Text>
              </View>
              <ApprovalTag mapping={checked ? mappingOf.get(id) : undefined} />
              <Text style={styles.count}>{String(counts.get(id) ?? 0)}</Text>
            </Pressable>
          );
        })
      ) : (
        <Text style={[opsStyles.muted, styles.center]}>{t('store.noCategoriesMatchYourSearch')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grow: { flex: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
  selfStart: { alignSelf: 'flex-start' },
  wrap: { gap: 14 },
  loading: { paddingVertical: 30, textAlign: 'center', fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  notice: { gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  noticeText: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.warningDark },
  rejected: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#fecdd3', backgroundColor: colors.surface },
  rejectedName: { fontFamily: fonts.semibold, color: colors.error },
  card: { gap: 10 },
  picker: { gap: 12 },
  mainBlock: { gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  subBlock: { gap: 6, marginLeft: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border },
  mainName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  subName: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  off: { color: colors.textMuted, textDecorationLine: 'line-through' },
  offText: { fontFamily: fonts.medium, fontSize: 11, color: colors.error },
  count: { minWidth: 28, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden', textAlign: 'center', fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, backgroundColor: colors.background },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14, borderWidth: 1 },
  chipOk: { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
  chipPending: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  chipRejected: { borderColor: '#fecdd3', backgroundColor: '#fff1f2' },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  chipCount: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textSecondary },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  tagPending: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  tagRejected: { borderColor: '#fecdd3', backgroundColor: '#fff1f2' },
  tagText: { fontFamily: fonts.semibold, fontSize: 10 },
  pendingText: { color: colors.warningDark },
  icon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  iconSmall: { width: 24, height: 24 },
  img: { width: 24, height: 24 },
  imgSmall: { width: 18, height: 18 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  step: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  stepChild: { backgroundColor: '#60a5fa' },
  stepText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  trailText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pickRowOn: { backgroundColor: '#eff6ff' },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  boxOn: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  saveBar: { gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  saveIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success },
});
