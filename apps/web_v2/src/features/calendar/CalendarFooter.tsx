'use client';

import {
  isSameCalendarDay,
  parseCalendarISO,
} from '@/features/calendar/calendar';
import {
  anchorCalendarToday,
  setCalendarView,
  useCalendarViewState,
  type CalendarView,
} from '@/features/calendar/viewStore';
import { useClock } from '@/features/calendar/useClock';

const VIEWS: ReadonlyArray<{ id: CalendarView; label: string }> = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
];

export function CalendarFooter() {
  const now = useClock();
  const { anchorISO, view } = useCalendarViewState();
  const onToday = !now || isSameCalendarDay(parseCalendarISO(anchorISO), now);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={anchorCalendarToday}
        disabled={onToday}
        className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold text-foreground transition active:bg-black/[0.06] disabled:text-foreground-muted/40 disabled:active:bg-transparent"
      >
        Today
      </button>
      <div className="ml-auto flex shrink-0 gap-0.5 rounded-full bg-black/[0.06] p-0.5">
        {VIEWS.map((option) => {
          const active = option.id === view;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setCalendarView(option.id)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-[13px] font-semibold transition ${
                active
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-foreground-muted'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
