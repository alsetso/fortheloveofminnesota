'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, EyeIcon, Cog6ToothIcon, MapPinIcon, PencilSquareIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useMapboxMap } from '../hooks/useMapboxMap';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import MapPinForm from './MapPinForm';
import MapAreaDrawModal from './MapAreaDrawModal';
import MapIDDetails from './MapIDDetails';
import MapEntitySlideUp from './MapEntitySlideUp';
import MapInfoCard from './MapInfoCard';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import CongressionalDistrictsLayer from '@/features/map/components/CongressionalDistrictsLayer';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import StateBoundaryLayer from '@/features/map/components/StateBoundaryLayer';
import CountyBoundariesLayer from '@/features/map/components/CountyBoundariesLayer';

interface MapIDBoxProps {
  mapStyle: 'street' | 'satellite' | 'light' | 'dark';
  mapId: string;
  isOwner: boolean;
  meta?: {
    buildingsEnabled?: boolean;
    pitch?: number;
    terrainEnabled?: boolean;
    center?: [number, number];
    zoom?: number;
  } | null;
  showDistricts?: boolean;
  showCTU?: boolean;
  showStateBoundary?: boolean;
  showCountyBoundaries?: boolean;
  title?: string;
  description?: string | null;
  visibility?: 'public' | 'private' | 'shared';
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
  viewCount?: number | null;
  hideCreator?: boolean;
  onMapLoad?: (map: MapboxMapInstance) => void;
  onMapUpdate?: (updatedData: any) => void;
  map_account_id?: string | null;
  current_account_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface MapPin {
  id: string;
  map_id: string;
  emoji: string | null;
  caption: string | null;
  image_url: string | null;
  video_url: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

interface MapArea {
  id: string;
  map_id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  created_at: string;
  updated_at: string;
}

interface MapLayerPolygonEntity {
  layerId: string;
  title: string;
  subtitle?: string | null;
  properties: Record<string, unknown>;
  geometryType?: string | null;
  geometry?: GeoJSON.Geometry | GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}

const PINS_SOURCE_ID = 'map-pins';
const PINS_LAYER_ID = 'map-pins-points';
const AREAS_SOURCE_ID = 'map-areas';
const AREAS_LAYER_ID = 'map-areas-fill';
const AREAS_OUTLINE_LAYER_ID = 'map-areas-outline';

const SELECTED_SOURCE_ID = 'map-selected-entity';
const SELECTED_POINT_LAYER_ID = 'map-selected-point';
const SELECTED_POLYGON_FILL_LAYER_ID = 'map-selected-polygon-fill';
const SELECTED_POLYGON_OUTLINE_LAYER_ID = 'map-selected-polygon-outline';

export default function MapIDBox({
  mapStyle,
  mapId,
  isOwner,
  meta,
  showDistricts = false,
  showCTU = false,
  showStateBoundary = false,
  showCountyBoundaries = false,
  title,
  description,
  visibility,
  account,
  viewCount,
  hideCreator = false,
  onMapLoad,
  onMapUpdate,
  map_account_id,
  current_account_id,
  created_at,
  updated_at,
}: MapIDBoxProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const { account: currentAccount } = useAuthStateSafe();
  const { openAccount, openWelcome } = useAppModalContextSafe();
  const [pinMode, setPinMode] = useState(false);
  const [showAreaDrawModal, setShowAreaDrawModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<MapPin | MapArea | MapLayerPolygonEntity | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<'pin' | 'area' | 'layer' | null>(null);
  const [loadingEntity, setLoadingEntity] = useState(false);
  const { mapInstance, mapLoaded } = useMapboxMap({
    mapStyle,
    containerRef: mapContainer as React.RefObject<HTMLDivElement>,
    meta,
    onMapLoad,
  });
  const [pins, setPins] = useState<MapPin[]>([]);
  const [areas, setAreas] = useState<MapArea[]>([]);
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinFormCoords, setPinFormCoords] = useState<{ lat: number; lng: number } | null>(null);
  const clickHandlerAddedRef = useRef(false);
  const hiddenLayersRef = useRef<Map<string, 'visible' | 'none' | undefined>>(new Map());

  const clearSelection = useCallback(() => {
    setSelectedEntity(null);
    setSelectedEntityType(null);
  }, []);

  const isPinOrAreaLayerId = useCallback((layerId: unknown): boolean => {
    return (
      typeof layerId === 'string' &&
      (layerId === PINS_LAYER_ID || layerId === AREAS_LAYER_ID || layerId === AREAS_OUTLINE_LAYER_ID)
    );
  }, []);

  const isLayerPolygonLayerId = useCallback((layerId: unknown): boolean => {
    if (typeof layerId !== 'string') return false;
    if (layerId === 'county-boundaries-fill') return true;
    if (layerId === 'county-boundaries-outline') return true;
    if (layerId === 'county-boundaries-highlight-fill') return true;
    if (layerId === 'county-boundaries-highlight-outline') return true;
    if (layerId === 'ctu-boundaries-fill') return true;
    if (layerId === 'ctu-boundaries-outline') return true;
    if (layerId === 'ctu-boundaries-highlight-fill') return true;
    if (layerId === 'ctu-boundaries-highlight-outline') return true;
    if (layerId === 'state-boundary-fill') return true;
    if (layerId === 'state-boundary-outline') return true;
    if (layerId === 'state-boundary-highlight-fill') return true;
    if (layerId === 'state-boundary-highlight-outline') return true;
    if (/^congressional-district-\d+-(fill|outline|highlight-fill|highlight-outline)$/.test(layerId)) return true;
    return false;
  }, []);

  const buildLayerPolygonEntity = useCallback((feature: any): MapLayerPolygonEntity | null => {
    const layerId: unknown = feature?.layer?.id;
    if (typeof layerId !== 'string') return null;

    const rawProps = feature?.properties;
    const properties: Record<string, unknown> =
      rawProps && typeof rawProps === 'object'
        ? Object.fromEntries(Object.entries(rawProps as Record<string, unknown>))
        : {};

    const geometryType: string | null =
      feature?.geometry && typeof feature.geometry.type === 'string' ? feature.geometry.type : null;
    const geometry: GeoJSON.Geometry | null =
      feature?.geometry && typeof feature.geometry === 'object' ? (feature.geometry as GeoJSON.Geometry) : null;

    let title = 'Layer Feature';
    let subtitle: string | null = null;

    if (layerId.startsWith('county-boundaries-')) {
      title = typeof properties.county_name === 'string' && properties.county_name.trim().length > 0
        ? properties.county_name
        : 'County';
      subtitle = 'County boundary';
    } else if (layerId.startsWith('ctu-boundaries-')) {
      const name =
        typeof properties.feature_name === 'string' && properties.feature_name.trim().length > 0
          ? properties.feature_name
          : 'CTU';
      const ctuClass = typeof properties.ctu_class === 'string' ? properties.ctu_class : null;
      const county = typeof properties.county_name === 'string' ? properties.county_name : null;
      title = name;
      subtitle = [ctuClass, county].filter(Boolean).join(' • ') || 'CTU boundary';
    } else if (layerId.startsWith('state-boundary-')) {
      title = 'Minnesota';
      subtitle = 'State boundary';
    } else {
      const districtMatch = layerId.match(/^congressional-district-(\d+)-/);
      if (districtMatch?.[1]) {
        title = `Congressional District ${districtMatch[1]}`;
        subtitle = 'Congressional district';
      } else {
        title = layerId;
      }
    }

    return {
      layerId,
      title,
      subtitle,
      properties,
      geometryType,
      geometry,
    };
  }, []);

  const getAllInteractiveLayerIds = useCallback((mapboxMap: any): string[] => {
    const ids = new Set<string>();
    // Pins/areas
    ids.add(PINS_LAYER_ID);
    ids.add(AREAS_LAYER_ID);
    ids.add(AREAS_OUTLINE_LAYER_ID);
    // Known boundary layers
    [
      'county-boundaries-fill',
      'county-boundaries-outline',
      'county-boundaries-highlight-fill',
      'county-boundaries-highlight-outline',
      'ctu-boundaries-fill',
      'ctu-boundaries-outline',
      'ctu-boundaries-highlight-fill',
      'ctu-boundaries-highlight-outline',
      'state-boundary-fill',
      'state-boundary-outline',
      'state-boundary-highlight-fill',
      'state-boundary-highlight-outline',
    ].forEach((id) => ids.add(id));

    // Congressional layers are dynamic per district number; discover from style
    try {
      const style = typeof mapboxMap.getStyle === 'function' ? mapboxMap.getStyle() : null;
      const layers: any[] = Array.isArray(style?.layers) ? style.layers : [];
      for (const layer of layers) {
        const id = layer?.id;
        if (typeof id !== 'string') continue;
        if (/^congressional-district-\d+-(fill|outline|highlight-fill|highlight-outline)$/.test(id)) {
          ids.add(id);
        }
      }
    } catch {
      // ignore
    }
    return Array.from(ids);
  }, []);

  const hideOtherRecordLayers = useCallback((mapboxMap: any) => {
    const ids = getAllInteractiveLayerIds(mapboxMap);
    for (const id of ids) {
      if (!mapboxMap.getLayer || !mapboxMap.setLayoutProperty) continue;
      if (!mapboxMap.getLayer(id)) continue;
      if (!hiddenLayersRef.current.has(id)) {
        try {
          const prev = mapboxMap.getLayoutProperty(id, 'visibility') as 'visible' | 'none' | undefined;
          hiddenLayersRef.current.set(id, prev);
        } catch {
          hiddenLayersRef.current.set(id, undefined);
        }
      }
      try {
        mapboxMap.setLayoutProperty(id, 'visibility', 'none');
      } catch {
        // ignore
      }
    }
  }, [getAllInteractiveLayerIds]);

  const restoreOtherRecordLayers = useCallback((mapboxMap: any) => {
    if (!mapboxMap.getLayer || !mapboxMap.setLayoutProperty) return;
    for (const [id, prev] of hiddenLayersRef.current.entries()) {
      if (!mapboxMap.getLayer(id)) continue;
      try {
        mapboxMap.setLayoutProperty(id, 'visibility', prev ?? 'visible');
      } catch {
        // ignore
      }
    }
    hiddenLayersRef.current.clear();
  }, []);

  const ensureSelectedOverlay = useCallback((mapboxMap: any) => {
    if (!mapboxMap || typeof mapboxMap.getSource !== 'function' || typeof mapboxMap.addSource !== 'function') return;

    if (!mapboxMap.getSource(SELECTED_SOURCE_ID)) {
      mapboxMap.addSource(SELECTED_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    const addLayerIfMissing = (layer: any) => {
      if (typeof mapboxMap.getLayer !== 'function' || typeof mapboxMap.addLayer !== 'function') return;
      if (mapboxMap.getLayer(layer.id)) return;
      mapboxMap.addLayer(layer);
    };

    addLayerIfMissing({
      id: SELECTED_POLYGON_FILL_LAYER_ID,
      type: 'fill',
      source: SELECTED_SOURCE_ID,
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      paint: {
        'fill-color': '#2563eb',
        'fill-opacity': 0.22,
      },
    });

    addLayerIfMissing({
      id: SELECTED_POLYGON_OUTLINE_LAYER_ID,
      type: 'line',
      source: SELECTED_SOURCE_ID,
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      paint: {
        'line-color': '#2563eb',
        'line-width': 3,
        'line-opacity': 1,
      },
    });

    addLayerIfMissing({
      id: SELECTED_POINT_LAYER_ID,
      type: 'circle',
      source: SELECTED_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 10,
        'circle-color': '#2563eb',
        'circle-opacity': 1,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 1,
      },
    });
  }, []);

  const setSelectedOverlayFeature = useCallback((mapboxMap: any, feature: GeoJSON.Feature | null) => {
    if (!mapboxMap || typeof mapboxMap.getSource !== 'function') return;
    const source = mapboxMap.getSource(SELECTED_SOURCE_ID) as any;
    if (!source || typeof source.setData !== 'function') return;
    source.setData({
      type: 'FeatureCollection',
      features: feature ? [feature] : [],
    });
  }, []);

  const computeBoundsFromGeometry = useCallback((geometry: GeoJSON.Geometry | null): [[number, number], [number, number]] | null => {
    if (!geometry) return null;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    const extend = (lng: number, lat: number) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    };

    const walk = (coords: any) => {
      if (!coords) return;
      if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        extend(coords[0], coords[1]);
        return;
      }
      if (Array.isArray(coords)) {
        for (const c of coords) walk(c);
      }
    };

    // @ts-expect-error - geometry.coordinates is structurally present
    walk(geometry.coordinates);

    if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return null;
    return [[minLng, minLat], [maxLng, maxLat]];
  }, []);

  // If switching into creation/draw modes, close any open selection sheet
  useEffect(() => {
    if (pinMode || showAreaDrawModal) {
      clearSelection();
    }
  }, [pinMode, showAreaDrawModal, clearSelection]);

  // Selection overlay + zoom-to-selection
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;
    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    ensureSelectedOverlay(mapboxMap);

    if (!selectedEntity || !selectedEntityType) {
      setSelectedOverlayFeature(mapboxMap, null);
      return;
    }

    if (selectedEntityType === 'pin') {
      const pin = selectedEntity as MapPin;
      if (typeof pin.lng === 'number' && typeof pin.lat === 'number') {
        const feature: GeoJSON.Feature = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
          properties: { id: pin.id, kind: 'pin' },
        };
        setSelectedOverlayFeature(mapboxMap, feature);
        if (typeof mapboxMap.flyTo === 'function') {
          mapboxMap.flyTo({
            center: [pin.lng, pin.lat],
            zoom: Math.max(15, typeof mapboxMap.getZoom === 'function' ? mapboxMap.getZoom() : 15),
            duration: 700,
            essential: true,
          });
        }
      }
      return;
    }

    if (selectedEntityType === 'area') {
      const area = selectedEntity as MapArea;
      const geometry = (area.geometry as unknown as GeoJSON.Geometry) || null;
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        geometry,
        properties: { id: area.id, kind: 'area' },
      };
      setSelectedOverlayFeature(mapboxMap, feature);
      const bounds = computeBoundsFromGeometry(geometry);
      if (bounds && typeof mapboxMap.fitBounds === 'function') {
        mapboxMap.fitBounds(bounds, { padding: 70, duration: 700, essential: true });
      }
      return;
    }

    if (selectedEntityType === 'layer') {
      const layer = selectedEntity as MapLayerPolygonEntity;
      const geometry = (layer.geometry as GeoJSON.Geometry) || null;
      if (!geometry) {
        setSelectedOverlayFeature(mapboxMap, null);
        return;
      }
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        geometry,
        properties: { layerId: layer.layerId, kind: 'layer' },
      };
      setSelectedOverlayFeature(mapboxMap, feature);
      const bounds = computeBoundsFromGeometry(geometry);
      if (bounds && typeof mapboxMap.fitBounds === 'function') {
        mapboxMap.fitBounds(bounds, { padding: 70, duration: 700, essential: true });
      }
    }
  }, [
    mapLoaded,
    mapInstance,
    selectedEntity,
    selectedEntityType,
    ensureSelectedOverlay,
    setSelectedOverlayFeature,
    computeBoundsFromGeometry,
  ]);

  // Hide all other records while the selection sheet is open; restore on close
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;
    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const isOpen = selectedEntity !== null && selectedEntityType !== null;
    if (isOpen) {
      hideOtherRecordLayers(mapboxMap);
    } else {
      restoreOtherRecordLayers(mapboxMap);
    }
  }, [mapLoaded, mapInstance, selectedEntity, selectedEntityType, hideOtherRecordLayers, restoreOtherRecordLayers]);

  // Apply meta settings to map
  useEffect(() => {
    if (!mapInstance || !mapLoaded || !meta) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    // Apply pitch
    if (meta.pitch !== undefined) {
      mapboxMap.setPitch(meta.pitch);
    }

    // Apply buildings
    if (meta.buildingsEnabled) {
      addBuildingExtrusions(mapInstance, { opacity: 0.6 });
    } else {
      removeBuildingExtrusions(mapInstance);
    }

    // Note: Terrain would be applied here if needed
  }, [mapInstance, mapLoaded, meta]);

  // Fetch pins and areas
  useEffect(() => {
    if (!mapLoaded || !mapId) return;

    const fetchData = async () => {
      try {
        // Fetch pins
        const pinsResponse = await fetch(`/api/maps/${mapId}/pins`);
        if (pinsResponse.ok) {
          const pinsData = await pinsResponse.json();
          setPins(pinsData.pins || []);
        } else if (pinsResponse.status === 404 || pinsResponse.status === 403) {
          setPins([]);
        }

        // Fetch areas
        const areasResponse = await fetch(`/api/maps/${mapId}/areas`);
        if (areasResponse.ok) {
          const areasData = await areasResponse.json();
          setAreas(areasData.areas || []);
        } else if (areasResponse.status === 404 || areasResponse.status === 403) {
          setAreas([]);
        }
      } catch (err) {
        console.error('Error fetching map data:', err);
        setPins([]);
        setAreas([]);
      }
    };

    fetchData();
  }, [mapLoaded, mapId]);

  // Add pins to map
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const geoJSON = {
      type: 'FeatureCollection' as const,
      features: pins
        .filter(pin => pin.lat !== null && pin.lng !== null && !isNaN(pin.lat) && !isNaN(pin.lng))
        .map((pin) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [pin.lng, pin.lat] as [number, number],
          },
          properties: {
            id: pin.id,
            emoji: pin.emoji || '📍',
            caption: pin.caption || '',
          },
        })),
    };
    
    // If no valid pins, remove source/layer if they exist
    if (geoJSON.features.length === 0) {
      try {
        const existingSource = mapboxMap.getSource(PINS_SOURCE_ID);
        if (existingSource) {
          if (mapboxMap.getLayer(PINS_LAYER_ID)) {
            mapboxMap.removeLayer(PINS_LAYER_ID);
          }
          mapboxMap.removeSource(PINS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors
      }
      return;
    }

    try {
      // Check if source exists and is a geojson source
      const existingSource = mapboxMap.getSource(PINS_SOURCE_ID);
      if (existingSource && existingSource.type === 'geojson') {
        // Verify setData method exists before calling
        if (typeof (existingSource as any).setData === 'function') {
          (existingSource as any).setData(geoJSON);
          return;
        }
      }

      // Source doesn't exist or is invalid - need to add/update
      // First, clean up any existing layers (they depend on the source)
      try {
        if (mapboxMap.getLayer(PINS_LAYER_ID)) {
          mapboxMap.removeLayer(PINS_LAYER_ID);
        }
        if (mapboxMap.getSource(PINS_SOURCE_ID)) {
          mapboxMap.removeSource(PINS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors (source/layer may not exist)
      }

      // Add source
      mapboxMap.addSource(PINS_SOURCE_ID, {
        type: 'geojson',
        data: geoJSON,
      });

      // Verify source exists before adding layer
      if (!mapboxMap.getSource(PINS_SOURCE_ID)) {
        console.error('[MapIDBox] Source was not added successfully');
        return;
      }

      // Add layer
      mapboxMap.addLayer({
        id: PINS_LAYER_ID,
        type: 'circle',
        source: PINS_SOURCE_ID,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    } catch (err) {
      console.error('[MapIDBox] Error adding pins to map:', err);
    }
  }, [mapLoaded, mapInstance, pins]);

  // Handle pin clicks
  useEffect(() => {
    if (!mapLoaded || !mapInstance || pinMode || showAreaDrawModal) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const handlePinClick = async (e: any) => {
      const features = mapboxMap.queryRenderedFeatures(e.point, {
        layers: [PINS_LAYER_ID],
      });

      if (features.length === 0) return;

      const feature = features[0];
      const pinId = feature.properties?.id;

      if (!pinId) return;

      // Fetch pin data
      setLoadingEntity(true);
      try {
        const response = await fetch(`/api/maps/${mapId}/pins/${pinId}`);
        if (response.ok) {
          const pinData = await response.json();
          setSelectedEntity(pinData);
          setSelectedEntityType('pin');
        } else {
          console.error('Failed to fetch pin:', response.statusText);
        }
      } catch (err) {
        console.error('Error fetching pin:', err);
      } finally {
        setLoadingEntity(false);
      }
    };

    // Add hover cursor
    const handleMouseEnter = () => {
      const canvas = mapboxMap.getCanvas();
      if (canvas) {
        canvas.style.cursor = 'pointer';
      }
    };
    const handleMouseLeave = () => {
      if (!pinMode) {
        const canvas = mapboxMap.getCanvas();
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
    };

    mapboxMap.on('click', PINS_LAYER_ID, handlePinClick);
    mapboxMap.on('mouseenter', PINS_LAYER_ID, handleMouseEnter);
    mapboxMap.on('mouseleave', PINS_LAYER_ID, handleMouseLeave);

    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('click', PINS_LAYER_ID, handlePinClick);
        mapboxMap.off('mouseenter', PINS_LAYER_ID, handleMouseEnter);
        mapboxMap.off('mouseleave', PINS_LAYER_ID, handleMouseLeave);
      }
    };
  }, [mapLoaded, mapInstance, mapId, pinMode, showAreaDrawModal]);

  // Add areas to map
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const geoJSON = {
      type: 'FeatureCollection' as const,
      features: areas.map((area) => ({
        type: 'Feature' as const,
        geometry: area.geometry,
        properties: {
          id: area.id,
          name: area.name,
          description: area.description || '',
        },
      })),
    };

    // If no valid areas, remove source/layer if they exist
    if (geoJSON.features.length === 0) {
      try {
        if (mapboxMap.getLayer(AREAS_OUTLINE_LAYER_ID)) {
          mapboxMap.removeLayer(AREAS_OUTLINE_LAYER_ID);
        }
        if (mapboxMap.getLayer(AREAS_LAYER_ID)) {
          mapboxMap.removeLayer(AREAS_LAYER_ID);
        }
        const existingSource = mapboxMap.getSource(AREAS_SOURCE_ID);
        if (existingSource) {
          mapboxMap.removeSource(AREAS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors
      }
      return;
    }

    try {
      // Check if source exists and is a geojson source
      const existingSource = mapboxMap.getSource(AREAS_SOURCE_ID);
      if (existingSource && existingSource.type === 'geojson') {
        // Verify setData method exists before calling
        if (typeof (existingSource as any).setData === 'function') {
          (existingSource as any).setData(geoJSON);
          return;
        }
      }

      // Source doesn't exist or is invalid - need to add/update
      // First, clean up any existing layers (they depend on the source)
      try {
        if (mapboxMap.getLayer(AREAS_OUTLINE_LAYER_ID)) {
          mapboxMap.removeLayer(AREAS_OUTLINE_LAYER_ID);
        }
        if (mapboxMap.getLayer(AREAS_LAYER_ID)) {
          mapboxMap.removeLayer(AREAS_LAYER_ID);
        }
        if (mapboxMap.getSource(AREAS_SOURCE_ID)) {
          mapboxMap.removeSource(AREAS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors (source/layer may not exist)
      }

      // Add source
      mapboxMap.addSource(AREAS_SOURCE_ID, {
        type: 'geojson',
        data: geoJSON,
      });

      // Verify source exists before adding layers
      if (!mapboxMap.getSource(AREAS_SOURCE_ID)) {
        console.error('[MapIDBox] Areas source was not added successfully');
        return;
      }

      // Add fill layer
      mapboxMap.addLayer({
        id: AREAS_LAYER_ID,
        type: 'fill',
        source: AREAS_SOURCE_ID,
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.15,
        },
      });

      // Add outline layer
      mapboxMap.addLayer({
        id: AREAS_OUTLINE_LAYER_ID,
        type: 'line',
        source: AREAS_SOURCE_ID,
        paint: {
          'line-color': '#10b981',
          'line-width': 2,
        },
      });
    } catch (err) {
      console.error('[MapIDBox] Error adding areas to map:', err);
    }
  }, [mapLoaded, mapInstance, areas]);

  // Handle area clicks
  useEffect(() => {
    if (!mapLoaded || !mapInstance || pinMode || showAreaDrawModal) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const handleAreaClick = async (e: any) => {
      const features = mapboxMap.queryRenderedFeatures(e.point, {
        layers: [AREAS_LAYER_ID, AREAS_OUTLINE_LAYER_ID],
      });

      if (features.length === 0) return;

      const feature = features[0];
      const areaId = feature.properties?.id;

      if (!areaId) return;

      // Fetch area data
      setLoadingEntity(true);
      try {
        const response = await fetch(`/api/maps/${mapId}/areas/${areaId}`);
        if (response.ok) {
          const areaData = await response.json();
          setSelectedEntity(areaData);
          setSelectedEntityType('area');
        } else {
          console.error('Failed to fetch area:', response.statusText);
        }
      } catch (err) {
        console.error('Error fetching area:', err);
      } finally {
        setLoadingEntity(false);
      }
    };

    // Add hover cursor
    const handleMouseEnter = () => {
      const canvas = mapboxMap.getCanvas();
      if (canvas) {
        canvas.style.cursor = 'pointer';
      }
    };
    const handleMouseLeave = () => {
      if (!pinMode) {
        const canvas = mapboxMap.getCanvas();
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
    };

    mapboxMap.on('click', AREAS_LAYER_ID, handleAreaClick);
    mapboxMap.on('click', AREAS_OUTLINE_LAYER_ID, handleAreaClick);
    mapboxMap.on('mouseenter', AREAS_LAYER_ID, handleMouseEnter);
    mapboxMap.on('mouseleave', AREAS_LAYER_ID, handleMouseLeave);
    mapboxMap.on('mouseenter', AREAS_OUTLINE_LAYER_ID, handleMouseEnter);
    mapboxMap.on('mouseleave', AREAS_OUTLINE_LAYER_ID, handleMouseLeave);

    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('click', AREAS_LAYER_ID, handleAreaClick);
        mapboxMap.off('click', AREAS_OUTLINE_LAYER_ID, handleAreaClick);
        mapboxMap.off('mouseenter', AREAS_LAYER_ID, handleMouseEnter);
        mapboxMap.off('mouseleave', AREAS_LAYER_ID, handleMouseLeave);
        mapboxMap.off('mouseenter', AREAS_OUTLINE_LAYER_ID, handleMouseEnter);
        mapboxMap.off('mouseleave', AREAS_OUTLINE_LAYER_ID, handleMouseLeave);
      }
    };
  }, [mapLoaded, mapInstance, mapId, pinMode, showAreaDrawModal]);

  // Handle boundary polygon clicks + click-to-dismiss on empty map
  useEffect(() => {
    if (!mapLoaded || !mapInstance || pinMode || showAreaDrawModal) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const handleMapClickForSelection = (e: any) => {
      try {
        const features: any[] = mapboxMap.queryRenderedFeatures(e.point);
        if (!Array.isArray(features) || features.length === 0) {
          clearSelection();
          return;
        }

        // If clicking pins/areas, let their layer handlers control selection (and don't dismiss).
        if (features.some((f) => isPinOrAreaLayerId(f?.layer?.id))) {
          return;
        }

        const polygonFeature = features.find((f) => isLayerPolygonLayerId(f?.layer?.id));
        if (polygonFeature) {
          const layerEntity = buildLayerPolygonEntity(polygonFeature);
          if (layerEntity) {
            setSelectedEntity(layerEntity);
            setSelectedEntityType('layer');
            return;
          }
        }

        // Clicked something else on the map; dismiss the sheet
        clearSelection();
      } catch {
        clearSelection();
      }
    };

    mapboxMap.on('click', handleMapClickForSelection);
    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('click', handleMapClickForSelection);
      }
    };
  }, [
    mapLoaded,
    mapInstance,
    pinMode,
    showAreaDrawModal,
    clearSelection,
    isPinOrAreaLayerId,
    isLayerPolygonLayerId,
    buildLayerPolygonEntity,
  ]);

  // Handle map clicks for pin creation (owner only, when pin mode is active)
  useEffect(() => {
    // Only activate if pin mode is on and area draw modal is closed
    if (!mapLoaded || !mapInstance || !isOwner || !pinMode || showAreaDrawModal || clickHandlerAddedRef.current) {
      // Cleanup if pin mode is off or area draw is active
      if (mapInstance && clickHandlerAddedRef.current) {
        const mapboxMap = mapInstance as any;
        if (!mapboxMap.removed) {
          const canvas = mapboxMap.getCanvas();
          if (canvas) {
            canvas.style.cursor = '';
          }
        }
        clickHandlerAddedRef.current = false;
      }
      return;
    }

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const handleMapClick = async (e: any) => {
      // Don't create pin if clicking on existing pin or area
      const features = mapboxMap.queryRenderedFeatures(e.point, {
        layers: [PINS_LAYER_ID, AREAS_LAYER_ID, AREAS_OUTLINE_LAYER_ID],
      });
      if (features.length > 0) return;

      const { lng, lat } = e.lngLat;
      
      // Auto-create pin for owners (no form)
      try {
        const response = await fetch(`/api/maps/${mapId}/pins`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emoji: null,
            caption: null,
            image_url: null,
            video_url: null,
            lat,
            lng,
          }),
        });

        if (response.ok) {
          // Refresh pins list
          const refreshResponse = await fetch(`/api/maps/${mapId}/pins`);
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            setPins(refreshData.pins || []);
          }
          setPinMode(false); // Exit pin mode after creating
        }
      } catch (err) {
        console.error('Error creating pin:', err);
      }
    };

    mapboxMap.on('click', handleMapClick);
    
    // Change cursor to crosshair when in pin mode
    const canvas = mapboxMap.getCanvas();
    if (canvas) {
      canvas.style.cursor = 'crosshair';
    }
    
    clickHandlerAddedRef.current = true;

    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('click', handleMapClick);
        const canvas = mapboxMap.getCanvas();
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
      clickHandlerAddedRef.current = false;
    };
  }, [mapLoaded, isOwner, mapInstance, mapId, pinMode, showAreaDrawModal]);

  // Cleanup pins layer and source on unmount
  useEffect(() => {
    return () => {
      if (mapInstance) {
        const mapboxMap = mapInstance as any;
        try {
          if (mapboxMap.getLayer(PINS_LAYER_ID)) {
            mapboxMap.removeLayer(PINS_LAYER_ID);
          }
          if (mapboxMap.getSource(PINS_SOURCE_ID)) {
            mapboxMap.removeSource(PINS_SOURCE_ID);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [mapInstance]);

  // Handle pin creation
  const handleCreatePin = useCallback(async (data: {
    emoji: string | null;
    caption: string | null;
    image_url: string | null;
    video_url: string | null;
  }) => {
    if (!pinFormCoords) return;

    try {
      const response = await fetch(`/api/maps/${mapId}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          lat: pinFormCoords.lat,
          lng: pinFormCoords.lng,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create pin';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const newPin = await response.json();
      // Refresh pins list to get complete data
      const refreshResponse = await fetch(`/api/maps/${mapId}/pins`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setPins(refreshData.pins || []);
      } else {
        // Fallback: add new pin to list
        setPins((prev) => [newPin, ...prev]);
      }
      setShowPinForm(false);
      setPinFormCoords(null);
    } catch (err) {
      throw err;
    }
  }, [mapId, pinFormCoords]);

  const displayName = account
    ? account.username ||
      (account.first_name && account.last_name
        ? `${account.first_name} ${account.last_name}`.trim()
        : account.first_name || 'User')
    : null;

  // Ensure only one mode is active at a time
  useEffect(() => {
    if (pinMode && showAreaDrawModal) {
      // If both are active, close area draw modal when pin mode activates
      setShowAreaDrawModal(false);
    }
  }, [pinMode]);

  // Update cursor when modes change
  useEffect(() => {
    if (!mapInstance || !mapLoaded) return;
    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const canvas = mapboxMap.getCanvas();
    if (canvas) {
      // If area draw modal is open, don't change cursor (draw tool handles it)
      if (showAreaDrawModal) {
        canvas.style.cursor = '';
      } else {
        canvas.style.cursor = pinMode ? 'crosshair' : '';
      }
    }
  }, [pinMode, showAreaDrawModal, mapInstance, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      {/* Map Info Card - Replaces all floating elements */}
      {mapLoaded && (
        <>
          <MapInfoCard
            title={title}
            description={description}
            account={account}
            viewCount={viewCount}
            isOwner={isOwner}
            hideCreator={hideCreator}
            mapId={mapId}
            onInfoClick={() => setShowInfoModal(true)}
            onPinClick={() => {
              if (pinMode) {
                setPinMode(false);
              } else {
                clearSelection();
                setPinMode(true);
                setShowAreaDrawModal(false);
              }
            }}
            onDrawClick={() => {
              if (showAreaDrawModal) {
                setShowAreaDrawModal(false);
              } else {
                clearSelection();
                setShowAreaDrawModal(true);
                setPinMode(false);
              }
            }}
            pinMode={pinMode}
            showAreaDrawModal={showAreaDrawModal}
          />

          {/* Saved boundary layers (exclusive, persisted via map.map_layers) */}
          <CongressionalDistrictsLayer
            map={mapInstance}
            mapLoaded={mapLoaded}
            visible={showDistricts}
          />
          <CTUBoundariesLayer map={mapInstance} mapLoaded={mapLoaded} visible={showCTU} />
          <CountyBoundariesLayer
            map={mapInstance}
            mapLoaded={mapLoaded}
            visible={showCountyBoundaries}
          />
          <StateBoundaryLayer map={mapInstance} mapLoaded={mapLoaded} visible={showStateBoundary} />
        </>
      )}

      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-t-3xl overflow-hidden"
        style={{ margin: 0, padding: 0 }}
      />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <div className="text-gray-600 text-xs font-medium">Loading map...</div>
          </div>
        </div>
      )}
      {showPinForm && pinFormCoords && (
        <MapPinForm
          isOpen={showPinForm}
          lat={pinFormCoords.lat}
          lng={pinFormCoords.lng}
          mapId={mapId}
          onClose={() => {
            setShowPinForm(false);
            setPinFormCoords(null);
          }}
          onSubmit={handleCreatePin}
          onPinCreated={async (pinId) => {
            // Refresh pins after creation
            try {
              const response = await fetch(`/api/maps/${mapId}/pins`);
              if (response.ok) {
                const data = await response.json();
                setPins(data.pins || []);
              }
            } catch (err) {
              console.error('Error refreshing pins:', err);
            }
          }}
        />
      )}


      {/* Area Draw Modal */}
      {isOwner && (
        <MapAreaDrawModal
          isOpen={showAreaDrawModal}
          onClose={() => {
            setShowAreaDrawModal(false);
            setPinMode(false); // Ensure pin mode is off when closing draw modal
          }}
          mapId={mapId}
          mapInstance={mapInstance}
          mapLoaded={mapLoaded}
          mapStyle={mapStyle}
          autoSave={true}
          onAreaCreated={async () => {
            // Refresh areas list
            try {
              const response = await fetch(`/api/maps/${mapId}/areas`);
              if (response.ok) {
                const data = await response.json();
                setAreas(data.areas || []);
              }
            } catch (err) {
              console.error('Error refreshing areas:', err);
            }
          }}
        />
      )}

      {/* Info Modal */}
      {title && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-[10px] transition-opacity ${
            showInfoModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowInfoModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-md border border-gray-200 flex flex-col max-h-[90vh] shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Map Information</h2>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-[10px]">
              <MapIDDetails
                title={title}
                description={description || null}
                map_style={mapStyle}
                visibility={visibility || 'private'}
                viewCount={viewCount || null}
                account={account || null}
                map_account_id={map_account_id || ''}
                current_account_id={current_account_id || null}
                hideCreator={hideCreator}
                created_at={created_at}
                updated_at={updated_at}
              />
            </div>
          </div>
        </div>
      )}

      {/* Entity Slide-Up Modal */}
      <MapEntitySlideUp
        isOpen={selectedEntity !== null && selectedEntityType !== null}
        onClose={() => {
          setSelectedEntity(null);
          setSelectedEntityType(null);
        }}
        entity={selectedEntity}
        entityType={selectedEntityType}
        isOwner={isOwner}
        mapId={mapId}
        onEntityDeleted={async () => {
          // Refresh pins or areas list
          try {
            if (selectedEntityType === 'pin') {
              const response = await fetch(`/api/maps/${mapId}/pins`);
              if (response.ok) {
                const data = await response.json();
                setPins(data.pins || []);
              }
            } else if (selectedEntityType === 'area') {
              const response = await fetch(`/api/maps/${mapId}/areas`);
              if (response.ok) {
                const data = await response.json();
                setAreas(data.areas || []);
              }
            }
          } catch (err) {
            console.error('Error refreshing entities:', err);
          }
        }}
        onEntityUpdated={async (updatedEntity) => {
          // Update the selected entity and refresh the list
          setSelectedEntity(updatedEntity);
          try {
            if (selectedEntityType === 'pin') {
              const response = await fetch(`/api/maps/${mapId}/pins`);
              if (response.ok) {
                const data = await response.json();
                setPins(data.pins || []);
              }
            }
          } catch (err) {
            console.error('Error refreshing entities:', err);
          }
        }}
      />
    </div>
  );
}

