'use client';

/**
 * /calendar — Discover-style browse surface for community.post events.
 */

import { PageScroll } from '@/features/appShell/PageScroll';
import { TopBar } from '@/features/appShell/TopBar';
import { CalendarCard } from '@/features/calendar/CalendarCard';
import { CalendarFooter } from '@/features/calendar/CalendarFooter';
import { CalendarHeader } from '@/features/calendar/CalendarHeader';

export default function CalendarPage() {
  return (
    <PageScroll>
      <TopBar
        title="Calendar"
        below={
          <div className="px-4 pb-2.5 pt-1">
            <CalendarHeader />
          </div>
        }
      />

      <div className="px-4 pb-4 pt-2">
        <CalendarCard />
      </div>

      <div className="sticky bottom-0 z-[1] border-t border-black/[0.08] bg-[#f7f5f1]/95 px-4 py-3 backdrop-blur-xl">
        <CalendarFooter />
      </div>
    </PageScroll>
  );
}
