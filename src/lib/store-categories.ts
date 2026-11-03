// A store's categories, as the Seller Panel's StoreCategoriesManager
// (components/dashboard/stores/store-categories-page): picked from the
// category master's main → sub → child tree and saved as one selection.

export type Rec = Record<string, unknown>;
export type CategoryType = 'MAIN_CATEGORY' | 'SUB_CATEGORY' | 'CHILD_CATEGORY';

/** Sellers' new categories wait for the platform before products can be listed in them. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export const approvalOf = (mapping: Rec | undefined): ApprovalStatus => (mapping?.approvalStatus as ApprovalStatus | undefined) ?? 'approved';

const byOrder = (a: Rec, b: Rec) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0) || String(a.categoryTitle).localeCompare(String(b.categoryTitle));

export interface CategoryTree {
  byId: Map<string, Rec>;
  childrenOf: Map<string, Rec[]>;
  mains: Rec[];
}

export function buildTree(categories: Rec[]): CategoryTree {
  const live = categories.filter(c => !c.isDeleted);
  const childrenOf = new Map<string, Rec[]>();
  for (const c of live) {
    const parent = c.parentCategoryId as string | null;
    if (parent) childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), c]);
  }
  childrenOf.forEach(list => list.sort(byOrder));
  return {
    byId: new Map(live.map(c => [String(c.id), c])),
    childrenOf,
    mains: live.filter(c => c.categoryType === 'MAIN_CATEGORY').sort(byOrder),
  };
}

export function descendants(tree: CategoryTree, id: string): string[] {
  return (tree.childrenOf.get(id) ?? []).flatMap(c => [String(c.id), ...descendants(tree, String(c.id))]);
}

export function ancestors(tree: CategoryTree, id: string): string[] {
  const parent = tree.byId.get(id)?.parentCategoryId as string | null | undefined;
  return parent ? [parent, ...ancestors(tree, parent)] : [];
}

/** Ticking a category ticks its parents; unticking it unticks everything under it. */
export function setChecked(tree: CategoryTree, selected: Set<string>, ids: string[], checked: boolean): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    if (checked) [id, ...ancestors(tree, id)].forEach(x => next.add(x));
    else [id, ...descendants(tree, id)].forEach(x => next.delete(x));
  }
  return next;
}

/** "Grocery › Rice › Basmati". */
export const pathOf = (tree: CategoryTree, id: string) =>
  [...ancestors(tree, id).reverse(), id].map(x => String(tree.byId.get(x)?.categoryTitle ?? '')).join(' › ');

/** Every category whose title, slug, SEO text or tags hold all the words of the search, in tree order. */
export function searchCategories(tree: CategoryTree, search: string): Rec[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const textOf = (c: Rec) =>
    [c.categoryTitle, c.slugCode, c.metaTitle, c.metaDescription, ...(Array.isArray(c.tags) ? (c.tags as string[]) : [])].filter(Boolean).join(' ').toLowerCase();
  const out: Rec[] = [];
  const walk = (list: Rec[]) =>
    list.forEach(c => {
      const text = textOf(c);
      if (words.every(w => text.includes(w))) out.push(c);
      walk(tree.childrenOf.get(String(c.id)) ?? []);
    });
  walk(tree.mains);
  return out;
}

/** Products per category, counting each in the categories above it too. */
export function productCounts(tree: CategoryTree, products: Rec[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    let id = p.categoryId as string | null | undefined;
    for (let depth = 0; id && depth < 5; depth++) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
      id = tree.byId.get(id)?.parentCategoryId as string | null | undefined;
    }
  }
  return counts;
}

export function selectionCounts(tree: CategoryTree, selected: Set<string>) {
  const count = (type: CategoryType) => [...selected].filter(id => tree.byId.get(id)?.categoryType === type).length;
  return { main: count('MAIN_CATEGORY'), sub: count('SUB_CATEGORY'), child: count('CHILD_CATEGORY') };
}
