'use client';

import { useState, useEffect, useRef } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { useExploreMapLayerInteraction } from '@/features/map/hooks/useExploreMapLayerInteraction';
import { EXPLORE_ZOOM_CTU_CUTOFF } from '@/features/map/config/exploreLayerInteractionConfig';
import StateBoundaryLayer from '@/features/map/components/StateBoundaryLayer';
import CountyBoundariesLayer from '@/features/map/components/CountyBoundariesLayer';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import CongressionalDistrictsLayer from '@/features/map/components/CongressionalDistrictsLayer';

export type ExploreBoundaryHover = {
  layer: 'state' | 'county' | 'ctu' | 'district';
  id: string;
  name: string;
};

export type ExploreBoundarySelect = ExploreBoundaryHover & { lat: number; lng: number };

/** Extract [[west,south],[east,north]] from polygon geometry for fitBounds/setMaxBounds */
function boundsFromGeometry(geom: GeoJSON.Geometry | null | undefined): [[number, number], [number, number]] | null {
  if (!geom) return null;
  const g = geom as { type: string; coordinates?: unknown[] };
  const coords = g.coordinates;
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

const MINNESOTA_MAX_BOUNDS: [[number, number], [number, number]] = [
  [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
  [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
];

interface LayerDetailMapProps {
  layerSlug: string;
  selectedId?: string;
  focusOnly?: boolean;
  /** Geometry for fitBounds—from useExploreRecord, no duplicate fetch */
  boundsGeometry?: GeoJSON.Geometry | null;
  /** When on county detail: also query CTU layer so cities/towns are clickable */
  overlayLayerSlug?: string;
  /** When on county detail: filter CTU overlay to this county */
  parentCountyName?: string;
  onBoundarySelect?: (boundary: ExploreBoundarySelect) => void;
  onBoundaryHover?: (boundary: ExploreBoundaryHover | null) => void;
}

/**
 * Map Component for Layer Detail Page
 * Renders Mapbox map with the selected layer visible in main content area
 */
export default function LayerDetailMap({
  layerSlug,
  selectedId,
  focusOnly,
  boundsGeometry,
  overlayLayerSlug,
  parentCountyName,
  onBoundarySelect,
  onBoundaryHover,
}: LayerDetailMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<MapboxMapInstance | null>(null);

  // Resize map when container dimensions change (e.g. flex layout settling, sidebar toggle)
  useEffect(() => {
    if (!mapRef.current || !mapContainerRef.current) return;
    const map = mapRef.current;
    const container = mapContainerRef.current;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [mapLoaded]);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || mapRef.current) return;

    let mounted = true;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    const initMap = async () => {
      if (!mounted || !mapContainerRef.current || mapRef.current) return;

      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainerRef.current || !mounted || mapRef.current) return;

        const Map = mapbox.Map;
        const map = new Map({
          container: mapContainerRef.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: 6,
          pitch: 0,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapRef.current = map as MapboxMapInstance;

        map.on('load', () => {
          if (mounted) {
            map.resize();
            map.once('idle', () => {
              if (mounted) {
                setMapLoaded(true);
                setMapInstance(map as MapboxMapInstance);
                map.resize();
              }
            });
          }
        });

        // Suppress Mapbox errors (tile load failures, style timing, etc.)—non-fatal and noisy
        map.on('error', () => {});
      } catch (error) {
        console.error('Failed to initialize map:', error);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Determine which layer to show based on slug
  const showStateBoundary = layerSlug === 'state';
  const showCountyBoundaries = layerSlug === 'counties';
  const showCTU = layerSlug === 'cities-and-towns';
  const showDistricts = layerSlug === 'congressional-districts';

  const focusOnlyId = focusOnly && selectedId ? selectedId : undefined;

  // County detail with overlay: zoom-based switch—county at low zoom, CTU at high zoom
  const hasCountyOverlay = showCountyBoundaries && Boolean(parentCountyName);

  // Unified hover/click: feature properties only, no API.
  // Hover: canvas.title + onBoundaryHover for sidebar. We do NOT pass hoveredFeature to layers—
  // that triggers setData/setPaintProperty and causes repaint feedback loops. Click unchanged.
  useExploreMapLayerInteraction({
    map: mapInstance,
    mapLoaded,
    layerSlug,
    overlayLayerSlug,
    onBoundaryHover,
    onBoundarySelect,
  });

  // Zoom to selected boundary using geometry from parent (no fetch)
  useEffect(() => {
    if (!mapInstance || !mapLoaded || !boundsGeometry) return;
    const b = boundsFromGeometry(boundsGeometry);
    if (!b) return;
    mapInstance.fitBounds(b, { padding: 50, maxZoom: 12 });
  }, [mapInstance, mapLoaded, boundsGeometry]);

  // Lock map to selected boundary: user cannot pan outside when record selected
  useEffect(() => {
    if (!mapInstance || !mapLoaded) return;
    const m = mapInstance as unknown as { setMaxBounds: (b: [[number, number], [number, number]] | null) => void };
    if (selectedId && boundsGeometry) {
      const b = boundsFromGeometry(boundsGeometry);
      if (b) m.setMaxBounds(b);
    } else {
      m.setMaxBounds(MINNESOTA_MAX_BOUNDS);
    }
  }, [mapInstance, mapLoaded, selectedId, boundsGeometry]);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainerRef} className="w-full h-full min-h-0" />
      
      {/* Layer Components */}
      {mapLoaded && mapInstance && (
        <>
          {showStateBoundary && (
            <StateBoundaryLayer
              map={mapInstance as any}
              mapLoaded={mapLoaded}
              visible={true}
              selectedId={selectedId || undefined}
              focusOnlyId={focusOnlyId}
              hoveredFeature={null}
            />
          )}
          {showCountyBoundaries && (
            <CountyBoundariesLayer
              map={mapInstance as any}
              mapLoaded={mapLoaded}
              visible={true}
              selectedId={selectedId || undefined}
              focusOnlyId={focusOnlyId}
              hoveredFeature={null}
              maxzoom={hasCountyOverlay ? EXPLORE_ZOOM_CTU_CUTOFF : undefined}
            />
          )}
          {(showCTU || (showCountyBoundaries && parentCountyName)) && (
            <CTUBoundariesLayer
              map={mapInstance as any}
              mapLoaded={mapLoaded}
              visible={true}
              selectedId={selectedId || undefined}
              focusOnlyId={focusOnlyId}
              parentCountyName={parentCountyName}
              hoveredFeature={null}
              minzoom={hasCountyOverlay ? EXPLORE_ZOOM_CTU_CUTOFF : undefined}
            />
          )}
          {showDistricts && (
            <CongressionalDistrictsLayer
              map={mapInstance as any}
              mapLoaded={mapLoaded}
              visible={true}
              selectedId={selectedId || undefined}
              focusOnlyId={focusOnlyId}
              hoveredFeature={null}
            />
          )}
        </>
      )}

      {/* Loading Overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-surface/80 flex items-center justify-center z-10">
          <div className="text-xs text-white/60">Loading map...</div>
        </div>
      )}
    </div>
  );
}
