'use client';

import { useEffect, useState } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { fetchReverseGeocode } from '@/lib/geo/fetch/fetchReverseGeocode';
import { nearbyPlaceCategoryChip } from '@/lib/geo/nearbyPlaceCategoryEmoji';
import { useNearbyPlaces } from '@/lib/geo/nearby/nearbyPlacesStore';

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '';
  if (meters < 160) return `${Math.max(1, Math.round(meters * 3.281))} ft away`;
  const mi = meters / 1609.34;
  return mi < 10 ? `${mi.toFixed(1)} mi away` : `${Math.round(mi)} mi away`;
}

/**
 * Airbnb / real-estate style listing for a single What's nearby place.
 * Opened from the carousel or a map pin tap — never Selected Point.
 */
export default function NearbyPlaceDockCard() {
  const { closeDockCard } = useMapDock();
  const { places, selectedPlaceId } = useNearbyPlaces();
  const place = places.find((p) => p.id === selectedPlaceId) ?? null;

  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  useEffect(() => {
    if (!place) {
      setAddress(null);
      return;
    }
    let cancelled = false;
    setAddressLoading(true);
    void fetchReverseGeocode(place.lat, place.lng)
      .then((next) => {
        if (!cancelled) setAddress(next);
      })
      .catch(() => {
        if (!cancelled) setAddress(null);
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on id so a stable place object doesn't re-fetch
  }, [place?.id]);

  if (!place) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] text-foreground-muted">No place selected.</p>
      </div>
    );
  }

  const chip = nearbyPlaceCategoryChip(place.category);
  const distance = formatDistance(place.distanceM);

  return (
    <DockCardShell
      variant="entity"
      titleMode="center"
      eyebrow="What's nearby"
      title="Listing"
    >
      <div
        className={`overflow-hidden rounded-[1.35rem] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-map-ink-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={place.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="space-y-2 px-4 pb-4 pt-3.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 text-[1.1rem] font-semibold leading-tight tracking-tight text-foreground">
                {place.name}
              </h3>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-foreground ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
              >
                <span aria-hidden>{chip.emoji}</span>
                {chip.label}
              </span>
            </div>
            <p className="text-[13px] leading-snug text-foreground-muted">
              {addressLoading && !address
                ? 'Locating…'
                : (address ?? `${place.lat.toFixed(5)}°, ${place.lng.toFixed(5)}°`)}
              {distance ? ` · ${distance}` : ''}
            </p>
          </div>
        </div>

      <button
        type="button"
        onClick={closeDockCard}
        className={`inline-flex w-full items-center justify-center rounded-2xl px-3 py-3.5 text-[15px] font-semibold text-foreground transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        Close
      </button>
    </DockCardShell>
  );
}
