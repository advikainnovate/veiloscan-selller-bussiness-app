import { crud } from './products-service';

// Delivery zones and each zone's shipping methods & rates (eshop-backend
// src/modules/shipping), as the Seller Panel's Shipping pages.
export const shippingZoneService = crud('/shipping-zones');
export const shippingMethodService = crud('/shipping-methods');
