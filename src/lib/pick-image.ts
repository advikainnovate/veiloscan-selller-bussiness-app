import { Alert } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset, type ImagePickerResponse } from 'react-native-image-picker';
import type { PickedFile } from '../services/products-service';

// Photos are sized down on the phone; the store's own resizing does the rest.
const OPTIONS = { mediaType: 'photo' as const, maxWidth: 2000, maxHeight: 2000, quality: 0.8 as const };

function toFiles(res: ImagePickerResponse): PickedFile[] {
  if (res.didCancel) return [];
  if (res.errorCode) throw new Error(res.errorMessage || "Couldn't open the photos");
  return (res.assets ?? [])
    .filter((a: Asset) => !!a.uri)
    .map((a: Asset, i) => ({
      uri: a.uri!,
      name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`,
      type: a.type ?? 'image/jpeg',
    }));
}

/** Asks camera or library, then returns the picked photos (none when cancelled). */
export function pickImages({ multiple = true }: { multiple?: boolean } = {}): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    const done = (p: Promise<ImagePickerResponse>) =>
      p.then(res => {
        try {
          resolve(toFiles(res));
        } catch (err) {
          reject(err);
        }
      }, reject);
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => done(launchCamera({ ...OPTIONS, saveToPhotos: false })) },
      { text: 'Choose from library', onPress: () => done(launchImageLibrary({ ...OPTIONS, selectionLimit: multiple ? 10 : 1 })) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}
