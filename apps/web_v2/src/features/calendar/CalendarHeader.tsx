'use client';

import type { ReactNode } from 'react';
import { IconChevron } from '@/features/map/dockCore/core/icons';
import {
  formatCalendarDayTitle,
  formatCalendarFullDate,
  formatCalendarMonth,
  formatCalendarTime,
  formatCalendarWeekRange,
  parseCalendarISO,
} from '@/features/calendar/calendar';
import {
  stepCalendar,
  useCalendarViewState,
  type CalendarView,
} from '@/features/calendar/viewStore';
import { useClock } from '@/features/calendar/useClock';

const UNIT: Record<CalendarView, string> = {
  month: 'month',
  week: 'week',
  day: 'day',
};

export function CalendarHeader() {
  const now = useClock();
  const { anchorISO, view } = useCalendarViewState();

  const anchor = parseCalendarISO(anchorISO);
  const referenceYear = (now ?? anchor).getFullYear();
  const title =
    view === 'month'
      ? formatCalendarMonth(anchor)
      : view === 'week'
        ? formatCalendarWeekRange(anchor, referenceYear)
        : formatCalendarDayTitle(anchor, referenceYear);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-tight text-foreground">
          {title}
        </p>
        <p className="truncate text-[12px] leading-tight text-foreground-muted">
          {now ? `${formatCalendarFullDate(now)} · ${formatCalendarTime(now)}` : '\u00a0'}
        </p>
      </div>
      <HeaderArrow label={`Previous ${UNIT[view]}`} onClick={() => stepCalendar(-1)}>
        <IconChevron className="h-4 w-4 rotate-90" />
      </HeaderArrow>
      <HeaderArrow label={`Next ${UNIT[view]}`} onClick={() => stepCalendar(1)}>
        <IconChevron className="h-4 w-4 -rotate-90" />
      </HeaderArrow>
    </div>
  );
}

function HeaderArrow({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-full p-1.5 text-foreground-muted transition active:bg-black/[0.06] active:text-foreground"
    >
      {children}
    </button>
  );
}
