// Ported from the Seller Panel's src/services/product-builder-service.ts.
import { api } from '../lib/api';
import type { MeasurementType, VariantType } from '../lib/variant-types';
import type { SpecificationScope } from '../lib/specification-types';

// Category-driven product creation (eshop-backend src/modules/product-creation).
// Shared as-is by the seller and admin panels.

export interface CategoryRef {
  id: string;
  title: string;
  type: string;
}

export interface ConfiguredSpecification {
  id: string;
  title: string;
  slug: string;
  // TEXT, NUMBER, SELECT, MULTI_SELECT, BOOLEAN, TEXTAREA, DATE, DECIMAL,
  // MEASUREMENT or RANGE.
  dataType: string;
  multiselect: boolean;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  description: string | null;
  // Section it's shown under ("General" when the specification has none).
  group: string;
  // PRODUCT: once per product; VARIANT: per SKU; BOTH: a product value SKUs may override.
  scope: SpecificationScope;
  // The variant attribute that gives the value for products sold in it
  // (Storage): each SKU's option is used and the seller isn't asked.
  variantAttributeId: string | null;
  // MEASUREMENT / RANGE: the units the category allows (base unit first).
  measurementDimension: MeasurementType | null;
  units: string[];
  baseUnit: string | null;
  // NUMBER / DECIMAL / RANGE without a dimension: unit shown with the value.
  unitLabel: string | null;
  sortOrder: number;
  // Category the setting comes from; null when the category has no setup.
  source: CategoryRef | null;
  inherited: boolean;
  options: { id: string; title: string; slug: string; sequence: number }[];
}

export interface VariantOption {
  id: string;
  // Display label ("XL", "20 mm").
  value: string;
  // Measurement / number values: the number and (measurements) its unit.
  numericValue: number | null;
  unit: string | null;
  colorCode: string | null;
  imageUrl: string | null;
  sequence: number;
}

export interface ConfiguredVariantAttribute {
  id: string;
  title: string;
  slug: string;
  // SELECT (pick from options), MEASUREMENT (number + unit), NUMERIC or TEXT.
  type: VariantType;
  measurementType: MeasurementType | null;
  // List attributes: the option set the category uses (its values are the options).
  optionSet: { id: string; code: string; title: string } | null;
  // Measurements: units the category allows, those where sellers may also
  // type new values (not limited to selected options), and the base unit.
  units: string[];
  openUnits: string[];
  baseUnit: string | null;
  // List / number / text: whether values beyond the offered options may be added.
  acceptsNewValues: boolean;
  required: boolean;
  sortOrder: number;
  source: CategoryRef | null;
  inherited: boolean;
  options: VariantOption[];
}

export interface PickableCategory {
  id: string;
  categoryTitle: string;
  categoryType: 'MAIN_CATEGORY' | 'SUB_CATEGORY' | 'CHILD_CATEGORY' | string;
  parentCategoryId: string | null;
  slugCode: string;
}

export interface CategoriesForProducts {
  // True for sellers: only categories mapped to their store(s).
  restricted: boolean;
  // Child categories a product may be put in.
  selectableIds: string[];
  // Those plus the sub / main categories above them (for the picker).
  categories: PickableCategory[];
}

export interface ProductConfiguration {
  category: CategoryRef & { path: CategoryRef[] };
  // False when the category (and its parents) has no setup: the product then
  // gets no specifications / attributes until some are mapped.
  configured: { specifications: boolean; variantAttributes: boolean };
  specifications: ConfiguredSpecification[];
  variantAttributes: ConfiguredVariantAttribute[];
}

export interface VariantStockRow {
  warehouseId: string;
  warehouseTitle: string;
  availableStock: number;
  reservedStock: number;
  minimumStock: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  barcode: string | null;
  // e.g. "L / Red", or "Default" for a product without variants.
  label: string;
  combinationKey: string;
  options: {
    attributeId: string;
    attributeTitle: string;
    optionId: string;
    value: string;
  }[];
  mrp: number | null;
  sellingPrice: number;
  costPrice: number | null;
  // 1 = on sale, 0 = hidden.
  status: number;
  // The single product photo picked as the SKU's image (before galleries).
  imageFileId: string | null;
  imageUrl: string | null;
  // The SKU's own photo gallery: how many, and its primary.
  imageCount: number;
  primaryImageUrl: string | null;
  stock: number;
  inventory: VariantStockRow[];
}

export interface VariantImage {
  id: string;
  fileId: string;
  url: string | null;
  altText: string | null;
  isPrimary: boolean;
  sequence: number;
}

// A SKU's own photos at a glance.
export interface VariantPhotoSummary {
  variantId: string;
  label: string;
  imageCount: number;
  primaryImageUrl: string | null;
}

export interface VariantGallery {
  variantId: string;
  // Primary first, then in display order.
  images: VariantImage[];
  // What the store shows while the SKU has no photos of its own.
  fallback: 'SKU_IMAGE' | 'PRODUCT' | 'NONE';
  // Every other SKU of the same colour, with its own photos.
  sameLook: VariantPhotoSummary[];
  // Same-coloured SKUs whose photos can be reused.
  reusableFrom: { variantId: string; label: string; imageCount: number }[];
}

// Where a SKU's store gallery comes from: its own photos, its single picked
// image (plus the product's), the product's photos, or nothing.
export type GallerySource = 'VARIANT' | 'SKU_IMAGE' | 'PRODUCT' | 'NONE';

// Every SKU's photos as the store shows them (product page preview).
export interface ProductPhotoOverview {
  productImages: string[];
  // Colour first; the values the SKUs use.
  attributes: {
    id: string;
    title: string;
    appearance: boolean;
    values: { optionId: string; value: string; colorCode: string | null }[];
  }[];
  variants: (VariantPhotoSummary & {
    sku: string;
    status: number;
    options: {
      attributeId: string;
      attributeTitle: string;
      optionId: string;
      value: string;
      colorCode: string | null;
    }[];
    images: string[];
    source: GallerySource;
  })[];
}

export interface GenerateResult {
  combinations: number;
  created: number;
  skipped: number;
  variants: ProductVariant[];
}

// A value typed in for a measurement / number / text attribute; created when new.
export interface TypedVariantValue {
  value?: string;
  numericValue?: number;
  unit?: string;
}

export interface VariantUpdate {
  sku?: string;
  barcode?: string | null;
  mrp?: string | null;
  sellingPrice?: string;
  costPrice?: string | null;
  imageFileId?: string | null;
  status?: 0 | 1;
}

export interface SpecificationValue {
  specificationId: string;
  title: string;
  dataType: string;
  // Display text ("500 g", "-20 to 80 °C").
  value: string | null;
  // MEASUREMENT / RANGE / numbers.
  numericValue: number | null;
  maxValue: number | null;
  unit: string | null;
  options: { id: string; title: string }[];
}

export interface SpecificationInput {
  specificationId: string;
  optionIds?: string[];
  value?: string;
  numericValue?: number;
  maxValue?: number;
  unit?: string;
}

// A SKU's own values (it falls back to the product's for the rest).
export interface VariantSpecificationValues {
  variantId: string;
  sku: string;
  values: (SpecificationValue & { group: string })[];
}

// What a SKU shows: its variant option, else its own value, else the product's.
export interface ResolvedSpecification {
  specificationId: string;
  title: string;
  dataType: string;
  group: string;
  value: string;
  options: { id: string; title: string }[];
  numericValue: number | null;
  maxValue: number | null;
  unit: string | null;
  source: 'ATTRIBUTE' | 'VARIANT' | 'PRODUCT';
}

type Id = string | number;

export interface BrandsForProducts {
  selectableIds: string[];
  brands: { id: string; title: string; codeSlug: string; status: number }[];
}

export const productBuilderService = {
  // Sellers get the categories mapped to their stores; `storeIds` narrows it
  // to the stores the product is sold in (null = all their stores).
  // Brands a product can use: approved for its stores in its category (Brand
  // Approval). `clientId` is the product's client, for platform admins.
  brandsForProducts(params: {
    categoryId: string;
    storeIds: string[] | null;
    clientId?: string;
    includeBrandId?: string;
  }): Promise<BrandsForProducts> {
    return api
      .get('/brands/for-products', {
        params: {
          categoryId: params.categoryId,
          ...(params.storeIds ? { storeIds: params.storeIds.join(',') } : {}),
          ...(params.clientId ? { clientId: params.clientId } : {}),
          ...(params.includeBrandId
            ? { includeBrandId: params.includeBrandId }
            : {}),
        },
      })
      .then(res => res.data);
  },

  categoriesForProducts(
    storeIds: string[] | null,
    includeCategoryId?: string,
  ): Promise<CategoriesForProducts> {
    return api
      .get('/categories/for-products', {
        params: {
          ...(storeIds ? { storeIds: storeIds.join(',') } : {}),
          ...(includeCategoryId ? { includeCategoryId } : {}),
        },
      })
      .then(res => res.data);
  },

  configuration(categoryId: Id): Promise<ProductConfiguration> {
    return api
      .get(`/categories/${categoryId}/product-configuration`)
      .then(res => res.data);
  },

  variants(productId: Id): Promise<ProductVariant[]> {
    return api.get(`/products/${productId}/variants`).then(res => res.data);
  },
  generate(
    productId: Id,
    attributes: {
      variantAttributeId: string;
      optionIds: string[];
      values?: TypedVariantValue[];
    }[],
    defaults?: { mrp?: string; sellingPrice?: string; costPrice?: string },
  ): Promise<GenerateResult> {
    return api
      .post(`/products/${productId}/variants/generate`, {
        attributes,
        defaults,
      })
      .then(res => res.data);
  },
  updateVariant(
    productId: Id,
    variantId: string,
    changes: VariantUpdate,
  ): Promise<ProductVariant> {
    return api
      .put(`/products/${productId}/variants/${variantId}`, changes)
      .then(res => res.data);
  },
  updateInventory(
    productId: Id,
    variantId: Id,
    stock: {
      warehouseId: string;
      availableStock: number;
      minimumStock?: number;
      maximumStock?: number | null;
      reorderQuantity?: number;
    },
  ): Promise<ProductVariant> {
    return api
      .put(`/products/${productId}/variants/${variantId}/inventory`, stock)
      .then(res => res.data);
  },
  removeVariant(
    productId: Id,
    variantId: string,
  ): Promise<{ message: string }> {
    return api
      .delete(`/products/${productId}/variants/${variantId}`)
      .then(res => res.data);
  },

  // A SKU's own photos. Files are uploaded first (fileService.upload).
  variantImages(productId: Id, variantId: string): Promise<VariantGallery> {
    return api
      .get(`/products/${productId}/variants/${variantId}/images`)
      .then(res => res.data);
  },
  addVariantImages(
    productId: Id,
    variantId: string,
    fileIds: string[],
  ): Promise<VariantGallery> {
    return api
      .post(`/products/${productId}/variants/${variantId}/images`, { fileIds })
      .then(res => res.data);
  },
  // Every image id in the new order; optionally a new primary.
  arrangeVariantImages(
    productId: Id,
    variantId: string,
    imageIds: string[],
    primaryImageId?: string,
  ): Promise<VariantGallery> {
    return api
      .put(`/products/${productId}/variants/${variantId}/images`, {
        imageIds,
        primaryImageId,
      })
      .then(res => res.data);
  },
  replaceVariantImage(
    productId: Id,
    variantId: string,
    imageId: string,
    fileId: string,
  ): Promise<VariantGallery> {
    return api
      .patch(`/products/${productId}/variants/${variantId}/images/${imageId}`, {
        fileId,
      })
      .then(res => res.data);
  },
  // Unlinks the photo; the uploaded file is kept.
  removeVariantImage(
    productId: Id,
    variantId: string,
    imageId: string,
  ): Promise<VariantGallery> {
    return api
      .delete(`/products/${productId}/variants/${variantId}/images/${imageId}`)
      .then(res => res.data);
  },
  // Gives every same-coloured SKU this SKU's photos (no re-upload).
  applyVariantImagesToSameLook(
    productId: Id,
    variantId: string,
  ): Promise<{ updated: string[]; overview: ProductPhotoOverview }> {
    return api
      .post(
        `/products/${productId}/variants/${variantId}/images/apply-to-same-look`,
      )
      .then(res => res.data);
  },
  photoOverview(productId: Id): Promise<ProductPhotoOverview> {
    return api
      .get(`/products/${productId}/variant-images`)
      .then(res => res.data);
  },
  // Reuses a same-coloured SKU's photos (no re-upload).
  copyVariantImages(
    productId: Id,
    variantId: string,
    sourceVariantId: string,
  ): Promise<VariantGallery> {
    return api
      .post(`/products/${productId}/variants/${variantId}/images/copy`, {
        sourceVariantId,
      })
      .then(res => res.data);
  },

  specifications(productId: Id): Promise<SpecificationValue[]> {
    return api
      .get(`/products/${productId}/specifications`)
      .then(res => res.data);
  },
  // `variants`: the listed SKUs' values (SKUs left out keep theirs). When
  // given, required specifications are checked for every SKU.
  saveSpecifications(
    productId: Id,
    values: SpecificationInput[],
    variants?: { variantId: string; values: SpecificationInput[] }[],
  ): Promise<SpecificationValue[]> {
    return api
      .post(`/products/${productId}/specifications`, {
        values,
        ...(variants ? { variants } : {}),
      })
      .then(res => res.data);
  },
  variantSpecifications(productId: Id): Promise<VariantSpecificationValues[]> {
    return api
      .get(`/products/${productId}/variant-specifications`)
      .then(res => res.data);
  },
  resolvedSpecifications(
    productId: Id,
    variantId: string,
  ): Promise<ResolvedSpecification[]> {
    return api
      .get(`/products/${productId}/variants/${variantId}/specifications`)
      .then(res => res.data);
  },
  removeSpecification(
    productId: Id,
    specificationId: string,
  ): Promise<SpecificationValue[]> {
    return api
      .delete(`/products/${productId}/specifications/${specificationId}`)
      .then(res => res.data);
  },

  // Platform admins only: adds a value (e.g. a new colour) to a list
  // attribute, in the category's option set; returns the existing one if
  // it's already there.
  addVariantValue(
    variantId: string,
    value: string,
    optionSetId?: string | null,
  ): Promise<{ id: string; variantId: string; variantData: string }> {
    return api
      .post('/products-master/variant-values', {
        variantId,
        value,
        ...(optionSetId ? { optionSetId } : {}),
      })
      .then(res => res.data);
  },
};
