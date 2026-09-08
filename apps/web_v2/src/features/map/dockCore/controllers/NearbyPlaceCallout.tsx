'use client';

import { useEffect, useState } from 'react';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { nearbyPlaceCategoryChip } from '@/lib/geo/nearbyPlaceCategoryEmoji';
import { useNearbyPlaces } from '@/lib/geo/nearby/nearbyPlacesStore';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';
import { useMapContext } from '@/map';

type CalloutPosition = { x: number; y: number } | null;

/**
 * Small popover pinned above the selected nearby-place pin — follows the
 * pin through pan/zoom/fly (map `move`) while a place is selected.
 * Tapping it opens the same Airbnb-style listing as the pin / carousel card.
 */
export function NearbyPlaceCallout() {
  const { map, ready } = useMapContext();
  const { places, selectedPlaceId } = useNearbyPlaces();
  const place = places.find((p) => p.id === selectedPlaceId) ?? null;
  const [pos, setPos] = useState<CalloutPosition>(null);

  useEffect(() => {
    if (!map || !ready || !place) {
      setPos(null);
      return;
    }

    const update = () => {
      const point = map.project([place.lng, place.lat]);
      const rect = map.getContainer().getBoundingClientRect();
      setPos({ x: rect.left + point.x, y: rect.top + point.y });
    };

    update();
    map.on('move', update);
    return () => {
      map.off('move', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on primitives so a stable place object doesn't re-subscribe
  }, [map, ready, place?.id, place?.lng, place?.lat]);

  if (!place || !pos) return null;

  const chip = nearbyPlaceCategoryChip(place.category);

  return (
    <div
      className={`pointer-events-none fixed ${Z_LAYER_CLASS.CALLOUT} max-w-[min(200px,68vw)] -translate-x-1/2 -translate-y-[calc(100%+14px)]`}
      style={{ left: pos.x, top: pos.y }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-md ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <span aria-hidden className="text-[13px]">
          {chip.emoji}
        </span>
        <p className="truncate text-[12px] font-semibold tracking-tight text-foreground">
          {place.name}
        </p>
      </div>
      <span
        aria-hidden
        className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-map-glass bg-map-glass"
      />
    </div>
  );
}
