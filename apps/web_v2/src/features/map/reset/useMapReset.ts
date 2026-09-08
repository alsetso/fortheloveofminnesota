'use client';

import { useCallback } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  clearMapToolPaint,
  clearPointJurisdictionPaint,
  clearRouteSession,
  clearSelectedPointSession,
  clearTerritorySelectionHighlight,
} from '@/features/map/reset/mapClearSessions';
import { useTerritoryLayers } from '@/features/map/territory';

export type MapResetSnap = 'collapsed' | 'half';

/**
 * Composed clear / reset — end-states back to default free map.
 *
 * Levels:
 * - clearMapPaint     — boundaries + selection + point jurisdictions
 * - clearMapTools     — route + selected point + point jurisdictions
 * - resetMapToFree    — paint + tools + overlays + dock → browse + snap
 *
 * Follow Me / locked frame stays on — only explicit stopFindMe unlocks.
 * Never sets interaction mode directly; clearing ownership lets sync land on `free`.
 */
export function useMapReset() {
  const { clearAllBoundaryPaint } = useTerritoryLayers();
  const {
    openBrowse,
    collapse,
    closeDockCard,
    closeCreatePostSheet,
    closeContactsSheet,
    selectEntity,
    resetToBrowse,
  } = useMapDock();

  const clearMapPaint = useCallback(() => {
    clearAllBoundaryPaint();
    clearTerritorySelectionHighlight();
    clearPointJurisdictionPaint();
  }, [clearAllBoundaryPaint]);

  const clearMapTools = useCallback(() => {
    clearRouteSession();
    clearSelectedPointSession();
    clearPointJurisdictionPaint();
  }, []);

  const closeMapOverlays = useCallback(() => {
    closeDockCard();
    closeCreatePostSheet();
    closeContactsSheet();
  }, [closeDockCard, closeCreatePostSheet, closeContactsSheet]);

  const resetMapToFree = useCallback(
    (opts?: { snap?: MapResetSnap }) => {
      clearMapPaint();
      clearMapTools();
      clearMapToolPaint();
      closeMapOverlays();
      selectEntity(null);
      resetToBrowse();
      if (opts?.snap === 'half') {
        openBrowse();
      } else {
        collapse();
      }
    },
    [
      clearMapPaint,
      clearMapTools,
      closeMapOverlays,
      selectEntity,
      resetToBrowse,
      openBrowse,
      collapse,
    ],
  );

  return {
    clearAllBoundaryPaint,
    clearMapPaint,
    clearMapTools,
    closeMapOverlays,
    clearSelectedPointSession,
    clearRouteSession,
    resetMapToFree,
  };
}
