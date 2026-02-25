'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PlusIcon, MinusIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { useExploreMapLayerInteraction } from '@/features/map/hooks/useExploreMapLayerInteraction';
import { EXPLORE_ZOOM_CTU_CUTOFF } from '@/features/map/config/exploreLayerInteractionConfig';
import StateBoundaryLayer from '@/features/map/components/StateBoundaryLayer';
import CountyBoundariesLayer from '@/features/map/components/CountyBoundariesLayer';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import CongressionalDistrictsLayer from '@/features/map/components/CongressionalDistrictsLayer';
import WaterBodiesLayer from '@/features/map/components/WaterBodiesLayer';
import SchoolDistrictsLayer from '@/features/map/components/SchoolDistrictsLayer';
import ChildPinsLayer from '@/features/map/components/ChildPinsLayer';
import type { ChildFeature, ChildFeatureClickEvent } from '@/features/map/components/ChildPinsLayer';
import { getEntityConfig } from '@/features/explore/config/entityRegistry';

/* ═══════════════════════════════════════════════════════════════
 * LAYER TRANSITION VARIABLES
 * Tune these to control zoom-based parent↔child handoff
 * ═══════════════════════════════════════════════════════════════ */

/** Zoom level where parent boundary fades and child features take over */
const CHILD_ZOOM_CUTOFF = 11;

/** Parent boundary opacity — zoomed OUT (below cutoff) */
const PARENT_FILL_OPACITY = 0.12;
const PARENT_OUTLINE_OPACITY = 0.7;

/** Parent boundary opacity — zoomed IN (above cutoff), near-invisible */
const PARENT_FILL_OPACITY_FADED = 0.03;
const PARENT_OUTLINE_OPACITY_FADED = 0.15;

/** Child feature fill opacity */
const CHILD_FILL_OPACITY = 0.25;

/** Child feature outline width */
const CHILD_OUTLINE_WIDTH = 1.5;

/** Min zoom for child feature name labels */
const CHILD_LABEL_MIN_ZOOM = 12;

export type ExploreBoundaryHover = {
  layer: 'state' | 'county' | 'ctu' | 'district' | 'water' | 'school-district';
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

/** Lightweight preview boundary shown as popup before navigation */
export interface PreviewBoundary {
  id: string;
  name: string;
  lngLat?: [number, number];
}

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
  /** Child features loaded by ChildPinsLayer — forwarded to right sidebar */
  onChildFeaturesLoaded?: (features: ChildFeature[]) => void;
  /** Preview boundary popup — shown on first click */
  previewBoundary?: PreviewBoundary | null;
  /** Called when user clicks "View details" in preview popup */
  onPreviewNavigate?: () => void;
  /** Called when user dismisses preview popup */
  onPreviewDismiss?: () => void;
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
  onChildFeaturesLoaded,
  previewBoundary,
  onPreviewNavigate,
  onPreviewDismiss,
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
  const showWater = layerSlug === 'water';
  const showSchoolDistricts = layerSlug === 'school-districts';

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

  // Track zoom level for indicator + parent layer fade
  const [zoomLevel, setZoomLevel] = useState(6);

  useEffect(() => {
    if (!mapInstance || !mapLoaded) return;
    const m = mapInstance as unknown as {
      getZoom: () => number;
      on: (e: string, fn: () => void) => void;
      off: (e: string, fn: () => void) => void;
    };
    setZoomLevel(Math.round(m.getZoom() * 10) / 10);
    const handler = () => setZoomLevel(Math.round(m.getZoom() * 10) / 10);
    m.on('zoom', handler);
    return () => m.off('zoom', handler);
  }, [mapInstance, mapLoaded]);

  // When focused on a record with childPins, fade parent boundary at high zoom
  const entityConfig = useMemo(() => getEntityConfig(layerSlug), [layerSlug]);
  const hasChildFeatures = Boolean(selectedId && entityConfig?.childPins);

  useEffect(() => {
    if (!mapInstance || !mapLoaded || !hasChildFeatures) return;
    const m = mapInstance as unknown as {
      getLayer: (id: string) => unknown;
      setPaintProperty: (layer: string, prop: string, value: unknown) => void;
    };

    const layerIds: Record<string, string[]> = {
      'school-districts': ['school-districts-fill', 'school-districts-outline', 'school-districts-highlight-fill', 'school-districts-highlight-outline'],
      'counties': ['county-boundaries-fill', 'county-boundaries-outline'],
      'congressional-districts': ['congressional-districts-fill', 'congressional-districts-outline'],
    };

    const ids = layerIds[layerSlug] ?? [];
    const pastCutoff = zoomLevel >= CHILD_ZOOM_CUTOFF;

    for (const id of ids) {
      if (!m.getLayer(id)) continue;
      if (id.includes('fill')) {
        m.setPaintProperty(id, 'fill-opacity', pastCutoff ? PARENT_FILL_OPACITY_FADED : PARENT_FILL_OPACITY);
      } else if (id.includes('outline')) {
        m.setPaintProperty(id, 'line-opacity', pastCutoff ? PARENT_OUTLINE_OPACITY_FADED : PARENT_OUTLINE_OPACITY);
      }
    }
  }, [mapInstance, mapLoaded, hasChildFeatures, zoomLevel, layerSlug]);

  const handleZoomIn = useCallback(() => {
    if (!mapInstance) return;
    (mapInstance as unknown as { zoomIn: () => void }).zoomIn();
  }, [mapInstance]);

  const handleZoomOut = useCallback(() => {
    if (!mapInstance) return;
    (mapInstance as unknown as { zoomOut: () => void }).zoomOut();
  }, [mapInstance]);

  const handleGeolocate = useCallback(() => {
    if (!mapInstance || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        (mapInstance as unknown as { flyTo: (opts: { center: [number, number]; zoom: number }) => void }).flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 11,
        });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 6000 }
    );
  }, [mapInstance]);

  // Child feature popup
  const [popup, setPopup] = useState<{ feature: ChildFeature; lngLat: [number, number] } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const handleChildFeatureClick = useCallback((event: ChildFeatureClickEvent) => {
    setPopup({ feature: event.feature, lngLat: event.lngLat });
  }, []);

  // Close popup on outside click
  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popup]);

  // Convert lngLat to screen position for the popup overlay
  const popupPosition = useMemo(() => {
    if (!popup || !mapInstance) return null;
    const m = mapInstance as unknown as { project: (lngLat: [number, number]) => { x: number; y: number } };
    try {
      const point = m.project(popup.lngLat);
      return { x: point.x, y: point.y };
    } catch {
      return null;
    }
  }, [popup, mapInstance, zoomLevel]); // zoomLevel dependency re-projects on zoom

  // Preview boundary popup position
  const previewPopupRef = useRef<HTMLDivElement>(null);
  const previewPopupPosition = useMemo(() => {
    if (!previewBoundary?.lngLat || !mapInstance) return null;
    const m = mapInstance as unknown as { project: (lngLat: [number, number]) => { x: number; y: number } };
    try {
      const point = m.project(previewBoundary.lngLat);
      return { x: point.x, y: point.y };
    } catch {
      return null;
    }
  }, [previewBoundary, mapInstance, zoomLevel]);

  // Dismiss preview popup on outside click
  useEffect(() => {
    if (!previewBoundary) return;
    const handler = (e: MouseEvent) => {
      if (previewPopupRef.current && !previewPopupRef.current.contains(e.target as Node)) {
        onPreviewDismiss?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [previewBoundary, onPreviewDismiss]);

  // Stable ref for onChildFeaturesLoaded
  const onChildFeaturesLoadedRef = useRef(onChildFeaturesLoaded);
  onChildFeaturesLoadedRef.current = onChildFeaturesLoaded;
  const stableOnChildFeaturesLoaded = useCallback((features: ChildFeature[]) => {
    onChildFeaturesLoadedRef.current?.(features);
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainerRef} className="w-full h-full min-h-0" />

      {/* Map controls — top-right */}
      {mapLoaded && (
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm hover:bg-white transition-colors"
            aria-label="Zoom in"
          >
            <PlusIcon className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm hover:bg-white transition-colors"
            aria-label="Zoom out"
          >
            <MinusIcon className="w-4 h-4 text-gray-700" />
          </button>
          <button
            onClick={handleGeolocate}
            className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm hover:bg-white transition-colors mt-1"
            aria-label="My location"
          >
            <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
            </svg>
          </button>
        </div>
      )}

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
          {showWater && (
            <WaterBodiesLayer
              map={mapInstance as any}
              mapLoaded={mapLoaded}
              visible={true}
              selectedId={selectedId || undefined}
              focusOnlyId={focusOnlyId}
            />
          )}
          {showSchoolDistricts && (
            <SchoolDistrictsLayer
              map={mapInstance as any}
              mapLoaded={mapLoaded}
              visible={true}
              selectedId={selectedId || undefined}
              focusOnlyId={focusOnlyId}
              hoveredFeature={null}
            />
          )}
          {/* Generic child features — driven by entity config + transition vars */}
          {selectedId && (() => {
            const cfg = getEntityConfig(layerSlug);
            if (!cfg?.childPins) return null;
            const cp = cfg.childPins;
            return (
              <ChildPinsLayer
                map={mapInstance as any}
                mapLoaded={mapLoaded}
                apiEndpoint={cp.apiEndpoint}
                scopeParam={cp.scopeParam}
                scopeValue={selectedId}
                nameField={cp.nameField}
                color={cp.color}
                labelMinZoom={CHILD_LABEL_MIN_ZOOM}
                geometryField={cp.geometryField}
                linkSlug={cp.linkSlug}
                fillOpacity={CHILD_FILL_OPACITY}
                outlineWidth={CHILD_OUTLINE_WIDTH}
                onFeatureClick={handleChildFeatureClick}
                onFeaturesLoaded={stableOnChildFeaturesLoaded}
              />
            );
          })()}
        </>
      )}

      {/* Child feature popup */}
      {popup && popupPosition && (() => {
        const f = popup.feature;
        const meta = f.meta ?? {};
        // Prefer atlas school slug for canonical URL, fall back to building ID
        const atlasSlug = meta.atlas_school_slug as string | undefined;
        const cfg = getEntityConfig(layerSlug);
        const fallbackSlug = cfg?.childPins?.linkSlug;
        const detailHref = atlasSlug
          ? `/explore/schools/${atlasSlug}`
          : fallbackSlug
            ? `/explore/${fallbackSlug}/${f.id}`
            : null;
        return (
          <div
            ref={popupRef}
            className="absolute z-30 pointer-events-auto"
            style={{
              left: popupPosition.x,
              top: popupPosition.y,
              transform: 'translate(-50%, -100%) translateY(-12px)',
            }}
          >
            <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-2.5 min-w-[180px] max-w-[240px]">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold text-gray-900 leading-tight">{f.name}</div>
                <button
                  onClick={() => setPopup(null)}
                  className="p-0.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                >
                  <XMarkIcon className="w-3 h-3 text-gray-400" />
                </button>
              </div>
              {meta.address != null ? (
                <div className="text-[10px] text-gray-500 mt-1">{String(meta.address)}</div>
              ) : null}
              {meta.city != null ? (
                <div className="text-[10px] text-gray-500">
                  {String(meta.city)}{meta.zip != null ? `, ${String(meta.zip)}` : ''}
                </div>
              ) : null}
              {detailHref && (
                <Link
                  href={detailHref}
                  className="mt-2 block text-[10px] text-lake-blue hover:underline"
                >
                  View details →
                </Link>
              )}
            </div>
            {/* Arrow */}
            <div className="flex justify-center -mt-[1px]">
              <div className="w-2.5 h-2.5 bg-white border-r border-b border-gray-200 rotate-45 -translate-y-[5px]" />
            </div>
          </div>
        );
      })()}

      {/* Boundary preview popup — shown on first click before navigation */}
      {previewBoundary && previewPopupPosition && (
        <div
          ref={previewPopupRef}
          className="absolute z-30 pointer-events-auto"
          style={{
            left: previewPopupPosition.x,
            top: previewPopupPosition.y,
            transform: 'translate(-50%, -100%) translateY(-12px)',
          }}
        >
          <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-2.5 min-w-[180px] max-w-[260px]">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold text-gray-900 leading-tight">
                {previewBoundary.name}
              </div>
              <button
                onClick={() => onPreviewDismiss?.()}
                className="p-0.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
              >
                <XMarkIcon className="w-3 h-3 text-gray-400" />
              </button>
            </div>
            <button
              onClick={() => onPreviewNavigate?.()}
              className="mt-2 block text-[10px] text-lake-blue hover:underline"
            >
              View details →
            </button>
          </div>
          {/* Arrow */}
          <div className="flex justify-center -mt-[1px]">
            <div className="w-2.5 h-2.5 bg-white border-r border-b border-gray-200 rotate-45 -translate-y-[5px]" />
          </div>
        </div>
      )}

      {/* Zoom level indicator — bottom-right */}
      {mapLoaded && (
        <div className="absolute bottom-3 right-3 z-20 px-2 py-1 bg-white/90 backdrop-blur-sm rounded border border-gray-200 shadow-sm">
          <span className="text-[10px] text-gray-600 font-mono tabular-nums">z{zoomLevel.toFixed(1)}</span>
        </div>
      )}

      {/* Loading Overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-surface/80 flex items-center justify-center z-10">
          <div className="text-xs text-foreground-muted">Loading map…</div>
        </div>
      )}
    </div>
  );
}
