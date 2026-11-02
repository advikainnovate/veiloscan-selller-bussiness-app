import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert as NativeAlert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../../theme';
import { useToast } from '../../../context/ToastContext';
import { extractErrorMessage } from '../../../lib/api';
import { pickImages } from '../../../lib/pick-image';
import { productBuilderService, type ProductVariant, type VariantGallery, type VariantImage } from '../../../services/product-builder-service';
import { fileService } from '../../../services/products-service';
import { Sheet } from '../../../components/ui/Sheet';
import { Button } from '../../../components/ui/Button';
import { CloseIcon, StarIcon } from '../../../components/icons';

const FALLBACK_TEXT: Record<VariantGallery['fallback'], string> = {
  SKU_IMAGE: 'No photos of its own yet — the store shows the image picked for this SKU, then the product’s photos.',
  PRODUCT: 'No photos of its own yet — the store shows the product’s photos.',
  NONE: 'No photos yet — the store shows a placeholder.',
};

/**
 * One SKU's own photo gallery (the Seller Panel's variant images dialog): add,
 * reorder, make one the main photo, remove, reuse a same-colour SKU's photos,
 * or give these photos to every SKU of the same colour.
 */
export function VariantPhotosSheet({
  productId,
  variant,
  onClose,
  onChange,
}: {
  productId: string;
  variant: ProductVariant;
  onClose: () => void;
  /** New photo count and main photo, for the SKU list. */
  onChange: (count: number, primaryUrl: string | null) => void;
}) {
  const toast = useToast();
  const [gallery, setGallery] = useState<VariantGallery | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productBuilderService.variantImages(productId, variant.id).then(setGallery, err => setError(extractErrorMessage(err)));
  }, [productId, variant.id]);

  async function run(key: string, action: () => Promise<VariantGallery>, done?: string) {
    setBusy(key);
    setError(null);
    try {
      const next = await action();
      setGallery(next);
      onChange(next.images.length, next.images[0]?.url ?? null);
      if (done) toast(done);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    const files = await pickImages().catch(err => {
      setError(extractErrorMessage(err));
      return [];
    });
    if (!files.length) return;
    await run('upload', async () => {
      const uploaded = [];
      for (const file of files) uploaded.push(await fileService.upload(file, 'products'));
      return productBuilderService.addVariantImages(productId, variant.id, uploaded.map(u => u.id));
    });
  }

  const images = gallery?.images ?? [];
  const ids = images.map(i => i.id);

  function move(image: VariantImage, delta: number) {
    const from = ids.indexOf(image.id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    [next[from], next[to]] = [next[to], next[from]];
    run(image.id, () => productBuilderService.arrangeVariantImages(productId, variant.id, next, next[0]));
  }

  function makePrimary(image: VariantImage) {
    const next = [image.id, ...ids.filter(id => id !== image.id)];
    run(image.id, () => productBuilderService.arrangeVariantImages(productId, variant.id, next, image.id));
  }

  function remove(image: VariantImage) {
    NativeAlert.alert('Remove this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => run(image.id, () => productBuilderService.removeVariantImage(productId, variant.id, image.id)) },
    ]);
  }

  function applyToSameLook() {
    const sameLook = gallery?.sameLook ?? [];
    NativeAlert.alert(
      `Give ${sameLook.length === 1 ? sameLook[0].label : `all ${sameLook.length} variants of this colour`} these photos?`,
      "Photos they already have aren't added twice.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            setBusy('apply');
            try {
              await productBuilderService.applyVariantImagesToSameLook(productId, variant.id);
              setGallery(await productBuilderService.variantImages(productId, variant.id));
              toast('Photos applied to the same colour');
            } catch (err) {
              setError(extractErrorMessage(err));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Sheet visible title={`${variant.label} photos`} subtitle={variant.sku} onClose={onClose} footer={<Button title="Add photos" loading={busy === 'upload'} loadingTitle="Uploading…" onPress={add} />}>
      {!gallery && !error ? <ActivityIndicator color={colors.secondary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {gallery && !images.length ? <Text style={styles.muted}>{FALLBACK_TEXT[gallery.fallback]}</Text> : null}
      <View style={styles.grid}>
        {images.map((image, i) => (
          <View key={image.id} style={styles.photo}>
            {image.url ? <Image source={{ uri: image.url }} style={styles.img} /> : <View style={styles.img} />}
            {i === 0 ? (
              <View style={styles.main}>
                <Text style={styles.mainText}>Main</Text>
              </View>
            ) : (
              <Pressable accessibilityLabel="Make main photo" onPress={() => makePrimary(image)} style={[styles.btn, styles.topLeft]}>
                <StarIcon size={13} color={colors.white} />
              </Pressable>
            )}
            <Pressable accessibilityLabel="Remove photo" onPress={() => remove(image)} style={[styles.btn, styles.topRight]}>
              <CloseIcon size={13} color={colors.white} />
            </Pressable>
            <View style={styles.moves}>
              <Pressable accessibilityLabel="Move earlier" disabled={i === 0} onPress={() => move(image, -1)} style={[styles.move, i === 0 && styles.hidden]}>
                <Text style={styles.moveText}>‹</Text>
              </Pressable>
              <Pressable accessibilityLabel="Move later" disabled={i === images.length - 1} onPress={() => move(image, 1)} style={[styles.move, i === images.length - 1 && styles.hidden]}>
                <Text style={styles.moveText}>›</Text>
              </Pressable>
            </View>
            {busy === image.id ? (
              <View style={styles.busy}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
      {gallery?.sameLook.length && images.length ? (
        <Button title={busy === 'apply' ? 'Applying…' : `Use these for ${gallery.sameLook.length === 1 ? gallery.sameLook[0].label : `all ${gallery.sameLook.length} same-colour variants`}`} variant="ghost" disabled={!!busy} onPress={applyToSameLook} />
      ) : null}
      {gallery?.reusableFrom.length ? (
        <View style={styles.reuse}>
          <Text style={styles.reuseTitle}>Reuse photos from the same colour</Text>
          {gallery.reusableFrom.map(source => (
            <Pressable
              key={source.variantId}
              disabled={!!busy}
              onPress={() => run(`copy-${source.variantId}`, () => productBuilderService.copyVariantImages(productId, variant.id, source.variantId), `Added ${source.label}'s photos`)}
              style={styles.reuseRow}
            >
              <Text style={styles.reuseText}>{source.label}</Text>
              <Text style={styles.link}>{busy === `copy-${source.variantId}` ? 'Adding…' : `Add ${source.imageCount} photo${source.imageCount === 1 ? '' : 's'}`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: '30.5%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.background },
  img: { width: '100%', height: '100%', backgroundColor: colors.background },
  main: { position: 'absolute', left: 6, top: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.secondary },
  mainText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  btn: { position: 'absolute', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,19,41,0.55)' },
  topLeft: { top: 6, left: 6 },
  topRight: { top: 6, right: 6 },
  moves: { position: 'absolute', bottom: 4, left: 4, right: 4, flexDirection: 'row', justifyContent: 'space-between' },
  move: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,19,41,0.55)' },
  moveText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 20, color: colors.white },
  hidden: { opacity: 0 },
  busy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,19,41,0.4)' },
  reuse: { gap: 6 },
  reuseTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  reuseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reuseText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.secondary },
});
