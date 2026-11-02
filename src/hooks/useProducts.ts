import { useCallback, useMemo } from 'react';
import { useFetch } from './useFetch';
import {
  brandService,
  categoryService,
  inventoryService,
  productImageService,
  productSkuService,
  productsService,
  type InventoryBalance,
  type Row,
} from '../services/products-service';

export interface StockTotals {
  uom: string;
  onHand: number;
  reserved: number;
  blocked: number;
  available: number;
  minimum: number;
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface ProductRow extends Row {
  productName: string;
  skuItemNumber?: string;
  categoryId?: string;
  brandId?: string | null;
  createdAt?: string;
  skuCount: number;
  /** The cheapest SKU's price, and its MRP. */
  price: number | null;
  mrp: number | null;
  stockTotals: StockTotals[];
  totalAvailable: number;
  stockStatus: StockStatus;
  coverUrl?: string;
  variantSubtitle?: string;
}

function groupBy<T extends Record<string, unknown>>(rows: T[] | undefined, key: string) {
  const map = new Map<unknown, T[]>();
  (rows ?? []).forEach(row => map.set(row[key], [...(map.get(row[key]) ?? []), row]));
  return map;
}

/**
 * The Seller Panel's product list data: products joined with their SKUs
 * (price), stock balances (per base unit, across warehouses) and cover photos.
 */
export function useProducts(enabled: boolean) {
  const products = useFetch(() => (enabled ? productsService.list() : Promise.resolve([])), [enabled]);
  const categories = useFetch(() => (enabled ? categoryService.list() : Promise.resolve([])), [enabled]);
  const brands = useFetch(() => (enabled ? brandService.list() : Promise.resolve([])), [enabled]);
  const skus = useFetch(() => (enabled ? productSkuService.list() : Promise.resolve([])), [enabled]);
  const inventory = useFetch(() => (enabled ? inventoryService.list() : Promise.resolve([])), [enabled]);
  const uoms = useFetch(() => (enabled ? inventoryService.uoms() : Promise.resolve([])), [enabled]);
  const images = useFetch(() => (enabled ? productImageService.list() : Promise.resolve([])), [enabled]);

  const rows = useMemo<ProductRow[]>(() => {
    const skusByProduct = groupBy(skus.data, 'productId');
    const imagesByProduct = groupBy(images.data, 'productId');
    const inventoryByProduct = new Map<string, InventoryBalance[]>();
    (inventory.data ?? []).forEach(b => inventoryByProduct.set(b.productId, [...(inventoryByProduct.get(b.productId) ?? []), b]));

    return (products.data ?? []).map(product => {
      const productSkus = skusByProduct.get(product.id) ?? [];
      const prices = productSkus.map(s => Number(s.businessPrice)).filter(n => !Number.isNaN(n));
      const price = prices.length ? Math.min(...prices) : null;
      const cheapest = productSkus.find(s => Number(s.businessPrice) === price);
      const mrp = cheapest && !Number.isNaN(Number(cheapest.mrp)) && cheapest.mrp != null ? Number(cheapest.mrp) : null;

      // Summed per base unit (a product's SKUs normally share one), across warehouses.
      const stock = new Map<string, StockTotals>();
      (inventoryByProduct.get(product.id) ?? []).forEach(b => {
        const t = stock.get(b.baseUom) ?? { uom: b.baseUom, onHand: 0, reserved: 0, blocked: 0, available: 0, minimum: 0 };
        t.onHand += Number(b.onHand) || 0;
        t.reserved += Number(b.reserved) || 0;
        t.blocked += Number(b.blocked) || 0;
        t.available += Number(b.available) || 0;
        t.minimum += Number(b.minimum) || 0;
        stock.set(b.baseUom, t);
      });
      const stockTotals = [...stock.values()];
      const stockStatus: StockStatus =
        !stockTotals.length || stockTotals.every(t => t.available <= 0)
          ? 'OUT_OF_STOCK'
          : stockTotals.some(t => t.minimum > 0 && t.available <= t.minimum)
            ? 'LOW_STOCK'
            : 'IN_STOCK';

      const productImages = imagesByProduct.get(product.id) ?? [];
      const cover = productImages.find(i => i.isPrimary) ?? productImages[0];
      const combination = cheapest?.variantCombination as Record<string, string> | undefined;
      const variantSubtitle =
        combination && Object.keys(combination).length
          ? Object.values(combination).join(', ')
          : (product.productShortDescription as string | undefined);

      return {
        ...product,
        productName: String(product.productName ?? ''),
        skuCount: productSkus.length,
        price,
        mrp,
        stockTotals,
        totalAvailable: stockTotals.reduce((sum, t) => sum + t.available, 0),
        stockStatus,
        coverUrl: (cover?.file as { url?: string } | undefined)?.url,
        variantSubtitle,
      } as ProductRow;
    });
  }, [products.data, skus.data, inventory.data, images.data]);

  const reload = useCallback(
    async (asRefresh = false) => {
      await Promise.all([products.reload(asRefresh), skus.reload(), inventory.reload(), images.reload()]);
    },
    // The reloaders are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    rows,
    categories: categories.data ?? [],
    brands: brands.data ?? [],
    uoms: uoms.data ?? [],
    loading: products.loading,
    error: products.error,
    loaded: products.data !== undefined,
    refreshing: products.refreshing,
    reload,
  };
}
