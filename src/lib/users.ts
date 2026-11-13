import type { BadgeTone } from '../components/ui/Badge';
import type { StaffUser, UserSession } from '../services/user-service';
import i18n from '../i18n';

// Management › Users: the Seller Panel's staff-user rules
// (src/components/dashboard/users/user-wizard.tsx).

export const USER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { get label() { return i18n.t('common.active'); }, tone: 'green' },
  INACTIVE: { get label() { return i18n.t('common.inactive'); }, tone: 'slate' },
  PENDING: { get label() { return i18n.t('common.pending'); }, tone: 'amber' },
  HOLD: { get label() { return i18n.t('users.onHold'); }, tone: 'orange' },
  BLOCKED: { get label() { return i18n.t('common.blocked'); }, tone: 'red' },
};
export const userStatus = (status: unknown) => USER_STATUS[String(status)] ?? { label: String(status ?? '—'), tone: 'slate' as BadgeTone };

export const STATUS_OPTIONS = Object.entries(USER_STATUS).map(([value, s]) => ({ value, label: s.label }));

export const GENDER_OPTIONS = [
  { value: 'MALE', get label() { return i18n.t('common.male'); } },
  { value: 'FEMALE', get label() { return i18n.t('common.female'); } },
  { value: 'OTHER', get label() { return i18n.t('common.other'); } },
];
export const genderLabel = (g: unknown) => GENDER_OPTIONS.find(o => o.value === g)?.label ?? null;

export const COUNTRY_CODES = [
  { value: '91', get label() { return i18n.t('users.n91India'); } },
  { value: '1', get label() { return i18n.t('users.n1Usa'); } },
  { value: '44', get label() { return i18n.t('users.n44Uk'); } },
  { value: '971', get label() { return i18n.t('users.n971Uae'); } },
  { value: '65', get label() { return i18n.t('users.n65Singapore'); } },
  { value: '61', get label() { return i18n.t('users.n61Australia'); } },
];

export const PASSWORD_RULES: { test: (pw: string) => boolean; label: string }[] = [
  { test: pw => pw.length >= 8, get label() { return i18n.t('common.atLeast8Characters'); } },
  { test: pw => /[A-Z]/.test(pw), get label() { return i18n.t('users.oneUppercaseLetter'); } },
  { test: pw => /[a-z]/.test(pw), get label() { return i18n.t('users.oneLowercaseLetter'); } },
  { test: pw => /\d/.test(pw), get label() { return i18n.t('users.oneNumber'); } },
  { test: pw => /[^A-Za-z0-9]/.test(pw), get label() { return i18n.t('users.oneSpecialSymbol'); } },
];

export const userName = (u: Pick<StaffUser, 'firstName' | 'lastName'>) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || i18n.t('users.staffUser');

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
  if (!f.firstName.trim() || !f.lastName.trim()) return i18n.t('users.enterTheFirstAndLastName');
  if (!isEdit) {
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return i18n.t('common.enterAValidEmailAddress2');
    if (!/^\d{6,15}$/.test(f.phoneNumber.trim())) return i18n.t('users.enterAMobileNumberOf6');
    if (f.password && PASSWORD_RULES.some(r => !r.test(f.password))) return i18n.t('users.thePasswordMustMeetEveryRule');
  }
  if (!f.roleId) return i18n.t('users.chooseARole');
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
    const name = s.deviceName || s.deviceType || i18n.t('users.unknownDevice');
    const key = `${name}|${s.browser ?? ''}|${s.os ?? ''}`;
    const active = Boolean(s.isActive) && !s.logoutTime;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { key, name, detail: [s.browser, s.os].filter(Boolean).join(' · ') || i18n.t('users.unknownBrowserOs'), lastSeen: s.startTime, sessions: 1, active });
    } else {
      g.sessions += 1;
      g.active = g.active || active;
      if (s.startTime && (!g.lastSeen || s.startTime > g.lastSeen)) g.lastSeen = s.startTime;
    }
  }
  return [...groups.values()].sort((a, b) => String(b.lastSeen ?? '').localeCompare(String(a.lastSeen ?? '')));
}
