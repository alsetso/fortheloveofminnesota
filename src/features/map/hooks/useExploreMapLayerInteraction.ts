'use client';

import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import {
  getExploreLayerInteractionConfig,
  getConfigForLayerId,
  extractPointFromGeometry,
  type ExploreLayerType,
} from '@/features/map/config/exploreLayerInteractionConfig';

interface UseExploreMapLayerInteractionProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  layerSlug: string;
  /** When on county detail: also query CTU layer so both county and cities/towns are clickable */
  overlayLayerSlug?: string;
  onBoundaryHover?: (boundary: { layer: ExploreLayerType; id: string; name: string } | null) => void;
  onBoundarySelect?: (boundary: {
    layer: ExploreLayerType;
    id: string;
    name: string;
    lat: number;
    lng: number;
  }) => void;
}

type MapboxFeature = {
  properties?: Record<string, unknown>;
  geometry?: GeoJSON.Geometry;
  layer?: { id?: string };
};

const HOVER_THROTTLE_MS = 50;

/**
 * Unified map-level hover/click handling for Explore layers.
 * Uses feature properties only—no API calls. Hover shows record name.
 * Throttled and id-stable to avoid glitch from rapid repaints.
 */
export function useExploreMapLayerInteraction({
  map,
  mapLoaded,
  layerSlug,
  overlayLayerSlug,
  onBoundaryHover,
  onBoundarySelect,
}: UseExploreMapLayerInteractionProps) {
  const onHoverRef = useRef(onBoundaryHover);
  const onSelectRef = useRef(onBoundarySelect);
  const lastHoverKeyRef = useRef<string | null>(null);
  const lastMoveTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  onHoverRef.current = onBoundaryHover;
  onSelectRef.current = onBoundarySelect;

  const config = getExploreLayerInteractionConfig(layerSlug);
  const overlayConfig = overlayLayerSlug ? getExploreLayerInteractionConfig(overlayLayerSlug) : null;
  const fillLayerIds = overlayConfig
    ? [...(config?.fillLayerIds ?? []), ...overlayConfig.fillLayerIds]
    : (config?.fillLayerIds ?? []);

  useEffect(() => {
    if (!map || !mapLoaded || fillLayerIds.length === 0) return;

    const mapboxMap = map as unknown as {
      queryRenderedFeatures: (point: unknown, opts?: { layers: string[] }) => MapboxFeature[];
      on: (ev: string, fn: (e: unknown) => void) => void;
      off: (ev: string, fn?: (e: unknown) => void) => void;
      once: (ev: string, fn: () => void) => void;
      getCanvas: () => { style: { cursor: string }; title?: string };
      isStyleLoaded?: () => boolean;
    };

type MapMouseEvent = { point: unknown; lngLat: { lng: number; lat: number } };

    const handleMouseMove = (e: MapMouseEvent) => {
      const now = Date.now();
      if (now - lastMoveTimeRef.current < HOVER_THROTTLE_MS) {
        if (rafRef.current == null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            lastMoveTimeRef.current = Date.now();
            processHover(e);
          });
        }
        return;
      }
      lastMoveTimeRef.current = now;
      processHover(e);
    };

    const getFeatureMeta = (f: MapboxFeature) => {
      const fc = getConfigForLayerId(f.layer?.id) ?? config;
      if (!fc) return null;
      const props = f.properties ?? {};
      const id = fc.getId(props, f.layer?.id);
      const name = fc.getName(props, f.layer?.id);
      return { layer: fc.layer, id, name };
    };

    const processHover = (e: MapMouseEvent) => {
      const features = mapboxMap.queryRenderedFeatures(e.point, { layers: fillLayerIds });
      const feature = features[0] as MapboxFeature | undefined;

      if (!feature) {
        if (lastHoverKeyRef.current !== null) {
          lastHoverKeyRef.current = null;
          const canvas = mapboxMap.getCanvas();
          canvas.style.cursor = '';
          canvas.title = '';
          onHoverRef.current?.(null);
        }
        return;
      }

      const meta = getFeatureMeta(feature);
      if (!meta) return;
      const hoverKey = `${meta.layer}:${meta.id}`;
      if (lastHoverKeyRef.current === hoverKey) return;
      lastHoverKeyRef.current = hoverKey;

      const canvas = mapboxMap.getCanvas();
      canvas.style.cursor = 'pointer';
      canvas.title = meta.name;
      onHoverRef.current?.({ layer: meta.layer, id: meta.id, name: meta.name });
    };

    const handleMouseOut = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastHoverKeyRef.current = null;
      const canvas = mapboxMap.getCanvas();
      canvas.style.cursor = '';
      canvas.title = '';
      onHoverRef.current?.(null);
    };

    const handleClick = (e: MapMouseEvent) => {
      const features = mapboxMap.queryRenderedFeatures(e.point, { layers: fillLayerIds });
      const feature = features[0] as MapboxFeature | undefined;
      if (!feature) return;

      const meta = getFeatureMeta(feature);
      if (!meta) return;
      const pt = extractPointFromGeometry(feature.geometry) ?? [e.lngLat.lng, e.lngLat.lat];
      const [lng, lat] = pt;
      onSelectRef.current?.({ layer: meta.layer, id: meta.id, name: meta.name, lat, lng });
    };

    const attach = () => {
      mapboxMap.on('mousemove', handleMouseMove as (e: unknown) => void);
      mapboxMap.on('mouseout', handleMouseOut);
      mapboxMap.on('click', handleClick as (e: unknown) => void);
    };

    if (mapboxMap.isStyleLoaded?.()) {
      attach();
    } else {
      mapboxMap.once('idle', attach);
    }

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      mapboxMap.off('mousemove', handleMouseMove as (e: unknown) => void);
      mapboxMap.off('mouseout', handleMouseOut);
      mapboxMap.off('click', handleClick as (e: unknown) => void);
    };
  }, [map, mapLoaded, layerSlug, overlayLayerSlug, config, overlayConfig, fillLayerIds]);
}
