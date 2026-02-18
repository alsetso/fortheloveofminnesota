'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

const SOURCE = 'child-features-src';
const FILL = 'child-features-fill';
const OUTLINE = 'child-features-outline';
const LABEL = 'child-features-label';

export interface ChildFeature {
  id: string;
  name: string;
  lat: number;
  lng: number;
  geometry?: GeoJSON.Geometry | null;
  /** Extra fields (address, city, etc.) for popup */
  meta?: Record<string, unknown>;
}

export interface ChildFeatureClickEvent {
  feature: ChildFeature;
  lngLat: [number, number];
}

interface ChildPinsLayerProps {
  map: MapboxMapInstance;
  mapLoaded: boolean;
  apiEndpoint: string;
  scopeParam: string;
  scopeValue: string;
  nameField: string;
  color?: string;
  labelMinZoom?: number;
  geometryField?: string;
  linkSlug?: string;
  fillOpacity?: number;
  outlineWidth?: number;
  /** Called when a child feature is clicked — parent decides popup vs navigate */
  onFeatureClick?: (event: ChildFeatureClickEvent) => void;
  /** Expose fetched features to parent (e.g. right sidebar list) */
  onFeaturesLoaded?: (features: ChildFeature[]) => void;
}

export default function ChildPinsLayer({
  map,
  mapLoaded,
  apiEndpoint,
  scopeParam,
  scopeValue,
  nameField,
  color = '#dc2626',
  labelMinZoom = 10,
  geometryField,
  linkSlug,
  fillOpacity = 0.25,
  outlineWidth = 1.5,
  onFeatureClick,
  onFeaturesLoaded,
}: ChildPinsLayerProps) {
  const [features, setFeatures] = useState<ChildFeature[]>([]);
  const addedRef = useRef(false);
  const onFeatureClickRef = useRef(onFeatureClick);
  onFeatureClickRef.current = onFeatureClick;

  // Fetch
  useEffect(() => {
    if (!scopeValue) { setFeatures([]); return; }
    let cancelled = false;

    fetch(`${apiEndpoint}?${scopeParam}=${scopeValue}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<Record<string, unknown>>) => {
        if (cancelled) return;
        const arr = (Array.isArray(data) ? data : [])
          .filter((r) => r.lat != null && r.lng != null)
          .map((r) => ({
            id: String(r.id),
            name: String(r[nameField] ?? ''),
            lat: Number(r.lat),
            lng: Number(r.lng),
            geometry: geometryField ? (r[geometryField] as GeoJSON.Geometry | null) : null,
            meta: r,
          }));
        setFeatures(arr);
        onFeaturesLoaded?.(arr);
      })
      .catch(() => { if (!cancelled) { setFeatures([]); onFeaturesLoaded?.([]); } });

    return () => { cancelled = true; };
  }, [apiEndpoint, scopeParam, scopeValue, nameField, geometryField, onFeaturesLoaded]);

  // Click handler — emit to parent instead of navigating
  const handleClick = useCallback(
    (e: unknown) => {
      const evt = e as {
        features?: Array<{ properties?: Record<string, unknown> }>;
        lngLat?: { lng: number; lat: number };
      };
      const props = evt.features?.[0]?.properties;
      const id = props?.id as string | undefined;
      if (!id) return;

      const feature = features.find((f) => f.id === id);
      if (!feature) return;

      const lngLat: [number, number] = evt.lngLat
        ? [evt.lngLat.lng, evt.lngLat.lat]
        : [feature.lng, feature.lat];

      onFeatureClickRef.current?.({ feature, lngLat });
    },
    [features]
  );

  // Render layers
  useEffect(() => {
    if (!map || !mapLoaded) return;
    const m = map as unknown as {
      getSource: (id: string) => unknown;
      addSource: (id: string, src: unknown) => void;
      addLayer: (layer: unknown) => void;
      removeLayer: (id: string) => void;
      removeSource: (id: string) => void;
      on: (event: string, layer: string, handler: (e: unknown) => void) => void;
      off: (event: string, layer: string, handler: (e: unknown) => void) => void;
      getCanvas: () => HTMLElement;
    };

    // Cleanup
    if (addedRef.current) {
      try { m.off('click', FILL, handleClick); } catch {}
      try { m.removeLayer(LABEL); } catch {}
      try { m.removeLayer(OUTLINE); } catch {}
      try { m.removeLayer(FILL); } catch {}
      try { m.removeSource(SOURCE); } catch {}
      addedRef.current = false;
    }

    if (features.length === 0) return;

    const hasPolygons = features.some((f) => f.geometry != null);

    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: features.map((f) => {
        const geom: GeoJSON.Geometry =
          hasPolygons && f.geometry
            ? f.geometry
            : { type: 'Point', coordinates: [f.lng, f.lat] };
        return {
          type: 'Feature' as const,
          geometry: geom,
          properties: { id: f.id, name: f.name },
        };
      }),
    };

    m.addSource(SOURCE, { type: 'geojson', data: fc });

    if (hasPolygons) {
      m.addLayer({
        id: FILL,
        type: 'fill',
        source: SOURCE,
        paint: {
          'fill-color': color,
          'fill-opacity': fillOpacity,
        },
      });

      m.addLayer({
        id: OUTLINE,
        type: 'line',
        source: SOURCE,
        paint: {
          'line-color': color,
          'line-width': outlineWidth,
        },
      });
    } else {
      m.addLayer({
        id: FILL,
        type: 'circle',
        source: SOURCE,
        paint: {
          'circle-radius': 5,
          'circle-color': color,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });
    }

    m.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SOURCE,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 10,
        'text-offset': hasPolygons ? [0, 0] : [0, 1.4],
        'text-anchor': hasPolygons ? 'center' : 'top',
        'text-max-width': 12,
      },
      paint: {
        'text-color': '#1f2937',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
      minzoom: labelMinZoom,
    });

    // Click
    m.on('click', FILL, handleClick);

    // Pointer cursor
    const canvas = m.getCanvas();
    const enter = () => { canvas.style.cursor = 'pointer'; };
    const leave = () => { canvas.style.cursor = ''; };
    (m as any).on('mouseenter', FILL, enter);
    (m as any).on('mouseleave', FILL, leave);

    addedRef.current = true;

    return () => {
      try { m.off('click', FILL, handleClick); } catch {}
      try { (m as any).off('mouseenter', FILL, enter); } catch {}
      try { (m as any).off('mouseleave', FILL, leave); } catch {}
      try { m.removeLayer(LABEL); } catch {}
      try { m.removeLayer(OUTLINE); } catch {}
      try { m.removeLayer(FILL); } catch {}
      try { m.removeSource(SOURCE); } catch {}
      addedRef.current = false;
    };
  }, [map, mapLoaded, features, color, labelMinZoom, handleClick, fillOpacity, outlineWidth]);

  return null;
}
