'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addCalendarDays,
  parseCalendarISO,
  startOfCalendarWeek,
  toCalendarISO,
} from '@/features/calendar/calendar';
import {
  fetchCommunityCalendarEvents,
  type CommunityCalendarEvent,
} from '@/features/calendar/calendarEventsApi';
import { useCalendarViewState } from '@/features/calendar/viewStore';

function rangeForView(
  view: 'month' | 'week' | 'day',
  anchorISO: string,
): { from: string; to: string } {
  const anchor = parseCalendarISO(anchorISO);
  if (view === 'day') {
    return {
      from: toCalendarISO(anchor),
      to: toCalendarISO(addCalendarDays(anchor, 1)),
    };
  }
  if (view === 'week') {
    const start = startOfCalendarWeek(anchor);
    return {
      from: toCalendarISO(start),
      to: toCalendarISO(addCalendarDays(start, 7)),
    };
  }
  // Month view pads with adjacent days — fetch the full grid span.
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addCalendarDays(monthStart, -monthStart.getDay());
  const gridEnd = addCalendarDays(gridStart, 42);
  return {
    from: toCalendarISO(gridStart),
    to: toCalendarISO(gridEnd),
  };
}

/**
 * Loads public community.post events for the visible calendar range.
 */
export function useCalendarEvents(): {
  events: CommunityCalendarEvent[];
  loading: boolean;
  error: string | null;
  eventsByDay: Map<string, CommunityCalendarEvent[]>;
  eventsForAnchor: CommunityCalendarEvent[];
} {
  const { view, anchorISO } = useCalendarViewState();
  const range = useMemo(() => rangeForView(view, anchorISO), [view, anchorISO]);
  const [events, setEvents] = useState<CommunityCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void fetchCommunityCalendarEvents(range.from, range.to, ac.signal)
      .then((items) => {
        if (ac.signal.aborted) return;
        setEvents(items);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setEvents([]);
        setError(e instanceof Error ? e.message : 'Failed to load events');
        setLoading(false);
      });
    return () => ac.abort();
  }, [range.from, range.to]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CommunityCalendarEvent[]>();
    for (const event of events) {
      const day = toCalendarISO(new Date(event.starts_at));
      const list = map.get(day);
      if (list) list.push(event);
      else map.set(day, [event]);
    }
    return map;
  }, [events]);

  const eventsForAnchor = eventsByDay.get(anchorISO) ?? [];

  return { events, loading, error, eventsByDay, eventsForAnchor };
}
