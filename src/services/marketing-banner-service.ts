import { api } from '../lib/api';

export interface MarketingBanner {
  id: string;
  titleLine1: string;
  titleLine2: string | null;
  detail: string | null;
  ctaHref: string | null;
  imageLabel: string | null;
  imageUrl: string | null;
  tone: string | null;
}

export const marketingBannerService = {
  /** Active, ordered banners assigned to the seller app Home carousel. */
  listSellerHome(): Promise<MarketingBanner[]> {
    return api
      .get('/storefront/banners', { params: { placement: 'SELLER_APP' } })
      .then(res => (Array.isArray(res.data) ? res.data : []));
  },
};
