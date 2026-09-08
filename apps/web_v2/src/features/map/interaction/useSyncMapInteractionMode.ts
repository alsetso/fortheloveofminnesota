'use client';

import { useEffect } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { hasActiveBoundaryPaint } from '@/features/map/interaction/boundaryPaint';
import { setMapInteractionMode } from '@/features/map/interaction/mapInteractionMode';
import { resolveMapInteractionMode } from '@/features/map/interaction/resolveMapInteractionMode';
import { useTerritoriesAroundMe, useTerritoryLayers } from '@/features/map/territory';
import { useFindMe } from '@/map/location/camera/useFindMe';

/**
 * Derives map interaction mode from ownership — never set mode ad hoc in features.
 *
 * Priority: compose → route → locate → mentions → explore (boundaries) → free.
 * Boundary paint alone forces `explore` (miss ignored) until layers are off or
 * compose explicitly owns the map.
 */
export function useSyncMapInteractionMode(): void {
  const { pane, dockCard, mode: dockMode, createPostSheet } = useMapDock();
  const {
    activeSlugs,
    countyOverlays,
    districtSchools,
    schoolsLayer,
    districtParts,
  } = useTerritoryLayers();
  const { phase } = useFindMe();
  const { on: territoriesAroundMeOn } = useTerritoriesAroundMe();

  // Territories around me is boundary paint too — it must force `explore`
  // (miss ignored) so taps in gaps don't drop a selected point onto the layer.
  const boundariesOn =
    hasActiveBoundaryPaint({
      activeSlugs,
      countyId: countyOverlays.countyId,
      citiesOn: countyOverlays.citiesOn,
      townsOn: countyOverlays.townsOn,
      countySchoolDistrictsOn: countyOverlays.schoolDistrictsOn,
      schoolsOn: districtSchools.schoolsOn || schoolsLayer.on,
      districtPartsOn: districtParts.partsOn,
    }) || territoriesAroundMeOn;
  const findMeSharing = phase === 'active' || phase === 'finding';

  useEffect(() => {
    const next = resolveMapInteractionMode({
      dockMode,
      createPostOpen: createPostSheet != null,
      paneId: pane.id,
      dockCard,
      boundariesOn,
      findMeSharing,
    });
    setMapInteractionMode(next);
  }, [dockMode, pane.id, dockCard, createPostSheet, boundariesOn, findMeSharing]);
}
