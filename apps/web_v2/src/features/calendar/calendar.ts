/**
 * Pure date helpers for the community calendar.
 *
 * Reads the device clock / locale through `Date` and `Intl` — no date library,
 * and no assumption that the user is in Central time.
 */

export const CALENDAR_GRID_CELLS = 42;

export const CALENDAR_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Instrument red — matches the map calendar widget accent. */
export const CALENDAR_ACCENT = '#d64545';

export function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toCalendarISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseCalendarISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addCalendarDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

export function addCalendarMonths(date: Date, delta: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  const daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), daysInTarget));
  return target;
}

export function startOfCalendarWeek(date: Date): Date {
  return addCalendarDays(date, -date.getDay());
}

export function calendarWeekDays(date: Date): Date[] {
  const start = startOfCalendarWeek(date);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
}

export function calendarDayFraction(date: Date): number {
  return (date.getHours() * 60 + date.getMinutes()) / 1_440;
}

export function msUntilNextMinute(date: Date): number {
  return 60_000 - (date.getSeconds() * 1_000 + date.getMilliseconds());
}

export function calendarMonthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstCellDay = 1 - first.getDay();
  return Array.from({ length: CALENDAR_GRID_CELLS }, (_, index) =>
    new Date(first.getFullYear(), first.getMonth(), firstCellDay + index),
  );
}

export function calendarWeekdayLabels(): string[] {
  const format = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(1970, 0, 4 + index)),
  );
}

export function formatCalendarMonth(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatCalendarWeekdayShort(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

export function formatCalendarMonthShort(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
}

export function formatCalendarFullDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatCalendarTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatCalendarWeekRange(date: Date, referenceYear: number): string {
  const start = startOfCalendarWeek(date);
  const end = addCalendarDays(start, 6);
  const showYear =
    start.getFullYear() !== referenceYear || end.getFullYear() !== referenceYear;

  const startText = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const endText = end.toLocaleDateString(undefined, {
    ...(start.getMonth() === end.getMonth() ? {} : { month: 'short' }),
    day: 'numeric',
    ...(showYear ? { year: 'numeric' } : {}),
  });

  return `${startText} – ${endText}`;
}

export function formatCalendarDayTitle(date: Date, referenceYear: number): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() === referenceYear ? {} : { year: 'numeric' }),
  });
}

export function formatCalendarHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' });
}
