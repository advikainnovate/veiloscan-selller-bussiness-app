// Ported from the Seller Panel's components/dashboard/products/product-wizard-types.ts — keep the two in step.
export interface ProductFormValues {
  productName: string;
  productSlug: string;
  slugTouched: boolean;
  brandId: string;
  categoryId: string;
  manufacturer: string;
  productIdType: string;
  skuItemNumber: string;
  productShortDescription: string;
  productLongDescription: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  // Perishable product: expiry batches must be recorded (Inventory step).
  requiresExpiry: boolean;
  status: number;
  // Up to 5 highlights, shown on the store under "About this product".
  keyFeatures: string[];
  // Extra words store search matches besides the name (comma-separated), and
  // up to 5 search phrases.
  searchKeywords: string;
  searchTerms: string[];
  // Shown on the store's product page.
  termsAndConditions: string;
  legalDisclaimer: string;
}

export const KEY_FEATURE_COUNT = 5;
export const SEARCH_TERM_COUNT = 5;

const fill = (values: string[], count: number) =>
  Array.from({ length: count }, (_, i) => values[i] ?? '');

/** The highlights / search / policy fields of a saved product, for the form. */
export function extraDetailsFrom(
  record: Record<string, unknown>,
): Pick<
  ProductFormValues,
  | 'keyFeatures'
  | 'searchKeywords'
  | 'searchTerms'
  | 'termsAndConditions'
  | 'legalDisclaimer'
> {
  const text = (key: string) =>
    typeof record[key] === 'string' ? (record[key] as string) : '';
  return {
    keyFeatures: fill(
      Array.from({ length: KEY_FEATURE_COUNT }, (_, i) =>
        text(`productKeyFeature${i + 1}`),
      ),
      KEY_FEATURE_COUNT,
    ),
    searchKeywords: text('searchKeywords'),
    searchTerms: fill(
      Array.from({ length: SEARCH_TERM_COUNT }, (_, i) =>
        text(`productSearchTerm${i + 1}`),
      ),
      SEARCH_TERM_COUNT,
    ),
    termsAndConditions: text('productTermsAndConditions'),
    legalDisclaimer: text('legalDisclaimerDescription'),
  };
}

/**
 * The same fields for the products API. Filled-in highlights / terms are
 * packed to the front (no gaps); empty ones are sent as null so clearing a
 * field on an existing product removes it.
 */
export function extraDetailsPayload(
  product: ProductFormValues,
): Record<string, string | null> {
  const packed = (values: string[], count: number) =>
    fill(values.map(v => v.trim()).filter(Boolean), count);
  const features = packed(product.keyFeatures, KEY_FEATURE_COUNT);
  const terms = packed(product.searchTerms, SEARCH_TERM_COUNT);
  return {
    ...Object.fromEntries(
      features.map((v, i) => [`productKeyFeature${i + 1}`, v || null]),
    ),
    ...Object.fromEntries(
      terms.map((v, i) => [`productSearchTerm${i + 1}`, v || null]),
    ),
    searchKeywords: product.searchKeywords.trim() || null,
    productTermsAndConditions: product.termsAndConditions.trim() || null,
    legalDisclaimerDescription: product.legalDisclaimer.trim() || null,
  };
}

export interface MediaItem {
  id?: string | number;
  fileId: string | number;
  url?: string;
  altText: string;
  isPrimary: boolean;
}

export interface TagItem {
  id?: string | number;
  tagTitle: string;
  tagSlug: string;
}

export interface VariantTypeRow {
  variantId: string;
  valueIds: (string | number)[];
}

export interface ComboEntry {
  variantDataId: string | number;
  variantTitle: string;
  variantDataValue: string;
}

export interface BusinessVariantRow {
  id?: string | number;
  skuItemNumber: string;
  barcode: string;
  businessPrice: string | number;
  mrp: string | number;
  costPrice: string | number;
  combo: Record<string, ComboEntry>;
}

export interface InventoryRowValue {
  availableStock: string;
  minimumStock: string;
  maximumStock: string;
  reorderQuantity: string;
  savedId?: string | number;
}

export interface SpecificationRow {
  id?: string | number;
  specificationId: string;
  specsDataId: string;
  specificationValue: string;
}

export interface MeasuresValues {
  id?: string | number;
  packageLength: string;
  packageWidth: string;
  packageHeight: string;
  packageWeight: string;
  packageLengthMeasuringUnit: string;
  packageWeightMeasuringUnit: string;
  packageQuantity: string | number;
  productLength: string;
  productWidth: string;
  productHeight: string;
  productWeight: string;
  productLengthMeasuringUnit: string;
  productWeightMeasuringUnit: string;
  itemCondition: string;
  itemConditionNote: string;
}

export const EMPTY_PRODUCT: ProductFormValues = {
  productName: '',
  productSlug: '',
  slugTouched: false,
  brandId: '',
  categoryId: '',
  manufacturer: '',
  productIdType: 'SKU',
  skuItemNumber: '',
  productShortDescription: '',
  productLongDescription: '',
  isFeatured: false,
  isNewArrival: false,
  isBestSeller: false,
  requiresExpiry: false,
  status: 0,
  keyFeatures: fill([], KEY_FEATURE_COUNT),
  searchKeywords: '',
  searchTerms: fill([], SEARCH_TERM_COUNT),
  termsAndConditions: '',
  legalDisclaimer: '',
};

export const EMPTY_MEASURES: MeasuresValues = {
  packageLength: '',
  packageWidth: '',
  packageHeight: '',
  packageWeight: '',
  packageLengthMeasuringUnit: 'CM',
  packageWeightMeasuringUnit: 'KG',
  packageQuantity: 1,
  productLength: '',
  productWidth: '',
  productHeight: '',
  productWeight: '',
  productLengthMeasuringUnit: 'CM',
  productWeightMeasuringUnit: 'KG',
  itemCondition: 'NEW',
  itemConditionNote: '',
};
