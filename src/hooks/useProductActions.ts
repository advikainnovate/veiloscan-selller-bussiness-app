import { useState } from 'react';
import { Alert as NativeAlert } from 'react-native';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../lib/api';
import { productsService } from '../services/products-service';
import { navigationRef } from '../navigation/navigationRef';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

type ProductLike = { id: string; productName?: unknown; status?: unknown };

const ask = (title: string, message: string, confirm: string, destructive = false) =>
  new Promise<boolean>(resolve =>
    NativeAlert.alert(title, message, [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirm, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );

/** The Seller Panel's product row actions, with its confirmations. `onDone` reloads the caller. */
export function useProductActions(onDone: () => void) {
  const { t } = useTranslation();
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
        t('products.duplicateThisProduct'),
        t('products.aNewDraftOfProductnameIs', { productName: product.productName }),
        t('common.duplicate'),
      );
      if (!ok) return;
      setBusyId(product.id);
      try {
        const copy = await productsService.copy(product.id);
        toast(t('products.productDuplicatedReviewTheDraftAnd'));
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
      if (!(await ask(active ? t('products.deactivateNamed', { name: product.productName }) : t('products.activateNamed', { name: product.productName }), active ? t('products.itWillBeHiddenFromThe') : t('products.itWillBeLiveOnThe'), active ? t('common.deactivate') : t('common.activate'), active))) return;
      await run(product, () => productsService.update(product.id, { status: active ? 0 : 1 }), active ? t('products.productDeactivated') : t('products.productActivated'));
    },
    async remove(product: ProductLike) {
      if (!(await ask(t('products.deleteProduct'), t('products.productnameWillBeRemovedFromThis', { productName: product.productName }), t('common.delete'), true))) return;
      await run(product, () => productsService.remove(product.id), t('products.productDeleted'));
    },
    async submit(product: ProductLike) {
      await run(product, () => productsService.submitForApproval(product.id), t('products.productSubmittedForApproval'));
    },
  };
}
