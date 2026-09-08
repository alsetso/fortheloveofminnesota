'use client';

/** Fetches a territory unit boundary and paints it on a Discover card map. */

import { useEffect, useState } from 'react';
import type { MultiPolygon, Polygon } from 'geojson';
import {
  DISCOVER_MAP_BEIGE,
  DISCOVER_MAP_TERRITORY,
} from '@/features/discover/beigeDiscoverMapStyle';
import { DiscoverBoundaryCardMap } from '@/features/discover/DiscoverBoundaryCardMap';

function isPolygonGeometry(value: unknown): value is Polygon | MultiPolygon {
  if (!value || typeof value !== 'object') return false;
  const g = value as { type?: string };
  return g.type === 'Polygon' || g.type === 'MultiPolygon';
}

export function DiscoverTerritoryCardMap({
  unitId,
  name,
}: {
  unitId: string;
  name: string;
}) {
  const [geometry, setGeometry] = useState<Polygon | MultiPolygon | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const ac = new AbortController();
    setGeometry(undefined);
    void (async () => {
      try {
        const res = await fetch(`/api/place/${encodeURIComponent(unitId)}`, {
          signal: ac.signal,
          credentials: 'include',
          cache: 'force-cache',
        });
        if (!res.ok) {
          if (!ac.signal.aborted) setGeometry(null);
          return;
        }
        const body = (await res.json()) as { geometry?: unknown };
        if (ac.signal.aborted) return;
        setGeometry(isPolygonGeometry(body.geometry) ? body.geometry : null);
      } catch {
        if (!ac.signal.aborted) setGeometry(null);
      }
    })();
    return () => ac.abort();
  }, [unitId]);

  if (geometry === undefined) {
    return (
      <div
        className="pointer-events-none h-full w-full"
        style={{ backgroundColor: DISCOVER_MAP_BEIGE }}
        aria-hidden
      />
    );
  }

  if (!geometry) {
    return (
      <div
        className="pointer-events-none flex h-full w-full items-center justify-center"
        style={{ backgroundColor: DISCOVER_MAP_BEIGE }}
        aria-hidden
      />
    );
  }

  return (
    <DiscoverBoundaryCardMap
      featureId={unitId}
      name={name}
      geometry={geometry}
      fillColor={DISCOVER_MAP_TERRITORY}
      lineColor={DISCOVER_MAP_TERRITORY}
      fillOpacity={0.36}
    />
  );
}
