'use client';

/**
 * Full-year GitHub-style contribution heatmap for login streak —
 * horizontal carousel of week columns. Tile size is only capped by TILE_PX.
 */

import { useMemo, useState } from 'react';
import type { AccountStreakState, StreakDay } from '@/features/streaks/types';
import {
  buildContributionWeeks,
  formatStreakDayLabel,
} from '@/features/streaks/streakCalendar';
import { TodayRecordShell, TodayRecordStatRow } from '@/features/today/records/TodayRecordShell';

/**
 * Heat by world-load / app-open count for the day:
 * 0 → grey, 1 → light, 2–3 → mid, 4–7 → darker, 8+ → darkest.
 */
function activityLevel(day: StreakDay | null): 0 | 1 | 2 | 3 | 4 {
  if (!day || day.isFuture) return 0;
  const n = day.loadCount;
  if (n <= 0) return 0;
  if (n < 2) return 1;
  if (n < 4) return 2;
  if (n < 8) return 3;
  return 4;
}

/** Warm empty greys tuned for the Today beige canvas (#f7f5f1). */
const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#d8d0c4]',
  1: 'bg-[#9cc9e0]',
  2: 'bg-[#5ba3c9]',
  3: 'bg-[#2a6f8f]',
  4: 'bg-[#1a4a63]',
};

const FUTURE_CELL = 'bg-[#ebe4d8]';
const SKELETON_CELL = 'bg-[#d8d0c4]';

/** Slightly larger than the old fit-to-width cells — year scrolls horizontally. */
const TILE_PX = 11;
const GAP_PX = 3;
const MONTH_ROW_PX = 12;

function dayStatus(day: StreakDay, dailyXp: number): string {
  if (day.isFuture) return 'Upcoming';
  if (day.xpClaimed) return `+${day.xpAmount || dailyXp} XP claimed`;
  if (day.xpGranted) return `+${day.xpAmount || dailyXp} XP ready to claim`;
  if (day.active) return 'Visited — streak maintained';
  if (day.isToday) return `Open the app to earn +${dailyXp} XP`;
  return 'No visit';
}

function cellClass(day: StreakDay): string {
  if (day.isFuture) return FUTURE_CELL;
  return LEVEL_CLASS[activityLevel(day)];
}

export function StreakCalendarCard({
  streak,
  loading,
}: {
  streak: AccountStreakState | null;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<StreakDay | null>(null);

  const weeks = useMemo(
    () => buildContributionWeeks(streak?.days ?? []),
    [streak?.days],
  );

  const year = streak?.year ?? new Date().getFullYear();
  const activeCount = streak?.activeDaysThisYear ?? 0;

  const headerLine = streak
    ? streak.currentStreak > 0
      ? `${activeCount} day${activeCount === 1 ? '' : 's'} in ${year} · ${streak.currentStreak}-day streak`
      : `${activeCount} day${activeCount === 1 ? '' : 's'} active in ${year}`
    : `Login activity · ${year}`;

  return (
    <>
      <section>
        <div className="flex items-baseline justify-between gap-3 px-5">
          <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">
            {loading && !streak ? 'Loading streak…' : headerLine}
          </p>
          {streak ? (
            <p className="shrink-0 text-[12px] tabular-nums text-foreground-muted">
              +{streak.dailyXp} XP / day
            </p>
          ) : null}
        </div>

        <div className="mt-3">
          {loading && !streak ? (
            <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-full w-max justify-center px-5" style={{ gap: GAP_PX }}>
                {Array.from({ length: 53 }).map((_, wi) => (
                  <div key={wi} className="flex flex-col" style={{ width: TILE_PX }}>
                    <div style={{ height: MONTH_ROW_PX + 2 }} />
                    <div className="grid grid-rows-7" style={{ gap: GAP_PX }}>
                      {Array.from({ length: 7 }).map((_, di) => (
                        <div
                          key={di}
                          className={`animate-pulse rounded-[2px] ${SKELETON_CELL}`}
                          style={{ width: TILE_PX, height: TILE_PX }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-full w-max justify-center px-5" style={{ gap: GAP_PX }}>
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col" style={{ width: TILE_PX }}>
                      <div
                        className="relative overflow-visible"
                        style={{ height: MONTH_ROW_PX + 2 }}
                      >
                        {week.monthLabel ? (
                          <span className="absolute left-0 top-0 z-[1] whitespace-nowrap text-[9px] leading-none text-foreground-muted">
                            {week.monthLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-rows-7" style={{ gap: GAP_PX }}>
                        {week.days.map((day, di) => {
                          if (!day) {
                            return (
                              <div
                                key={`${wi}-${di}`}
                                className="rounded-[2px] bg-transparent"
                                style={{ width: TILE_PX, height: TILE_PX }}
                              />
                            );
                          }
                          return (
                            <button
                              key={day.date}
                              type="button"
                              onClick={() => setSelected(day)}
                              title={`${formatStreakDayLabel(day.date)} · ${dayStatus(day, streak?.dailyXp ?? 250)}`}
                              aria-label={`${formatStreakDayLabel(day.date)} · ${dayStatus(day, streak?.dailyXp ?? 250)}`}
                              className={`rounded-[2px] transition active:scale-90 ${cellClass(day)} ${
                                day.isToday
                                  ? 'ring-1 ring-[#1a4a63] ring-offset-1 ring-offset-[#f7f5f1]'
                                  : ''
                              }`}
                              style={{ width: TILE_PX, height: TILE_PX }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-3 px-5 text-[10px] text-foreground-muted">
                <p>
                  {streak && streak.longestStreak > 0
                    ? `Best streak ${streak.longestStreak}`
                    : `Year ${year}`}
                </p>
                <div className="flex items-center gap-1">
                  <span>Less</span>
                  {([0, 1, 2, 3, 4] as const).map((level) => (
                    <span
                      key={level}
                      className={`h-2.5 w-2.5 rounded-[2px] ${LEVEL_CLASS[level]}`}
                    />
                  ))}
                  <span>More</span>
                </div>
              </div>

              {streak?.pendingToday ? (
                <p className="mt-2 px-5 text-[12px] font-medium text-lake-blue">
                  Today&apos;s +{streak.dailyXp} XP is ready to claim.
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>

      {selected ? (
        <TodayRecordShell
          title={formatStreakDayLabel(selected.date)}
          eyebrow="Login streak"
          subtitle={dayStatus(selected, streak?.dailyXp ?? 250)}
          onClose={() => setSelected(null)}
          ariaLabel="Streak day"
        >
          <TodayRecordStatRow
            label="World loads"
            value={selected.isFuture ? '—' : String(selected.loadCount)}
          />
          <TodayRecordStatRow
            label="Streak XP"
            value={
              selected.xpGranted
                ? `+${selected.xpAmount || streak?.dailyXp || 250}`
                : selected.isFuture
                  ? 'Upcoming'
                  : '—'
            }
          />
          <TodayRecordStatRow
            label="Status"
            value={
              selected.isFuture
                ? 'Upcoming'
                : selected.xpClaimed
                  ? 'Claimed'
                  : selected.xpGranted
                    ? 'Unclaimed'
                    : selected.active
                      ? 'Active'
                      : 'Missed'
            }
          />
        </TodayRecordShell>
      ) : null}
    </>
  );
}
