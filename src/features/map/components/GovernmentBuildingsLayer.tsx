'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface Building {
  id: string;
  type: 'state' | 'city' | 'town' | 'federal';
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  full_address: string | null;
  website: string | null;
  cover_images: string[] | null;
}

interface GovernmentBuildingsLayerProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  visible: boolean;
  onBuildingClick?: (building: Building) => void;
}

/**
 * Government Buildings Layer Component
 * Renders Minnesota government buildings on the map with icons
 */
export default function GovernmentBuildingsLayer({
  map,
  mapLoaded,
  visible,
  onBuildingClick,
}: GovernmentBuildingsLayerProps) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const isAddingLayersRef = useRef(false);
  const buildingsLayerRef = useRef<{
    sourceId: string;
    iconLayerId: string;
    labelLayerId: string;
    clickHandler?: (e: any) => void;
  } | null>(null);
  const iconsLoadedRef = useRef<Set<string>>(new Set<string>());
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        }
      } catch (error) {
        console.error(`[GovernmentBuildingsLayer] Failed to load icon for ${type}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }, []);

  // Fetch buildings based on map bounds (spatial query)
  const fetchBuildingsInBounds = useCallback(async (bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number }): Promise<void> => {
    if (!visible) return;

    try {
      const params = new URLSearchParams({
        minLng: bounds.minLng.toString(),
        maxLng: bounds.maxLng.toString(),
        minLat: bounds.minLat.toString(),
        maxLat: bounds.maxLat.toString(),
      });
      
      const response = await fetch(`/api/civic/buildings?${params}`);
      
      if (!response.ok) {
        console.error('[GovernmentBuildingsLayer] Failed to fetch buildings:', response.statusText);
        return;
      }
      
      const data = await response.json();
      const newBuildings = Array.isArray(data) ? data : [];
      setBuildings(newBuildings);
    } catch (error) {
      console.error('[GovernmentBuildingsLayer] Error fetching buildings:', error);
    }
  }, [visible]);

  // Update building markers on map
  const updateBuildingMarkers = useCallback(async (buildingsList: Building[]): Promise<void> => {
    if (!map || !mapLoaded || isAddingLayersRef.current || !visible) return;

    const mapboxMap = map as any;
    const sourceId = 'government-buildings';
    const iconLayerId = 'government-buildings-icon';
    const labelLayerId = 'government-buildings-label';

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
            mapboxMap.off('mouseenter', oldLabelLayerId);
            mapboxMap.off('mouseleave', oldLabelLayerId);
          }
        }
      }

      // Filter buildings with valid coordinates
      const validBuildings = buildingsList.filter(b => b.lat != null && b.lng != null);
      
      if (validBuildings.length === 0) {
        // Remove layers if no buildings
        try {
          if (mapboxMap.getLayer(iconLayerId)) mapboxMap.removeLayer(iconLayerId);
          if (mapboxMap.getLayer(labelLayerId)) mapboxMap.removeLayer(labelLayerId);
          if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
        } catch (e) {
          // Ignore errors
        }
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
            website: building.website,
          },
        })),
      };

      // Update or create source
      if (mapboxMap.getSource(sourceId)) {
        const source = mapboxMap.getSource(sourceId) as any;
        if (source && source.setData) {
          source.setData(geoJSON);
        }
      } else {
        mapboxMap.addSource(sourceId, {
          type: 'geojson',
          data: geoJSON,
        });
      }

      // Define click handler
      const clickHandler = (e: any) => {
        e.preventDefault();
        const feature = e.features?.[0];
        
        if (!feature || !feature.properties) {
          return;
        }
        
        const buildingId = feature.properties.id;
        const building = buildingsList.find(b => b.id === buildingId);
        
        if (building && onBuildingClick) {
          onBuildingClick(building);
        }
      };

      // Add icon layer if it doesn't exist
      if (!mapboxMap.getLayer(iconLayerId)) {
        // Don't insert before mentions - buildings should be on top
        
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
              0, 0.8,    // Increased from 0.5
              5, 1.0,    // Increased from 0.75
              10, 1.5,   // Increased from 1.0
              12, 2.0,   // Increased from 1.25
              14, 2.5,   // Increased from 1.5
              16, 3.0,   // Increased from 1.75
              18, 3.5,   // Increased from 2.0
              20, 4.0,   // Increased from 2.5
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true, // Changed to true for priority
            'symbol-z-order': 'source', // Render in source order
          },
        }); // No beforeId - buildings render on top

        // Add label layer
        mapboxMap.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 2.0], // Increased offset for larger icons
            'text-anchor': 'top',
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 10,  // Increased from 9
              12, 12,  // Increased from 11
              14, 14,  // Increased from 13
              16, 16,  // Increased from 15
              18, 18,  // Increased from 17
              20, 20   // Increased from 19
            ],
            'text-allow-overlap': true,  // Always show text
            'text-ignore-placement': true, // Always show text, ignore other labels
            'symbol-z-order': 'source', // Render in source order
          },
          paint: {
            'text-color': '#333333',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
            'text-opacity': 1.0, // Always fully visible
          },
        }); // No beforeId - buildings render on top

        // Attach click handler to both icon and label layers
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
      } else {
        // Layer already exists - ensure click handler is attached
        if (buildingsLayerRef.current?.clickHandler) {
          mapboxMap.off('click', iconLayerId, buildingsLayerRef.current.clickHandler);
          mapboxMap.off('click', labelLayerId, buildingsLayerRef.current.clickHandler);
        }
        
        mapboxMap.on('click', iconLayerId, clickHandler);
        mapboxMap.on('click', labelLayerId, clickHandler);
        
        buildingsLayerRef.current = {
          sourceId,
          iconLayerId,
          labelLayerId,
          clickHandler,
        };
      }
    } catch (error) {
      console.error('[GovernmentBuildingsLayer] Error updating building markers:', error);
    } finally {
      isAddingLayersRef.current = false;
    }
  }, [map, mapLoaded, visible, loadBuildingIcons, onBuildingClick]);

  // Fetch buildings on mount and when visible changes
  useEffect(() => {
    if (!map || !mapLoaded || !visible) {
      // Clean up if hiding buildings
      if (!visible && map) {
        const mapboxMap = map as any;
        const sourceId = 'government-buildings';
        const iconLayerId = 'government-buildings-icon';
        const labelLayerId = 'government-buildings-label';
        
        try {
          if (buildingsLayerRef.current?.clickHandler) {
            const { iconLayerId: oldIconLayerId, labelLayerId: oldLabelLayerId, clickHandler: oldHandler } = buildingsLayerRef.current;
            if (oldHandler) {
              mapboxMap.off('click', oldIconLayerId, oldHandler);
              mapboxMap.off('click', oldLabelLayerId, oldHandler);
              mapboxMap.off('mouseenter', oldIconLayerId);
              mapboxMap.off('mouseleave', oldIconLayerId);
              mapboxMap.off('mouseenter', oldLabelLayerId);
              mapboxMap.off('mouseleave', oldLabelLayerId);
            }
          }
          
          if (mapboxMap.getLayer(iconLayerId)) mapboxMap.removeLayer(iconLayerId);
          if (mapboxMap.getLayer(labelLayerId)) mapboxMap.removeLayer(labelLayerId);
          if (mapboxMap.getSource(sourceId)) mapboxMap.removeSource(sourceId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      return;
    }

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
  }, [map, mapLoaded, visible, fetchBuildingsInBounds]);

  // Update markers when buildings data changes
  useEffect(() => {
    if (buildings.length > 0 && visible) {
      updateBuildingMarkers(buildings);
    }
  }, [buildings, visible, updateBuildingMarkers]);

  // Re-fetch on map move/zoom (debounced)
  useEffect(() => {
    if (!map || !mapLoaded || !visible) return;

    const mapboxMap = map as any;
    
    const handleMapMove = () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
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
  }, [map, mapLoaded, visible, fetchBuildingsInBounds]);

  return null; // This component doesn't render any direct JSX
}

