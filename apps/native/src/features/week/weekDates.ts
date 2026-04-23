// Local civil-date helpers for Week + Tonight dashboard.
// Never use toISOString() for day keys here; all keys are local calendar days.

export type ISODate = string;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatLocal(date: Date): ISODate {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO(): ISODate {
  return formatLocal(new Date());
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  return formatLocal(new Date(y, m - 1, d + days));
}

export function upcomingDays(count: number, fromIso = todayISO()): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(fromIso, i));
}

const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const MONTH_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short' });

export interface FormattedDay {
  weekday: string;
  month: string;
  day: number;
  isoDate: ISODate;
}

export function formatDayShort(iso: ISODate): FormattedDay {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  return {
    weekday: WEEKDAY_SHORT.format(date).toUpperCase(),
    month: MONTH_SHORT.format(date).toUpperCase(),
    day: date.getDate(),
    isoDate: iso,
  };
}

export function isToday(iso: ISODate): boolean {
  return iso === todayISO();
}

export function isPast(iso: ISODate): boolean {
  return iso < todayISO();
}

export function isFuture(iso: ISODate): boolean {
  return iso > todayISO();
}
