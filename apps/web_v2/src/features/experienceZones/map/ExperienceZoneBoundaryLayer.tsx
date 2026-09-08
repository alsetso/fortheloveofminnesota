'use client';

/**
 * Draws experience zone polygon(s) on the game map:
 *   - Approaching: nearest primary zones within approach radius (preview)
 *   - Inside: covering membership zones
 *   - Exploring: outline only — purple fill cleared
 */

import { useEffect, useRef } from 'react';
import type { MultiPolygon, Polygon } from 'geojson';
import { useCurrentExperienceZone } from '@/features/experienceZones/store/currentExperienceZoneStore';
import { useNearbyExperienceZone } from '@/features/experienceZones/store/nearbyExperienceZoneStore';
import { useVenueMode } from '@/features/experienceZones/store/venueModeStore';
import type { ExperienceZoneAtPointItem } from '@/lib/experienceZones/experienceZoneTypes';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import { useMapContext } from '@/map/MapProvider';
import {
  clearExperienceZoneBoundary,
  ensureExperienceZoneLayers,
  removeExperienceZoneLayers,
  setExperienceZoneFillVisible,
  syncExperienceZoneBoundaryData,
  type ExperienceZoneBoundaryFeature,
} from './ensureExperienceZoneLayers';

type ZoneGeometryResponse = {
  zone?: {
    id: string;
    slug: string;
    name: string;
    geometry: Polygon | MultiPolygon | null;
  };
};

const geometryCache = new Map<string, ExperienceZoneBoundaryFeature>();

function isPolygonGeometry(
  value: unknown,
): value is Polygon | MultiPolygon {
  if (!value || typeof value !== 'object') return false;
  const g = value as { type?: string; coordinates?: unknown };
  return (
    (g.type === 'Polygon' || g.type === 'MultiPolygon') &&
    Array.isArray(g.coordinates)
  );
}

function featureFromParts(parts: {
  id: string;
  slug: string;
  name: string;
  geometry: Polygon | MultiPolygon;
}): ExperienceZoneBoundaryFeature {
  const feature: ExperienceZoneBoundaryFeature = {
    type: 'Feature',
    id: parts.id,
    properties: {
      id: parts.id,
      slug: parts.slug,
      name: parts.name,
    },
    geometry: parts.geometry,
  };
  geometryCache.set(parts.id, feature);
  return feature;
}

async function fetchZoneFeature(
  zone: ExperienceZoneAtPointItem,
  signal: AbortSignal,
): Promise<ExperienceZoneBoundaryFeature | null> {
  const cached = geometryCache.get(zone.id);
  if (cached) return cached;

  const res = await fetch(`/api/experience-zones/${zone.id}`, {
    cache: 'force-cache',
    signal,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as ZoneGeometryResponse;
  const geometry = json.zone?.geometry;
  if (!isPolygonGeometry(geometry)) return null;

  return featureFromParts({
    id: zone.id,
    slug: zone.slug,
    name: zone.name,
    geometry,
  });
}

export function ExperienceZoneBoundaryLayer() {
  const { map, ready } = useMapContext();
  const { zones, zoneKey } = useCurrentExperienceZone();
  const { zones: nearZones, zoneKey: nearKey } = useNearbyExperienceZone();
  const { exploring } = useVenueMode();
  const zonesRef = useRef(zones);
  const nearRef = useRef(nearZones);
  const exploringRef = useRef(exploring);
  zonesRef.current = zones;
  nearRef.current = nearZones;
  exploringRef.current = exploring;
  const lastPaintKeyRef = useRef<string | null>(null);

  const paintKey = `${zoneKey ?? ''}|${nearKey ?? ''}|${exploring ? '1' : '0'}`;

  useEffect(() => {
    if (!map || !ready) return;

    let cancelled = false;
    const ac = new AbortController();

    const paint = async () => {
      await waitForMapStyleReady(map, { timeoutMs: 10_000 });
      if (cancelled || ac.signal.aborted) return;
      ensureExperienceZoneLayers(map);

      const inside = zonesRef.current;
      const near = nearRef.current;
      const isExploring = exploringRef.current;

      // Membership wins over approach preview.
      if (inside.length > 0) {
        const features = (
          await Promise.all(inside.map((z) => fetchZoneFeature(z, ac.signal)))
        ).filter((f): f is ExperienceZoneBoundaryFeature => Boolean(f));
        if (cancelled || ac.signal.aborted) return;
        syncExperienceZoneBoundaryData(map, features);
        setExperienceZoneFillVisible(map, !isExploring);
        return;
      }

      if (near.length > 0) {
        const features = near
          .map((z) => {
            if (!isPolygonGeometry(z.geometry)) return null;
            return featureFromParts({
              id: z.id,
              slug: z.slug,
              name: z.name,
              geometry: z.geometry,
            });
          })
          .filter((f): f is ExperienceZoneBoundaryFeature => Boolean(f));
        if (cancelled || ac.signal.aborted) return;
        syncExperienceZoneBoundaryData(map, features);
        setExperienceZoneFillVisible(map, true);
        return;
      }

      clearExperienceZoneBoundary(map);
    };

    const onStyleLoad = () => {
      lastPaintKeyRef.current = null;
      void paint();
    };

    void paint();
    lastPaintKeyRef.current = paintKey;
    map.on('style.load', onStyleLoad);

    return () => {
      cancelled = true;
      ac.abort();
      map.off('style.load', onStyleLoad);
      removeExperienceZoneLayers(map);
    };
    // Initial mount + style reload only — membership/near handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready]);

  useEffect(() => {
    if (!map || !ready) return;
    if (paintKey === lastPaintKeyRef.current) return;
    lastPaintKeyRef.current = paintKey;

    const ac = new AbortController();
    void (async () => {
      try {
        await waitForMapStyleReady(map, { timeoutMs: 10_000 });
        if (ac.signal.aborted) return;
        ensureExperienceZoneLayers(map);

        if (zones.length > 0) {
          const features = (
            await Promise.all(zones.map((z) => fetchZoneFeature(z, ac.signal)))
          ).filter((f): f is ExperienceZoneBoundaryFeature => Boolean(f));
          if (ac.signal.aborted) return;
          syncExperienceZoneBoundaryData(map, features);
          setExperienceZoneFillVisible(map, !exploring);
          return;
        }

        if (nearZones.length > 0) {
          const features = nearZones
            .map((z) => {
              if (!isPolygonGeometry(z.geometry)) return null;
              return featureFromParts({
                id: z.id,
                slug: z.slug,
                name: z.name,
                geometry: z.geometry,
              });
            })
            .filter((f): f is ExperienceZoneBoundaryFeature => Boolean(f));
          if (ac.signal.aborted) return;
          syncExperienceZoneBoundaryData(map, features);
          setExperienceZoneFillVisible(map, true);
          return;
        }

        clearExperienceZoneBoundary(map);
      } catch {
        /* aborted / network */
      }
    })();

    return () => {
      ac.abort();
    };
  }, [map, ready, zones, nearZones, exploring, paintKey]);

  return null;
}
