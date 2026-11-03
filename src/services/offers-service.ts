import { OFFERS, type OfferKind } from '../lib/offers';
import { crud } from './products-service';

// Freebies (/freebie-master), Gift Cards (/gift-cards) and Promotions
// (/my-promotions): the same CRUD endpoints the Seller Panel uses.
const services = Object.fromEntries(Object.values(OFFERS).map(c => [c.kind, crud(c.resource)])) as Record<OfferKind, ReturnType<typeof crud>>;

export const offerService = (kind: OfferKind) => services[kind];
