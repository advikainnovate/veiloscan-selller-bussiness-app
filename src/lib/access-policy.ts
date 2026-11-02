// Mirrors the Seller Panel's src/lib/access-policy.ts (and the backend's
// src/common/constants/access-policy.constant.ts).

// Shared reference data: sellers read it through the API (product forms need
// categories, brands…) but only platform admins manage it.
const PLATFORM_MASTER_RESOURCES = [
  'category-master',
  'category-extra',
  'category-tags',
  'category-slabs-master',
  'category-commission-slabs',
  'categorywise-specifications',
  'categorywise-variants',
  'specifications',
  'specifications-data',
  'variant-master',
  'variant-data',
  'brands-master',
  'base_values',
  'tax',
  'global-charges-manager',
  'global-charges-options',
  'cms-pages',
  'cms-media',
  'cms-navigation',
  'faq-categories',
  'faq-tags',
  'faqs',
];

// Platform administration — never available to sellers.
const PLATFORM_ADMIN_RESOURCES = [
  'roles',
  'permissions',
  'designations',
  'companies',
  'settings',
  'reports',
  'reviews',
  'user-bonuses',
  'store-approvals',
  'support-settings',
];

// Product sub-data comes with products-master:manage (same rule as the API).
const PRODUCT_SUB_RESOURCES = [
  'product-images',
  'product-variants',
  'product-business-variants',
  'business-variant-options',
  'product-inventory',
  'product-specifications',
  'product-specification-values',
  'products-measures',
  'product-seo',
  'product-tags',
  'product-documents',
  'product-expiry',
];

/**
 * Permissions a seller can actually use: their role's permissions plus
 * implied product sub-data, minus anything reserved for platform admins.
 */
export function usablePermissions(permissions: string[]): string[] {
  const implied = permissions.includes('products-master:manage') ? PRODUCT_SUB_RESOURCES.map(r => `${r}:manage`) : [];
  return [...new Set([...permissions, ...implied])].filter(permission => {
    const resource = permission.split(':')[0];
    return !PLATFORM_ADMIN_RESOURCES.includes(resource) && !PLATFORM_MASTER_RESOURCES.includes(resource);
  });
}

/** `x:view` is also granted by `x:manage`. */
export function grants(usable: string[], permission: string) {
  if (usable.includes(permission)) return true;
  const [resource, action] = permission.split(':');
  return action === 'view' && usable.includes(`${resource}:manage`);
}
