'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { PlusIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useAuthStateSafe } from '@/features/auth';
import LiveAccountModal from '@/components/layout/LiveAccountModal';
import BuildingDetailView from './BuildingDetailView';
import BuildingEditModal from './BuildingEditModal';
import PrecinctModal from './PrecinctModal';

interface Building {
  id: string;
  type: 'state' | 'city' | 'town' | 'federal';
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  full_address: string | null;
  cover_images: string[] | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

export default function GovMapAdminClient() {
  const [map, setMap] = useState<MapboxMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Debug: Log modal state changes
  useEffect(() => {
    console.log('[GovMapAdmin] Modal state changed:', { isModalOpen, editingBuilding: editingBuilding?.id || null });
  }, [isModalOpen, editingBuilding]);
  
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const markersRef = useRef<Map<any, any>>(new Map());
  const tempMarkerRef = useRef<any>(null); // Temporary marker for pending building
  const [showLiveAccountModal, setShowLiveAccountModal] = useState(false);
  const { account } = useAuthStateSafe();
  const buildingsLayerRef = useRef<{
    sourceId: string; 
    iconLayerId: string;
    labelLayerId: string;
    clickHandler?: (e: any) => void;
  } | null>(null);
  const isAddingLayersRef = useRef<boolean>(false);
  const buildingsCacheRef = useRef<Map<string, Building>>(new Map()); // Cache buildings by ID
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iconsLoadedRef = useRef<Set<string>>(new Set<string>()); // Track which icons are loaded
  
  // Congressional districts state
  const [districts, setDistricts] = useState<any[]>([]);
  const [showDistricts, setShowDistricts] = useState(false);
  const [hoveredDistrict, setHoveredDistrict] = useState<any | null>(null);
  const [selectedPrecinct, setSelectedPrecinct] = useState<any | null>(null);
  const [isPrecinctModalOpen, setIsPrecinctModalOpen] = useState(false);
  const [isEditingBuildingLocation, setIsEditingBuildingLocation] = useState(false);

  // Load building type icons
  const loadBuildingIcons = useCallback(async (mapboxMap: any): Promise<void> => {
    const iconTypes: Array<'state' | 'city' | 'town' | 'federal'> = ['state', 'city', 'town', 'federal'];
    
    const loadPromises = iconTypes.map(async (type) => {
      const imageId = `building-icon-${type}`;
      
      // Skip if already loaded
      if (iconsLoadedRef.current.has(type) || mapboxMap.hasImage(imageId)) {
        iconsLoadedRef.current.add(type);
        return;
      }

      try {
        // URL encode the path to handle spaces in folder name
        const iconPath = `/civic%20building%20icons/${type}.png`;
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = iconPath;
        });

        // Create canvas to resize image to 32x32 for map pins
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, 32, 32);
          
          const imageData = ctx.getImageData(0, 0, 32, 32);
          mapboxMap.addImage(imageId, imageData, { pixelRatio: 2 });
          iconsLoadedRef.current.add(type);
          console.log(`[GovMapAdmin] ✅ Loaded icon for ${type}`);
        }
      } catch (error) {
        console.error(`[GovMapAdmin] Failed to load icon for ${type}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }, []);

  // Initialize map
  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      try {
        await loadMapboxGL();
        const mapbox = (await import('mapbox-gl')).default;
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainerRef.current || !mounted) return;

        const mapInstance = new mapbox.Map({
          container: mapContainerRef.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            setMap(mapInstance as MapboxMapInstance);
          }
        });

        // Handle map click - open building form (disabled, using address search instead)
        // mapInstance.on('click', async (e: any) => {
        //   // Disabled - using address search to create buildings
        // });
        
        // Store map instance for location editing handler
        (mapInstance as any).__locationEditHandler = null;
      } catch (err) {
        console.error('[GovMapAdmin] Failed to initialize map:', err);
      }
    };

    initMap();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle building marker click - open edit form for existing building
  const handleBuildingMarkerClick = useCallback((building: Building) => {
    console.log('[GovMapAdmin] handleBuildingMarkerClick called with:', building);
    console.log('[GovMapAdmin] Setting editingBuilding and isModalOpen to true');
    setEditingBuilding(building); // Set building = edit mode
    setIsModalOpen(true);
    console.log('[GovMapAdmin] State updated - modal should open');
  }, []);

  // Step 1: Initialize with static GeoJSON point (icon layer)
  const initializeBuildingsLayer = useCallback(async (): Promise<void> => {
    if (!map || !mapLoaded || isAddingLayersRef.current) return;

    const mapboxMap = map as any;
    const sourceId = 'admin-buildings';
    const iconLayerId = 'admin-buildings-icon';
    const labelLayerId = 'admin-buildings-label';

    isAddingLayersRef.current = true;

    try {
      // Load building type icons first
      await loadBuildingIcons(mapboxMap);

      // Step 1: Static hardcoded point (Minneapolis coordinates)
      const staticGeoJSON = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [-93.2650, 44.9778], // Minneapolis
            },
            properties: {
              id: 'test-1',
              name: 'Test Building',
              type: 'state',
            },
          },
        ],
      };

      // Add source
      if (!mapboxMap.getSource(sourceId)) {
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: staticGeoJSON,
        });
      } else {
        const source = mapboxMap.getSource(sourceId) as any;
        if (source && source.setData) {
          source.setData(staticGeoJSON);
        }
      }

      // Add icon layer
      if (!mapboxMap.getLayer(iconLayerId)) {
        mapboxMap.addLayer({
          id: iconLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'icon-image': [
              'match',
              ['get', 'type'],
              'state', 'building-icon-state',
              'city', 'building-icon-city',
              'town', 'building-icon-town',
              'federal', 'building-icon-federal',
              'building-icon-state' // fallback
            ],
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0.5,    // At zoom 0, size is 0.5
              5, 0.75,   // At zoom 5, size is 0.75
              10, 1.0,   // At zoom 10, size is 1.0
              12, 1.25,  // At zoom 12, size is 1.25
              14, 1.5,   // At zoom 14, size is 1.5
              16, 1.75,  // At zoom 16, size is 1.75
              18, 2.0,   // At zoom 18, size is 2.0
              20, 2.5,   // At zoom 20, size is 2.5
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': false,
          },
        });

        // Add label layer
        if (!mapboxMap.getLayer(labelLayerId)) {
          mapboxMap.addLayer({
            id: labelLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
              'text-offset': [0, 1.5],
              'text-anchor': 'top',
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 9,   // Smaller at zoom 10
                12, 11,  // Base size at zoom 12
                14, 13,  // Larger at zoom 14
                16, 15,  // Larger at zoom 16
                18, 17,  // Larger at zoom 18
                20, 19   // Largest at max zoom
              ],
            },
            paint: {
              'text-color': '#333333',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
          });
        }

        // Attach click handler immediately after layer creation
        const clickHandler = (e: any) => {
          e.preventDefault();
          const feature = e.features?.[0];
          if (feature && feature.properties) {
            const buildingId = feature.properties.id;
            // For static test point, buildingId will be 'test-1', skip edit modal
            if (buildingId === 'test-1') {
              console.log('[GovMapAdmin] Test point clicked (no building data)');
              return;
            }
            // Lookup building from cache
            const building = buildingsCacheRef.current.get(buildingId);
            if (building) {
              handleBuildingMarkerClick(building);
            } else {
              console.warn('[GovMapAdmin] Building not found in cache:', buildingId);
            }
          }
        };

        mapboxMap.on('click', iconLayerId, clickHandler);
        mapboxMap.on('click', labelLayerId, clickHandler);

        // Store handler in ref for cleanup
        buildingsLayerRef.current = {
          sourceId,
          iconLayerId,
          labelLayerId,
          clickHandler,
        };

        // Change cursor on hover
        mapboxMap.on('mouseenter', iconLayerId, () => {
          mapboxMap.getCanvas().style.cursor = 'pointer';
        });
        mapboxMap.on('mouseleave', iconLayerId, () => {
          mapboxMap.getCanvas().style.cursor = '';
        });
        mapboxMap.on('mouseenter', labelLayerId, () => {
          mapboxMap.getCanvas().style.cursor = 'pointer';
        });
        mapboxMap.on('mouseleave', labelLayerId, () => {
          mapboxMap.getCanvas().style.cursor = '';
        });

        console.log('[GovMapAdmin] ✅ Static icon layer added - check map for building icon at Minneapolis');
      }
    } catch (error) {
      console.error('[GovMapAdmin] Error initializing buildings layer:', error);
    } finally {
      isAddingLayersRef.current = false;
    }
  }, [map, mapLoaded, handleBuildingMarkerClick, loadBuildingIcons]);

  // Step 2: Update with API data (still using circle layer)
  const updateBuildingMarkers = useCallback(async (buildingsList: Building[]): Promise<void> => {
    if (!map || !mapLoaded || isAddingLayersRef.current) return;

    const mapboxMap = map as any;
    const sourceId = 'admin-buildings';
    const iconLayerId = 'admin-buildings-icon';
    const labelLayerId = 'admin-buildings-label';

    isAddingLayersRef.current = true;

    try {
      // Load icons if not already loaded
      await loadBuildingIcons(mapboxMap);

      // Clean up existing click handler before re-creating layer
      if (buildingsLayerRef.current) {
        const { iconLayerId: oldIconLayerId, labelLayerId: oldLabelLayerId, clickHandler: oldHandler } = buildingsLayerRef.current;
        if (oldHandler) {
          if (oldIconLayerId && mapboxMap.getLayer(oldIconLayerId)) {
            mapboxMap.off('click', oldIconLayerId, oldHandler);
            mapboxMap.off('mouseenter', oldIconLayerId);
            mapboxMap.off('mouseleave', oldIconLayerId);
          }
          if (oldLabelLayerId && mapboxMap.getLayer(oldLabelLayerId)) {
            mapboxMap.off('click', oldLabelLayerId, oldHandler);
          }
        }
      }

      // Filter buildings with valid coordinates
      const validBuildings = buildingsList.filter(b => b.lat != null && b.lng != null);
      
      if (validBuildings.length === 0) {
        console.log('[GovMapAdmin] No valid buildings to display');
        isAddingLayersRef.current = false;
        return;
      }

      // Convert buildings to GeoJSON
      const geoJSON = {
        type: 'FeatureCollection' as const,
        features: validBuildings.map(building => ({
          type: 'Feature' as const,
          id: building.id,
          geometry: {
            type: 'Point' as const,
            coordinates: [building.lng!, building.lat!],
          },
          properties: {
            id: building.id,
            name: building.name,
            type: building.type,
            full_address: building.full_address,
            description: building.description,
          },
        })),
      };

      // Update source data
      if (mapboxMap.getSource(sourceId)) {
        const source = mapboxMap.getSource(sourceId) as any;
        if (source && source.setData) {
          source.setData(geoJSON);
          console.log(`[GovMapAdmin] ✅ Updated source with ${validBuildings.length} buildings from API`);
        }
      } else {
        // Create source if it doesn't exist
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
        });
      }

      // Define click handler (reusable)
      const clickHandler = (e: any) => {
        console.log('[GovMapAdmin] Building layer clicked', e);
        e.preventDefault();
        const feature = e.features?.[0];
        console.log('[GovMapAdmin] Clicked feature:', feature);
        
        if (!feature) {
          console.warn('[GovMapAdmin] No feature found in click event');
          return;
        }
        
        if (!feature.properties) {
          console.warn('[GovMapAdmin] Feature has no properties:', feature);
          return;
        }
        
        const buildingId = feature.properties.id;
        console.log('[GovMapAdmin] Building ID from click:', buildingId);
        console.log('[GovMapAdmin] Cache size:', buildingsCacheRef.current.size);
        console.log('[GovMapAdmin] Cache keys:', Array.from(buildingsCacheRef.current.keys()));
        
        // Lookup building from cache (has all buildings, not just visible ones)
        const building = buildingsCacheRef.current.get(buildingId);
        if (building) {
          console.log('[GovMapAdmin] Found building in cache, opening modal:', building);
          handleBuildingMarkerClick(building);
        } else {
          console.warn('[GovMapAdmin] Building not found in cache:', buildingId);
          console.warn('[GovMapAdmin] Available building IDs:', Array.from(buildingsCacheRef.current.keys()));
        }
      };

      // Add icon layer if it doesn't exist
      if (!mapboxMap.getLayer(iconLayerId)) {
        mapboxMap.addLayer({
          id: iconLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'icon-image': [
              'match',
              ['get', 'type'],
              'state', 'building-icon-state',
              'city', 'building-icon-city',
              'town', 'building-icon-town',
              'federal', 'building-icon-federal',
              'building-icon-state' // fallback
            ],
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0.5,    // At zoom 0, size is 0.5
              5, 0.75,   // At zoom 5, size is 0.75
              10, 1.0,   // At zoom 10, size is 1.0
              12, 1.25,  // At zoom 12, size is 1.25
              14, 1.5,   // At zoom 14, size is 1.5
              16, 1.75,  // At zoom 16, size is 1.75
              18, 2.0,   // At zoom 18, size is 2.0
              20, 2.5,   // At zoom 20, size is 2.5
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': false,
          },
        });

        // Add label layer if it doesn't exist
        if (!mapboxMap.getLayer(labelLayerId)) {
          mapboxMap.addLayer({
            id: labelLayerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
              'text-offset': [0, 1.5],
              'text-anchor': 'top',
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 9,   // Smaller at zoom 10
                12, 11,  // Base size at zoom 12
                14, 13,  // Larger at zoom 14
                16, 15,  // Larger at zoom 16
                18, 17,  // Larger at zoom 18
                20, 19   // Largest at max zoom
              ],
            },
            paint: {
              'text-color': '#333333',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
          });
        }

        // Attach click handler to both icon and label layers
        mapboxMap.on('click', iconLayerId, clickHandler);
        mapboxMap.on('click', labelLayerId, clickHandler);
        console.log('[GovMapAdmin] Click handler attached to NEW layers:', iconLayerId, labelLayerId);

        // Store handler in ref for cleanup
        buildingsLayerRef.current = {
          sourceId,
          iconLayerId,
          labelLayerId,
          clickHandler,
        };

        // Change cursor on hover
        mapboxMap.on('mouseenter', iconLayerId, () => {
          mapboxMap.getCanvas().style.cursor = 'pointer';
        });
        mapboxMap.on('mouseleave', iconLayerId, () => {
          mapboxMap.getCanvas().style.cursor = '';
        });
        mapboxMap.on('mouseenter', labelLayerId, () => {
          mapboxMap.getCanvas().style.cursor = 'pointer';
        });
        mapboxMap.on('mouseleave', labelLayerId, () => {
          mapboxMap.getCanvas().style.cursor = '';
        });
      } else {
        // Layer already exists - ensure click handler is attached
        // Remove old handlers if they exist
        if (buildingsLayerRef.current?.clickHandler) {
          mapboxMap.off('click', iconLayerId, buildingsLayerRef.current.clickHandler);
          mapboxMap.off('click', labelLayerId, buildingsLayerRef.current.clickHandler);
        }
        
        // Attach new handlers
        mapboxMap.on('click', iconLayerId, clickHandler);
        mapboxMap.on('click', labelLayerId, clickHandler);
        console.log('[GovMapAdmin] Click handler re-attached to EXISTING layers:', iconLayerId, labelLayerId);
        
        // Update ref
        buildingsLayerRef.current = {
          sourceId,
          iconLayerId,
          labelLayerId,
          clickHandler,
        };
      }
    } catch (error) {
      console.error('[GovMapAdmin] Error updating building markers:', error);
    } finally {
      isAddingLayersRef.current = false;
    }
  }, [map, mapLoaded, handleBuildingMarkerClick]);

  // Fetch buildings based on map bounds (spatial query)
  const fetchBuildingsInBounds = useCallback(async (bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number }): Promise<void> => {
    try {
      const params = new URLSearchParams({
        minLng: bounds.minLng.toString(),
        maxLng: bounds.maxLng.toString(),
        minLat: bounds.minLat.toString(),
        maxLat: bounds.maxLat.toString(),
      });
      
      const response = await fetch(`/api/admin/buildings?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch buildings' }));
        
        if (response.status === 403) {
          console.warn('[GovMapAdmin] Unauthorized - admin access required');
          return;
        }
        
        console.error('[GovMapAdmin] Error fetching buildings:', errorData.error || 'Unknown error');
        return;
      }
      
      const data = await response.json();
      const newBuildings = Array.isArray(data) ? data : [];
      
      // Update cache
      newBuildings.forEach((building: Building) => {
        buildingsCacheRef.current.set(building.id, building);
      });
      
      console.log('[GovMapAdmin] Cached buildings:', {
        count: buildingsCacheRef.current.size,
        ids: Array.from(buildingsCacheRef.current.keys()),
        buildings: Array.from(buildingsCacheRef.current.values()).map(b => ({ id: b.id, name: b.name }))
      });
      
      // Update state with all cached buildings (for edit functionality)
      setBuildings(Array.from(buildingsCacheRef.current.values()));
      
      // Update map layer with buildings in current bounds
      await updateBuildingMarkers(newBuildings);
    } catch (error) {
      console.error('[GovMapAdmin] Error fetching buildings:', error);
    }
  }, [updateBuildingMarkers]);

  // Step 1: Initialize with static point first
  useEffect(() => {
    if (map && mapLoaded) {
      initializeBuildingsLayer();
    }
  }, [map, mapLoaded, initializeBuildingsLayer]);

  // Step 2: Then fetch API data after a short delay
  useEffect(() => {
    if (map && mapLoaded) {
      // Wait 1 second to confirm static point appears, then fetch API data
      const timer = setTimeout(() => {
        const mapboxMap = map as any;
        const bounds = mapboxMap.getBounds();
        if (bounds) {
          fetchBuildingsInBounds({
            minLng: bounds.getWest(),
            maxLng: bounds.getEast(),
            minLat: bounds.getSouth(),
            maxLat: bounds.getNorth(),
          });
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [map, mapLoaded, fetchBuildingsInBounds]);

  // Re-fetch on map move/zoom (debounced)
  useEffect(() => {
    if (!map || !mapLoaded) return;

    const mapboxMap = map as any;
    
    const handleMapMove = () => {
      // Clear existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Debounce fetch by 300ms
      fetchTimeoutRef.current = setTimeout(() => {
        const bounds = mapboxMap.getBounds();
        if (bounds) {
          fetchBuildingsInBounds({
            minLng: bounds.getWest(),
            maxLng: bounds.getEast(),
            minLat: bounds.getSouth(),
            maxLat: bounds.getNorth(),
          });
        }
      }, 300);
    };

    mapboxMap.on('moveend', handleMapMove);
    mapboxMap.on('zoomend', handleMapMove);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      mapboxMap.off('moveend', handleMapMove);
      mapboxMap.off('zoomend', handleMapMove);
    };
  }, [map, mapLoaded, fetchBuildingsInBounds]);

  // Fetch congressional districts
  useEffect(() => {
    if (!mapLoaded || !map) return;
    
    const fetchDistricts = async () => {
      try {
        const response = await fetch('/api/civic/congressional-districts');
        if (!response.ok) throw new Error('Failed to fetch districts');
        const data = await response.json();
        setDistricts(data);
        console.log('[GovMapAdmin] Loaded districts:', data.length);
      } catch (error) {
        console.error('[GovMapAdmin] Failed to fetch districts:', error);
      }
    };
    
    fetchDistricts();
  }, [mapLoaded, map]);

  // Render congressional districts on map
  useEffect(() => {
    if (!map || !mapLoaded || districts.length === 0 || !showDistricts) {
      // Clean up if hiding districts
      if (!showDistricts && map) {
        const mapboxMap = map as any;
        districts.forEach((district) => {
          const districtNum = district.district_number;
          const fillLayerId = `congressional-district-${districtNum}-fill`;
          const outlineLayerId = `congressional-district-${districtNum}-outline`;
          const sourceId = `congressional-district-${districtNum}-source`;
          
          try {
            if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
            if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
            if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
          } catch (e) {
            // Ignore cleanup errors
          }
        });
      }
      return;
    }
    
    const mapboxMap = map as any;
    
    // Color palette for 8 districts
    const districtColors = [
      '#FF6B6B', // District 1 - Red
      '#4ECDC4', // District 2 - Teal
      '#45B7D1', // District 3 - Blue
      '#96CEB4', // District 4 - Green
      '#FFEAA7', // District 5 - Yellow
      '#DDA15E', // District 6 - Orange
      '#BC6C25', // District 7 - Brown
      '#6C5CE7', // District 8 - Purple
    ];
    
    districts.forEach((district) => {
      const districtNum = district.district_number;
      const sourceId = `congressional-district-${districtNum}-source`;
      const fillLayerId = `congressional-district-${districtNum}-fill`;
      const outlineLayerId = `congressional-district-${districtNum}-outline`;
      const color = districtColors[districtNum - 1] || '#888888';
      
      // Remove existing layers/sources if they exist
      try {
        if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
        if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
        if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
      } catch (e) {
        // Ignore errors if layers don't exist
      }
      
      // The geometry column contains a FeatureCollection
      const featureCollection = district.geometry;
      
      // Validate it's a FeatureCollection
      if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
        console.warn(`[GovMapAdmin] Invalid geometry for district ${districtNum}`);
        return;
      }
      
      // Add source with the FeatureCollection
      mapboxMap.addSource(sourceId, {
        type: 'geojson',
        data: featureCollection,
      });
      
      // Add fill layer (before building layers so buildings appear on top)
      mapboxMap.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': color,
          'fill-opacity': 0.2, // Semi-transparent
        },
        // Ensure the layer is interactive
        interactive: true,
      }, 'admin-buildings-icon'); // Insert before building icon layer
      
      // Add outline layer
      mapboxMap.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': color,
          'line-width': 2,
          'line-opacity': 0.8,
        },
      }, 'admin-buildings-icon'); // Insert before building icon layer
      
      // Create highlight source and layers for individual precinct highlighting
      const highlightSourceId = `congressional-district-${districtNum}-highlight-source`;
      const highlightFillLayerId = `congressional-district-${districtNum}-highlight-fill`;
      const highlightOutlineLayerId = `congressional-district-${districtNum}-highlight-outline`;
      
      // Add highlight source (empty initially)
      if (!mapboxMap.getSource(highlightSourceId)) {
        mapboxMap.addSource(highlightSourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });
      }
      
      // Add highlight fill layer (above the regular district layers)
      if (!mapboxMap.getLayer(highlightFillLayerId)) {
        mapboxMap.addLayer({
          id: highlightFillLayerId,
          type: 'fill',
          source: highlightSourceId,
          paint: {
            'fill-color': color,
            'fill-opacity': 0.5, // More opaque than regular districts
          },
        }, 'admin-buildings-icon');
      }
      
      // Add highlight outline layer
      if (!mapboxMap.getLayer(highlightOutlineLayerId)) {
        mapboxMap.addLayer({
          id: highlightOutlineLayerId,
          type: 'line',
          source: highlightSourceId,
          paint: {
            'line-color': color,
            'line-width': 3,
            'line-opacity': 1,
          },
        }, 'admin-buildings-icon');
      }
      
      // Add hover handlers - get specific feature at cursor
      // Use mousemove on the fill layer to detect hover anywhere in the polygon
      const handleMouseMove = (e: any) => {
        mapboxMap.getCanvas().style.cursor = 'pointer';
        
        // Query the exact feature at the cursor position - prioritize fill layer
        const features = mapboxMap.queryRenderedFeatures(e.point, {
          layers: [fillLayerId], // Only query fill layer for polygon area
        });
        
        if (features.length > 0) {
          const feature = features[0];
          const properties = feature.properties || {};
          
          // Highlight only this specific precinct
          const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
          if (highlightSource && highlightSource.setData) {
            highlightSource.setData({
              type: 'FeatureCollection',
              features: [feature], // Only the hovered precinct
            });
          }
          
          // Fade all other districts
          districts.forEach((otherDistrict) => {
            if (otherDistrict.district_number !== districtNum) {
              const otherFillLayerId = `congressional-district-${otherDistrict.district_number}-fill`;
              const otherOutlineLayerId = `congressional-district-${otherDistrict.district_number}-outline`;
              
              try {
                if (mapboxMap.getLayer(otherFillLayerId)) {
                  mapboxMap.setPaintProperty(otherFillLayerId, 'fill-opacity', 0.05); // Very faded
                }
                if (mapboxMap.getLayer(otherOutlineLayerId)) {
                  mapboxMap.setPaintProperty(otherOutlineLayerId, 'line-opacity', 0.2); // Very faded
                }
              } catch (e) {
                // Ignore errors if layer doesn't exist
              }
            } else {
              // Keep current district at normal opacity
              try {
                if (mapboxMap.getLayer(fillLayerId)) {
                  mapboxMap.setPaintProperty(fillLayerId, 'fill-opacity', 0.2);
                }
                if (mapboxMap.getLayer(outlineLayerId)) {
                  mapboxMap.setPaintProperty(outlineLayerId, 'line-opacity', 0.8);
                }
              } catch (e) {
                // Ignore errors
              }
            }
          });
          
          // Combine district info with specific feature properties
          setHoveredDistrict({
            ...district,
            hoveredFeature: {
              properties: properties,
              geometry: feature.geometry,
            },
          });
        }
      };
      
      const handleMouseLeave = () => {
        mapboxMap.getCanvas().style.cursor = '';
        setHoveredDistrict(null);
        
        // Clear highlight by setting empty FeatureCollection
        const highlightSource = mapboxMap.getSource(highlightSourceId) as any;
        if (highlightSource && highlightSource.setData) {
          highlightSource.setData({
            type: 'FeatureCollection',
            features: [],
          });
        }
        
        // Restore all districts to normal opacity
        districts.forEach((otherDistrict) => {
          const otherFillLayerId = `congressional-district-${otherDistrict.district_number}-fill`;
          const otherOutlineLayerId = `congressional-district-${otherDistrict.district_number}-outline`;
          
          try {
            if (mapboxMap.getLayer(otherFillLayerId)) {
              mapboxMap.setPaintProperty(otherFillLayerId, 'fill-opacity', 0.2);
            }
            if (mapboxMap.getLayer(otherOutlineLayerId)) {
              mapboxMap.setPaintProperty(otherOutlineLayerId, 'line-opacity', 0.8);
            }
          } catch (e) {
            // Ignore errors if layer doesn't exist
          }
        });
      };
      
      // Use mousemove on fill layer to detect hover anywhere in polygon
      mapboxMap.on('mousemove', fillLayerId, handleMouseMove);
      mapboxMap.on('mouseleave', fillLayerId, handleMouseLeave);
      
      // Add click handler to open precinct modal
      // Only trigger if clicking directly on the district layer (not on other map elements)
      const handleClick = (e: any) => {
        // First check if a building was clicked - if so, don't open precinct modal
        const buildingFeatures = mapboxMap.queryRenderedFeatures(e.point, {
          layers: ['admin-buildings-icon', 'admin-buildings-label'],
        });
        
        if (buildingFeatures.length > 0) {
          // Building was clicked, let the building handler deal with it
          return;
        }
        
        // Stop event propagation to prevent interfering with other map clicks
        e.originalEvent?.stopPropagation?.();
        
        const features = mapboxMap.queryRenderedFeatures(e.point, {
          layers: [fillLayerId],
        });
        
        if (features.length > 0) {
          const feature = features[0];
          const properties = feature.properties || {};
          
          setSelectedPrecinct({
            feature: feature,
            district: district,
            properties: properties,
          });
          setIsPrecinctModalOpen(true);
        }
      };
      
      mapboxMap.on('click', fillLayerId, handleClick);
    });
    
    // Cleanup function
    return () => {
      if (!map) return;
      const mapboxMap = map as any;
      districts.forEach((district) => {
        const districtNum = district.district_number;
        const fillLayerId = `congressional-district-${districtNum}-fill`;
        const outlineLayerId = `congressional-district-${districtNum}-outline`;
        const sourceId = `congressional-district-${districtNum}-source`;
        
        try {
          // Remove event handlers
          mapboxMap.off('mousemove', fillLayerId);
          mapboxMap.off('mouseleave', fillLayerId);
          mapboxMap.off('click', fillLayerId);
          
          // Remove highlight layers
          const highlightFillLayerId = `congressional-district-${districtNum}-highlight-fill`;
          const highlightOutlineLayerId = `congressional-district-${districtNum}-highlight-outline`;
          const highlightSourceId = `congressional-district-${districtNum}-highlight-source`;
          
          if (mapboxMap.getLayer(highlightFillLayerId)) mapboxMap.removeLayer(highlightFillLayerId);
          if (mapboxMap.getLayer(highlightOutlineLayerId)) mapboxMap.removeLayer(highlightOutlineLayerId);
          if (mapboxMap.getSource(highlightSourceId)) mapboxMap.removeSource(highlightSourceId);
          
          if (mapboxMap.getLayer(fillLayerId)) mapboxMap.removeLayer(fillLayerId);
          if (mapboxMap.getLayer(outlineLayerId)) mapboxMap.removeLayer(outlineLayerId);
          if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      setHoveredDistrict(null);
    };
  }, [map, mapLoaded, districts, showDistricts]);

  // Handle building location editing mode
  useEffect(() => {
    if (!map || !mapLoaded) return;

    const mapboxMap = map as any;
    
    const handleEditLocationMode = (e: CustomEvent) => {
      const isEditing = e.detail.isEditing;
      setIsEditingBuildingLocation(isEditing);
      
      if (isEditing) {
        // Add click handler for location editing
        const locationClickHandler = (clickEvent: any) => {
          // Check if clicking on a building or district - if so, don't update location
          const buildingFeatures = mapboxMap.queryRenderedFeatures(clickEvent.point, {
            layers: ['admin-buildings-icon', 'admin-buildings-label'],
          });
          
          const districtFeatures = mapboxMap.queryRenderedFeatures(clickEvent.point, {
            layers: Array.from({ length: 8 }, (_, i) => `congressional-district-${i + 1}-fill`),
          });
          
          if (buildingFeatures.length > 0 || districtFeatures.length > 0) {
            return; // Don't update location if clicking on a building or district
          }
          
          // Get coordinates from click
          const { lng, lat } = clickEvent.lngLat;
          
          // Dispatch event to BuildingEditModal
          window.dispatchEvent(new CustomEvent('building-edit-location-click', {
            detail: { lat, lng },
          }));
        };
        
        mapboxMap.on('click', locationClickHandler);
        mapboxMap.__locationEditHandler = locationClickHandler;
        mapboxMap.getCanvas().style.cursor = 'crosshair';
      } else {
        // Remove click handler
        if (mapboxMap.__locationEditHandler) {
          mapboxMap.off('click', mapboxMap.__locationEditHandler);
          mapboxMap.__locationEditHandler = null;
        }
        mapboxMap.getCanvas().style.cursor = '';
      }
    };
    
    window.addEventListener('building-edit-location-mode', handleEditLocationMode as EventListener);
    
    return () => {
      window.removeEventListener('building-edit-location-mode', handleEditLocationMode as EventListener);
      // Clean up handler if still active
      if (mapboxMap.__locationEditHandler) {
        mapboxMap.off('click', mapboxMap.__locationEditHandler);
        mapboxMap.__locationEditHandler = null;
      }
      if (mapboxMap.getCanvas) {
        mapboxMap.getCanvas().style.cursor = '';
      }
    };
  }, [map, mapLoaded]);

  // Add temporary marker for pending building creation (emoji building pin)
  const addTempMarker = useCallback((mapInstance: any, lat: number, lng: number) => {
    // Remove existing temp marker if any
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }

    const mapbox = (window as any).mapboxgl;
    if (mapbox && mapInstance) {
      const el = document.createElement('div');
      el.className = 'temp-building-marker';
      el.style.cssText = `
        font-size: 32px;
        line-height: 1;
        cursor: pointer;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        animation: pulse 2s infinite;
        user-select: none;
        pointer-events: none;
      `;
      el.textContent = '🏢'; // Building emoji
      
      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
      `;
      if (!document.head.querySelector('#temp-marker-styles')) {
        style.id = 'temp-marker-styles';
        document.head.appendChild(style);
      }

      const marker = new mapbox.Marker({
        element: el,
        anchor: 'bottom'
      })
        .setLngLat([lng, lat])
        .addTo(mapInstance);

      tempMarkerRef.current = marker;
    }
  }, []);

  // Remove temporary marker
  const removeTempMarker = useCallback(() => {
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
  }, []);

  // Remove useEffect that was triggering on buildings change
  // Buildings are now updated via fetchBuildingsInBounds which calls updateBuildingMarkers directly

  // Handle address search
  const handleAddressSearch = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    try {
      const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${encodeURIComponent(query)}.json`;
      const params = new URLSearchParams({
        access_token: MAP_CONFIG.MAPBOX_TOKEN,
        country: 'us',
        bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
        types: 'address',
        limit: '5',
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) return;
      
      const data = await response.json();
      setAddressSuggestions(data.features || []);
      setShowAddressSuggestions(true);
    } catch (error) {
      console.error('[GovMapAdmin] Error searching address:', error);
    }
  };

  // Handle address selection - fly to location, drop emoji pin, and open form
  const handleAddressSelect = (feature: any) => {
    // Extract coordinates from feature (Mapbox returns [lng, lat])
    const [lng, lat] = feature.center || [];
    const fullAddress = feature.place_name || feature.text || '';
    
    // Validate coordinates
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.error('[GovMapAdmin] Invalid coordinates from feature:', feature);
      return;
    }
    
    // Clear search input first
    setAddressSearchQuery('');
    setShowAddressSuggestions(false);
    
    // Store coordinates and address for new building (available immediately)
    (window as any).__pendingBuildingData = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      full_address: fullAddress,
    };
    
    // Fly map to location first
    if (map && (map as any).flyTo) {
      (map as any).flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 1000,
        essential: true,
      });
      
      // Wait for fly animation to complete, then add marker and open form
      setTimeout(() => {
        // Add emoji building pin at selected location
        if (map) {
          addTempMarker(map, lat, lng);
        }
        
        // Open create building form with coordinates and address pre-filled
        setEditingBuilding(null); // null = create mode
        setIsModalOpen(true);
      }, 1000); // Wait for fly animation
    } else {
      // If map not ready, add marker immediately and open form
      if (map) {
        addTempMarker(map, lat, lng);
      }
      
      setEditingBuilding(null);
      setIsModalOpen(true);
    }
  };


  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Map - Full screen */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Account Icon - Top Left */}
      {account && (
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={() => {
              setShowLiveAccountModal(true);
              window.dispatchEvent(new CustomEvent('live-account-modal-change', {
                detail: { isOpen: true }
              }));
            }}
            className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden transition-colors ${
              (account.plan === 'pro' || account.plan === 'plus')
                ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                : 'border border-gray-200 hover:border-gray-300'
            }`}
            aria-label="Account"
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-white">
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={account.username || 'Account'}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {account.username?.[0]?.toUpperCase() || account.first_name?.[0]?.toUpperCase() || 'A'}
                  </span>
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Floating Controls - Top Right */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        {/* Toggle Districts Button */}
        <button
          onClick={() => setShowDistricts(!showDistricts)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors shadow-lg"
        >
          {showDistricts ? 'Hide' : 'Show'} Districts
        </button>
        
        {/* Address Search */}
        <div className="relative w-64 sm:w-80">
          <input
            type="text"
            value={addressSearchQuery}
            onChange={(e) => {
              setAddressSearchQuery(e.target.value);
              handleAddressSearch(e.target.value);
            }}
            onFocus={() => {
              if (addressSuggestions.length > 0) {
                setShowAddressSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setShowAddressSuggestions(false), 200);
            }}
            placeholder="Search address..."
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white/90 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          {showAddressSuggestions && addressSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
              {addressSuggestions.map((feature, index) => (
                <button
                  key={index}
                  onClick={() => handleAddressSelect(feature)}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-gray-900 truncate">{feature.place_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create Building Button */}
        <button
          onClick={() => {
            removeTempMarker(); // Remove any existing temp marker
            setEditingBuilding(null); // null = create mode
            setIsModalOpen(true);
            // Clear any pending data
            delete (window as any).__pendingBuildingData;
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors shadow-lg"
        >
          <PlusIcon className="w-3 h-3" />
          Create Building
        </button>
      </div>

      {/* Building Detail View - Full Screen */}
      {isModalOpen && editingBuilding && (
        <BuildingDetailView
          building={editingBuilding}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBuilding(null);
          }}
          onEdit={(building) => {
            // Close detail view and open edit modal
            setIsModalOpen(false);
            setIsEditModalOpen(true);
            // Keep editingBuilding set so edit modal has the data
          }}
          onDelete={async (building) => {
            if (!confirm(`Are you sure you want to delete "${building.name}"?`)) {
              return;
            }

            try {
              const response = await fetch(`/api/admin/buildings/${building.id}`, {
                method: 'DELETE',
              });

              if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete building');
              }

              // Refresh buildings in current viewport
              if (map) {
                const mapboxMap = map as any;
                const bounds = mapboxMap.getBounds();
                if (bounds) {
                  await fetchBuildingsInBounds({
                    minLng: bounds.getWest(),
                    maxLng: bounds.getEast(),
                    minLat: bounds.getSouth(),
                    maxLat: bounds.getNorth(),
                  });
                }
              }

              // Close modal
              setIsModalOpen(false);
              setEditingBuilding(null);
            } catch (error) {
              console.error('[GovMapAdmin] Error deleting building:', error);
              alert(error instanceof Error ? error.message : 'Failed to delete building');
            }
          }}
        />
      )}

      {/* Building Edit Modal - For both create and edit modes */}
      {(isEditModalOpen || (isModalOpen && !editingBuilding)) && (
        <BuildingEditModal
          isOpen={isEditModalOpen || (isModalOpen && !editingBuilding)}
          onClose={() => {
            setIsEditModalOpen(false);
            setIsModalOpen(false);
            setEditingBuilding(null);
            removeTempMarker();
          }}
          building={editingBuilding || null}
          onSave={async () => {
            // Refresh buildings in current viewport
            if (map) {
              const mapboxMap = map as any;
              const bounds = mapboxMap.getBounds();
              if (bounds) {
                await fetchBuildingsInBounds({
                  minLng: bounds.getWest(),
                  maxLng: bounds.getEast(),
                  minLat: bounds.getSouth(),
                  maxLat: bounds.getNorth(),
                });
              }
            }
            
            setIsEditModalOpen(false);
            setIsModalOpen(false);
            setEditingBuilding(null);
            removeTempMarker();
          }}
        />
      )}

      {/* Live Account Modal */}
      <LiveAccountModal
        isOpen={showLiveAccountModal}
        onClose={() => {
          setShowLiveAccountModal(false);
          window.dispatchEvent(new CustomEvent('live-account-modal-change', {
            detail: { isOpen: false }
          }));
        }}
      />

      {/* Precinct Modal */}
      <PrecinctModal
        isOpen={isPrecinctModalOpen}
        onClose={() => {
          setIsPrecinctModalOpen(false);
          setSelectedPrecinct(null);
        }}
        precinct={selectedPrecinct}
      />

      {/* District Hover Info - Bottom Right */}
      {hoveredDistrict && showDistricts && (
        <div className="absolute bottom-3 right-3 z-10 bg-white border border-gray-200 rounded-md shadow-lg p-3 max-w-sm max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            {/* District Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                    '#FFEAA7', '#DDA15E', '#BC6C25', '#6C5CE7'
                  ][hoveredDistrict.district_number - 1] || '#888888'
                }}
              />
              <h3 className="text-sm font-semibold text-gray-900">
                Congressional District {hoveredDistrict.district_number}
              </h3>
            </div>

            {/* Precinct/Feature Data */}
            {hoveredDistrict.hoveredFeature?.properties && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                  Precinct Data
                </h4>
                <div className="space-y-1 text-xs">
                  {Object.entries(hoveredDistrict.hoveredFeature.properties).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium text-gray-600 min-w-[100px]">{key}:</span>
                      <span className="text-gray-900 break-words">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* District Metadata */}
            <div className="pt-2 border-t border-gray-200 space-y-1 text-xs">
              {hoveredDistrict.name && (
                <p className="text-gray-500">
                  <span className="font-medium">Name:</span> {hoveredDistrict.name}
                </p>
              )}
              {hoveredDistrict.description && (
                <p className="text-gray-500">
                  <span className="font-medium">Description:</span> {hoveredDistrict.description}
                </p>
              )}
              {hoveredDistrict.publisher && (
                <p className="text-gray-500">
                  <span className="font-medium">Publisher:</span> {hoveredDistrict.publisher}
                </p>
              )}
              {hoveredDistrict.date && (
                <p className="text-gray-500">
                  <span className="font-medium">Date:</span> {hoveredDistrict.date}
                </p>
              )}
              {hoveredDistrict.geometry?.features && (
                <p className="text-gray-500">
                  <span className="font-medium">Total Precincts:</span> {hoveredDistrict.geometry.features.length}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

