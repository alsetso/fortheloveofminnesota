export type StreakDay = {
  date: string;
  active: boolean;
  loadCount: number;
  xpGranted: boolean;
  xpClaimed: boolean;
  xpAmount: number;
  isToday: boolean;
  /** After today in the calendar year — not yet earned / not a miss. */
  isFuture: boolean;
};

export type AccountStreakState = {
  timezone: string;
  today: string;
  year: number;
  yearStart: string;
  yearEnd: string;
  /** Active login days from Jan 1 through today. */
  activeDaysThisYear: number;
  currentStreak: number;
  longestStreak: number;
  dailyXp: number;
  pendingToday: boolean;
  days: StreakDay[];
};
