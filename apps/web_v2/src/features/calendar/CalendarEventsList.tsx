'use client';

import Link from 'next/link';
import type { CommunityCalendarEvent } from '@/features/calendar/calendarEventsApi';
import { CALENDAR_ACCENT, formatCalendarTime } from '@/features/calendar/calendar';
import { postPath } from '@/lib/routes/routePolicy';

export function CalendarEventsList({
  events,
  loading,
  error,
  emptyLabel = 'No community events this day.',
}: {
  events: CommunityCalendarEvent[];
  loading: boolean;
  error: string | null;
  emptyLabel?: string;
}) {
  if (loading && events.length === 0) {
    return (
      <div className="mt-4 space-y-2 border-t border-black/[0.08] pt-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-black/[0.05]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="mt-4 border-t border-black/[0.08] pt-3 text-[13px] text-foreground-muted">
        {error}
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-black/[0.08] pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">
        Events
      </p>
      {events.length === 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-foreground-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {events.map((event) => {
            const start = new Date(event.starts_at);
            return (
              <li key={event.id}>
                <Link
                  href={postPath(event.id)}
                  className="flex items-start gap-3 rounded-2xl bg-black/[0.04] px-3 py-2.5 transition active:bg-black/[0.07]"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: CALENDAR_ACCENT }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {event.emoji ? `${event.emoji} ` : ''}
                      {event.title}
                    </p>
                    <p className="truncate text-[12px] text-foreground-muted">
                      {formatCalendarTime(start)}
                      {event.place_label ? ` · ${event.place_label}` : ''}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
