import { useState } from 'react';
import { Alert as NativeAlert } from 'react-native';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../lib/api';
import { productsService } from '../services/products-service';
import { navigationRef } from '../navigation/navigationRef';

type ProductLike = { id: string; productName?: unknown; status?: unknown };

const ask = (title: string, message: string, confirm: string, destructive = false) =>
  new Promise<boolean>(resolve =>
    NativeAlert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirm, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );

/** The Seller Panel's product row actions, with its confirmations. `onDone` reloads the caller. */
export function useProductActions(onDone: () => void) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(product: ProductLike, action: () => Promise<unknown>, message: string) {
    setBusyId(product.id);
    try {
      await action();
      toast(message);
      onDone();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return {
    busyId,
    /** A new draft with the same details, SKUs, photos and specifications. */
    async duplicate(product: ProductLike) {
      const ok = await ask(
        'Duplicate this product?',
        `A new draft of “${product.productName}” is created with the same details, SKUs, photos and specifications. SKU numbers get a -COPY suffix; stock and barcodes are not copied.`,
        'Duplicate',
      );
      if (!ok) return;
      setBusyId(product.id);
      try {
        const copy = await productsService.copy(product.id);
        toast('Product duplicated — review the draft and submit it for approval');
        onDone();
        if (navigationRef.isReady()) navigationRef.navigate('ProductDetail', { id: copy.id });
      } catch (err) {
        toast(extractErrorMessage(err), 'error');
      } finally {
        setBusyId(null);
      }
    },
    /** Hides or shows it on the storefront (approved products only). */
    async toggleStatus(product: ProductLike) {
      const active = Number(product.status) === 1;
      if (!(await ask(`${active ? 'Deactivate' : 'Activate'} “${product.productName}”?`, active ? 'It will be hidden from the storefront.' : 'It will be live on the storefront.', active ? 'Deactivate' : 'Activate', active))) return;
      await run(product, () => productsService.update(product.id, { status: active ? 0 : 1 }), `Product ${active ? 'deactivated' : 'activated'}`);
    },
    async remove(product: ProductLike) {
      if (!(await ask('Delete product?', `“${product.productName}” will be removed from this list. Deactivate it instead if you only want to take it off the store.`, 'Delete', true))) return;
      await run(product, () => productsService.remove(product.id), 'Product deleted');
    },
    async submit(product: ProductLike) {
      await run(product, () => productsService.submitForApproval(product.id), 'Product submitted for approval');
    },
  };
}
