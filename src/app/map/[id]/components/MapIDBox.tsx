'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, EyeIcon, Cog6ToothIcon, MapPinIcon, PencilSquareIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useMapboxMap } from '../hooks/useMapboxMap';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import MapPinForm from './MapPinForm';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import MapIdSettingsModal from './MapIdSettingsModal';
import MapAreaDrawModal from './MapAreaDrawModal';
import MapIDDetails from './MapIDDetails';
import MapEntitySlideUp from './MapEntitySlideUp';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { MapboxMapInstance } from '@/types/mapbox-events';

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

const PINS_SOURCE_ID = 'map-pins';
const PINS_LAYER_ID = 'map-pins-points';
const AREAS_SOURCE_ID = 'map-areas';
const AREAS_LAYER_ID = 'map-areas-fill';
const AREAS_OUTLINE_LAYER_ID = 'map-areas-outline';

export default function MapIDBox({ mapStyle, mapId, isOwner, meta, title, description, visibility, account, viewCount, onMapLoad, onMapUpdate, map_account_id, current_account_id, created_at, updated_at }: MapIDBoxProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const { account: currentAccount } = useAuthStateSafe();
  const { openUpgrade, openAccount, openWelcome } = useAppModalContextSafe();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [showAreaDrawModal, setShowAreaDrawModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<MapPin | MapArea | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<'pin' | 'area' | null>(null);
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
      mapboxMap.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      if (!pinMode) {
        mapboxMap.getCanvas().style.cursor = '';
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
      mapboxMap.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      if (!pinMode) {
        mapboxMap.getCanvas().style.cursor = '';
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

  // Truncate title to 25 characters
  const truncatedTitle = title && title.length > 25 ? `${title.slice(0, 25)}...` : title;
  
  // Truncate username to 5 characters
  const truncatedUsername = account?.username && account.username.length > 5 
    ? `${account.username.slice(0, 5)}...` 
    : account?.username;

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
      {/* Floating Header Container */}
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-50 flex items-center gap-2 sm:gap-3">
        {/* Floating Header */}
        {(title || account) && (
          <div className="group bg-white/95 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm transition-all hover:bg-white">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-[10px] sm:py-[10px] h-8 sm:h-auto">
              {/* Back Arrow */}
              <button
                onClick={() => router.push('/maps')}
                className="flex-shrink-0 p-0.5 sm:p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                aria-label="Back to Maps"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* Map Title */}
              {truncatedTitle && (
                <div className="flex items-center gap-1">
                  <h1 className="text-[10px] sm:text-xs font-semibold text-gray-900 truncate max-w-[120px] sm:max-w-[200px] group-hover:max-w-[250px] transition-all">
                    {truncatedTitle}
                  </h1>
                  {isOwner && (
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      className="flex-shrink-0 p-0.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      aria-label="Map Settings"
                    >
                      <Cog6ToothIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Owner Info */}
              {account && (
                <div className="flex items-center gap-1 sm:gap-1.5 pl-1.5 sm:pl-2 border-l border-gray-200">
                  {account.image_url ? (
                    <Link
                      href={account.username ? `/profile/${account.username}` : '#'}
                      className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-gray-200"
                    >
                      <Image
                        src={account.image_url}
                        alt={displayName || 'User'}
                        width={24}
                        height={24}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </Link>
                  ) : (
                    <Link
                      href={account.username ? `/profile/${account.username}` : '#'}
                      className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-200 flex items-center justify-center border border-gray-200"
                    >
                      <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium">
                        {(account.first_name?.[0] || account.username?.[0] || 'U').toUpperCase()}
                      </span>
                    </Link>
                  )}
                  {truncatedUsername && (
                    <Link
                      href={`/profile/${account.username}`}
                      className="hidden sm:inline text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors truncate max-w-[100px] sm:max-w-[120px] group-hover:max-w-[150px]"
                      title={account.username || undefined}
                    >
                      @{truncatedUsername}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Top Right Controls - Account & Upgrade */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
        {/* Upgrade Button */}
        {currentAccount?.plan === 'hobby' && (
          <button
            onClick={() => openUpgrade()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
          >
            Upgrade
          </button>
        )}
        {/* Account Dropdown */}
        <AccountDropdown
          variant="light"
          onAccountClick={() => openAccount('settings')}
          onSignInClick={() => openWelcome()}
        />
      </div>

      {/* Floating View Count - Bottom Left */}
      {viewCount !== null && viewCount !== undefined && (
        <div className="absolute bottom-3 left-3 z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm transition-all hover:bg-white h-8 sm:h-auto">
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-[10px] sm:py-[10px] h-full">
              <EyeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
              <span className="text-[10px] sm:text-xs font-medium text-gray-700">
                {viewCount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={mapContainer} 
        className="w-full h-full"
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

      {/* Floating Action Buttons - Info, Pin and Draw */}
      {mapLoaded && (
        <div className="absolute bottom-3 right-3 z-50 flex flex-col gap-2">
          {/* Info Button - Always visible */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full border shadow-sm transition-all bg-white/95 backdrop-blur-sm text-gray-700 border-gray-200 hover:bg-white"
            aria-label="Map Information"
            title="Map Information"
          >
            <InformationCircleIcon className="w-5 h-5" />
          </button>

          {/* Pin Button - Owner only */}
          {isOwner && (
            <button
              onClick={() => {
                if (pinMode) {
                  // Toggle off pin mode
                  setPinMode(false);
                } else {
                  // Activate pin mode, deactivate draw mode
                  setPinMode(true);
                  setShowAreaDrawModal(false);
                }
              }}
              className={`flex items-center justify-center w-10 h-10 rounded-full border shadow-sm transition-all ${
                pinMode
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white/95 backdrop-blur-sm text-gray-700 border-gray-200 hover:bg-white'
              }`}
              aria-label="Add Pin"
              title={pinMode ? 'Exit Pin Mode' : 'Add Pin'}
            >
              <MapPinIcon className="w-5 h-5" />
            </button>
          )}

          {/* Draw/Area Button - Owner only */}
          {isOwner && (
            <button
              onClick={() => {
                if (showAreaDrawModal) {
                  // Close area draw modal
                  setShowAreaDrawModal(false);
                } else {
                  // Open area draw modal, deactivate pin mode
                  setShowAreaDrawModal(true);
                  setPinMode(false);
                }
              }}
              className={`flex items-center justify-center w-10 h-10 rounded-full border shadow-sm transition-all ${
                showAreaDrawModal
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white/95 backdrop-blur-sm text-gray-700 border-gray-200 hover:bg-white'
              }`}
              aria-label="Draw Area"
              title={showAreaDrawModal ? 'Close Draw Tool' : 'Draw Area'}
            >
              <PencilSquareIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {isOwner && (
        <MapIdSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          mapId={mapId}
          initialData={{
            title: title || '',
            description: description || null,
            visibility: visibility || 'private',
            map_style: mapStyle,
            meta: meta || null,
          }}
          onUpdate={(updatedData) => {
            if (onMapUpdate) {
              onMapUpdate(updatedData);
            }
            // Refresh the page to show updated data
            if (typeof window !== 'undefined') {
              window.location.reload();
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

