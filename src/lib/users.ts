import type { BadgeTone } from '../components/ui/Badge';
import type { StaffUser, UserSession } from '../services/user-service';

// Management › Users: the Seller Panel's staff-user rules
// (src/components/dashboard/users/user-wizard.tsx).

export const USER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Active', tone: 'green' },
  INACTIVE: { label: 'Inactive', tone: 'slate' },
  PENDING: { label: 'Pending', tone: 'amber' },
  HOLD: { label: 'On hold', tone: 'orange' },
  BLOCKED: { label: 'Blocked', tone: 'red' },
};
export const userStatus = (status: unknown) => USER_STATUS[String(status)] ?? { label: String(status ?? '—'), tone: 'slate' as BadgeTone };

export const STATUS_OPTIONS = Object.entries(USER_STATUS).map(([value, s]) => ({ value, label: s.label }));

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];
export const genderLabel = (g: unknown) => GENDER_OPTIONS.find(o => o.value === g)?.label ?? null;

export const COUNTRY_CODES = [
  { value: '91', label: '+91 India' },
  { value: '1', label: '+1 USA' },
  { value: '44', label: '+44 UK' },
  { value: '971', label: '+971 UAE' },
  { value: '65', label: '+65 Singapore' },
  { value: '61', label: '+61 Australia' },
];

export const PASSWORD_RULES: { test: (pw: string) => boolean; label: string }[] = [
  { test: pw => pw.length >= 8, label: 'At least 8 characters' },
  { test: pw => /[A-Z]/.test(pw), label: 'One uppercase letter' },
  { test: pw => /[a-z]/.test(pw), label: 'One lowercase letter' },
  { test: pw => /\d/.test(pw), label: 'One number' },
  { test: pw => /[^A-Za-z0-9]/.test(pw), label: 'One special symbol' },
];

export const userName = (u: Pick<StaffUser, 'firstName' | 'lastName'>) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Staff user';

export function userInitials(u: Pick<StaffUser, 'firstName' | 'lastName'>) {
  const parts = userName(u).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export const userPhone = (u: Pick<StaffUser, 'countryCode' | 'phoneNumber'>) => (u.phoneNumber ? `+${u.countryCode || '91'} ${u.phoneNumber}` : null);

export interface UserFilters {
  search: string;
  status: string;
  roleId: string;
}
export const USER_FILTERS: UserFilters = { search: '', status: '', roleId: '' };

export function filterUsers(rows: StaffUser[], f: UserFilters) {
  const q = f.search.trim().toLowerCase();
  return rows.filter(u => {
    if (q && !`${userName(u)} ${u.email ?? ''} ${u.userDisplayName ?? ''} ${u.phoneNumber ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.status && u.status !== f.status) return false;
    if (f.roleId && u.roleId !== f.roleId) return false;
    return true;
  });
}

export interface UserForm {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  password: string;
  gender: string;
  status: string;
  roleId: string;
  designationTitle: string;
  bio: string;
}

export const EMPTY_USER: UserForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  email: '',
  countryCode: '91',
  phoneNumber: '',
  password: '',
  gender: '',
  status: 'ACTIVE',
  roleId: '',
  designationTitle: '',
  bio: '',
};

/** The first thing wrong with the form, or null. */
export function userProblem(f: UserForm, isEdit: boolean): string | null {
  if (!f.firstName.trim() || !f.lastName.trim()) return 'Enter the first and last name.';
  if (!isEdit) {
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Enter a valid email address.';
    if (!/^\d{6,15}$/.test(f.phoneNumber.trim())) return 'Enter a mobile number of 6–15 digits.';
    if (f.password && PASSWORD_RULES.some(r => !r.test(f.password))) return 'The password must meet every rule listed, or leave it blank.';
  }
  if (!f.roleId) return 'Choose a role.';
  return null;
}

/** A browser / device group for the Devices tab. */
export interface DeviceGroup {
  key: string;
  name: string;
  detail: string;
  lastSeen: string | null;
  sessions: number;
  active: boolean;
}

export function deviceGroups(sessions: UserSession[]): DeviceGroup[] {
  const groups = new Map<string, DeviceGroup>();
  for (const s of sessions) {
    const name = s.deviceName || s.deviceType || 'Unknown device';
    const key = `${name}|${s.browser ?? ''}|${s.os ?? ''}`;
    const active = Boolean(s.isActive) && !s.logoutTime;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { key, name, detail: [s.browser, s.os].filter(Boolean).join(' · ') || 'Unknown browser / OS', lastSeen: s.startTime, sessions: 1, active });
    } else {
      g.sessions += 1;
      g.active = g.active || active;
      if (s.startTime && (!g.lastSeen || s.startTime > g.lastSeen)) g.lastSeen = s.startTime;
    }
  }
  return [...groups.values()].sort((a, b) => String(b.lastSeen ?? '').localeCompare(String(a.lastSeen ?? '')));
}
