'use client';

import { useEffect, useState } from 'react';
import { msUntilNextMinute } from '@/features/calendar/calendar';

/**
 * Device clock, re-read on the minute boundary and on tab focus.
 * Null until mounted so SSR never prints the datacentre's "now".
 */
export function useClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer = 0;

    const tick = () => {
      const current = new Date();
      setNow(current);
      timer = window.setTimeout(tick, msUntilNextMinute(current));
    };
    tick();

    const resync = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener('visibilitychange', resync);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resync);
    };
  }, []);

  return now;
}
