'use client';

import { useRef, useEffect, useState } from 'react';
import { MAP_CONFIG } from '@/features/map/config';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';

/**
 * Lightweight embeddable map widget.
 * Shows a single GeoJSON geometry with optional fill, fitted to bounds.
 * Also supports point markers via lat/lng for atlas records.
 * No interaction layers — purely visual context.
 */
interface MapWidgetProps {
  /** GeoJSON geometry (Polygon, MultiPolygon, etc.) */
  geometry?: GeoJSON.Geometry | null | undefined;
  /** Point coordinates (for atlas entities without polygon geometry) */
  lat?: number | null;
  lng?: number | null;
  /** CSS height (default 200px) */
  height?: number;
  /** Optional label shown above map */
  label?: string;
}

function boundsFromGeometry(
  geom: GeoJSON.Geometry | null | undefined,
): [[number, number], [number, number]] | null {
  if (!geom) return null;
  const coords = (geom as { coordinates?: unknown[] }).coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const lngs: number[] = [];
  const lats: number[] = [];
  const flatten = (arr: unknown[]): void => {
    for (const item of arr) {
      if (Array.isArray(item)) {
        if (typeof item[0] === 'number' && typeof item[1] === 'number') {
          lngs.push(Number(item[0]));
          lats.push(Number(item[1]));
        } else flatten(item);
      }
    }
  };
  flatten(coords);
  if (lngs.length === 0) return null;
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

export default function MapWidget({ geometry, lat, lng, height = 200, label }: MapWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  const hasPoint = lat != null && lng != null;
  const hasGeometry = geometry != null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!hasGeometry && !hasPoint) return;
    if (!MAP_CONFIG.MAPBOX_TOKEN) return;

    let mounted = true;

    (async () => {
      await import('mapbox-gl/dist/mapbox-gl.css');
      const mapbox = await loadMapboxGL();
      mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

      if (!mounted || !containerRef.current) return;

      const center: [number, number] = hasPoint
        ? [Number(lng), Number(lat)]
        : MAP_CONFIG.DEFAULT_CENTER;
      const initZoom = hasPoint ? 13 : 6;

      const map = new mapbox.Map({
        container: containerRef.current,
        style: MAP_CONFIG.STRATEGIC_STYLES.streets,
        center,
        zoom: initZoom,
        interactive: false,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on('load', () => {
        if (!mounted) return;

        if (hasGeometry && geometry) {
          map.addSource('entity-boundary', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry,
              properties: {},
            } as GeoJSON.Feature,
          });

          map.addLayer({
            id: 'entity-fill',
            type: 'fill',
            source: 'entity-boundary',
            paint: {
              'fill-color': '#3B82F6',
              'fill-opacity': 0.12,
            },
          });

          map.addLayer({
            id: 'entity-outline',
            type: 'line',
            source: 'entity-boundary',
            paint: {
              'line-color': '#3B82F6',
              'line-width': 1.5,
            },
          });

          const bounds = boundsFromGeometry(geometry);
          if (bounds) {
            map.fitBounds(bounds, { padding: 24, maxZoom: 12, animate: false });
          }
        } else if (hasPoint) {
          map.addSource('entity-point', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
              properties: {},
            } as GeoJSON.Feature,
          });

          map.addLayer({
            id: 'entity-marker',
            type: 'circle',
            source: 'entity-point',
            paint: {
              'circle-radius': 6,
              'circle-color': '#3B82F6',
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 2,
            },
          });
        }

        setLoaded(true);
      });

      map.on('error', () => {});
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [geometry, lat, lng, hasGeometry, hasPoint]);

  if (!hasGeometry && !hasPoint) return null;

  return (
    <div>
      {label && (
        <div className="text-[10px] text-foreground-muted uppercase tracking-wider mb-1.5">{label}</div>
      )}
      <div
        ref={containerRef}
        className="w-full rounded-md border border-border overflow-hidden bg-surface-accent"
        style={{ height }}
      />
      {!loaded && (
        <div
          className="flex items-center justify-center text-xs text-foreground-muted"
          style={{ height, marginTop: -height }}
        >
          Loading map…
        </div>
      )}
    </div>
  );
}
