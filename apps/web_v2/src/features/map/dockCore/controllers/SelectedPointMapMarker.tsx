'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useMapContext } from '@/map/MapProvider';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import { useSelectedPointCoords } from '@/map/location/camera/useSelectedPointCoords';
import {
  clearSelectedPointCircle,
  removeSelectedPointCircleLayers,
  restoreSelectedPointCircle,
  syncSelectedPointCircle,
} from '@/map/points/selectedPointCircleLayer';
import {
  clearSelectedPinBeacon,
  BLUE_BEACON_MODEL_ID,
  GREEN_BEACON_MODEL_ID,
  GREY_BEACON_MODEL_ID,
  removeSelectedPinBeaconLayers,
  restoreSelectedPinBeacon,
  SELECTED_BEACON_MODEL_ID,
  switchSelectedBeaconModel,
  syncSelectedPinBeacon,
} from '@/map/points/selectedPinBeaconLayer';
import {
  getSelectedPinMode,
  subscribeSelectedPinMode,
} from '@/map/points/selectedPinModeStore';

/**
 * Keeps the selected-point indicator on the map while coords are active.
 *
 * Primary:  red pulse beacon GLB (`map-pin-selected.glb`) via a Mapbox model layer.
 * Fallback: 2D circle layer — used when the model layer is unavailable
 *           (older Mapbox build or non-Standard style that doesn't support model layers).
 */
export function SelectedPointMapMarker() {
  const { map, ready } = useMapContext();
  const { coords } = useSelectedPointCoords();
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  // Track save-pending mode so the pin colour reflects the user's intent immediately.
  const pinMode = useSyncExternalStore(
    subscribeSelectedPinMode,
    getSelectedPinMode,
    () => 'default' as const,
  );

  // Swap the beacon model based on pin mode:
  //   grey  → save-pending / saved (address contact)
  //   blue  → post-composing / posted (community post)
  //   green → page-composing (Create a Page)
  //   red   → default
  useEffect(() => {
    if (!map || !ready) return;
    let modelId: typeof SELECTED_BEACON_MODEL_ID | typeof GREY_BEACON_MODEL_ID | typeof BLUE_BEACON_MODEL_ID | typeof GREEN_BEACON_MODEL_ID;
    if (pinMode === 'save-pending' || pinMode === 'saved') {
      modelId = GREY_BEACON_MODEL_ID;
    } else if (pinMode === 'post-composing' || pinMode === 'posted') {
      modelId = BLUE_BEACON_MODEL_ID;
    } else if (pinMode === 'page-composing') {
      modelId = GREEN_BEACON_MODEL_ID;
    } else {
      modelId = SELECTED_BEACON_MODEL_ID;
    }
    switchSelectedBeaconModel(map, modelId);
  }, [map, ready, pinMode]);

  // Paint whenever coords change — do not clear in cleanup (that would flash it away).
  useEffect(() => {
    if (!map || !ready) return;
    let cancelled = false;

    void (async () => {
      try {
        await waitForMapStyleReady(map, { timeoutMs: 8_000 });
      } catch {
        return;
      }
      if (cancelled) return;

      const beaconOk = syncSelectedPinBeacon(map, coordsRef.current);

      // Show the legacy circle only when the 3D beacon isn't available.
      if (!beaconOk) {
        syncSelectedPointCircle(map, coordsRef.current);
      } else {
        clearSelectedPointCircle(map);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map, ready, coords]);

  // Style swaps wipe custom layers — restore whichever visual was active.
  useEffect(() => {
    if (!map || !ready) return;

    const onStyle = () => {
      void waitForMapStyleReady(map, { timeoutMs: 8_000 })
        .then(() => {
          const beaconOk = syncSelectedPinBeacon(map, coordsRef.current);
          if (!beaconOk) restoreSelectedPointCircle(map);
          else clearSelectedPointCircle(map);
        })
        .catch(() => {});
    };

    map.on('style.load', onStyle);
    return () => {
      map.off('style.load', onStyle);
    };
  }, [map, ready]);

  // Unmount / map swap only.
  useEffect(() => {
    return () => {
      if (!map) return;
      clearSelectedPinBeacon(map);
      removeSelectedPinBeaconLayers(map);
      clearSelectedPointCircle(map);
      removeSelectedPointCircleLayers(map);
    };
  }, [map]);

  return null;
}
