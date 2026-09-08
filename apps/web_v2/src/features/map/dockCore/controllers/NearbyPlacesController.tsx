'use client';

import { useEffect, useRef } from 'react';
import { fetchNearbyPlaces } from '@/lib/geo/fetch/fetchNearbyPlaces';
import {
  clearNearbyPlacesSession,
  setNearbyPlacesResult,
  useNearbyPlaces,
} from '@/lib/geo/nearby/nearbyPlacesStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import { useFindMeCoordsPassive } from '@/map/location/camera/useFindMeCoords';

function coordsKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/**
 * What's nearby — persistent layer service (mounted once in the shell).
 * Uses live Find Me lookup when available, else last-known fix (Explore ambient).
 */
export function NearbyPlacesController() {
  const { on, coords: cachedCoords, places } = useNearbyPlaces();
  const { lookupCoords, coords: liveCoords } = useFindMeCoordsPassive();
  const fetchGen = useRef(0);

  const point = lookupCoords ?? liveCoords ?? (on ? getFindMeLastCoords() : null);

  useEffect(() => {
    if (!on) return;
    if (!point) return;

    const key = coordsKey(point.lat, point.lng);
    const cachedKey =
      cachedCoords != null
        ? coordsKey(cachedCoords.lat, cachedCoords.lng)
        : null;

    if (cachedKey === key && places.length >= 10) {
      setNearbyPlacesResult({
        coords: point,
        places,
        loading: false,
        error: null,
      });
      return;
    }

    const gen = ++fetchGen.current;
    setNearbyPlacesResult({
      coords: point,
      places: cachedKey === key ? places : [],
      loading: true,
      error: null,
    });

    const ac = new AbortController();
    void (async () => {
      try {
        const next = await fetchNearbyPlaces(point.lat, point.lng, 60, ac.signal);
        if (ac.signal.aborted || fetchGen.current !== gen) return;
        setNearbyPlacesResult({
          coords: point,
          places: next,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (ac.signal.aborted || fetchGen.current !== gen) return;
        setNearbyPlacesResult({
          coords: point,
          places: [],
          loading: false,
          error:
            err instanceof Error ? err.message : 'Couldn’t load nearby places',
        });
      }
    })();

    return () => {
      ac.abort();
    };
  }, [on, point?.lat, point?.lng]);

  // Nearby toggled off — drop session.
  useEffect(() => {
    if (!on) clearNearbyPlacesSession();
  }, [on]);

  return null;
}
