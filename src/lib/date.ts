// Dates as the Seller Panel shows them, formatted by hand so they don't depend
// on the JS engine's locale data.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parse(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 3:05 PM */
export function formatTime(value: unknown) {
  const date = parse(value);
  if (!date) return '—';
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** 12 Oct 2026 (the year only when it isn't this year). */
export function formatDay(value: unknown) {
  const date = parse(value);
  if (!date) return '—';
  const year = date.getFullYear() === new Date().getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${year}`;
}

/** Today, 3:05 PM · Yesterday, 9:12 AM · 12 Oct, 3:05 PM */
export function formatWhen(value: unknown) {
  const date = parse(value);
  if (!date) return '—';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const day = sameDay(date, today) ? 'Today' : sameDay(date, yesterday) ? 'Yesterday' : formatDay(date);
  return `${day}, ${formatTime(date)}`;
}

export function isToday(value: unknown) {
  const date = parse(value);
  return !!date && sameDay(date, new Date());
}

/** YYYY-MM-DD, `days` from today (local time). */
export function addDaysISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
