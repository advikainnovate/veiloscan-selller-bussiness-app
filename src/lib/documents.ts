import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { API_URL } from '../config/env';
import { api } from './api';
import { getAccessToken } from './session';

/**
 * Downloads a PDF the API serves (it needs the sign-in token) to the app's
 * cache and opens it in the phone's viewer, where it can be shared or printed.
 */
export async function openPdf(path: string, fileName: string) {
  // A cheap authenticated call first, so an expired token is refreshed by the
  // API client before the download (which doesn't go through it).
  await api.get('/auth/me');
  const target = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${fileName.replace(/[^\w.-]+/g, '-')}`;
  const res = await ReactNativeBlobUtil.config({ path: target }).fetch('GET', `${API_URL}${path}`, {
    Authorization: `Bearer ${getAccessToken() ?? ''}`,
    Accept: 'application/pdf',
  });
  const status = res.info().status;
  if (status >= 400) {
    await ReactNativeBlobUtil.fs.unlink(target).catch(() => {});
    throw new Error(status === 404 ? 'This document is no longer available.' : `Couldn't download the document (${status}).`);
  }
  if (Platform.OS === 'ios') ReactNativeBlobUtil.ios.previewDocument(target);
  else await ReactNativeBlobUtil.android.actionViewIntent(target, 'application/pdf', 'Open with');
}
