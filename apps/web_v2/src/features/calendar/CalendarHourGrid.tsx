'use client';

import { Fragment, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { CommunityCalendarEvent } from '@/features/calendar/calendarEventsApi';
import {
  CALENDAR_ACCENT,
  CALENDAR_HOURS,
  calendarDayFraction,
  calendarWeekdayLabels,
  formatCalendarFullDate,
  formatCalendarHour,
  isSameCalendarDay,
  toCalendarISO,
} from '@/features/calendar/calendar';
import {
  setCalendarAnchor,
  useCalendarViewState,
} from '@/features/calendar/viewStore';
import { postPath } from '@/lib/routes/routePolicy';

const WEEKDAYS = calendarWeekdayLabels();
const GUTTER_PX = 44;
const DAY_ROW_PX = 56;
const WEEK_ROW_PX = 44;
const FALLBACK_HOUR = 8;

function eventLayout(
  event: CommunityCalendarEvent,
  day: Date,
  rowPx: number,
): { top: number; height: number } | null {
  const start = new Date(event.starts_at);
  if (!isSameCalendarDay(start, day)) return null;
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const startFrac = calendarDayFraction(start);
  let endFrac =
    end && isSameCalendarDay(end, day)
      ? calendarDayFraction(end)
      : Math.min(1, startFrac + 1 / 24);
  if (endFrac <= startFrac) endFrac = Math.min(1, startFrac + 1 / 24);
  const top = startFrac * rowPx * CALENDAR_HOURS.length;
  const height = Math.max(22, (endFrac - startFrac) * rowPx * CALENDAR_HOURS.length);
  return { top, height };
}

export function CalendarHourGrid({
  days,
  now,
  events,
}: {
  days: Date[];
  now: Date;
  events: CommunityCalendarEvent[];
}) {
  const { anchorISO } = useCalendarViewState();
  const scrollTargetRef = useRef<HTMLDivElement>(null);

  const multiDay = days.length > 1;
  const rowPx = multiDay ? WEEK_ROW_PX : DAY_ROW_PX;
  const showsToday = days.some((day) => isSameCalendarDay(day, now));
  const columns = `${GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`;
  const rangeKey = `${toCalendarISO(days[0])}:${days.length}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      scrollTargetRef.current?.scrollIntoView({ block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [rangeKey]);

  return (
    <div>
      {multiDay ? (
        <div
          className="sticky top-0 z-10 -mx-4 grid bg-[#f7f5f1]/95 px-4 pb-1 pt-0.5 backdrop-blur-xl"
          style={{ gridTemplateColumns: columns }}
        >
          <span />
          {days.map((day) => {
            const today = isSameCalendarDay(day, now);
            const anchored = toCalendarISO(day) === anchorISO;
            return (
              <button
                key={toCalendarISO(day)}
                type="button"
                onClick={() => setCalendarAnchor(day)}
                aria-label={formatCalendarFullDate(day)}
                aria-pressed={anchored}
                className="flex flex-col items-center gap-0.5 rounded-lg py-0.5"
              >
                <span
                  aria-hidden
                  className="text-[10px] font-semibold uppercase text-foreground-muted"
                >
                  {WEEKDAYS[day.getDay()]}
                </span>
                <span
                  aria-hidden
                  className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold tabular-nums ${
                    today
                      ? 'text-white'
                      : anchored
                        ? 'text-foreground'
                        : 'text-foreground-muted'
                  } ${anchored && !today ? 'ring-1 ring-inset ring-black/[0.14]' : ''}`}
                  style={today ? { backgroundColor: CALENDAR_ACCENT } : undefined}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="relative grid" style={{ gridTemplateColumns: columns }}>
        {CALENDAR_HOURS.map((hour) => (
          <Fragment key={hour}>
            <div
              ref={!showsToday && hour === FALLBACK_HOUR ? scrollTargetRef : undefined}
              style={{ height: rowPx }}
              className="flex items-center justify-end pr-2 text-[10px] font-medium uppercase text-foreground-muted"
            >
              {formatCalendarHour(hour)}
            </div>
            {days.map((day) => (
              <div
                key={toCalendarISO(day)}
                style={{ height: rowPx }}
                className="border-l border-t border-black/[0.08]"
              />
            ))}
          </Fragment>
        ))}

        {days.map((day, dayIndex) => {
          const dayEvents = events.filter((event) =>
            isSameCalendarDay(new Date(event.starts_at), day),
          );
          return dayEvents.map((event) => {
            const layout = eventLayout(event, day, rowPx);
            if (!layout) return null;
            const colWidth = `calc((100% - ${GUTTER_PX}px) / ${days.length})`;
            const left = `calc(${GUTTER_PX}px + ${dayIndex} * ${colWidth} + 2px)`;
            return (
              <Link
                key={`${event.id}-${toCalendarISO(day)}`}
                href={postPath(event.id)}
                className="absolute z-[1] overflow-hidden rounded-md px-1.5 py-0.5 text-left text-white shadow-sm transition active:opacity-90"
                style={{
                  top: layout.top,
                  height: layout.height,
                  left,
                  width: `calc(${colWidth} - 4px)`,
                  backgroundColor: CALENDAR_ACCENT,
                }}
                title={event.title}
              >
                <span className="block truncate text-[11px] font-semibold leading-tight">
                  {event.title}
                </span>
                {!multiDay ? (
                  <span className="block truncate text-[10px] leading-tight opacity-90">
                    {new Date(event.starts_at).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {event.place_label ? ` · ${event.place_label}` : ''}
                  </span>
                ) : null}
              </Link>
            );
          });
        })}

        {showsToday ? (
          <div
            ref={scrollTargetRef}
            aria-hidden
            className="pointer-events-none absolute z-[2] flex items-center"
            style={{
              top: calendarDayFraction(now) * rowPx * CALENDAR_HOURS.length,
              left: GUTTER_PX,
              right: 0,
            }}
          >
            <span
              className="-ml-[3px] h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: CALENDAR_ACCENT }}
            />
            <span className="h-px flex-1" style={{ backgroundColor: CALENDAR_ACCENT }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
