import type { FeatureCollection, Point } from 'geojson';
import type { NearbyPlaceHit } from '@/lib/geo/nearby/nearbyPlacesTypes';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Push nearby POI hits onto the ephemeral map overlay. */
export function setNearbyPlacesOverlay(
  places: NearbyPlaceHit[],
  selectedPlaceId: string | null = null,
): void {
  if (places.length === 0) {
    clearNearbyPlacesOverlay();
    return;
  }

  const fc: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: places.map((place) => ({
      type: 'Feature',
      properties: {
        id: place.id,
        name: place.name,
        category: place.category,
        selected: place.id === selectedPlaceId,
      },
      geometry: {
        type: 'Point',
        coordinates: [place.lng, place.lat],
      },
    })),
  };

  mapDataStore.set(MAP_SOURCE_IDS.nearby, fc);
}

export function clearNearbyPlacesOverlay(): void {
  mapDataStore.set(MAP_SOURCE_IDS.nearby, EMPTY);
}
