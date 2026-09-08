'use client';

import { useEffect } from 'react';
import { refreshCommunityPins } from '@/features/map/community/communityPinsStore';
import { useMapTimeFilter } from '@/features/map/dockCore/hooks/useMapTimeFilter';
import { useMapContext } from '@/map/MapProvider';

/**
 * Fetches public community pins → `mapDataStore` (MAP_SOURCE_IDS.pins).
 * Waits for map `ready` so the first setData lands after the engine exists,
 * then re-fetches when the time filter changes.
 */
export function CommunityPinsProvider({ children }: { children: React.ReactNode }) {
  const { ready } = useMapContext();
  const { value: time } = useMapTimeFilter();

  useEffect(() => {
    if (!ready) return;
    const ac = new AbortController();
    void refreshCommunityPins(time, ac.signal);
    return () => ac.abort();
  }, [ready, time]);

  return <>{children}</>;
}
