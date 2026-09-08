'use client';

/**
 * Venue presence glue — when Find Me enters / leaves an experience zone.
 * Does NOT start Explore Zone (user must opt in via the yes/no prompt).
 * Leaving a zone clears explore mode via setVenueZone.
 *
 * Zone hierarchy:
 *   primaryZone — parent/primary zone (drives all data + control)
 *   subZone     — specific sub-zone the user is standing in (positional only)
 */

import { useEffect, useRef } from 'react';
import { setVenueZone } from '@/features/experienceZones/store/venueModeStore';
import { useCurrentExperienceZone } from '@/features/experienceZones/store/currentExperienceZoneStore';
import { triggerWorldRefresh } from '@/features/map/game/world/worldRefreshSignal';
import { haptic } from '@/lib/despia/haptics';
import { objectRadarActions } from '@/features/map/game/objectRadar/objectRadarStore';

export function ExperienceZoneVenueController() {
  const { primaryZone, subZone } = useCurrentExperienceZone();
  const lastZoneIdRef = useRef<string | null>(null);

  useEffect(() => {
    const zoneId = primaryZone?.id ?? null;
    const prev = lastZoneIdRef.current;

    setVenueZone({
      zoneId,
      zoneSlug: primaryZone?.slug ?? null,
      zoneName: primaryZone?.name ?? null,
      subZoneId: subZone?.id ?? null,
      subZoneName: subZone?.name ?? null,
      allowContributions: primaryZone?.allow_contributions ?? true,
      visibility: primaryZone?.visibility ?? null,
    });

    if (zoneId && zoneId !== prev) {
      haptic.findMe.success();
    } else if (!zoneId && prev) {
      objectRadarActions.closeSheet();
      triggerWorldRefresh();
    }

    lastZoneIdRef.current = zoneId;
  }, [
    primaryZone?.id,
    primaryZone?.slug,
    primaryZone?.name,
    primaryZone?.allow_contributions,
    primaryZone?.visibility,
    subZone?.id,
    subZone?.name,
  ]);

  return null;
}
