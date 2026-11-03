import { api } from '../lib/api';

// The store's printable QR tag (eshop-backend src/modules/store,
// /stores/:storeId/qr-tag), drawn by the media center. Viewing needs
// stores:view; previewing and generating need stores:edit.

export type QrTagStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';

export interface StoreQrTag {
  status: QrTagStatus;
  /** The link the QR code opens (the store's shop page). */
  qrCodeUrl: string | null;
  tagImageUrl: string | null;
  tagImageDownloadUrl: string | null;
  tagPdfUrl: string | null;
  tagPdfDownloadUrl: string | null;
  frame: string | null;
  themeId: string | null;
  errorMessage: string | null;
  generatedAt: string | null;
}

export interface QrDesign {
  key: string;
  name: string;
  description: string | null;
  /** Beyond the store owner's plan. */
  locked: boolean;
}

export interface QrTheme {
  id: string;
  name: string;
  accentColor: string;
  darkColor: string;
  locked: boolean;
}

export interface StoreQrTagView {
  enabled: boolean;
  tag: StoreQrTag | null;
  /** In the admin's order. */
  designs: QrDesign[];
  themes: QrTheme[];
  plan: { name: string | null; designLimit: number | null; themeLimit: number | null };
  frame: string | null;
  themeId: string | null;
  isOutdated: boolean;
  generated?: boolean;
  warnings?: string[];
}

export const qrTagService = {
  get(storeId: string): Promise<StoreQrTagView> {
    return api.get(`/stores/${storeId}/qr-tag`).then(res => res.data);
  },
  /** Reuses the saved tag while the store, design and theme are unchanged, unless regenerate is set. */
  generate(storeId: string, payload: { frame: string; themeId: string; regenerate: boolean }): Promise<StoreQrTagView> {
    return api.post(`/stores/${storeId}/qr-tag`, payload, { timeout: 60000 }).then(res => res.data);
  },
  /** The tag drawn with this design and theme, as a PNG data URL; nothing is saved. */
  preview(storeId: string, payload: { frame: string; themeId: string }, signal?: AbortSignal): Promise<{ image: string }> {
    return api.post(`/stores/${storeId}/qr-tag/preview`, payload, { signal, timeout: 60000 }).then(res => res.data);
  },
};
