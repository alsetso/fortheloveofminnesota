/** America/Chicago calendar helpers for the yearly login-streak grid. */

import type { StreakDay } from '@/features/streaks/types';

export const STREAK_TIMEZONE = 'America/Chicago';
/** Fallback only — live amount comes from published `daily_streak_xp()`. */
export const DAILY_STREAK_XP = 250;

/** YYYY-MM-DD for an instant in the streak timezone. */
export function chicagoDateKey(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STREAK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function calendarYearBounds(todayKey: string): {
  year: number;
  startKey: string;
  endKey: string;
} {
  const year = Number(todayKey.slice(0, 4));
  return {
    year,
    startKey: `${year}-01-01`,
    endKey: `${year}-12-31`,
  };
}

/** Every YYYY-MM-DD from Jan 1 → Dec 31 of `year` (365 or 366). */
export function yearDateKeys(year: number): string[] {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const keys: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return keys;
}

/** Consecutive active days ending on today, or yesterday if today is still empty. */
export function computeCurrentStreak(activeDays: Set<string>, todayKey: string): number {
  let cursor = todayKey;
  if (!activeDays.has(cursor)) {
    cursor = shiftDateKey(todayKey, -1);
    if (!activeDays.has(cursor)) return 0;
  }
  let streak = 0;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function computeLongestStreak(sortedActiveKeys: string[]): number {
  if (sortedActiveKeys.length === 0) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedActiveKeys.length; i += 1) {
    const prev = sortedActiveKeys[i - 1]!;
    const cur = sortedActiveKeys[i]!;
    if (shiftDateKey(prev, 1) === cur) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}

export function formatStreakDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Sunday = 0 … Saturday = 6 (GitHub contribution calendar). */
export function weekdaySunday0(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function monthShortLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
  });
}

export type ContributionWeek = {
  /** Length 7, Sun→Sat. Null = outside the calendar year. */
  days: (StreakDay | null)[];
  /** Month label above this column when the month starts in this week. */
  monthLabel: string | null;
};

/**
 * Pack streak days into GitHub-style week columns (Sun→Sat rows).
 * Pads the first week back to Sunday and the last week through Saturday;
 * cells outside the year are null.
 */
export function buildContributionWeeks(days: StreakDay[]): ContributionWeek[] {
  if (days.length === 0) return [];

  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = days[0]!.date;
  const last = days[days.length - 1]!.date;
  const padStart = shiftDateKey(first, -weekdaySunday0(first));

  const weeks: ContributionWeek[] = [];
  let cursor = padStart;
  let prevMonth: string | null = null;

  while (cursor <= last) {
    const weekDays: (StreakDay | null)[] = [];
    let monthLabel: string | null = null;

    for (let i = 0; i < 7; i += 1) {
      const key = shiftDateKey(cursor, i);
      if (key < first || key > last) {
        weekDays.push(null);
        continue;
      }
      const day = byDate.get(key) ?? null;
      weekDays.push(day);
      const month = monthShortLabel(key);
      if (month !== prevMonth) {
        monthLabel = month;
        prevMonth = month;
      }
    }

    weeks.push({ days: weekDays, monthLabel });
    cursor = shiftDateKey(cursor, 7);
  }

  return weeks;
}
