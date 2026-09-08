'use client';

import {
  calendarWeekDays,
  parseCalendarISO,
} from '@/features/calendar/calendar';
import { CalendarEventsList } from '@/features/calendar/CalendarEventsList';
import { CalendarHourGrid } from '@/features/calendar/CalendarHourGrid';
import { CalendarMonthView } from '@/features/calendar/CalendarMonthView';
import { useCalendarEvents } from '@/features/calendar/useCalendarEvents';
import { useCalendarViewState } from '@/features/calendar/viewStore';
import { useClock } from '@/features/calendar/useClock';

export function CalendarCard() {
  const now = useClock();
  const { anchorISO, view } = useCalendarViewState();
  const { events, eventsByDay, eventsForAnchor, loading, error } = useCalendarEvents();
  if (!now) return null;

  const anchor = parseCalendarISO(anchorISO);

  if (view === 'month') {
    return (
      <div>
        <CalendarMonthView month={anchor} now={now} eventsByDay={eventsByDay} />
        <CalendarEventsList
          events={eventsForAnchor}
          loading={loading}
          error={error}
          emptyLabel="No community events on this day."
        />
      </div>
    );
  }

  if (view === 'week') {
    return (
      <CalendarHourGrid days={calendarWeekDays(anchor)} now={now} events={events} />
    );
  }

  return (
    <div>
      <CalendarHourGrid days={[anchor]} now={now} events={events} />
      <CalendarEventsList
        events={eventsForAnchor}
        loading={loading}
        error={error}
        emptyLabel="No community events on this day."
      />
    </div>
  );
}
