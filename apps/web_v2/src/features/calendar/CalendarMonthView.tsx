'use client';

import type { CommunityCalendarEvent } from '@/features/calendar/calendarEventsApi';
import {
  CALENDAR_ACCENT,
  calendarMonthGrid,
  calendarWeekdayLabels,
  formatCalendarFullDate,
  isSameCalendarDay,
  toCalendarISO,
} from '@/features/calendar/calendar';
import {
  setCalendarAnchor,
  setCalendarView,
  useCalendarViewState,
} from '@/features/calendar/viewStore';

const WEEKDAYS = calendarWeekdayLabels();

export function CalendarMonthView({
  month,
  now,
  eventsByDay,
}: {
  month: Date;
  now: Date;
  eventsByDay: Map<string, CommunityCalendarEvent[]>;
}) {
  const { anchorISO } = useCalendarViewState();

  return (
    <div className="mx-auto w-full">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, index) => (
          <span
            key={`${label}-${index}`}
            aria-hidden
            className="grid h-6 place-items-center text-[11px] font-semibold uppercase text-foreground-muted"
          >
            {label}
          </span>
        ))}
        {calendarMonthGrid(month).map((day) => {
          const iso = toCalendarISO(day);
          const today = isSameCalendarDay(day, now);
          const anchored = iso === anchorISO;
          const outsideMonth = day.getMonth() !== month.getMonth();
          const dayEvents = eventsByDay.get(iso) ?? [];
          const hasEvents = dayEvents.length > 0;

          return (
            <button
              key={iso}
              type="button"
              aria-label={
                hasEvents
                  ? `${formatCalendarFullDate(day)}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
                  : formatCalendarFullDate(day)
              }
              aria-current={today ? 'date' : undefined}
              aria-pressed={anchored}
              onClick={() => {
                if (anchored) setCalendarView('day');
                else setCalendarAnchor(day);
              }}
              className={`relative grid aspect-square place-items-center rounded-full text-[13px] tabular-nums transition ${
                today
                  ? 'font-bold text-white'
                  : outsideMonth
                    ? 'text-foreground-muted/40'
                    : 'text-foreground active:bg-black/[0.06]'
              } ${anchored && !today ? 'ring-1 ring-inset ring-black/[0.14]' : ''}`}
              style={today ? { backgroundColor: CALENDAR_ACCENT } : undefined}
            >
              {day.getDate()}
              {hasEvents ? (
                <span
                  aria-hidden
                  className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                    today ? 'bg-white' : ''
                  }`}
                  style={today ? undefined : { backgroundColor: CALENDAR_ACCENT }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
