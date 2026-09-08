'use client';

import { useEffect, useRef } from 'react';
import type { Feature, Geometry } from 'geojson';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import {
  clearTerritoryCameraLock,
  findTerritoryFeature,
  focusTerritoryCameraOnFeature,
} from '@/features/map/territory/focusTerritoryCamera';
import {
  clearTerritorySelection,
  showTerritorySelection,
  type SelectionKind,
} from '@/features/map/territory/territorySelection';
import { MAP_CONFIG } from '@/map/config';
import { mapDataStore, MAP_SOURCE_IDS, useMapContext } from '@/map';
import { getCtuFloorZoom } from './ctuFloorZoomStore';

/** Point / site features — keep framing neighborhood-scale. */
const MAX_ZOOM_BY_KIND: Partial<Record<SelectionKind | 'atlas', number>> = {
  school: 17,
  ctu: 13,
  district_part: 12,
  atlas: 16,
};

function isSelectionKind(kind: DockEntity['kind']): kind is SelectionKind {
  return (
    kind === 'county' ||
    kind === 'ctu' ||
    kind === 'school_district' ||
    kind === 'school' ||
    kind === 'district' ||
    kind === 'district_part' ||
    kind === 'senate_district' ||
    kind === 'house_district'
  );
}

function focusKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

function selectionFeature(id: string): Feature<Geometry> | null {
  const fc = mapDataStore.get(MAP_SOURCE_IDS.selection);
  const match = fc.features.find((f) => {
    const fid = f.id ?? f.properties?.id;
    return fid != null && String(fid) === id;
  });
  return (match as Feature<Geometry> | undefined) ?? null;
}

function atlasFeature(id: string): Feature<Geometry> | null {
  return findTerritoryFeature(MAP_SOURCE_IDS.atlasFeatures, id);
}

/**
 * When territory / atlas details open: paint the boundary (territories only),
 * fit the camera, and lock minZoom to a loose fit of that shape.
 * Explore uses `EXPLORE_MAP_CONFIG.MIN_ZOOM` so selection never re-locks Game's 18.
 */
export function useTerritoryFocusCamera(): void {
  const { map, ready } = useMapContext();
  const { pane } = useMapDock();
  // CTU floor zoom is the baseline when no territory is selected.
  // Falls back to MAP_CONFIG.MIN_ZOOM before the CTU has been resolved.
  const floorMinZoom = getCtuFloorZoom() ?? MAP_CONFIG.MIN_ZOOM;

  const focusedKeyRef = useRef<string | null>(null);
  const lockedRef = useRef(false);
  const generationRef = useRef(0);
  const floorMinZoomRef = useRef(floorMinZoom);
  floorMinZoomRef.current = floorMinZoom;

  const target =
    pane.id === 'details' && isSelectionKind(pane.entity.kind)
      ? { kind: pane.entity.kind, id: pane.entity.id, mode: 'territory' as const }
      : pane.id === 'details' && pane.entity.kind === 'atlas'
        ? { kind: 'atlas' as const, id: pane.entity.id, mode: 'atlas' as const }
        : null;

  useEffect(() => {
    if (!map || !ready) return;

    if (!target) {
      generationRef.current += 1;
      map.stop();
      clearTerritorySelection();
      if (lockedRef.current) {
        clearTerritoryCameraLock(map, floorMinZoomRef.current);
        lockedRef.current = false;
      }
      focusedKeyRef.current = null;
      return;
    }

    const key = focusKey(target.kind, target.id);
    if (focusedKeyRef.current === key) return;

    const previousKey = focusedKeyRef.current;
    const reposition = previousKey != null && previousKey !== key;
    const generation = ++generationRef.current;
    let cancelled = false;
    const ac = new AbortController();

    const run = async () => {
      if (target.mode === 'territory') {
        try {
          await showTerritorySelection(target.kind, target.id, { signal: ac.signal });
        } catch {
          if (cancelled || generation !== generationRef.current) return;
          return;
        }
        if (cancelled || !map || generation !== generationRef.current) return;
      } else {
        // Atlas stays on its live overlay — clear any prior territory selection paint.
        clearTerritorySelection();
      }

      if (!reposition) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (cancelled || !map || generation !== generationRef.current) return;
      }

      const resolveFeature = (): Feature<Geometry> | null =>
        target.mode === 'atlas'
          ? atlasFeature(target.id)
          : selectionFeature(target.id);

      let feature = resolveFeature();
      let ok =
        feature != null &&
        focusTerritoryCameraOnFeature(map, feature, {
          reposition,
          maxZoom: MAX_ZOOM_BY_KIND[target.kind],
          floorMinZoom: floorMinZoomRef.current,
          generation,
          isCurrent: (g) => g === generationRef.current,
        });

      if (!ok) {
        await new Promise<void>((resolve) => setTimeout(resolve, 80));
        if (cancelled || !map || generation !== generationRef.current) return;
        feature = resolveFeature();
        ok =
          feature != null &&
          focusTerritoryCameraOnFeature(map, feature, {
            reposition,
            maxZoom: MAX_ZOOM_BY_KIND[target.kind],
            floorMinZoom: floorMinZoomRef.current,
            generation,
            isCurrent: (g) => g === generationRef.current,
          });
      }

      if (ok) {
        focusedKeyRef.current = key;
        lockedRef.current = true;
      }
    };

    void run();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [map, ready, target?.kind, target?.id, target?.mode]);

  useEffect(() => {
    return () => {
      if (map && lockedRef.current) {
        clearTerritoryCameraLock(map, floorMinZoomRef.current);
        lockedRef.current = false;
      }
    };
  }, [map]);
}

/** @deprecated Prefer useTerritoryFocusCamera */
export const useCountyFocusCamera = useTerritoryFocusCamera;
