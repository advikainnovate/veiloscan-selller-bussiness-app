import type { CustomerRow } from '../services/customer-service';

// Mirrors eshop-backend src/common/constants/store-customer.constant.ts:
// customers created from a store order get a placeholder email.
const STORE_CUSTOMER_EMAIL_DOMAIN = 'store-customer.veiloscan.invalid';

export function customerName(row: Pick<CustomerRow, 'firstName' | 'lastName'>) {
  return [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || 'Customer';
}

/** "RK" for Rajesh Kumar, "M" for a one-word name. */
export function customerInitials(row: Pick<CustomerRow, 'firstName' | 'lastName'>) {
  const parts = customerName(row).split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.[0] ?? '?';
  return letters.toUpperCase();
}

/** +91 98765 43210 */
export function customerPhone(row: Pick<CustomerRow, 'countryCode' | 'phoneNumber'>) {
  const digits = (row.phoneNumber ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const local = digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
  const code = (row.countryCode ?? '').replace(/\D/g, '');
  return code ? `+${code} ${local}` : local;
}

/** The email to show, or null for store customers who haven't registered. */
export function customerEmail(email: string | null) {
  if (!email || email.toLowerCase().endsWith(`@${STORE_CUSTOMER_EMAIL_DOMAIN}`)) return null;
  return email;
}
