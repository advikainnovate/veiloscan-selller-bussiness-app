import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { API_URL } from '../config/env';
import { api } from './api';
import { getAccessToken } from './session';
import i18n from '../i18n';

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
    throw new Error(status === 404 ? i18n.t('orders.thisDocumentIsNoLongerAvailable') : i18n.t('orders.couldnTDownloadTheDocumentStatus', { status }));
  }
  if (Platform.OS === 'ios') {
    ReactNativeBlobUtil.ios.previewDocument(target);
    return;
  }
  // No chooser title: blob-util wraps the intent in a chooser that lacks
  // FLAG_ACTIVITY_NEW_TASK, so starting it from the app context fails. The
  // plain ACTION_VIEW intent carries the flag (Android still lets the user pick
  // an app when there's no default).
  try {
    await ReactNativeBlobUtil.android.actionViewIntent(target, 'application/pdf');
  } catch (err) {
    if ((err as { code?: string })?.code === 'ENOAPP' || /No app installed/i.test(String((err as Error)?.message))) {
      throw new Error(i18n.t('orders.noPdfViewerAppIsInstalled'));
    }
    throw err;
  }
}
