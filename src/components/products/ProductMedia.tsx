import React, { useState } from 'react';
import { ActivityIndicator, Alert as NativeAlert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../../theme';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../lib/api';
import { pickImages } from '../../lib/pick-image';
import { fileService, productDocumentService, productImageService, type Row } from '../../services/products-service';
import type { ProductPhotoOverview } from '../../services/product-builder-service';
import { Card } from '../ui/Card';
import { CloseIcon, FileTextIcon, PlusIcon, StarIcon } from '../icons';

const fileUrl = (row: Row) => (row.file as { url?: string } | undefined)?.url;

/** The product's own photos: add (camera / library), make one the cover, remove. As the Seller Panel's Media tab. */
export function ProductPhotos({ productId, images, onChange }: { productId: string; images: Row[]; onChange: () => void }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  async function add() {
    try {
      const files = await pickImages();
      if (!files.length) return;
      setUploading(files.length);
      let first = images.length === 0;
      for (const file of files) {
        const uploaded = await fileService.upload(file, 'products');
        await productImageService.create({ productId, fileId: uploaded.id, isPrimary: first });
        first = false;
        setUploading(n => n - 1);
      }
      toast(files.length === 1 ? 'Photo added' : `${files.length} photos added`);
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setUploading(0);
      onChange();
    }
  }

  async function makeCover(image: Row) {
    setBusy(image.id);
    try {
      const current = images.find(i => i.isPrimary);
      if (current) await productImageService.update(current.id, { isPrimary: false });
      await productImageService.update(image.id, { isPrimary: true });
      toast('Cover photo updated');
      onChange();
    } catch (err) {
      toast(extractErrorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  function remove(image: Row) {
    NativeAlert.alert('Remove this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(image.id);
          try {
            await productImageService.remove(image.id);
            toast('Photo removed');
            onChange();
          } catch (err) {
            toast(extractErrorMessage(err), 'error');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <Card title={`Photos (${images.length})`}>
      <View style={styles.grid}>
        {images.map(image => (
          <View key={image.id} style={styles.photo}>
            {fileUrl(image) ? <Image source={{ uri: fileUrl(image) }} style={styles.photoImg} /> : <View style={styles.photoImg} />}
            {image.isPrimary ? (
              <View style={styles.cover}>
                <Text style={styles.coverText}>Cover</Text>
              </View>
            ) : (
              <Pressable accessibilityLabel="Make cover photo" hitSlop={6} onPress={() => makeCover(image)} style={[styles.photoBtn, styles.photoBtnLeft]}>
                <StarIcon size={14} color={colors.white} />
              </Pressable>
            )}
            <Pressable accessibilityLabel="Remove photo" hitSlop={6} onPress={() => remove(image)} style={[styles.photoBtn, styles.photoBtnRight]}>
              <CloseIcon size={14} color={colors.white} />
            </Pressable>
            {busy === image.id ? (
              <View style={styles.photoBusy}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
          </View>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Add photos" onPress={add} disabled={uploading > 0} style={[styles.photo, styles.addPhoto]}>
          {uploading ? <ActivityIndicator color={colors.secondary} /> : <PlusIcon size={22} color={colors.secondary} strokeWidth={2.2} />}
          <Text style={styles.addText}>{uploading ? `Uploading ${uploading}…` : 'Add'}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Each SKU's photos as the store shows them (managed per variant from the editor). */
export function VariantPhotoStrip({ overview }: { overview: ProductPhotoOverview | undefined }) {
  if (!overview?.variants.length) return null;
  return (
    <Card title="Variant photos">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantRow}>
        {overview.variants.map(v => {
          const url = v.primaryImageUrl ?? v.images[0];
          return (
            <View key={v.variantId} style={styles.variant}>
              {url ? <Image source={{ uri: url }} style={[styles.variantImg, v.source !== 'VARIANT' && styles.faded]} /> : <View style={styles.variantImg} />}
              <Text style={styles.variantLabel} numberOfLines={1}>
                {v.label}
              </Text>
              <Text style={styles.variantMeta}>
                {v.source === 'VARIANT' ? `${v.imageCount} photo${v.imageCount === 1 ? '' : 's'}` : v.source === 'NONE' ? 'No photos' : 'Shared photos'}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </Card>
  );
}

/** Manuals, certificates and warranty cards attached to the product. */
export function ProductDocuments({ documents, onChange }: { documents: Row[]; onChange: () => void }) {
  const toast = useToast();
  if (!documents.length) return null;
  function remove(doc: Row) {
    NativeAlert.alert('Remove this document?', String(doc.documentTitle ?? ''), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await productDocumentService.remove(doc.id);
            toast('Document removed');
            onChange();
          } catch (err) {
            toast(extractErrorMessage(err), 'error');
          }
        },
      },
    ]);
  }
  return (
    <Card title={`Documents (${documents.length})`} padded={false}>
      {documents.map(doc => (
        <View key={doc.id} style={styles.doc}>
          <FileTextIcon size={18} color={colors.secondary} />
          <Pressable style={styles.flex} onPress={() => fileUrl(doc) && Linking.openURL(fileUrl(doc)!)}>
            <Text style={styles.docTitle} numberOfLines={1}>
              {String(doc.documentTitle ?? 'Document')}
            </Text>
            <Text style={styles.docMeta}>{String(doc.documentType ?? '').toLowerCase()}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Remove document" hitSlop={8} onPress={() => remove(doc)}>
            <CloseIcon size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: '30.5%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.background },
  photoImg: { width: '100%', height: '100%', backgroundColor: colors.background },
  cover: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.secondary },
  coverText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  photoBtn: { position: 'absolute', top: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,19,41,0.55)' },
  photoBtnLeft: { left: 6 },
  photoBtnRight: { right: 6 },
  photoBusy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(3,19,41,0.4)' },
  addPhoto: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.secondarySoft, backgroundColor: '#fffaf5' },
  addText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
  variantRow: { gap: 10 },
  variant: { width: 92 },
  variantImg: { width: 92, height: 92, borderRadius: radius.md, backgroundColor: colors.background },
  faded: { opacity: 0.5 },
  variantLabel: { marginTop: 4, fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  variantMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  doc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  docTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  docMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
});
