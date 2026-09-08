'use client';

/** Hover/press the camera-facing hit plane; click opens found or route modal. */

import { useEffect, useRef } from 'react';
import type { MapLayerMouseEvent } from 'mapbox-gl';
import { haptic } from '@/lib/despia/haptics';
import { shouldIgnoreMapClick } from '@/map/engine/mapClickGate';
import { useMapContext } from '@/map/MapProvider';
import { handleWorldPlacementTap } from '@/features/map/game/world/handleWorldPlacementTap';
import {
  clearWorldPlacementFeatureState,
  queryWorldPlacementAtPoint,
  setWorldPlacementFeatureState,
} from '@/features/map/game/world/placementHitTest';

export function useWorldPlacementHover() {
  const { map, ready } = useMapContext();
  const hoverIdRef = useRef<string | number | null>(null);
  const activeIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!map || !ready) return;

    const setHover = (next: string | number | null) => {
      const prev = hoverIdRef.current;
      if (prev === next) return;
      if (prev != null && prev !== activeIdRef.current) {
        setWorldPlacementFeatureState(map, prev, { hover: false });
      }
      hoverIdRef.current = next;
      if (next != null) {
        setWorldPlacementFeatureState(map, next, { hover: true });
        map.getCanvas().style.cursor = 'pointer';
      } else if (activeIdRef.current == null) {
        map.getCanvas().style.cursor = '';
      }
    };

    const onMove = (e: MapLayerMouseEvent) => {
      const hit = queryWorldPlacementAtPoint(map, e.point);
      setHover(hit?.featureId ?? null);
    };

    const onLeave = () => setHover(null);

    const onMouseDown = (e: MapLayerMouseEvent) => {
      const hit = queryWorldPlacementAtPoint(map, e.point);
      if (!hit) return;
      activeIdRef.current = hit.featureId;
      setWorldPlacementFeatureState(map, hit.featureId, {
        hover: true,
        active: true,
      });
    };

    const clearActive = () => {
      const id = activeIdRef.current;
      if (id == null) return;
      activeIdRef.current = null;
      setWorldPlacementFeatureState(map, id, {
        active: false,
        hover: hoverIdRef.current === id,
      });
      if (hoverIdRef.current == null) map.getCanvas().style.cursor = '';
    };

    const onClick = (e: MapLayerMouseEvent) => {
      if (shouldIgnoreMapClick()) return;
      const hit = queryWorldPlacementAtPoint(map, e.point);
      if (!hit) return;
      const kind = String(
        hit.feature.properties?.kind || hit.feature.properties?.slug || '',
      );
      if (!kind) return;
      haptic.toggle();
      handleWorldPlacementTap(kind, hit.featureId);
    };

    map.on('mousemove', onMove);
    map.on('mouseout', onLeave);
    map.on('mousedown', onMouseDown);
    map.on('mouseup', clearActive);
    map.on('touchend', clearActive);
    map.on('click', onClick);

    return () => {
      map.off('mousemove', onMove);
      map.off('mouseout', onLeave);
      map.off('mousedown', onMouseDown);
      map.off('mouseup', clearActive);
      map.off('touchend', clearActive);
      map.off('click', onClick);
      clearWorldPlacementFeatureState(map, hoverIdRef.current);
      clearWorldPlacementFeatureState(map, activeIdRef.current);
      hoverIdRef.current = null;
      activeIdRef.current = null;
      try {
        map.getCanvas().style.cursor = '';
      } catch {
        /* ignore */
      }
    };
  }, [map, ready]);
}
